const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/cashregister/status
 * Retorna apenas o status do caixa atual (open/closed)
 */
router.get('/status', async (req, res) => {
    try {
        const { data: register } = await supabase.from('cash_register').select('status').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        res.json({ success: true, data: { status: register ? register.status : 'closed' } });
    } catch (error) {
        console.error('Erro ao buscar status do caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar status do caixa.' });
    }
});

/**
 * GET /api/cashregister/current
 * Retorna o caixa aberto do dia (se houver)
 */
router.get('/current', async (req, res) => {
    try {
        const { data: register } = await supabase.from('cash_register').select('*, users(full_name)').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();

        if (!register) {
            return res.json({ success: true, data: null, message: 'Nenhum caixa aberto.' });
        }

        register.user_name = register.users?.full_name;

        // Vendas realizadas durante este caixa
        const { data: salesRaw } = await supabase.from('sales').select('id, total').eq('status', 'completed').gte('created_at', register.opened_at);
        const total_sales = salesRaw ? salesRaw.length : 0;
        const total_revenue = salesRaw ? salesRaw.reduce((sum, s) => sum + s.total, 0) : 0;
        const salesSummary = { total_sales, total_revenue };

        // Vendas por forma de pagamento
        const saleIds = salesRaw ? salesRaw.map(s => s.id) : [];
        let paymentBreakdown = [];
        if (saleIds.length > 0) {
            const { data: pmts } = await supabase.from('payments').select('method, amount').in('sale_id', saleIds);
            if (pmts) {
                const breakdownMap = pmts.reduce((acc, p) => {
                    acc[p.method] = (acc[p.method] || 0) + p.amount;
                    return acc;
                }, {});
                paymentBreakdown = Object.keys(breakdownMap).map(k => ({ method: k, total: breakdownMap[k] }));
            }
        }

        // Movimentações (sangrias e suprimentos)
        const { data: movementsRaw } = await supabase.from('cash_movements').select('*, users(full_name)').eq('cash_register_id', register.id).order('created_at', { ascending: false });
        const movements = (movementsRaw || []).map(m => ({ ...m, user_name: m.users?.full_name }));

        const totalWithdrawn = movements
            .filter(m => m.type === 'withdraw')
            .reduce((s, m) => s + m.amount, 0);
        const totalSupplied = movements
            .filter(m => m.type === 'supply')
            .reduce((s, m) => s + m.amount, 0);

        // Saldo esperado em dinheiro: abertura + vendas em cash + suprimentos - sangrias
        const cashFromSales = paymentBreakdown.find(p => p.method === 'cash')?.total || 0;
        const expectedCash = register.opening_balance + cashFromSales + totalSupplied - totalWithdrawn;

        res.json({
            success: true,
            data: {
                ...register,
                sales: salesSummary,
                paymentBreakdown,
                movements,
                totalWithdrawn,
                totalSupplied,
                cashFromSales,
                expectedCash,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar caixa.' });
    }
});

/**
 * POST /api/cashregister/open
 * Abre um novo caixa
 */
router.post('/open', async (req, res) => {
    try {
        const { opening_balance } = req.body;

        // Verifica se já existe caixa aberto
        const { data: openRegister } = await supabase.from('cash_register').select('id').eq('status', 'open').maybeSingle();
        if (openRegister) {
            return res.status(400).json({ success: false, message: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' });
        }

        const { randomUUID } = require('crypto');
        const uuid = req.body.uuid || randomUUID();

        const { data: info, error } = await supabase.from('cash_register').insert({
            user_id: req.session.userId, opening_balance: parseFloat(opening_balance) || 0, status: 'open', uuid
        }).select('id').single();
        if (error) throw error;

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'open_register', entity: 'cash_register', entity_id: info.id, description: `Caixa aberto com R$ ${(parseFloat(opening_balance) || 0).toFixed(2)}` });

        res.status(201).json({ success: true, message: 'Caixa aberto com sucesso!', data: { id: info.id } });
    } catch (error) {
        console.error('Erro ao abrir caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao abrir caixa.' });
    }
});

/**
 * POST /api/cashregister/close
 * Fecha o caixa atual
 */
router.post('/close', async (req, res) => {
    try {
        const { counted_balance, notes } = req.body;

        const { data: register } = await supabase.from('cash_register').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto para fechar.' });
        }

        await supabase.from('cash_register').update({
            status: 'closed', closing_balance: parseFloat(counted_balance) || 0, closed_at: new Date().toISOString(), notes: notes || ''
        }).eq('id', register.id);

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'close_register', entity: 'cash_register', entity_id: register.id, description: `Caixa fechado - Contagem: R$ ${(parseFloat(counted_balance) || 0).toFixed(2)}` });

        res.json({ success: true, message: 'Caixa fechado com sucesso!' });
    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao fechar caixa.' });
    }
});

/**
 * POST /api/cashregister/withdraw
 * Sangria (retirada de dinheiro do caixa)
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Informe um valor válido.' });
        }

        const { data: register } = await supabase.from('cash_register').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto.' });
        }

        await supabase.from('cash_movements').insert({
            cash_register_id: register.id, type: 'withdraw', amount: parsedAmount, reason: reason || 'Sangria', user_id: req.session.userId
        });

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'withdraw', entity: 'cash_register', entity_id: register.id, description: `Sangria: R$ ${parsedAmount.toFixed(2)} - ${reason || 'Sangria'}` });

        res.json({ success: true, message: `Sangria de R$ ${parsedAmount.toFixed(2)} registrada.` });
    } catch (error) {
        console.error('Erro na sangria:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar sangria.' });
    }
});

/**
 * POST /api/cashregister/supply
 * Suprimento (adição de dinheiro ao caixa)
 */
router.post('/supply', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Informe um valor válido.' });
        }

        const { data: register } = await supabase.from('cash_register').select('id').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto.' });
        }

        await supabase.from('cash_movements').insert({
            cash_register_id: register.id, type: 'supply', amount: parsedAmount, reason: reason || 'Suprimento', user_id: req.session.userId
        });

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'supply', entity: 'cash_register', entity_id: register.id, description: `Suprimento: R$ ${parsedAmount.toFixed(2)} - ${reason || 'Suprimento'}` });

        res.json({ success: true, message: `Suprimento de R$ ${parsedAmount.toFixed(2)} registrado.` });
    } catch (error) {
        console.error('Erro no suprimento:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar suprimento.' });
    }
});

/**
 * GET /api/cashregister/history
 * Histórico de caixas fechados
 */
router.get('/history', async (req, res) => {
    try {
        const { data: historyRaw, error } = await supabase.from('cash_register').select('*, users(full_name)').order('opened_at', { ascending: false }).limit(30);
        if (error) throw error;
        
        const history = [];
        for (const cr of (historyRaw || [])) {
            let salesQuery = supabase.from('sales').select('total').eq('status', 'completed').gte('created_at', cr.opened_at);
            if (cr.closed_at) {
                salesQuery = salesQuery.lte('created_at', cr.closed_at);
            }
            
            const { data: salesRaw } = await salesQuery;
            
            const sales_count = salesRaw ? salesRaw.length : 0;
            const sales_total = salesRaw ? salesRaw.reduce((sum, s) => sum + s.total, 0) : 0;
            
            history.push({
                ...cr,
                user_name: cr.users?.full_name,
                sales_count,
                sales_total
            });
        }
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Erro no histórico:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar histórico.' });
    }
});

module.exports = router;

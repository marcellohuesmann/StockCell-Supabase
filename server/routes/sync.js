const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.post('/push-sale', async (req, res) => {
    try {
        const { uuid, items, payments, discount_amount, created_at, cash_received, cash_change } = req.body;
        if (!uuid || !items || !items.length) return res.status(400).json({ success: false, message: 'Dados incompletos.' });

        const { data: existing } = await supabase.from('sales').select('id').eq('uuid', uuid).maybeSingle();
        if (existing) return res.json({ success: true, message: 'Venda já sincronizada.', data: { id: existing.id } });

        const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - (discount_amount || 0));

        const dLoc = new Date();
        const pad = n => String(n).padStart(2,'0');
        const localTime = `${dLoc.getFullYear()}-${pad(dLoc.getMonth()+1)}-${pad(dLoc.getDate())} ${pad(dLoc.getHours())}:${pad(dLoc.getMinutes())}:${pad(dLoc.getSeconds())}`;

        const { data: saleInfo, error: saleErr } = await supabase.from('sales').insert({
            user_id: req.session.userId, subtotal, discount_amount: discount_amount || 0, total, status: 'completed', uuid, created_at: created_at || localTime, cash_received: cash_received || 0, cash_change: cash_change || 0
        }).select('id').single();
        if (saleErr) throw saleErr;
        const saleId = saleInfo.id;

        for (const item of items) {
            const itemTotal = item.unit_price * item.quantity;
            await supabase.from('sale_items').insert({
                sale_id: saleId, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price, discount: item.discount || 0, total: itemTotal
            });
            const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            const newStock = Math.max(0, (prod?.current_stock || 0) - item.quantity);
            await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
            await supabase.from('stock_movements').insert({
                product_id: item.product_id, user_id: req.session.userId, type: 'exit', quantity: item.quantity, balance_after: newStock, reason: 'Venda (sync offline)', reference_id: saleId
            });
        }

        for (const pm of (payments || [])) {
            await supabase.from('payments').insert({ sale_id: saleId, method: pm.method, amount: pm.amount });
            if (pm.method === 'store_credit') {
                await supabase.from('transactions').insert({
                    type: 'income', description: 'Venda a prazo (offline sync)', amount: pm.amount, status: 'pending', due_date: pm.due_date || localTime.substring(0, 10), reference_id: saleId, reference_type: 'sale'
                });
            }
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'sale', entity: 'sale', entity_id: saleId, description: `Venda (Offline) #${String(saleId).padStart(4,'0')} - R$ ${total.toFixed(2).replace('.',',')}`
        });

        res.json({ success: true, message: 'Venda sincronizada.', data: { id: saleId } });
    } catch (error) {
        console.error('Sync push-sale error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar venda.' });
    }
});

router.post('/push-transaction', async (req, res) => {
    try {
        const { type, category_id, description, amount, status, due_date, notes, created_at } = req.body;
        if (!type || !description || !amount || !due_date) return res.status(400).json({ success: false, message: 'Dados incompletos.' });

        const dLoc = new Date();
        const pad = n => String(n).padStart(2,'0');
        const localTime = `${dLoc.getFullYear()}-${pad(dLoc.getMonth()+1)}-${pad(dLoc.getDate())} ${pad(dLoc.getHours())}:${pad(dLoc.getMinutes())}:${pad(dLoc.getSeconds())}`;

        const initialStatus = status || 'pending';
        const paidAmount = initialStatus === 'completed' ? amount : 0;

        const { data: info, error } = await supabase.from('transactions').insert({
            type, category_id: category_id || null, description, amount, paid_amount: paidAmount, status: initialStatus, due_date, notes: notes || '', created_at: created_at || localTime
        }).select('id').single();
        if (error) throw error;

        res.json({ success: true, message: 'Transação sincronizada.', data: { id: info.id } });
    } catch (error) {
        console.error('Sync push-transaction error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar transação.' });
    }
});

router.post('/push-transaction-payment', async (req, res) => {
    try {
        const { transaction_id, amount, payment_method, payment_date } = req.body;
        if (!transaction_id || !amount) return res.status(400).json({ success: false, message: 'Dados incompletos.' });

        const { data: tx } = await supabase.from('transactions').select('*').eq('id', transaction_id).maybeSingle();
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });

        const newPaidAmount = tx.paid_amount + amount;
        const newStatus = newPaidAmount >= tx.amount ? 'completed' : 'partial';

        await supabase.from('transaction_payments').insert({ transaction_id, amount, payment_method: payment_method || 'cash', payment_date });
        await supabase.from('transactions').update({ status: newStatus, paid_amount: newPaidAmount, payment_date, payment_method: payment_method || 'cash' }).eq('id', transaction_id);

        res.json({ success: true, message: 'Pagamento sincronizado.' });
    } catch (error) {
        console.error('Sync push-transaction-payment error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar pagamento.' });
    }
});

router.post('/push-cash-register', async (req, res) => {
    try {
        const data = req.body;
        let existing = null;
        if (data.uuid) {
            const { data: ex1 } = await supabase.from('cash_registers').select('id, status').eq('uuid', data.uuid).maybeSingle();
            existing = ex1;
        }
        if (!existing && data.id) {
            const { data: ex2 } = await supabase.from('cash_registers').select('id, status').eq('id', data.id).maybeSingle();
            existing = ex2;
        }
        if (!existing && data.status === 'closed') {
            const { data: ex3 } = await supabase.from('cash_registers').select('id, status').eq('status', 'open').order('opened_at', { ascending: false }).limit(1).maybeSingle();
            existing = ex3;
        }

        if (existing) {
            if (data.status === 'closed' && existing.status === 'open') {
                await supabase.from('cash_registers').update({ status: 'closed', closed_at: data.closed_at, closing_balance: data.closing_balance, closing_notes: data.closing_notes }).eq('id', existing.id);
                await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'close_register', entity: 'cash_register', entity_id: existing.id, description: 'Caixa Fechado (Offline)' });
                return res.json({ success: true, message: 'Caixa fechado sincronizado.' });
            }
            return res.json({ success: true, message: 'Caixa já sincronizado.' });
        }
        
        const { data: crInfo } = await supabase.from('cash_registers').insert({
            user_id: req.session.userId, opening_balance: data.opening_balance, status: data.status, opened_at: data.opened_at, uuid: data.uuid
        }).select('id').single();
        
        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'open_register', entity: 'cash_register', entity_id: crInfo.id, description: 'Caixa Aberto (Offline)' });

        if (data.status === 'closed' && data.closed_at) {
            await supabase.from('cash_registers').update({ closed_at: data.closed_at, closing_balance: data.closing_balance, closing_notes: data.closing_notes }).eq('id', crInfo.id);
            await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'close_register', entity: 'cash_register', entity_id: crInfo.id, description: 'Caixa Fechado (Offline)' });
        }

        res.json({ success: true, message: 'Registro de caixa sincronizado.' });
    } catch (e) {
        console.error('Push cash register error:', e);
        res.status(500).json({ success: false, message: 'Erro ao processar caixa offline.' });
    }
});

router.post('/push-cash-movement', async (req, res) => {
    try {
        const data = req.body;
        if (!data.uuid) return res.status(400).json({ success: false, message: 'Dados incompletos' });
        
        const { data: existing } = await supabase.from('cash_movements').select('id').eq('uuid', data.uuid).maybeSingle();
        if (existing) return res.json({ success: true, message: 'Movimento já sincronizado.' });

        let realCashRegisterId = null;
        if (data.cash_register_uuid) {
            const { data: cr } = await supabase.from('cash_registers').select('id').eq('uuid', data.cash_register_uuid).maybeSingle();
            if (cr) realCashRegisterId = cr.id;
        } else if (data.cash_register_id && typeof data.cash_register_id === 'number' && data.cash_register_id > 0) {
            realCashRegisterId = data.cash_register_id;
        }

        const { data: movInfo } = await supabase.from('cash_movements').insert({
            cash_register_id: realCashRegisterId, user_id: req.session.userId, type: data.type, amount: data.amount, reason: data.reason, uuid: data.uuid, created_at: data.created_at
        }).select('id').single();
        
        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: data.type, entity: 'cash_movements', entity_id: movInfo.id, description: `${data.type === 'withdraw' ? 'Sangria' : 'Suprimento'} (Offline) - R$ ${parseFloat(data.amount).toFixed(2).replace('.',',')}`
        });
        
        res.json({ success: true, message: 'Movimento de caixa sincronizado.' });
    } catch (e) {
        console.error('Push cash movement error:', e);
        res.status(500).json({ success: false, message: 'Erro ao processar movimento offline.' });
    }
});

router.get('/pull-all', async (req, res) => {
    try {
        const { data: products } = await supabase.from('products').select('*');
        const { data: categories } = await supabase.from('categories').select('*');
        const { data: customers } = await supabase.from('customers').select('*');
        const { data: suppliers } = await supabase.from('suppliers').select('*');
        const { data: salesRaw } = await supabase.from('sales').select('*, users(full_name)').order('created_at', { ascending: false }).limit(500);
        const sales = (salesRaw || []).map(s => ({ ...s, user_name: s.users?.full_name }));
        
        let sale_items = [];
        let payments = [];
        if (sales.length > 0) {
            const saleIds = sales.map(s => s.id);
            const { data: siRaw } = await supabase.from('sale_items').select('*, products(name)').in('sale_id', saleIds);
            sale_items = (siRaw || []).map(si => ({ ...si, product_name: si.products?.name }));
            const { data: pms } = await supabase.from('payments').select('*').in('sale_id', saleIds);
            payments = pms || [];
        }

        const { data: transaction_categories } = await supabase.from('transaction_categories').select('*');
        const { data: txRaw } = await supabase.from('transactions').select('*, transaction_categories(name, color)').order('due_date', { ascending: false }).limit(500);
        const transactions = (txRaw || []).map(t => ({ ...t, category_name: t.transaction_categories?.name, category_color: t.transaction_categories?.color }));
        
        let transaction_payments = [];
        if (transactions.length > 0) {
            const txIds = transactions.map(t => t.id);
            const { data: tp } = await supabase.from('transaction_payments').select('*').in('transaction_id', txIds);
            transaction_payments = tp || [];
        }

        const { data: stock_movements } = await supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(500);
        const { data: cash_registers } = await supabase.from('cash_registers').select('*').order('opened_at', { ascending: false }).limit(50);
        const { data: cash_movements } = await supabase.from('cash_movements').select('*').order('created_at', { ascending: false }).limit(500);
        const { data: bank_accounts } = await supabase.from('bank_accounts').select('*');

        const { data: settingsRows } = await supabase.from('app_settings').select('key, value');
        const settings = {};
        (settingsRows || []).forEach(r => { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } });

        res.json({
            success: true,
            data: { products, categories, customers, suppliers, sales, sale_items, payments, transactions, transaction_categories, transaction_payments, bank_accounts, stock_movements, cash_registers, cash_movements, settings },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sync pull-all error:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar dados para sync.' });
    }
});

module.exports = router;

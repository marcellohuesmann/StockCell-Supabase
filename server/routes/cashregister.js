const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/cashregister/status
 * Retorna apenas o status do caixa atual (open/closed)
 */
router.get('/status', (req, res) => {
    try {
        const db = getDatabase();
        const register = db.prepare("SELECT status FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
        res.json({ success: true, data: { status: register ? register.status : 'closed' } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar status do caixa.' });
    }
});

/**
 * GET /api/cashregister/current
 * Retorna o caixa aberto do dia (se houver)
 */
router.get('/current', (req, res) => {
    try {
        const db = getDatabase();
        const register = db.prepare(`
            SELECT cr.*, u.full_name as user_name
            FROM cash_register cr
            LEFT JOIN users u ON cr.user_id = u.id
            WHERE cr.status = 'open'
            ORDER BY cr.opened_at DESC LIMIT 1
        `).get();

        if (!register) {
            return res.json({ success: true, data: null, message: 'Nenhum caixa aberto.' });
        }

        // Vendas realizadas durante este caixa
        const salesSummary = db.prepare(`
            SELECT
                COUNT(*) as total_sales,
                COALESCE(SUM(total), 0) as total_revenue
            FROM sales
            WHERE status = 'completed'
              AND created_at >= ?
        `).get(register.opened_at);

        // Vendas por forma de pagamento
        const paymentBreakdown = db.prepare(`
            SELECT pm.method, COALESCE(SUM(pm.amount), 0) as total
            FROM payments pm
            JOIN sales s ON pm.sale_id = s.id
            WHERE s.status = 'completed' AND s.created_at >= ?
            GROUP BY pm.method
        `).all(register.opened_at);

        // Movimentações (sangrias e suprimentos)
        const movements = db.prepare(`
            SELECT cm.*, u.full_name as user_name
            FROM cash_movements cm
            LEFT JOIN users u ON cm.user_id = u.id
            WHERE cm.cash_register_id = ?
            ORDER BY cm.created_at DESC
        `).all(register.id);

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
router.post('/open', (req, res) => {
    try {
        const db = getDatabase();
        const { opening_balance } = req.body;

        // Verifica se já existe caixa aberto
        const openRegister = db.prepare("SELECT id FROM cash_register WHERE status = 'open'").get();
        if (openRegister) {
            return res.status(400).json({ success: false, message: 'Já existe um caixa aberto. Feche-o antes de abrir outro.' });
        }

        const { randomUUID } = require('crypto');
        const uuid = req.body.uuid || randomUUID();

        const info = db.prepare(`
            INSERT INTO cash_register (user_id, opening_balance, status, uuid)
            VALUES (?, ?, 'open', ?)
        `).run(req.session.userId, parseFloat(opening_balance) || 0, uuid);

        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'open_register', 'cash_register', ?, ?)")
            .run(req.session.userId, info.lastInsertRowid, `Caixa aberto com R$ ${(parseFloat(opening_balance) || 0).toFixed(2)}`);

        res.status(201).json({ success: true, message: 'Caixa aberto com sucesso!', data: { id: info.lastInsertRowid } });
    } catch (error) {
        console.error('Erro ao abrir caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao abrir caixa.' });
    }
});

/**
 * POST /api/cashregister/close
 * Fecha o caixa atual
 */
router.post('/close', (req, res) => {
    try {
        const db = getDatabase();
        const { counted_balance, notes } = req.body;

        const register = db.prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto para fechar.' });
        }

        db.prepare(`
            UPDATE cash_register
            SET status = 'closed',
                closing_balance = ?,
                closed_at = datetime('now','localtime'),
                notes = ?
            WHERE id = ?
        `).run(parseFloat(counted_balance) || 0, notes || '', register.id);

        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'close_register', 'cash_register', ?, ?)")
            .run(req.session.userId, register.id, `Caixa fechado - Contagem: R$ ${(parseFloat(counted_balance) || 0).toFixed(2)}`);

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
router.post('/withdraw', (req, res) => {
    try {
        const db = getDatabase();
        const { amount, reason } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Informe um valor válido.' });
        }

        const register = db.prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto.' });
        }

        db.prepare(`
            INSERT INTO cash_movements (cash_register_id, type, amount, reason, user_id)
            VALUES (?, 'withdraw', ?, ?, ?)
        `).run(register.id, parsedAmount, reason || 'Sangria', req.session.userId);

        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'withdraw', 'cash_register', ?, ?)")
            .run(req.session.userId, register.id, `Sangria: R$ ${parsedAmount.toFixed(2)} - ${reason || 'Sangria'}`);

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
router.post('/supply', (req, res) => {
    try {
        const db = getDatabase();
        const { amount, reason } = req.body;
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Informe um valor válido.' });
        }

        const register = db.prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
        if (!register) {
            return res.status(400).json({ success: false, message: 'Nenhum caixa aberto.' });
        }

        db.prepare(`
            INSERT INTO cash_movements (cash_register_id, type, amount, reason, user_id)
            VALUES (?, 'supply', ?, ?, ?)
        `).run(register.id, parsedAmount, reason || 'Suprimento', req.session.userId);

        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'supply', 'cash_register', ?, ?)")
            .run(req.session.userId, register.id, `Suprimento: R$ ${parsedAmount.toFixed(2)} - ${reason || 'Suprimento'}`);

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
router.get('/history', (req, res) => {
    try {
        const db = getDatabase();
        const history = db.prepare(`
            SELECT cr.*, u.full_name as user_name,
                (SELECT COUNT(*) FROM sales s WHERE s.status='completed' AND s.created_at >= cr.opened_at AND (cr.closed_at IS NULL OR s.created_at <= cr.closed_at)) as sales_count,
                (SELECT COALESCE(SUM(s.total),0) FROM sales s WHERE s.status='completed' AND s.created_at >= cr.opened_at AND (cr.closed_at IS NULL OR s.created_at <= cr.closed_at)) as sales_total
            FROM cash_register cr
            LEFT JOIN users u ON cr.user_id = u.id
            ORDER BY cr.opened_at DESC
            LIMIT 30
        `).all();

        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Erro no histórico:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar histórico.' });
    }
});

module.exports = router;

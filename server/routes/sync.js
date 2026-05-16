const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/sync/push-sale
 * Recebe uma venda criada offline (com UUID para deduplicação)
 */
router.post('/push-sale', (req, res) => {
    try {
        const db = getDatabase();
        const { uuid, items, payments, discount_amount, created_at, cash_received, cash_change } = req.body;

        if (!uuid || !items || !items.length) {
            return res.status(400).json({ success: false, message: 'Dados incompletos.' });
        }

        // Deduplication: check if UUID already exists
        const existing = db.prepare("SELECT id FROM sales WHERE uuid = ?").get(uuid);
        if (existing) {
            return res.json({ success: true, message: 'Venda já sincronizada.', data: { id: existing.id } });
        }

        const subtotal = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - (discount_amount || 0));

        // Insert sale
        const dLoc = new Date();
        const pad = n => String(n).padStart(2,'0');
        const localTime = `${dLoc.getFullYear()}-${pad(dLoc.getMonth()+1)}-${pad(dLoc.getDate())} ${pad(dLoc.getHours())}:${pad(dLoc.getMinutes())}:${pad(dLoc.getSeconds())}`;

        const saleInfo = db.prepare(`
            INSERT INTO sales (user_id, subtotal, discount_amount, total, status, uuid, created_at, cash_received, cash_change)
            VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)
        `).run(req.session.userId, subtotal, discount_amount || 0, total, uuid, created_at || localTime, cash_received || 0, cash_change || 0);

        const saleId = saleInfo.lastInsertRowid;

        // Insert items + adjust stock
        const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total) VALUES (?, ?, ?, ?, ?, ?)`);
        const updateStock = db.prepare(`UPDATE products SET current_stock = MAX(0, current_stock - ?) WHERE id = ?`);
        const insertMovement = db.prepare(`INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id) VALUES (?, ?, 'exit', ?, (SELECT MAX(0, current_stock) FROM products WHERE id = ?), 'Venda (sync offline)', ?)`);

        for (const item of items) {
            const itemTotal = item.unit_price * item.quantity;
            insertItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.discount || 0, itemTotal);
            updateStock.run(item.quantity, item.product_id);
            insertMovement.run(item.product_id, req.session.userId, item.quantity, item.product_id, saleId);
        }

        // Insert payments
        const insertPayment = db.prepare(`INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)`);
        for (const pm of (payments || [])) {
            insertPayment.run(saleId, pm.method, pm.amount);

            if (pm.method === 'store_credit') {
                db.prepare(`INSERT INTO transactions (type, description, amount, status, due_date, reference_id, reference_type)
                    VALUES ('income', 'Venda a prazo (offline sync)', ?, 'pending', ?, ?, 'sale')
                `).run(pm.amount, pm.due_date || localTime.substring(0, 10), saleId);
            }
        }

        // Insert log
        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'sale', 'sale', ?, ?)")
            .run(req.session.userId, saleId, `Venda (Offline) #${String(saleId).padStart(4,'0')} - R$ ${total.toFixed(2).replace('.',',')}`);

        res.json({ success: true, message: 'Venda sincronizada.', data: { id: saleId } });
    } catch (error) {
        console.error('Sync push-sale error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar venda.' });
    }
});

/**
 * POST /api/sync/push-transaction
 * Recebe uma transação financeira criada offline
 */
router.post('/push-transaction', (req, res) => {
    try {
        const db = getDatabase();
        const { type, category_id, description, amount, status, due_date, notes, created_at } = req.body;

        if (!type || !description || !amount || !due_date) {
            return res.status(400).json({ success: false, message: 'Dados incompletos.' });
        }

        const dLoc = new Date();
        const pad = n => String(n).padStart(2,'0');
        const localTime = `${dLoc.getFullYear()}-${pad(dLoc.getMonth()+1)}-${pad(dLoc.getDate())} ${pad(dLoc.getHours())}:${pad(dLoc.getMinutes())}:${pad(dLoc.getSeconds())}`;

        const initialStatus = status || 'pending';
        const paidAmount = initialStatus === 'completed' ? amount : 0;

        const info = db.prepare(`
            INSERT INTO transactions (type, category_id, description, amount, paid_amount, status, due_date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(type, category_id || null, description, amount, paidAmount, initialStatus, due_date, notes || '', created_at || localTime);

        res.json({ success: true, message: 'Transação sincronizada.', data: { id: info.lastInsertRowid } });
    } catch (error) {
        console.error('Sync push-transaction error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar transação.' });
    }
});

/**
 * POST /api/sync/push-transaction-payment
 * Recebe um pagamento parcial ou total feito offline
 */
router.post('/push-transaction-payment', (req, res) => {
    try {
        const db = getDatabase();
        const { transaction_id, amount, payment_method, payment_date } = req.body;

        if (!transaction_id || !amount) {
            return res.status(400).json({ success: false, message: 'Dados incompletos.' });
        }

        const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(transaction_id);
        if (!tx) {
            // Pode ser uma transação que ainda não foi sincronizada ou não existe
            return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
        }

        const newPaidAmount = tx.paid_amount + amount;
        const newStatus = newPaidAmount >= tx.amount ? 'completed' : 'partial';

        db.transaction(() => {
            db.prepare(`
                INSERT INTO transaction_payments (transaction_id, amount, payment_method, payment_date)
                VALUES (?, ?, ?, ?)
            `).run(transaction_id, amount, payment_method || 'cash', payment_date);

            db.prepare(`
                UPDATE transactions 
                SET status = ?, paid_amount = ?, payment_date = ?, payment_method = ?
                WHERE id = ?
            `).run(newStatus, newPaidAmount, payment_date, payment_method || 'cash', transaction_id);
        })();

        res.json({ success: true, message: 'Pagamento sincronizado.' });
    } catch (error) {
        console.error('Sync push-transaction-payment error:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar pagamento.' });
    }
});

/**
 * POST /api/sync/push-cash-register
 */
router.post('/push-cash-register', (req, res) => {
    try {
        const db = getDatabase();
        const data = req.body;
        
        let existing = null;
        if (data.uuid) existing = db.prepare("SELECT id, status FROM cash_register WHERE uuid = ?").get(data.uuid);
        if (!existing && data.id) existing = db.prepare("SELECT id, status FROM cash_register WHERE id = ?").get(data.id);
        if (!existing && data.status === 'closed') {
            // Se ainda não achou, talvez esteja tentando fechar um caixa que abriu online, podemos pegar o último aberto
            existing = db.prepare("SELECT id, status FROM cash_register WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
        }

        if (existing) {
            if (data.status === 'closed' && existing.status === 'open') {
                db.prepare(`
                    UPDATE cash_register 
                    SET status = 'closed', closed_at = ?, closing_balance = ?, notes = ?
                    WHERE id = ?
                `).run(data.closed_at, data.closing_balance, data.closing_notes, existing.id);
                db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'close_register', 'cash_register', ?, 'Caixa Fechado (Offline)')").run(req.session.userId, existing.id);
                return res.json({ success: true, message: 'Caixa fechado sincronizado.' });
            }
            return res.json({ success: true, message: 'Caixa já sincronizado.' });
        }
        
        const crInfo = db.prepare(`
            INSERT INTO cash_register (user_id, opening_balance, status, opened_at, uuid)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.session.userId, data.opening_balance, data.status, data.opened_at, data.uuid);
        
        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'open_register', 'cash_register', ?, 'Caixa Aberto (Offline)')").run(req.session.userId, crInfo.lastInsertRowid);

        if (data.status === 'closed' && data.closed_at) {
            db.prepare(`
                UPDATE cash_register 
                SET closed_at = ?, closing_balance = ?, notes = ?
                WHERE id = ?
            `).run(data.closed_at, data.closing_balance, data.closing_notes, crInfo.lastInsertRowid);
            db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'close_register', 'cash_register', ?, 'Caixa Fechado (Offline)')").run(req.session.userId, crInfo.lastInsertRowid);
        }

        res.json({ success: true, message: 'Registro de caixa sincronizado.' });
    } catch (e) {
        console.error('Push cash register error:', e);
        res.status(500).json({ success: false, message: 'Erro ao processar caixa offline.' });
    }
});

/**
 * POST /api/sync/push-cash-movement
 */
router.post('/push-cash-movement', (req, res) => {
    try {
        const db = getDatabase();
        const data = req.body;
        if (!data.uuid) return res.status(400).json({ success: false, message: 'Dados incompletos' });
        
        const existing = db.prepare("SELECT id FROM cash_movements WHERE uuid = ?").get(data.uuid);
        if (existing) return res.json({ success: true, message: 'Movimento já sincronizado.' });

        let realCashRegisterId = null;
        if (data.cash_register_uuid) {
            const cr = db.prepare("SELECT id FROM cash_register WHERE uuid = ?").get(data.cash_register_uuid);
            if (cr) realCashRegisterId = cr.id;
        } else if (data.cash_register_id && typeof data.cash_register_id === 'number' && data.cash_register_id > 0) {
            realCashRegisterId = data.cash_register_id;
        }

        const movInfo = db.prepare(`
            INSERT INTO cash_movements (cash_register_id, user_id, type, amount, reason, uuid, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(realCashRegisterId, req.session.userId, data.type, data.amount, data.reason, data.uuid, data.created_at);
        
        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, ?, 'cash_movements', ?, ?)")
            .run(req.session.userId, data.type, movInfo.lastInsertRowid, `${data.type === 'withdraw' ? 'Sangria' : 'Suprimento'} (Offline) - R$ ${parseFloat(data.amount).toFixed(2).replace('.',',')}`);
        
        res.json({ success: true, message: 'Movimento de caixa sincronizado.' });
    } catch (e) {
        console.error('Push cash movement error:', e);
        res.status(500).json({ success: false, message: 'Erro ao processar movimento offline.' });
    }
});

/**
 * GET /api/sync/pull-all
 * Retorna TODOS os dados do servidor para popular o IndexedDB local
 */
router.get('/pull-all', (req, res) => {
    try {
        const db = getDatabase();

        const products = db.prepare("SELECT * FROM products").all();
        const categories = db.prepare("SELECT * FROM categories").all();
        const customers = db.prepare("SELECT * FROM customers").all();
        const suppliers = db.prepare("SELECT * FROM suppliers").all();
        const sales = db.prepare("SELECT s.*, u.full_name as user_name FROM sales s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 500").all();
        const sale_items = db.prepare("SELECT si.*, p.name as product_name FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id IN (SELECT id FROM sales ORDER BY created_at DESC LIMIT 500)").all();
        const payments = db.prepare("SELECT * FROM payments WHERE sale_id IN (SELECT id FROM sales ORDER BY created_at DESC LIMIT 500)").all();
        const transaction_categories = db.prepare("SELECT * FROM transaction_categories").all();
        const transactions = db.prepare(`
            SELECT t.*, c.name as category_name, c.color as category_color 
            FROM transactions t
            LEFT JOIN transaction_categories c ON t.category_id = c.id
            ORDER BY t.due_date DESC LIMIT 500
        `).all();
        
        let transaction_payments = [];
        if (transactions.length > 0) {
            const txIds = transactions.map(t => t.id).join(',');
            transaction_payments = db.prepare(`SELECT * FROM transaction_payments WHERE transaction_id IN (${txIds})`).all();
        }

        const stock_movements = db.prepare("SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 500").all();
        const cash_registers = db.prepare("SELECT * FROM cash_register ORDER BY opened_at DESC LIMIT 50").all();
        const cash_movements = db.prepare("SELECT * FROM cash_movements ORDER BY created_at DESC LIMIT 500").all();
        const bank_accounts = db.prepare("SELECT * FROM bank_accounts").all();

        // Settings
        const settingsRows = db.prepare("SELECT key, value FROM app_settings").all();
        const settings = {};
        settingsRows.forEach(r => { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } });

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

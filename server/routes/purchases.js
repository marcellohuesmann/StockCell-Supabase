const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/purchases
 * Listar pedidos de compra
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const purchases = db.prepare(`
            SELECT p.*, s.company_name as supplier_name 
            FROM purchase_orders p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `).all();

        const itemsStmt = db.prepare(`
            SELECT pi.*, pr.name as product_name
            FROM purchase_items pi
            JOIN products pr ON pi.product_id = pr.id
            WHERE pi.purchase_id = ?
        `);

        purchases.forEach(p => {
            p.items = itemsStmt.all(p.id);
        });

        res.json({ success: true, data: purchases });
    } catch (error) {
        console.error('Erro ao listar pedidos de compra:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar pedidos de compra.' });
    }
});

/**
 * POST /api/purchases
 * Criar um novo pedido de compra
 */
router.post('/', (req, res) => {
    try {
        const { supplier_id, expected_date, notes, items } = req.body;
        
        if (!supplier_id || !items || !items.length) {
            return res.status(400).json({ success: false, message: 'Fornecedor e itens são obrigatórios.' });
        }

        const db = getDatabase();
        
        let purchaseId;
        db.transaction(() => {
            const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.unit_cost) * parseInt(item.quantity)), 0);

            const result = db.prepare(`
                INSERT INTO purchase_orders (supplier_id, user_id, status, total_amount, expected_date, notes)
                VALUES (?, ?, 'pending', ?, ?, ?)
            `).run(supplier_id, req.session.userId, totalAmount, expected_date || null, notes || '');

            purchaseId = result.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total_cost)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                const q = parseInt(item.quantity);
                const c = parseFloat(item.unit_cost);
                insertItem.run(purchaseId, item.product_id, q, c, q * c);
            }

            db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'create', 'purchase', ?, ?)")
                .run(req.session.userId, purchaseId, `Pedido de Compra #${String(purchaseId).padStart(4,'0')} criado`);
        })();

        res.status(201).json({ success: true, message: 'Pedido de compra criado com sucesso!', data: { id: purchaseId } });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar pedido de compra.' });
    }
});

/**
 * PUT /api/purchases/:id/receive
 * Receber o pedido de compra (Atualiza estoque e gera Contas a Pagar)
 */
router.put('/:id/receive', (req, res) => {
    try {
        const { generate_payable, account_id, due_date } = req.body;
        const purchaseId = req.params.id;
        const db = getDatabase();

        const purchase = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(purchaseId);
        if (!purchase) return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        if (purchase.status !== 'pending') return res.status(400).json({ success: false, message: 'Pedido já recebido ou cancelado.' });

        const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);

        db.transaction(() => {
            // 1. Atualizar Status
            db.prepare(`UPDATE purchase_orders SET status = 'received', received_date = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?`).run(purchaseId);

            // 2. Atualizar Estoque
            const updateStock = db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
            const insertMovement = db.prepare('INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id) VALUES (?,?,\'entry\',?,?,?,?)');
            const updateCost = db.prepare('UPDATE products SET cost_price = ? WHERE id = ? AND cost_price != ?');

            for (const item of items) {
                updateStock.run(item.quantity, item.product_id);
                // Opcional: Atualizar preço de custo médio (aqui atualizando pro último custo)
                updateCost.run(item.unit_cost, item.product_id, item.unit_cost);

                const newBalance = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id).current_stock;
                insertMovement.run(item.product_id, req.session.userId, item.quantity, newBalance, `Recebimento Pedido #${String(purchaseId).padStart(4,'0')}`, purchaseId);
            }

            // 3. Gerar Contas a Pagar (Opcional)
            if (generate_payable) {
                const supplier = db.prepare('SELECT company_name FROM suppliers WHERE id = ?').get(purchase.supplier_id);
                const desc = `Compra: ${supplier ? supplier.company_name : 'Fornecedor'} (Pedido #${String(purchaseId).padStart(4,'0')})`;
                
                // Get general expenses category if exists
                const cat = db.prepare("SELECT id FROM transaction_categories WHERE type = 'expense' LIMIT 1").get();
                
                db.prepare(`
                    INSERT INTO transactions (type, category_id, description, amount, status, due_date, reference_id, reference_type)
                    VALUES ('expense', ?, ?, ?, 'pending', ?, ?, 'purchase')
                `).run(cat ? cat.id : null, desc, purchase.total_amount, due_date || new Date().toISOString().split('T')[0], purchaseId);
            }

            db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'receive', 'purchase', ?, ?)")
                .run(req.session.userId, purchaseId, `Pedido de Compra #${String(purchaseId).padStart(4,'0')} recebido no estoque`);
        })();

        res.json({ success: true, message: 'Pedido recebido com sucesso. Estoque atualizado!' });
    } catch (error) {
        console.error('Erro ao receber pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao receber pedido de compra.' });
    }
});

/**
 * DELETE /api/purchases/:id
 * Cancelar um pedido de compra pendente
 */
router.delete('/:id', (req, res) => {
    try {
        const purchaseId = req.params.id;
        const db = getDatabase();

        const purchase = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(purchaseId);
        if (!purchase) return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        if (purchase.status === 'received') return res.status(400).json({ success: false, message: 'Não é possível cancelar um pedido já recebido.' });

        db.prepare(`UPDATE purchase_orders SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE id = ?`).run(purchaseId);

        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'cancel', 'purchase', ?, ?)")
            .run(req.session.userId, purchaseId, `Pedido de Compra #${String(purchaseId).padStart(4,'0')} cancelado`);

        res.json({ success: true, message: 'Pedido cancelado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cancelar pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao cancelar pedido de compra.' });
    }
});

module.exports = router;

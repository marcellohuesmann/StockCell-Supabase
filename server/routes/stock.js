const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/stock/movements
 */
router.get('/movements', (req, res) => {
    try {
        const db = getDatabase();
        const { product_id, type, limit = 50 } = req.query;
        let query = `SELECT sm.*, p.name as product_name, p.barcode, u.full_name as user_name
                      FROM stock_movements sm
                      JOIN products p ON sm.product_id = p.id
                      LEFT JOIN users u ON sm.user_id = u.id`;
        const conditions = []; const params = [];
        if (product_id) { conditions.push('sm.product_id = ?'); params.push(product_id); }
        if (type) { conditions.push('sm.type = ?'); params.push(type); }
        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY sm.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        res.json({ success: true, data: db.prepare(query).all(...params) });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar movimentações.' }); }
});

/**
 * POST /api/stock/entry - Entrada de mercadoria
 */
router.post('/entry', (req, res) => {
    try {
        const db = getDatabase();
        const { items, supplier_id, notes } = req.body;
        if (!items || !items.length) return res.status(400).json({ success: false, message: 'Adicione pelo menos um item.' });

        const processEntry = db.transaction(() => {
            let total = 0;
            // Cria pedido de compra se tiver fornecedor
            let poId = null;
            if (supplier_id) {
                const poResult = db.prepare("INSERT INTO purchase_orders (supplier_id, user_id, total, status, notes) VALUES (?,?,0,'received',?)").run(supplier_id, req.session.userId, notes || '');
                poId = poResult.lastInsertRowid;
            }

            for (const item of items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                if (!product) continue;
                const qty = parseInt(item.quantity);
                const cost = parseFloat(item.unit_cost) || product.cost_price;

                // Atualiza estoque e preço de custo
                db.prepare('UPDATE products SET current_stock = current_stock + ?, cost_price = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
                    .run(qty, cost, item.product_id);

                const newBalance = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id).current_stock;

                // Registra movimentação
                db.prepare("INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id) VALUES (?,?,'entry',?,?,?,?)")
                    .run(item.product_id, req.session.userId, qty, newBalance, notes || 'Entrada de mercadoria', poId);

                // Insere item do pedido de compra
                if (poId) {
                    const itemTotal = qty * cost;
                    total += itemTotal;
                    db.prepare('INSERT INTO purchase_items (purchase_order_id, product_id, quantity, unit_cost, total) VALUES (?,?,?,?,?)').run(poId, item.product_id, qty, cost, itemTotal);
                }
            }

            if (poId) {
                db.prepare('UPDATE purchase_orders SET total = ? WHERE id = ?').run(total, poId);
            }

            db.prepare("INSERT INTO activity_log (user_id, action, entity, description) VALUES (?,'stock_entry','stock',?)")
                .run(req.session.userId, `Entrada de ${items.length} produto(s)`);
        });

        processEntry();
        res.json({ success: true, message: 'Entrada de mercadoria registrada com sucesso!' });
    } catch (error) {
        console.error('Erro na entrada de mercadoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar entrada.' });
    }
});

/**
 * POST /api/stock/adjustment - Ajuste manual de estoque
 */
router.post('/adjustment', (req, res) => {
    try {
        const db = getDatabase();
        const { product_id, new_quantity, reason } = req.body;
        if (!product_id) return res.status(400).json({ success: false, message: 'Produto é obrigatório.' });
        if (new_quantity == null || new_quantity < 0) return res.status(400).json({ success: false, message: 'Quantidade inválida.' });
        if (!reason) return res.status(400).json({ success: false, message: 'Justificativa é obrigatória.' });

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        const diff = new_quantity - product.current_stock;
        db.prepare('UPDATE products SET current_stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(new_quantity, product_id);
        db.prepare("INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason) VALUES (?,?,'adjustment',?,?,?)")
            .run(product_id, req.session.userId, diff, new_quantity, `Ajuste: ${reason}`);
        db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?,'stock_adjust','product',?,?)")
            .run(req.session.userId, product_id, `Ajuste de estoque: ${product.name} (${product.current_stock} → ${new_quantity})`);

        res.json({ success: true, message: `Estoque ajustado: ${product.current_stock} → ${new_quantity}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao ajustar estoque.' });
    }
});

/**
 * GET /api/stock/low - Produtos com estoque baixo
 */
router.get('/low', (req, res) => {
    try {
        const db = getDatabase();
        const products = db.prepare("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1 AND p.is_service = 0 AND p.current_stock <= p.min_stock ORDER BY p.current_stock ASC").all();
        res.json({ success: true, data: products });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao buscar estoque baixo.' }); }
});

module.exports = router;

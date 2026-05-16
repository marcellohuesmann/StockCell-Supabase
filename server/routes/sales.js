const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/sales
 * Registra uma nova venda completa (itens + pagamentos + atualiza estoque)
 */
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { items, payments, customer_id, discount_amount, notes, cash_received, cash_change } = req.body;

        if (!items || !items.length) return res.status(400).json({ success: false, message: 'Adicione pelo menos um item.' });
        if (!payments || !payments.length) return res.status(400).json({ success: false, message: 'Informe a forma de pagamento.' });

        // Calcula totais
        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const product = db.prepare('SELECT id, name, sale_price, current_stock, track_serial FROM products WHERE id = ? AND active = 1').get(item.product_id);
            if (!product) return res.status(400).json({ success: false, message: `Produto ID ${item.product_id} não encontrado.` });
            
            if (product.track_serial && !item.serial_number) {
                return res.status(400).json({ success: false, message: `O produto "${product.name}" exige que um Número de Série/IMEI seja informado.` });
            }

            if (product.track_serial && item.serial_number) {
                const serialCheck = db.prepare('SELECT status FROM product_serials WHERE product_id = ? AND serial_number = ?').get(item.product_id, item.serial_number);
                if (!serialCheck) return res.status(400).json({ success: false, message: `O IMEI ${item.serial_number} não pertence ao produto "${product.name}".` });
                if (serialCheck.status !== 'available') return res.status(400).json({ success: false, message: `O IMEI ${item.serial_number} já consta como vendido ou indisponível.` });
            }

            if (product.current_stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Estoque insuficiente para "${product.name}". Disponível: ${product.current_stock}` });
            }
            const itemTotal = (item.unit_price || product.sale_price) * item.quantity - (item.discount || 0);
            subtotal += itemTotal;
            processedItems.push({ ...item, unit_price: item.unit_price || product.sale_price, total: itemTotal, product_name: product.name });
        }

        const disc = discount_amount || 0;
        const total = subtotal - disc;

        // Valida pagamentos
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaid - total) > 0.01) {
            return res.status(400).json({ success: false, message: `Valor do pagamento (R$ ${totalPaid.toFixed(2)}) difere do total (R$ ${total.toFixed(2)}).` });
        }

        // Transaction
        const createSale = db.transaction(() => {
            // 1. Cria a venda
            const saleResult = db.prepare(`
                INSERT INTO sales (user_id, customer_id, subtotal, discount_amount, total, status, notes, cash_received, cash_change)
                VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?)
            `).run(req.session.userId, customer_id || null, subtotal, disc, total, notes || '', cash_received || 0, cash_change || 0);

            const saleId = saleResult.lastInsertRowid;

            // 2. Insere itens
            const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total) VALUES (?,?,?,?,?,?)');
            const updateStock = db.prepare('UPDATE products SET current_stock = current_stock - ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?');
            const insertMovement = db.prepare('INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id) VALUES (?,?,\'exit\',?,?,?,?)');

            for (const item of processedItems) {
                insertItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.discount || 0, item.total);
                updateStock.run(item.quantity, item.product_id);
                const newBalance = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id).current_stock;
                
                let reason = `Venda #${String(saleId).padStart(4,'0')}`;
                if (item.serial_number) {
                    reason += ` - IMEI: ${item.serial_number}`;
                    db.prepare('UPDATE product_serials SET status = \'sold\' WHERE product_id = ? AND serial_number = ?').run(item.product_id, item.serial_number);
                }

                insertMovement.run(item.product_id, req.session.userId, -item.quantity, newBalance, reason, saleId);
            }

            // 3. Insere pagamentos e transações de crédito
            const insertPayment = db.prepare('INSERT INTO payments (sale_id, method, amount, reference) VALUES (?,?,?,?)');
            const insertTransaction = db.prepare(`
                INSERT INTO transactions (type, description, amount, status, due_date, reference_id, reference_type) 
                VALUES ('income', ?, ?, 'pending', ?, ?, 'sale')
            `);

            for (const payment of payments) {
                insertPayment.run(saleId, payment.method, payment.amount, payment.reference || '');
                if (payment.method === 'store_credit') {
                    const installments = parseInt(payment.installments) || 1;
                    const interval = parseInt(payment.interval_days) || 30;
                    const baseAmount = payment.amount / installments;
                    
                    const dLoc = new Date();
                    let baseDateObj = new Date(payment.due_date ? payment.due_date + 'T12:00:00' : dLoc);

                    const customerName = customer_id ? db.prepare('SELECT name FROM customers WHERE id = ?').get(customer_id)?.name || 'Cliente' : 'Cliente';
                    
                    for (let i = 0; i < installments; i++) {
                        const targetDate = new Date(baseDateObj);
                        targetDate.setDate(targetDate.getDate() + (i * interval));
                        
                        const dueDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
                        
                        let desc = `Fiado: ${customerName} (Venda #${String(saleId).padStart(4,'0')})`;
                        if (installments > 1) {
                            desc += ` - Parcela ${i+1}/${installments}`;
                        }
                        insertTransaction.run(desc, baseAmount, dueDate, saleId);
                    }
                }
            }

            // 4. Log
            db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'sale', 'sale', ?, ?)")
                .run(req.session.userId, saleId, `Venda #${String(saleId).padStart(4,'0')} - ${Utils_formatCurrency(total)}`);

            return saleId;
        });

        const saleId = createSale();

        // Retorna venda completa
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        const saleItems = db.prepare(`
            SELECT si.*, p.name as product_name, p.barcode FROM sale_items si
            JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?
        `).all(saleId);
        const salePayments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(saleId);

        res.status(201).json({
            success: true,
            message: `Venda #${String(saleId).padStart(4,'0')} realizada com sucesso!`,
            data: { ...sale, items: saleItems, payments: salePayments },
        });
    } catch (error) {
        console.error('Erro ao registrar venda:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar venda.' });
    }
});

function Utils_formatCurrency(v) { return `R$ ${v.toFixed(2).replace('.',',')}` }

/**
 * GET /api/sales
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { date_from, date_to, status, limit = 50, page = 1 } = req.query;
        let query = 'SELECT s.*, u.full_name as user_name, c.name as customer_name FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN customers c ON s.customer_id = c.id';
        const conditions = []; const params = [];

        if (date_from) { conditions.push("s.created_at >= ?"); params.push(date_from); }
        if (date_to) { conditions.push("s.created_at <= ?"); params.push(date_to + ' 23:59:59'); }
        if (status) { conditions.push("s.status = ?"); params.push(status); }

        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY s.created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const sales = db.prepare(query).all(...params);
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao listar vendas.' });
    }
});

/**
 * GET /api/sales/:id
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const sale = db.prepare('SELECT s.*, u.full_name as user_name, c.name as customer_name FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?').get(req.params.id);
        if (!sale) return res.status(404).json({ success: false, message: 'Venda não encontrada.' });
        sale.items = db.prepare('SELECT si.*, p.name as product_name, p.barcode FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?').all(req.params.id);
        sale.payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(req.params.id);
        res.json({ success: true, data: sale });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar venda.' });
    }
});

/**
 * POST /api/sales/:id/cancel
 */
router.post('/:id/cancel', (req, res) => {
    try {
        const db = getDatabase();
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
        if (!sale) return res.status(404).json({ success: false, message: 'Venda não encontrada.' });
        if (sale.status === 'cancelled') return res.status(400).json({ success: false, message: 'Venda já cancelada.' });

        const cancelSale = db.transaction(() => {
            db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(req.params.id);
            const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
            for (const item of items) {
                db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(item.quantity, item.product_id);
                const newBal = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id).current_stock;
                db.prepare("INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id) VALUES (?,?,'entry',?,?,?,?)")
                    .run(item.product_id, req.session.userId, item.quantity, newBal, `Cancelamento Venda #${String(req.params.id).padStart(4,'0')}`, req.params.id);
            }
            // Delete associated pending receivable transaction, or mark as cancelled
            db.prepare("DELETE FROM transactions WHERE reference_type = 'sale' AND reference_id = ?").run(req.params.id);

            db.prepare("INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?,'cancel_sale','sale',?,?)")
                .run(req.session.userId, req.params.id, `Venda #${String(req.params.id).padStart(4,'0')} cancelada`);
        });
        cancelSale();
        res.json({ success: true, message: 'Venda cancelada. Estoque restaurado.' });
    } catch (error) {
        console.error('Erro ao cancelar venda:', error);
        res.status(500).json({ success: false, message: 'Erro ao cancelar venda.' });
    }
});

module.exports = router;

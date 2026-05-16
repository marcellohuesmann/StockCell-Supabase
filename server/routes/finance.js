const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../public/uploads/finance');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `tx_${req.params.id}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.use(requireAuth);

// Check permission middleware specifically for finance
const requireFinance = (req, res, next) => {
    try {
        const db = getDatabase();
        const role = req.session.role;
        if (role === 'admin') return next();
        
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'permissions'").get();
        if (row) {
            const permissions = JSON.parse(row.value);
            if (permissions.finance_manage && permissions.finance_manage.operator) {
                return next();
            }
        }
        res.status(403).json({ success: false, message: 'Acesso negado ao m\u00f3dulo financeiro.' });
    } catch (e) {
        res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
};

router.use(requireFinance);

/**
 * GET /api/finance/categories
 * List financial categories
 */
router.get('/categories', (req, res) => {
    try {
        const db = getDatabase();
        const categories = db.prepare("SELECT * FROM transaction_categories ORDER BY type, name").all();
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar categorias.' });
    }
});

/**
 * POST /api/finance/categories
 * Create new category
 */
router.post('/categories', (req, res) => {
    try {
        const { name, type, color } = req.body;
        if (!name || !type) return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });

        const db = getDatabase();
        const info = db.prepare(`
            INSERT INTO transaction_categories (name, type, color) 
            VALUES (?, ?, ?)
        `).run(name, type, color || '#808080');

        res.status(201).json({ success: true, message: 'Categoria criada.', data: { id: info.lastInsertRowid } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar categoria.' });
    }
});

/**
 * PUT /api/finance/categories/:id
 */
router.put('/categories/:id', (req, res) => {
    try {
        const { name, type, color } = req.body;
        const db = getDatabase();
        db.prepare("UPDATE transaction_categories SET name = ?, type = ?, color = ? WHERE id = ?").run(name, type, color, req.params.id);
        res.json({ success: true, message: 'Categoria atualizada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar categoria.' });
    }
});

/**
 * DELETE /api/finance/categories/:id
 */
router.delete('/categories/:id', (req, res) => {
    try {
        const db = getDatabase();
        // Verifica se está em uso
        const inUse = db.prepare("SELECT id FROM transactions WHERE category_id = ? LIMIT 1").get(req.params.id);
        if (inUse) return res.status(400).json({ success: false, message: 'Esta categoria está em uso e não pode ser excluída.' });
        
        db.prepare("DELETE FROM transaction_categories WHERE id = ?").run(req.params.id);
        res.json({ success: true, message: 'Categoria excluída.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao excluir categoria.' });
    }
});

/**
 * GET /api/finance/transactions
 * List transactions with filters (month, status, type)
 */
router.get('/transactions', (req, res) => {
    try {
        const db = getDatabase();
        let query = `
            SELECT t.*, c.name as category_name, c.color as category_color 
            FROM transactions t
            LEFT JOIN transaction_categories c ON t.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (req.query.type) {
            query += " AND t.type = ?";
            params.push(req.query.type);
        }
        if (req.query.status) {
            query += " AND t.status = ?";
            params.push(req.query.status);
        }
        if (req.query.month) {
            query += " AND strftime('%Y-%m', t.due_date) = ?";
            params.push(req.query.month);
        }

        query += " ORDER BY t.due_date DESC, t.created_at DESC";
        const transactions = db.prepare(query).all(...params);

        if (transactions.length > 0) {
            const txIds = transactions.map(t => t.id).join(',');
            const payments = db.prepare(`SELECT * FROM transaction_payments WHERE transaction_id IN (${txIds}) ORDER BY payment_date ASC`).all();
            transactions.forEach(t => {
                t.payments = payments.filter(p => p.transaction_id === t.id);
            });
        }

        res.json({ success: true, data: transactions });
    } catch (error) {
        console.error('Erro ao listar transacoes:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar transa\u00e7\u00f5es.' });
    }
});

/**
 * GET /api/finance/summary
 * Get financial summary for a month
 */
router.get('/summary', (req, res) => {
    try {
        const db = getDatabase();
        const d = new Date();
        const localMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const month = req.query.month || localMonth;
        
        const summary = db.prepare(`
            SELECT 
                SUM(CASE WHEN type = 'income' THEN paid_amount ELSE 0 END) as total_received,
                SUM(CASE WHEN type = 'income' AND status != 'completed' THEN amount - paid_amount ELSE 0 END) as total_to_receive,
                SUM(CASE WHEN type = 'expense' THEN paid_amount ELSE 0 END) as total_paid,
                SUM(CASE WHEN type = 'expense' AND status != 'completed' THEN amount - paid_amount ELSE 0 END) as total_to_pay
            FROM transactions 
            WHERE strftime('%Y-%m', due_date) = ?
        `).get(month);

        res.json({ success: true, data: summary });
    } catch (error) {
        console.error('Erro no resumo financeiro:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar resumo.' });
    }
});

// POST /api/finance/transactions
router.post('/transactions', (req, res) => {
    try {
        const { type, description, amount, status, due_date, notes, category_id, account_id, barcode } = req.body;
        const parsedAmount = parseFloat(amount);
        if (!type || !description || isNaN(parsedAmount) || parsedAmount <= 0 || !due_date) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios corretamente (Valor deve ser maior que 0).' });
        }

        const initialStatus = status || 'pending';
        const paidAmount = initialStatus === 'completed' ? parsedAmount : 0;

        const db = getDatabase();
        
        let txId = null;
        db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO transactions (type, category_id, description, amount, paid_amount, status, due_date, notes, barcode) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(type, category_id || null, description, parsedAmount, paidAmount, initialStatus, due_date, notes || '', barcode || null);
            txId = info.lastInsertRowid;

            if (initialStatus === 'completed' && account_id) {
                const payDate = new Date().toISOString().substring(0, 10);
                db.prepare(`
                    INSERT INTO transaction_payments (transaction_id, account_id, amount, payment_method, payment_date)
                    VALUES (?, ?, ?, ?, ?)
                `).run(txId, account_id, parsedAmount, 'cash', payDate);

                const op = type === 'income' ? '+' : '-';
                db.prepare(`UPDATE bank_accounts SET current_balance = current_balance ${op} ? WHERE id = ?`).run(parsedAmount, account_id);
            }
        })();

        res.status(201).json({ success: true, message: 'Transação registrada.', data: { id: txId } });
    } catch (error) {
        console.error('Erro ao criar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar transação.' });
    }
});

/**
 * PUT /api/finance/transactions/:id/pay
 * Mark transaction as completed (paid/received) or partially paid
 */
router.put('/transactions/:id/pay', (req, res) => {
    try {
        const { payment_method, payment_date, amount, account_id } = req.body;
        const db = getDatabase();
        const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
        
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
        
        const dLoc = new Date();
        const localDate = `${dLoc.getFullYear()}-${String(dLoc.getMonth()+1).padStart(2,'0')}-${String(dLoc.getDate()).padStart(2,'0')}`;
        const payDate = payment_date || localDate;
        
        const remaining = tx.amount - tx.paid_amount;
        const payAmount = amount ? parseFloat(amount) : remaining;

        if (payAmount <= 0) return res.status(400).json({ success: false, message: 'Valor inválido.' });
        if (payAmount > remaining) return res.status(400).json({ success: false, message: 'O valor pago excede o saldo devedor.' });

        const newPaidAmount = tx.paid_amount + payAmount;
        const newStatus = newPaidAmount >= tx.amount ? 'completed' : 'partial';

        db.transaction(() => {
            // Insere no histórico de pagamentos
            db.prepare(`
                INSERT INTO transaction_payments (transaction_id, account_id, amount, payment_method, payment_date)
                VALUES (?, ?, ?, ?, ?)
            `).run(tx.id, account_id || null, payAmount, payment_method || 'cash', payDate);

            // Atualiza a transação
            db.prepare(`
                UPDATE transactions 
                SET status = ?, paid_amount = ?, payment_date = ?, payment_method = ?
                WHERE id = ?
            `).run(newStatus, newPaidAmount, payDate, payment_method || 'cash', tx.id);

            // Atualiza o saldo da conta
            if (account_id) {
                const op = tx.type === 'income' ? '+' : '-';
                db.prepare(`UPDATE bank_accounts SET current_balance = current_balance ${op} ? WHERE id = ?`).run(payAmount, account_id);
            }
        })();

        res.json({ success: true, message: tx.type === 'income' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
    } catch (error) {
        console.error('Erro ao baixar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar transa\u00e7\u00e3o.' });
    }
});

/**
 * PUT /api/finance/transactions/:id
 * Update transaction details
 */
router.put('/transactions/:id', (req, res) => {
    try {
        const { description, category_id, due_date, notes, barcode } = req.body;
        const db = getDatabase();
        const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
        
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
        
        db.prepare(`
            UPDATE transactions 
            SET description = ?, category_id = ?, due_date = ?, notes = ?, barcode = ?, updated_at = datetime('now','localtime')
            WHERE id = ?
        `).run(description || tx.description, category_id || tx.category_id, due_date || tx.due_date, notes !== undefined ? notes : tx.notes, barcode !== undefined ? barcode : tx.barcode, tx.id);

        res.json({ success: true, message: 'Transação atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao editar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao editar transação.' });
    }
});

/**
 * POST /api/finance/transactions/:id/upload
 * Upload an attachment
 */
router.post('/transactions/:id/upload', upload.single('attachment'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });

        const db = getDatabase();
        const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });

        const relativePath = '/uploads/finance/' + req.file.filename;

        // Apagar o anexo anterior se existir
        if (tx.attachment_path) {
            const oldPath = path.join(__dirname, '../../public', tx.attachment_path);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        db.prepare("UPDATE transactions SET attachment_path = ? WHERE id = ?").run(relativePath, tx.id);

        res.json({ success: true, message: 'Anexo salvo com sucesso!', attachment_path: relativePath });
    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar anexo.' });
    }
});

/**
 * DELETE /api/finance/transactions/:id
 * Delete a transaction
 */
router.delete('/transactions/:id', (req, res) => {
    try {
        const db = getDatabase();
        
        db.transaction(() => {
            const tx = db.prepare("SELECT type FROM transactions WHERE id = ?").get(req.params.id);
            if (tx) {
                // Reverter saldos das contas bancárias
                const payments = db.prepare("SELECT account_id, amount FROM transaction_payments WHERE transaction_id = ?").all(req.params.id);
                for (const p of payments) {
                    if (p.account_id) {
                        const op = tx.type === 'income' ? '-' : '+';
                        db.prepare(`UPDATE bank_accounts SET current_balance = current_balance ${op} ? WHERE id = ?`).run(p.amount, p.account_id);
                    }
                }
            }
            db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
        })();

        res.json({ success: true, message: 'Excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir conta bancária.' });
    }
});

// =============================================
// TRANSAÇÕES RECORRENTES (API)
// =============================================

/**
 * GET /api/finance/recurring
 * List recurring transactions
 */
router.get('/recurring', (req, res) => {
    try {
        const db = getDatabase();
        const recurring = db.prepare(`
            SELECT r.*, c.name as category_name, c.color as category_color, a.name as account_name
            FROM recurring_transactions r
            LEFT JOIN transaction_categories c ON r.category_id = c.id
            LEFT JOIN bank_accounts a ON r.account_id = a.id
            ORDER BY r.day_of_month ASC
        `).all();
        res.json({ success: true, data: recurring });
    } catch (error) {
        console.error('Erro ao listar recorrências:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar recorrências.' });
    }
});

/**
 * POST /api/finance/recurring
 * Create new recurring transaction
 */
router.post('/recurring', (req, res) => {
    try {
        const { type, category_id, account_id, description, amount, day_of_month, notes } = req.body;
        
        if (!type || !description || !amount || !day_of_month) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios.' });
        }

        const db = getDatabase();
        const info = db.prepare(`
            INSERT INTO recurring_transactions (type, category_id, account_id, description, amount, day_of_month, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(
            type, 
            category_id || null, 
            account_id || null, 
            description.trim(), 
            amount, 
            day_of_month, 
            notes ? notes.trim() : ''
        );

        res.status(201).json({ success: true, message: 'Transação recorrente criada!', data: { id: info.lastInsertRowid } });
    } catch (error) {
        console.error('Erro ao criar recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar transação recorrente.' });
    }
});

/**
 * PUT /api/finance/recurring/:id
 * Update recurring transaction
 */
router.put('/recurring/:id', (req, res) => {
    try {
        const { type, category_id, account_id, description, amount, day_of_month, notes, status } = req.body;
        const db = getDatabase();
        
        const existing = db.prepare('SELECT id FROM recurring_transactions WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Recorrência não encontrada.' });

        db.prepare(`
            UPDATE recurring_transactions 
            SET type = ?, category_id = ?, account_id = ?, description = ?, amount = ?, day_of_month = ?, notes = ?, status = ?, updated_at = datetime('now','localtime')
            WHERE id = ?
        `).run(
            type, 
            category_id || null, 
            account_id || null, 
            description.trim(), 
            amount, 
            day_of_month, 
            notes ? notes.trim() : '', 
            status || 'active',
            req.params.id
        );

        res.json({ success: true, message: 'Recorrência atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar recorrência.' });
    }
});

/**
 * DELETE /api/finance/recurring/:id
 * Delete recurring transaction
 */
router.delete('/recurring/:id', (req, res) => {
    try {
        const db = getDatabase();
        const existing = db.prepare('SELECT id FROM recurring_transactions WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Recorrência não encontrada.' });

        db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Recorrência excluída.' });
    } catch (error) {
        console.error('Erro ao excluir recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir recorrência.' });
    }
});

module.exports = router;

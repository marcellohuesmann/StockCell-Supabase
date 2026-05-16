const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

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
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    } catch (error) {
        next(error);
    }
};

router.use(requireFinance);

// GET /api/accounts
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const accounts = db.prepare(`SELECT * FROM bank_accounts ORDER BY name ASC`).all();
        res.json({ success: true, data: accounts });
    } catch (e) {
        console.error('Erro ao buscar contas:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// POST /api/accounts
router.post('/', (req, res) => {
    try {
        const { name, type, initial_balance, color } = req.body;
        if (!name || !type) {
            return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });
        }
        const db = getDatabase();
        const initBal = initial_balance ? parseFloat(initial_balance) : 0;
        
        const stmt = db.prepare(`
            INSERT INTO bank_accounts (name, type, initial_balance, current_balance, color) 
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(name, type, initBal, initBal, color || '#808080');
        
        res.json({ success: true, message: 'Conta bancária criada com sucesso.', id: result.lastInsertRowid });
    } catch (e) {
        console.error('Erro ao criar conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// PUT /api/accounts/:id
router.put('/:id', (req, res) => {
    try {
        const { name, type, color } = req.body;
        if (!name || !type) {
            return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });
        }
        const db = getDatabase();
        const stmt = db.prepare(`
            UPDATE bank_accounts 
            SET name = ?, type = ?, color = ?
            WHERE id = ?
        `);
        const result = stmt.run(name, type, color || '#808080', req.params.id);
        
        if (result.changes === 0) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        
        res.json({ success: true, message: 'Conta atualizada com sucesso.' });
    } catch (e) {
        console.error('Erro ao atualizar conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        
        // Verifica se a conta está sendo usada
        const check = db.prepare("SELECT COUNT(*) as count FROM transaction_payments WHERE account_id = ?").get(req.params.id);
        if (check.count > 0) {
            return res.status(400).json({ success: false, message: 'Não é possível excluir uma conta que possui transações vinculadas.' });
        }
        
        const result = db.prepare("DELETE FROM bank_accounts WHERE id = ?").run(req.params.id);
        if (result.changes === 0) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        
        res.json({ success: true, message: 'Conta excluída com sucesso.' });
    } catch (e) {
        console.error('Erro ao excluir conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

module.exports = router;

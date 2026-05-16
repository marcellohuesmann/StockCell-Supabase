const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase } = require('../database/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

/** GET /api/users */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const users = db.prepare("SELECT id, username, full_name, role, active, created_at FROM users ORDER BY full_name ASC").all();
        // Conta vendas por usuário
        const countStmt = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM sales WHERE user_id = ? AND status = 'completed'");
        users.forEach(u => { const s = countStmt.get(u.id); u.sales_count = s.count; u.sales_total = s.total; });
        res.json({ success: true, data: users });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar usuários.' }); }
});

/** POST /api/users */
router.post('/', async (req, res) => {
    try {
        const db = getDatabase();
        const { username, full_name, password, role } = req.body;
        if (!username || !full_name || !password) return res.status(400).json({ success: false, message: 'Usuário, nome completo e senha são obrigatórios.' });
        if (password.length < 6) return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres.' });
        const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase().trim());
        if (dup) return res.status(400).json({ success: false, message: 'Nome de usuário já existe.' });
        const hash = await bcrypt.hash(password, 10);
        const r = db.prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?,?,?,?)').run(username.toLowerCase().trim(), full_name.trim(), hash, role || 'operator');
        const user = db.prepare("SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?").get(r.lastInsertRowid);
        db.prepare("INSERT INTO activity_log (user_id,action,entity,entity_id,description) VALUES (?,'create','user',?,?)").run(req.session.userId, user.id, `Usuário "${full_name}" criado`);
        res.status(201).json({ success: true, data: user, message: 'Usuário criado com sucesso!' });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erro ao criar usuário.' }); }
});

/** PUT /api/users/:id */
router.put('/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        const { full_name, role, active, password } = req.body;
        // Não permite desativar o último admin
        if (active === 0 && existing.role === 'admin') {
            const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get().c;
            if (adminCount <= 1) return res.status(400).json({ success: false, message: 'Não é possível desativar o último administrador.' });
        }
        db.prepare('UPDATE users SET full_name=COALESCE(?,full_name), role=COALESCE(?,role), active=COALESCE(?,active) WHERE id=?')
            .run(full_name?.trim(), role, active, req.params.id);
        if (password && password.length >= 6) {
            const hash = await bcrypt.hash(password, 10);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
        }
        const user = db.prepare("SELECT id, username, full_name, role, active, created_at FROM users WHERE id = ?").get(req.params.id);
        res.json({ success: true, data: user, message: 'Usuário atualizado!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao atualizar usuário.' }); }
});

/** DELETE /api/users/:id */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        if (parseInt(req.params.id) === req.session.userId) return res.status(400).json({ success: false, message: 'Você não pode excluir sua própria conta.' });
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        const sales = db.prepare('SELECT COUNT(*) as c FROM sales WHERE user_id = ?').get(req.params.id).c;
        if (sales > 0) { db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id); return res.json({ success: true, message: 'Usuário desativado (possui vendas vinculadas).' }); }
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Usuário excluído!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao excluir usuário.' }); }
});

module.exports = router;

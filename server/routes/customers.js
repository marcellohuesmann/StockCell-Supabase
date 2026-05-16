const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { search } = req.query;
        let query = 'SELECT * FROM customers';
        const params = [];
        if (search) {
            query += ' WHERE (name LIKE ? OR phone LIKE ? OR cpf LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY name ASC';
        const customers = db.prepare(query).all(...params);
        const countStmt = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total_spent FROM sales WHERE customer_id = ? AND status = 'completed'");
        customers.forEach(c => { const s = countStmt.get(c.id); c.purchase_count = s.count; c.total_spent = s.total_spent; });
        res.json({ success: true, data: customers });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar clientes.' }); }
});

router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!c) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        res.json({ success: true, data: c });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao buscar cliente.' }); }
});

router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { name, phone, cpf, email, address, notes } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
        if (cpf) { const d = db.prepare('SELECT id FROM customers WHERE cpf = ?').get(cpf.replace(/\D/g, '')); if (d) return res.status(400).json({ success: false, message: 'CPF já cadastrado.' }); }
        const r = db.prepare('INSERT INTO customers (name,phone,cpf,email,address,notes) VALUES (?,?,?,?,?,?)').run(name.trim(), phone||'', cpf?cpf.replace(/\D/g,''):'', email||'', address||'', notes||'');
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid);
        db.prepare("INSERT INTO activity_log (user_id,action,entity,entity_id,description) VALUES (?,'create','customer',?,?)").run(req.session.userId, customer.id, `Cliente "${name}" cadastrado`);
        res.status(201).json({ success: true, data: customer, message: 'Cliente cadastrado!' });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erro ao cadastrar cliente.' }); }
});

router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const ex = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!ex) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        const { name, phone, cpf, email, address, notes, active } = req.body;
        db.prepare('UPDATE customers SET name=COALESCE(?,name),phone=COALESCE(?,phone),cpf=COALESCE(?,cpf),email=COALESCE(?,email),address=COALESCE(?,address),notes=COALESCE(?,notes),active=COALESCE(?,active) WHERE id=?')
            .run(name?.trim(), phone, cpf?cpf.replace(/\D/g,''):null, email, address, notes, active, req.params.id);
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: customer, message: 'Cliente atualizado!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao atualizar cliente.' }); }
});

router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!c) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        const cnt = db.prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?').get(req.params.id).count;
        if (cnt > 0) { db.prepare('UPDATE customers SET active = 0 WHERE id = ?').run(req.params.id); return res.json({ success: true, message: 'Cliente desativado (possui compras).' }); }
        db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Cliente excluído!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao excluir cliente.' }); }
});

module.exports = router;

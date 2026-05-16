const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { search } = req.query;
        let query = 'SELECT * FROM suppliers';
        const params = [];
        if (search) {
            query += ' WHERE (company_name LIKE ? OR contact_name LIKE ? OR cnpj LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY company_name ASC';
        const suppliers = db.prepare(query).all(...params);
        res.json({ success: true, data: suppliers });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar fornecedores.' }); }
});

router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        if (!s) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        res.json({ success: true, data: s });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao buscar fornecedor.' }); }
});

router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { company_name, contact_name, phone, cnpj, email, address, notes } = req.body;
        if (!company_name || !company_name.trim()) return res.status(400).json({ success: false, message: 'Nome da empresa é obrigatório.' });
        // Verificar CNPJ duplicado
        const cnpjDigits = cnpj ? cnpj.replace(/\D/g, '') : '';
        if (cnpjDigits.length === 14) {
            const existing = db.prepare('SELECT id, company_name FROM suppliers WHERE cnpj = ?').get(cnpjDigits);
            if (existing) {
                return res.status(409).json({ success: false, message: `CNPJ já cadastrado para o fornecedor "${existing.company_name}".` });
            }
        }
        const r = db.prepare('INSERT INTO suppliers (company_name,contact_name,phone,cnpj,email,address,notes) VALUES (?,?,?,?,?,?,?)')
            .run(company_name.trim(), contact_name||'', phone||'', cnpjDigits, email||'', address||'', notes||'');
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(r.lastInsertRowid);
        db.prepare("INSERT INTO activity_log (user_id,action,entity,entity_id,description) VALUES (?,'create','supplier',?,?)").run(req.session.userId, supplier.id, `Fornecedor "${company_name}" cadastrado`);
        res.status(201).json({ success: true, data: supplier, message: 'Fornecedor cadastrado!' });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erro ao cadastrar fornecedor.' }); }
});

router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const ex = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        if (!ex) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        const { company_name, contact_name, phone, cnpj, email, address, notes, active } = req.body;
        // Verificar CNPJ duplicado (excluindo o próprio registro)
        const cnpjDigits = cnpj ? cnpj.replace(/\D/g, '') : null;
        if (cnpjDigits && cnpjDigits.length === 14) {
            const existing = db.prepare('SELECT id, company_name FROM suppliers WHERE cnpj = ? AND id != ?').get(cnpjDigits, req.params.id);
            if (existing) {
                return res.status(409).json({ success: false, message: `CNPJ já cadastrado para o fornecedor "${existing.company_name}".` });
            }
        }
        db.prepare('UPDATE suppliers SET company_name=COALESCE(?,company_name),contact_name=COALESCE(?,contact_name),phone=COALESCE(?,phone),cnpj=COALESCE(?,cnpj),email=COALESCE(?,email),address=COALESCE(?,address),notes=COALESCE(?,notes),active=COALESCE(?,active) WHERE id=?')
            .run(company_name?.trim(), contact_name, phone, cnpjDigits, email, address, notes, active, req.params.id);
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: supplier, message: 'Fornecedor atualizado!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao atualizar fornecedor.' }); }
});

router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        if (!s) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        const cnt = db.prepare('SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?').get(req.params.id).count;
        if (cnt > 0) { db.prepare('UPDATE suppliers SET active = 0 WHERE id = ?').run(req.params.id); return res.json({ success: true, message: 'Fornecedor desativado (possui pedidos).' }); }
        db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Fornecedor excluído!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao excluir fornecedor.' }); }
});

module.exports = router;

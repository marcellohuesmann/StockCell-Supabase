const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/categories
 * Lista todas as categorias
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { search, active } = req.query;

        let query = 'SELECT * FROM categories';
        const conditions = [];
        const params = [];

        if (active !== undefined) {
            conditions.push('active = ?');
            params.push(active === 'true' ? 1 : 0);
        }
        if (search) {
            conditions.push('(name LIKE ? OR description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY sort_order ASC, name ASC';

        const categories = db.prepare(query).all(...params);

        // Conta produtos por categoria
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND active = 1');
        categories.forEach(cat => {
            cat.product_count = countStmt.get(cat.id).count;
        });

        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar categorias.' });
    }
});

/**
 * GET /api/categories/:id
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });
        res.json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar categoria.' });
    }
});

/**
 * POST /api/categories
 */
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { name, description, icon, sort_order } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Nome da categoria é obrigatório.' });
        }

        const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name.trim());
        if (existing) {
            return res.status(400).json({ success: false, message: 'Já existe uma categoria com este nome.' });
        }

        const result = db.prepare(`
            INSERT INTO categories (name, description, icon, sort_order)
            VALUES (?, ?, ?, ?)
        `).run(name.trim(), description || '', icon || '📦', sort_order || 0);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'create', 'category', ?, ?)`)
            .run(req.session.userId, category.id, `Categoria "${name}" criada`);

        res.status(201).json({ success: true, data: category, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar categoria.' });
    }
});

/**
 * PUT /api/categories/:id
 */
router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const { name, description, icon, sort_order, active } = req.body;

        const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

        if (name && name.trim()) {
            const duplicate = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), req.params.id);
            if (duplicate) return res.status(400).json({ success: false, message: 'Já existe uma categoria com este nome.' });
        }

        db.prepare(`
            UPDATE categories SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                icon = COALESCE(?, icon),
                sort_order = COALESCE(?, sort_order),
                active = COALESCE(?, active)
            WHERE id = ?
        `).run(name?.trim() || null, description, icon, sort_order, active, req.params.id);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'update', 'category', ?, ?)`)
            .run(req.session.userId, category.id, `Categoria "${category.name}" atualizada`);

        res.json({ success: true, data: category, message: 'Categoria atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar categoria.' });
    }
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

        // Verifica se tem produtos vinculados
        const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(req.params.id).count;
        if (productCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Não é possível excluir. Existem ${productCount} produto(s) nesta categoria. Desative-a ou mova os produtos.`
            });
        }

        db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'delete', 'category', ?, ?)`)
            .run(req.session.userId, req.params.id, `Categoria "${category.name}" excluída`);

        res.json({ success: true, message: 'Categoria excluída com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir categoria.' });
    }
});

module.exports = router;

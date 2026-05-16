const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/categories
 * Lista todas as categorias
 */
router.get('/', async (req, res) => {
    try {
        const { search, active } = req.query;

        let query = supabase.from('categories').select('*');

        if (active !== undefined) {
            query = query.eq('active', active === 'true');
        }
        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        query = query.order('sort_order', { ascending: true }).order('name', { ascending: true });

        const { data: categories, error } = await query;
        
        if (error) throw error;

        // Conta produtos por categoria
        const { data: products } = await supabase
            .from('products')
            .select('category_id')
            .eq('active', true);
            
        categories.forEach(cat => {
            cat.product_count = (products || []).filter(p => p.category_id === cat.id).length;
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
router.get('/:id', async (req, res) => {
    try {
        const { data: category } = await supabase
            .from('categories')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });
        res.json({ success: true, data: category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar categoria.' });
    }
});

/**
 * POST /api/categories
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, icon, sort_order } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Nome da categoria é obrigatório.' });
        }

        const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', name.trim())
            .maybeSingle();
            
        if (existing) {
            return res.status(400).json({ success: false, message: 'Já existe uma categoria com este nome.' });
        }

        const { data: category, error } = await supabase
            .from('categories')
            .insert({
                name: name.trim(),
                description: description || '',
                icon: icon || '📦',
                sort_order: sort_order || 0
            })
            .select()
            .single();
            
        if (error) throw error;

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'create',
            entity: 'category',
            entity_id: category.id,
            description: `Categoria "${name}" criada`
        });

        res.status(201).json({ success: true, data: category, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar categoria.' });
    }
});

/**
 * PUT /api/categories/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, description, icon, sort_order, active } = req.body;

        const { data: existing } = await supabase
            .from('categories')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!existing) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

        if (name && name.trim()) {
            const { data: duplicate } = await supabase
                .from('categories')
                .select('id')
                .ilike('name', name.trim())
                .neq('id', req.params.id)
                .maybeSingle();
                
            if (duplicate) return res.status(400).json({ success: false, message: 'Já existe uma categoria com este nome.' });
        }

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description;
        if (icon !== undefined) updates.icon = icon;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (active !== undefined) updates.active = active;

        const { data: category, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'update',
            entity: 'category',
            entity_id: category.id,
            description: `Categoria "${category.name}" atualizada`
        });

        res.json({ success: true, data: category, message: 'Categoria atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar categoria.' });
    }
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { data: category } = await supabase
            .from('categories')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

        // Verifica se tem produtos vinculados
        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', req.params.id);
            
        if (count > 0) {
            return res.status(400).json({
                success: false,
                message: `Não é possível excluir. Existem ${count} produto(s) nesta categoria. Desative-a ou mova os produtos.`
            });
        }

        await supabase.from('categories').delete().eq('id', req.params.id);

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'delete',
            entity: 'category',
            entity_id: req.params.id,
            description: `Categoria "${category.name}" excluída`
        });

        res.json({ success: true, message: 'Categoria excluída com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir categoria.' });
    }
});

module.exports = router;

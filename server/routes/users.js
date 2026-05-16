const express = require('express');
const bcrypt = require('bcrypt');
const supabase = require('../database/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

/** GET /api/users */
router.get('/', async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, full_name, role, active, created_at')
            .order('full_name', { ascending: true });

        if (error) throw error;

        // Fetch all completed sales to calculate count and total per user
        const { data: sales } = await supabase
            .from('sales')
            .select('user_id, total')
            .eq('status', 'completed');
            
        users.forEach(u => {
            const userSales = (sales || []).filter(s => s.user_id === u.id);
            u.sales_count = userSales.length;
            u.sales_total = userSales.reduce((acc, curr) => acc + Number(curr.total), 0);
        });

        res.json({ success: true, data: users });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao listar usuários.' });
    }
});

/** POST /api/users */
router.post('/', async (req, res) => {
    try {
        const { username, full_name, password, role } = req.body;
        if (!username || !full_name || !password) return res.status(400).json({ success: false, message: 'Usuário, nome completo e senha são obrigatórios.' });
        if (password.length < 6) return res.status(400).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres.' });
        
        const { data: dup } = await supabase
            .from('users')
            .select('id')
            .eq('username', username.toLowerCase().trim())
            .maybeSingle();

        if (dup) return res.status(400).json({ success: false, message: 'Nome de usuário já existe.' });
        
        const hash = await bcrypt.hash(password, 10);
        
        const { data: user, error } = await supabase
            .from('users')
            .insert({
                username: username.toLowerCase().trim(),
                full_name: full_name.trim(),
                password_hash: hash,
                role: role || 'operator'
            })
            .select('id, username, full_name, role, active, created_at')
            .single();

        if (error) throw error;

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'create',
            entity: 'user',
            entity_id: user.id,
            description: `Usuário "${full_name}" criado`
        });

        res.status(201).json({ success: true, data: user, message: 'Usuário criado com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao criar usuário.' });
    }
});

/** PUT /api/users/:id */
router.put('/:id', async (req, res) => {
    try {
        const { data: existing } = await supabase.from('users').select('*').eq('id', req.params.id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        
        const { full_name, role, active, password } = req.body;
        
        // Não permite desativar o último admin
        if (active === false && existing.role === 'admin') {
            const { count } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin')
                .eq('active', true);
                
            if (count <= 1) return res.status(400).json({ success: false, message: 'Não é possível desativar o último administrador.' });
        }
        
        const updates = {};
        if (full_name !== undefined) updates.full_name = full_name.trim();
        if (role !== undefined) updates.role = role;
        if (active !== undefined) updates.active = active;
        if (password && password.length >= 6) {
            updates.password_hash = await bcrypt.hash(password, 10);
        }

        const { data: user, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.params.id)
            .select('id, username, full_name, role, active, created_at')
            .single();

        if (error) throw error;

        res.json({ success: true, data: user, message: 'Usuário atualizado!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao atualizar usuário.' });
    }
});

/** DELETE /api/users/:id */
router.delete('/:id', async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.session.userId) return res.status(400).json({ success: false, message: 'Você não pode excluir sua própria conta.' });
        
        const { data: user } = await supabase.from('users').select('id').eq('id', req.params.id).maybeSingle();
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        
        const { count } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.params.id);
            
        if (count > 0) {
            await supabase.from('users').update({ active: false }).eq('id', req.params.id);
            return res.json({ success: true, message: 'Usuário desativado (possui vendas vinculadas).' });
        }
        
        await supabase.from('users').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Usuário excluído!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao excluir usuário.' });
    }
});

module.exports = router;

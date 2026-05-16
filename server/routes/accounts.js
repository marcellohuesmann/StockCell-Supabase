const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

const requireFinance = async (req, res, next) => {
    try {
        const role = req.session.role;
        if (role === 'admin') return next();
        
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
        if (row && row.value) {
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

router.get('/', async (req, res) => {
    try {
        const { data: accounts, error } = await supabase.from('bank_accounts').select('*').order('name', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: accounts || [] });
    } catch (e) {
        console.error('Erro ao buscar contas:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, type, initial_balance, color } = req.body;
        if (!name || !type) return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });
        
        const initBal = initial_balance ? parseFloat(initial_balance) : 0;
        
        const { data: result, error } = await supabase.from('bank_accounts').insert({
            name, type, initial_balance: initBal, current_balance: initBal, color: color || '#808080'
        }).select('id').single();
        if (error) throw error;
        
        res.json({ success: true, message: 'Conta bancária criada com sucesso.', id: result.id });
    } catch (e) {
        console.error('Erro ao criar conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, type, color } = req.body;
        if (!name || !type) return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });
        
        const { data, error } = await supabase.from('bank_accounts').update({
            name, type, color: color || '#808080'
        }).eq('id', req.params.id).select('id').maybeSingle();
        
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        
        res.json({ success: true, message: 'Conta atualizada com sucesso.' });
    } catch (e) {
        console.error('Erro ao atualizar conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { count, error: countError } = await supabase.from('transaction_payments').select('*', { count: 'exact', head: true }).eq('account_id', req.params.id);
        if (countError) throw countError;
        
        if (count > 0) {
            return res.status(400).json({ success: false, message: 'Não é possível excluir uma conta que possui transações vinculadas.' });
        }
        
        const { data, error } = await supabase.from('bank_accounts').delete().eq('id', req.params.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        
        res.json({ success: true, message: 'Conta excluída com sucesso.' });
    } catch (e) {
        console.error('Erro ao excluir conta:', e);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

module.exports = router;

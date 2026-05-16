const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = supabase.from('suppliers').select('*');
        if (search) {
            query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,cnpj.ilike.%${search}%,phone.ilike.%${search}%`);
        }
        query = query.order('company_name', { ascending: true });
        
        const { data: suppliers, error } = await query;
        if (error) throw error;
        
        res.json({ success: true, data: suppliers || [] });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar fornecedores.' }); }
});

router.get('/:id', async (req, res) => {
    try {
        const { data: s } = await supabase.from('suppliers').select('*').eq('id', req.params.id).maybeSingle();
        if (!s) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        res.json({ success: true, data: s });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao buscar fornecedor.' }); }
});

router.post('/', async (req, res) => {
    try {
        const { company_name, contact_name, phone, cnpj, email, address, notes } = req.body;
        if (!company_name || !company_name.trim()) return res.status(400).json({ success: false, message: 'Nome da empresa é obrigatório.' });
        
        const cnpjDigits = cnpj ? cnpj.replace(/\D/g, '') : null;
        if (cnpjDigits && cnpjDigits.length === 14) {
            const { data: existing } = await supabase.from('suppliers').select('id, company_name').eq('cnpj', cnpjDigits).maybeSingle();
            if (existing) {
                return res.status(409).json({ success: false, message: `CNPJ já cadastrado para o fornecedor "${existing.company_name}".` });
            }
        }
        
        const { data: supplier, error } = await supabase.from('suppliers').insert({
            company_name: company_name.trim(), contact_name: contact_name || '', phone: phone || '', cnpj: cnpjDigits, email: email || '', address: address || '', notes: notes || ''
        }).select('*').single();
        if (error) throw error;

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'create', entity: 'supplier', entity_id: supplier.id, description: `Fornecedor "${company_name}" cadastrado`
        });
        
        res.status(201).json({ success: true, data: supplier, message: 'Fornecedor cadastrado!' });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Erro ao cadastrar fornecedor.' }); }
});

router.put('/:id', async (req, res) => {
    try {
        const { data: ex } = await supabase.from('suppliers').select('*').eq('id', req.params.id).maybeSingle();
        if (!ex) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        
        const { company_name, contact_name, phone, cnpj, email, address, notes, active } = req.body;
        
        const cnpjDigits = cnpj ? cnpj.replace(/\D/g, '') : null;
        if (cnpjDigits && cnpjDigits.length === 14) {
            const { data: existing } = await supabase.from('suppliers').select('id, company_name').eq('cnpj', cnpjDigits).neq('id', req.params.id).maybeSingle();
            if (existing) {
                return res.status(409).json({ success: false, message: `CNPJ já cadastrado para o fornecedor "${existing.company_name}".` });
            }
        }
        
        const { data: supplier, error } = await supabase.from('suppliers').update({
            company_name: company_name?.trim() || ex.company_name,
            contact_name: contact_name !== undefined ? contact_name : ex.contact_name,
            phone: phone !== undefined ? phone : ex.phone,
            cnpj: cnpjDigits !== undefined ? cnpjDigits : ex.cnpj,
            email: email !== undefined ? email : ex.email,
            address: address !== undefined ? address : ex.address,
            notes: notes !== undefined ? notes : ex.notes,
            active: active !== undefined ? active : ex.active,
            updated_at: new Date().toISOString()
        }).eq('id', req.params.id).select('*').single();
        if (error) throw error;
        
        res.json({ success: true, data: supplier, message: 'Fornecedor atualizado!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao atualizar fornecedor.' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const { data: s } = await supabase.from('suppliers').select('*').eq('id', req.params.id).maybeSingle();
        if (!s) return res.status(404).json({ success: false, message: 'Fornecedor não encontrado.' });
        
        const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('supplier_id', req.params.id);
        
        if (count > 0) { 
            await supabase.from('suppliers').update({ active: false }).eq('id', req.params.id);
            return res.json({ success: true, message: 'Fornecedor desativado (possui pedidos).' }); 
        }
        
        await supabase.from('suppliers').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Fornecedor excluído!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao excluir fornecedor.' }); }
});

module.exports = router;

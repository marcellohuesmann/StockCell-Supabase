const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = supabase.from('customers').select('*').order('name', { ascending: true });
        
        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%`);
        }
        
        const { data: customers, error } = await query;
        if (error) throw error;
        
        const { data: sales } = await supabase
            .from('sales')
            .select('customer_id, total')
            .eq('status', 'completed')
            .not('customer_id', 'is', null);
            
        customers.forEach(c => {
            const customerSales = (sales || []).filter(s => s.customer_id === c.id);
            c.purchase_count = customerSales.length;
            c.total_spent = customerSales.reduce((acc, curr) => acc + Number(curr.total), 0);
        });
        
        res.json({ success: true, data: customers });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao listar clientes.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { data: c } = await supabase
            .from('customers')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!c) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        res.json({ success: true, data: c });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao buscar cliente.' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, phone, cpf, email, address, notes } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });
        
        const cleanedCpf = cpf ? cpf.replace(/\D/g, '') : null;
        if (cleanedCpf) {
            const { data: d } = await supabase
                .from('customers')
                .select('id')
                .eq('cpf', cleanedCpf)
                .maybeSingle();
                
            if (d) return res.status(400).json({ success: false, message: 'CPF já cadastrado.' });
        }
        
        const { data: customer, error } = await supabase
            .from('customers')
            .insert({
                name: name.trim(),
                phone: phone || '',
                cpf: cleanedCpf || '',
                email: email || '',
                address: address || '',
                notes: notes || ''
            })
            .select()
            .single();
            
        if (error) throw error;
        
        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'create',
            entity: 'customer',
            entity_id: customer.id,
            description: `Cliente "${name}" cadastrado`
        });
        
        res.status(201).json({ success: true, data: customer, message: 'Cliente cadastrado!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar cliente.' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { data: ex } = await supabase
            .from('customers')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!ex) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        
        const { name, phone, cpf, email, address, notes, active } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (phone !== undefined) updates.phone = phone;
        if (cpf !== undefined) updates.cpf = cpf ? cpf.replace(/\D/g, '') : null;
        if (email !== undefined) updates.email = email;
        if (address !== undefined) updates.address = address;
        if (notes !== undefined) updates.notes = notes;
        if (active !== undefined) updates.active = active;
        
        const { data: customer, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();
            
        if (error) throw error;
        res.json({ success: true, data: customer, message: 'Cliente atualizado!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao atualizar cliente.' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { data: c } = await supabase
            .from('customers')
            .select('id')
            .eq('id', req.params.id)
            .maybeSingle();
            
        if (!c) return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
        
        const { count } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', req.params.id);
            
        if (count > 0) {
            await supabase.from('customers').update({ active: false }).eq('id', req.params.id);
            return res.json({ success: true, message: 'Cliente desativado (possui compras).' });
        }
        
        await supabase.from('customers').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Cliente excluído!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao excluir cliente.' });
    }
});

module.exports = router;

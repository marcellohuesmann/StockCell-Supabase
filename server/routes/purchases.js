const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/purchases
 * Listar pedidos de compra
 */
router.get('/', async (req, res) => {
    try {
        const { data: purchasesRaw, error } = await supabase.from('purchase_orders').select('*, suppliers(company_name)').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        
        const purchaseIds = (purchasesRaw || []).map(p => p.id);
        let itemsMap = {};
        if (purchaseIds.length > 0) {
            const { data: itemsRaw } = await supabase.from('purchase_items').select('*, products(name)').in('purchase_id', purchaseIds);
            if (itemsRaw) {
                itemsRaw.forEach(item => {
                    if (!itemsMap[item.purchase_id]) itemsMap[item.purchase_id] = [];
                    itemsMap[item.purchase_id].push({
                        ...item,
                        product_name: item.products?.name
                    });
                });
            }
        }
        
        const purchases = (purchasesRaw || []).map(p => ({
            ...p,
            supplier_name: p.suppliers?.company_name,
            items: itemsMap[p.id] || []
        }));

        res.json({ success: true, data: purchases });
    } catch (error) {
        console.error('Erro ao listar pedidos de compra:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar pedidos de compra.' });
    }
});

/**
 * POST /api/purchases
 * Criar um novo pedido de compra
 */
router.post('/', async (req, res) => {
    try {
        const { supplier_id, expected_date, notes, items } = req.body;
        
        if (!supplier_id || !items || !items.length) {
            return res.status(400).json({ success: false, message: 'Fornecedor e itens são obrigatórios.' });
        }
        
        const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.unit_cost) * parseInt(item.quantity)), 0);

        const { data: result, error: insertError } = await supabase.from('purchase_orders').insert({
            supplier_id, user_id: req.session.userId, status: 'pending', total_amount: totalAmount, expected_date: expected_date || null, notes: notes || ''
        }).select('id').single();
        if (insertError) throw insertError;

        const purchaseId = result.id;

        for (const item of items) {
            const q = parseInt(item.quantity);
            const c = parseFloat(item.unit_cost);
            await supabase.from('purchase_items').insert({
                purchase_id: purchaseId, product_id: item.product_id, quantity: q, unit_cost: c, total_cost: q * c
            });
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'create', entity: 'purchase', entity_id: purchaseId, description: `Pedido de Compra #${String(purchaseId).padStart(4,'0')} criado`
        });

        res.status(201).json({ success: true, message: 'Pedido de compra criado com sucesso!', data: { id: purchaseId } });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar pedido de compra.' });
    }
});

/**
 * PUT /api/purchases/:id/receive
 * Receber o pedido de compra (Atualiza estoque e gera Contas a Pagar)
 */
router.put('/:id/receive', async (req, res) => {
    try {
        const { generate_payable, account_id, due_date } = req.body;
        const purchaseId = req.params.id;

        const { data: purchase } = await supabase.from('purchase_orders').select('*').eq('id', purchaseId).maybeSingle();
        if (!purchase) return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        if (purchase.status !== 'pending') return res.status(400).json({ success: false, message: 'Pedido já recebido ou cancelado.' });

        const { data: items } = await supabase.from('purchase_items').select('*').eq('purchase_id', purchaseId);

        await supabase.from('purchase_orders').update({
            status: 'received', received_date: new Date().toISOString(), updated_at: new Date().toISOString()
        }).eq('id', purchaseId);

        for (const item of (items || [])) {
            const { data: product } = await supabase.from('products').select('current_stock, cost_price').eq('id', item.product_id).maybeSingle();
            if (product) {
                const newStock = product.current_stock + item.quantity;
                await supabase.from('products').update({
                    current_stock: newStock, cost_price: item.unit_cost, updated_at: new Date().toISOString()
                }).eq('id', item.product_id);

                await supabase.from('stock_movements').insert({
                    product_id: item.product_id, user_id: req.session.userId, type: 'entry', quantity: item.quantity, balance_after: newStock, reason: `Recebimento Pedido #${String(purchaseId).padStart(4,'0')}`, reference_id: purchaseId
                });
            }
        }

        if (generate_payable) {
            const { data: supplier } = await supabase.from('suppliers').select('company_name').eq('id', purchase.supplier_id).maybeSingle();
            const desc = `Compra: ${supplier ? supplier.company_name : 'Fornecedor'} (Pedido #${String(purchaseId).padStart(4,'0')})`;
            
            const { data: cat } = await supabase.from('transaction_categories').select('id').eq('type', 'expense').limit(1).maybeSingle();
            
            await supabase.from('transactions').insert({
                type: 'expense', category_id: cat ? cat.id : null, description: desc, amount: purchase.total_amount, status: 'pending', due_date: due_date || new Date().toISOString().split('T')[0], reference_id: purchaseId, reference_type: 'purchase'
            });
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'receive', entity: 'purchase', entity_id: purchaseId, description: `Pedido de Compra #${String(purchaseId).padStart(4,'0')} recebido no estoque`
        });

        res.json({ success: true, message: 'Pedido recebido com sucesso. Estoque atualizado!' });
    } catch (error) {
        console.error('Erro ao receber pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao receber pedido de compra.' });
    }
});

/**
 * DELETE /api/purchases/:id
 * Cancelar um pedido de compra pendente
 */
router.delete('/:id', async (req, res) => {
    try {
        const purchaseId = req.params.id;

        const { data: purchase } = await supabase.from('purchase_orders').select('status').eq('id', purchaseId).maybeSingle();
        if (!purchase) return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        if (purchase.status === 'received') return res.status(400).json({ success: false, message: 'Não é possível cancelar um pedido já recebido.' });

        await supabase.from('purchase_orders').update({
            status: 'cancelled', updated_at: new Date().toISOString()
        }).eq('id', purchaseId);

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'cancel', entity: 'purchase', entity_id: purchaseId, description: `Pedido de Compra #${String(purchaseId).padStart(4,'0')} cancelado`
        });

        res.json({ success: true, message: 'Pedido cancelado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cancelar pedido:', error);
        res.status(500).json({ success: false, message: 'Erro ao cancelar pedido de compra.' });
    }
});

module.exports = router;

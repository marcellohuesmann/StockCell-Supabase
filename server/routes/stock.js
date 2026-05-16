const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/stock/movements
 */
router.get('/movements', async (req, res) => {
    try {
        const { product_id, type, limit = 50 } = req.query;
        let query = supabase.from('stock_movements').select('*, products(name, barcode), users(full_name)');
        
        if (product_id) query = query.eq('product_id', product_id);
        if (type) query = query.eq('type', type);
        
        query = query.order('created_at', { ascending: false }).limit(parseInt(limit));
        const { data: rawData, error } = await query;
        if (error) throw error;
        
        const data = (rawData || []).map(m => ({
            ...m,
            product_name: m.products?.name,
            barcode: m.products?.barcode,
            user_name: m.users?.full_name
        }));
        
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao listar movimentações.' }); }
});

/**
 * POST /api/stock/entry - Entrada de mercadoria
 */
router.post('/entry', async (req, res) => {
    try {
        const { items, supplier_id, notes } = req.body;
        if (!items || !items.length) return res.status(400).json({ success: false, message: 'Adicione pelo menos um item.' });

        let total = 0;
        let poId = null;
        if (supplier_id) {
            const { data: poResult, error: poErr } = await supabase.from('purchase_orders').insert({
                supplier_id, user_id: req.session.userId, total: 0, status: 'received', notes: notes || ''
            }).select('id').single();
            if (poErr) throw poErr;
            poId = poResult.id;
        }

        for (const item of items) {
            const { data: product } = await supabase.from('products').select('*').eq('id', item.product_id).maybeSingle();
            if (!product) continue;
            
            const qty = parseInt(item.quantity);
            const cost = parseFloat(item.unit_cost) || product.cost_price;

            const newStock = product.current_stock + qty;
            
            await supabase.from('products').update({
                current_stock: newStock, cost_price: cost, updated_at: new Date().toISOString()
            }).eq('id', item.product_id);

            await supabase.from('stock_movements').insert({
                product_id: item.product_id, user_id: req.session.userId, type: 'entry', quantity: qty, balance_after: newStock, reason: notes || 'Entrada de mercadoria', reference_id: poId
            });

            if (poId) {
                const itemTotal = qty * cost;
                total += itemTotal;
                await supabase.from('purchase_items').insert({
                    purchase_order_id: poId, product_id: item.product_id, quantity: qty, unit_cost: cost, total: itemTotal
                });
            }
        }

        if (poId) {
            await supabase.from('purchase_orders').update({ total }).eq('id', poId);
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'stock_entry', entity: 'stock', description: `Entrada de ${items.length} produto(s)`
        });

        res.json({ success: true, message: 'Entrada de mercadoria registrada com sucesso!' });
    } catch (error) {
        console.error('Erro na entrada de mercadoria:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar entrada.' });
    }
});

/**
 * POST /api/stock/adjustment - Ajuste manual de estoque
 */
router.post('/adjustment', async (req, res) => {
    try {
        const { product_id, new_quantity, reason } = req.body;
        if (!product_id) return res.status(400).json({ success: false, message: 'Produto é obrigatório.' });
        if (new_quantity == null || new_quantity < 0) return res.status(400).json({ success: false, message: 'Quantidade inválida.' });
        if (!reason) return res.status(400).json({ success: false, message: 'Justificativa é obrigatória.' });

        const { data: product } = await supabase.from('products').select('*').eq('id', product_id).maybeSingle();
        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        const diff = new_quantity - product.current_stock;
        
        await supabase.from('products').update({
            current_stock: new_quantity, updated_at: new Date().toISOString()
        }).eq('id', product_id);
        
        await supabase.from('stock_movements').insert({
            product_id, user_id: req.session.userId, type: 'adjustment', quantity: diff, balance_after: new_quantity, reason: `Ajuste: ${reason}`
        });
        
        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'stock_adjust', entity: 'product', entity_id: product_id, description: `Ajuste de estoque: ${product.name} (${product.current_stock} → ${new_quantity})`
        });

        res.json({ success: true, message: `Estoque ajustado: ${product.current_stock} → ${new_quantity}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao ajustar estoque.' });
    }
});

/**
 * GET /api/stock/low - Produtos com estoque baixo
 */
router.get('/low', async (req, res) => {
    try {
        const { data: rawProducts, error } = await supabase.from('products')
            .select('*, categories(name)')
            .eq('active', true)
            .eq('is_service', false);
            
        if (error) throw error;
        
        const products = (rawProducts || []).filter(p => p.current_stock <= p.min_stock).sort((a, b) => a.current_stock - b.current_stock).map(p => ({
            ...p,
            category_name: p.categories?.name
        }));
        
        res.json({ success: true, data: products });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao buscar estoque baixo.' }); }
});

module.exports = router;

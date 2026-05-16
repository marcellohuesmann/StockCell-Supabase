const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/products
 */
router.get('/', async (req, res) => {
    try {
        const { search, category_id, active, low_stock, page = 1, limit = 50 } = req.query;

        let query = supabase.from('products').select('*, categories(name, icon)', { count: 'exact' });

        if (active !== undefined) {
            query = query.eq('active', active === 'true');
        } else {
            query = query.eq('active', true);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,internal_code.ilike.%${search}%,brand.ilike.%${search}%,compatible_model.ilike.%${search}%`);
        }

        if (category_id) {
            query = query.eq('category_id', category_id);
        }

        if (low_stock !== 'true') {
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1).order('name', { ascending: true });
        }

        const { data: rawProducts, error, count } = await query;
        if (error) throw error;

        let products = (rawProducts || []).map(p => ({
            ...p,
            category_name: p.categories?.name,
            category_icon: p.categories?.icon
        }));

        if (low_stock === 'true') {
            products = products.filter(p => p.is_service === false && p.current_stock <= p.min_stock);
            products.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Calcula margem de lucro
        products.forEach(p => {
            p.profit_margin = p.cost_price > 0
                ? (((p.sale_price - p.cost_price) / p.cost_price) * 100).toFixed(1)
                : 0;
            p.is_low_stock = p.is_service === false && p.current_stock <= p.min_stock;
        });

        let finalProducts = products;
        let finalCount = count;

        if (low_stock === 'true') {
            finalCount = products.length;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            finalProducts = products.slice(offset, offset + parseInt(limit));
        }

        res.json({
            success: true,
            data: finalProducts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: finalCount || 0,
                pages: Math.ceil((finalCount || 0) / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar produtos.' });
    }
});

/**
 * GET /api/products/barcode/:barcode
 */
router.get('/barcode/:barcode', async (req, res) => {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .eq('active', true)
            .or(`barcode.eq.${req.params.barcode},internal_code.eq.${req.params.barcode}`)
            .maybeSingle();

        if (error || !product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        
        product.category_name = product.categories?.name;
        res.json({ success: true, data: product });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
    }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .eq('id', req.params.id)
            .maybeSingle();

        if (error || !product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        
        product.category_name = product.categories?.name;

        const { data: variations } = await supabase.from('product_variations').select('*').eq('product_id', product.id);
        const { data: serials } = await supabase.from('product_serials').select('*').eq('product_id', product.id).order('created_at', { ascending: false });
        
        // sort serials available first
        if (serials) {
            serials.sort((a, b) => {
                if (a.status === 'available' && b.status !== 'available') return -1;
                if (a.status !== 'available' && b.status === 'available') return 1;
                return 0;
            });
        }

        product.variations = variations || [];
        product.serials = serials || [];

        res.json({ success: true, data: product });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
    }
});

/**
 * POST /api/products
 */
router.post('/', async (req, res) => {
    try {
        const { barcode, internal_code, name, brand, compatible_model, category_id,
                cost_price, sale_price, current_stock, min_stock, image_path, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Nome do produto é obrigatório.' });
        }
        if (sale_price == null || sale_price <= 0) {
            return res.status(400).json({ success: false, message: 'Preço de venda é obrigatório e deve ser maior que zero.' });
        }

        if (barcode) {
            const { data: dup } = await supabase.from('products').select('id').eq('barcode', barcode).maybeSingle();
            if (dup) return res.status(400).json({ success: false, message: 'Já existe um produto com este código de barras.' });
        }

        let finalInternalCode = internal_code;
        if (!finalInternalCode) {
            const { data: lastProd } = await supabase.from('products').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
            const lastId = lastProd ? lastProd.id : 0;
            finalInternalCode = `SC${String(lastId + 1).padStart(5, '0')}`;
        }

        const is_service = req.body.is_service ? true : false;
        const final_cost = is_service ? 0 : (cost_price || 0);
        const final_min = is_service ? 0 : (min_stock || 5);
        const final_cur = is_service ? 0 : (current_stock || 0);
        const final_track = is_service ? false : (req.body.track_serial || false);

        const { data: product, error } = await supabase.from('products').insert({
            barcode: barcode || null,
            internal_code: finalInternalCode,
            name: name.trim(),
            brand: brand || '',
            compatible_model: compatible_model || '',
            category_id: category_id || null,
            cost_price: final_cost,
            sale_price: sale_price,
            current_stock: final_cur,
            min_stock: final_min,
            image_path: image_path || null,
            track_serial: final_track,
            unit_type: req.body.unit_type || 'un',
            is_service: is_service
        }).select().single();

        if (error) throw error;

        if (current_stock > 0) {
            await supabase.from('stock_movements').insert({
                product_id: product.id,
                user_id: req.session.userId,
                type: 'entry',
                quantity: current_stock,
                balance_after: current_stock,
                reason: 'Estoque inicial'
            });
        }

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'create', entity: 'product', entity_id: product.id, description: `Produto "${name}" cadastrado` });

        res.status(201).json({ success: true, data: product, message: 'Produto cadastrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar produto.' });
    }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { data: existing } = await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        const { barcode, internal_code, name, brand, compatible_model, category_id,
                cost_price, sale_price, min_stock, image_path, notes, active } = req.body;

        if (barcode && barcode !== existing.barcode) {
            const { data: dup } = await supabase.from('products').select('id').eq('barcode', barcode).neq('id', req.params.id).maybeSingle();
            if (dup) return res.status(400).json({ success: false, message: 'Já existe um produto com este código de barras.' });
        }

        const is_service = req.body.is_service !== undefined ? !!req.body.is_service : existing.is_service;
        const final_cost = is_service ? 0 : (cost_price !== undefined ? cost_price : existing.cost_price);
        const final_min = is_service ? 0 : (min_stock !== undefined ? min_stock : existing.min_stock);
        const final_track = is_service ? false : (req.body.track_serial !== undefined ? !!req.body.track_serial : existing.track_serial);

        const updates = {
            barcode: barcode || null,
            internal_code: internal_code !== undefined ? internal_code : existing.internal_code,
            name: name ? name.trim() : existing.name,
            brand: brand !== undefined ? brand : existing.brand,
            compatible_model: compatible_model !== undefined ? compatible_model : existing.compatible_model,
            category_id: category_id !== undefined ? category_id : existing.category_id,
            cost_price: final_cost,
            sale_price: sale_price !== undefined ? sale_price : existing.sale_price,
            min_stock: final_min,
            image_path: image_path !== undefined ? image_path : existing.image_path,
            active: active !== undefined ? active : existing.active,
            track_serial: final_track,
            unit_type: req.body.unit_type !== undefined ? req.body.unit_type : existing.unit_type,
            is_service: is_service,
            updated_at: new Date().toISOString()
        };

        const { data: product, error } = await supabase.from('products').update(updates).eq('id', req.params.id).select('*, categories(name)').single();
        if (error) throw error;
        
        product.category_name = product.categories?.name;

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'update', entity: 'product', entity_id: product.id, description: `Produto "${product.name}" atualizado` });

        res.json({ success: true, data: product, message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar produto.' });
    }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { data: product } = await supabase.from('products').select('*').eq('id', req.params.id).maybeSingle();
        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        const { count: salesCount } = await supabase.from('sale_items').select('*', { count: 'exact', head: true }).eq('product_id', req.params.id);
        if (salesCount > 0) {
            await supabase.from('products').update({ active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id);
            return res.json({ success: true, message: 'Produto desativado (possui vendas vinculadas).' });
        }

        await supabase.from('product_variations').delete().eq('product_id', req.params.id);
        await supabase.from('product_serials').delete().eq('product_id', req.params.id);
        await supabase.from('stock_movements').delete().eq('product_id', req.params.id);
        await supabase.from('products').delete().eq('id', req.params.id);

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'delete', entity: 'product', entity_id: req.params.id, description: `Produto "${product.name}" excluído` });

        res.json({ success: true, message: 'Produto excluído com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir produto.' });
    }
});

// =============================================
// VARIATIONS (GRADE)
// =============================================

router.post('/:id/variations', async (req, res) => {
    try {
        const { attribute_name, attribute_value, barcode, additional_price, current_stock } = req.body;
        if (!attribute_name || !attribute_value) return res.status(400).json({ success: false, message: 'Nome e valor do atributo são obrigatórios.' });

        const { data: variation, error } = await supabase.from('product_variations').insert({
            product_id: req.params.id,
            attribute_name: attribute_name,
            attribute_value: attribute_value,
            barcode: barcode || null,
            additional_price: additional_price || 0,
            current_stock: current_stock || 0
        }).select('id').single();
        if (error) throw error;

        res.json({ success: true, data: { id: variation.id }, message: 'Variação adicionada com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar variação:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar variação.' });
    }
});

router.delete('/variations/:vid', async (req, res) => {
    try {
        await supabase.from('product_variations').delete().eq('id', req.params.vid);
        res.json({ success: true, message: 'Variação excluída.' });
    } catch (error) {
        console.error('Erro ao excluir variação:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir variação.' });
    }
});

// =============================================
// SERIALS / IMEI
// =============================================

router.post('/:id/serials', async (req, res) => {
    try {
        const { serial_number, purchase_date } = req.body;
        if (!serial_number) return res.status(400).json({ success: false, message: 'Número de série é obrigatório.' });

        const { data: serial, error } = await supabase.from('product_serials').insert({
            product_id: req.params.id,
            serial_number: serial_number.trim(),
            status: 'available',
            purchase_date: purchase_date || null
        }).select('id').single();

        if (error) {
            if (error.code === '23505') { // Postgres unique violation
                return res.status(400).json({ success: false, message: 'Este número de série já está cadastrado.' });
            }
            throw error;
        }

        // Increase stock
        const { data: product } = await supabase.from('products').select('current_stock').eq('id', req.params.id).single();
        const newStock = product.current_stock + 1;
        await supabase.from('products').update({ current_stock: newStock }).eq('id', req.params.id);
        
        await supabase.from('stock_movements').insert({
            product_id: req.params.id, user_id: req.session.userId, type: 'entry', quantity: 1, balance_after: newStock, reason: `Adição do serial ${serial_number}`
        });

        res.json({ success: true, data: { id: serial.id }, message: 'Serial adicionado com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar serial:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar número de série.' });
    }
});

router.delete('/serials/:sid', async (req, res) => {
    try {
        const { data: serial } = await supabase.from('product_serials').select('*').eq('id', req.params.sid).maybeSingle();
        if (!serial) return res.status(404).json({ success: false, message: 'Serial não encontrado.' });
        if (serial.status === 'sold') return res.status(400).json({ success: false, message: 'Não é possível excluir um serial já vendido.' });

        await supabase.from('product_serials').delete().eq('id', req.params.sid);

        const { data: product } = await supabase.from('products').select('current_stock').eq('id', serial.product_id).single();
        const newStock = product.current_stock - 1;
        await supabase.from('products').update({ current_stock: newStock }).eq('id', serial.product_id);

        await supabase.from('stock_movements').insert({
            product_id: serial.product_id, user_id: req.session.userId, type: 'exit', quantity: 1, balance_after: newStock, reason: `Remoção do serial ${serial.serial_number}`
        });

        res.json({ success: true, message: 'Serial excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir serial:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir número de série.' });
    }
});

// GET /api/products/:id/serials/validate/:imei
// Valida se um IMEI existe e está disponível para venda
router.get('/:id/serials/validate/:imei', async (req, res) => {
    try {
        const { data: serial } = await supabase.from('product_serials').select('*').eq('product_id', req.params.id).eq('serial_number', req.params.imei).maybeSingle();
        
        if (!serial) {
            return res.status(404).json({ success: false, message: 'Serial/IMEI não encontrado para este produto.' });
        }
        
        if (serial.status !== 'available') {
            return res.status(400).json({ success: false, message: `Serial/IMEI não disponível. Status atual: ${serial.status}` });
        }

        res.json({ success: true, data: serial });
    } catch (error) {
        console.error('Erro ao validar serial:', error);
        res.status(500).json({ success: false, message: 'Erro ao validar número de série.' });
    }
});

module.exports = router;

const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/search?q=query
 * Global search across products, customers, and sales
 */
router.get('/', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json({ success: true, data: { products: [], customers: [], sales: [] } });
        }

        const searchPattern = `%${query}%`;

        // 1. Search Products
        const { data: products } = await supabase.from('products')
            .select('id, name, barcode, internal_code, sale_price, current_stock, image_path')
            .eq('active', true)
            .or(`name.ilike.${searchPattern},barcode.ilike.${searchPattern},internal_code.ilike.${searchPattern}`)
            .limit(10);

        // 2. Search Customers
        const { data: customersRaw } = await supabase.from('customers')
            .select('id, name, cpf, phone')
            .eq('active', true)
            .or(`name.ilike.${searchPattern},cpf.ilike.${searchPattern},phone.ilike.${searchPattern}`)
            .limit(10);
            
        const customers = (customersRaw || []).map(c => ({ ...c, document: c.cpf }));

        // 3. Search Sales
        let salesQuery = supabase.from('sales').select('id, uuid, total, status, created_at');
        const isNumeric = /^\d+$/.test(query);
        if (isNumeric) {
            salesQuery = salesQuery.or(`id.eq.${query},uuid.ilike.${searchPattern}`);
        } else {
            salesQuery = salesQuery.or(`uuid.ilike.${searchPattern}`);
        }
        
        const { data: sales } = await salesQuery.limit(10);

        res.json({ 
            success: true, 
            data: { 
                products: products || [], 
                customers: customers || [], 
                sales: sales || [] 
            } 
        });
    } catch (error) {
        console.error('Erro na busca global:', error);
        res.status(500).json({ success: false, message: 'Erro ao realizar a busca.' });
    }
});

module.exports = router;

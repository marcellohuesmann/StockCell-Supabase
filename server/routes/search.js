const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/search?q=query
 * Global search across products, customers, and sales
 */
router.get('/', (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json({ success: true, data: { products: [], customers: [], sales: [] } });
        }

        const db = getDatabase();
        const searchPattern = `%${query}%`;

        // 1. Search Products
        const products = db.prepare(`
            SELECT id, name, barcode, internal_code, sale_price, current_stock, image_path 
            FROM products 
            WHERE (name LIKE ? OR barcode LIKE ? OR internal_code LIKE ?) AND active = 1
            LIMIT 10
        `).all(searchPattern, searchPattern, searchPattern);

        // 2. Search Customers
        const customers = db.prepare(`
            SELECT id, name, cpf as document, phone 
            FROM customers 
            WHERE (name LIKE ? OR cpf LIKE ? OR phone LIKE ?) AND active = 1
            LIMIT 10
        `).all(searchPattern, searchPattern, searchPattern);

        // 3. Search Sales
        const sales = db.prepare(`
            SELECT id, uuid, total, status, created_at 
            FROM sales 
            WHERE (id LIKE ? OR uuid LIKE ?)
            LIMIT 10
        `).all(searchPattern, searchPattern);

        res.json({ 
            success: true, 
            data: { 
                products, 
                customers, 
                sales 
            } 
        });
    } catch (error) {
        console.error('Erro na busca global:', error);
        res.status(500).json({ success: false, message: 'Erro ao realizar a busca.' });
    }
});

module.exports = router;

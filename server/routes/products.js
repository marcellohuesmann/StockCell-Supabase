const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/products
 */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const { search, category_id, active, low_stock, page = 1, limit = 50 } = req.query;

        let query = `SELECT p.*, c.name as category_name, c.icon as category_icon
                      FROM products p
                      LEFT JOIN categories c ON p.category_id = c.id`;
        const conditions = [];
        const params = [];

        if (active !== undefined) {
            conditions.push('p.active = ?');
            params.push(active === 'true' ? 1 : 0);
        } else {
            conditions.push('p.active = 1');
        }

        if (search) {
            conditions.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.internal_code LIKE ? OR p.brand LIKE ? OR p.compatible_model LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category_id) {
            conditions.push('p.category_id = ?');
            params.push(category_id);
        }

        if (low_stock === 'true') {
            conditions.push('p.current_stock <= p.min_stock AND p.is_service = 0');
        }

        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY p.name ASC';

        // Pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const countQuery = query.replace(/SELECT p\.\*, c\.name as category_name, c\.icon as category_icon/, 'SELECT COUNT(*) as total');
        const total = db.prepare(countQuery).get(...params).total;

        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const products = db.prepare(query).all(...params);

        // Calcula margem de lucro
        products.forEach(p => {
            p.profit_margin = p.cost_price > 0
                ? (((p.sale_price - p.cost_price) / p.cost_price) * 100).toFixed(1)
                : 0;
            p.is_low_stock = p.is_service === 0 && p.current_stock <= p.min_stock;
        });

        res.json({
            success: true,
            data: products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
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
router.get('/barcode/:barcode', (req, res) => {
    try {
        const db = getDatabase();
        const product = db.prepare(`
            SELECT p.*, c.name as category_name FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE (p.barcode = ? OR p.internal_code = ?) AND p.active = 1
        `).get(req.params.barcode, req.params.barcode);

        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
    }
});

/**
 * GET /api/products/:id
 */
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const product = db.prepare(`
            SELECT p.*, c.name as category_name FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `).get(req.params.id);

        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        // Fetch variations
        const variations = db.prepare(`SELECT * FROM product_variations WHERE product_id = ?`).all(product.id);
        
        // Fetch serials: Available first, then sold, ordered by creation date
        const serials = db.prepare(`SELECT * FROM product_serials WHERE product_id = ? ORDER BY CASE WHEN status = 'available' THEN 1 ELSE 2 END, created_at DESC`).all(product.id);

        product.variations = variations;
        product.serials = serials;

        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
    }
});

/**
 * POST /api/products
 */
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { barcode, internal_code, name, brand, compatible_model, category_id,
                cost_price, sale_price, current_stock, min_stock, image_path, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Nome do produto é obrigatório.' });
        }
        if (sale_price == null || sale_price <= 0) {
            return res.status(400).json({ success: false, message: 'Preço de venda é obrigatório e deve ser maior que zero.' });
        }

        // Verifica barcode duplicado
        if (barcode) {
            const dup = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
            if (dup) return res.status(400).json({ success: false, message: 'Já existe um produto com este código de barras.' });
        }

        // Gera código interno se não informado
        let finalInternalCode = internal_code;
        if (!finalInternalCode) {
            const lastId = db.prepare('SELECT MAX(id) as maxId FROM products').get().maxId || 0;
            finalInternalCode = `SC${String(lastId + 1).padStart(5, '0')}`;
        }

        const is_service = req.body.is_service ? 1 : 0;
        const final_cost = is_service ? 0 : (cost_price || 0);
        const final_min = is_service ? 0 : (min_stock || 5);
        const final_cur = is_service ? 0 : (current_stock || 0);
        const final_track = is_service ? 0 : (req.body.track_serial || 0);

        const result = db.prepare(`
            INSERT INTO products (barcode, internal_code, name, brand, compatible_model, category_id,
                                  cost_price, sale_price, current_stock, min_stock, image_path, notes, track_serial, unit_type, is_service)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            barcode || null, finalInternalCode, name.trim(), brand || '', compatible_model || '',
            category_id || null, final_cost, sale_price, final_cur, final_min,
            image_path || null, notes || '', final_track, req.body.unit_type || 'un', is_service
        );

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

        // Registra movimentação de estoque inicial se houver estoque
        if (current_stock > 0) {
            db.prepare(`
                INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason)
                VALUES (?, ?, 'entry', ?, ?, 'Estoque inicial')
            `).run(product.id, req.session.userId, current_stock, current_stock);
        }

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'create', 'product', ?, ?)`)
            .run(req.session.userId, product.id, `Produto "${name}" cadastrado`);

        res.status(201).json({ success: true, data: product, message: 'Produto cadastrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar produto.' });
    }
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        const { barcode, internal_code, name, brand, compatible_model, category_id,
                cost_price, sale_price, min_stock, image_path, notes, active } = req.body;

        if (barcode && barcode !== existing.barcode) {
            const dup = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
            if (dup) return res.status(400).json({ success: false, message: 'Já existe um produto com este código de barras.' });
        }

        const is_service = req.body.is_service !== undefined ? (req.body.is_service ? 1 : 0) : existing.is_service;
        const final_cost = is_service ? 0 : (cost_price !== undefined ? cost_price : existing.cost_price);
        const final_min = is_service ? 0 : (min_stock !== undefined ? min_stock : existing.min_stock);
        const final_track = is_service ? 0 : (req.body.track_serial !== undefined ? req.body.track_serial : existing.track_serial);

        db.prepare(`
            UPDATE products SET
                barcode = COALESCE(?, barcode),
                internal_code = COALESCE(?, internal_code),
                name = COALESCE(?, name),
                brand = COALESCE(?, brand),
                compatible_model = COALESCE(?, compatible_model),
                category_id = COALESCE(?, category_id),
                cost_price = ?,
                sale_price = COALESCE(?, sale_price),
                min_stock = ?,
                image_path = COALESCE(?, image_path),
                notes = COALESCE(?, notes),
                active = COALESCE(?, active),
                track_serial = ?,
                unit_type = COALESCE(?, unit_type),
                is_service = ?,
                updated_at = datetime('now','localtime')
            WHERE id = ?
        `).run(barcode, internal_code, name?.trim(), brand, compatible_model, category_id,
               final_cost, sale_price, final_min, image_path, notes, active, final_track, req.body.unit_type, is_service, req.params.id);

        const product = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?').get(req.params.id);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'update', 'product', ?, ?)`)
            .run(req.session.userId, product.id, `Produto "${product.name}" atualizado`);

        res.json({ success: true, data: product, message: 'Produto atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar produto.' });
    }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Produto não encontrado.' });

        // Verifica se tem vendas vinculadas
        const salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(req.params.id).count;
        if (salesCount > 0) {
            // Desativa em vez de excluir
            db.prepare('UPDATE products SET active = 0, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(req.params.id);
            return res.json({ success: true, message: 'Produto desativado (possui vendas vinculadas).' });
        }

        db.prepare('DELETE FROM product_variations WHERE product_id = ?').run(req.params.id);
        db.prepare('DELETE FROM product_serials WHERE product_id = ?').run(req.params.id);
        db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(req.params.id);
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'delete', 'product', ?, ?)`)
            .run(req.session.userId, req.params.id, `Produto "${product.name}" excluído`);

        res.json({ success: true, message: 'Produto excluído com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir produto.' });
    }
});

// =============================================
// VARIATIONS (GRADE)
// =============================================

router.post('/:id/variations', (req, res) => {
    try {
        const { attribute_name, attribute_value, barcode, additional_price, current_stock } = req.body;
        const db = getDatabase();
        
        if (!attribute_name || !attribute_value) {
            return res.status(400).json({ success: false, message: 'Nome e valor do atributo são obrigatórios.' });
        }

        const info = db.prepare(`
            INSERT INTO product_variations (product_id, attribute_name, attribute_value, barcode, additional_price, current_stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(req.params.id, attribute_name, attribute_value, barcode || null, additional_price || 0, current_stock || 0);

        res.json({ success: true, data: { id: info.lastInsertRowid }, message: 'Variação adicionada com sucesso!' });
    } catch (error) {
        console.error('Erro ao adicionar variação:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar variação.' });
    }
});

router.delete('/variations/:vid', (req, res) => {
    try {
        const db = getDatabase();
        db.prepare('DELETE FROM product_variations WHERE id = ?').run(req.params.vid);
        res.json({ success: true, message: 'Variação excluída.' });
    } catch (error) {
        console.error('Erro ao excluir variação:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir variação.' });
    }
});

// =============================================
// SERIALS / IMEI
// =============================================

router.post('/:id/serials', (req, res) => {
    try {
        const { serial_number, purchase_date } = req.body;
        const db = getDatabase();

        if (!serial_number) {
            return res.status(400).json({ success: false, message: 'Número de série é obrigatório.' });
        }

        const info = db.prepare(`
            INSERT INTO product_serials (product_id, serial_number, status, purchase_date)
            VALUES (?, ?, 'available', ?)
        `).run(req.params.id, serial_number.trim(), purchase_date || null);

        // Aumenta o estoque do produto principal em 1
        db.transaction(() => {
            db.prepare('UPDATE products SET current_stock = current_stock + 1 WHERE id = ?').run(req.params.id);
            const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(req.params.id);
            db.prepare(`
                INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason)
                VALUES (?, ?, 'entry', 1, ?, ?)
            `).run(req.params.id, req.session.userId, updatedProduct.current_stock, `Adição do serial ${serial_number}`);
        })();

        res.json({ success: true, data: { id: info.lastInsertRowid }, message: 'Serial adicionado com sucesso!' });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ success: false, message: 'Este número de série já está cadastrado.' });
        }
        console.error('Erro ao adicionar serial:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar número de série.' });
    }
});

router.delete('/serials/:sid', (req, res) => {
    try {
        const db = getDatabase();
        const serial = db.prepare('SELECT * FROM product_serials WHERE id = ?').get(req.params.sid);
        if (!serial) return res.status(404).json({ success: false, message: 'Serial não encontrado.' });
        if (serial.status === 'sold') {
            return res.status(400).json({ success: false, message: 'Não é possível excluir um serial já vendido.' });
        }

        db.transaction(() => {
            db.prepare('DELETE FROM product_serials WHERE id = ?').run(req.params.sid);
            // Diminui o estoque do produto principal
            db.prepare('UPDATE products SET current_stock = current_stock - 1 WHERE id = ?').run(serial.product_id);
            const updatedProduct = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(serial.product_id);
            db.prepare(`
                INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason)
                VALUES (?, ?, 'exit', 1, ?, ?)
            `).run(serial.product_id, req.session.userId, updatedProduct.current_stock, `Remoção do serial ${serial.serial_number}`);
        })();

        res.json({ success: true, message: 'Serial excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir serial:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir número de série.' });
    }
});

// GET /api/products/:id/serials/validate/:imei
// Valida se um IMEI existe e está disponível para venda
router.get('/:id/serials/validate/:imei', (req, res) => {
    try {
        const db = getDatabase();
        const serial = db.prepare('SELECT * FROM product_serials WHERE product_id = ? AND serial_number = ?').get(req.params.id, req.params.imei);
        
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

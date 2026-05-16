const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { runBackup } = require('../utils/backup');
const router = express.Router();
router.use(requireAuth);

const DEFAULT_PERMISSIONS = {
    pdv_sell:          { label: 'PDV - Realizar vendas',         admin: true, operator: true },
    stock_view:        { label: 'Consultar estoque',             admin: true, operator: true },
    customers_manage:  { label: 'Cadastrar clientes',            admin: true, operator: true },
    products_manage:   { label: 'Cadastrar produtos/categorias', admin: true, operator: false },
    suppliers_manage:  { label: 'Gerenciar fornecedores',        admin: true, operator: false },
    stock_entry:       { label: 'Entrada de mercadoria',         admin: true, operator: false },
    stock_adjust:      { label: 'Ajustar estoque',               admin: true, operator: false },
    sales_cancel:      { label: 'Cancelar vendas',               admin: true, operator: false },
    finance_manage:    { label: 'Gerenciar Financeiro (Caixa)',  admin: true, operator: false },
    reports_view:      { label: 'Relat\u00f3rios e Dashboard',   admin: true, operator: true },
    users_manage:      { label: 'Gerenciar usu\u00e1rios',      admin: true, operator: false },
    settings_manage:   { label: 'Configura\u00e7\u00f5es do sistema', admin: true, operator: false },
};

/** GET /api/settings/permissions */
router.get('/permissions', requireAdmin, (req, res) => {
    try {
        const db = getDatabase();
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'permissions'").get();
        const permissions = row ? JSON.parse(row.value) : DEFAULT_PERMISSIONS;
        res.json({ success: true, data: permissions });
    } catch (e) {
        res.json({ success: true, data: DEFAULT_PERMISSIONS });
    }
});

/** PUT /api/settings/permissions */
router.put('/permissions', requireAdmin, (req, res) => {
    try {
        const db = getDatabase();
        const { permissions } = req.body;
        if (!permissions) return res.status(400).json({ success: false, message: 'Permiss\u00f5es n\u00e3o informadas.' });
        // Admin always has all permissions
        for (const key of Object.keys(permissions)) {
            permissions[key].admin = true;
        }
        const existing = db.prepare("SELECT key FROM app_settings WHERE key = 'permissions'").get();
        if (existing) {
            db.prepare("UPDATE app_settings SET value = ? WHERE key = 'permissions'").run(JSON.stringify(permissions));
        } else {
            db.prepare("INSERT INTO app_settings (key, value) VALUES ('permissions', ?)").run(JSON.stringify(permissions));
        }
        db.prepare("INSERT INTO activity_log (user_id, action, entity, description) VALUES (?,'update_permissions','settings','Permiss\u00f5es atualizadas')")
            .run(req.session.userId);
        res.json({ success: true, message: 'Permiss\u00f5es salvas com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao salvar permiss\u00f5es.' });
    }
});

/** GET /api/settings/store */
router.get('/store', (req, res) => {
    try {
        const db = getDatabase();
        const keys = ['store_name', 'store_logo', 'store_cnpj', 'store_phone', 'store_address', 'pdv_strict_lock', 'terminal_mode', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'];
        const data = {};
        keys.forEach(k => { const r = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k); data[k] = r ? r.value : ''; });
        if (!data['terminal_mode']) data['terminal_mode'] = 'mobile_main'; // default
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao carregar configura\u00e7\u00f5es.' }); }
});

/** PUT /api/settings/store */
router.put('/store', requireAdmin, (req, res) => {
    try {
        const db = getDatabase();
        const { store_name, store_logo, store_cnpj, store_phone, store_address, pdv_strict_lock, terminal_mode, smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;
        const upsert = db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        upsert.run('store_name', store_name || '');
        if (store_logo !== undefined) upsert.run('store_logo', store_logo || '');
        upsert.run('store_cnpj', store_cnpj || '');
        upsert.run('store_phone', store_phone || '');
        upsert.run('store_address', store_address || '');
        upsert.run('pdv_strict_lock', pdv_strict_lock || 'false');
        upsert.run('terminal_mode', terminal_mode || 'mobile_main');
        upsert.run('smtp_host', smtp_host || '');
        upsert.run('smtp_port', smtp_port || '');
        upsert.run('smtp_user', smtp_user || '');
        upsert.run('smtp_pass', smtp_pass || '');
        res.json({ success: true, message: 'Dados da loja salvos!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao salvar dados da loja.' }); }
});

/** GET /api/settings/check-permission/:key */
router.get('/check-permission/:key', (req, res) => {
    try {
        const db = getDatabase();
        const role = req.session.role;
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'permissions'").get();
        const permissions = row ? JSON.parse(row.value) : DEFAULT_PERMISSIONS;
        const perm = permissions[req.params.key];
        const allowed = perm ? (perm[role] === true) : (role === 'admin');
        res.json({ success: true, allowed });
    } catch (e) { res.json({ success: true, allowed: req.session.role === 'admin' }); }
});

/** POST /api/settings/backup */
router.post('/backup', requireAdmin, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await runBackup(db);
        if (result.success) {
            db.prepare("INSERT INTO activity_log (user_id, action, entity, description) VALUES (?,'backup_manual','settings','Backup manual gerado')").run(req.session.userId);
            res.json({ success: true, message: 'Backup concluído com sucesso!', filename: result.filename });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao gerar backup.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});

/** POST /api/settings/restore-analyze */
router.post('/restore-analyze', requireAdmin, (req, res) => {
    try {
        const { known_users } = req.body;
        if (!known_users) return res.json({ success: true, conflicts: [] });

        const db = getDatabase();
        const conflicts = [];
        
        for (const [username, mobileData] of Object.entries(known_users)) {
            const pcUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
            if (pcUser && pcUser.password_hash !== mobileData.hash) {
                conflicts.push({ username });
            }
        }
        res.json({ success: true, conflicts });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao analisar arquivo de backup.' });
    }
});

/** POST /api/settings/restore-execute */
router.post('/restore-execute', requireAdmin, (req, res) => {
    const db = getDatabase();
    try {
        const { backupData, resolutions } = req.body;
        if (!backupData || !backupData.data) throw new Error('Dados inválidos');

        // Resolve conflitos de usuário
        const { known_users } = backupData;
        const insertUser = db.prepare("INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, full_name=excluded.full_name, role=excluded.role, active=excluded.active");

        db.transaction(() => {
            // 1. Desativar chaves temporariamente para limpar tabelas sem erro
            db.pragma('foreign_keys = OFF');

            // 2. Mesclar usuários
            if (known_users) {
                for (const [username, mobileData] of Object.entries(known_users)) {
                    const conflictRes = resolutions.find(r => r.username === username);
                    if (conflictRes && conflictRes.resolution === 'keep_pc') {
                        continue; // Não altera o usuário existente
                    }
                    // Insere ou atualiza com os dados do mobile
                    const u = mobileData.user;
                    insertUser.run(username, mobileData.hash, u.full_name || username, u.role || 'operator', u.active !== undefined ? u.active : 1);
                }
            }

            // 3. Limpar tabelas de negócio (Restore destrutivo)
            const tablesToWipe = ['sales', 'sale_items', 'payments', 'stock_movements', 'cash_movements', 'cash_registers', 'transactions', 'products', 'customers', 'categories', 'suppliers'];
            for (const table of tablesToWipe) {
                db.prepare(`DELETE FROM ${table}`).run();
            }

            // 4. Inserir dados do JSON nas tabelas SQLite
            // Precisamos mapear genéricamente ou tabela a tabela.
            const insertMany = (tableName, rows) => {
                if (!rows || rows.length === 0) return;
                // Filtrar keys que não existem no banco? O ideal é só inserir as chaves que vieram.
                // Mas campos como _offline devem ser ignorados se não existirem no schema.
                const validColumnsMap = {
                    categories: ['id', 'name', 'type', 'active'],
                    suppliers: ['id', 'cnpj', 'company_name', 'trade_name', 'phone', 'address', 'active'],
                    customers: ['id', 'name', 'document', 'phone', 'address', 'active'],
                    products: ['id', 'category_id', 'barcode', 'internal_code', 'name', 'description', 'brand', 'cost_price', 'sale_price', 'min_stock', 'current_stock', 'unit_type', 'active', 'image_path'],
                    sales: ['id', 'uuid', 'user_id', 'customer_id', 'subtotal', 'discount_amount', 'total', 'status', 'created_at', 'cash_received', 'cash_change'],
                    sale_items: ['id', 'sale_id', 'product_id', 'quantity', 'unit_price', 'discount', 'total'],
                    payments: ['id', 'sale_id', 'method', 'amount', 'created_at'],
                    cash_registers: ['id', 'uuid', 'user_id', 'opening_balance', 'closing_balance', 'status', 'opened_at', 'closed_at', 'closing_notes'],
                    cash_movements: ['id', 'uuid', 'cash_register_id', 'cash_register_uuid', 'type', 'amount', 'reason', 'created_at'],
                    transactions: ['id', 'type', 'description', 'amount', 'due_date', 'status', 'category_id', 'bank_account_id', 'amount_paid', 'created_at', 'updated_at'],
                    stock_movements: ['id', 'product_id', 'type', 'quantity', 'reason', 'created_at']
                };

                const cols = validColumnsMap[tableName];
                if (!cols) return;

                const placeholders = cols.map(() => '?').join(',');
                const stmt = db.prepare(`INSERT INTO ${tableName} (${cols.join(',')}) VALUES (${placeholders})`);

                for (const row of rows) {
                    const values = cols.map(c => row[c] !== undefined ? row[c] : null);
                    stmt.run(...values);
                }
            };

            // A ordem de inserção importa para as chaves estrangeiras depois (embora estejam OFF agora, é boa prática)
            insertMany('categories', backupData.data.categories);
            insertMany('suppliers', backupData.data.suppliers);
            insertMany('customers', backupData.data.customers);
            insertMany('products', backupData.data.products);
            insertMany('sales', backupData.data.sales);
            insertMany('sale_items', backupData.data.sale_items);
            insertMany('payments', backupData.data.payments);
            insertMany('cash_registers', backupData.data.cash_registers);
            insertMany('cash_movements', backupData.data.cash_movements);
            insertMany('transactions', backupData.data.transactions);
            insertMany('stock_movements', backupData.data.stock_movements);

            // 5. Reativar chaves
            db.pragma('foreign_keys = ON');
            
            db.prepare("INSERT INTO activity_log (user_id, action, entity, description) VALUES (?,'restore_migration','settings','Restauração de Backup do Celular (100%) concluída')").run(req.session.userId);

        })(); // Fim da transaction

        res.json({ success: true, message: 'Banco de dados restaurado e sincronizado!' });
    } catch (e) {
        console.error('Erro no Restore:', e);
        // Garantir que foreign keys volte ao normal em caso de erro
        getDatabase().pragma('foreign_keys = ON');
        res.status(500).json({ success: false, message: 'Falha crítica ao restaurar: ' + e.message });
    }
});

module.exports = router;

const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
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
router.get('/permissions', requireAdmin, async (req, res) => {
    try {
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
        const permissions = row && row.value ? JSON.parse(row.value) : DEFAULT_PERMISSIONS;
        res.json({ success: true, data: permissions });
    } catch (e) {
        res.json({ success: true, data: DEFAULT_PERMISSIONS });
    }
});

/** PUT /api/settings/permissions */
router.put('/permissions', requireAdmin, async (req, res) => {
    try {
        const { permissions } = req.body;
        if (!permissions) return res.status(400).json({ success: false, message: 'Permiss\u00f5es n\u00e3o informadas.' });
        for (const key of Object.keys(permissions)) {
            permissions[key].admin = true;
        }
        
        const { data: existing } = await supabase.from('app_settings').select('key').eq('key', 'permissions').maybeSingle();
        if (existing) {
            await supabase.from('app_settings').update({ value: JSON.stringify(permissions) }).eq('key', 'permissions');
        } else {
            await supabase.from('app_settings').insert({ key: 'permissions', value: JSON.stringify(permissions) });
        }
        
        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'update_permissions', entity: 'settings', description: 'Permissões atualizadas'
        });
        res.json({ success: true, message: 'Permiss\u00f5es salvas com sucesso!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro ao salvar permiss\u00f5es.' });
    }
});

/** GET /api/settings/store */
router.get('/store', async (req, res) => {
    try {
        const keys = ['store_name', 'store_logo', 'store_cnpj', 'store_phone', 'store_address', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'];
        const { data: rows } = await supabase.from('app_settings').select('key, value').in('key', keys);
        const data = {};
        keys.forEach(k => data[k] = '');
        (rows || []).forEach(r => data[r.key] = r.value);
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao carregar configura\u00e7\u00f5es.' }); }
});

/** PUT /api/settings/store */
router.put('/store', requireAdmin, async (req, res) => {
    try {
        const { store_name, store_logo, store_cnpj, store_phone, store_address, smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;
        
        const updates = [
            { key: 'store_name', value: store_name || '' },
            { key: 'store_cnpj', value: store_cnpj || '' },
            { key: 'store_phone', value: store_phone || '' },
            { key: 'store_address', value: store_address || '' },
            { key: 'smtp_host', value: smtp_host || '' },
            { key: 'smtp_port', value: smtp_port || '' },
            { key: 'smtp_user', value: smtp_user || '' },
            { key: 'smtp_pass', value: smtp_pass || '' }
        ];
        if (store_logo !== undefined) updates.push({ key: 'store_logo', value: store_logo || '' });

        for (const item of updates) {
            const { data: ex } = await supabase.from('app_settings').select('key').eq('key', item.key).maybeSingle();
            if (ex) {
                await supabase.from('app_settings').update({ value: item.value }).eq('key', item.key);
            } else {
                await supabase.from('app_settings').insert(item);
            }
        }
        res.json({ success: true, message: 'Dados da loja salvos!' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erro ao salvar dados da loja.' }); }
});

/** GET /api/settings/check-permission/:key */
router.get('/check-permission/:key', async (req, res) => {
    try {
        const role = req.session.role;
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
        const permissions = row && row.value ? JSON.parse(row.value) : DEFAULT_PERMISSIONS;
        const perm = permissions[req.params.key];
        const allowed = perm ? (perm[role] === true) : (role === 'admin');
        res.json({ success: true, allowed });
    } catch (e) { res.json({ success: true, allowed: req.session.role === 'admin' }); }
});

/** POST /api/settings/backup */
router.post('/backup', requireAdmin, async (req, res) => {
    res.status(500).json({ success: false, message: 'A operação de backup local não é mais suportada na infraestrutura em nuvem.' });
});

/** POST /api/settings/restore-analyze */
router.post('/restore-analyze', requireAdmin, (req, res) => {
    res.status(500).json({ success: false, message: 'A operação de restauração não é mais suportada na infraestrutura em nuvem.' });
});

/** POST /api/settings/restore-execute */
router.post('/restore-execute', requireAdmin, (req, res) => {
    res.status(500).json({ success: false, message: 'A operação de restauração não é mais suportada na infraestrutura em nuvem.' });
});

/** POST /api/settings/factory-reset */
const bcrypt = require('bcrypt');
router.post('/factory-reset', requireAdmin, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Senha é obrigatória.' });
        }

        // Validate admin password
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user) {
            return res.status(401).json({ success: false, message: 'Erro ao validar administrador.' });
        }

        const passwordValid = bcrypt.compareSync(password, user.password_hash);
        if (!passwordValid) {
            return res.status(403).json({ success: false, message: 'Senha incorreta.' });
        }

        // Call the RPC function to reset the database
        const { error: rpcError } = await supabase.rpc('factory_reset');
        
        if (rpcError) {
            console.error('RPC Error:', rpcError);
            return res.status(500).json({ success: false, message: 'A função factory_reset não foi encontrada no banco de dados. Veja as instruções para criá-la.' });
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'factory_reset',
            description: 'Reset de fábrica realizado com sucesso'
        });

        res.json({ success: true, message: 'Dados resetados com sucesso! Os logins foram preservados.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Erro interno ao realizar reset de fábrica.' });
    }
});

module.exports = router;

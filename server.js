const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const config = require('./server/config');
const pkg = require('./package.json');
const supabase = require('./server/database/supabase');
const bcrypt = require('bcrypt');

const app = express();

// =============================================
// MIDDLEWARE
// =============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sessão (secret dinâmico, gerado no primeiro boot e persistido no DB)
async function getSessionSecret() {
    try {
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'session_secret').maybeSingle();
        if (row && row.value) return row.value;
        const secret = crypto.randomBytes(48).toString('hex');
        await supabase.from('app_settings').upsert({ key: 'session_secret', value: secret }, { onConflict: 'key' });
        console.log('🔐 Session secret gerado e persistido.');
        return secret;
    } catch {
        return config.session.secret; // fallback
    }
}

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Transações Recorrentes
const { startRecurrenceScheduler } = require('./server/utils/recurrence');
startRecurrenceScheduler();

// =============================================
// INICIAR SERVIDOR
// =============================================
(async () => {
    // Inicializar usuário admin padrão caso não exista
    try {
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (!error && count === 0) {
            console.log('🔄 Banco de dados vazio. Criando usuário administrador padrão...');
            const defaultAdmin = (config.store && config.store.defaultAdmin) || {};
            const passwordHash = bcrypt.hashSync(defaultAdmin.password || 'StockCell@2026', 12);
            await supabase.from('users').insert({
                username: defaultAdmin.username || 'admin',
                password_hash: passwordHash,
                full_name: defaultAdmin.fullName || 'Administrador',
                role: 'admin',
                active: true
            });
            console.log('✅ Usuário admin padrão criado com sucesso.');
        }
    } catch (err) {
        console.error('⚠️ Erro ao verificar/criar usuário admin padrão:', err.message);
    }

    const secret = await getSessionSecret();
    
    app.use(session({
        name: config.session.name || 'stockcell_session',
        keys: [secret],
        maxAge: config.session.maxAge || 24 * 60 * 60 * 1000, // 24 hours by default
        httpOnly: true,
        sameSite: 'lax',
    }));

    app.use('/api/auth', require('./server/routes/auth'));
    app.use('/api/categories', require('./server/routes/categories'));
    app.use('/api/products', require('./server/routes/products'));
    app.use('/api/suppliers', require('./server/routes/suppliers'));
    app.use('/api/search', require('./server/routes/search'));
    app.use('/api/sales', require('./server/routes/sales'));
    app.use('/api/stock', require('./server/routes/stock'));
    app.use('/api/purchases', require('./server/routes/purchases'));
    app.use('/api/users', require('./server/routes/users'));
    app.use('/api/customers', require('./server/routes/customers'));
    app.use('/api/dashboard', require('./server/routes/dashboard'));
    app.use('/api/receipts', require('./server/routes/receipts'));
    app.use('/api/settings', require('./server/routes/settings'));
    app.use('/api/finance', require('./server/routes/finance'));
    app.use('/api/accounts', require('./server/routes/accounts'));
    app.use('/api/reports', require('./server/routes/reports'));
    app.use('/api/cashregister', require('./server/routes/cashregister'));
    app.use('/api/sync', require('./server/routes/sync'));
    app.use('/api/logs', require('./server/routes/logs'));
    app.use('/api/os', require('./server/routes/os'));

    app.get('/api/system/info', (req, res) => {
        res.json({ success: true, data: { version: pkg.version } });
    });

    // Rota catch-all para SPA - retorna index.html
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });

    const server = app.listen(config.port, config.host, () => {
        const interfaces = os.networkInterfaces();
        let localIP = 'N/A';

        for (const iface of Object.values(interfaces)) {
            for (const alias of iface) {
                if (alias.family === 'IPv4' && !alias.internal) {
                    localIP = alias.address;
                    break;
                }
            }
        }

        const ver = `v${pkg.version}`;
        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log(`║          📱 StockCell ${ver.padEnd(22)}║`);
        console.log('║   Sistema de Gestão de Vendas e Estoque      ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║  🖥️  PC:      http://localhost:${config.port}          ║`);
        console.log(`║  📱 Celular: http://${localIP}:${config.port}    ║`);
        console.log(`║  📱 Tablet:  http://${localIP}:${config.port}    ║`);
        console.log('╠══════════════════════════════════════════════╣');
        console.log('║  👤 Login:   admin / StockCell@2026          ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
    });

    // Shutdown graceful
    process.on('SIGINT', () => {
        console.log('\n🔴 Encerrando StockCell...');
        server.close(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
        server.close(() => process.exit(0));
    });
})();

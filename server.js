const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const config = require('./server/config');
const pkg = require('./package.json');
const { initDatabase, getDatabase, closeDatabase } = require('./server/database/init');
const { seedDatabase } = require('./server/database/seeds');

const app = express();

// =============================================
// MIDDLEWARE
// =============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sessão (secret dinâmico, gerado no primeiro boot e persistido no DB)
function getSessionSecret() {
    try {
        const db = getDatabase();
        const row = db.prepare("SELECT value FROM app_settings WHERE key = 'session_secret'").get();
        if (row && row.value) return row.value;
        const secret = crypto.randomBytes(48).toString('hex');
        db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('session_secret', ?)").run(secret);
        console.log('🔐 Session secret gerado e persistido.');
        return secret;
    } catch {
        return config.session.secret; // fallback
    }
}

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// =============================================
// INICIALIZAR BANCO DE DADOS
// =============================================
const db = initDatabase();

// Sessão (após DB init para poder ler o secret)
app.use(session({
    secret: getSessionSecret(),
    name: config.session.name,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: config.session.maxAge,
        httpOnly: true,
        sameSite: 'lax',
    },
}));
seedDatabase(db);

// Backup automático
const { startBackupScheduler } = require('./server/utils/backup');
startBackupScheduler(db);

// Transações Recorrentes
const { startRecurrenceScheduler } = require('./server/utils/recurrence');
startRecurrenceScheduler();

// =============================================
// ROTAS DA API
// =============================================
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

// =============================================
// INICIAR SERVIDOR
// =============================================
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
    closeDatabase();
    server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
    closeDatabase();
    server.close(() => process.exit(0));
});

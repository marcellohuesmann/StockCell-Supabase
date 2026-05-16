const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db = null;

/**
 * Inicializa o banco de dados SQLite
 * Cria as tabelas se não existirem
 */
function initDatabase() {
    // Garante que a pasta data/ exista
    const dataDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Garante que a pasta de backups exista
    if (!fs.existsSync(config.backup.localPath)) {
        fs.mkdirSync(config.backup.localPath, { recursive: true });
    }

    // Garante que a pasta de uploads exista
    if (!fs.existsSync(config.uploads.path)) {
        fs.mkdirSync(config.uploads.path, { recursive: true });
    }

    // Abre/cria o banco de dados
    db = new Database(config.dbPath);

    // Configurações de performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // Executa o schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Migrations - add columns/tables safely for existing databases
    try { db.exec("ALTER TABLE sales ADD COLUMN uuid TEXT"); } catch (e) { /* column already exists */ }
    try { db.exec("ALTER TABLE sales ADD COLUMN cash_received REAL DEFAULT 0"); } catch (e) { /* column already exists */ }
    try { db.exec("ALTER TABLE sales ADD COLUMN cash_change REAL DEFAULT 0"); } catch (e) { /* column already exists */ }
    try { db.exec("ALTER TABLE cash_register ADD COLUMN uuid TEXT"); } catch (e) { /* column already exists */ }
    try { db.exec("ALTER TABLE cash_movements ADD COLUMN uuid TEXT"); } catch (e) { /* column already exists */ }
    
    // Migrations Phase 5
    try { db.exec("ALTER TABLE products ADD COLUMN track_serial INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE products ADD COLUMN unit_type TEXT DEFAULT 'un'"); } catch (e) {}
    
    // Migration: Add category_id to transactions if missing
    try {
        const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
        const hasCategoryId = tableInfo.some(col => col.name === 'category_id');
        if (!hasCategoryId) {
            db.prepare("ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES transaction_categories(id) ON DELETE SET NULL").run();
            console.log('Migration: Adicionada coluna category_id na tabela transactions.');
        }

        const hasPaidAmount = tableInfo.some(col => col.name === 'paid_amount');
        if (!hasPaidAmount) {
            db.prepare("ALTER TABLE transactions ADD COLUMN paid_amount REAL DEFAULT 0").run();
            // Set paid_amount = amount for already completed transactions
            db.prepare("UPDATE transactions SET paid_amount = amount WHERE status = 'completed'").run();
            console.log('Migration: Adicionada coluna paid_amount na tabela transactions.');
            
            // Create transaction_payments table if it doesn't exist
            db.prepare(`
                CREATE TABLE IF NOT EXISTS transaction_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                    amount REAL NOT NULL,
                    payment_method TEXT,
                    payment_date TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            `).run();
            console.log('Migration: Tabela transaction_payments garantida.');
        }

        // Migration Phase 4 Final: Barcodes and Attachments
        const hasBarcode = tableInfo.some(col => col.name === 'barcode');
        if (!hasBarcode) {
            db.prepare("ALTER TABLE transactions ADD COLUMN barcode TEXT").run();
            console.log('Migration: Adicionada coluna barcode na tabela transactions.');
        }

        const hasAttachment = tableInfo.some(col => col.name === 'attachment_path');
        if (!hasAttachment) {
            db.prepare("ALTER TABLE transactions ADD COLUMN attachment_path TEXT").run();
            console.log('Migration: Adicionada coluna attachment_path na tabela transactions.');
        }
    } catch (e) {
        console.warn('Migração transactions warning:', e.message);
    }

    // Migration: recreate transactions if CHECK constraint doesn't allow 'partial'
    try {
        const testStmt = db.prepare("INSERT INTO transactions (type, description, amount, paid_amount, status, due_date) VALUES ('income', 'test', 0, 0, 'partial', '2000-01-01')");
        try {
            testStmt.run();
            db.exec("DELETE FROM transactions WHERE description = 'test' AND status = 'partial'");
        } catch (err) {
            console.log('Migration: Recriando tabela transactions para suportar status partial...');
            db.exec(`
                CREATE TABLE transactions_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category_id INTEGER REFERENCES transaction_categories(id) ON DELETE SET NULL,
                    type TEXT NOT NULL CHECK(type IN ('income','expense')),
                    description TEXT NOT NULL,
                    amount REAL NOT NULL,
                    paid_amount REAL DEFAULT 0,
                    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','partial','completed')),
                    due_date TEXT NOT NULL,
                    payment_date TEXT,
                    payment_method TEXT,
                    reference_id INTEGER,
                    reference_type TEXT,
                    notes TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime')),
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                );
                INSERT INTO transactions_new 
                (id, category_id, type, description, amount, paid_amount, status, due_date, payment_date, payment_method, reference_id, reference_type, notes, created_at, updated_at) 
                SELECT 
                id, category_id, type, description, amount, paid_amount, status, due_date, payment_date, payment_method, reference_id, reference_type, notes, created_at, updated_at 
                FROM transactions;
                DROP TABLE transactions;
                ALTER TABLE transactions_new RENAME TO transactions;
                CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(due_date);
                CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
            `);
            console.log('Migration: Tabela transactions recriada com sucesso.');
        }
    } catch (e) {
        console.error('Migration error on recreate transactions:', e.message);
    }

    // Migration: add 'cash' to payments.method CHECK constraint
    // SQLite doesn't allow ALTER CHECK, so recreate the table if needed
    try {
        // Test if 'cash' is already accepted
        const testStmt = db.prepare("INSERT INTO payments (sale_id, method, amount) VALUES (0, 'cash', 0)");
        try {
            testStmt.run();
            db.exec("DELETE FROM payments WHERE sale_id = 0 AND amount = 0");
        } catch (checkErr) {
            // 'cash' not in CHECK → recreate table
            db.exec(`
                CREATE TABLE payments_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    method TEXT NOT NULL CHECK(method IN ('pix','debit','credit','cash','store_credit')),
                    amount REAL NOT NULL,
                    reference TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );
                INSERT INTO payments_new SELECT * FROM payments;
                DROP TABLE payments;
                ALTER TABLE payments_new RENAME TO payments;
                CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
            `);
            console.log('🔄 Migration: payments table updated (cash method added)');
        }
    } catch (e) { /* migration already done or table empty */ }

    // Migration: create cash_movements table
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS cash_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cash_register_id INTEGER NOT NULL REFERENCES cash_register(id),
                type TEXT NOT NULL CHECK(type IN ('withdraw','supply')),
                amount REAL NOT NULL,
                reason TEXT,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
        `);
    } catch (e) { /* already exists */ }

    // Migration: create bank_accounts table and default accounts
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('cash','checking','savings','credit_card','other')),
                initial_balance REAL DEFAULT 0,
                current_balance REAL DEFAULT 0,
                color TEXT DEFAULT '#808080',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
        `);
        
        // Insert default accounts if none exist
        const count = db.prepare("SELECT COUNT(*) as count FROM bank_accounts").get().count;
        if (count === 0) {
            db.exec(`
                INSERT INTO bank_accounts (name, type, color) VALUES ('Caixa Físico', 'cash', '#32CD32');
                INSERT INTO bank_accounts (name, type, color) VALUES ('Conta Principal', 'checking', '#1E90FF');
            `);
            console.log('🔄 Migration: Default bank accounts created');
        }
    } catch (e) { console.error('Migration error on bank_accounts:', e.message); }

    // Migration: add account_id to transaction_payments
    try {
        db.exec("ALTER TABLE transaction_payments ADD COLUMN account_id INTEGER REFERENCES bank_accounts(id)");
        console.log('🔄 Migration: account_id added to transaction_payments');
    } catch (e) {
        // Ignora se a coluna já existir
    }

    console.log('✅ Banco de dados inicializado:', config.dbPath);

    return db;
}

/**
 * Retorna a instância do banco de dados
 */
function getDatabase() {
    if (!db) {
        throw new Error('Banco de dados não inicializado. Chame initDatabase() primeiro.');
    }
    return db;
}

/**
 * Fecha a conexão com o banco de dados
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log('🔒 Banco de dados fechado.');
    }
}

module.exports = { initDatabase, getDatabase, closeDatabase };

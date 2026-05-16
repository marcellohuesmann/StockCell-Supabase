-- =============================================
-- StockCell - Schema do Banco de Dados
-- Sistema de Gestão de Vendas e Estoque
-- =============================================

-- Habilitar chaves estrangeiras
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =============================================
-- USUÁRIOS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('admin','operator')),
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- CATEGORIAS DE PRODUTOS
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📦',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- PRODUTOS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    internal_code TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    compatible_model TEXT,
    category_id INTEGER REFERENCES categories(id),
    cost_price REAL DEFAULT 0,
    sale_price REAL NOT NULL,
    min_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    unit_type TEXT DEFAULT 'un',
    active INTEGER DEFAULT 1,
    image_path TEXT,
    track_serial INTEGER DEFAULT 0,
    is_service INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- =============================================
-- CLIENTES
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    cpf TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);

-- =============================================
-- FORNECEDORES
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    cnpj TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- VENDAS
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    customer_id INTEGER REFERENCES customers(id),
    subtotal REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
    -- Campos NF-e (futuro)
    nfe_status TEXT DEFAULT 'none' CHECK(nfe_status IN ('none','pending','issued','cancelled')),
    nfe_number TEXT,
    nfe_key TEXT,
    nfe_xml TEXT,
    notes TEXT,
    uuid TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- =============================================
-- ITENS DE VENDA
-- =============================================
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    discount REAL DEFAULT 0,
    total REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- =============================================
-- PAGAMENTOS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK(method IN ('pix','debit','credit','cash','store_credit')),
    amount REAL NOT NULL,
    reference TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- =============================================
-- CONTAS BANCÁRIAS / CAIXAS
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash','checking','savings','credit_card','other')),
    initial_balance REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    color TEXT DEFAULT '#808080',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- CATEGORIAS FINANCEIRAS (PLANO DE CONTAS)
-- =============================================
CREATE TABLE IF NOT EXISTS transaction_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    color TEXT DEFAULT '#808080',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- FINANCEIRO (CONTAS A PAGAR/RECEBER)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
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
    barcode TEXT,
    attachment_path TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS transaction_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES bank_accounts(id),
    amount REAL NOT NULL,
    payment_method TEXT,
    payment_date TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    category_id INTEGER REFERENCES transaction_categories(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    day_of_month INTEGER NOT NULL CHECK(day_of_month >= 1 AND day_of_month <= 31),
    last_generated_month TEXT, -- Formato 'YYYY-MM'
    status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- MOVIMENTAÇÕES DE ESTOQUE
-- =============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('entry','exit','adjustment')),
    quantity INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    reference_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- =============================================
-- ASSISTÊNCIA TÉCNICA (ORDENS DE SERVIÇO)
-- =============================================
CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    device_model TEXT NOT NULL,
    device_serial TEXT,
    device_password TEXT,
    reported_defect TEXT NOT NULL,
    technical_report TEXT,
    status TEXT DEFAULT 'budgeting' CHECK(status IN ('budgeting','waiting_parts','approved','in_repair','ready','delivered','cancelled')),
    total_parts REAL DEFAULT 0,
    total_labor REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS os_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    os_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK(item_type IN ('product','service')),
    product_id INTEGER REFERENCES products(id),
    description TEXT NOT NULL,
    serial_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);

-- =============================================
-- PEDIDOS DE COMPRA
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    user_id INTEGER REFERENCES users(id),
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','received','cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- ITENS DE PEDIDO DE COMPRA
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    total REAL NOT NULL
);

-- =============================================
-- CONTROLE DE CAIXA
-- =============================================
CREATE TABLE IF NOT EXISTS cash_register (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    opening_balance REAL DEFAULT 0,
    closing_balance REAL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','closed')),
    opened_at TEXT DEFAULT (datetime('now','localtime')),
    closed_at TEXT,
    notes TEXT
);

-- =============================================
-- MOVIMENTAÇÕES DE CAIXA (Sangria / Suprimento)
-- =============================================
CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cash_register_id INTEGER NOT NULL REFERENCES cash_register(id),
    type TEXT NOT NULL CHECK(type IN ('withdraw','supply')),
    amount REAL NOT NULL,
    reason TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- LOG DE ATIVIDADES
-- =============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- =============================================
-- FASE 5: ESTOQUE AVANÇADO E O.S.
-- =============================================

CREATE TABLE IF NOT EXISTS product_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    barcode TEXT,
    additional_price REAL DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS product_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'sold', 'in_maintenance', 'defective')),
    purchase_date TEXT,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    device_info TEXT NOT NULL,
    defect_reported TEXT NOT NULL,
    device_password TEXT,
    technical_report TEXT,
    internal_notes TEXT,
    status TEXT DEFAULT 'budgeting' CHECK(status IN ('budgeting', 'waiting_parts', 'approved', 'repairing', 'ready', 'delivered', 'cancelled')),
    total_amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS os_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    os_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    is_service INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at);

-- =============================================
-- CONFIGURAÇÕES DO SISTEMA
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
);

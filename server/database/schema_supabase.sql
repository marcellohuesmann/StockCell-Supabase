-- =============================================
-- StockCell - Schema PostgreSQL para Supabase
-- Migração de SQLite → PostgreSQL
-- =============================================

-- =============================================
-- USUÁRIOS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('admin','operator')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CATEGORIAS DE PRODUTOS
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📦',
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUTOS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    barcode TEXT UNIQUE,
    internal_code TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    compatible_model TEXT,
    category_id BIGINT REFERENCES categories(id),
    cost_price NUMERIC(12,2) DEFAULT 0,
    sale_price NUMERIC(12,2) NOT NULL,
    min_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    unit_type TEXT DEFAULT 'un',
    active BOOLEAN DEFAULT TRUE,
    image_path TEXT,
    track_serial BOOLEAN DEFAULT FALSE,
    is_service BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- =============================================
-- CLIENTES
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    cpf TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);

-- =============================================
-- FORNECEDORES
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    cnpj TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- VENDAS
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    customer_id BIGINT REFERENCES customers(id),
    subtotal NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
    nfe_status TEXT DEFAULT 'none' CHECK(nfe_status IN ('none','pending','issued','cancelled')),
    nfe_number TEXT,
    nfe_key TEXT,
    nfe_xml TEXT,
    notes TEXT,
    uuid TEXT,
    cash_received NUMERIC(12,2) DEFAULT 0,
    cash_change NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- =============================================
-- ITENS DE VENDA
-- =============================================
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- =============================================
-- PAGAMENTOS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK(method IN ('pix','debit','credit','cash','store_credit')),
    amount NUMERIC(12,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- =============================================
-- CONTAS BANCÁRIAS / CAIXAS
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cash','checking','savings','credit_card','other')),
    initial_balance NUMERIC(12,2) DEFAULT 0,
    current_balance NUMERIC(12,2) DEFAULT 0,
    color TEXT DEFAULT '#808080',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CATEGORIAS FINANCEIRAS (PLANO DE CONTAS)
-- =============================================
CREATE TABLE IF NOT EXISTS transaction_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    color TEXT DEFAULT '#808080',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FINANCEIRO (CONTAS A PAGAR/RECEBER)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES transaction_categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','partial','completed')),
    due_date DATE NOT NULL,
    payment_date DATE,
    payment_method TEXT,
    reference_id BIGINT,
    reference_type TEXT,
    notes TEXT,
    barcode TEXT,
    attachment_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_payments (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES bank_accounts(id),
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT,
    payment_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- =============================================
-- TRANSAÇÕES RECORRENTES
-- =============================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    category_id BIGINT REFERENCES transaction_categories(id) ON DELETE SET NULL,
    account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    day_of_month INTEGER NOT NULL CHECK(day_of_month >= 1 AND day_of_month <= 31),
    last_generated_month TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MOVIMENTAÇÕES DE ESTOQUE
-- =============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    user_id BIGINT REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('entry','exit','adjustment')),
    quantity INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    reference_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- =============================================
-- ORDENS DE SERVIÇO
-- =============================================
CREATE TABLE IF NOT EXISTS service_orders (
    id BIGSERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    device_info TEXT NOT NULL,
    defect_reported TEXT NOT NULL,
    device_password TEXT,
    technical_report TEXT,
    internal_notes TEXT,
    status TEXT DEFAULT 'budgeting' CHECK(status IN ('budgeting','waiting_parts','approved','repairing','ready','delivered','cancelled')),
    total_amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS os_items (
    id BIGSERIAL PRIMARY KEY,
    os_id BIGINT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    is_service BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);

-- =============================================
-- PEDIDOS DE COMPRA
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT REFERENCES suppliers(id),
    user_id BIGINT REFERENCES users(id),
    total NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','received','cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL
);

-- =============================================
-- CONTROLE DE CAIXA
-- =============================================
CREATE TABLE IF NOT EXISTS cash_register (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    opening_balance NUMERIC(12,2) DEFAULT 0,
    closing_balance NUMERIC(12,2),
    status TEXT DEFAULT 'open' CHECK(status IN ('open','closed')),
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    uuid TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id BIGSERIAL PRIMARY KEY,
    cash_register_id BIGINT NOT NULL REFERENCES cash_register(id),
    type TEXT NOT NULL CHECK(type IN ('withdraw','supply')),
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT,
    user_id BIGINT REFERENCES users(id),
    uuid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- VARIAÇÕES E SERIAIS DE PRODUTO
-- =============================================
CREATE TABLE IF NOT EXISTS product_variations (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    attribute_value TEXT NOT NULL,
    barcode TEXT,
    additional_price NUMERIC(12,2) DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_serials (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'available' CHECK(status IN ('available','sold','in_maintenance','defective')),
    purchase_date DATE,
    sale_id BIGINT REFERENCES sales(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LOG DE ATIVIDADES
-- =============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id BIGINT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at);

-- =============================================
-- CONFIGURAÇÕES DO SISTEMA
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DADOS INICIAIS
-- =============================================
INSERT INTO bank_accounts (name, type, color)
SELECT 'Caixa Físico', 'cash', '#32CD32'
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts WHERE name = 'Caixa Físico');

INSERT INTO bank_accounts (name, type, color)
SELECT 'Conta Principal', 'checking', '#1E90FF'
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts WHERE name = 'Conta Principal');

const bcrypt = require('bcrypt');
const config = require('../config');

/**
 * Insere dados iniciais no banco de dados
 * Só insere se os dados ainda não existirem
 */
function seedDatabase(db) {
    // =============================================
    // Usuário administrador padrão
    // =============================================
    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(config.store.defaultAdmin.username);

    if (!existingAdmin) {
        const passwordHash = bcrypt.hashSync(config.store.defaultAdmin.password, 12);
        db.prepare(`
            INSERT INTO users (username, password_hash, full_name, role)
            VALUES (?, ?, ?, 'admin')
        `).run(
            config.store.defaultAdmin.username,
            passwordHash,
            config.store.defaultAdmin.fullName
        );
        console.log('👤 Usuário admin criado (admin / StockCell@2026)');
    }

    // =============================================
    // Configurações padrão da loja
    // =============================================
    const defaultSettings = [
        ['store_name', 'StockCell'],
        ['store_cnpj', ''],
        ['store_address', ''],
        ['store_phone', ''],
        ['store_email', ''],
        ['currency', 'BRL'],
        ['timezone', 'America/Sao_Paulo'],
        ['nfe_enabled', 'false'],
        ['backup_auto', 'true'],
        ['backup_interval_hours', '4'],
        ['receipt_header', 'StockCell - Acessórios para Celular'],
        ['receipt_footer', 'Obrigado pela preferência!'],
        ['low_stock_alert', '5'],
    ];

    const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)
    `);

    const insertMany = db.transaction((settings) => {
        for (const [key, value] of settings) {
            insertSetting.run(key, value);
        }
    });

    insertMany(defaultSettings);

    // =============================================
    // Categorias Financeiras (Plano de Contas) Padrão
    // =============================================
    const defaultCategories = [
        ['Vendas de Produtos', 'income', '#4caf50'],
        ['Serviços', 'income', '#8bc34a'],
        ['Outras Receitas', 'income', '#cddc39'],
        ['Água', 'expense', '#2196f3'],
        ['Energia Elétrica', 'expense', '#ff9800'],
        ['Telefone/Internet', 'expense', '#9c27b0'],
        ['Aluguel', 'expense', '#795548'],
        ['Fornecedores', 'expense', '#f44336'],
        ['Salários', 'expense', '#e91e63'],
        ['Impostos', 'expense', '#ff5722'],
        ['Outras Despesas', 'expense', '#607d8b']
    ];

    const categoryCount = db.prepare('SELECT count(*) as cnt FROM transaction_categories').get().cnt;
    if (categoryCount === 0) {
        const insertCategory = db.prepare('INSERT INTO transaction_categories (name, type, color) VALUES (?, ?, ?)');
        const insertManyCategories = db.transaction((cats) => {
            for (const [name, type, color] of cats) {
                insertCategory.run(name, type, color);
            }
        });
        insertManyCategories(defaultCategories);
        console.log('🏷️  Categorias financeiras padrão inseridas');
    }

    console.log('⚙️  Configurações padrão inseridas');
}

module.exports = { seedDatabase };

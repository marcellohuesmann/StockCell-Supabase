const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/** GET /api/dashboard */
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // Vendas de hoje
        const todaySales = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM sales WHERE DATE(created_at) = ? AND status = 'completed'").get(today);

        // Vendas do mês
        const monthStart = today.substring(0, 8) + '01';
        const monthSales = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM sales WHERE DATE(created_at) >= ? AND status = 'completed'").get(monthStart);

        // Produtos
        const productStats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN is_service = 0 AND current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock FROM products WHERE active = 1").get();

        // Estoque valor (ignora serviços)
        const stockValue = db.prepare("SELECT COALESCE(SUM(current_stock * sale_price),0) as sale_value, COALESCE(SUM(current_stock * cost_price),0) as cost_value FROM products WHERE active = 1 AND is_service = 0").get();

        // Clientes
        const customerCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE active = 1").get().count;

        // Últimas 5 vendas
        const recentSales = db.prepare(`
            SELECT s.id, s.total, s.status, s.created_at, u.full_name as user_name, c.name as customer_name
            FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.created_at DESC LIMIT 5
        `).all();

        // Top 5 produtos mais vendidos (mês)
        const topProducts = db.prepare(`
            SELECT p.name, SUM(si.quantity) as qty_sold, SUM(si.total) as revenue
            FROM sale_items si JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status = 'completed' AND DATE(s.created_at) >= ?
            GROUP BY si.product_id ORDER BY qty_sold DESC LIMIT 5
        `).all(monthStart);

        // Vendas por forma de pagamento (mês)
        const paymentBreakdown = db.prepare(`
            SELECT pm.method, COUNT(*) as count, COALESCE(SUM(pm.amount),0) as total
            FROM payments pm JOIN sales s ON pm.sale_id = s.id
            WHERE s.status = 'completed' AND DATE(s.created_at) >= ?
            GROUP BY pm.method
        `).all(monthStart);

        // Vendas dos últimos 7 dias (para gráfico)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayData = db.prepare("SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sales WHERE DATE(created_at) = ? AND status = 'completed'").get(dateStr);
            last7Days.push({ date: dateStr, label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }), ...dayData });
        }

        res.json({
            success: true,
            data: {
                today: { sales: todaySales.count, revenue: todaySales.total },
                month: { sales: monthSales.count, revenue: monthSales.total },
                products: { total: productStats.total, low_stock: productStats.low_stock },
                stock: { sale_value: stockValue.sale_value, cost_value: stockValue.cost_value },
                customers: customerCount,
                recent_sales: recentSales,
                top_products: topProducts,
                payment_breakdown: paymentBreakdown,
                last_7_days: last7Days,
            },
        });
    } catch (error) {
        console.error('Erro no dashboard:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar dashboard.' });
    }
});

module.exports = router;

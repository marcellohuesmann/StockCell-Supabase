const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/reports/sales
 * Relatório de vendas por período
 */
router.get('/sales', (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });
        }

        // Resumo geral
        const summary = db.prepare(`
            SELECT
                COUNT(*) as total_sales,
                COALESCE(SUM(total), 0) as revenue,
                COALESCE(AVG(total), 0) as avg_ticket,
                COALESCE(SUM(discount_amount), 0) as total_discounts
            FROM sales
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN ? AND ?
        `).get(start, end);

        // Vendas por dia (para gráfico)
        const daily = db.prepare(`
            SELECT DATE(created_at) as date,
                   COUNT(*) as count,
                   COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all(start, end);

        // Vendas por forma de pagamento
        const byPayment = db.prepare(`
            SELECT pm.method,
                   COUNT(DISTINCT pm.sale_id) as count,
                   COALESCE(SUM(pm.amount), 0) as total
            FROM payments pm
            JOIN sales s ON pm.sale_id = s.id
            WHERE s.status = 'completed'
              AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY pm.method
            ORDER BY total DESC
        `).all(start, end);

        // Lista detalhada de vendas
        const sales = db.prepare(`
            SELECT s.id, s.total, s.discount_amount, s.created_at,
                   u.full_name as user_name,
                   c.name as customer_name,
                   (
                       SELECT GROUP_CONCAT(p.name || ' (' || si.quantity || 'x)', ', ')
                       FROM sale_items si
                       JOIN products p ON si.product_id = p.id
                       WHERE si.sale_id = s.id
                   ) as products_sold,
                   (
                       SELECT GROUP_CONCAT(method, ', ')
                       FROM payments
                       WHERE sale_id = s.id
                   ) as methods
            FROM sales s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.status = 'completed'
              AND DATE(s.created_at) BETWEEN ? AND ?
            ORDER BY s.created_at DESC
        `).all(start, end);

        res.json({
            success: true,
            data: { summary, daily, byPayment, sales }
        });
    } catch (error) {
        console.error('Erro relatorio vendas:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendas.' });
    }
});

/**
 * GET /api/reports/top-products
 * Ranking de produtos mais vendidos
 */
router.get('/top-products', (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });
        }

        const products = db.prepare(`
            SELECT p.id, p.name, p.barcode, p.internal_code,
                   p.cost_price, p.sale_price, p.current_stock,
                   COALESCE(SUM(si.quantity), 0) as qty_sold,
                   COALESCE(SUM(si.total), 0) as revenue,
                   COALESCE(SUM(si.quantity * p.cost_price), 0) as total_cost
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status = 'completed'
              AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY si.product_id
            ORDER BY qty_sold DESC
        `).all(start, end);

        // Resumo
        const totalQty = products.reduce((s, p) => s + p.qty_sold, 0);
        const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
        const totalCost = products.reduce((s, p) => s + p.total_cost, 0);

        res.json({
            success: true,
            data: {
                summary: {
                    unique_products: products.length,
                    total_qty: totalQty,
                    total_revenue: totalRevenue,
                    total_cost: totalCost,
                    gross_profit: totalRevenue - totalCost
                },
                products
            }
        });
    } catch (error) {
        console.error('Erro relatorio produtos:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório de produtos.' });
    }
});

/**
 * GET /api/reports/cashflow
 * Fluxo de caixa (Receitas vs Despesas)
 */
router.get('/cashflow', (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });
        }

        // Vendas concluídas = entradas operacionais
        const salesIncome = db.prepare(`
            SELECT COALESCE(SUM(total), 0) as total
            FROM sales
            WHERE status = 'completed'
              AND DATE(created_at) BETWEEN ? AND ?
        `).get(start, end);

        // Transações do módulo financeiro
        const financeData = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END), 0) as finance_income,
                COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END), 0) as finance_expense,
                COALESCE(SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_income,
                COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_expense
            FROM transactions
            WHERE DATE(due_date) BETWEEN ? AND ?
        `).get(start, end);

        // Detalhamento por dia
        const dailyCashflow = db.prepare(`
            SELECT date, 
                   SUM(income) as income, 
                   SUM(expense) as expense
            FROM (
                SELECT DATE(created_at) as date, total as income, 0 as expense
                FROM sales
                WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
                UNION ALL
                SELECT DATE(due_date) as date, 0 as income, amount as expense
                FROM transactions
                WHERE type = 'expense' AND status = 'completed' AND DATE(due_date) BETWEEN ? AND ?
            )
            GROUP BY date
            ORDER BY date
        `).all(start, end, start, end);

        const totalIncome = salesIncome.total + financeData.finance_income;
        const totalExpense = financeData.finance_expense;

        res.json({
            success: true,
            data: {
                summary: {
                    sales_income: salesIncome.total,
                    finance_income: financeData.finance_income,
                    total_income: totalIncome,
                    total_expense: totalExpense,
                    net_balance: totalIncome - totalExpense,
                    pending_income: financeData.pending_income,
                    pending_expense: financeData.pending_expense
                },
                daily: dailyCashflow
            }
        });
    } catch (error) {
        console.error('Erro relatorio fluxo de caixa:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar fluxo de caixa.' });
    }
});

/**
 * GET /api/reports/sellers
 * Relatório de Vendas por Vendedor (Comissões/Desempenho)
 */
router.get('/sellers', (req, res) => {
    try {
        const db = getDatabase();
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });
        }

        const sellers = db.prepare(`
            SELECT u.id, u.full_name as name,
                   COUNT(s.id) as sales_count,
                   COALESCE(SUM(s.total), 0) as revenue,
                   COALESCE(SUM(s.discount_amount), 0) as total_discounts
            FROM users u
            JOIN sales s ON s.user_id = u.id
            WHERE s.status = 'completed'
              AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY u.id
            ORDER BY revenue DESC
        `).all(start, end);

        // Resumo
        const totalRevenue = sellers.reduce((s, u) => s + u.revenue, 0);
        const totalSales = sellers.reduce((s, u) => s + u.sales_count, 0);

        res.json({
            success: true,
            data: {
                summary: {
                    total_revenue: totalRevenue,
                    total_sales: totalSales
                },
                sellers
            }
        });
    } catch (error) {
        console.error('Erro relatorio vendedores:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendedores.' });
    }
});

module.exports = router;

const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/reports/sales
 * Relatório de vendas por período
 */
router.get('/sales', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });

        const endDay = new Date(end);
        endDay.setDate(endDay.getDate() + 1);

        const { data: salesRaw } = await supabase.from('sales')
            .select('*, users(full_name), customers(name), payments(method, amount), sale_items(quantity, products(name))')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lt('created_at', endDay.toISOString());
            
        const salesData = salesRaw || [];
        
        let revenue = 0;
        let total_discounts = 0;
        let dailyMap = {};
        let paymentMap = {};
        
        const sales = salesData.map(s => {
            revenue += s.total;
            total_discounts += s.discount_amount;
            
            const dateStr = s.created_at.split('T')[0];
            if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, count: 0, total: 0 };
            dailyMap[dateStr].count += 1;
            dailyMap[dateStr].total += s.total;
            
            const methods = [];
            (s.payments || []).forEach(pm => {
                if (!paymentMap[pm.method]) paymentMap[pm.method] = { method: pm.method, count: 0, total: 0 };
                paymentMap[pm.method].count += 1;
                paymentMap[pm.method].total += pm.amount;
                methods.push(pm.method);
            });
            
            const productsSold = (s.sale_items || []).map(si => `${si.products?.name} (${si.quantity}x)`).join(', ');
            
            return {
                id: s.id, total: s.total, discount_amount: s.discount_amount, created_at: s.created_at,
                user_name: s.users?.full_name,
                customer_name: s.customers?.name,
                products_sold: productsSold,
                methods: methods.join(', ')
            };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const summary = {
            total_sales: salesData.length,
            revenue: revenue,
            avg_ticket: salesData.length ? revenue / salesData.length : 0,
            total_discounts: total_discounts
        };
        
        const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        const byPayment = Object.values(paymentMap).sort((a, b) => b.total - a.total);

        res.json({ success: true, data: { summary, daily, byPayment, sales } });
    } catch (error) {
        console.error('Erro relatorio vendas:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendas.' });
    }
});

/**
 * GET /api/reports/top-products
 * Ranking de produtos mais vendidos
 */
router.get('/top-products', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });

        const endDay = new Date(end);
        endDay.setDate(endDay.getDate() + 1);

        const { data: sales } = await supabase.from('sales')
            .select('id, status, created_at, sale_items(quantity, total, product_id, products(id, name, barcode, internal_code, cost_price, sale_price, current_stock))')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lt('created_at', endDay.toISOString());

        let productMap = {};
        
        (sales || []).forEach(s => {
            (s.sale_items || []).forEach(si => {
                const p = si.products;
                if (p) {
                    if (!productMap[p.id]) {
                        productMap[p.id] = {
                            id: p.id, name: p.name, barcode: p.barcode, internal_code: p.internal_code,
                            cost_price: p.cost_price, sale_price: p.sale_price, current_stock: p.current_stock,
                            qty_sold: 0, revenue: 0, total_cost: 0
                        };
                    }
                    productMap[p.id].qty_sold += si.quantity;
                    productMap[p.id].revenue += si.total;
                    productMap[p.id].total_cost += si.quantity * p.cost_price;
                }
            });
        });
        
        const products = Object.values(productMap).sort((a, b) => b.qty_sold - a.qty_sold);
        
        const totalQty = products.reduce((s, p) => s + p.qty_sold, 0);
        const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
        const totalCost = products.reduce((s, p) => s + p.total_cost, 0);

        res.json({
            success: true,
            data: {
                summary: { unique_products: products.length, total_qty: totalQty, total_revenue: totalRevenue, total_cost: totalCost, gross_profit: totalRevenue - totalCost },
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
router.get('/cashflow', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });

        const endDay = new Date(end);
        endDay.setDate(endDay.getDate() + 1);

        const { data: sales } = await supabase.from('sales')
            .select('total, created_at')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lt('created_at', endDay.toISOString());

        const { data: transactions } = await supabase.from('transactions')
            .select('amount, type, status, due_date')
            .gte('due_date', start)
            .lte('due_date', end);

        let salesIncomeTotal = 0;
        let dailyMap = {};

        (sales || []).forEach(s => {
            salesIncomeTotal += s.total;
            const dateStr = s.created_at.split('T')[0];
            if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
            dailyMap[dateStr].income += s.total;
        });

        let finance_income = 0;
        let finance_expense = 0;
        let pending_income = 0;
        let pending_expense = 0;

        (transactions || []).forEach(t => {
            if (t.type === 'income') {
                if (t.status === 'completed') finance_income += t.amount;
                else pending_income += t.amount;
            } else if (t.type === 'expense') {
                if (t.status === 'completed') {
                    finance_expense += t.amount;
                    const dateStr = t.due_date;
                    if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
                    dailyMap[dateStr].expense += t.amount;
                }
                else pending_expense += t.amount;
            }
        });

        const dailyCashflow = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        const totalIncome = salesIncomeTotal + finance_income;
        const totalExpense = finance_expense;

        res.json({
            success: true,
            data: {
                summary: {
                    sales_income: salesIncomeTotal, finance_income, total_income: totalIncome, total_expense: totalExpense, net_balance: totalIncome - totalExpense, pending_income, pending_expense
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
router.get('/sellers', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ success: false, message: 'Informe data inicial e final.' });

        const endDay = new Date(end);
        endDay.setDate(endDay.getDate() + 1);

        const { data: sales } = await supabase.from('sales')
            .select('total, discount_amount, user_id, users(full_name)')
            .eq('status', 'completed')
            .gte('created_at', start)
            .lt('created_at', endDay.toISOString());

        let sellersMap = {};
        (sales || []).forEach(s => {
            if (!s.user_id) return;
            if (!sellersMap[s.user_id]) sellersMap[s.user_id] = { id: s.user_id, name: s.users?.full_name, sales_count: 0, revenue: 0, total_discounts: 0 };
            
            sellersMap[s.user_id].sales_count += 1;
            sellersMap[s.user_id].revenue += s.total;
            sellersMap[s.user_id].total_discounts += s.discount_amount;
        });

        const sellers = Object.values(sellersMap).sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = sellers.reduce((s, u) => s + u.revenue, 0);
        const totalSales = sellers.reduce((s, u) => s + u.sales_count, 0);

        res.json({
            success: true,
            data: { summary: { total_revenue: totalRevenue, total_sales: totalSales }, sellers }
        });
    } catch (error) {
        console.error('Erro relatorio vendedores:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar relatório de vendedores.' });
    }
});

module.exports = router;

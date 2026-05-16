const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/** GET /api/dashboard */
router.get('/', async (req, res) => {
    try {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const monthStart = today.substring(0, 8) + '01';

        const last7DaysDate = new Date();
        last7DaysDate.setDate(last7DaysDate.getDate() - 6);
        const last7DaysStr = `${last7DaysDate.getFullYear()}-${String(last7DaysDate.getMonth() + 1).padStart(2, '0')}-${String(last7DaysDate.getDate()).padStart(2, '0')}`;

        const filterStart = last7DaysStr < monthStart ? last7DaysStr : monthStart;

        const { data: monthSalesRaw } = await supabase.from('sales')
            .select('id, total, created_at, payments(method, amount), sale_items(quantity, total, product_id, products(name))')
            .eq('status', 'completed')
            .gte('created_at', filterStart);
            
        let todaySales = { count: 0, total: 0 };
        let monthSales = { count: 0, total: 0 };
        
        const last7DaysMap = {};
        for (let i = 6; i >= 0; i--) {
            const tempD = new Date(); tempD.setDate(tempD.getDate() - i);
            const dateStr = `${tempD.getFullYear()}-${String(tempD.getMonth() + 1).padStart(2, '0')}-${String(tempD.getDate()).padStart(2, '0')}`;
            last7DaysMap[dateStr] = { 
                date: dateStr, 
                label: tempD.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }), 
                count: 0, 
                total: 0 
            };
        }
        
        const paymentMap = {};
        const productMap = {};

        (monthSalesRaw || []).forEach(s => {
            const dateStr = s.created_at.split('T')[0];
            
            if (dateStr === today) {
                todaySales.count++;
                todaySales.total += s.total;
            }
            
            if (dateStr >= monthStart) {
                monthSales.count++;
                monthSales.total += s.total;
                
                (s.payments || []).forEach(pm => {
                    if (!paymentMap[pm.method]) paymentMap[pm.method] = { method: pm.method, count: 0, total: 0 };
                    paymentMap[pm.method].count++;
                    paymentMap[pm.method].total += pm.amount;
                });
                
                (s.sale_items || []).forEach(si => {
                    if (!productMap[si.product_id]) productMap[si.product_id] = { name: si.products?.name, qty_sold: 0, revenue: 0 };
                    productMap[si.product_id].qty_sold += si.quantity;
                    productMap[si.product_id].revenue += si.total;
                });
            }
            
            if (last7DaysMap[dateStr]) {
                last7DaysMap[dateStr].count++;
                last7DaysMap[dateStr].total += s.total;
            }
        });

        const { data: productsRaw } = await supabase.from('products').select('current_stock, min_stock, sale_price, cost_price, is_service').eq('active', true);
        
        let productStats = { total: 0, low_stock: 0 };
        let stockValue = { sale_value: 0, cost_value: 0 };
        
        (productsRaw || []).forEach(p => {
            productStats.total++;
            if (!p.is_service && p.current_stock <= p.min_stock) productStats.low_stock++;
            if (!p.is_service) {
                stockValue.sale_value += (p.current_stock * p.sale_price);
                stockValue.cost_value += (p.current_stock * p.cost_price);
            }
        });

        const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('active', true);

        const { data: recentSalesRaw } = await supabase.from('sales')
            .select('id, total, status, created_at, users(full_name), customers(name)')
            .order('created_at', { ascending: false })
            .limit(5);
            
        const recentSales = (recentSalesRaw || []).map(s => ({
            id: s.id, total: s.total, status: s.status, created_at: s.created_at,
            user_name: s.users?.full_name, customer_name: s.customers?.name
        }));

        const topProducts = Object.values(productMap).sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 5);
        const paymentBreakdown = Object.values(paymentMap);
        const last7Days = Object.values(last7DaysMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            success: true,
            data: {
                today: { sales: todaySales.count, revenue: todaySales.total },
                month: { sales: monthSales.count, revenue: monthSales.total },
                products: { total: productStats.total, low_stock: productStats.low_stock },
                stock: { sale_value: stockValue.sale_value, cost_value: stockValue.cost_value },
                customers: customerCount || 0,
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

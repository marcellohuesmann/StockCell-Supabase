const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/sales
 * Registra uma nova venda completa (itens + pagamentos + atualiza estoque)
 */
router.post('/', async (req, res) => {
    try {
        const { items, payments, customer_id, discount_amount, notes, cash_received, cash_change } = req.body;

        if (!items || !items.length) return res.status(400).json({ success: false, message: 'Adicione pelo menos um item.' });
        if (!payments || !payments.length) return res.status(400).json({ success: false, message: 'Informe a forma de pagamento.' });

        // Calcula totais
        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const { data: product } = await supabase.from('products').select('id, name, sale_price, current_stock, track_serial').eq('id', item.product_id).eq('active', true).maybeSingle();
            if (!product) return res.status(400).json({ success: false, message: `Produto ID ${item.product_id} não encontrado.` });
            
            if (product.track_serial && !item.serial_number) {
                return res.status(400).json({ success: false, message: `O produto "${product.name}" exige que um Número de Série/IMEI seja informado.` });
            }

            if (product.track_serial && item.serial_number) {
                const { data: serialCheck } = await supabase.from('product_serials').select('status').eq('product_id', item.product_id).eq('serial_number', item.serial_number).maybeSingle();
                if (!serialCheck) return res.status(400).json({ success: false, message: `O IMEI ${item.serial_number} não pertence ao produto "${product.name}".` });
                if (serialCheck.status !== 'available') return res.status(400).json({ success: false, message: `O IMEI ${item.serial_number} já consta como vendido ou indisponível.` });
            }

            if (product.current_stock < item.quantity) {
                return res.status(400).json({ success: false, message: `Estoque insuficiente para "${product.name}". Disponível: ${product.current_stock}` });
            }
            const itemTotal = (item.unit_price || product.sale_price) * item.quantity - (item.discount || 0);
            subtotal += itemTotal;
            processedItems.push({ ...item, unit_price: item.unit_price || product.sale_price, total: itemTotal, product_name: product.name });
        }

        const disc = discount_amount || 0;
        const total = subtotal - disc;

        // Valida pagamentos
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaid - total) > 0.01) {
            return res.status(400).json({ success: false, message: `Valor do pagamento (R$ ${totalPaid.toFixed(2)}) difere do total (R$ ${total.toFixed(2)}).` });
        }

        // 1. Cria a venda
        const { data: saleResult, error: saleError } = await supabase.from('sales').insert({
            user_id: req.session.userId,
            customer_id: customer_id || null,
            subtotal,
            discount_amount: disc,
            total,
            status: 'completed',
            notes: notes || '',
            cash_received: cash_received || 0,
            cash_change: cash_change || 0
        }).select('id').single();

        if (saleError) throw saleError;
        const saleId = saleResult.id;

        // 2. Insere itens
        for (const item of processedItems) {
            await supabase.from('sale_items').insert({
                sale_id: saleId, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price, discount: item.discount || 0, total: item.total
            });
            
            const { data: pStock } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            const newBalance = pStock.current_stock - item.quantity;
            await supabase.from('products').update({ current_stock: newBalance, updated_at: new Date().toISOString() }).eq('id', item.product_id);
            
            let reason = `Venda #${String(saleId).padStart(4,'0')}`;
            if (item.serial_number) {
                reason += ` - IMEI: ${item.serial_number}`;
                await supabase.from('product_serials').update({ status: 'sold' }).eq('product_id', item.product_id).eq('serial_number', item.serial_number);
            }

            await supabase.from('stock_movements').insert({
                product_id: item.product_id, user_id: req.session.userId, type: 'exit', quantity: item.quantity, balance_after: newBalance, reason: reason, reference_id: String(saleId)
            });
        }

        // 3. Insere pagamentos e transações de crédito
        for (const payment of payments) {
            await supabase.from('payments').insert({
                sale_id: saleId, method: payment.method, amount: payment.amount, reference: payment.reference || ''
            });
            
            if (payment.method === 'store_credit') {
                const installments = parseInt(payment.installments) || 1;
                const interval = parseInt(payment.interval_days) || 30;
                const baseAmount = payment.amount / installments;
                
                const dLoc = new Date();
                let baseDateObj = new Date(payment.due_date ? payment.due_date + 'T12:00:00' : dLoc);

                let customerName = 'Cliente';
                if (customer_id) {
                    const { data: cust } = await supabase.from('customers').select('name').eq('id', customer_id).maybeSingle();
                    if (cust) customerName = cust.name;
                }
                
                for (let i = 0; i < installments; i++) {
                    const targetDate = new Date(baseDateObj);
                    targetDate.setDate(targetDate.getDate() + (i * interval));
                    
                    const dueDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
                    
                    let desc = `Fiado: ${customerName} (Venda #${String(saleId).padStart(4,'0')})`;
                    if (installments > 1) {
                        desc += ` - Parcela ${i+1}/${installments}`;
                    }
                    await supabase.from('transactions').insert({
                        type: 'income', description: desc, amount: baseAmount, status: 'pending', due_date: dueDate, reference_id: String(saleId), reference_type: 'sale'
                    });
                }
            }
        }

        // 4. Log
        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'sale', entity: 'sale', entity_id: saleId, description: `Venda #${String(saleId).padStart(4,'0')} - ${Utils_formatCurrency(total)}`
        });

        // Retorna venda completa
        const { data: sale } = await supabase.from('sales').select('*').eq('id', saleId).single();
        const { data: saleItems } = await supabase.from('sale_items').select('*, products(name, barcode)').eq('sale_id', saleId);
        const { data: salePayments } = await supabase.from('payments').select('*').eq('sale_id', saleId);

        const formattedItems = (saleItems || []).map(si => ({
            ...si,
            product_name: si.products?.name,
            barcode: si.products?.barcode
        }));

        res.status(201).json({
            success: true,
            message: `Venda #${String(saleId).padStart(4,'0')} realizada com sucesso!`,
            data: { ...sale, items: formattedItems, payments: salePayments },
        });
    } catch (error) {
        console.error('Erro ao registrar venda:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar venda.' });
    }
});

function Utils_formatCurrency(v) { return `R$ ${v.toFixed(2).replace('.',',')}` }

/**
 * GET /api/sales
 */
router.get('/', async (req, res) => {
    try {
        const { date_from, date_to, status, limit = 50, page = 1 } = req.query;
        let query = supabase.from('sales').select('*, users(full_name), customers(name)', { count: 'exact' });

        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to + ' 23:59:59');
        if (status) query = query.eq('status', status);

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

        const { data: rawSales, error, count } = await query;
        if (error) throw error;

        const sales = (rawSales || []).map(s => ({
            ...s,
            user_name: s.users?.full_name,
            customer_name: s.customers?.name
        }));

        res.json({ success: true, data: sales, pagination: { total: count } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erro ao listar vendas.' });
    }
});

/**
 * GET /api/sales/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: sale, error } = await supabase.from('sales').select('*, users(full_name), customers(name)').eq('id', req.params.id).maybeSingle();
        if (error || !sale) return res.status(404).json({ success: false, message: 'Venda não encontrada.' });

        sale.user_name = sale.users?.full_name;
        sale.customer_name = sale.customers?.name;

        const { data: saleItems } = await supabase.from('sale_items').select('*, products(name, barcode)').eq('sale_id', req.params.id);
        const { data: salePayments } = await supabase.from('payments').select('*').eq('sale_id', req.params.id);

        sale.items = (saleItems || []).map(si => ({
            ...si,
            product_name: si.products?.name,
            barcode: si.products?.barcode
        }));
        sale.payments = salePayments || [];

        res.json({ success: true, data: sale });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Erro ao buscar venda.' });
    }
});

/**
 * POST /api/sales/:id/cancel
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const { data: sale } = await supabase.from('sales').select('*').eq('id', req.params.id).maybeSingle();
        if (!sale) return res.status(404).json({ success: false, message: 'Venda não encontrada.' });
        if (sale.status === 'cancelled') return res.status(400).json({ success: false, message: 'Venda já cancelada.' });

        await supabase.from('sales').update({ status: 'cancelled' }).eq('id', req.params.id);
        
        const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', req.params.id);
        
        for (const item of (items || [])) {
            const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
            const newBal = prod.current_stock + item.quantity;
            await supabase.from('products').update({ current_stock: newBal, updated_at: new Date().toISOString() }).eq('id', item.product_id);
            
            await supabase.from('stock_movements').insert({
                product_id: item.product_id, user_id: req.session.userId, type: 'entry', quantity: item.quantity, balance_after: newBal, reason: `Cancelamento Venda #${String(req.params.id).padStart(4,'0')}`, reference_id: String(req.params.id)
            });
        }
        
        // Delete associated pending receivable transaction, or mark as cancelled
        await supabase.from('transactions').delete().eq('reference_type', 'sale').eq('reference_id', String(req.params.id));

        await supabase.from('activity_log').insert({ user_id: req.session.userId, action: 'cancel_sale', entity: 'sale', entity_id: req.params.id, description: `Venda #${String(req.params.id).padStart(4,'0')} cancelada` });

        res.json({ success: true, message: 'Venda cancelada. Estoque restaurado.' });
    } catch (error) {
        console.error('Erro ao cancelar venda:', error);
        res.status(500).json({ success: false, message: 'Erro ao cancelar venda.' });
    }
});

module.exports = router;

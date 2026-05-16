/**
 * StockCell - API Offline Layer
 * Intercepta chamadas da API e responde com dados locais quando offline.
 */
const APIOffline = {
    /** Verifica se o servidor está acessível */
    async isOnline() {
        try {
            const controller = new AbortController();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, 8000);
            });
            const fetchPromise = fetch('/api/auth/session', { method: 'GET', cache: 'no-store', signal: controller.signal });
            const r = await Promise.race([fetchPromise, timeoutPromise]);
            return r.ok || r.status === 401;
        } catch { return false; }
    },

    /**
     * Processa uma requisição offline, roteando para o IndexedDB local.
     * Retorna null se não souber tratar a rota (fallback para erro genérico).
     */
    async handle(method, endpoint, data) {
        // ---- AUTH ----
        if (endpoint === '/auth/session') {
            const user = localStorage.getItem('sc_offline_user');
            if (user) return { success: true, authenticated: true, user: JSON.parse(user) };
            return { success: false, authenticated: false };
        }
        if (endpoint === '/auth/login') {
            const knownStr = localStorage.getItem('sc_known_users');
            const known = JSON.parse(knownStr || '{}');
            const username = data && data.username ? data.username.trim().toLowerCase() : '';
            if (username && known[username]) {
                const enteredHash = await Utils.hashPassword(data.password);
                if (enteredHash === known[username].hash) {
                    return { success: true, user: known[username].user };
                } else {
                    return { success: false, message: 'Senha incorreta (Offline).' };
                }
            }
            return { success: false, message: 'Usuário não reconhecido no modo offline. Conecte-se ao servidor pelo menos uma vez.' };
        }

        // ---- ACCOUNTS ----
        if (method === 'GET' && endpoint === '/accounts') {
            const accs = await OfflineDB.getAll('bank_accounts');
            return { success: true, data: accs };
        }

        // ---- PRODUCTS ----
        if (method === 'GET' && endpoint.startsWith('/products')) {
            const idMatch = endpoint.match(/^\/products\/(\d+)$/);
            if (idMatch) {
                const prod = await OfflineDB.get('products', parseInt(idMatch[1]));
                return prod ? { success: true, data: prod } : { success: false, message: 'Produto não encontrado.' };
            }
            return this._handleProducts(endpoint);
        }

        // ---- CATEGORIES ----
        if (method === 'GET' && endpoint === '/categories') {
            const cats = await OfflineDB.getAll('categories');
            return { success: true, data: cats.filter(c => c.active !== 0) };
        }

        // ---- CUSTOMERS ----
        if (method === 'GET' && endpoint === '/customers') {
            const custs = await OfflineDB.getAll('customers');
            return { success: true, data: custs.filter(c => c.active !== 0) };
        }

        // ---- SUPPLIERS ----
        if (method === 'GET' && endpoint.startsWith('/suppliers')) {
            const idMatch = endpoint.match(/^\/suppliers\/(\d+)$/);
            if (idMatch) {
                const supp = await OfflineDB.get('suppliers', parseInt(idMatch[1]));
                return supp ? { success: true, data: supp } : { success: false, message: 'Fornecedor não encontrado.' };
            }
            const supps = await OfflineDB.getAll('suppliers');
            return { success: true, data: supps.filter(s => s.active !== 0) };
        }

        // ---- SALES ----
        if (method === 'GET' && endpoint.startsWith('/sales/')) {
            const idMatch = endpoint.match(/^\/sales\/(-?\d+)$/);
            if (idMatch) {
                const saleId = parseInt(idMatch[1]);
                const sale = await OfflineDB.get('sales', saleId);
                if (!sale) return { success: false, message: 'Venda não encontrada.' };
                
                const allItems = await OfflineDB.getAll('sale_items');
                const allPayments = await OfflineDB.getAll('payments');
                const products = await OfflineDB.getAll('products');
                
                sale.items = allItems.filter(i => i.sale_id === saleId).map(i => {
                    const p = products.find(prod => prod.id === i.product_id);
                    return { ...i, product_name: p ? p.name : (i.product_name || 'Desconhecido') };
                });
                sale.payments = allPayments.filter(p => p.sale_id === saleId);
                
                return { success: true, data: sale };
            }
        }
        if (method === 'POST' && endpoint === '/sales') {
            return this._createOfflineSale(data);
        }

        // ---- DASHBOARD ----
        if (method === 'GET' && endpoint === '/dashboard') {
            return this._handleDashboard();
        }

        // ---- CASH REGISTER ----
        if (endpoint.startsWith('/cashregister')) {
            const settings = localStorage.getItem('sc_offline_settings');
            const parsedSettings = settings ? JSON.parse(settings) : {};
            if (parsedSettings.terminal_mode === 'pc_main' && method === 'POST') {
                return { success: false, message: 'Operações de caixa bloqueadas neste terminal (Modo Vendedor).' };
            }
            return this._handleCashRegister(method, endpoint, data);
        }

        // ---- FINANCE ----
        if (method === 'GET' && endpoint.startsWith('/finance')) {
            return this._handleFinance(endpoint);
        }
        if (method === 'POST' && endpoint === '/finance/transactions') {
            return this._createOfflineTransaction(data);
        }
        if (method === 'PUT' && endpoint.match(/^\/finance\/transactions\/(\d+)\/pay$/)) {
            const idMatch = endpoint.match(/^\/finance\/transactions\/(\d+)\/pay$/);
            return this._payOfflineTransaction(parseInt(idMatch[1]), data);
        }

        // ---- REPORTS ----
        if (method === 'GET' && endpoint.startsWith('/reports')) {
            return this._handleReports(endpoint);
        }

        // ---- SETTINGS ----
        if (method === 'GET' && endpoint.startsWith('/settings')) {
            const settings = localStorage.getItem('sc_offline_settings');
            if (settings) return { success: true, data: JSON.parse(settings) };
            return { success: true, data: {} };
        }

        // ---- LOGS ----
        if (method === 'GET' && endpoint.startsWith('/logs')) {
            const queue = await OfflineDB.getQueue();
            const logs = queue.map(q => {
                let action = 'update';
                let desc = 'Ação pendente de sincronização';
                if (q.type === 'sale') {
                    action = 'sale';
                    desc = `Venda Offline - Total: R$ ${parseFloat(q.data.total || 0).toFixed(2)}`;
                } else if (q.type === 'cash_register') {
                    action = q.data.status === 'open' ? 'open_register' : 'close_register';
                    desc = `Caixa ${q.data.status === 'open' ? 'Aberto' : 'Fechado'} Offline`;
                } else if (q.type === 'cash_movement') {
                    action = q.data.type === 'withdraw' ? 'withdraw' : 'supply';
                    desc = `Movimento de Caixa: R$ ${parseFloat(q.data.amount || 0).toFixed(2)} - ${q.data.reason || ''}`;
                } else if (q.type === 'transaction') {
                    action = 'create';
                    desc = `Transação Financeira: R$ ${parseFloat(q.data.amount || 0).toFixed(2)}`;
                }

                return {
                    created_at: q.created_at || new Date().toISOString(),
                    full_name: 'Fila de Sinc.',
                    action: action,
                    description: desc
                };
            });

            logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (logs.length === 0) {
                logs.push({
                    created_at: new Date().toISOString(),
                    full_name: 'Sistema Offline',
                    action: 'update',
                    description: 'Nenhuma ação offline na fila de sincronização.'
                });
            } else {
                logs.unshift({
                    created_at: new Date().toISOString(),
                    full_name: 'Sistema Offline',
                    action: 'update',
                    description: '⚠️ Exibindo apenas ações feitas offline não sincronizadas. O histórico completo fica no PC.'
                });
            }

            return { success: true, data: logs };
        }

        // Rota não tratada offline
        return { success: false, message: 'Funcionalidade indisponível offline.' };
    },

    // ========== Products ==========
    async _handleProducts(endpoint) {
        const products = await OfflineDB.getAll('products');
        const active = products.filter(p => p.active !== 0);

        // GET /products/barcode/:code
        const barcodeMatch = endpoint.match(/\/products\/barcode\/(.+)/);
        if (barcodeMatch) {
            const code = decodeURIComponent(barcodeMatch[1]);
            const found = active.find(p => p.barcode === code || p.internal_code === code);
            if (found) return { success: true, data: found };
            return { success: false, message: 'Produto não encontrado.' };
        }

        // GET /products?search=X&limit=N
        const url = new URL('http://x' + endpoint);
        const search = (url.searchParams.get('search') || '').toLowerCase();
        const limit = parseInt(url.searchParams.get('limit')) || 999;

        let filtered = active;
        if (search) {
            filtered = active.filter(p =>
                (p.name || '').toLowerCase().includes(search) ||
                (p.barcode || '').toLowerCase().includes(search) ||
                (p.internal_code || '').toLowerCase().includes(search) ||
                (p.brand || '').toLowerCase().includes(search)
            );
        }
        return { success: true, data: filtered.slice(0, limit) };
    },

    // ========== Create Offline Sale ==========
    async _createOfflineSale(data) {
        const uuid = Utils.generateUUID();
        const now = Utils.getLocalISOTime();
        const subtotal = data.items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - (data.discount_amount || 0));
        const saleId = OfflineDB.nextLocalId();

        const sale = {
            id: saleId, uuid, user_id: null, customer_id: null,
            subtotal, discount_amount: data.discount_amount || 0, total,
            status: 'completed', created_at: now,
            cash_received: data.cash_received || 0,
            cash_change: data.cash_change || 0,
            _offline: true
        };
        await OfflineDB.put('sales', sale);

        // Items
        const items = data.items.map((item, idx) => ({
            id: saleId * 1000 - idx,
            sale_id: saleId,
            product_id: item.product_id,
            product_name: '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount || 0,
            total: item.unit_price * item.quantity
        }));
        // Resolve product names
        for (const item of items) {
            const p = await OfflineDB.get('products', item.product_id);
            if (p) {
                item.product_name = p.name;
                // Decrement local stock
                p.current_stock = Math.max(0, (p.current_stock || 0) - item.quantity);
                await OfflineDB.put('products', p);
            }
        }
        await OfflineDB.putBulk('sale_items', items);

        // Payments
        const payments = data.payments.map((pm, idx) => ({
            id: saleId * 100 - idx,
            sale_id: saleId,
            method: pm.method,
            amount: pm.amount,
            created_at: now
        }));
        await OfflineDB.putBulk('payments', payments);

        // Enqueue for sync
        await OfflineDB.enqueue({
            type: 'sale',
            uuid,
            data: { ...data, uuid, created_at: now, total }
        });

        return {
            success: true,
            message: '✅ Venda registrada offline! Será sincronizada ao conectar.',
            data: { id: saleId, uuid, total, discount_amount: data.discount_amount || 0, cash_received: data.cash_received || 0, cash_change: data.cash_change || 0, created_at: now, items, payments }
        };
    },

    // ========== Dashboard (offline) ==========
    async _handleDashboard() {
        const sales = await OfflineDB.getAll('sales');
        const products = await OfflineDB.getAll('products');
        const customers = await OfflineDB.getAll('customers');
        const saleItems = await OfflineDB.getAll('sale_items');
        const paymentsAll = await OfflineDB.getAll('payments');

        const dLocal = new Date();
        const today = `${dLocal.getFullYear()}-${String(dLocal.getMonth() + 1).padStart(2, '0')}-${String(dLocal.getDate()).padStart(2, '0')}`;
        const monthStart = today.substring(0, 8) + '01';
        const completed = sales.filter(s => s.status === 'completed');
        const todaySales = completed.filter(s => (s.created_at || '').substring(0, 10) === today);
        const monthSales = completed.filter(s => (s.created_at || '').substring(0, 10) >= monthStart);
        const activeProducts = products.filter(p => p.active !== 0);

        // Top products (month)
        const monthSaleIds = new Set(monthSales.map(s => s.id));
        const monthItems = saleItems.filter(si => monthSaleIds.has(si.sale_id));
        const productMap = {};
        monthItems.forEach(si => {
            if (!productMap[si.product_id]) productMap[si.product_id] = { qty: 0, revenue: 0 };
            productMap[si.product_id].qty += si.quantity;
            productMap[si.product_id].revenue += si.total;
        });
        const topProducts = Object.entries(productMap)
            .map(([pid, d]) => {
                const p = products.find(pr => pr.id == pid);
                return { name: p ? p.name : 'Desconhecido', qty_sold: d.qty, revenue: d.revenue };
            })
            .sort((a, b) => b.qty_sold - a.qty_sold).slice(0, 5);

        // Payment breakdown (month)
        const monthPayments = paymentsAll.filter(pm => monthSaleIds.has(pm.sale_id));
        const payBreakdown = {};
        monthPayments.forEach(pm => {
            if (!payBreakdown[pm.method]) payBreakdown[pm.method] = { method: pm.method, count: 0, total: 0 };
            payBreakdown[pm.method].count++;
            payBreakdown[pm.method].total += pm.amount;
        });

        // Last 7 days
        const last7 = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const daySales = completed.filter(s => (s.created_at || '').substring(0, 10) === ds);
            last7.push({
                date: ds,
                label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
                total: daySales.reduce((s, sl) => s + sl.total, 0),
                count: daySales.length
            });
        }

        return {
            success: true,
            data: {
                today: { sales: todaySales.length, revenue: todaySales.reduce((s, sl) => s + sl.total, 0) },
                month: { sales: monthSales.length, revenue: monthSales.reduce((s, sl) => s + sl.total, 0) },
                products: { total: activeProducts.length, low_stock: activeProducts.filter(p => p.current_stock <= (p.min_stock || 5)).length },
                stock: {
                    sale_value: activeProducts.reduce((s, p) => s + (p.current_stock * p.sale_price), 0),
                    cost_value: activeProducts.reduce((s, p) => s + (p.current_stock * (p.cost_price || 0)), 0)
                },
                customers: customers.filter(c => c.active !== 0).length,
                recent_sales: completed.sort((a, b) => b.created_at?.localeCompare(a.created_at)).slice(0, 5),
                top_products: topProducts,
                payment_breakdown: Object.values(payBreakdown),
                last_7_days: last7
            }
        };
    },

    // ========== Finance (offline) ==========
    async _handleFinance(endpoint) {
        if (endpoint === '/finance/categories') {
            const categories = await OfflineDB.getAll('transaction_categories');
            return { success: true, data: categories.sort((a, b) => (a.type + a.name).localeCompare(b.type + b.name)) };
        }

        const transactions = await OfflineDB.getAll('transactions');
        const categories = await OfflineDB.getAll('transaction_categories');
        const catMap = {};
        categories.forEach(c => catMap[c.id] = c);

        if (endpoint.includes('/summary')) {
            const url = new URL('http://x' + endpoint);
            const dLocalF = new Date();
            const localMonth = `${dLocalF.getFullYear()}-${String(dLocalF.getMonth() + 1).padStart(2, '0')}`;
            const month = url.searchParams.get('month') || localMonth;
            const filtered = transactions.filter(t => (t.due_date || '').substring(0, 7) === month);
            return {
                success: true,
                data: {
                    total_received: filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.paid_amount || 0), 0),
                    total_to_receive: filtered.filter(t => t.type === 'income' && t.status !== 'completed').reduce((s, t) => s + (t.amount - (t.paid_amount || 0)), 0),
                    total_paid: filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.paid_amount || 0), 0),
                    total_to_pay: filtered.filter(t => t.type === 'expense' && t.status !== 'completed').reduce((s, t) => s + (t.amount - (t.paid_amount || 0)), 0)
                }
            };
        }
        // GET /finance/transactions
        const url = new URL('http://x' + endpoint);
        let filtered = [...transactions];
        const type = url.searchParams.get('type');
        const status = url.searchParams.get('status');
        const month = url.searchParams.get('month');
        if (type) filtered = filtered.filter(t => t.type === type);
        if (status) filtered = filtered.filter(t => t.status === status);
        if (month) filtered = filtered.filter(t => (t.due_date || '').substring(0, 7) === month);
        filtered.sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));

        const allPayments = await OfflineDB.getAll('transaction_payments');

        // Inject category names and payments
        const enriched = filtered.map(t => {
            const c = catMap[t.category_id];
            const p = allPayments.filter(pay => pay.transaction_id === t.id);
            return { ...t, category_name: c ? c.name : null, category_color: c ? c.color : null, payments: p };
        });

        return { success: true, data: enriched };
    },

    async _createOfflineTransaction(data) {
        const id = OfflineDB.nextLocalId();
        const now = Utils.getLocalISOTime();
        const paidAmount = (data.status === 'completed') ? data.amount : 0;
        const tx = { id, ...data, paid_amount: paidAmount, created_at: now, updated_at: now, _offline: true };
        await OfflineDB.put('transactions', tx);
        await OfflineDB.enqueue({ type: 'transaction', uuid: Utils.generateUUID(), data: { ...data, created_at: now } });
        return { success: true, message: 'Transação registrada offline.', data: { id } };
    },

    async _payOfflineTransaction(id, data) {
        const tx = await OfflineDB.get('transactions', id);
        if (!tx) return { success: false, message: 'Transação não encontrada.' };

        const dLoc = new Date();
        const localDate = `${dLoc.getFullYear()}-${String(dLoc.getMonth()+1).padStart(2,'0')}-${String(dLoc.getDate()).padStart(2,'0')}`;
        const payDate = data.payment_date || localDate;
        
        const remaining = tx.amount - (tx.paid_amount || 0);
        const payAmount = data.amount ? parseFloat(data.amount) : remaining;

        if (payAmount <= 0 || payAmount > remaining) return { success: false, message: 'Valor inválido.' };

        const newPaidAmount = (tx.paid_amount || 0) + payAmount;
        const newStatus = newPaidAmount >= tx.amount ? 'completed' : 'partial';

        tx.status = newStatus;
        tx.paid_amount = newPaidAmount;
        tx.payment_date = payDate;
        tx.payment_method = data.payment_method || 'cash';

        await OfflineDB.put('transactions', tx);

        const paymentId = OfflineDB.nextLocalId();
        await OfflineDB.put('transaction_payments', {
            id: paymentId,
            transaction_id: id,
            amount: payAmount,
            payment_method: data.payment_method || 'cash',
            payment_date: payDate,
            created_at: Utils.getLocalISOTime()
        });

        await OfflineDB.enqueue({ 
            type: 'transaction_payment', 
            uuid: Utils.generateUUID(), 
            data: { transaction_id: id, amount: payAmount, payment_method: data.payment_method || 'cash', payment_date: payDate } 
        });

        return { success: true, message: 'Pagamento salvo offline.' };
    },

    // ========== Reports (offline) ==========
    async _handleReports(endpoint) {
        const url = new URL('http://x' + endpoint);
        const start = url.searchParams.get('start');
        const end = url.searchParams.get('end');
        if (!start || !end) return { success: false, message: 'Informe datas.' };

        const sales = (await OfflineDB.getAll('sales')).filter(s => s.status === 'completed' && (s.created_at || '').substring(0, 10) >= start && (s.created_at || '').substring(0, 10) <= end);
        const saleItems = await OfflineDB.getAll('sale_items');
        const products = await OfflineDB.getAll('products');
        const paymentsAll = await OfflineDB.getAll('payments');
        const saleIds = new Set(sales.map(s => s.id));

        if (endpoint.startsWith('/reports/sales')) {
            const revenue = sales.reduce((s, sl) => s + sl.total, 0);
            const daily = {};
            sales.forEach(s => { const d = (s.created_at || '').substring(0, 10); if (!daily[d]) daily[d] = { date: d, count: 0, total: 0 }; daily[d].count++; daily[d].total += s.total; });
            const pmBreak = {};
            paymentsAll.filter(pm => saleIds.has(pm.sale_id)).forEach(pm => { if (!pmBreak[pm.method]) pmBreak[pm.method] = { method: pm.method, count: 0, total: 0 }; pmBreak[pm.method].count++; pmBreak[pm.method].total += pm.amount; });
            const currentUser = JSON.parse(localStorage.getItem('sc_offline_user') || '{}');
            const userName = currentUser.full_name || currentUser.username || 'Vendedor Offline';
            
            const enrichedSales = sales.map(s => {
                const sItems = saleItems.filter(si => si.sale_id === s.id);
                const productsStr = sItems.map(si => {
                    const p = products.find(pr => pr.id === si.product_id);
                    return `${p ? p.name : 'Desconhecido'} (${si.quantity}x)`;
                }).join(', ');
                return {
                    ...s,
                    user_name: s._offline ? userName : (s.user_name || 'Vendedor PC'),
                    products_sold: productsStr || 'N/A'
                };
            });

            return { success: true, data: {
                summary: { total_sales: sales.length, revenue, avg_ticket: sales.length > 0 ? revenue / sales.length : 0, total_discounts: sales.reduce((s, sl) => s + (sl.discount_amount || 0), 0) },
                daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
                byPayment: Object.values(pmBreak),
                sales: enrichedSales.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            }};
        }
        if (endpoint.startsWith('/reports/top-products')) {
            const items = saleItems.filter(si => saleIds.has(si.sale_id));
            const pMap = {};
            items.forEach(si => {
                if (!pMap[si.product_id]) { const p = products.find(pr => pr.id === si.product_id) || {}; pMap[si.product_id] = { id: si.product_id, name: p.name || '?', barcode: p.barcode, internal_code: p.internal_code, cost_price: p.cost_price || 0, sale_price: p.sale_price || 0, current_stock: p.current_stock || 0, qty_sold: 0, revenue: 0, total_cost: 0 }; }
                pMap[si.product_id].qty_sold += si.quantity;
                pMap[si.product_id].revenue += si.total;
                pMap[si.product_id].total_cost += si.quantity * pMap[si.product_id].cost_price;
            });
            const prods = Object.values(pMap).sort((a, b) => b.qty_sold - a.qty_sold);
            return { success: true, data: { summary: { unique_products: prods.length, total_qty: prods.reduce((s, p) => s + p.qty_sold, 0), total_revenue: prods.reduce((s, p) => s + p.revenue, 0), total_cost: prods.reduce((s, p) => s + p.total_cost, 0), gross_profit: prods.reduce((s, p) => s + p.revenue - p.total_cost, 0) }, products: prods }};
        }
        if (endpoint.startsWith('/reports/cashflow')) {
            const transactions = await OfflineDB.getAll('transactions');
            const txFiltered = transactions.filter(t => (t.due_date || '').substring(0, 10) >= start && (t.due_date || '').substring(0, 10) <= end);
            const salesIncome = sales.reduce((s, sl) => s + sl.total, 0);
            const fi = txFiltered.filter(t => t.type === 'income' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
            const fe = txFiltered.filter(t => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
            return { success: true, data: {
                summary: { sales_income: salesIncome, finance_income: fi, total_income: salesIncome + fi, total_expense: fe, net_balance: salesIncome + fi - fe, pending_income: txFiltered.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + t.amount, 0), pending_expense: txFiltered.filter(t => t.type === 'expense' && t.status === 'pending').reduce((s, t) => s + t.amount, 0) },
                daily: []
            }};
        }
        return { success: false, message: 'Relatório indisponível offline.' };
    },

    // ========== Cash Register (offline) ==========
    async _handleCashRegister(method, endpoint, data) {
        const registers = await OfflineDB.getAll('cash_registers');
        const openRegisters = registers.filter(r => r.status === 'open');
        let current = null;
        if (openRegisters.length > 0) {
            current = openRegisters.sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
        } else if (registers.length > 0) {
            current = registers.sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
        }

        if (method === 'GET' && endpoint === '/cashregister/status') {
            const status = current ? current.status : 'closed';
            return { success: true, data: { status } };
        }

        if (method === 'GET' && endpoint === '/cashregister/current') {
            if (!current || current.status !== 'open') return { success: true, data: null };
            
            const sales = await OfflineDB.getAll('sales');
            const payments = await OfflineDB.getAll('payments');
            const movements = await OfflineDB.getAll('cash_movements');
            
            const crSales = sales.filter(s => s.created_at >= current.opened_at && s.status === 'completed');
            const crSaleIds = new Set(crSales.map(s => s.id));
            const crPayments = payments.filter(pm => crSaleIds.has(pm.sale_id));
            const crMovements = movements.filter(m => m.cash_register_id === current.id || m.cash_register_uuid === current.uuid);

            let totalSalesRevenue = 0;
            const payBreakdown = {};
            crPayments.forEach(pm => {
                totalSalesRevenue += pm.amount;
                if (!payBreakdown[pm.method]) payBreakdown[pm.method] = { method: pm.method, total: 0 };
                payBreakdown[pm.method].total += pm.amount;
            });

            const totalWithdrawn = crMovements.filter(m => m.type === 'withdraw').reduce((s, m) => s + m.amount, 0);
            const totalSupplied = crMovements.filter(m => m.type === 'supply').reduce((s, m) => s + m.amount, 0);
            
            const cashSales = payBreakdown['cash'] ? payBreakdown['cash'].total : 0;
            const expectedCash = current.opening_balance + cashSales + totalSupplied - totalWithdrawn;

            return {
                success: true,
                data: {
                    ...current,
                    sales: { total_sales: crSales.length, total_revenue: totalSalesRevenue },
                    paymentBreakdown: Object.values(payBreakdown),
                    movements: crMovements,
                    totalWithdrawn, totalSupplied,
                    expectedCash: Math.max(0, expectedCash)
                }
            };
        }

        if (method === 'POST' && endpoint === '/cashregister/open') {
            if (current && current.status === 'open') return { success: false, message: 'O caixa já está aberto.' };
            
            const uuid = Utils.generateUUID();
            const now = Utils.getLocalISOTime();
            const newReg = {
                id: OfflineDB.nextLocalId(), uuid,
                opening_balance: data.opening_balance || 0,
                status: 'open',
                opened_at: now,
                created_at: now,
                _offline: true
            };
            await OfflineDB.put('cash_registers', newReg);
            await OfflineDB.enqueue({ type: 'cash_register', uuid, data: newReg });
            return { success: true, message: 'Caixa aberto offline com sucesso.' };
        }

        if (method === 'POST' && endpoint === '/cashregister/close') {
            if (!current || current.status !== 'open') return { success: false, message: 'O caixa não está aberto.' };
            
            const now = Utils.getLocalISOTime();
            current.status = 'closed';
            current.closed_at = now;
            current.closing_balance = data.counted_balance || 0;
            current.closing_notes = data.notes || '';
            
            await OfflineDB.put('cash_registers', current);
            await OfflineDB.enqueue({ type: 'cash_register', uuid: current.uuid, data: current });
            return { success: true, message: 'Caixa fechado offline com sucesso.' };
        }

        if (method === 'POST' && (endpoint === '/cashregister/withdraw' || endpoint === '/cashregister/supply')) {
            if (!current || current.status !== 'open') return { success: false, message: 'O caixa não está aberto.' };
            
            const type = endpoint.includes('withdraw') ? 'withdraw' : 'supply';
            const uuid = Utils.generateUUID();
            const now = Utils.getLocalISOTime();
            const mov = {
                id: OfflineDB.nextLocalId(), uuid,
                cash_register_id: current.id,
                cash_register_uuid: current.uuid,
                type,
                amount: data.amount,
                reason: data.reason || '',
                created_at: now,
                _offline: true
            };
            await OfflineDB.put('cash_movements', mov);
            await OfflineDB.enqueue({ type: 'cash_movement', uuid, data: mov });
            return { success: true, message: 'Movimento registrado offline.' };
        }

        if (method === 'GET' && endpoint === '/cashregister/history') {
            return { success: true, data: sorted };
        }

        return { success: false, message: 'Ação não suportada offline.' };
    }
};

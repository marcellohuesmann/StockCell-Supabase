/**
 * StockCell - Dashboard com dados reais e gráficos Chart.js
 */
const DashboardPage = {
    data: null,
    _charts: [],

    render() {
        return `
            <div class="page-content page-enter">
                <div class="page-header">
                    <h2 class="page-title">Dashboard</h2>
                    <span style="color:var(--text-secondary);font-size:var(--font-size-sm);">Visão geral do seu negócio</span>
                </div>
                <div id="dashboard-content">
                    <div style="text-align:center;padding:var(--space-2xl);color:var(--text-muted);">
                        <div class="spinner"></div>
                        <p style="margin-top:var(--space-md);">Carregando dados...</p>
                    </div>
                </div>
            </div>
        `;
    },

    async bind() {
        const result = await API.get('/dashboard');
        if (result.success) {
            this.data = result.data;
            this.renderContent();
        } else {
            const container = document.getElementById('dashboard-content');
            if (container) container.innerHTML = '<p style="color:var(--danger)">Sessão expirada ou erro ao carregar dados.</p>';
        }
    },

    renderContent() {
        const d = this.data;
        const container = document.getElementById('dashboard-content');

        container.innerHTML = `
            <!-- Ações Rápidas -->
            <div style="margin-bottom: var(--space-xl); display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md); animation: slideUp .4s ease forwards;">
                <button class="btn btn-primary" style="padding: 24px; font-size: 20px; font-weight: 700; border-radius: 16px; box-shadow: 0 12px 28px rgba(102,126,234,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; transition: transform 0.2s, box-shadow 0.2s;" onclick="App.navigate('pdv')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 15px 35px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 12px 28px rgba(102,126,234,0.3)'">
                    <span style="font-size: 36px; line-height: 1;">🛒</span>
                    NOVA VENDA (PDV)
                </button>
                <button class="btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 24px; font-size: 20px; font-weight: 700; border-radius: 16px; box-shadow: 0 12px 28px rgba(245,158,11,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onclick="App.navigate('os')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 15px 35px rgba(245,158,11,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 12px 28px rgba(245,158,11,0.3)'">
                    <span style="font-size: 36px; line-height: 1;">🛠️</span>
                    ASSIST. TÉCNICA (O.S.)
                </button>
            </div>

            <!-- KPIs -->
            <div class="dashboard-grid">
                <div class="kpi-card" style="opacity:0;animation:slideUp .5s ease forwards .1s;cursor:pointer;" onclick="DashboardPage.showTodaySales()" title="Clique para ver as vendas de hoje">
                    <div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">💰</div>
                    <div class="kpi-value">${Utils.formatCurrency(d.today.revenue)}</div>
                    <div class="kpi-label">Faturamento Hoje (${d.today.sales} vendas)</div>
                </div>
                <div class="kpi-card" style="opacity:0;animation:slideUp .5s ease forwards .15s;cursor:pointer;" onclick="App.navigate('reports')" title="Clique para ir aos relatórios do mês">
                    <div class="kpi-icon" style="background:var(--info-bg);color:var(--info);">📅</div>
                    <div class="kpi-value">${Utils.formatCurrency(d.month.revenue)}</div>
                    <div class="kpi-label">Faturamento Mês (${d.month.sales} vendas)</div>
                </div>
                <div class="kpi-card" style="opacity:0;animation:slideUp .5s ease forwards .2s;cursor:pointer;" onclick="App.navigate('products')" title="Clique para ver os produtos">
                    <div class="kpi-icon" style="background:rgba(102,126,234,0.1);color:var(--accent-primary);">📦</div>
                    <div class="kpi-value">${d.products.total}</div>
                    <div class="kpi-label">Produtos Cadastrados</div>
                </div>
                <div class="kpi-card" style="opacity:0;animation:slideUp .5s ease forwards .25s;cursor:pointer;" onclick="sessionStorage.setItem('sc_stock_tab', 'low'); App.navigate('stock')" title="Clique para repor o estoque">
                    <div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning);">⚠️</div>
                    <div class="kpi-value">${d.products.low_stock || 0}</div>
                    <div class="kpi-label">Estoque Baixo</div>
                </div>
            </div>

            <!-- Charts Row -->
            <div class="dash-row">
                <div class="card" style="padding:var(--space-lg);flex:2;">
                    <h4 style="margin-bottom:var(--space-md);">📊 Vendas - Últimos 7 dias</h4>
                    <div style="position:relative;height:220px;"><canvas id="chart-7days"></canvas></div>
                </div>
                <div class="card" style="padding:var(--space-lg);flex:1;min-width:260px;">
                    <h4 style="margin-bottom:var(--space-md);">💳 Pagamentos (Mês)</h4>
                    ${d.payment_breakdown.length
                        ? '<div style="position:relative;height:220px;"><canvas id="chart-payments"></canvas></div>'
                        : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhuma venda no mês.</p>'}
                </div>
            </div>

            <!-- Bottom Row -->
            <div class="dash-row">
                <div class="card" style="padding:var(--space-lg);">
                    <h4 style="margin-bottom:var(--space-md);">🏆 Mais Vendidos (Mês)</h4>
                    ${d.top_products.length
                        ? '<div style="position:relative;height:200px;"><canvas id="chart-top-products"></canvas></div>'
                        : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhuma venda registrada.</p>'}
                </div>
                <div class="card" style="padding:var(--space-lg);">
                    <h4 style="margin-bottom:var(--space-md);">🕐 Últimas Vendas</h4>
                    ${d.recent_sales.length ? d.recent_sales.map(s => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--border-light);cursor:pointer;border-radius:4px;transition:background .2s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="DashboardPage.showSaleDetails(${s.id})">
                            <div>
                                <strong style="font-size:var(--font-size-sm);">${Utils.formatOrder(s.id, s.created_at)}</strong>
                                <div style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.formatDateTime(s.created_at)} • ${s.user_name || ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <strong style="color:${s.status==='completed'?'var(--success)':'var(--danger)'}">${Utils.formatCurrency(s.total)}</strong>
                                ${s.status==='cancelled'?'<br><span class="badge badge-danger" style="font-size:9px">Cancelada</span>':''}
                            </div>
                        </div>
                    `).join('') : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhuma venda registrada.</p>'}
                </div>
            </div>

            <!-- Stock Summary -->
            <div class="card" style="margin-top:var(--space-lg);padding:var(--space-lg);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-md);">
                    <div>
                        <h4>💼 Resumo do Estoque</h4>
                        <p style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-top:4px;">
                            ${d.products.total} produtos • ${d.customers} clientes
                        </p>
                    </div>
                    <div style="display:flex;gap:var(--space-xl);text-align:right;">
                        <div>
                            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Valor (custo)</div>
                            <div style="font-size:var(--font-size-lg);font-weight:700;">${Utils.formatCurrency(d.stock.cost_value)}</div>
                        </div>
                        <div>
                            <div style="font-size:var(--font-size-xs);color:var(--text-muted);">Valor (venda)</div>
                            <div style="font-size:var(--font-size-lg);font-weight:700;color:var(--success);">${Utils.formatCurrency(d.stock.sale_value)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._renderCharts();
    },

    _renderCharts() {
        const d = this.data;
        if (!d || typeof Chart === 'undefined') return;

        // Destroy old charts
        this._charts.forEach(c => c.destroy());
        this._charts = [];

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = 'rgba(148,163,184,0.1)';

        // 1. Line chart — 7-day sales
        const ctx7 = document.getElementById('chart-7days');
        if (ctx7) {
            this._charts.push(new Chart(ctx7, {
                type: 'line',
                data: {
                    labels: d.last_7_days.map(dy => dy.label),
                    datasets: [{
                        label: 'Faturamento',
                        data: d.last_7_days.map(dy => dy.total),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102,126,234,0.1)',
                        fill: true, tension: 0.4,
                        pointBackgroundColor: '#667eea',
                        pointRadius: 5, pointHoverRadius: 7,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false },
                        tooltip: { callbacks: { label: (c) => Utils.formatCurrency(c.parsed.y) } } },
                    scales: {
                        y: { beginAtZero: true, ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(148,163,184,0.06)' } },
                        x: { grid: { display: false } },
                    },
                },
            }));
        }

        // 2. Doughnut chart — Payment methods
        const ctxPay = document.getElementById('chart-payments');
        if (ctxPay && d.payment_breakdown.length) {
            const payMap = { pix: 'PIX', debit: 'Débito', credit: 'Crédito', cash: 'Dinheiro', store_credit: 'Fiado' };
            const colors = ['#667eea', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
            this._charts.push(new Chart(ctxPay, {
                type: 'doughnut',
                data: {
                    labels: d.payment_breakdown.map(p => payMap[p.method] || p.method),
                    datasets: [{ data: d.payment_breakdown.map(p => p.total), backgroundColor: colors.slice(0, d.payment_breakdown.length), borderWidth: 0, hoverOffset: 6 }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 10 } },
                        tooltip: { callbacks: { label: (c) => `${c.label}: ${Utils.formatCurrency(c.parsed)}` } },
                    },
                },
            }));
        }

        // 3. Horizontal bar chart — Top products
        const ctxTop = document.getElementById('chart-top-products');
        if (ctxTop && d.top_products.length) {
            this._charts.push(new Chart(ctxTop, {
                type: 'bar',
                data: {
                    labels: d.top_products.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '…' : p.name),
                    datasets: [{
                        label: 'Qtd vendida',
                        data: d.top_products.map(p => p.qty_sold),
                        backgroundColor: ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#3b82f6'],
                        borderRadius: 6, barThickness: 24,
                    }],
                },
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false },
                        tooltip: { callbacks: { afterLabel: (c) => `Receita: ${Utils.formatCurrency(d.top_products[c.dataIndex].revenue)}` } } },
                    scales: {
                        x: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.06)' } },
                        y: { grid: { display: false } },
                    },
                },
            }));
        }
    },

    async showTodaySales() {
        const dLocal = new Date();
        const pad = n => String(n).padStart(2,'0');
        const today = `${dLocal.getFullYear()}-${pad(dLocal.getMonth()+1)}-${pad(dLocal.getDate())}`;
        
        const result = await API.get(`/reports/sales?start=${today}&end=${today}`);
        if (!result.success) { Toast.error('Erro ao carregar vendas de hoje.'); return; }
        
        const sales = result.data.sales;
        
        Modal.open({
            title: `Vendas de Hoje`,
            size: 'lg',
            content: `
                <div class="table-container" style="max-height:400px;overflow-y:auto;">
                    ${sales.length ? `<table class="data-table">
                        <thead><tr><th>#</th><th>Hora</th><th>Vendedor</th><th>Produtos</th><th style="text-align:right">Total</th></tr></thead>
                        <tbody>
                            ${sales.map(s => `
                                <tr style="cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="document.querySelector('.modal-overlay').remove(); DashboardPage.showSaleDetails(${s.id})">
                                    <td data-label="Pedido">${Utils.formatOrder(s.id, s.created_at)}</td>
                                    <td data-label="Hora">${Utils.formatDateTime(s.created_at).substring(11, 16)}</td>
                                    <td data-label="Vendedor">${Utils.escapeHTML(s.user_name||'-')}</td>
                                    <td data-label="Produtos" style="font-size:11px;color:var(--text-secondary);max-width:200px;white-space:normal;">${Utils.escapeHTML(s.products_sold||'N/A')}</td>
                                    <td data-label="Total" style="text-align:right;font-weight:600;color:var(--success)">${Utils.formatCurrency(s.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>` : '<p style="color:var(--text-muted);text-align:center;padding:var(--space-md);">Nenhuma venda registrada hoje.</p>'}
                </div>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Fechar</button>`
        });
    },

    async showSaleDetails(id) {
        const result = await API.get(`/sales/${id}`);
        if (!result.success) { Toast.error(result.message); return; }
        const sale = result.data;
        const payLabels = { pix: 'PIX', debit: 'Débito', credit: 'Crédito', cash: 'Dinheiro', store_credit: 'Fiado' };
        
        Modal.open({
            title: `Venda ${Utils.formatOrder(sale.id, sale.created_at)}`,
            size: 'md',
            content: `
                <div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:var(--space-md);display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div><strong>Data:</strong> <br>${Utils.formatDateTime(sale.created_at)}</div>
                    <div><strong>Vendedor:</strong> <br>${Utils.escapeHTML(sale.user_name || '-')}</div>
                    <div><strong>Cliente:</strong> <br>${Utils.escapeHTML(sale.customer_name || 'Consumidor Final')}</div>
                    <div><strong>Status:</strong> <br><span class="badge badge-${sale.status==='completed'?'success':'danger'}">${sale.status==='completed'?'Concluída':'Cancelada'}</span></div>
                </div>
                <div class="table-container" style="margin-bottom:var(--space-md);">
                    <table class="data-table">
                        <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço</th><th style="text-align:right">Total</th></tr></thead>
                        <tbody>
                            ${sale.items.map(i => `<tr>
                                <td data-label="Produto">${Utils.escapeHTML(i.product_name)}</td>
                                <td data-label="Qtd" style="text-align:center">${i.quantity}</td>
                                <td data-label="Preço" style="text-align:right">${Utils.formatCurrency(i.unit_price)}</td>
                                <td data-label="Total" style="text-align:right;font-weight:600;">${Utils.formatCurrency(i.total)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="background:var(--bg-secondary);padding:var(--space-md);border-radius:var(--radius-md);">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:var(--font-size-sm);"><span>Subtotal:</span> <span>${Utils.formatCurrency(sale.subtotal)}</span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:var(--font-size-sm);"><span>Desconto:</span> <span>${Utils.formatCurrency(sale.discount_amount)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:var(--font-size-lg);margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);"><span>Total:</span> <span class="text-success">${Utils.formatCurrency(sale.total)}</span></div>
                </div>
                <h5 style="margin-top:var(--space-md);margin-bottom:var(--space-sm);">Pagamentos</h5>
                <ul style="list-style:none;padding:0;margin:0;">
                    ${sale.payments.map(p => `
                        <li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:var(--font-size-sm);">
                            <span>${payLabels[p.method] || p.method}</span>
                            <strong>${Utils.formatCurrency(p.amount)}</strong>
                        </li>
                    `).join('')}
                </ul>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Fechar</button>`
        });
    },
};

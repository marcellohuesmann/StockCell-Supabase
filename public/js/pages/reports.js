/**
 * StockCell - Relatórios Gerenciais
 */
const ReportsPage = {
    currentReport: 'sales',

    render() {
        const today = new Date().toISOString().substring(0, 10);
        const firstDay = today.substring(0, 8) + '01';
        return `
        <div class="page-content page-enter" id="reports-page">
            <div class="page-header" style="flex-wrap:wrap;gap:var(--space-sm);">
                <h2 class="page-title">📈 Relatórios</h2>
                <div style="display:flex;gap:var(--space-sm);align-items:center;flex-wrap:wrap;">
                    <input type="date" id="report-start" class="form-input" value="${firstDay}" style="width:auto;min-width:130px;flex:1;">
                    <span style="color:var(--text-muted);">até</span>
                    <input type="date" id="report-end" class="form-input" value="${today}" style="width:auto;min-width:130px;flex:1;">
                    <button class="btn btn-primary btn-sm" id="btn-generate-report">Gerar</button>
                    <button class="btn btn-secondary btn-sm" id="btn-print-report" title="Imprimir / Salvar PDF">🖨️ Imprimir</button>
                    <button class="btn btn-secondary btn-sm" id="btn-export-csv" title="Exportar dados para Excel">⬇️ CSV</button>
                </div>
            </div>
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm report-tab selected" data-report="sales">💰 Vendas</button>
                <button class="btn btn-secondary btn-sm report-tab" data-report="products">📦 Produtos</button>
                <button class="btn btn-secondary btn-sm report-tab" data-report="cashflow">📊 Fluxo de Caixa</button>
                <button class="btn btn-secondary btn-sm report-tab" data-report="sellers">👥 Vendedores</button>
            </div>
            <div id="report-content">
                <div style="text-align:center;padding:var(--space-2xl);color:var(--text-muted);">
                    <div class="spinner"></div>
                    <p style="margin-top:var(--space-md);">Carregando relatório...</p>
                </div>
            </div>
        </div>`;
    },

    bind() {
        document.getElementById('btn-generate-report').addEventListener('click', () => this.generate());
        document.getElementById('btn-print-report').addEventListener('click', () => window.print());
        document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCurrentReport());
        document.querySelectorAll('.report-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.report-tab').forEach(b => { b.className = 'btn btn-secondary btn-sm report-tab'; });
                btn.className = 'btn btn-primary btn-sm report-tab selected';
                this.currentReport = btn.dataset.report;
                this.generate();
            });
        });
        this.generate();
    },

    exportCurrentReport() {
        if (!this.reportData) {
            Toast.warning('Nenhum dado para exportar.');
            return;
        }

        const reportName = `Relatorio_${this.currentReport}_${new Date().toISOString().substring(0,10)}`;
        
        if (this.currentReport === 'sales' && this.reportData.sales) {
            const exportData = this.reportData.sales.map(s => ({
                ID: s.id,
                Data: Utils.formatDateTime(s.created_at),
                Vendedor: s.user_name || '-',
                Subtotal: s.subtotal,
                Desconto: s.discount_amount,
                Total: s.total,
                Status: s.status
            }));
            Utils.exportToCSV(exportData, reportName);
        } else if (this.currentReport === 'products' && this.reportData.products) {
            const exportData = this.reportData.products.map(p => ({
                Produto: p.name,
                Codigo: p.barcode || p.internal_code || '-',
                Qtd_Vendida: p.qty_sold,
                Receita: p.revenue,
                Custo_Total: p.total_cost,
                Lucro: p.revenue - p.total_cost,
                Estoque_Atual: p.current_stock
            }));
            Utils.exportToCSV(exportData, reportName);
        } else if (this.currentReport === 'cashflow' && this.reportData.daily) {
            const exportData = this.reportData.daily.map(d => ({
                Data: d.date,
                Entradas: d.income,
                Saidas: d.expense,
                Saldo_Liquido: d.income - d.expense
            }));
            Utils.exportToCSV(exportData, reportName);
        } else if (this.currentReport === 'sellers' && this.reportData.sellers) {
            const exportData = this.reportData.sellers.map(s => ({
                Vendedor: s.name,
                Qtd_Vendas: s.sales_count,
                Receita: s.revenue,
                Ticket_Medio: s.sales_count > 0 ? (s.revenue / s.sales_count).toFixed(2) : 0,
                Descontos: s.total_discounts
            }));
            Utils.exportToCSV(exportData, reportName);
        } else {
            Toast.warning('Não há dados detalhados para exportar neste relatório.');
        }
    },

    getDates() {
        return { start: document.getElementById('report-start').value, end: document.getElementById('report-end').value };
    },

    async generate() {
        const { start, end } = this.getDates();
        if (!start || !end) { Toast.warning('Selecione as datas.'); return; }
        const container = document.getElementById('report-content');
        container.innerHTML = '<div style="text-align:center;padding:var(--space-2xl);"><div class="spinner"></div></div>';

        const endpoints = { sales: '/reports/sales', products: '/reports/top-products', cashflow: '/reports/cashflow', sellers: '/reports/sellers' };
        const result = await API.get(`${endpoints[this.currentReport]}?start=${start}&end=${end}`);

        if (!result.success) { container.innerHTML = `<p style="color:var(--danger);text-align:center;">${result.message}</p>`; return; }

        this.reportData = result.data;
        const renderers = { sales: this.renderSales, products: this.renderProducts, cashflow: this.renderCashflow, sellers: this.renderSellers };
        container.innerHTML = renderers[this.currentReport].call(this, result.data, start, end);
    },

    renderSales(data, start, end) {
        const s = data.summary;
        const payLabels = { pix: '📱 PIX', debit: '💳 Débito', credit: '💳 Crédito', cash: '💵 Dinheiro', store_credit: '📒 Fiado' };
        const maxDay = Math.max(...data.daily.map(d => d.total), 1);
        return `
            <div class="dashboard-grid" style="margin-bottom:var(--space-lg);">
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">💰</div><div class="kpi-value">${Utils.formatCurrency(s.revenue)}</div><div class="kpi-label">Faturamento Total</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--info-bg);color:var(--info);">🧾</div><div class="kpi-value">${s.total_sales}</div><div class="kpi-label">Vendas Realizadas</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:rgba(var(--accent-primary-rgb),0.1);color:var(--accent-primary);">📊</div><div class="kpi-value">${Utils.formatCurrency(s.avg_ticket)}</div><div class="kpi-label">Ticket Médio</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning);">🏷️</div><div class="kpi-value">${Utils.formatCurrency(s.total_discounts)}</div><div class="kpi-label">Descontos Concedidos</div></div>
            </div>
            ${data.daily.length ? `
            <div class="card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
                <h4 style="margin-bottom:var(--space-md);">📊 Vendas por Dia</h4>
                <div style="display:flex;align-items:flex-end;gap:4px;height:120px;overflow-x:auto;">
                    ${data.daily.map(d => `
                        <div style="flex:1;min-width:28px;display:flex;flex-direction:column;align-items:center;gap:2px;">
                            <span style="font-size:10px;color:var(--text-muted);font-weight:600;">${d.count}</span>
                            <div style="width:100%;background:linear-gradient(to top,var(--accent-primary),var(--accent-secondary));border-radius:4px 4px 0 0;height:${Math.max(4,(d.total/maxDay)*100)}px;min-height:4px;"></div>
                            <span style="font-size:9px;color:var(--text-muted);white-space:nowrap;">${new Date(d.date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
            <div class="dash-row" style="margin-bottom:var(--space-lg);">
                <div class="card" style="padding:var(--space-lg);">
                    <h4 style="margin-bottom:var(--space-md);">💳 Por Forma de Pagamento</h4>
                    ${data.byPayment.length ? data.byPayment.map(p => {
                        const pct = s.revenue > 0 ? ((p.total / s.revenue) * 100).toFixed(0) : 0;
                        return `<div style="margin-bottom:var(--space-sm);"><div style="display:flex;justify-content:space-between;font-size:var(--font-size-sm);margin-bottom:4px;"><span>${payLabels[p.method]||p.method}</span><span style="color:var(--text-secondary)">${Utils.formatCurrency(p.total)} (${pct}%)</span></div><div style="width:100%;height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent-primary),var(--accent-secondary));border-radius:3px;"></div></div></div>`;
                    }).join('') : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhum dado.</p>'}
                </div>
                <div class="card" style="padding:var(--space-lg);max-height:400px;overflow-y:auto;">
                    <h4 style="margin-bottom:var(--space-md);">🕐 Detalhamento</h4>
                    ${data.sales.length ? `<table class="data-table"><thead><tr><th>#</th><th>Data</th><th>Vendedor</th><th>Produtos</th><th style="text-align:right">Total</th></tr></thead><tbody>${data.sales.map(sl => `<tr><td data-label="Pedido">${Utils.formatOrder(sl.id, sl.created_at)}</td><td data-label="Data">${Utils.formatDateTime(sl.created_at)}</td><td data-label="Vendedor">${Utils.escapeHTML(sl.user_name||'-')}</td><td data-label="Produtos" style="font-size:11px;color:var(--text-secondary);max-width:200px;white-space:normal;">${Utils.escapeHTML(sl.products_sold||'N/A')}</td><td data-label="Total" style="text-align:right;font-weight:600;color:var(--success)">${Utils.formatCurrency(sl.total)}</td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhuma venda.</p>'}
                </div>
            </div>`;
    },

    renderProducts(data) {
        const s = data.summary;
        return `
            <div class="dashboard-grid" style="margin-bottom:var(--space-lg);">
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--info-bg);color:var(--info);">📦</div><div class="kpi-value">${s.unique_products}</div><div class="kpi-label">Produtos Vendidos</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">🔢</div><div class="kpi-value">${s.total_qty}</div><div class="kpi-label">Unidades Vendidas</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:rgba(var(--accent-primary-rgb),0.1);color:var(--accent-primary);">💰</div><div class="kpi-value">${Utils.formatCurrency(s.total_revenue)}</div><div class="kpi-label">Receita Bruta</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning);">📈</div><div class="kpi-value">${Utils.formatCurrency(s.gross_profit)}</div><div class="kpi-label">Lucro Bruto Estimado</div></div>
            </div>
            <div class="card" style="padding:var(--space-lg);">
                <h4 style="margin-bottom:var(--space-md);">🏆 Ranking de Produtos (Curva ABC)</h4>
                ${data.products.length ? `
                <div class="table-container"><table class="data-table"><thead><tr>
                    <th>#</th><th>Produto</th><th>Código</th><th style="text-align:center">Qtd</th><th style="text-align:right">Receita</th><th style="text-align:right">Custo</th><th style="text-align:right">Lucro</th><th style="text-align:center">Estoque</th>
                </tr></thead><tbody>
                ${data.products.map((p, i) => {
                    const profit = p.revenue - p.total_cost;
                    const medal = i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}º`;
                    return `<tr>
                        <td data-label="Posição">${medal}</td>
                        <td data-label="Produto" style="font-weight:600">${Utils.escapeHTML(p.name)}</td>
                        <td data-label="Código" style="font-family:var(--font-mono);font-size:var(--font-size-xs);color:var(--text-muted)">${Utils.escapeHTML(p.barcode||p.internal_code||'-')}</td>
                        <td data-label="Qtd" style="text-align:center">${p.qty_sold}</td>
                        <td data-label="Receita" style="text-align:right;color:var(--success)">${Utils.formatCurrency(p.revenue)}</td>
                        <td data-label="Custo" style="text-align:right;color:var(--text-secondary)">${Utils.formatCurrency(p.total_cost)}</td>
                        <td data-label="Lucro" style="text-align:right;font-weight:600;color:${profit>=0?'var(--success)':'var(--danger)'}">${Utils.formatCurrency(profit)}</td>
                        <td data-label="Estoque" style="text-align:center">${p.current_stock}</td>
                    </tr>`;
                }).join('')}
                </tbody></table></div>` : '<p style="color:var(--text-muted);">Nenhum produto vendido no período.</p>'}
            </div>`;
    },

    renderCashflow(data) {
        const s = data.summary;
        const maxVal = Math.max(...data.daily.map(d => Math.max(d.income, d.expense)), 1);
        return `
            <div class="dashboard-grid" style="margin-bottom:var(--space-lg);">
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">📥</div><div class="kpi-value">${Utils.formatCurrency(s.total_income)}</div><div class="kpi-label">Total Entradas</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--danger-bg);color:var(--danger);">📤</div><div class="kpi-value">${Utils.formatCurrency(s.total_expense)}</div><div class="kpi-label">Total Saídas</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:${s.net_balance>=0?'var(--success-bg)':'var(--danger-bg)'};color:${s.net_balance>=0?'var(--success)':'var(--danger)'};">💎</div><div class="kpi-value" style="color:${s.net_balance>=0?'var(--success)':'var(--danger)'}">${Utils.formatCurrency(s.net_balance)}</div><div class="kpi-label">Saldo Líquido</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning);">⏳</div><div class="kpi-value">${Utils.formatCurrency(s.pending_income)}</div><div class="kpi-label">A Receber (Pendente)</div></div>
            </div>
            <div class="card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
                <h4 style="margin-bottom:var(--space-md);">📊 Fluxo Diário (Entradas vs Saídas)</h4>
                ${data.daily.length ? `
                <div style="display:flex;align-items:flex-end;gap:6px;height:140px;overflow-x:auto;">
                    ${data.daily.map(d => `
                        <div style="flex:1;min-width:36px;display:flex;flex-direction:column;align-items:center;gap:2px;">
                            <div style="display:flex;gap:2px;align-items:flex-end;height:110px;">
                                <div style="width:12px;background:var(--success);border-radius:3px 3px 0 0;height:${Math.max(2,(d.income/maxVal)*100)}px;" title="Entradas: ${Utils.formatCurrency(d.income)}"></div>
                                <div style="width:12px;background:var(--danger);border-radius:3px 3px 0 0;height:${Math.max(2,(d.expense/maxVal)*100)}px;" title="Saídas: ${Utils.formatCurrency(d.expense)}"></div>
                            </div>
                            <span style="font-size:9px;color:var(--text-muted);white-space:nowrap;">${new Date(d.date+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:var(--space-md);margin-top:var(--space-sm);font-size:var(--font-size-xs);color:var(--text-muted);">
                    <span><span style="display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:4px;"></span>Entradas</span>
                    <span><span style="display:inline-block;width:10px;height:10px;background:var(--danger);border-radius:2px;margin-right:4px;"></span>Saídas</span>
                </div>` : '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhuma movimentação no período.</p>'}
            </div>
            <div class="card" style="padding:var(--space-lg);">
                <h4 style="margin-bottom:var(--space-md);">📋 Composição das Entradas</h4>
                <div class="dash-row">
                    <div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:4px;">Vendas (PDV)</div><div style="font-size:var(--font-size-lg);font-weight:700;color:var(--success);">${Utils.formatCurrency(s.sales_income)}</div></div>
                    <div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:4px;">Receitas Manuais</div><div style="font-size:var(--font-size-lg);font-weight:700;color:var(--success);">${Utils.formatCurrency(s.finance_income)}</div></div>
                    <div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:4px;">Despesas Pagas</div><div style="font-size:var(--font-size-lg);font-weight:700;color:var(--danger);">${Utils.formatCurrency(s.total_expense)}</div></div>
                    <div><div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:4px;">Despesas Pendentes</div><div style="font-size:var(--font-size-lg);font-weight:700;color:var(--warning);">${Utils.formatCurrency(s.pending_expense)}</div></div>
                </div>
            </div>`;
    },

    renderSellers(data) {
        const s = data.summary;
        return `
            <div class="dashboard-grid" style="margin-bottom:var(--space-lg);">
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">💰</div><div class="kpi-value">${Utils.formatCurrency(s.total_revenue)}</div><div class="kpi-label">Faturamento Total</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--info-bg);color:var(--info);">🧾</div><div class="kpi-value">${s.total_sales}</div><div class="kpi-label">Total de Vendas</div></div>
            </div>
            <div class="card" style="padding:var(--space-lg);">
                <h4 style="margin-bottom:var(--space-md);">🏆 Desempenho por Vendedor</h4>
                ${data.sellers.length ? `
                <div class="table-container"><table class="data-table"><thead><tr>
                    <th>Colaborador</th>
                    <th style="text-align:center">Qtd Vendas</th>
                    <th style="text-align:right">Faturamento</th>
                    <th style="text-align:right">Ticket Médio</th>
                </tr></thead><tbody>
                ${data.sellers.map(sl => `<tr>
                    <td data-label="Colaborador" style="font-weight:600">${Utils.escapeHTML(sl.name || '-')}</td>
                    <td data-label="Qtd Vendas" style="text-align:center">${sl.sales_count}</td>
                    <td data-label="Faturamento" style="text-align:right;color:var(--success)">${Utils.formatCurrency(sl.revenue)}</td>
                    <td data-label="Ticket Médio" style="text-align:right;color:var(--text-secondary)">${Utils.formatCurrency(sl.sales_count > 0 ? sl.revenue / sl.sales_count : 0)}</td>
                </tr>`).join('')}
                </tbody></table></div>` : '<p style="color:var(--text-muted);">Nenhuma venda no período.</p>'}
            </div>`;
    }
};

window.ReportsPage = ReportsPage;

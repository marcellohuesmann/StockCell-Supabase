/**
 * StockCell - Controle de Caixa
 */
const CashRegisterPage = {
    registerData: null,
    historyData: [],

    render() {
        return `
        <div class="page-content page-enter">
            <div class="page-header">
                <div>
                    <h2 class="page-title">💰 Controle de Caixa</h2>
                    <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Abertura, fechamento, sangrias e suprimentos</p>
                </div>
            </div>
            <div id="cashregister-content"><div class="loading-spinner"></div></div>
        </div>`;
    },

    async bind() {
        await this.loadCurrent();
    },

    async loadCurrent() {
        const container = document.getElementById('cashregister-content');
        if (!container) return;

        const result = await API.get('/cashregister/current');
        if (!result.success) {
            container.innerHTML = '<p style="color:var(--danger)">Erro ao carregar caixa.</p>';
            return;
        }

        this.registerData = result.data;

        if (!this.registerData) {
            this.renderClosed(container);
        } else {
            this.renderOpen(container);
        }
    },

    // ===== CAIXA FECHADO → Tela de Abertura =====
    renderClosed(container) {
        container.innerHTML = `
            <div class="cr-open-card">
                <div class="cr-open-icon">🔒</div>
                <h3 style="margin-bottom:var(--space-sm);">Caixa Fechado</h3>
                <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-xl);">Abra o caixa para começar a registrar vendas</p>
                <div class="form-group" style="max-width:280px;margin:0 auto var(--space-lg);">
                    <label class="form-label">Saldo Inicial (R$)</label>
                    <input type="number" class="form-input" id="cr-opening-balance" value="0" min="0" step="0.01"
                        style="text-align:center;font-size:var(--font-size-xl);font-weight:700;">
                </div>
                <button class="btn btn-primary btn-lg" id="btn-open-register" style="min-width:200px;">🔓 Abrir Caixa</button>
            </div>

            <div style="margin-top:var(--space-xl);">
                <h3 style="margin-bottom:var(--space-md);">📋 Últimos Caixas</h3>
                <div id="cr-history-container"><div class="loading-spinner"></div></div>
            </div>
        `;

        const btnOpen = document.getElementById('btn-open-register');
        if (btnOpen) btnOpen.addEventListener('click', () => this.openRegister());
        this.loadHistory();
    },

    // ===== CAIXA ABERTO → Tela de Operação =====
    renderOpen(container) {
        const d = this.registerData;
        const payLabels = { cash: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', store_credit: 'A Prazo' };

        container.innerHTML = `
            <div class="cr-status-bar cr-status-open">
                <span>🟢 Caixa Aberto</span>
                <span>Desde: ${Utils.formatDateTime(d.opened_at)} • Operador: ${Utils.escapeHTML(d.user_name || '-')}</span>
            </div>

            <!-- KPIs -->
            <div class="cr-kpi-grid">
                <div class="cr-kpi">
                    <div class="cr-kpi-label">Saldo Inicial</div>
                    <div class="cr-kpi-value">${Utils.formatCurrency(d.opening_balance)}</div>
                </div>
                <div class="cr-kpi">
                    <div class="cr-kpi-label">Vendas</div>
                    <div class="cr-kpi-value cr-kpi-success">${d.sales.total_sales} • ${Utils.formatCurrency(d.sales.total_revenue)}</div>
                </div>
                <div class="cr-kpi">
                    <div class="cr-kpi-label">Sangrias / Suprimentos</div>
                    <div class="cr-kpi-value cr-kpi-danger">-${Utils.formatCurrency(d.totalWithdrawn)} / +${Utils.formatCurrency(d.totalSupplied)}</div>
                </div>
                <div class="cr-kpi cr-kpi-highlight">
                    <div class="cr-kpi-label">💵 Dinheiro Esperado em Caixa</div>
                    <div class="cr-kpi-value cr-kpi-primary">${Utils.formatCurrency(d.expectedCash)}</div>
                </div>
            </div>

            <!-- Vendas por forma de pagamento -->
            ${d.paymentBreakdown.length ? `
            <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md);">
                <strong style="display:block;margin-bottom:var(--space-sm);">Vendas por Forma de Pagamento</strong>
                <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);">
                    ${d.paymentBreakdown.map(p => `
                        <div style="padding:8px 16px;border-radius:var(--radius-md);background:var(--bg-secondary);font-size:var(--font-size-sm);">
                            <span style="color:var(--text-muted);">${payLabels[p.method] || p.method}</span>
                            <strong style="display:block;font-size:var(--font-size-md);">${Utils.formatCurrency(p.total)}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Ações -->
            <div class="cr-actions">
                <button class="btn btn-warning" id="btn-withdraw" style="flex:1;">📤 Sangria</button>
                <button class="btn btn-success" id="btn-supply" style="flex:1;">📥 Suprimento</button>
                <button class="btn btn-danger" id="btn-close-register" style="flex:1;">🔒 Fechar Caixa</button>
            </div>
            
            <div style="margin-top:var(--space-md);">
                <button class="btn btn-primary" onclick="App.navigate('pdv')" style="width:100%; padding:18px; font-size:1.2rem; font-weight:800; border-radius:var(--radius-lg); box-shadow:0 4px 15px rgba(99,102,241,0.3); background:linear-gradient(135deg, var(--accent-primary), var(--accent-hover));">
                    🛒 NOVA VENDA (PDV)
                </button>
            </div>

            <!-- Movimentações do dia -->
            ${d.movements.length ? `
            <div class="card" style="margin-top:var(--space-lg);padding:var(--space-md);">
                <strong style="display:block;margin-bottom:var(--space-sm);">Movimentações</strong>
                <div class="table-container"><table class="data-table"><thead><tr>
                    <th>Hora</th><th>Tipo</th><th>Valor</th><th>Motivo</th><th>Operador</th>
                </tr></thead><tbody>
                    ${d.movements.map(m => `<tr>
                        <td>${Utils.formatTime(m.created_at)}</td>
                        <td>${m.type === 'withdraw' ? '<span class="badge badge-danger">Sangria</span>' : '<span class="badge badge-success">Suprimento</span>'}</td>
                        <td style="font-weight:700;color:${m.type === 'withdraw' ? 'var(--danger)' : 'var(--success)'};">
                            ${m.type === 'withdraw' ? '-' : '+'}${Utils.formatCurrency(m.amount)}
                        </td>
                        <td>${Utils.escapeHTML(m.reason || '-')}</td>
                        <td>${Utils.escapeHTML(m.user_name || '-')}</td>
                    </tr>`).join('')}
                </tbody></table></div>
            </div>
            ` : ''}
        `;

        document.getElementById('btn-withdraw').addEventListener('click', () => this.showMovementModal('withdraw'));
        document.getElementById('btn-supply').addEventListener('click', () => this.showMovementModal('supply'));
        document.getElementById('btn-close-register').addEventListener('click', () => this.showCloseModal());
    },

    // ===== AÇÕES =====
    async openRegister() {
        const balance = parseFloat(document.getElementById('cr-opening-balance')?.value) || 0;
        const result = await API.post('/cashregister/open', { opening_balance: balance });
        if (result.success) {
            Toast.success(result.message);
            // Atualiza o cache offline apenas se feito online (se for offline, a api-offline já fez isso corretamente)
            if (window.serverIsReachable !== false) {
                try {
                    const now = Utils.getLocalISOTime();
                    await OfflineDB.put('cash_registers', {
                        id: result.data ? result.data.id : OfflineDB.nextLocalId(),
                        opening_balance: balance,
                        status: 'open',
                        opened_at: now,
                        created_at: now
                    });
                    if (window.SyncEngine) window.SyncEngine.forceSync();
                } catch(e) {}
            }
            await this.loadCurrent();
        } else {
            Toast.error(result.message);
        }
    },

    showMovementModal(type) {
        const isWithdraw = type === 'withdraw';
        Modal.open({
            title: isWithdraw ? '📤 Registrar Sangria' : '📥 Registrar Suprimento',
            content: `
                <div class="form-group">
                    <label class="form-label">Valor (R$) *</label>
                    <input type="number" class="form-input" id="cr-mov-amount" min="0.01" step="0.01" placeholder="0,00"
                        style="font-size:var(--font-size-lg);font-weight:700;">
                </div>
                <div class="form-group">
                    <label class="form-label">Motivo</label>
                    <input type="text" class="form-input" id="cr-mov-reason" placeholder="${isWithdraw ? 'Ex: Pagamento de fornecedor' : 'Ex: Troco adicional'}">
                </div>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn ${isWithdraw ? 'btn-warning' : 'btn-success'}" id="cr-mov-confirm">${isWithdraw ? 'Registrar Sangria' : 'Registrar Suprimento'}</button>`,
        });
        document.getElementById('cr-mov-confirm').addEventListener('click', async () => {
            const amount = parseFloat(document.getElementById('cr-mov-amount').value);
            const reason = document.getElementById('cr-mov-reason').value;
            if (!amount || amount <= 0) { Toast.warning('Informe um valor válido.'); return; }
            const endpoint = isWithdraw ? '/cashregister/withdraw' : '/cashregister/supply';
            const r = await API.post(endpoint, { amount, reason });
            if (r.success) {
                Toast.success(r.message);
                document.querySelector('.modal-overlay')?.remove();
                await this.loadCurrent();
            } else { Toast.error(r.message); }
        });
    },

    showCloseModal() {
        const expected = this.registerData?.expectedCash || 0;
        Modal.open({
            title: '🔒 Fechar Caixa',
            content: `
                <div style="text-align:center;margin-bottom:var(--space-lg);">
                    <div style="font-size:var(--font-size-sm);color:var(--text-secondary);">Valor esperado em dinheiro:</div>
                    <div style="font-size:var(--font-size-2xl);font-weight:800;color:var(--accent-primary);">${Utils.formatCurrency(expected)}</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Valor Contado em Caixa (R$) *</label>
                    <input type="number" class="form-input" id="cr-counted" min="0" step="0.01" placeholder="0,00"
                        style="font-size:var(--font-size-lg);font-weight:700;text-align:center;">
                </div>
                <div id="cr-diff-display" style="display:none;text-align:center;padding:var(--space-sm);border-radius:var(--radius-sm);margin-bottom:var(--space-md);"></div>
                <div class="form-group">
                    <label class="form-label">Observações</label>
                    <input type="text" class="form-input" id="cr-close-notes" placeholder="Observações do fechamento">
                </div>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn btn-danger" id="cr-close-confirm">Confirmar Fechamento</button>`,
        });

        // Real-time difference
        document.getElementById('cr-counted')?.addEventListener('input', () => {
            const counted = parseFloat(document.getElementById('cr-counted').value) || 0;
            const diff = counted - expected;
            const display = document.getElementById('cr-diff-display');
            if (display) {
                display.style.display = '';
                if (Math.abs(diff) < 0.01) {
                    display.innerHTML = `<span style="color:var(--success);font-weight:700;">✅ Caixa confere!</span>`;
                    display.style.background = 'rgba(16,185,129,0.1)';
                } else if (diff > 0) {
                    display.innerHTML = `<span style="color:var(--warning);font-weight:700;">⬆️ Sobra: ${Utils.formatCurrency(diff)}</span>`;
                    display.style.background = 'rgba(245,158,11,0.1)';
                } else {
                    display.innerHTML = `<span style="color:var(--danger);font-weight:700;">⬇️ Falta: ${Utils.formatCurrency(Math.abs(diff))}</span>`;
                    display.style.background = 'rgba(239,68,68,0.1)';
                }
            }
        });

        document.getElementById('cr-close-confirm').addEventListener('click', async () => {
            const counted = document.getElementById('cr-counted').value;
            const notes = document.getElementById('cr-close-notes').value;
            if (!counted && counted !== '0') { Toast.warning('Informe o valor contado.'); return; }
            const r = await API.post('/cashregister/close', { counted_balance: parseFloat(counted), notes });
            if (r.success) {
                Toast.success(r.message);
                document.querySelector('.modal-overlay')?.remove();
                // Atualiza o cache offline apenas se feito online
                if (window.serverIsReachable !== false) {
                    try {
                        const registers = await OfflineDB.getAll('cash_registers');
                        const openReg = registers.find(reg => reg.status === 'open');
                        if (openReg) {
                            openReg.status = 'closed';
                            openReg.closed_at = Utils.getLocalISOTime();
                            openReg.closing_balance = parseFloat(counted);
                            await OfflineDB.put('cash_registers', openReg);
                        }
                        if (window.SyncEngine) window.SyncEngine.forceSync();
                    } catch(e) {}
                }
                await this.loadCurrent();
            } else { Toast.error(r.message); }
        });
    },

    async loadHistory() {
        const container = document.getElementById('cr-history-container');
        if (!container) return;
        const result = await API.get('/cashregister/history');
        if (!result.success || !result.data.length) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm);">Nenhum registro encontrado.</p>';
            return;
        }
        container.innerHTML = `
            <div class="table-container"><table class="data-table"><thead><tr>
                <th>Data Abertura</th><th>Fechamento</th><th>Operador</th>
                <th style="text-align:right">Saldo Inicial</th>
                <th style="text-align:center">Vendas</th>
                <th style="text-align:right">Total Vendido</th>
                <th style="text-align:right">Saldo Fechamento</th>
                <th style="text-align:center">Status</th>
            </tr></thead><tbody>
                ${result.data.map(r => `<tr>
                    <td>${Utils.formatDateTime(r.opened_at)}</td>
                    <td>${r.closed_at ? Utils.formatDateTime(r.closed_at) : '-'}</td>
                    <td>${Utils.escapeHTML(r.user_name || '-')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(r.opening_balance)}</td>
                    <td style="text-align:center">${r.sales_count || 0}</td>
                    <td style="text-align:right">${Utils.formatCurrency(r.sales_total || 0)}</td>
                    <td style="text-align:right">${r.closing_balance != null ? Utils.formatCurrency(r.closing_balance) : '-'}</td>
                    <td style="text-align:center">${r.status === 'open' ? '<span class="badge badge-success">Aberto</span>' : '<span class="badge badge-secondary">Fechado</span>'}</td>
                </tr>`).join('')}
            </tbody></table></div>
        `;
    },
};

/**
 * StockCell - Página de Estoque
 */
const StockPage = {
    products: [],
    movements: [],
    activeTab: 'overview',

    render() {
        return `
        <div class="page-content page-enter">
            <div class="page-header">
                <div>
                    <h2 class="page-title">Estoque</h2>
                    <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie entradas, saídas e ajustes</p>
                </div>
                <div style="display:flex;gap:var(--space-sm);">
                    <button class="btn btn-primary" id="btn-stock-entry">${Icons.plus} Entrada de Mercadoria</button>
                    <button class="btn btn-secondary" id="btn-stock-adjust">⚖️ Ajustar</button>
                </div>
            </div>
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);overflow-x:auto;padding-bottom:5px;">
                <button class="btn ${this.activeTab==='overview'?'btn-primary':'btn-secondary'} btn-sm" onclick="StockPage.switchTab('overview')">📊 Visão Geral</button>
                <button class="btn ${this.activeTab==='movements'?'btn-primary':'btn-secondary'} btn-sm" onclick="StockPage.switchTab('movements')">📋 Movimentações</button>
                <button class="btn ${this.activeTab==='low'?'btn-primary':'btn-secondary'} btn-sm" onclick="StockPage.switchTab('low')">⚠️ Estoque Baixo</button>
                <button class="btn ${this.activeTab==='purchases'?'btn-primary':'btn-secondary'} btn-sm" onclick="StockPage.switchTab('purchases')" style="white-space:nowrap;">📦 Pedidos de Compra</button>
            </div>
            <div id="stock-content"></div>
        </div>`;
    },

    async bind() {
        if (sessionStorage.getItem('sc_stock_tab')) {
            this.activeTab = sessionStorage.getItem('sc_stock_tab');
            sessionStorage.removeItem('sc_stock_tab');
        } else {
            this.activeTab = 'overview'; // Default se não houver flag
        }
        document.getElementById('btn-stock-entry').addEventListener('click', () => this.openEntryForm());
        document.getElementById('btn-stock-adjust').addEventListener('click', () => this.openAdjustForm());
        await this.loadTab();
    },

    async switchTab(tab) {
        this.activeTab = tab;
        App.navigate('stock');
    },

    async loadTab() {
        const container = document.getElementById('stock-content');
        if (!container) return;

        switch (this.activeTab) {
            case 'overview': await this.loadOverview(container); break;
            case 'movements': await this.loadMovements(container); break;
            case 'low': await this.loadLowStock(container); break;
            case 'purchases': await this.loadPurchases(container); break;
        }
    },

    async loadOverview(container) {
        const result = await API.get('/products?active=true&limit=100');
        if (!result.success) return;
        this.products = result.data;

        const totalItems = this.products.reduce((s, p) => s + p.current_stock, 0);
        const totalValue = this.products.reduce((s, p) => s + (p.current_stock * p.sale_price), 0);
        const lowCount = this.products.filter(p => p.is_low_stock).length;

        container.innerHTML = `
            <div class="dashboard-grid" style="margin-bottom:var(--space-lg);">
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--info-bg);color:var(--info);">📦</div><div class="kpi-value">${this.products.length}</div><div class="kpi-label">Produtos</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:rgba(var(--accent-primary-rgb),0.1);color:var(--accent-primary);">🔢</div><div class="kpi-value">${totalItems}</div><div class="kpi-label">Itens em Estoque</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--success-bg);color:var(--success);">💰</div><div class="kpi-value">${Utils.formatCurrency(totalValue)}</div><div class="kpi-label">Valor em Estoque</div></div>
                <div class="kpi-card"><div class="kpi-icon" style="background:var(--warning-bg);color:var(--warning);">⚠️</div><div class="kpi-value">${lowCount}</div><div class="kpi-label">Estoque Baixo</div></div>
            </div>
            <div class="card"><div class="table-container"><table class="data-table"><thead><tr>
                <th>Produto</th><th class="hide-mobile">Categoria</th><th style="text-align:center">Estoque</th><th style="text-align:center" class="hide-mobile">Mínimo</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Valor Total</th>
            </tr></thead><tbody>
                ${this.products.map(p => `<tr style="cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="StockPage.openEntryForm(${p.id}, 1)">
                    <td data-label="Produto"><strong>${Utils.escapeHTML(p.name)}</strong></td>
                    <td data-label="Categoria" class="hide-mobile">${p.category_icon||''} ${Utils.escapeHTML(p.category_name||'-')}</td>
                    <td data-label="Estoque" style="text-align:center">${p.is_low_stock?`<span class="badge badge-warning">${p.current_stock}</span>`:`<span class="badge badge-success">${p.current_stock}</span>`}</td>
                    <td data-label="Mínimo" style="text-align:center;color:var(--text-muted)" class="hide-mobile">${p.min_stock}</td>
                    <td data-label="Valor Unit." style="text-align:right">${Utils.formatCurrency(p.sale_price)}</td>
                    <td data-label="Valor Total" style="text-align:right;font-weight:600">${Utils.formatCurrency(p.current_stock*p.sale_price)}</td>
                </tr>`).join('')}
            </tbody></table></div></div>
        `;
    },

    async loadMovements(container) {
        const result = await API.get('/stock/movements?limit=50');
        if (!result.success) return;

        const typeLabels = { entry: '📥 Entrada', exit: '📤 Saída', adjustment: '⚖️ Ajuste' };
        const typeColors = { entry: 'var(--success)', exit: 'var(--danger)', adjustment: 'var(--warning)' };

        container.innerHTML = `<div class="card"><div class="table-container"><table class="data-table"><thead><tr>
            <th>Data</th><th>Tipo</th><th>Produto</th><th style="text-align:center">Quantidade</th><th style="text-align:center" class="hide-mobile">Saldo</th><th class="hide-mobile">Motivo</th>
        </tr></thead><tbody>
            ${result.data.length ? result.data.map(m => `<tr>
                <td data-label="Data" style="font-size:var(--font-size-xs);color:var(--text-muted)">${Utils.formatDateTime(m.created_at)}</td>
                <td data-label="Tipo" style="color:${typeColors[m.type]||''}">${typeLabels[m.type]||m.type}</td>
                <td data-label="Produto"><strong>${Utils.escapeHTML(m.product_name)}</strong></td>
                <td data-label="Quantidade" style="text-align:center;font-weight:600;color:${m.quantity>0?'var(--success)':'var(--danger)'}">${m.quantity>0?'+':''}${m.quantity}</td>
                <td data-label="Saldo" style="text-align:center" class="hide-mobile">${m.balance_after}</td>
                <td data-label="Motivo" style="font-size:var(--font-size-xs);color:var(--text-secondary)" class="hide-mobile">${Utils.escapeHTML(m.reason||'-')}</td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--space-xl);color:var(--text-muted)">Nenhuma movimentação registrada</td></tr>'}
        </tbody></table></div></div>`;
    },

    async loadLowStock(container) {
        const result = await API.get('/stock/low');
        if (!result.success) return;

        if (!result.data.length) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Nenhum produto com estoque baixo!</div></div>';
            return;
        }

        container.innerHTML = `<div class="card"><div class="table-container"><table class="data-table"><thead><tr>
            <th>Produto</th><th class="hide-mobile">Categoria</th><th style="text-align:center">Estoque Atual</th><th style="text-align:center">Mínimo</th><th style="text-align:center">Repor</th>
        </tr></thead><tbody>
            ${result.data.map(p => `<tr style="cursor:pointer;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="StockPage.openEntryForm(${p.id}, ${Math.max(1, p.min_stock - p.current_stock + 5)})">
                <td data-label="Produto"><strong>${Utils.escapeHTML(p.name)}</strong></td>
                <td data-label="Categoria" class="hide-mobile">${Utils.escapeHTML(p.category_name||'-')}</td>
                <td data-label="Estoque" style="text-align:center"><span class="badge badge-danger">${p.current_stock}</span></td>
                <td data-label="Mínimo" style="text-align:center">${p.min_stock}</td>
                <td data-label="Repor" style="text-align:center;font-weight:600;color:var(--warning)">${Math.max(0,p.min_stock-p.current_stock+5)}</td>
            </tr>`).join('')}
        </tbody></table></div></div>`;
    },

    async openEntryForm(preSelectedProductId = null, preSelectedQty = 1) {
        const productsResult = await API.get('/products?active=true&limit=200');
        const suppliersResult = await API.get('/suppliers');
        if (!productsResult.success) return;
        const products = productsResult.data;
        const suppliers = suppliersResult.success ? suppliersResult.data : [];

        Modal.open({
            title: '📥 Entrada de Mercadoria', size: 'lg',
            content: `
                <div class="form-group">
                    <label class="form-label">Fornecedor</label>
                    <select class="form-input" id="entry-supplier"><option value="">Selecione (opcional)</option>
                        ${suppliers.map(s => `<option value="${s.id}">${Utils.escapeHTML(s.company_name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Observações</label>
                    <input type="text" class="form-input" id="entry-notes" placeholder="NF, lote, etc.">
                </div>
                <hr style="border-color:var(--border-light);margin:var(--space-md) 0">
                <div id="entry-items">
                    <div class="entry-item-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:var(--space-sm);align-items:end;margin-bottom:var(--space-sm);">
                        <div class="form-group" style="margin:0"><label class="form-label">Produto *</label>
                            <select class="form-input entry-product">
                                <option value="">Selecione um produto</option>
                                ${products.map(p=>`<option value="${p.id}" data-cost="${p.cost_price}" ${p.id == preSelectedProductId ? 'selected' : ''}>${Utils.escapeHTML(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0"><label class="form-label">Qtd *</label><input type="number" class="form-input entry-qty" value="${preSelectedQty}" min="1"></div>
                        <div class="form-group" style="margin:0"><label class="form-label">Custo Unit.</label><input type="number" class="form-input entry-cost" step="0.01" min="0" placeholder="0,00"></div>
                        <div></div>
                    </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" id="entry-add-row" style="margin-top:var(--space-sm);">+ Adicionar outro item</button>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn btn-primary" id="entry-save">Registrar Entrada</button>`,
        });

        // Set initial cost from product
        document.querySelectorAll('.entry-product').forEach(sel => {
            const costInput = sel.closest('.entry-item-row').querySelector('.entry-cost');
            const opt = sel.options[sel.selectedIndex];
            if (opt && costInput) costInput.value = opt.dataset.cost || '';
            sel.addEventListener('change', () => { costInput.value = sel.options[sel.selectedIndex]?.dataset.cost || ''; });
        });

        document.getElementById('entry-add-row').addEventListener('click', () => {
            const container = document.getElementById('entry-items');
            const newRow = document.createElement('div');
            newRow.className = 'entry-item-row';
            newRow.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:var(--space-sm);align-items:end;margin-bottom:var(--space-sm);';
            newRow.innerHTML = `
                <div class="form-group" style="margin:0"><select class="form-input entry-product">${products.map(p=>`<option value="${p.id}" data-cost="${p.cost_price}">${Utils.escapeHTML(p.name)}</option>`).join('')}</select></div>
                <div class="form-group" style="margin:0"><input type="number" class="form-input entry-qty" value="1" min="1"></div>
                <div class="form-group" style="margin:0"><input type="number" class="form-input entry-cost" step="0.01" min="0" placeholder="0,00"></div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.entry-item-row').remove()" style="color:var(--danger)">✕</button>
            `;
            container.appendChild(newRow);
            const newSel = newRow.querySelector('.entry-product');
            const newCost = newRow.querySelector('.entry-cost');
            newCost.value = newSel.options[newSel.selectedIndex]?.dataset.cost || '';
            newSel.addEventListener('change', () => { newCost.value = newSel.options[newSel.selectedIndex]?.dataset.cost || ''; });
        });

        document.getElementById('entry-save').addEventListener('click', async () => {
            const rows = document.querySelectorAll('.entry-item-row');
            const items = [];
            rows.forEach(row => {
                const productId = row.querySelector('.entry-product')?.value;
                const qty = parseInt(row.querySelector('.entry-qty')?.value) || 0;
                const cost = parseFloat(row.querySelector('.entry-cost')?.value) || 0;
                if (productId && qty > 0) items.push({ product_id: parseInt(productId), quantity: qty, unit_cost: cost });
            });
            if (!items.length) { Toast.warning('Adicione pelo menos um item.'); return; }
            const result = await API.post('/stock/entry', {
                items, supplier_id: document.getElementById('entry-supplier').value || null,
                notes: document.getElementById('entry-notes').value,
            });
            if (result.success) { Toast.success(result.message); document.querySelector('.modal-overlay')?.remove(); this.switchTab(this.activeTab); }
            else { Toast.error(result.message); }
        });
    },

    async openAdjustForm() {
        const productsResult = await API.get('/products?active=true&limit=200');
        if (!productsResult.success) return;
        const products = productsResult.data;

        Modal.open({
            title: '⚖️ Ajuste de Estoque',
            content: `
                <div class="form-group">
                    <label class="form-label">Produto *</label>
                    <select class="form-input" id="adjust-product">
                        ${products.map(p=>`<option value="${p.id}" data-stock="${p.current_stock}">${Utils.escapeHTML(p.name)} (atual: ${p.current_stock})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Nova Quantidade *</label>
                    <input type="number" class="form-input" id="adjust-qty" min="0" value="${products[0]?.current_stock||0}">
                </div>
                <div class="form-group">
                    <label class="form-label">Justificativa *</label>
                    <input type="text" class="form-input" id="adjust-reason" placeholder="Ex: Conferência de inventário, perda, erro de contagem">
                </div>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn btn-warning" id="adjust-save">Ajustar Estoque</button>`,
        });

        document.getElementById('adjust-product').addEventListener('change', (e) => {
            document.getElementById('adjust-qty').value = e.target.options[e.target.selectedIndex].dataset.stock || 0;
        });

        document.getElementById('adjust-save').addEventListener('click', async () => {
            const result = await API.post('/stock/adjustment', {
                product_id: parseInt(document.getElementById('adjust-product').value),
                new_quantity: parseInt(document.getElementById('adjust-qty').value),
                reason: document.getElementById('adjust-reason').value,
            });
            if (result.success) { Toast.success(result.message); document.querySelector('.modal-overlay')?.remove(); this.switchTab(this.activeTab); }
            else { Toast.error(result.message); }
        });
    },

    // ==========================================
    // PEDIDOS DE COMPRA (PURCHASES)
    // ==========================================
    async loadPurchases(container) {
        const result = await API.get('/purchases');
        if (!result.success) return;

        const purchases = result.data;

        container.innerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-md);">
                <button class="btn btn-primary" onclick="StockPage.openPurchaseForm()">+ Novo Pedido de Compra</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Data Esperada</th>
                                <th>Fornecedor</th>
                                <th style="text-align:right">Total</th>
                                <th style="text-align:center">Status</th>
                                <th style="text-align:center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${purchases.length ? purchases.map(p => `
                                <tr>
                                    <td><strong>#${String(p.id).padStart(4,'0')}</strong><br><span style="font-size:10px;color:var(--text-muted);">${Utils.formatDateTime(p.created_at)}</span></td>
                                    <td>${p.expected_date ? Utils.formatDate(p.expected_date) : '-'}</td>
                                    <td><strong>${Utils.escapeHTML(p.supplier_name || '-')}</strong></td>
                                    <td style="text-align:right; font-weight:600;">${Utils.formatCurrency(p.total_amount)}</td>
                                    <td style="text-align:center">
                                        ${p.status === 'pending' ? '<span class="badge badge-warning">Pendente</span>' : ''}
                                        ${p.status === 'received' ? '<span class="badge badge-success">Recebido</span>' : ''}
                                        ${p.status === 'cancelled' ? '<span class="badge badge-danger">Cancelado</span>' : ''}
                                    </td>
                                    <td style="text-align:center">
                                        <button class="btn btn-sm btn-ghost" onclick='StockPage.viewPurchase(${JSON.stringify(p).replace(/'/g, "&#39;")})' title="Ver Detalhes">👁️</button>
                                        ${p.status === 'pending' ? `
                                            <button class="btn btn-sm btn-ghost" style="color:var(--success);" onclick="StockPage.receivePurchase(${p.id})" title="Receber Pedido">📥</button>
                                            <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="StockPage.cancelPurchase(${p.id})" title="Cancelar Pedido">🗑️</button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" class="text-center text-muted">Nenhum pedido de compra registrado.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async openPurchaseForm() {
        const [productsRes, suppliersRes] = await Promise.all([
            API.get('/products?active=true&limit=200'),
            API.get('/suppliers')
        ]);
        if (!productsRes.success || !suppliersRes.success) return;
        
        const products = productsRes.data;
        const suppliers = suppliersRes.data;

        Modal.open({
            title: '📦 Novo Pedido de Compra',
            size: 'lg',
            content: `
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div class="form-group" style="flex:2;">
                        <label class="form-label">Fornecedor *</label>
                        <select class="form-input" id="pur-supplier">
                            <option value="">Selecione o Fornecedor</option>
                            ${suppliers.map(s => `<option value="${s.id}">${Utils.escapeHTML(s.company_name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label class="form-label">Data Esperada</label>
                        <input type="date" class="form-input" id="pur-date">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Observações</label>
                    <input type="text" class="form-input" id="pur-notes" placeholder="Condições de pagamento, frete, etc.">
                </div>
                <hr style="border-color:var(--border-light);margin:var(--space-md) 0">
                <h4>Itens do Pedido</h4>
                <div id="pur-items" style="margin-top:10px;">
                    <div class="pur-item-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:var(--space-sm);align-items:end;margin-bottom:var(--space-sm);">
                        <div class="form-group" style="margin:0"><label class="form-label">Produto *</label>
                            <select class="form-input pur-product">
                                <option value="">Selecione um produto</option>
                                ${products.map(p=>`<option value="${p.id}" data-cost="${p.cost_price}">${Utils.escapeHTML(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0"><label class="form-label">Qtd *</label><input type="number" class="form-input pur-qty" value="1" min="1"></div>
                        <div class="form-group" style="margin:0"><label class="form-label">Custo Unit.</label><input type="number" class="form-input pur-cost" step="0.01" min="0" placeholder="0,00"></div>
                        <div></div>
                    </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" id="pur-add-row" style="margin-top:var(--space-sm);">+ Adicionar outro item</button>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn btn-primary" id="pur-save">Salvar Pedido</button>`
        });

        const setupRow = (row) => {
            const sel = row.querySelector('.pur-product');
            const cost = row.querySelector('.pur-cost');
            sel.addEventListener('change', () => { cost.value = sel.options[sel.selectedIndex]?.dataset.cost || ''; });
        };
        
        document.querySelectorAll('.pur-item-row').forEach(setupRow);

        document.getElementById('pur-add-row').addEventListener('click', () => {
            const container = document.getElementById('pur-items');
            const newRow = document.createElement('div');
            newRow.className = 'pur-item-row';
            newRow.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 40px;gap:var(--space-sm);align-items:end;margin-bottom:var(--space-sm);';
            newRow.innerHTML = `
                <div class="form-group" style="margin:0"><select class="form-input pur-product"><option value="">Selecione...</option>${products.map(p=>`<option value="${p.id}" data-cost="${p.cost_price}">${Utils.escapeHTML(p.name)}</option>`).join('')}</select></div>
                <div class="form-group" style="margin:0"><input type="number" class="form-input pur-qty" value="1" min="1"></div>
                <div class="form-group" style="margin:0"><input type="number" class="form-input pur-cost" step="0.01" min="0" placeholder="0,00"></div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.pur-item-row').remove()" style="color:var(--danger)">✕</button>
            `;
            container.appendChild(newRow);
            setupRow(newRow);
        });

        document.getElementById('pur-save').addEventListener('click', async () => {
            const supplier_id = document.getElementById('pur-supplier').value;
            if (!supplier_id) return Toast.warning('Selecione um fornecedor.');

            const items = [];
            document.querySelectorAll('.pur-item-row').forEach(row => {
                const product_id = row.querySelector('.pur-product')?.value;
                const quantity = parseInt(row.querySelector('.pur-qty')?.value) || 0;
                const unit_cost = parseFloat(row.querySelector('.pur-cost')?.value) || 0;
                if (product_id && quantity > 0) items.push({ product_id: parseInt(product_id), quantity, unit_cost });
            });

            if (!items.length) return Toast.warning('Adicione pelo menos um item válido.');

            const payload = {
                supplier_id: parseInt(supplier_id),
                expected_date: document.getElementById('pur-date').value || null,
                notes: document.getElementById('pur-notes').value,
                items
            };

            const result = await API.post('/purchases', payload);
            if (result.success) {
                Toast.success(result.message);
                document.querySelector('.modal-overlay').remove();
                this.loadPurchases(document.getElementById('stock-content'));
            } else {
                Toast.error(result.message);
            }
        });
    },

    viewPurchase(p) {
        Modal.open({
            title: `Detalhes do Pedido #${String(p.id).padStart(4,'0')}`,
            size: 'md',
            content: `
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:14px;">
                    <div><strong>Fornecedor:</strong> ${Utils.escapeHTML(p.supplier_name || '-')}</div>
                    <div><strong>Status:</strong> ${p.status}</div>
                </div>
                ${p.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:15px;">Obs: ${Utils.escapeHTML(p.notes)}</div>` : ''}
                <table class="data-table">
                    <thead>
                        <tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Custo</th><th style="text-align:right">Total</th></tr>
                    </thead>
                    <tbody>
                        ${p.items.map(i => `
                            <tr>
                                <td>${Utils.escapeHTML(i.product_name)}</td>
                                <td style="text-align:center">${i.quantity}</td>
                                <td style="text-align:right">${Utils.formatCurrency(i.unit_cost)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(i.total_cost)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr><td colspan="3" style="text-align:right;font-weight:bold;">TOTAL:</td><td style="text-align:right;font-weight:bold;">${Utils.formatCurrency(p.total_amount)}</td></tr>
                    </tfoot>
                </table>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Fechar</button>`
        });
    },

    async receivePurchase(id) {
        Modal.open({
            title: '📥 Receber Pedido de Compra',
            content: `
                <p>O pedido foi entregue? Confirme o recebimento para dar entrada automática no estoque de todos os itens do pedido.</p>
                <div style="margin-top:20px; background:var(--bg-input); padding:15px; border-radius:8px;">
                    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;">
                        <input type="checkbox" id="pur-gen-finance" checked style="accent-color:var(--accent-primary); width:18px;height:18px;">
                        Gerar Conta a Pagar no Financeiro automaticamente?
                    </label>
                    <div id="pur-finance-options" style="margin-top:15px;">
                        <label class="form-label">Data de Vencimento do Boleto/Fatura</label>
                        <input type="date" id="pur-due-date" class="form-input">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" id="pur-confirm-receive">Confirmar Recebimento</button>
            `
        });

        document.getElementById('pur-gen-finance').addEventListener('change', (e) => {
            document.getElementById('pur-finance-options').style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('pur-confirm-receive').addEventListener('click', async () => {
            const generate_payable = document.getElementById('pur-gen-finance').checked;
            const due_date = document.getElementById('pur-due-date').value;

            const result = await API.put(`/purchases/${id}/receive`, { generate_payable, due_date });
            if (result.success) {
                Toast.success(result.message);
                document.querySelector('.modal-overlay').remove();
                this.loadPurchases(document.getElementById('stock-content'));
            } else {
                Toast.error(result.message);
            }
        });
    },

    async cancelPurchase(id) {
        Modal.confirm('Tem certeza que deseja cancelar este pedido de compra? Esta ação não pode ser desfeita.', async () => {
            const result = await API.delete(`/purchases/${id}`);
            if (result.success) {
                Toast.success(result.message);
                this.loadPurchases(document.getElementById('stock-content'));
            } else {
                Toast.error(result.message);
            }
        });
    }
};

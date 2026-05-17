/**
 * StockCell - Assistência Técnica (O.S.)
 */
const OSPage = {
    osList: [],
    customers: [],
    products: [], // Para puxar peças
    selectedCardId: null,

    render() {
        return `
            <div class="header-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
                <h2>Assistência Técnica</h2>
                <button class="btn btn-primary" onclick="OSPage.openForm()">
                    ${Icons.plus} Nova O.S.
                </button>
            </div>
            
            <div class="kanban-board" id="os-kanban-board" style="display:flex; gap:15px; overflow-x:auto; padding-bottom:10px; height:calc(100vh - 180px);">
                <!-- Colunas serão renderizadas aqui -->
            </div>
        `;
    },

    async bind() {
        await this.loadData();
    },

    async loadData() {
        try {
            const [osRes, custRes, prodRes] = await Promise.all([
                API.get('/os'),
                API.get('/customers'),
                API.get('/products')
            ]);
            
            if (osRes.success) this.osList = osRes.data;
            if (custRes.success) this.customers = custRes.data;
            if (prodRes.success) {
                this.products = Array.isArray(prodRes.data) ? prodRes.data : [];
                console.log(`[O.S.] Produtos carregados: ${this.products.length} (${this.products.filter(p => p.is_service).length} serviços, ${this.products.filter(p => !p.is_service).length} peças)`);
            } else {
                console.warn('[O.S.] Falha ao carregar produtos:', prodRes.message);
            }
            
            this.renderKanban();
        } catch (e) {
            console.error('Erro ao carregar dados O.S.:', e);
            Toast.error('Erro ao carregar Ordens de Serviço.');
        }
    },

    renderKanban() {
        const board = document.getElementById('os-kanban-board');
        if (!board) return;

        const columns = [
            { id: 'budgeting', title: 'Orçamentando', color: 'var(--text-muted)' },
            { id: 'waiting_parts', title: 'Aguardando Peça', color: 'var(--warning)' },
            { id: 'approved', title: 'Aprovado', color: 'var(--accent-primary)' },
            { id: 'in_repair', title: 'Em Reparo', color: 'var(--info)' },
            { id: 'ready', title: 'Pronto', color: 'var(--success)' },
            { id: 'delivered', title: 'Entregue', color: 'var(--text-main)' }
            // cancelled can be hidden from active kanban, or placed at the end
        ];

        let html = '';
        columns.forEach(col => {
            const items = this.osList.filter(o => o.status === col.id);
            html += `
                <div class="kanban-column" style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; width:280px; min-width:280px; display:flex; flex-direction:column; max-height:100%;">
                    <div class="kanban-column-header" data-col-status="${col.id}" onclick="OSPage.onColumnClick('${col.id}')" style="padding:15px; border-bottom:1px solid var(--border); font-weight:bold; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:background 0.2s;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:10px; height:10px; border-radius:50%; background-color:${col.color}"></div>
                            ${col.title}
                        </div>
                        <span style="font-size:12px; background:var(--bg-main); padding:2px 8px; border-radius:12px; color:var(--text-muted);">${items.length}</span>
                    </div>
                    <div class="kanban-column-body" data-status="${col.id}" style="padding:10px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;" ondragover="OSPage.allowDrop(event)" ondrop="OSPage.drop(event)">
                        ${items.map(o => this.renderCard(o)).join('')}
                        ${items.length === 0 ? `<div style="text-align:center; color:var(--border); font-size:12px; padding:20px 0; user-select:none;">Vazio</div>` : ''}
                    </div>
                </div>
            `;
        });

        board.innerHTML = html;
    },

    renderCard(os) {
        let borderColor = 'var(--border)';
        let borderWidth = '1px';
        let alertBadge = '';

        if (['budgeting', 'waiting_parts', 'in_repair'].includes(os.status)) {
            if (os.missing_parts_count > 0) {
                borderColor = 'var(--warning)';
                borderWidth = '2px';
                alertBadge = `<span title="Falta peça no estoque" style="font-size:12px;">⚠️</span>`;
            } else if (os.total_amount > 0) {
                borderColor = 'var(--success)';
                borderWidth = '2px';
                alertBadge = `<span title="Peças disponíveis no estoque" style="font-size:12px;">✅</span>`;
            }
        } else if (os.status === 'ready') {
            const daysInReady = Math.floor((new Date() - new Date(os.updated_at || os.created_at)) / (1000 * 60 * 60 * 24));
            if (daysInReady >= 90) {
                borderColor = 'var(--danger)';
                borderWidth = '2px';
                alertBadge = `<span title="Prazo de retirada esgotado (${daysInReady} dias)" style="font-size:12px;">🚨</span>`;
            } else if (daysInReady >= 45) {
                borderColor = 'var(--warning)';
                borderWidth = '2px';
                alertBadge = `<span title="Aparelho esquecido (${daysInReady} dias)" style="font-size:12px;">⏰</span>`;
            }
        }

        return `
            <div class="kanban-card" draggable="true" ondragstart="OSPage.drag(event)" data-id="${os.id}" onclick="OSPage.openForm(${os.id})"
                style="background:var(--bg-main); border:${borderWidth} solid ${borderColor}; border-radius:8px; padding:12px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.05); transition:transform 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
                    <div style="font-size:11px; font-weight:bold; color:var(--text-muted);">#${String(os.id).padStart(4,'0')}</div>
                    <div style="display:flex; gap:5px; align-items:center;">
                        ${alertBadge}
                        <div style="font-size:11px; color:var(--text-muted);">${Utils.formatDate(os.created_at)}</div>
                    </div>
                </div>
                <div style="font-weight:bold; font-size:14px; margin-bottom:4px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${Utils.escapeHTML(os.customer_name || 'Cliente Avulso')}
                </div>
                <div style="font-size:12px; color:var(--accent-primary); margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    📱 ${Utils.escapeHTML(os.device_model)}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-light); padding-top:8px;">
                    <div style="font-size:12px; font-weight:bold; color:${os.total_amount > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                        ${Utils.formatCurrency(os.total_amount)}
                    </div>
                    <button onclick="event.stopPropagation(); OSPage.showMoveOptions(${os.id}, event)"
                        title="Mover O.S. para outra etapa"
                        style="background:none; border:1px solid var(--border); border-radius:6px; padding:3px 8px; cursor:pointer; font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:3px; transition:all 0.15s;"
                        onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.color='var(--accent-primary)'"
                        onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-muted)'"
                    >↔ Mover</button>
                </div>
            </div>
        `;
    },

    drag(ev) {
        ev.dataTransfer.setData("text", ev.currentTarget.dataset.id);
        ev.currentTarget.style.opacity = "0.5";
    },

    allowDrop(ev) {
        ev.preventDefault();
        // Highlight column
        const column = ev.currentTarget;
        column.style.background = 'var(--bg-main)';
    },

    async drop(ev) {
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text");
        let column = ev.target.closest('.kanban-column-body');
        
        document.querySelectorAll('.kanban-column-body').forEach(c => c.style.background = 'transparent');
        if (!column) return;
        
        const newStatus = column.dataset.status;
        const os = this.osList.find(o => o.id == id);
        if (!os || os.status === newStatus) {
            this.renderKanban(); 
            return;
        }

        const oldStatus = os.status;

        // Intercept approval to ask for serials if needed
        if (newStatus === 'approved' && ['budgeting', 'waiting_parts'].includes(oldStatus)) {
            // Revert optimistic temporarily
            this.renderKanban(); 
            
            try {
                const res = await API.get(`/os/${id}`);
                if (!res.success) throw new Error();
                const fullOs = res.data;
                
                const itemsRequiringSerials = [];
                for (let item of fullOs.items) {
                    if (item.item_type === 'product') {
                        const prod = this.products.find(p => p.id === item.product_id);
                        if (prod && prod.track_serial) {
                            itemsRequiringSerials.push(item);
                        }
                    }
                }

                if (itemsRequiringSerials.length > 0) {
                    this.promptForSerials(id, itemsRequiringSerials, newStatus, oldStatus);
                    return;
                }
            } catch(e) {
                Toast.error('Erro ao verificar itens da O.S.');
                return;
            }
        }

        await this.executeStatusChange(id, newStatus, oldStatus, {});
    },

    async executeStatusChange(id, newStatus, oldStatus, serialsPayload = {}) {
        const os = this.osList.find(o => o.id == id);
        
        // Optimistic UI update
        os.status = newStatus;
        this.renderKanban();

        try {
            const res = await API.put(`/os/${id}/status`, { status: newStatus, serials: serialsPayload });
            if (!res.success) throw new Error(res.message);
            Toast.success('Status atualizado!');
            
            if (newStatus === 'delivered') {
                this.promptPayment(os);
            }
        } catch (e) {
            console.error('Erro ao mover O.S.', e);
            Toast.error(e.message || 'Erro ao atualizar status.');
            os.status = oldStatus; // Revert
            this.renderKanban();
        }
    },

    // ===== CLICK-TO-MOVE (Mobile/Touch-Friendly) =====
    showMoveOptions(osId, event) {
        event.stopPropagation();
        const os = this.osList.find(o => o.id == osId);
        if (!os) return;

        // Toggle: se clicar no mesmo card, deseleciona
        if (this.selectedCardId == osId) { this.clearSelection(); return; }

        this.clearSelection();
        this.selectedCardId = osId;

        // Destacar card selecionado
        const card = document.querySelector(`.kanban-card[data-id="${osId}"]`);
        if (card) {
            card.style.outline = '2px solid var(--accent-primary)';
            card.style.outlineOffset = '2px';
            card.style.boxShadow = '0 0 15px rgba(99,102,241,0.35)';
        }

        // Destacar colunas-destino válidas
        document.querySelectorAll('.kanban-column-header').forEach(h => {
            if (h.dataset.colStatus !== os.status) {
                h.style.background = 'rgba(99,102,241,0.08)';
                h.style.borderBottom = '2px solid var(--accent-primary)';
            }
        });

        const statuses = [
            { id: 'budgeting', title: 'Orçamentando', color: 'var(--text-muted)' },
            { id: 'waiting_parts', title: 'Aguard. Peça', color: 'var(--warning)' },
            { id: 'approved', title: 'Aprovado', color: 'var(--accent-primary)' },
            { id: 'in_repair', title: 'Em Reparo', color: 'var(--info)' },
            { id: 'ready', title: 'Pronto', color: 'var(--success)' },
            { id: 'delivered', title: 'Entregue', color: 'var(--text-main)' }
        ].filter(s => s.id !== os.status);

        const panel = document.createElement('div');
        panel.id = `move-panel-${osId}`;
        panel.className = 'kanban-move-panel';
        panel.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; padding:8px; margin-top:6px; background:var(--bg-card); border:1px solid var(--accent-primary); border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);';
        panel.innerHTML = `
            <div style="width:100%; font-size:10px; color:var(--text-muted); margin-bottom:2px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">📍 Mover para:</div>
            ${statuses.map(s => `
                <button onclick="event.stopPropagation(); OSPage.moveCard(${osId}, '${s.id}')"
                    style="flex:1; min-width:calc(33% - 4px); padding:6px 4px; border:1px solid var(--border); background:var(--bg-main); color:var(--text-main); border-radius:6px; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:4px; justify-content:center; transition:all 0.15s;"
                    onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='var(--bg-secondary)'; this.style.transform='scale(1.03)'"
                    onmouseout="this.style.borderColor='var(--border)'; this.style.background='var(--bg-main)'; this.style.transform='scale(1)'"
                ><span style="width:8px; height:8px; border-radius:50%; background:${s.color}; flex-shrink:0;"></span>${s.title}</button>
            `).join('')}
        `;
        if (card) card.after(panel);
    },

    clearSelection() {
        this.selectedCardId = null;
        document.querySelectorAll('.kanban-card').forEach(c => {
            c.style.outline = '';
            c.style.outlineOffset = '';
            c.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        });
        document.querySelectorAll('.kanban-move-panel').forEach(p => p.remove());
        document.querySelectorAll('.kanban-column-header').forEach(h => {
            h.style.background = '';
            h.style.borderBottom = '1px solid var(--border)';
        });
    },

    async moveCard(osId, newStatus) {
        const os = this.osList.find(o => o.id == osId);
        if (!os) return;
        const oldStatus = os.status;
        this.clearSelection();

        if (newStatus === 'approved' && ['budgeting', 'waiting_parts'].includes(oldStatus)) {
            try {
                const res = await API.get(`/os/${osId}`);
                if (!res.success) throw new Error();
                const fullOs = res.data;
                const itemsRequiringSerials = [];
                for (let item of fullOs.items) {
                    if (item.item_type === 'product') {
                        const prod = this.products.find(p => p.id === item.product_id);
                        if (prod && prod.track_serial) itemsRequiringSerials.push(item);
                    }
                }
                if (itemsRequiringSerials.length > 0) {
                    this.promptForSerials(osId, itemsRequiringSerials, newStatus, oldStatus);
                    return;
                }
            } catch(e) { Toast.error('Erro ao verificar itens da O.S.'); return; }
        }
        await this.executeStatusChange(osId, newStatus, oldStatus, {});
    },

    onColumnClick(targetStatus) {
        if (!this.selectedCardId) return;
        const os = this.osList.find(o => o.id == this.selectedCardId);
        if (!os || os.status === targetStatus) { this.clearSelection(); return; }
        this.moveCard(this.selectedCardId, targetStatus);
    },

    promptForSerials(osId, items, newStatus, oldStatus) {
        let html = '<p>As peças listadas abaixo exigem rastreamento por IMEI/Série para dar baixa no estoque. Por favor, informe-os:</p>';
        html += '<div style="margin-top:15px; display:flex; flex-direction:column; gap:15px;">';
        
        items.forEach(item => {
            html += `<div style="background:var(--bg-main); padding:10px; border-radius:8px; border:1px solid var(--border);">`;
            html += `<div style="font-weight:bold; font-size:14px; margin-bottom:10px;">${Utils.escapeHTML(item.product_name)} (Qtd: ${item.quantity})</div>`;
            for (let i = 0; i < item.quantity; i++) {
                html += `
                    <div style="margin-bottom:5px;">
                        <input type="text" class="form-input os-serial-input" data-itemid="${item.id}" placeholder="Bipar/Digitar Serial ${i+1}" style="font-family:monospace;" required>
                    </div>
                `;
            }
            html += `</div>`;
        });
        
        html += '</div>';

        Modal.open({
            title: 'Confirmar Peças Rastreáveis',
            content: html,
            footer: `
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" onclick="OSPage.submitSerials(${osId}, '${newStatus}', '${oldStatus}')">Confirmar e Aprovar</button>
            `
        });
        
        // Focar no primeiro input
        setTimeout(() => {
            const firstInput = document.querySelector('.os-serial-input');
            if (firstInput) firstInput.focus();
        }, 100);
    },

    async submitSerials(osId, newStatus, oldStatus) {
        const inputs = document.querySelectorAll('.os-serial-input');
        const serialsPayload = {};
        
        for (let input of inputs) {
            const val = input.value.trim();
            if (!val) {
                Toast.warning('Preencha todos os números de série!');
                input.focus();
                return;
            }
            const itemId = input.dataset.itemid;
            if (!serialsPayload[itemId]) serialsPayload[itemId] = [];
            serialsPayload[itemId].push(val);
        }
        
        document.querySelector('.modal-overlay').remove();
        await this.executeStatusChange(osId, newStatus, oldStatus, serialsPayload);
    },

    async openForm(id = null) {
        let os = {
            id: '', customer_id: '', device_model: '', device_serial: '', 
            device_password: '', reported_defect: '', technical_report: '', items: []
        };
        let isEdit = false;

        if (id) {
            isEdit = true;
            try {
                const res = await API.get(`/os/${id}`);
                if (res.success) {
                    os = res.data;
                }
            } catch(e) {
                Toast.error('Erro ao buscar dados da O.S.');
                return;
            }
        }

        const customerOptions = this.customers.map(c => 
            `<option value="${c.id}" ${c.id == os.customer_id ? 'selected' : ''}>${Utils.escapeHTML(c.name)} ${c.phone ? '- ' + c.phone : ''}</option>`
        ).join('');

        Modal.open({
            title: isEdit ? `Ordem de Serviço #${String(os.id).padStart(4,'0')}` : 'Nova Ordem de Serviço',
            size: 'large',
            content: `
                <div class="tabs-container" style="margin-bottom:var(--space-md);">
                    <div class="tabs-header">
                        <button type="button" class="tab-btn active" onclick="OSPage.switchTab('basic')" id="tab-os-basic">Dados do Aparelho</button>
                        ${isEdit ? `<button type="button" class="tab-btn" onclick="OSPage.switchTab('budget')" id="tab-os-budget">Orçamento (Peças e Serviços)</button>` : ''}
                    </div>
                </div>

                <!-- DADOS BÁSICOS -->
                <div id="os-basic-content">
                    <div class="form-group">
                        <label class="form-label">Cliente</label>
                        <select id="os-customer" class="form-input">
                            <option value="">-- Cliente Avulso --</option>
                            ${customerOptions}
                        </select>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Modelo do Aparelho *</label>
                            <input type="text" id="os-model" class="form-input" value="${Utils.escapeHTML(os.device_model)}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">IMEI / Número de Série</label>
                            <input type="text" id="os-serial" class="form-input" value="${Utils.escapeHTML(os.device_serial || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Senha de Desbloqueio</label>
                            <input type="text" id="os-password" class="form-input" value="${Utils.escapeHTML(os.device_password || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Defeito Relatado pelo Cliente *</label>
                        <textarea id="os-defect" class="form-input" rows="3" required>${Utils.escapeHTML(os.reported_defect)}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Laudo Técnico (Diagnóstico)</label>
                        <textarea id="os-report" class="form-input" rows="3">${Utils.escapeHTML(os.technical_report || '')}</textarea>
                    </div>
                </div>

                <!-- ORÇAMENTO / ITENS -->
                ${isEdit ? `
                <div id="os-budget-content" style="display:none;">
                    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px; align-items:end; background:var(--bg-main); padding:10px; border-radius:8px; border:1px solid var(--border);">
                        <div style="flex:1; min-width:140px;">
                            <label class="form-label" style="font-size:11px;">Categoria / Tipo</label>
                            <select id="os-item-category" class="form-input" onchange="OSPage.toggleCategory()">
                                <option value="service">Serviço (Mão de Obra)</option>
                                ${(() => {
                                    const cats = new Set();
                                    this.products.filter(p => !p.is_service).forEach(p => cats.add(p.category_name || 'Outros'));
                                    return Array.from(cats).sort().map(c => `<option value="${Utils.escapeHTML(c)}">Estoque: ${Utils.escapeHTML(c)}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div style="flex:2; min-width:200px;" id="os-service-wrapper">
                            <label class="form-label" style="font-size:11px;">Descrição do Serviço</label>
                            <select id="os-item-service" class="form-input" onchange="OSPage.fillServicePrice()">
                                <option value="custom">-- Serviço Personalizado (Digitar) --</option>
                                ${this.products.filter(p => p.is_service).map(p => `<option value="${p.id}" data-price="${p.sale_price}" data-name="${Utils.escapeHTML(p.name)}">${Utils.escapeHTML(p.name)}</option>`).join('')}
                            </select>
                            <input type="text" id="os-item-desc" class="form-input" placeholder="Ex: Limpeza Interna" style="margin-top:5px; display:block;">
                        </div>
                        <div style="flex:2; min-width:200px; display:none;" id="os-product-wrapper">
                            <label class="form-label" style="font-size:11px;">Selecionar Item</label>
                            <select id="os-item-product" class="form-input" onchange="OSPage.fillProductPrice()">
                                <option value="">-- Escolha o Item --</option>
                            </select>
                        </div>
                        <div style="width:70px;">
                            <label class="form-label" style="font-size:11px;">Qtd</label>
                            <input type="number" id="os-item-qty" class="form-input" value="1" min="1">
                        </div>
                        <div style="width:110px;">
                            <label class="form-label" style="font-size:11px;">Valor Unit.</label>
                            <input type="number" id="os-item-price" class="form-input" value="0.00" step="0.01">
                        </div>
                        <div>
                            <button type="button" class="btn btn-primary" onclick="OSPage.addItem(${os.id})" style="height:42px; width:100%; white-space:nowrap;">Adicionar</button>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>TIPO</th>
                                    <th>DESCRIÇÃO</th>
                                    <th>QTD</th>
                                    <th>VALOR UNIT.</th>
                                    <th>TOTAL</th>
                                    <th width="50">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody id="os-items-table">
                                ${os.items.length ? os.items.map(item => `
                                    <tr>
                                        <td><span class="badge ${item.item_type === 'product' ? 'badge-info' : 'badge-primary'}">${item.item_type === 'product' ? 'Peça' : 'Serviço'}</span></td>
                                        <td>${Utils.escapeHTML(item.item_type === 'product' ? item.product_name : item.description)}</td>
                                        <td>${item.quantity}</td>
                                        <td>${Utils.formatCurrency(item.unit_price)}</td>
                                        <td style="font-weight:bold;">${Utils.formatCurrency(item.total_price)}</td>
                                        <td><button type="button" class="btn btn-ghost btn-icon" onclick="OSPage.removeItem(${item.id}, ${os.id})" style="color:var(--danger)">🗑️</button></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum item adicionado.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="display:flex; justify-content:flex-end; gap:20px; margin-top:15px; padding:15px; background:var(--bg-main); border-radius:8px;">
                        <div style="text-align:right;">
                            <div style="font-size:12px; color:var(--text-muted);">Total Peças: <strong style="color:var(--text-main)">${Utils.formatCurrency(os.total_parts)}</strong></div>
                            <div style="font-size:12px; color:var(--text-muted);">Total Serviços: <strong style="color:var(--text-main)">${Utils.formatCurrency(os.total_labor)}</strong></div>
                        </div>
                        <div style="text-align:right; border-left:1px solid var(--border); padding-left:20px;">
                            <div style="font-size:12px; color:var(--text-muted);">Total Geral</div>
                            <div style="font-size:20px; font-weight:bold; color:var(--success);">${Utils.formatCurrency(os.total_amount)}</div>
                        </div>
                    </div>
                </div>
                ` : ''}
            `,
            footer: `
                <div style="display:flex; width:100%; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; gap:8px;">
                        ${isEdit ? `<button class="btn btn-ghost" style="color:var(--danger); padding:8px;" onclick="OSPage.delete(${os.id})" title="Excluir">🗑️</button>` : ''}
                        ${isEdit ? `<button class="btn btn-secondary" style="padding:8px 12px; font-size:13px;" onclick="OSPage.printReceipt(${os.id})">🖨️ Termo</button>` : ''}
                        ${isEdit ? `<button class="btn btn-secondary" style="padding:8px 12px; font-size:13px;" onclick="OSPage.printBudget(${os.id})">📄 Relatório</button>` : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary" style="padding:8px 16px;" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                        <button class="btn btn-primary" style="padding:8px 16px;" onclick="OSPage.save(${isEdit ? os.id : 'null'})">Salvar</button>
                    </div>
                </div>
            `
        });
    },

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-os-${tab}`).classList.add('active');
        
        document.getElementById('os-basic-content').style.display = tab === 'basic' ? 'block' : 'none';
        document.getElementById('os-budget-content').style.display = tab === 'budget' ? 'block' : 'none';
    },

    toggleCategory() {
        const cat = document.getElementById('os-item-category').value;
        const srvWrap = document.getElementById('os-service-wrapper');
        const prodWrap = document.getElementById('os-product-wrapper');
        const priceInput = document.getElementById('os-item-price');

        if (cat === 'service') {
            srvWrap.style.display = 'block';
            prodWrap.style.display = 'none';
            priceInput.readOnly = false;
            this.fillServicePrice();
        } else {
            srvWrap.style.display = 'none';
            prodWrap.style.display = 'block';
            priceInput.readOnly = false;
            
            const select = document.getElementById('os-item-product');
            const prods = this.products.filter(p => !p.is_service && ((p.category_name || 'Outros') === cat));
            select.innerHTML = '<option value="">-- Escolha o Item --</option>' + 
                prods.map(p => `<option value="${p.id}" data-price="${p.sale_price}">${Utils.escapeHTML(p.name)} - ${Utils.formatCurrency(p.sale_price)} (Est: ${p.current_stock})</option>`).join('');
                
            this.fillProductPrice();
        }
    },

    fillProductPrice() {
        const select = document.getElementById('os-item-product');
        const opt = select.options[select.selectedIndex];
        const price = opt ? opt.dataset.price : 0;
        document.getElementById('os-item-price').value = parseFloat(price || 0).toFixed(2);
    },

    fillServicePrice() {
        const select = document.getElementById('os-item-service');
        const descInput = document.getElementById('os-item-desc');
        const priceInput = document.getElementById('os-item-price');
        
        if (select.value === 'custom') {
            descInput.style.display = 'block';
            priceInput.value = '0.00';
            descInput.value = '';
            descInput.focus();
        } else {
            descInput.style.display = 'none';
            const opt = select.options[select.selectedIndex];
            priceInput.value = parseFloat(opt.dataset.price || 0).toFixed(2);
        }
    },

    async addItem(osId) {
        const cat = document.getElementById('os-item-category').value;
        const type = cat === 'service' ? 'service' : 'product';
        const qty = parseInt(document.getElementById('os-item-qty').value);
        const price = parseFloat(document.getElementById('os-item-price').value);
        
        let desc = '';
        let productId = null;

        if (type === 'service') {
            const select = document.getElementById('os-item-service');
            if (select.value === 'custom') {
                desc = document.getElementById('os-item-desc').value.trim();
                if (!desc) { Toast.warning('Digite a descrição do serviço.'); return; }
            } else {
                productId = select.value;
                const opt = select.options[select.selectedIndex];
                desc = opt.dataset.name;
            }
        } else {
            const select = document.getElementById('os-item-product');
            productId = select.value;
            if (!productId) { Toast.warning('Selecione uma peça.'); return; }
            desc = select.options[select.selectedIndex].text.split('-')[0].trim();
        }

        if (qty < 1 || isNaN(qty)) { Toast.warning('Quantidade inválida.'); return; }
        if (isNaN(price) || price < 0) { Toast.warning('Preço inválido.'); return; }

        try {
            const res = await API.post(`/os/${osId}/items`, {
                item_type: type,
                product_id: productId,
                description: desc,
                quantity: qty,
                unit_price: price
            });
            if (res.success) {
                Toast.success('Item adicionado!');
                // Reload modal
                document.querySelector('.modal-overlay').remove();
                await this.loadData();
                this.openForm(osId);
                setTimeout(() => this.switchTab('budget'), 200);
            } else {
                Toast.error(res.message);
            }
        } catch(e) {
            Toast.error('Erro de conexão.');
        }
    },

    async removeItem(itemId, osId) {
        if (!confirm('Remover este item do orçamento?')) return;
        try {
            const res = await API.delete(`/os/items/${itemId}`);
            if (res.success) {
                Toast.success('Item removido!');
                document.querySelector('.modal-overlay').remove();
                await this.loadData();
                this.openForm(osId);
                setTimeout(() => this.switchTab('budget'), 200);
            } else {
                Toast.error(res.message);
            }
        } catch(e) {
            Toast.error('Erro de conexão.');
        }
    },

    async save(id) {
        const model = document.getElementById('os-model').value.trim();
        const defect = document.getElementById('os-defect').value.trim();
        
        if (!model || !defect) {
            Toast.warning('Modelo e Defeito são obrigatórios.');
            return;
        }

        const data = {
            customer_id: document.getElementById('os-customer').value || null,
            device_model: model,
            device_serial: document.getElementById('os-serial').value.trim(),
            device_password: document.getElementById('os-password').value.trim(),
            reported_defect: defect,
            technical_report: document.getElementById('os-report').value.trim()
        };

        try {
            let res;
            if (id) {
                res = await API.put(`/os/${id}`, data);
            } else {
                res = await API.post('/os', data);
            }

            if (res.success) {
                Toast.success(res.message);
                document.querySelector('.modal-overlay').remove();
                this.loadData();
            } else {
                Toast.error(res.message);
            }
        } catch (error) {
            console.error('Save error', error);
            Toast.error('Erro ao salvar O.S.');
        }
    },

    async delete(id) {
        // Feature to be implemented in API, right now I just mocked it.
        Toast.info('Exclusão direta desativada. Cancele a O.S.');
    },

    async printReceipt(id) {
        const os = this.osList.find(o => o.id == id);
        if (!os) return;
        
        let settings = {};
        try {
            const res = await API.get('/settings/store');
            if (res.success) settings = res.data;
        } catch (e) {
            console.warn('Erro ao carregar configurações da loja para o recibo.');
        }

        const storeName = settings.store_name || 'STOCKCELL APP';
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Termo de Entrada O.S. #${id}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 15px; font-size: 14px; max-width: 300px; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="center bold" style="font-size:18px; margin-bottom:5px;">${Utils.escapeHTML(storeName)}</div>
                <div class="center">COMPROVANTE DE ENTRADA</div>
                <div class="center">ORDEM DE SERVIÇO #${String(os.id).padStart(4,'0')}</div>
                <div class="divider"></div>
                
                <div><span class="bold">Data:</span> ${Utils.formatDate(os.created_at)}</div>
                <div><span class="bold">Cliente:</span> ${os.customer_name || 'Avulso'}</div>
                <div><span class="bold">Aparelho:</span> ${os.device_model}</div>
                <div><span class="bold">IMEI/Serial:</span> ${os.device_serial || 'N/I'}</div>
                <div><span class="bold">Defeito:</span> ${os.reported_defect}</div>
                
                <div class="divider"></div>
                <div style="font-size: 12px; text-align: justify; margin-top: 15px;">
                    TERMO DE RESPONSABILIDADE<br>
                    Declaro ter deixado o aparelho acima descrito para avaliação técnica/orçamento. A loja não se responsabiliza por dados pessoais armazenados. Aparelhos não retirados após 90 dias poderão ser vendidos para custear peças.
                </div>
                
                <br><br>
                <div class="center">_______________________________</div>
                <div class="center" style="font-size:12px;">Assinatura do Cliente</div>
                
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },
    async sendEmail(id, providedEmail = null) {
        const email = providedEmail || prompt("Qual o e-mail do cliente?");
        if (!email) return { success: false, message: 'Operação cancelada.' };

        try {
            Toast.info("Enviando e-mail, aguarde...");
            const res = await API.post(`/os/${id}/email`, { target_email: email });
            if (res.success) {
                Toast.success(res.message);
            } else {
                Toast.error(res.message);
            }
            return res;
        } catch (e) {
            Toast.error("Erro ao enviar e-mail. Verifique a conexão.");
            return { success: false, message: "Erro de conexão." };
        }
    },

    async printBudget(id) {
        let os, settings;
        try {
            const [resOs, resSettings] = await Promise.all([
                API.get(`/os/${id}`),
                API.get('/settings/store')
            ]);
            if (!resOs.success) throw new Error();
            os = resOs.data;
            settings = resSettings.success ? resSettings.data : {};
        } catch(e) {
            Toast.error('Erro ao buscar dados para impressão.');
            return;
        }

        const printWindow = window.open('', '_blank');
        
        let itemsHtml = '';
        if (os.items && os.items.length > 0) {
            itemsHtml = `
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>TIPO</th>
                            <th>DESCRIÇÃO</th>
                            <th class="center">QTD</th>
                            <th class="right">V. UNIT</th>
                            <th class="right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${os.items.map(item => `
                            <tr>
                                <td>${item.item_type === 'product' ? 'Peça' : 'Serviço'}</td>
                                <td>${Utils.escapeHTML(item.product_name || item.description)}</td>
                                <td class="center">${item.quantity}</td>
                                <td class="right">${Utils.formatCurrency(item.unit_price)}</td>
                                <td class="right"><strong>${Utils.formatCurrency(item.total_price)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            itemsHtml = '<p style="text-align:center; color:#666; padding: 20px;">Nenhum item adicionado ao orçamento ainda.</p>';
        }

        const totalPecas = os.items ? os.items.filter(i => i.item_type === 'product').reduce((sum, i) => sum + i.total_price, 0) : 0;
        const totalServicos = os.items ? os.items.filter(i => i.item_type === 'service').reduce((sum, i) => sum + i.total_price, 0) : 0;

        const statusMap = {
            'budgeting': 'Orçamentando',
            'waiting_parts': 'Aguardando Peça',
            'approved': 'Aprovado',
            'in_repair': 'Em Reparo',
            'ready': 'Pronto',
            'delivered': 'Entregue',
            'cancelled': 'Cancelado'
        };

        printWindow.document.write(`
            <html>
            <head>
                <title>Relatório de Orçamento O.S. #${id}</title>
                <style>
                    :root { --primary: #4F46E5; --text: #1F2937; --border: #E5E7EB; }
                    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: var(--text); background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px; }
                    .header-logo { font-size: 24px; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
                    .header-info { text-align: right; font-size: 14px; color: #6B7280; line-height: 1.5; }
                    .title { font-size: 28px; font-weight: bold; margin: 0 0 5px 0; }
                    .badge { display: inline-block; padding: 4px 12px; background: #EEF2FF; color: var(--primary); border-radius: 9999px; font-size: 14px; font-weight: 600; text-transform: uppercase; }
                    
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-card { background: #F9FAFB; padding: 20px; border-radius: 12px; border: 1px solid var(--border); }
                    .info-card h3 { margin: 0 0 15px 0; font-size: 16px; color: var(--primary); border-bottom: 1px solid var(--border); padding-bottom: 8px; text-transform: uppercase; }
                    .info-row { display: flex; margin-bottom: 8px; font-size: 14px; }
                    .info-label { width: 100px; font-weight: 600; color: #6B7280; }
                    .info-value { flex: 1; font-weight: 500; }
                    
                    .items-section { margin-bottom: 30px; }
                    .items-section h3 { font-size: 18px; margin-bottom: 15px; color: var(--text); }
                    .items-table { width: 100%; border-collapse: collapse; }
                    .items-table th, .items-table td { padding: 12px 15px; border-bottom: 1px solid var(--border); text-align: left; }
                    .items-table th { background: #F9FAFB; font-weight: 600; font-size: 12px; color: #6B7280; text-transform: uppercase; }
                    .items-table td { font-size: 14px; }
                    .center { text-align: center !important; }
                    .right { text-align: right !important; }
                    
                    /* Horizontal Timeline CSS */
                    .timeline-container { display: flex; overflow-x: auto; padding: 20px 0; position: relative; scrollbar-width: thin; }
                    .timeline-step { flex: 1; min-width: 140px; text-align: center; position: relative; padding: 0 10px; }
                    .timeline-step::before { content: ''; position: absolute; top: 10px; left: 50%; width: 100%; height: 2px; background: #E5E7EB; z-index: 1; }
                    .timeline-step:last-child::before { display: none; }
                    .timeline-dot { width: 20px; height: 20px; background: #10B981; border-radius: 50%; margin: 0 auto 10px auto; position: relative; z-index: 2; border: 4px solid #F9FAFB; box-shadow: 0 0 0 2px #10B981; }
                    .timeline-date { font-size: 11px; color: #6B7280; margin-bottom: 4px; }
                    .timeline-desc { font-size: 13px; color: var(--text); font-weight: 500; line-height: 1.3; }

                    .totals-box { display: flex; justify-content: flex-end; margin-bottom: 40px; }
                    .totals-content { background: #F9FAFB; padding: 20px; border-radius: 12px; border: 1px solid var(--border); min-width: 280px; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; color: #6B7280; }
                    .total-final { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border); font-size: 20px; font-weight: bold; color: var(--primary); }
                    
                    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
                    .sig-line { border-top: 1px solid #9CA3AF; margin-bottom: 10px; }
                    .sig-name { font-size: 14px; font-weight: 600; text-transform: uppercase; }
                    .sig-role { font-size: 12px; color: #6B7280; }
                    
                    @media print {
                        body { padding: 0; }
                        .info-card, .totals-content { border: 1px solid var(--border) !important; background: none !important; }
                        .badge { border: 1px solid var(--primary); }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align:center; margin-bottom: 20px; background:#F3F4F6; padding:15px; border-radius:8px;">
                    <button onclick="const e = prompt('Qual o e-mail do cliente?', '${Utils.escapeHTML(os.customer_email || '')}'); if(e) { const btn = this; btn.innerText = 'Enviando aguarde...'; btn.disabled = true; fetch('/api/os/${id}/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_email: e }) }).then(r => r.json()).then(res => { if(res.success) { btn.innerText = '✅ Enviado com sucesso!'; btn.style.background = '#10B981'; alert('E-mail enviado!'); } else { btn.innerText = '📧 Tentar Novamente'; btn.disabled = false; alert('ERRO AO ENVIAR:\\n' + (res.message || 'Verifique as configurações SMTP.')); } }).catch(err => { btn.innerText = '📧 Tentar Novamente'; btn.disabled = false; alert('Erro de conexão com o servidor.'); }); }" style="padding:10px 20px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">📧 Enviar Resumo por E-mail</button>
                    <button onclick="window.print()" style="padding:10px 20px; background:#4B5563; color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer; margin-left:10px;">🖨️ Imprimir (Gerar PDF)</button>
                    <div style="font-size:12px; color:#6B7280; margin-top:10px;">Dica: Clique em "Imprimir" e altere o destino para "Salvar como PDF". Depois você pode anexar esse PDF no WhatsApp!</div>
                </div>

                <div class="header">
                    <div style="display:flex; align-items:center; gap:15px;">
                        ${settings.store_logo ? `<img src="${settings.store_logo}" style="max-height: 60px; object-fit: contain; border-radius: 8px;">` : ''}
                        <div>
                            <div class="header-logo">${Utils.escapeHTML(settings.store_name || 'STOCKCELL')}</div>
                            <div style="font-size: 14px; color: #6B7280; margin-top: 4px;">Soluções em Assistência Técnica</div>
                        </div>
                    </div>
                    <div class="header-info">
                        <strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
                        <strong>Ordem de Serviço Nº:</strong> ${String(os.id).padStart(4,'0')}<br>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h1 class="title">Relatório de Orçamento</h1>
                    <span class="badge">${statusMap[os.status] || os.status}</span>
                </div>

                <div class="info-grid">
                    <div class="info-card">
                        <h3>Dados do Cliente</h3>
                        <div class="info-row">
                            <div class="info-label">Nome:</div>
                            <div class="info-value">${Utils.escapeHTML(os.customer_name || 'Cliente Avulso')}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Telefone:</div>
                            <div class="info-value">${Utils.escapeHTML(os.customer_phone || 'Não informado')}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Entrada:</div>
                            <div class="info-value">${Utils.formatDate(os.created_at)}</div>
                        </div>
                    </div>

                    <div class="info-card">
                        <h3>Aparelho e Diagnóstico</h3>
                        <div class="info-row">
                            <div class="info-label">Aparelho:</div>
                            <div class="info-value">${Utils.escapeHTML(os.device_model)}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">IMEI/Serial:</div>
                            <div class="info-value">${Utils.escapeHTML(os.device_serial || 'Não informado')}</div>
                        </div>
                        <div class="info-row" style="flex-direction:column; margin-top:10px;">
                            <div class="info-label" style="width:100%; margin-bottom:4px;">Defeito Relatado:</div>
                            <div class="info-value" style="font-style:italic; color:#4B5563;">"${Utils.escapeHTML(os.reported_defect)}"</div>
                        </div>
                        ${os.technical_report ? `
                        <div class="info-row" style="flex-direction:column; margin-top:10px;">
                            <div class="info-label" style="width:100%; margin-bottom:4px;">Laudo Técnico:</div>
                            <div class="info-value" style="font-style:italic; color:#4B5563;">"${Utils.escapeHTML(os.technical_report)}"</div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="items-section">
                    <h3>Descrição dos Serviços e Peças</h3>
                    ${itemsHtml}
                </div>

                ${os.history && os.history.length > 0 ? `
                <div class="items-section" style="margin-top: 30px;">
                    <h3>Linha do Tempo (Histórico da O.S.)</h3>
                    <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                        <div class="timeline-container">
                            ${os.history.map(h => {
                                let desc = Utils.escapeHTML(h.description);
                                for (const [key, val] of Object.entries(statusMap)) {
                                    desc = desc.replace(key, val);
                                }
                                // Simplify description for horizontal layout
                                let shortDesc = desc.replace(new RegExp(`Status da O.S. #${os.id} alterado para `, 'g'), '');
                                shortDesc = shortDesc.replace(`Ordem de Serviço #${os.id} criada`, 'Criada');
                                
                                return `
                                    <div class="timeline-step">
                                        <div class="timeline-dot"></div>
                                        <div class="timeline-date">${Utils.formatDateTime(h.created_at)}</div>
                                        <div class="timeline-desc">${shortDesc}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="totals-box">
                    <div class="totals-content">
                        <div class="total-row">
                            <span>Total de Peças:</span>
                            <span>${Utils.formatCurrency(totalPecas)}</span>
                        </div>
                        <div class="total-row">
                            <span>Mão de Obra:</span>
                            <span>${Utils.formatCurrency(totalServicos)}</span>
                        </div>
                        <div class="total-final">
                            <span>TOTAL GERAL:</span>
                            <span>${Utils.formatCurrency(totalPecas + totalServicos)}</span>
                        </div>
                    </div>
                </div>

                <div class="signatures">
                    <div>
                        <div class="sig-line"></div>
                        <div class="sig-name">${Utils.escapeHTML(settings.store_name || 'STOCKCELL')}</div>
                        <div class="sig-role">Assinatura do Técnico / Responsável</div>
                    </div>
                    <div>
                        <div class="sig-line"></div>
                        <div class="sig-name">${Utils.escapeHTML(os.customer_name || 'Cliente')}</div>
                        <div class="sig-role">Assinatura do Cliente (Aprovação)</div>
                    </div>
                </div>

                <script>
                    // Removido o window.onload = window.print() para que a pessoa possa interagir com o botão de E-mail
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    promptPayment(os) {
        // Will integrate with finance module
        Toast.info('O.S. Entregue! Integração financeira pendente na próxima fase.');
    }
};

window.OSPage = OSPage;

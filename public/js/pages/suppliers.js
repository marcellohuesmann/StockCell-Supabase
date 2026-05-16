/**
 * StockCell - Página de Fornecedores (CRUD)
 */
const SuppliersPage = {
    suppliers: [],

    render() {
        return `
            <div class="page-content page-enter">
                <div class="page-header">
                    <div>
                        <h2 class="page-title">Fornecedores</h2>
                        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie seus fornecedores</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-supplier">${Icons.plus} Novo Fornecedor</button>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="search-bar" style="max-width:400px">
                            ${Icons.search}
                            <input type="text" class="form-input" id="supplier-search" placeholder="Buscar por nome, CNPJ, telefone...">
                        </div>
                    </div>
                    <div id="suppliers-list"></div>
                </div>
            </div>
        `;
    },

    bind() {
        document.getElementById('btn-new-supplier').addEventListener('click', () => this.openForm());
        document.getElementById('supplier-search').addEventListener('input', Utils.debounce((e) => this.loadSuppliers(e.target.value), 300));
        this.loadSuppliers();
    },

    async loadSuppliers(search = '') {
        const url = search ? `/suppliers?search=${encodeURIComponent(search)}` : '/suppliers';
        const result = await API.get(url);
        if (result.success) { this.suppliers = result.data; this.renderList(); }
    },

    renderList() {
        const container = document.getElementById('suppliers-list');
        if (!this.suppliers.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚚</div><div class="empty-state-text">Nenhum fornecedor cadastrado</div></div>`;
            return;
        }
        container.innerHTML = `
            <div class="table-container"><table class="data-table">
                <thead><tr>
                    <th>Empresa</th><th class="hide-mobile">Contato</th><th>Telefone</th><th class="hide-mobile">CNPJ</th><th class="hide-mobile">Email</th>
                    <th style="text-align:center">Status</th>
                    <th style="width:120px;text-align:center">Ações</th>
                </tr></thead>
                <tbody>${this.suppliers.map(s => `<tr>
                    <td data-label="Empresa"><strong>${Utils.escapeHTML(s.company_name)}</strong></td>
                    <td data-label="Contato" class="hide-mobile" style="color:var(--text-secondary)">${Utils.escapeHTML(s.contact_name) || '-'}</td>
                    <td data-label="Telefone">${Utils.formatPhone(s.phone) || '-'}</td>
                    <td data-label="CNPJ" class="hide-mobile" style="font-family:var(--font-mono);font-size:var(--font-size-xs)">${s.cnpj || '-'}</td>
                    <td data-label="Email" class="hide-mobile" style="color:var(--text-secondary)">${Utils.escapeHTML(s.email) || '-'}</td>
                    <td data-label="Status" style="text-align:center">${s.active ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                    <td data-label="Ações" style="text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="SuppliersPage.openForm(${s.id})">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="SuppliersPage.deleteSupplier(${s.id},'${Utils.escapeHTML(s.company_name).replace(/'/g,"\\'")}')">🗑️</button>
                    </td>
                </tr>`).join('')}</tbody>
            </table></div>
        `;
    },

    async openForm(id = null) {
        let supplier = { company_name:'', contact_name:'', phone:'', cnpj:'', email:'', address:'', notes:'' };
        if (id) { const r = await API.get(`/suppliers/${id}`); if (r.success) supplier = r.data; }

        Modal.open({
            title: id ? 'Editar Fornecedor' : 'Novo Fornecedor',
            content: `
                <form id="supplier-form">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
                        <div class="form-group" style="grid-column:1/-1;">
                            <label class="form-label">CNPJ</label>
                            <div style="display:flex;gap:var(--space-sm);">
                                <input type="text" class="form-input" id="sup-cnpj" value="${Utils.escapeHTML(supplier.cnpj || '')}" placeholder="00.000.000/0000-00" style="flex:1;">
                                <button type="button" class="btn btn-secondary btn-sm" id="btn-cnpj-lookup" title="Buscar dados pelo CNPJ" style="white-space:nowrap;padding:8px 12px;">
                                    🔍 Buscar
                                </button>
                            </div>
                            <small id="cnpj-status" style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;"></small>
                        </div>
                        <div class="form-group" style="grid-column:1/-1;">
                            <label class="form-label">Razão Social / Nome da Empresa *</label>
                            <input type="text" class="form-input" id="sup-company" value="${Utils.escapeHTML(supplier.company_name)}" required placeholder="Razão social ou nome fantasia">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Pessoa de Contato</label>
                            <input type="text" class="form-input" id="sup-contact" value="${Utils.escapeHTML(supplier.contact_name || '')}" placeholder="Nome do contato">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Telefone</label>
                            <input type="tel" class="form-input" id="sup-phone" value="${Utils.escapeHTML(supplier.phone || '')}" placeholder="(00) 00000-0000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-input" id="sup-email" value="${Utils.escapeHTML(supplier.email || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Endereço</label>
                        <input type="text" class="form-input" id="sup-address" value="${Utils.escapeHTML(supplier.address || '')}" placeholder="Endereço completo">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Observações</label>
                        <textarea class="form-input" id="sup-notes" rows="2">${Utils.escapeHTML(supplier.notes || '')}</textarea>
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" id="modal-save-sup">${id ? 'Salvar' : 'Cadastrar'}</button>
            `,
        });

        const phoneInput = document.getElementById('sup-phone');
        if (phoneInput) Utils.maskInput(phoneInput, '(99) 99999-9999');
        const cnpjInput = document.getElementById('sup-cnpj');
        if (cnpjInput) Utils.maskInput(cnpjInput, '99.999.999/9999-99');

        // CNPJ Lookup
        document.getElementById('btn-cnpj-lookup').addEventListener('click', () => this._lookupCNPJ(id));
        cnpjInput.addEventListener('blur', () => {
            const digits = cnpjInput.value.replace(/\D/g, '');
            if (digits.length === 14) this._lookupCNPJ(id);
        });

        document.getElementById('modal-save-sup').addEventListener('click', () => this.saveSupplier(id));
    },

    async _lookupCNPJ(editId = null) {
        const cnpjInput = document.getElementById('sup-cnpj');
        const statusEl = document.getElementById('cnpj-status');
        const digits = cnpjInput.value.replace(/\D/g, '');

        if (digits.length !== 14) {
            statusEl.textContent = '⚠️ CNPJ deve ter 14 dígitos.';
            statusEl.style.color = 'var(--warning)';
            return;
        }

        // Verificar duplicidade local
        const duplicate = this.suppliers.find(s => {
            const sCnpj = (s.cnpj || '').replace(/\D/g, '');
            return sCnpj === digits && s.id !== editId;
        });
        if (duplicate) {
            statusEl.innerHTML = `⚠️ CNPJ já cadastrado para: <strong>${Utils.escapeHTML(duplicate.company_name)}</strong>`;
            statusEl.style.color = 'var(--danger)';
            cnpjInput.style.borderColor = 'var(--danger)';
            return;
        }
        cnpjInput.style.borderColor = '';

        statusEl.textContent = '🔄 Consultando CNPJ...';
        statusEl.style.color = 'var(--text-muted)';

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
            if (!response.ok) {
                statusEl.textContent = '❌ CNPJ não encontrado na Receita Federal.';
                statusEl.style.color = 'var(--danger)';
                return;
            }
            const data = await response.json();

            // Auto-fill fields
            const companyEl = document.getElementById('sup-company');
            const contactEl = document.getElementById('sup-contact');
            const phoneEl = document.getElementById('sup-phone');
            const emailEl = document.getElementById('sup-email');
            const addressEl = document.getElementById('sup-address');

            if (companyEl && !companyEl.value) {
                companyEl.value = data.nome_fantasia || data.razao_social || '';
            }
            if (companyEl && companyEl.value === '') {
                companyEl.value = data.razao_social || '';
            }

            // Use razão social as contact if nome_fantasia was used for company
            if (contactEl && !contactEl.value && data.nome_fantasia && data.razao_social) {
                contactEl.value = data.razao_social;
            }

            if (phoneEl && !phoneEl.value && data.ddd_telefone_1) {
                const ddd = data.ddd_telefone_1.substring(0, 2);
                const num = data.ddd_telefone_1.substring(2);
                phoneEl.value = `(${ddd}) ${num}`;
            }

            if (emailEl && !emailEl.value && data.email) {
                emailEl.value = data.email.toLowerCase();
            }

            if (addressEl && !addressEl.value) {
                const parts = [
                    data.descricao_tipo_de_logradouro,
                    data.logradouro,
                    data.numero,
                    data.complemento,
                    data.bairro,
                    data.municipio,
                    data.uf
                ].filter(p => p && p.trim());
                addressEl.value = parts.join(', ');
            }

            const situacao = data.descricao_situacao_cadastral || 'N/A';
            const cor = situacao === 'ATIVA' ? 'var(--success)' : 'var(--danger)';
            statusEl.innerHTML = `✅ <strong>${Utils.escapeHTML(data.razao_social)}</strong> — Situação: <span style="color:${cor};font-weight:600;">${situacao}</span>`;
            statusEl.style.color = 'var(--text-secondary)';

        } catch (err) {
            statusEl.textContent = '❌ Erro ao consultar. Verifique a conexão com a internet.';
            statusEl.style.color = 'var(--danger)';
            console.error('CNPJ lookup error:', err);
        }
    },

    async saveSupplier(id) {
        const data = {
            company_name: document.getElementById('sup-company').value,
            contact_name: document.getElementById('sup-contact').value,
            phone: document.getElementById('sup-phone').value,
            cnpj: document.getElementById('sup-cnpj').value,
            email: document.getElementById('sup-email').value,
            address: document.getElementById('sup-address').value,
            notes: document.getElementById('sup-notes').value,
        };
        if (!data.company_name.trim()) { Toast.warning('Nome da empresa é obrigatório.'); return; }
        const result = id ? await API.put(`/suppliers/${id}`, data) : await API.post('/suppliers', data);
        if (result.success) { Toast.success(result.message); document.querySelector('.modal-overlay')?.remove(); this.loadSuppliers(); }
        else { Toast.error(result.message); }
    },

    deleteSupplier(id, name) {
        Modal.confirm(`Deseja excluir o fornecedor "${name}"?`, async () => {
            const result = await API.delete(`/suppliers/${id}`);
            if (result.success) { Toast.success(result.message); this.loadSuppliers(); }
            else { Toast.error(result.message); }
        });
    },
};

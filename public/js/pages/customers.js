/**
 * StockCell - Página de Clientes (CRUD)
 */
const CustomersPage = {
    customers: [],

    render() {
        return `
            <div class="page-content page-enter">
                <div class="page-header">
                    <div>
                        <h2 class="page-title">Clientes</h2>
                        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie seus clientes</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-customer">${Icons.plus} Novo Cliente</button>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="search-bar" style="max-width:400px">
                            ${Icons.search}
                            <input type="text" class="form-input" id="customer-search" placeholder="Buscar por nome, telefone, CPF...">
                        </div>
                    </div>
                    <div id="customers-list"></div>
                </div>
            </div>
        `;
    },

    bind() {
        document.getElementById('btn-new-customer').addEventListener('click', () => this.openForm());
        document.getElementById('customer-search').addEventListener('input', Utils.debounce((e) => this.loadCustomers(e.target.value), 300));
        this.loadCustomers();
    },

    async loadCustomers(search = '') {
        const url = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
        const result = await API.get(url);
        if (result.success) { this.customers = result.data; this.renderList(); }
    },

    renderList() {
        const container = document.getElementById('customers-list');
        if (!this.customers.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Nenhum cliente cadastrado</div></div>`;
            return;
        }
        container.innerHTML = `
            <div class="table-container"><table class="data-table">
                <thead><tr>
                    <th>Nome</th><th>Telefone</th><th class="hide-mobile">CPF</th><th class="hide-mobile">Email</th>
                    <th style="text-align:center">Compras</th><th style="text-align:right">Total Gasto</th>
                    <th style="width:120px;text-align:center">Ações</th>
                </tr></thead>
                <tbody>${this.customers.map(c => `<tr>
                    <td data-label="Nome"><strong>${Utils.escapeHTML(c.name)}</strong></td>
                    <td data-label="Telefone">${Utils.formatPhone(c.phone) || '-'}</td>
                    <td data-label="CPF" class="hide-mobile" style="font-family:var(--font-mono);font-size:var(--font-size-xs)">${c.cpf ? Utils.formatCPF(c.cpf) : '-'}</td>
                    <td data-label="Email" class="hide-mobile" style="color:var(--text-secondary)">${Utils.escapeHTML(c.email) || '-'}</td>
                    <td data-label="Compras" style="text-align:center"><span class="badge badge-info">${c.purchase_count || 0}</span></td>
                    <td data-label="Total Gasto" style="text-align:right;font-weight:600">${Utils.formatCurrency(c.total_spent || 0)}</td>
                    <td data-label="Ações" style="text-align:center">
                        <button class="btn btn-ghost btn-sm" onclick="CustomersPage.openForm(${c.id})">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="CustomersPage.deleteCustomer(${c.id},'${Utils.escapeHTML(c.name).replace(/'/g,"\\'")}')">🗑️</button>
                    </td>
                </tr>`).join('')}</tbody>
            </table></div>
        `;
    },

    async openForm(id = null) {
        let customer = { name:'', phone:'', cpf:'', email:'', address:'', notes:'' };
        if (id) { const r = await API.get(`/customers/${id}`); if (r.success) customer = r.data; }

        Modal.open({
            title: id ? 'Editar Cliente' : 'Novo Cliente',
            content: `
                <form id="customer-form">
                    <div class="form-group">
                        <label class="form-label">Nome *</label>
                        <input type="text" class="form-input" id="cust-name" value="${Utils.escapeHTML(customer.name)}" required placeholder="Nome completo">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
                        <div class="form-group">
                            <label class="form-label">Telefone</label>
                            <input type="tel" class="form-input" id="cust-phone" value="${Utils.escapeHTML(customer.phone || '')}" placeholder="(00) 00000-0000">
                        </div>
                        <div class="form-group">
                            <label class="form-label">CPF</label>
                            <input type="text" class="form-input" id="cust-cpf" value="${customer.cpf ? Utils.formatCPF(customer.cpf) : ''}" placeholder="000.000.000-00">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="cust-email" value="${Utils.escapeHTML(customer.email || '')}" placeholder="email@exemplo.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Endereço</label>
                        <input type="text" class="form-input" id="cust-address" value="${Utils.escapeHTML(customer.address || '')}" placeholder="Rua, número, bairro">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Observações</label>
                        <textarea class="form-input" id="cust-notes" rows="2">${Utils.escapeHTML(customer.notes || '')}</textarea>
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" id="modal-save-cust">${id ? 'Salvar' : 'Cadastrar'}</button>
            `,
        });

        // Máscaras
        const phoneInput = document.getElementById('cust-phone');
        if (phoneInput) Utils.maskInput(phoneInput, '(99) 99999-9999');
        const cpfInput = document.getElementById('cust-cpf');
        if (cpfInput) Utils.maskInput(cpfInput, '999.999.999-99');

        document.getElementById('modal-save-cust').addEventListener('click', () => this.saveCustomer(id));
    },

    async saveCustomer(id) {
        const data = {
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            cpf: document.getElementById('cust-cpf').value,
            email: document.getElementById('cust-email').value,
            address: document.getElementById('cust-address').value,
            notes: document.getElementById('cust-notes').value,
        };
        if (!data.name.trim()) { Toast.warning('Nome é obrigatório.'); return; }
        const result = id ? await API.put(`/customers/${id}`, data) : await API.post('/customers', data);
        if (result.success) { Toast.success(result.message); document.querySelector('.modal-overlay')?.remove(); this.loadCustomers(); }
        else { Toast.error(result.message); }
    },

    deleteCustomer(id, name) {
        Modal.confirm(`Deseja excluir o cliente "${name}"?`, async () => {
            const result = await API.delete(`/customers/${id}`);
            if (result.success) { Toast.success(result.message); this.loadCustomers(); }
            else { Toast.error(result.message); }
        });
    },
};

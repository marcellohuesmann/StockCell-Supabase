/**
 * StockCell - Configurações + Gestão de Usuários + Permissões Editáveis
 */
const SettingsPage = {
    users: [],
    permissions: {},
    activeTab: null,

    render() {
        const user = Auth.getUser();
        const isAdmin = user && user.role === 'admin';
        if (!this.activeTab) this.activeTab = isAdmin ? 'users' : 'profile';
        return `
        <div class="page-content page-enter">
            <div class="page-header">
                <div>
                    <h2 class="page-title">Configurações</h2>
                    <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie usuários e configurações do sistema</p>
                </div>
            </div>
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);flex-wrap:wrap;">
                ${isAdmin ? `<button class="btn ${this.activeTab==='users'?'btn-primary':'btn-secondary'} btn-sm" id="tab-users" onclick="SettingsPage.switchTab('users')">👥 Usuários</button>` : ''}
                <button class="btn ${this.activeTab==='profile'?'btn-primary':'btn-secondary'} btn-sm" id="tab-profile" onclick="SettingsPage.switchTab('profile')">👤 Meu Perfil</button>
                ${isAdmin ? `<button class="btn ${this.activeTab==='permissions'?'btn-primary':'btn-secondary'} btn-sm" id="tab-permissions" onclick="SettingsPage.switchTab('permissions')">🔒 Permissões</button>` : ''}
                ${isAdmin ? `<button class="btn ${this.activeTab==='store'?'btn-primary':'btn-secondary'} btn-sm" id="tab-store" onclick="SettingsPage.switchTab('store')">🏪 Dados da Loja</button>` : ''}
            </div>
            <div id="settings-content"></div>
        </div>`;
    },

    bind() { this.loadTab(); },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('[id^="tab-"]').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
        const activeBtn = document.getElementById('tab-' + tab);
        if (activeBtn) { activeBtn.classList.add('btn-primary'); activeBtn.classList.remove('btn-secondary'); }
        this.loadTab();
    },

    async loadTab() {
        const container = document.getElementById('settings-content');
        if (!container) return;
        switch (this.activeTab) {
            case 'users': await this.renderUsers(container); break;
            case 'profile': this.renderProfile(container); break;
            case 'permissions': await this.renderPermissions(container); break;
            case 'store': await this.renderStore(container); break;
        }
    },

    // ===== USERS TAB =====
    async renderUsers(container) {
        const result = await API.get('/users');
        if (!result.success) { container.innerHTML = '<p style="color:var(--text-muted)">Acesso negado ou erro ao carregar usuários.</p>'; return; }
        this.users = result.data;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <strong>👥 Usuários do Sistema</strong>
                    <button class="btn btn-primary btn-sm" id="btn-new-user">${Icons.plus} Novo Usuário</button>
                </div>
                <div class="table-container"><table class="data-table"><thead><tr>
                    <th>Usuário</th><th>Nome Completo</th><th>Perfil</th><th style="text-align:center">Vendas</th><th style="text-align:right">Total Vendido</th><th style="text-align:center">Status</th><th style="width:120px;text-align:center">Ações</th>
                </tr></thead><tbody>
                    ${this.users.map(u => `<tr>
                        <td data-label="Usuário"><code style="color:var(--accent-secondary)">${Utils.escapeHTML(u.username)}</code></td>
                        <td data-label="Nome Completo"><strong>${Utils.escapeHTML(u.full_name)}</strong></td>
                        <td data-label="Perfil">${u.role === 'admin' ? '<span class="badge badge-warning">Admin</span>' : '<span class="badge badge-info">Operador</span>'}</td>
                        <td data-label="Vendas" style="text-align:center">${u.sales_count || 0}</td>
                        <td data-label="Total Vendido" style="text-align:right">${Utils.formatCurrency(u.sales_total || 0)}</td>
                        <td data-label="Status" style="text-align:center">${u.active ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                        <td data-label="Ações" style="text-align:center">
                            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.openUserForm(${u.id})">✏️</button>
                            <button class="btn btn-ghost btn-sm" onclick="SettingsPage.deleteUser(${u.id},'${Utils.escapeHTML(u.full_name).replace(/'/g,"\\'")}')">🗑️</button>
                        </td>
                    </tr>`).join('')}
                </tbody></table></div>
            </div>
        `;
        document.getElementById('btn-new-user').addEventListener('click', () => this.openUserForm());
    },

    openUserForm(id = null) {
        const user = id ? this.users.find(u => u.id === id) : null;
        Modal.open({
            title: id ? 'Editar Usuário' : 'Novo Usuário',
            content: `
                <form id="user-form">
                    <div class="form-group">
                        <label class="form-label">Nome de Usuário (login) *</label>
                        <input type="text" class="form-input" id="user-username" value="${user ? Utils.escapeHTML(user.username) : ''}" ${id ? 'disabled' : ''} placeholder="Ex: vendedor1" style="${id ? 'opacity:0.6' : ''}">
                        ${id ? '<span class="form-hint">O login não pode ser alterado</span>' : ''}
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nome Completo *</label>
                        <input type="text" class="form-input" id="user-fullname" value="${user ? Utils.escapeHTML(user.full_name) : ''}" placeholder="Nome e sobrenome">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Perfil *</label>
                        <select class="form-input" id="user-role">
                            <option value="operator" ${!user || user.role === 'operator' ? 'selected' : ''}>Operador (vendedor)</option>
                            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Administrador</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${id ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                        <input type="password" class="form-input" id="user-password" placeholder="Mínimo 6 caracteres" ${id ? '' : 'required'}>
                    </div>
                    ${id ? `<div class="form-group"><label class="form-label">Status</label>
                        <select class="form-input" id="user-active"><option value="1" ${user.active ? 'selected' : ''}>Ativo</option><option value="0" ${!user.active ? 'selected' : ''}>Inativo</option></select></div>` : ''}
                </form>
            `,
            footer: `<button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                     <button class="btn btn-primary" id="modal-save-user">${id ? 'Salvar' : 'Criar Usuário'}</button>`,
        });
        document.getElementById('modal-save-user').addEventListener('click', () => this.saveUser(id));
    },

    async saveUser(id) {
        const data = {
            full_name: document.getElementById('user-fullname').value,
            role: document.getElementById('user-role').value,
            password: document.getElementById('user-password').value,
        };
        if (!id) data.username = document.getElementById('user-username').value;
        if (id) { const el = document.getElementById('user-active'); if (el) data.active = parseInt(el.value); }
        if (!data.full_name?.trim()) { Toast.warning('Nome completo é obrigatório.'); return; }
        if (!id && !data.username?.trim()) { Toast.warning('Nome de usuário é obrigatório.'); return; }
        if (!id && (!data.password || data.password.length < 6)) { Toast.warning('Senha deve ter no mínimo 6 caracteres.'); return; }
        const result = id ? await API.put(`/users/${id}`, data) : await API.post('/users', data);
        if (result.success) { Toast.success(result.message); document.querySelector('.modal-overlay')?.remove(); this.loadTab(); }
        else { Toast.error(result.message); }
    },

    deleteUser(id, name) {
        Modal.confirm(`Deseja excluir o usuário "${name}"?`, async () => {
            const r = await API.delete(`/users/${id}`);
            if (r.success) { Toast.success(r.message); this.loadTab(); } else { Toast.error(r.message); }
        });
    },

    // ===== PERMISSIONS TAB =====
    async renderPermissions(container) {
        const result = await API.get('/settings/permissions');
        if (!result.success) { container.innerHTML = '<p>Erro ao carregar permissões.</p>'; return; }
        this.permissions = result.data;

        container.innerHTML = `
            <div class="card" style="padding:var(--space-lg);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
                    <div>
                        <h4>🔒 Permissões por Perfil</h4>
                        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-top:4px;">Defina o que cada perfil pode acessar no sistema</p>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-save-perms">💾 Salvar Permissões</button>
                </div>
                <div class="table-container"><table class="data-table"><thead><tr>
                    <th>Funcionalidade</th>
                    <th style="text-align:center;width:120px;"><span class="badge badge-warning">Admin</span></th>
                    <th style="text-align:center;width:120px;"><span class="badge badge-info">Operador</span></th>
                </tr></thead><tbody>
                    ${Object.entries(this.permissions).map(([key, perm]) => `<tr>
                        <td data-label="Funcionalidade" style="font-weight:500;">${Utils.escapeHTML(perm.label)}</td>
                        <td data-label="Admin" style="text-align:center;">
                            <input type="checkbox" checked disabled style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:not-allowed;opacity:0.7;" title="Admin sempre tem acesso total">
                        </td>
                        <td data-label="Operador" style="text-align:center;">
                            <input type="checkbox" ${perm.operator ? 'checked' : ''} data-key="${key}"
                                style="width:18px;height:18px;accent-color:var(--accent-primary);cursor:pointer;" class="perm-checkbox">
                        </td>
                    </tr>`).join('')}
                </tbody></table></div>
                <div style="margin-top:var(--space-md);padding:var(--space-md);background:var(--bg-card-hover);border-radius:var(--radius-md);font-size:var(--font-size-xs);color:var(--text-muted);">
                    💡 O perfil <strong>Admin</strong> sempre tem acesso total ao sistema. Apenas as permissões do <strong>Operador</strong> podem ser customizadas.
                </div>
            </div>
        `;

        document.getElementById('btn-save-perms').addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.perm-checkbox');
            checkboxes.forEach(cb => {
                const key = cb.dataset.key;
                if (this.permissions[key]) {
                    this.permissions[key].operator = cb.checked;
                }
            });
            const r = await API.put('/settings/permissions', { permissions: this.permissions });
            if (r.success) { Toast.success(r.message); } else { Toast.error(r.message); }
        });
    },

    // ===== PROFILE TAB =====
    renderProfile(container) {
        const user = Auth.getUser();
        container.innerHTML = `
            <div class="card" style="max-width:500px;padding:var(--space-xl);">
                <h3 style="margin-bottom:var(--space-lg);">👤 Meu Perfil</h3>
                <div class="form-group"><label class="form-label">Usuário</label><input type="text" class="form-input" value="${user.username}" disabled style="opacity:0.6"></div>
                <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-input" value="${user.fullName}" disabled style="opacity:0.6"></div>
                <div class="form-group"><label class="form-label">Perfil</label><input type="text" class="form-input" value="${user.role === 'admin' ? 'Administrador' : 'Operador'}" disabled style="opacity:0.6"></div>
                <hr style="border-color:var(--border-light);margin:var(--space-lg) 0;">
                <h4 style="margin-bottom:var(--space-md);">🔒 Alterar Senha</h4>
                <div class="form-group"><label class="form-label">Senha Atual *</label><input type="password" class="form-input" id="profile-current-pw"></div>
                <div class="form-group"><label class="form-label">Nova Senha *</label><input type="password" class="form-input" id="profile-new-pw" placeholder="Mínimo 6 caracteres"></div>
                <button class="btn btn-primary" id="btn-change-pw">Alterar Senha</button>
            </div>

            <div class="card" style="max-width:500px;padding:var(--space-xl);margin-top:var(--space-md);">
                <h3 style="margin-bottom:var(--space-lg);">📱 Menu do Rodapé</h3>
                <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-lg);">Escolha quais módulos deseja exibir no menu inferior do seu celular (deslize para o lado se houver mais de 5).</p>
                <div id="footer-menu-options" style="display:flex; flex-direction:column; gap:10px; margin-bottom:var(--space-md);">
                    <!-- Generated via JS -->
                </div>
                <button class="btn btn-primary" id="btn-save-footer">Salvar Menu</button>
            </div>
        `;
        document.getElementById('btn-change-pw').addEventListener('click', async () => {
            const current = document.getElementById('profile-current-pw').value;
            const newPw = document.getElementById('profile-new-pw').value;
            if (!current || !newPw) { Toast.warning('Preencha ambos os campos.'); return; }
            if (newPw.length < 6) { Toast.warning('Senha deve ter no mínimo 6 caracteres.'); return; }
            const r = await API.put('/auth/password', { currentPassword: current, newPassword: newPw });
            if (r.success) { Toast.success('Senha alterada com sucesso!'); document.getElementById('profile-current-pw').value = ''; document.getElementById('profile-new-pw').value = ''; }
            else { Toast.error(r.message); }
        });

        // Bottom nav config logic
        const defaultItems = ['dashboard', 'pdv', 'products', 'stock', 'settings'];
        let selectedKeys = [];
        try { selectedKeys = JSON.parse(localStorage.getItem('sc_bottom_nav')) || defaultItems; } catch(e) { selectedKeys = defaultItems; }
        if (!selectedKeys || !selectedKeys.length) selectedKeys = defaultItems;

        const allItems = [
            { id: 'dashboard', label: 'Início' },
            { id: 'pdv', label: 'PDV' },
            { id: 'cashregister', label: 'Caixa' },
            { id: 'products', label: 'Produtos' },
            { id: 'categories', label: 'Categorias' },
            { id: 'customers', label: 'Clientes' },
            { id: 'suppliers', label: 'Fornecedores' },
            { id: 'stock', label: 'Estoque' },
            { id: 'financial', label: 'Financeiro' },
            { id: 'reports', label: 'Relatórios' },
            { id: 'settings', label: 'Configurações' }
        ];

        const menuOptionsDiv = document.getElementById('footer-menu-options');
        menuOptionsDiv.innerHTML = allItems.map(item => `
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:8px; background:var(--bg-input); border-radius:var(--radius-md);">
                <input type="checkbox" class="footer-cb" value="${item.id}" ${selectedKeys.includes(item.id) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent-primary);">
                <span>${item.label}</span>
            </label>
        `).join('');

        document.getElementById('btn-save-footer').addEventListener('click', () => {
            const checked = Array.from(document.querySelectorAll('.footer-cb:checked')).map(cb => cb.value);
            if (checked.length === 0) { Toast.warning('Selecione pelo menos um módulo.'); return; }
            localStorage.setItem('sc_bottom_nav', JSON.stringify(checked));
            Toast.success('Menu salvo! Recarregando layout...');
            setTimeout(() => location.reload(), 800);
        });
    },

    // ===== STORE TAB =====
    async renderStore(container) {
        const result = await API.get('/settings/store');
        const data = result.success ? result.data : {};

        container.innerHTML = `
            <div class="card" style="max-width:600px;padding:var(--space-xl);">
                <h3 style="margin-bottom:var(--space-lg);">🏪 Dados da Loja</h3>
                <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-lg);">Estes dados aparecem no cupom de venda e nos relatórios.</p>
                <div class="form-group"><label class="form-label">Nome da Loja</label><input type="text" class="form-input" id="store-name" value="${Utils.escapeHTML(data.store_name || '')}" placeholder="StockCell"></div>
                <div class="form-group">
                    <label class="form-label">Logo da Loja</label>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <img id="store-logo-preview" src="${data.store_logo || ''}" style="width:80px; height:80px; object-fit:contain; border-radius:8px; border:1px solid var(--border-light); display:${data.store_logo ? 'block' : 'none'}; background:#fff;">
                        <div style="flex:1;">
                            <input type="file" class="form-input" id="store-logo-input" accept="image/*" style="padding: 8px;">
                            <input type="hidden" id="store-logo-base64" value="${data.store_logo || ''}">
                            <small style="color:var(--text-muted);display:block;margin-top:4px;">Selecione uma imagem preferencialmente quadrada ou retangular. Formatos suportados: JPG, PNG, WEBP.</small>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">CNPJ</label>
                    <div style="display:flex;gap:var(--space-sm);">
                        <input type="text" class="form-input" id="store-cnpj" value="${Utils.escapeHTML(data.store_cnpj || '')}" placeholder="00.000.000/0000-00" style="flex:1;">
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-store-cnpj-lookup" title="Buscar dados pelo CNPJ" style="white-space:nowrap;padding:8px 12px;">🔍 Buscar</button>
                    </div>
                    <small id="store-cnpj-status" style="color:var(--text-muted);font-size:11px;margin-top:4px;display:block;"></small>
                </div>
                <div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-input" id="store-phone" value="${Utils.escapeHTML(data.store_phone || '')}" placeholder="(00) 00000-0000"></div>
                <div class="form-group"><label class="form-label">Endereço</label><input type="text" class="form-input" id="store-address" value="${Utils.escapeHTML(data.store_address || '')}" placeholder="Rua, número - Bairro - Cidade/UF"></div>
                

                <hr style="border-color:var(--border-light);margin:var(--space-lg) 0;">
                <h4 style="margin-bottom:var(--space-md);">📧 Configurações de E-mail (SMTP)</h4>
                <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-md);">
                    Configure o servidor de e-mail para enviar relatórios de O.S. diretamente pelo sistema.
                </p>
                <div style="background:rgba(79, 70, 229, 0.1); color:var(--text-primary); padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid var(--primary);">
                    <strong>Dica para Gmail / Outlook:</strong><br>
                    Se você utiliza Gmail ou Outlook, não é possível usar a sua senha normal. Você precisará gerar uma <strong>"Senha de Aplicativo" (App Password)</strong> nas configurações de segurança da sua conta Google/Microsoft e colá-la no campo "Senha SMTP" abaixo.
                </div>
                <div class="form-group"><label class="form-label">Servidor SMTP</label><input type="text" class="form-input" id="store-smtp-host" value="${Utils.escapeHTML(data.smtp_host || '')}" placeholder="ex: smtp.gmail.com"></div>
                <div class="form-group"><label class="form-label">Porta SMTP</label><input type="text" class="form-input" id="store-smtp-port" value="${Utils.escapeHTML(data.smtp_port || '')}" placeholder="ex: 465 ou 587"></div>
                <div class="form-group"><label class="form-label">Usuário (E-mail Remetente)</label><input type="text" class="form-input" id="store-smtp-user" value="${Utils.escapeHTML(data.smtp_user || '')}" placeholder="ex: contato@sua-assistencia.com.br"></div>
                <div class="form-group"><label class="form-label">Senha SMTP (ou App Password)</label><input type="password" class="form-input" id="store-smtp-pass" value="${Utils.escapeHTML(data.smtp_pass || '')}" placeholder="Sua senha ou senha de aplicativo"></div>
                
                <button class="btn btn-primary" id="btn-save-store" style="margin-top:var(--space-md);">💾 Salvar Configurações</button>
                


                ${Auth.getUser()?.role === 'admin' ? `
                <hr style="border-color:var(--danger);margin:var(--space-xl) 0;">
                <h4 style="margin-bottom:var(--space-md);color:var(--danger);">🧨 ZONA DE RISCO</h4>
                <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-md);">
                    Limpa completamente o banco de dados (produtos, vendas, clientes, etc.), mantendo <b>apenas as configurações e os usuários (logins)</b>. Ideal para apagar dados de teste.
                </p>
                <button class="btn btn-secondary" id="btn-factory-reset" style="border-color:var(--danger);color:var(--danger);width:100%;">
                    ⚠️ LIMPAR BANCO DE DADOS (Zerar Tudo)
                </button>
                ` : ''}
            </div>
        `;
        document.getElementById('btn-save-store').addEventListener('click', async () => {
            const r = await API.put('/settings/store', {
                store_name: document.getElementById('store-name').value,
                store_logo: document.getElementById('store-logo-base64') ? document.getElementById('store-logo-base64').value : '',
                store_cnpj: document.getElementById('store-cnpj').value,
                store_phone: document.getElementById('store-phone').value,
                store_address: document.getElementById('store-address').value,
                smtp_host: document.getElementById('store-smtp-host').value,
                smtp_port: document.getElementById('store-smtp-port').value,
                smtp_user: document.getElementById('store-smtp-user').value,
                smtp_pass: document.getElementById('store-smtp-pass').value
            });
            if (r.success) {
                Toast.success(r.message);
            } else Toast.error(r.message);
        });

        // CNPJ Lookup da Loja
        const storeCnpjInput = document.getElementById('store-cnpj');
        if (storeCnpjInput) Utils.maskInput(storeCnpjInput, '99.999.999/9999-99');

        // Logo upload handler
        const logoInput = document.getElementById('store-logo-input');
        if (logoInput) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) { // 2MB max
                        Toast.warning('A imagem da logo deve ter no máximo 2MB.');
                        e.target.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const base64 = evt.target.result;
                        document.getElementById('store-logo-base64').value = base64;
                        const preview = document.getElementById('store-logo-preview');
                        preview.src = base64;
                        preview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        document.getElementById('btn-store-cnpj-lookup').addEventListener('click', async () => {
            const statusEl = document.getElementById('store-cnpj-status');
            const digits = storeCnpjInput.value.replace(/\D/g, '');
            if (digits.length !== 14) {
                statusEl.textContent = '⚠️ CNPJ deve ter 14 dígitos.';
                statusEl.style.color = 'var(--warning)';
                return;
            }
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
                const nameEl = document.getElementById('store-name');
                const phoneEl = document.getElementById('store-phone');
                const addrEl = document.getElementById('store-address');

                if (nameEl && !nameEl.value) nameEl.value = data.nome_fantasia || data.razao_social || '';
                if (phoneEl && !phoneEl.value && data.ddd_telefone_1) {
                    const ddd = data.ddd_telefone_1.substring(0, 2);
                    const num = data.ddd_telefone_1.substring(2);
                    phoneEl.value = `(${ddd}) ${num}`;
                }
                if (addrEl && !addrEl.value) {
                    addrEl.value = [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.complemento, data.bairro, data.municipio, data.uf].filter(p => p && p.trim()).join(', ');
                }
                const situacao = data.descricao_situacao_cadastral || 'N/A';
                const cor = situacao === 'ATIVA' ? 'var(--success)' : 'var(--danger)';
                statusEl.innerHTML = `✅ <strong>${Utils.escapeHTML(data.razao_social)}</strong> — Situação: <span style="color:${cor};font-weight:600;">${situacao}</span>`;
                statusEl.style.color = 'var(--text-secondary)';
            } catch (err) {
                statusEl.textContent = '❌ Erro ao consultar. Verifique a conexão com a internet.';
                statusEl.style.color = 'var(--danger)';
            }
        });

        // Lógica de Factory Reset
        const btnReset = document.getElementById('btn-factory-reset');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                Modal.open({
                    title: '⚠️ Limpar Banco de Dados',
                    size: 'sm',
                    content: `
                        <div style="color:var(--danger);margin-bottom:var(--space-md);background:rgba(239,68,68,0.1);padding:var(--space-md);border-radius:var(--radius-md);">
                            <strong>Atenção:</strong> Esta ação é <b>IRREVERSÍVEL</b> e apagará todos os dados de vendas, produtos, clientes e estoque. Apenas usuários e configurações serão mantidos.
                        </div>
                        <div class="form-group">
                            <label class="form-label">Para confirmar, digite sua senha de Administrador:</label>
                            <input type="password" id="reset-password-input" class="form-input" placeholder="Senha do administrador">
                        </div>
                    `,
                    footer: `
                        <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                        <button class="btn btn-primary" style="background:var(--danger);border-color:var(--danger);" id="btn-confirm-reset">
                            ESTOU CIENTE, APAGAR TUDO
                        </button>
                    `
                });

                document.getElementById('btn-confirm-reset').addEventListener('click', async () => {
                    const pw = document.getElementById('reset-password-input').value;
                    if (!pw) { Toast.warning('Digite a senha para confirmar.'); return; }
                    
                    const btn = document.getElementById('btn-confirm-reset');
                    btn.disabled = true;
                    btn.textContent = 'Apagando banco de dados...';

                    const r = await API.post('/settings/factory-reset', { password: pw });
                    if (r.success) {
                        Toast.success(r.message);
                        document.querySelector('.modal-overlay').remove();
                        setTimeout(() => window.location.reload(), 2000);
                    } else {
                        Toast.error(r.message);
                        btn.disabled = false;
                        btn.textContent = 'ESTOU CIENTE, APAGAR TUDO';
                    }
                });
            });
        }
    }
};

/**
 * StockCell - Sidebar Navigation
 */
const Sidebar = {
    render(activePage) {
        const user = Auth.getUser();
        const initials = user ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD';

        return `
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-user" style="padding: 15px; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: var(--space-md); flex: 1; overflow: hidden;">
                        <div class="sidebar-user-avatar">${initials}</div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-user-name">${user ? Utils.escapeHTML(user.fullName) : 'Admin'}</div>
                            <div class="sidebar-user-role">${user ? (user.role === 'admin' ? 'Administrador' : 'Operador') : ''}</div>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-icon" id="btn-logout" title="Sair da Conta" style="color: var(--danger); padding: 8px;">
                        ${Icons.logOut}
                    </button>
                </div>

                <nav class="sidebar-nav">
                    <div class="sidebar-section-title">Principal</div>
                    <div class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
                        ${Icons.dashboard}
                        <span>Dashboard</span>
                    </div>
                    <div class="nav-item ${activePage === 'pdv' ? 'active' : ''}" data-page="pdv">
                        ${Icons.shoppingCart}
                        <span>PDV - Vendas</span>
                    </div>
                    <div class="nav-item ${activePage === 'os' ? 'active' : ''}" data-page="os">
                        🛠️
                        <span>Assistência Técnica</span>
                    </div>
                    <div class="nav-item ${activePage === 'cashregister' ? 'active' : ''}" data-page="cashregister">
                        ${Icons.dollarSign}
                        <span>Caixa</span>
                    </div>

                    <div class="sidebar-section-title">Cadastros</div>
                    <div class="nav-item ${activePage === 'products' ? 'active' : ''}" data-page="products">
                        ${Icons.package}
                        <span>Produtos</span>
                    </div>
                    <div class="nav-item ${activePage === 'categories' ? 'active' : ''}" data-page="categories">
                        ${Icons.tag}
                        <span>Categorias</span>
                    </div>
                    <div class="nav-item ${activePage === 'customers' ? 'active' : ''}" data-page="customers">
                        ${Icons.users}
                        <span>Clientes</span>
                    </div>
                    <div class="nav-item ${activePage === 'suppliers' ? 'active' : ''}" data-page="suppliers">
                        ${Icons.truck}
                        <span>Fornecedores</span>
                    </div>

                    <div class="sidebar-section-title">Gestão</div>
                    <div class="nav-item ${activePage === 'stock' ? 'active' : ''}" data-page="stock">
                        ${Icons.package}
                        <span>Estoque</span>
                    </div>
                    <div class="nav-item ${activePage === 'financial' ? 'active' : ''}" data-page="financial">
                        ${Icons.dollarSign}
                        <span>Financeiro</span>
                    </div>
                    <div class="nav-item ${activePage === 'reports' ? 'active' : ''}" data-page="reports">
                        ${Icons.barChart}
                        <span>Relatórios</span>
                    </div>

                    <div class="sidebar-section-title">Sistema</div>
                    <div class="nav-item ${activePage === 'logs' ? 'active' : ''}" data-page="logs">
                        📝
                        <span>Log de Atividades</span>
                    </div>
                    <div class="nav-item ${activePage === 'settings' ? 'active' : ''}" data-page="settings">
                        ${Icons.settings}
                        <span>Configurações</span>
                    </div>
                    <div class="nav-item" id="btn-install-pwa">
                        📲
                        <span>Instalar Aplicativo</span>
                    </div>
                </nav>

            </aside>
            <div class="sidebar-overlay" id="sidebar-overlay"></div>
        `;
    },

    bind() {
        // Navigation clicks
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                App.navigate(page);
                this.closeMobile();
            });
        });

        // Logout
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Modal.confirm('Deseja realmente sair do sistema?', () => Auth.logout());
            });
        }

        // Install PWA
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                localStorage.removeItem('sc_pwa_installed');
                if (App._deferredInstallPrompt) {
                    App._deferredInstallPrompt.prompt();
                    App._deferredInstallPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            localStorage.setItem('sc_pwa_installed', 'true');
                            Toast.success('Instalação iniciada!');
                        }
                        App._deferredInstallPrompt = null;
                    });
                } else {
                    Modal.open({
                        title: '📲 Instalar Aplicativo',
                        content: '<p>Seu navegador já registrou a recusa/instalação anterior ou não suporta o botão de atalho direto. Para instalar manualmente agora:</p><br><b>No Chrome (Android):</b> Clique nos 3 pontinhos no canto superior direito e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".',
                        footer: '<button class="btn btn-primary" onclick="document.querySelector(\'.modal-overlay\').remove()">Entendi</button>'
                    });
                }
                this.closeMobile();
            });
        }

        // Overlay click closes sidebar on mobile
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.closeMobile());
        }
    },

    toggleMobile() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('visible');
    },

    closeMobile() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
    },
};

/**
 * StockCell - SPA Router & App Init
 */
const App = {
    VERSION: 'v1.0.46',
    currentPage: null,
    appEl: null,

    _deferredInstallPrompt: null,

    async init() {
        this.appEl = document.getElementById('app');
        Toast.init();
        
        try {
            const sysInfo = await fetch('/api/system/info').then(r => r.json());
            if (sysInfo && sysInfo.data && sysInfo.data.version) {
                this.VERSION = 'v' + sysInfo.data.version;
            }
        } catch(e) {}

        // Initialize offline database
        try { await OfflineDB.init(); } catch (e) { console.warn('IndexedDB init:', e); }

        // Register PWA Service Worker
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
            } catch (e) {
                console.log('SW registration skipped:', e.message);
            }
        }

        // Capture PWA install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredInstallPrompt = e;
            if (!localStorage.getItem('sc_pwa_installed')) {
                this._showInstallBanner();
            }
        });

        // Hide banner if app is successfully installed natively
        window.addEventListener('appinstalled', () => {
            localStorage.setItem('sc_pwa_installed', 'true');
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.remove();
        });

        // Check session
        const authenticated = await Auth.checkSession();

        if (authenticated) {
            this.navigate('dashboard');
            // Initial sync in background
            SyncEngine.startAutoSync();
            SyncEngine.syncAll().then(r => {
                if (r.success) Toast.success('📡 ' + r.message);
            });
        } else {
            this.navigate('login');
        }

        this.bindGlobalSearch();
    },

    _showInstallBanner() {
        if (document.getElementById('pwa-install-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.innerHTML = `
            <div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
                background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;
                padding:12px 20px;border-radius:16px;display:flex;align-items:center;gap:12px;
                box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:999;max-width:360px;width:90%;
                animation:slideUp .4s ease;">
                <span style="font-size:1.5rem;">📲</span>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:14px;">Instalar StockCell</div>
                    <div style="font-size:11px;opacity:0.85;">Acesse direto da tela inicial</div>
                </div>
                <button id="pwa-install-btn" style="background:#fff;color:#667eea;border:none;padding:8px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">Instalar</button>
                <button id="pwa-dismiss-btn" style="background:none;border:none;color:#fff;opacity:0.7;cursor:pointer;font-size:18px;padding:4px;">✕</button>
            </div>
        `;
        document.body.appendChild(banner);
        document.getElementById('pwa-install-btn').addEventListener('click', async () => {
            if (this._deferredInstallPrompt) {
                this._deferredInstallPrompt.prompt();
                const { outcome } = await this._deferredInstallPrompt.userChoice;
                if (outcome === 'accepted') {
                    Toast.success('App instalado com sucesso! 🎉');
                    localStorage.setItem('sc_pwa_installed', 'true');
                }
                this._deferredInstallPrompt = null;
            }
            banner.remove();
        });
        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            localStorage.setItem('sc_pwa_installed', 'true'); // Ignora futuros banners
            banner.remove();
        });
    },

    bindGlobalSearch() {
        let debounceTimer;
        const modal = document.getElementById('modal-global-search');
        const input = document.getElementById('global-search-input');
        const resultsBox = document.getElementById('global-search-results');
        const btnClose = document.getElementById('btn-close-global-search');

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                modal.style.display = 'flex';
                input.focus();
            }
        });

        const closeModal = () => {
            modal.style.display = 'none';
            input.value = '';
            resultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 14px;">Digite pelo menos 2 caracteres...</div>';
        };

        btnClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeModal();
            }
        });

        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            if (query.length < 2) {
                resultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 14px;">Digite pelo menos 2 caracteres...</div>';
                return;
            }
            debounceTimer = setTimeout(async () => {
                resultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 14px;">Buscando...</div>';
                try {
                    const result = await API.get('/search?q=' + encodeURIComponent(query));
                    if (!result.success) throw new Error();
                    
                    const d = result.data;
                    let html = '';

                    if (d.products.length) {
                        html += '<div style="padding: 5px 15px; font-weight: bold; background: var(--bg-card); color: var(--text-muted); font-size: 12px; text-transform: uppercase;">Produtos</div>';
                        d.products.forEach(p => {
                            html += `<div style="padding: 10px 15px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="App.navigate('products'); setTimeout(() => ProductsPage.openModal(${p.id}), 500); document.getElementById('modal-global-search').style.display='none';">
                                <div style="font-weight: 500; font-size: 14px; color: var(--text-main);">${Utils.escapeHTML(p.name)}</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Estoque: ${p.current_stock} | Preço: ${Utils.formatCurrency(p.sale_price)}</div>
                            </div>`;
                        });
                    }

                    if (d.customers.length) {
                        html += '<div style="padding: 5px 15px; font-weight: bold; background: var(--bg-card); color: var(--text-muted); font-size: 12px; text-transform: uppercase;">Clientes</div>';
                        d.customers.forEach(c => {
                            html += `<div style="padding: 10px 15px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="App.navigate('customers'); setTimeout(() => CustomersPage.openModal(${c.id}), 500); document.getElementById('modal-global-search').style.display='none';">
                                <div style="font-weight: 500; font-size: 14px; color: var(--text-main);">${Utils.escapeHTML(c.name)}</div>
                                <div style="font-size: 12px; color: var(--text-muted);">CPF/CNPJ: ${c.document || 'N/A'} | Tel: ${c.phone || 'N/A'}</div>
                            </div>`;
                        });
                    }

                    if (d.sales.length) {
                        html += '<div style="padding: 5px 15px; font-weight: bold; background: var(--bg-card); color: var(--text-muted); font-size: 12px; text-transform: uppercase;">Vendas</div>';
                        d.sales.forEach(s => {
                            html += `<div style="padding: 10px 15px; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="App.navigate('reports'); document.getElementById('modal-global-search').style.display='none';">
                                <div style="font-weight: 500; font-size: 14px; color: var(--text-main);">Venda #${s.id}</div>
                                <div style="font-size: 12px; color: var(--text-muted);">Valor: ${Utils.formatCurrency(s.total)} | Data: ${Utils.formatDate(s.created_at)}</div>
                            </div>`;
                        });
                    }

                    if (!html) {
                        html = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 14px;">Nenhum resultado encontrado.</div>';
                    }

                    resultsBox.innerHTML = html;
                } catch(e) {
                    resultsBox.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger); font-size: 14px;">Erro ao buscar.</div>';
                }
            }, 300);
        });
    },

    navigate(page) {
        this.currentPage = page;

        // Page title map
        const pageTitles = {
            login: 'Login',
            dashboard: 'Dashboard',
            pdv: 'PDV - Vendas',
            cashregister: 'Caixa',
            products: 'Produtos',
            categories: 'Categorias',
            customers: 'Clientes',
            suppliers: 'Fornecedores',
            stock: 'Estoque',
            os: 'Assistência Técnica (O.S.)',
            financial: 'Financeiro',
            reports: 'Relatórios',
            settings: 'Configurações',
        };

        document.title = `StockCell - ${pageTitles[page] || page}`;

        if (page === 'login') {
            this.renderLogin();
            return;
        }

        // All other pages require auth
        if (!Auth.isAuthenticated()) {
            this.navigate('login');
            return;
        }

        this.renderApp(page, pageTitles[page] || page);
    },

    renderLogin() {
        Header.destroy();
        this.appEl.innerHTML = LoginPage.render();
        LoginPage.bind();
    },

    renderApp(page, title) {
        const pageContent = this.getPageContent(page);

        this.appEl.innerHTML = `
            <div class="app-container">
                ${Sidebar.render(page)}
                <main class="main-content">
                    ${Header.render(title)}
                    ${pageContent}
                </main>
            </div>
            ${this.renderBottomNav(page)}
        `;

        Sidebar.bind();
        Header.bind();
        this.bindBottomNav();
        this.bindPageEvents(page);
    },

    getPageContent(page) {
        switch (page) {
            case 'dashboard': return DashboardPage.render();
            case 'pdv': return PDVPage.render();
            case 'cashregister': return CashRegisterPage.render();
            case 'categories': return CategoriesPage.render();
            case 'products': return ProductsPage.render();
            case 'customers': return CustomersPage.render();
            case 'suppliers': return SuppliersPage.render();
            case 'stock': return StockPage.render();
            case 'os': return OSPage.render();
            case 'financial': return FinancePage.render();
            case 'reports': return ReportsPage.render();
            case 'settings': return SettingsPage.render();
            case 'logs': return LogsPage.render();
            default:
                return this.renderPlaceholder(page);
        }
    },

    bindPageEvents(page) {
        switch (page) {
            case 'dashboard': DashboardPage.bind(); break;
            case 'pdv': PDVPage.bind(); break;
            case 'cashregister': CashRegisterPage.bind(); break;
            case 'categories': CategoriesPage.bind(); break;
            case 'products': ProductsPage.bind(); break;
            case 'customers': CustomersPage.bind(); break;
            case 'suppliers': SuppliersPage.bind(); break;
            case 'stock': StockPage.bind(); break;
            case 'os': OSPage.bind(); break;
            case 'financial': FinancePage.bind(); break;
            case 'reports': ReportsPage.bind(); break;
            case 'settings': SettingsPage.bind(); break;
            case 'logs': LogsPage.bind(); break;
        }
    },

    renderPlaceholder(page) {
        const icons = {
            pdv: '🛒', products: '📦', categories: '🏷️',
            customers: '👥', suppliers: '🚚', stock: '📊',
            financial: '💰', reports: '📈', settings: '⚙️',
        };
        return `
            <div class="page-content page-enter">
                <div class="empty-state">
                    <div class="empty-state-icon">${icons[page] || '📋'}</div>
                    <div class="empty-state-text">
                        Este módulo será implementado na próxima fase.
                    </div>
                    <button class="btn btn-secondary" onclick="App.navigate('dashboard')">
                        Voltar ao Dashboard
                    </button>
                </div>
            </div>
        `;
    },

    renderBottomNav(activePage) {
        const defaultItems = ['dashboard', 'pdv', 'products', 'stock', 'settings'];
        let selectedKeys = [];
        try {
            selectedKeys = JSON.parse(localStorage.getItem('sc_bottom_nav')) || defaultItems;
        } catch(e) { selectedKeys = defaultItems; }

        if (!selectedKeys || !selectedKeys.length) selectedKeys = defaultItems;

        const allItems = {
            'dashboard': { page: 'dashboard', icon: Icons.dashboard, label: 'Início' },
            'pdv': { page: 'pdv', icon: Icons.shoppingCart, label: 'PDV' },
            'cashregister': { page: 'cashregister', icon: Icons.dollarSign, label: 'Caixa' },
            'products': { page: 'products', icon: Icons.package, label: 'Produtos' },
            'categories': { page: 'categories', icon: Icons.tag, label: 'Categ.' },
            'customers': { page: 'customers', icon: Icons.users, label: 'Clientes' },
            'suppliers': { page: 'suppliers', icon: Icons.truck, label: 'Fornec.' },
            'stock': { page: 'stock', icon: Icons.barChart, label: 'Estoque' },
            'os': { page: 'os', icon: '🛠️', label: 'O.S.' },
            'financial': { page: 'financial', icon: Icons.dollarSign, label: 'Finanças' },
            'reports': { page: 'reports', icon: Icons.barChart, label: 'Relat.' },
            'logs': { page: 'logs', icon: '📝', label: 'Logs' },
            'settings': { page: 'settings', icon: Icons.settings, label: 'Config' }
        };

        const items = selectedKeys.map(k => allItems[k]).filter(Boolean);

        return `
            <nav class="bottom-nav" id="bottom-nav">
                ${items.map(item => `
                    <button class="bottom-nav-item ${activePage === item.page ? 'active' : ''}" data-page="${item.page}">
                        ${item.icon}
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </nav>
        `;
    },

    bindBottomNav() {
        document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                App.navigate(item.dataset.page);
            });
        });
    },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

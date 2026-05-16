/**
 * StockCell - Header Component
 */
const Header = {
    render(title, subtitle = '') {
        return `
            <header class="app-header">
                <div class="header-left">
                    <button class="menu-toggle" id="menu-toggle" aria-label="Menu">
                        ${Icons.menu}
                    </button>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <div class="sidebar-logo" style="width: 32px; height: 32px; font-size: 1rem;">📱</div>
                        <div style="display:flex; flex-direction:column; justify-content:center;">
                            <span class="sidebar-brand" style="font-size: 1rem;">StockCell</span>
                            <span style="font-size: 9px; color: var(--text-muted); line-height: 1;">${App.VERSION}</span>
                        </div>
                    </div>
                    <div style="margin-left: var(--space-md); border-left: 1px solid var(--border-light); padding-left: var(--space-md);">
                        <h1 class="header-title">${title}</h1>
                        ${subtitle ? `<p class="header-subtitle">${subtitle}</p>` : ''}
                    </div>
                </div>
                <div class="header-right" style="gap:var(--space-md); align-items:center;">
                    <div id="header-stock-alert" style="position:relative;cursor:pointer;display:none;margin-right:8px;" onclick="App.navigate('stock')" title="Produtos com estoque baixo">
                        <span style="font-size:1.2rem;">🔔</span>
                        <span id="header-stock-badge" style="position:absolute;top:-5px;right:-8px;background:var(--danger);color:#fff;font-size:10px;font-weight:bold;padding:2px 5px;border-radius:10px;">0</span>
                    </div>
                    <span id="sync-status" style="font-size:var(--font-size-md);cursor:pointer;padding:4px;" title="Clique para sincronizar" onclick="SyncEngine.syncAll().then(r=>{if(r.success)Toast.success('📡 '+r.message);else Toast.warning(r.message);})">🟢</span>
                    <div class="header-datetime" id="header-datetime" style="font-size: var(--font-size-sm); color: var(--text-secondary);"></div>
                </div>
            </header>
        `;
    },

    bind() {
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => Sidebar.toggleMobile());
        }
        this.updateDateTime();
        this.checkLowStock();
        
        window.addEventListener('resize', () => this.updateDateTime());
        
        window.addEventListener('server-status-change', () => {
            if (typeof SyncEngine !== 'undefined') SyncEngine._updateUI(window.serverIsReachable ? 'online' : 'offline');
        });
        if (typeof SyncEngine !== 'undefined') SyncEngine._updateUI(window.serverIsReachable !== false ? 'online' : 'offline');
        
        this._interval = setInterval(() => {
            this.updateDateTime();
            this.checkLowStock();
        }, 60000);
    },

    async checkLowStock() {
        if (!Auth.getUser()) return;
        try {
            const res = await API.get('/stock/low');
            if (res.success && res.data && res.data.length > 0) {
                const el = document.getElementById('header-stock-alert');
                const badge = document.getElementById('header-stock-badge');
                if (el && badge) {
                    el.style.display = 'block';
                    badge.textContent = res.data.length;
                }
            } else {
                const el = document.getElementById('header-stock-alert');
                if (el) el.style.display = 'none';
            }
        } catch(e){}
    },

    updateDateTime() {
        const el = document.getElementById('header-datetime');
        if (el) {
            const now = new Date();
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                el.textContent = now.toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: '2-digit'
                });
            } else {
                el.textContent = now.toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                }) + ' • ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        }
    },

    destroy() {
        if (this._interval) clearInterval(this._interval);
    },
};

/**
 * StockCell - Sync Engine
 * Sincronização bidirecional entre IndexedDB local e servidor.
 */
const SyncEngine = {
    _syncing: false,

    /** Full sync: push local changes, then pull server data */
    async syncAll() {
        if (this._syncing) return { success: false, message: 'Sincronização em andamento...' };
        this._syncing = true;
        this._updateUI('syncing');

        try {
            const online = await APIOffline.isOnline();
            if (!online) {
                this._updateUI('offline');
                return { success: false, message: 'Servidor indisponível.' };
            }

            // 1. Push offline queue
            const pushResult = await this._pushQueue();

            // 2. Pull fresh data from server
            const pullResult = await this._pullAll();

            // 3. Cache user for offline login
            const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => null);
            if (session && session.authenticated) {
                localStorage.setItem('sc_offline_user', JSON.stringify(session.user));
            }

            // 4. Update sync timestamp
            await OfflineDB.setSyncTimestamp(new Date().toISOString());

            this._updateUI('online');
            const msg = `Sincronizado! ${pushResult.pushed} enviados, dados atualizados.`;
            return { success: true, message: msg };
        } catch (error) {
            console.error('Sync error:', error);
            this._updateUI('error');
            return { success: false, message: 'Erro na sincronização: ' + error.message };
        } finally {
            this._syncing = false;
        }
    },

    /** Push all queued offline operations to server */
    async _pushQueue() {
        const queue = await OfflineDB.getQueue();
        let pushed = 0;

        for (const op of queue) {
            try {
                let result;
                if (op.type === 'sale') {
                    result = await fetch('/api/sync/push-sale', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(op.data)
                    }).then(r => r.json());
                } else if (op.type === 'transaction') {
                    result = await fetch('/api/sync/push-transaction', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(op.data)
                    }).then(r => r.json());
                } else if (op.type === 'transaction_payment') {
                    result = await fetch('/api/sync/push-transaction-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(op.data)
                    }).then(r => r.json());
                } else if (op.type === 'cash_register') {
                    result = await fetch('/api/sync/push-cash-register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(op.data)
                    }).then(r => r.json());
                } else if (op.type === 'cash_movement') {
                    result = await fetch('/api/sync/push-cash-movement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify(op.data)
                    }).then(r => r.json());
                }

                if (result && result.success) {
                    await OfflineDB.dequeue(op.uuid);
                    pushed++;
                } else {
                    console.warn('Push failed for', op.uuid, result?.message);
                }
            } catch (e) {
                console.error('Push error for', op.uuid, e);
                break; // Stop on network error
            }
        }
        return { pushed };
    },

    /** Pull all data from server and replace local stores */
    async _pullAll() {
        try {
            const result = await fetch('/api/sync/pull-all', {
                credentials: 'same-origin'
            }).then(r => r.json());

            if (!result.success) return;

            const stores = ['products', 'categories', 'customers', 'suppliers', 'sales', 'sale_items', 'payments', 'transactions', 'transaction_categories', 'transaction_payments', 'bank_accounts', 'stock_movements', 'cash_registers', 'cash_movements'];

            for (const store of stores) {
                if (result.data[store] && result.data[store].length >= 0) {
                    await OfflineDB.clear(store);
                    if (result.data[store].length > 0) {
                        await OfflineDB.putBulk(store, result.data[store]);
                    }
                }
            }

            // Cache settings
            if (result.data.settings) {
                localStorage.setItem('sc_offline_settings', JSON.stringify(result.data.settings));
            }
        } catch (e) {
            console.error('Pull error:', e);
        }
    },

    /** Auto-sync: verifica conectividade com o SERVIDOR (não com a internet) */
    startAutoSync() {
        // Escuta mudanças de status vindas do api.js (que detecta falhas reais de rede ao servidor)
        window.addEventListener('server-status-change', () => {
            if (window.serverIsReachable) {
                console.log('📡 Servidor acessível - sincronizando...');
                this._updateUI('syncing');
                setTimeout(() => this.syncAll().then(r => {
                    if (r.success) Toast.success(r.message);
                }), 1000);
            } else {
                console.log('📴 Servidor inacessível');
                this._updateUI('offline');
                Toast.warning('Sem conexão com o servidor. Modo offline ativado.');
            }
        });

        // Polling periódico: verifica se o servidor está acessível a cada 30s
        this._pollInterval = setInterval(async () => {
            const wasReachable = window.serverIsReachable;
            const online = await APIOffline.isOnline();
            if (online && !wasReachable) {
                window.serverIsReachable = true;
                window.dispatchEvent(new Event('server-status-change'));
            } else if (!online && wasReachable !== false) {
                window.serverIsReachable = false;
                window.dispatchEvent(new Event('server-status-change'));
            }
        }, 30000);

        // Estado inicial: verificar servidor de verdade (não navigator.onLine)
        APIOffline.isOnline().then(online => {
            window.serverIsReachable = online;
            this._updateUI(online ? 'online' : 'offline');
        });
    },

    /** Update header UI indicator */
    _updateUI(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            online: { text: '🟢', color: 'var(--success)' },
            offline: { text: '🔴', color: 'var(--danger)' },
            syncing: { text: '🔄', color: 'var(--warning)' },
            error: { text: '⚠️', color: 'var(--danger)' }
        };
        const s = states[status] || states.online;
        el.textContent = s.text;
        el.style.color = s.color;
    },

    /** Get count of pending operations */
    async getPendingCount() {
        return (await OfflineDB.getQueue()).length;
    },

    /** Export all OfflineDB data to a JSON file */
    async exportBackup() {
        try {
            const data = {};
            for (const store of OfflineDB.STORES) {
                data[store] = await OfflineDB.getAll(store);
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stockcell_backup_${Utils.formatDateTime(new Date()).replace(/\D/g, '')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return { success: true, message: 'Backup exportado com sucesso!' };
        } catch (error) {
            console.error('Export error:', error);
            return { success: false, message: 'Erro ao exportar backup: ' + error.message };
        }
    },

    /** Import a JSON backup file and send pending queue to server */
    async importBackup(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.offline_queue) {
                        return resolve({ success: false, message: 'Arquivo inválido ou sem fila de sincronização.' });
                    }

                    // Send the queue directly to the server to process
                    const response = await fetch('/api/sync/import-pwa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ queue: data.offline_queue })
                    });
                    
                    const result = await response.json();
                    resolve(result);
                } catch (err) {
                    console.error('Import error:', err);
                    resolve({ success: false, message: 'Erro ao ler arquivo: ' + err.message });
                }
            };
            reader.readAsText(file);
        });
    }
};

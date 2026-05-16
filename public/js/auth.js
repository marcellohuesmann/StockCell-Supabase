/**
 * StockCell - Auth Manager
 */
const Auth = {
    _user: null,

    async checkSession() {
        // Optimistic Offline Login first
        const cached = localStorage.getItem('sc_offline_user');
        if (cached) {
            this._user = JSON.parse(cached);
            
            // Verificação em background se o servidor local está realmente acessível
            // Isso evita que o celular fique travado na rede 4G tentando achar o IP local
            setTimeout(async () => {
                try {
                    const result = await API.request('GET', '/auth/session', null, 5000); // 5s timeout
                    if (result.success && result.authenticated) {
                        this._user = result.user;
                        if (typeof SyncEngine !== 'undefined') SyncEngine.startAutoSync();
                    } else if (result.success && !result.authenticated) {
                        // O servidor respondeu, mas a sessão expirou
                        this.handleSessionExpired();
                    }
                } catch (e) {
                    console.log('Servidor inatingível em background, continuando offline.');
                }
            }, 1000);
            
            return true;
        }

        // Se não tem cache, tenta bater no servidor com timeout rápido
        const result = await API.request('GET', '/auth/session', null, 3000);
        if (result.success && result.authenticated) {
            this._user = result.user;
            return true;
        }
        this._user = null;
        return false;
    },

    setUser(user) {
        this._user = user;
    },

    getUser() {
        return this._user;
    },

    isAuthenticated() {
        return this._user !== null;
    },

    async _saveOfflineCredentials(username, password, userObj) {
        try {
            const hash = await Utils.hashPassword(password);
            let known = {};
            try { known = JSON.parse(localStorage.getItem('sc_known_users') || '{}'); } catch(err) {}
            known[username] = { hash, user: userObj };
            localStorage.setItem('sc_known_users', JSON.stringify(known));
            // console.log('Credenciais offline salvas com sucesso para:', username);
        } catch (e) {
            console.error('Falha ao salvar credenciais offline', e);
        }
    },

    async login(username, password) {
        username = username.trim().toLowerCase();
        // Optimistic offline login
        const cached = localStorage.getItem('sc_offline_user');
        if (cached && window.serverIsReachable !== false) {
            const u = JSON.parse(cached);
            if (u.username === username) {
                // Tenta validar no servidor rápido, se falhar, assume offline
                const res = await API.request('POST', '/auth/login', { username, password }, 3000);
                if (res.success) {
                    this._user = res.user;
                    localStorage.setItem('sc_offline_user', JSON.stringify(res.user));
                    await this._saveOfflineCredentials(username, password, res.user);
                    return res;
                } else if (!res.success && res.message === 'Sem conexão com o servidor.') {
                    this._user = u;
                    return { success: true, user: u, offline: true };
                }
                return res; // Credenciais incorretas
            }
        }

        const result = await API.request('POST', '/auth/login', { username, password }, 3000);
        if (result.success) {
            this._user = result.user;
            localStorage.setItem('sc_offline_user', JSON.stringify(result.user));
            await this._saveOfflineCredentials(username, password, result.user);
        }
        return result;
    },

    async logout() {
        await API.post('/auth/logout');
        this._user = null;
        localStorage.removeItem('sc_offline_user'); // Remove login otimista
        Toast.info('Sessão encerrada.');
        App.navigate('login');
    },

    handleSessionExpired() {
        this._user = null;
        localStorage.removeItem('sc_offline_user');
        Toast.warning('Sua sessão expirou. Faça login novamente.');
        App.navigate('login');
    },
};

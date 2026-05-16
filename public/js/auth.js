/**
 * StockCell - Auth Manager
 */
const Auth = {
    _user: null,

    async checkSession() {
        const result = await API.request('GET', '/auth/session');
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

    async login(username, password) {
        username = username.trim().toLowerCase();
        const result = await API.request('POST', '/auth/login', { username, password });
        if (result.success) {
            this._user = result.user;
        }
        return result;
    },

    async logout() {
        await API.post('/auth/logout');
        this._user = null;
        Toast.info('Sessão encerrada.');
        App.navigate('login');
    },

    handleSessionExpired() {
        this._user = null;
        Toast.warning('Sua sessão expirou. Faça login novamente.');
        App.navigate('login');
    },
};

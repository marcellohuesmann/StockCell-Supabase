/**
 * StockCell - API Client (Fetch Wrapper)
 */
const API = {
    baseURL: '/api',

    async request(method, endpoint, data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, options);
            const result = await response.json();

            if (response.status === 401) {
                Auth.handleSessionExpired();
                return { success: false, message: 'Sessão expirada.' };
            }

            return result;
        } catch (error) {
            console.error(`[API Error] ${method} ${endpoint}:`, error.message);
            return { success: false, message: 'Erro de conexão com o servidor.' };
        }
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); },
};

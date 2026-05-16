/**
 * StockCell - API Client (Fetch Wrapper)
 */
const API = {
    baseURL: '/api',

    async request(method, endpoint, data = null, timeoutMs = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        // Se já sabemos que o servidor está offline, pula direto pro Fallback (Evita hang no 4G)
        if (window.serverIsReachable === false && endpoint !== '/auth/session' && !endpoint.includes('sync')) {
            return await APIOffline.handle(method, endpoint, data);
        }

        let timeoutId;
        // Default timeout: 15s for normal requests (prevents slow networks from causing fake offline),
        // 5s if we already know it's offline and are just trying to ping.
        const effectiveTimeout = timeoutMs || (window.serverIsReachable === false ? 5000 : 15000);
        
        let timeoutPromise = new Promise(() => {}); // Never resolves if no timeout
        if (effectiveTimeout) {
            const controller = new AbortController();
            options.signal = controller.signal;
            timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Timeout forced'));
                }, effectiveTimeout);
            });
        }

        // FASE 1: Tentar conectar ao servidor (erros aqui = realmente offline)
        let response;
        try {
            const fetchPromise = fetch(`${this.baseURL}${endpoint}`, options);
            response = await Promise.race([fetchPromise, timeoutPromise]);
            if (timeoutId) clearTimeout(timeoutId);
        } catch (networkError) {
            // Erro REAL de rede (sem conexão, timeout, DNS, etc.)
            if (timeoutId) clearTimeout(timeoutId);
            if (window.serverIsReachable !== false) {
                window.serverIsReachable = false;
                window.dispatchEvent(new Event('server-status-change'));
            }
            console.warn(`[REDE] Offline fallback [${method} ${endpoint}]:`, networkError.message);
            if (typeof APIOffline !== 'undefined') {
                try {
                    return await APIOffline.handle(method, endpoint, data);
                } catch (offErr) {
                    console.error('Offline handler error:', offErr);
                }
            }
            return { success: false, message: 'Sem conexão com o servidor.' };
        }

        // FASE 2: Servidor respondeu! Marcar como online e processar resposta
        if (window.serverIsReachable === false) {
            window.serverIsReachable = true;
            window.dispatchEvent(new Event('server-status-change'));
        }

        try {
            const result = await response.json();

            if (response.status === 401) {
                Auth.handleSessionExpired();
                return { success: false, message: 'Sessão expirada.' };
            }

            // Cache user on successful login for offline use
            if (endpoint === '/auth/login' && result.success && result.user) {
                localStorage.setItem('sc_offline_user', JSON.stringify(result.user));
            }

            return result;
        } catch (parseError) {
            // Servidor respondeu, mas resposta inválida (NÃO é offline!)
            console.error(`[PARSE] Erro ao processar resposta [${method} ${endpoint}]:`, parseError.message);
            return { success: false, message: 'Erro ao processar resposta do servidor.' };
        }
    },

    get(endpoint) { return this.request('GET', endpoint); },
    post(endpoint, data) { return this.request('POST', endpoint, data); },
    put(endpoint, data) { return this.request('PUT', endpoint, data); },
    delete(endpoint) { return this.request('DELETE', endpoint); },
};

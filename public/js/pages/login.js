/**
 * StockCell - Login Page
 */
const LoginPage = {
    render() {
        return `
            <div class="login-container">
                <div class="login-bg">
                    <div class="login-bg-orb"></div>
                    <div class="login-bg-orb"></div>
                    <div class="login-bg-orb"></div>
                </div>

                <div class="login-card">
                    <div class="login-logo">
                        <div class="login-logo-icon">📱</div>
                        <h1 class="login-title">StockCell</h1>
                        <p class="login-subtitle">Sistema de Gestão de Vendas e Estoque</p>
                    </div>

                    <div class="login-error" id="login-error">
                        <span>${Icons.alertTriangle}</span>
                        <span id="login-error-text"></span>
                    </div>

                    <form class="login-form" id="login-form" autocomplete="on">
                        <div class="login-input-wrapper">
                            ${Icons.user}
                            <input
                                type="text"
                                class="login-input"
                                id="login-username"
                                name="username"
                                placeholder="Usuário"
                                autocomplete="username"
                                required
                                autofocus
                            >
                        </div>

                        <div class="login-input-wrapper">
                            ${Icons.lock}
                            <input
                                type="password"
                                class="login-input"
                                id="login-password"
                                name="password"
                                placeholder="Senha"
                                autocomplete="current-password"
                                required
                            >
                            <button type="button" class="password-toggle" id="password-toggle" tabindex="-1">
                                ${Icons.eye}
                            </button>
                        </div>

                        <button type="submit" class="login-btn" id="login-btn">
                            Entrar
                        </button>
                    </form>

                    <div class="login-footer">
                        StockCell ${App.VERSION} &copy; ${new Date().getFullYear()}
                    </div>
                </div>
            </div>
        `;
    },

    bind() {
        const form = document.getElementById('login-form');
        const passwordToggle = document.getElementById('password-toggle');
        const passwordInput = document.getElementById('login-password');

        // Toggle password visibility
        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', () => {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                passwordToggle.innerHTML = isPassword ? Icons.eyeOff : Icons.eye;
            });
        }

        // Form submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }
    },

    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const errorDiv = document.getElementById('login-error');
        const errorText = document.getElementById('login-error-text');

        if (!username || !password) {
            errorDiv.classList.add('visible');
            errorText.textContent = 'Preencha usuário e senha.';
            return;
        }

        // Loading state
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div>';
        errorDiv.classList.remove('visible');

        const result = await Auth.login(username, password);

        if (result.success) {
            Toast.success(`Bem-vindo, ${result.user.fullName}!`);
            App.navigate('dashboard');
        } else {
            errorDiv.classList.add('visible');
            errorText.textContent = result.message;
            btn.disabled = false;
            btn.textContent = 'Entrar';
            // Shake animation
            document.querySelector('.login-card').style.animation = 'none';
            requestAnimationFrame(() => {
                document.querySelector('.login-card').style.animation = '';
            });
        }
    },
};

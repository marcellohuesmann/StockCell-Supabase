/**
 * StockCell - Log de Atividades
 */
const LogsPage = {
    logs: [],
    
    render() {
        const today = new Date().toISOString().substring(0, 10);
        return `
        <div class="page-content page-enter">
            <div class="page-header">
                <div>
                    <h2 class="page-title">📝 Log de Atividades</h2>
                    <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Auditoria de ações do sistema</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header" style="flex-wrap:wrap;gap:var(--space-sm);">
                    <div style="display:flex;gap:var(--space-sm);align-items:center;">
                        <input type="date" id="logs-date" class="form-input" value="${today}">
                        <select id="logs-action" class="form-input">
                            <option value="">Todas as Ações</option>
                            <option value="login">Login</option>
                            <option value="sale">Vendas</option>
                            <option value="delete">Exclusões</option>
                            <option value="cash_register">Caixa</option>
                            <option value="update_permissions">Permissões</option>
                        </select>
                        <button class="btn btn-secondary" onclick="LogsPage.loadLogs()">${Icons.search}</button>
                    </div>
                </div>
                
                <div id="logs-list">
                    <div style="padding:var(--space-xl);text-align:center;"><div class="spinner"></div></div>
                </div>
            </div>
        </div>
        `;
    },

    bind() {
        this.loadLogs();
        document.getElementById('logs-date').addEventListener('change', () => this.loadLogs());
        document.getElementById('logs-action').addEventListener('change', () => this.loadLogs());
    },

    async loadLogs() {
        const date = document.getElementById('logs-date').value;
        const action = document.getElementById('logs-action').value;
        
        let url = `/logs?date=${date}`;
        if (action) url += `&action=${action}`;
        
        const result = await API.get(url);
        if (result.success) {
            this.logs = result.data;
            this.renderList();
        } else {
            document.getElementById('logs-list').innerHTML = `<div style="padding:var(--space-xl);text-align:center;color:var(--danger);">${result.message}</div>`;
        }
    },

    renderList() {
        const container = document.getElementById('logs-list');
        if (!this.logs.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">Nenhum log encontrado neste período.</div></div>`;
            return;
        }

        const actionLabels = {
            'login': '<span class="badge badge-info">Login</span>',
            'login_failed': '<span class="badge badge-danger">Falha Login</span>',
            'logout': '<span class="badge badge-info">Logout</span>',
            'password_change': '<span class="badge badge-warning">Senha</span>',
            'sale': '<span class="badge badge-success">Venda</span>',
            'cancel_sale': '<span class="badge badge-danger">Venda Cancelada</span>',
            'create': '<span class="badge badge-success">Criação</span>',
            'update': '<span class="badge badge-info">Atualização</span>',
            'delete': '<span class="badge badge-danger">Exclusão</span>',
            'open_register': '<span class="badge badge-warning">Abertura Caixa</span>',
            'close_register': '<span class="badge badge-warning">Fechamento Caixa</span>',
            'withdraw': '<span class="badge badge-warning">Sangria</span>',
            'supply': '<span class="badge badge-warning">Suprimento</span>',
            'update_permissions': '<span class="badge badge-info">Permissões</span>',
        };

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:160px">Data / Hora</th>
                            <th style="width:150px">Usuário</th>
                            <th style="width:120px">Ação</th>
                            <th>Descrição</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.logs.map(log => `
                            <tr>
                                <td data-label="Data">${Utils.formatDateTime(log.created_at)}</td>
                                <td data-label="Usuário" style="font-weight:600;">${Utils.escapeHTML(log.full_name || log.username || 'Sistema')}</td>
                                <td data-label="Ação">${actionLabels[log.action] || `<span class="badge">${Utils.escapeHTML(log.action)}</span>`}</td>
                                <td data-label="Descrição" style="color:var(--text-secondary);">${Utils.escapeHTML(log.description || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
};

window.LogsPage = LogsPage;

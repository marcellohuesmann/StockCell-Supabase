/**
 * StockCell - Módulo Financeiro
 */
const FinancePage = {
    transactions: [],
    categories: [],
    accounts: [],
    currentMonth: new Date().toISOString().substring(0, 7),
    filterStatus: '', // '' = todos, 'pending' = a pagar/receber, 'completed' = pagos
    filterType: '', // '' = todos, 'income' = receitas, 'expense' = despesas

    render() {
        return `
        <div class="page-header">
            <h2>Contas a Pagar e Receber</h2>
            <div style="display:flex;gap:var(--space-sm);">
                <input type="month" id="finance-month" class="form-input" value="${this.currentMonth}">
                <button class="btn btn-secondary" id="btn-manage-categories">Categorias</button>
                <button class="btn btn-secondary" id="btn-manage-recurring">🔄 Fixas</button>
                <button class="btn btn-primary" id="btn-new-income">+ Receita</button>
                <button class="btn btn-danger" id="btn-new-expense" style="background:var(--danger);">- Despesa</button>
            </div>
        </div>

        <!-- Múltiplas Contas Bancárias / Caixas -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
            <h3 style="font-size: 16px;">Saldos das Contas</h3>
            <button class="btn btn-sm btn-ghost" id="btn-manage-accounts" title="Gerenciar Contas" style="font-size: 12px;">⚙️ Gerenciar Contas</button>
        </div>
        <div id="accounts-container" style="display:flex; gap: 15px; margin-bottom: var(--space-md); overflow-x: auto; padding-bottom: 5px;">
            <div style="font-size:14px; color:var(--text-muted);">Carregando contas...</div>
        </div>

        <div class="dashboard-grid" style="margin-bottom:var(--space-md);grid-template-columns:repeat(3,1fr);">
            <div class="kpi-card">
                <div class="kpi-title">A Receber</div>
                <div class="kpi-value" id="kpi-to-receive" style="color:var(--info);">R$ 0,00</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">A Pagar</div>
                <div class="kpi-value" id="kpi-to-pay" style="color:var(--warning);">R$ 0,00</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Saldo Mês (Recebido - Pago)</div>
                <div class="kpi-value" id="kpi-balance">R$ 0,00</div>
            </div>
        </div>

        <div class="card">
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md);flex-wrap:wrap;">
                <select id="finance-filter-type" class="form-input" style="flex: 1; min-width: 200px;">
                    <option value="">Todas as Movimentações</option>
                    <option value="income">Apenas Receitas (Entradas)</option>
                    <option value="expense">Apenas Despesas (Saídas)</option>
                </select>
                <select id="finance-filter-status" class="form-input" style="flex: 1; min-width: 200px;">
                    <option value="">Todos os Status</option>
                    <option value="pending">Apenas Pendentes</option>
                    <option value="completed">Apenas Concluídos</option>
                </select>
            </div>

            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Vencimento</th>
                            <th>Descrição / Categoria</th>
                            <th class="hide-mobile">Tipo</th>
                            <th>Valor</th>
                            <th>Status</th>
                            <th style="text-align:right">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="finance-table-body">
                        <tr><td colspan="6" style="text-align:center">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Modal: Nova Transação -->
        <div id="modal-transaction" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:500px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-transaction-title">Nova Transação</h3>
                    <button class="modal-close" id="btn-close-transaction">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-transaction">
                        <input type="hidden" id="tx-type">
                        <div class="form-group">
                            <label>Descrição</label>
                            <input type="text" id="tx-desc" class="form-input" required placeholder="Ex: Conta de Luz, Recebimento Cliente X">
                        </div>
                        <div class="form-group">
                            <label>Categoria</label>
                            <select id="tx-category" class="form-input">
                                <option value="">Sem Categoria</option>
                                <!-- Preenchido via JS -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Valor (R$)</label>
                            <input type="text" inputmode="decimal" id="tx-amount" class="form-input" required placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label>Data de Vencimento</label>
                            <input type="date" id="tx-date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label>Status Inicial</label>
                            <select id="tx-status" class="form-input">
                                <option value="pending">Pendente (A Pagar / A Receber)</option>
                                <option value="completed">Já Concluído (Pago / Recebido)</option>
                            </select>
                        </div>
                        <div class="form-group" id="tx-account-group" style="display:none;">
                            <label>Conta Destino/Origem</label>
                            <select id="tx-account" class="form-input">
                                <option value="">Selecione uma conta...</option>
                                <!-- Preenchido via JS -->
                            </select>
                        </div>
                        <div class="form-group" id="tx-barcode-group" style="display:none;">
                            <label>Código de Barras (Boleto)</label>
                            <input type="text" id="tx-barcode" class="form-input" placeholder="Opcional: Linha digitável do boleto">
                        </div>
                        <div class="form-group">
                            <label>Observações</label>
                            <textarea id="tx-notes" class="form-input" rows="2"></textarea>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:15px;">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-transaction">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal: Categorias -->
        <div id="modal-categories" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:600px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title">Plano de Contas (Categorias)</h3>
                    <button class="modal-close" id="btn-close-categories">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-category" style="display:flex;gap:10px;margin-bottom:20px;align-items:flex-end;flex-wrap:wrap;">
                        <input type="hidden" id="cat-id">
                        <div style="flex:1;min-width:150px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Nome</label>
                            <input type="text" id="cat-name" class="form-input" required placeholder="Ex: Internet">
                        </div>
                        <div style="width:120px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Tipo</label>
                            <select id="cat-type" class="form-input" required>
                                <option value="expense">Despesa</option>
                                <option value="income">Receita</option>
                            </select>
                        </div>
                        <div style="width:80px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Cor</label>
                            <input type="color" id="cat-color" class="form-input" value="#808080" style="padding:0;height:42px;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="height:42px;">Salvar</button>
                        <button type="button" id="btn-cancel-cat" class="btn btn-secondary" style="height:42px;display:none;">Cancelar</button>
                    </form>

                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Tipo</th>
                                    <th style="text-align:right">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="categories-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Contas Bancárias -->
        <div id="modal-accounts" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:600px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title">Contas Bancárias e Caixas</h3>
                    <button class="modal-close" id="btn-close-accounts">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-account" style="display:flex;gap:10px;margin-bottom:20px;align-items:flex-end;flex-wrap:wrap;">
                        <input type="hidden" id="acc-id">
                        <div style="flex:1;min-width:150px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Nome da Conta</label>
                            <input type="text" id="acc-name" class="form-input" required placeholder="Ex: Santander, Caixa">
                        </div>
                        <div style="width:120px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Tipo</label>
                            <select id="acc-type" class="form-input" required>
                                <option value="checking">Conta Corrente</option>
                                <option value="savings">Poupança</option>
                                <option value="cash">Dinheiro (Físico)</option>
                                <option value="credit_card">Cartão de Crédito</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>
                        <div style="width:120px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Saldo Inicial</label>
                            <input type="number" step="0.01" id="acc-initial-balance" class="form-input" value="0.00">
                        </div>
                        <div style="width:80px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Cor</label>
                            <input type="color" id="acc-color" class="form-input" value="#1E90FF" style="padding:0;height:42px;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="height:42px;">Salvar</button>
                        <button type="button" id="btn-cancel-acc" class="btn btn-secondary" style="height:42px;display:none;">Cancelar</button>
                    </form>

                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Conta</th>
                                    <th>Tipo</th>
                                    <th style="text-align:right">Saldo Atual</th>
                                    <th style="text-align:right">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="accounts-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Baixar Transação -->
        <div id="modal-pay" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:400px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-pay-title">Baixar Transação</h3>
                    <button class="modal-close" id="btn-close-pay">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="pay-history-container" style="display:none; margin-bottom: 15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Histórico de Pagamentos</label>
                        <table class="data-table" style="font-size: 11px;">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Método</th>
                                    <th style="text-align:right">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="inline-history-body"></tbody>
                        </table>
                    </div>
                    <form id="form-pay">
                        <input type="hidden" id="pay-tx-id">
                        <input type="hidden" id="pay-tx-type">
                        <div class="form-group">
                            <label>Data do Pagamento/Recebimento</label>
                            <input type="date" id="pay-date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label>Valor Pago (R$)</label>
                            <input type="number" step="0.01" min="0.01" id="pay-amount" class="form-input" required>
                            <small id="pay-amount-hint" style="color:#666;font-size:11px;"></small>
                        </div>
                        <div class="form-group">
                            <label>Forma de Pagamento</label>
                            <select id="pay-method" class="form-input">
                                <option value="cash">Dinheiro</option>
                                <option value="pix">PIX</option>
                                <option value="credit">Cartão de Crédito</option>
                                <option value="debit">Cartão de Débito</option>
                                <option value="transfer">Transferência Bancária</option>
                                <option value="boleto">Boleto Bancário</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Conta Destino/Origem</label>
                            <select id="pay-account" class="form-input" required>
                                <option value="">Selecione a Conta...</option>
                                <!-- Preenchido via JS -->
                            </select>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:15px;">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-pay">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="btn-save-pay">Confirmar Baixa</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <!-- Modal: Visualizar Transação -->
        <div id="modal-view-tx" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:400px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta</h3>
                    <button class="modal-close" id="btn-close-view">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="view-tx-details" style="font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
                    </div>

                    <div id="view-barcode-container" style="display:none; margin-bottom: 15px; padding: 10px; background: var(--bg-input); border-radius: 6px;">
                        <label style="font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 4px;">Código de Barras</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="view-barcode-input" class="form-input" readonly style="font-size: 12px; font-family: monospace;">
                            <button id="btn-copy-barcode" class="btn btn-secondary" style="padding: 0 10px;" title="Copiar">📋</button>
                        </div>
                    </div>

                    <div id="view-attachment-container" style="margin-bottom: 15px; border-top: 1px solid var(--border); padding-top: 15px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Comprovante / Anexo</label>
                        <div id="attachment-view-area" style="display:none; margin-bottom: 10px;">
                            <a id="attachment-link" target="_blank" class="btn btn-secondary" style="width: 100%; display: flex; justify-content: center; gap: 8px;">
                                📄 Visualizar Anexo Atual
                            </a>
                        </div>
                        <form id="form-upload-attachment" style="display: flex; gap: 10px; align-items: center;">
                            <input type="file" id="tx-attachment-file" accept="image/*,.pdf" style="flex: 1; font-size: 12px;" required>
                            <button type="submit" class="btn btn-primary btn-sm">Enviar</button>
                        </form>
                    </div>

                    <div id="view-history-container" style="display:none; border-top: 1px solid var(--border); padding-top: 15px;">
                        <label style="display:block; margin-bottom: 8px; font-weight: 600; font-size: 13px;">Histórico de Pagamentos</label>
                        <table class="data-table" style="font-size: 11px;">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Método</th>
                                    <th style="text-align:right">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="view-inline-history-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Transações Recorrentes -->
        <div id="modal-recurring" class="modal-overlay" style="display: none;">
            <div class="modal" style="max-width:700px; width:100%;">
                <div class="modal-header">
                    <h3 class="modal-title">Despesas e Receitas Fixas (Recorrentes)</h3>
                    <button class="modal-close" id="btn-close-recurring">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-recurring" style="display:flex;gap:10px;margin-bottom:20px;align-items:flex-end;flex-wrap:wrap;background:var(--bg-input);padding:10px;border-radius:8px;">
                        <input type="hidden" id="rec-id">
                        <div style="flex:1;min-width:150px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Descrição</label>
                            <input type="text" id="rec-desc" class="form-input" required placeholder="Ex: Aluguel, Internet">
                        </div>
                        <div style="width:120px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Tipo</label>
                            <select id="rec-type" class="form-input" required>
                                <option value="expense">Despesa</option>
                                <option value="income">Receita</option>
                            </select>
                        </div>
                        <div style="width:100px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Valor (R$)</label>
                            <input type="number" step="0.01" id="rec-amount" class="form-input" required>
                        </div>
                        <div style="width:80px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Dia (Mês)</label>
                            <input type="number" min="1" max="31" id="rec-day" class="form-input" required value="10">
                        </div>
                        <div style="width:150px;">
                            <label style="font-size:12px;display:block;margin-bottom:4px;">Categoria</label>
                            <select id="rec-category" class="form-input">
                                <option value="">Sem Categoria</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" style="height:42px;">Salvar</button>
                        <button type="button" id="btn-cancel-rec" class="btn btn-secondary" style="height:42px;display:none;">Cancelar</button>
                    </form>

                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Dia</th>
                                    <th>Descrição / Categoria</th>
                                    <th>Tipo</th>
                                    <th style="text-align:right">Valor</th>
                                    <th style="text-align:right">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="recurring-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    bind() {
        this.loadData();

        // Filters
        document.getElementById('finance-month').addEventListener('change', (e) => {
            this.currentMonth = e.target.value;
            this.loadData();
        });
        document.getElementById('finance-filter-type').addEventListener('change', (e) => {
            this.filterType = e.target.value;
            this.renderTable();
        });
        document.getElementById('finance-filter-status').addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.renderTable();
        });

        // Modals
        document.getElementById('btn-new-income').addEventListener('click', () => this.openModal('income'));
        document.getElementById('btn-new-expense').addEventListener('click', () => this.openModal('expense'));
        
        document.getElementById('btn-close-transaction').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-cancel-transaction').addEventListener('click', () => this.closeModal());

        document.getElementById('form-transaction').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveTransaction();
        });

        // Pay modal binds
        document.getElementById('btn-close-pay').addEventListener('click', () => this.closePayModal());
        document.getElementById('btn-cancel-pay').addEventListener('click', () => this.closePayModal());
        document.getElementById('form-pay').addEventListener('submit', (e) => {
            e.preventDefault();
            this.confirmPayment();
        });

        // View Modal Binds
        document.getElementById('btn-close-view').addEventListener('click', () => {
            document.getElementById('modal-view-tx').style.display = 'none';
        });

        document.getElementById('btn-copy-barcode').addEventListener('click', () => {
            const input = document.getElementById('view-barcode-input');
            input.select();
            document.execCommand('copy');
            Toast.success('Código copiado!');
        });

        document.getElementById('form-upload-attachment').addEventListener('submit', async (e) => {
            e.preventDefault();
            const txId = e.target.dataset.txId;
            const fileInput = document.getElementById('tx-attachment-file');
            if (!fileInput.files || fileInput.files.length === 0) return;

            const formData = new FormData();
            formData.append('attachment', fileInput.files[0]);

            try {
                const response = await fetch(`/api/finance/transactions/${txId}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    Toast.success(result.message);
                    fileInput.value = '';
                    this.loadData();
                    document.getElementById('modal-view-tx').style.display = 'none';
                } else {
                    Toast.error(result.message);
                }
            } catch (err) {
                Toast.error('Erro ao enviar arquivo.');
            }
        });

        // Accounts Modal binds
        document.getElementById('btn-manage-accounts').addEventListener('click', () => this.openAccountsModal());
        document.getElementById('btn-close-accounts').addEventListener('click', () => this.closeAccountsModal());
        document.getElementById('btn-cancel-acc').addEventListener('click', () => {
            document.getElementById('form-account').reset();
            document.getElementById('acc-id').value = '';
            document.getElementById('btn-cancel-acc').style.display = 'none';
        });
        document.getElementById('form-account').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveAccount();
        });

        // Select changes
        document.getElementById('tx-status').addEventListener('change', (e) => {
            const accGroup = document.getElementById('tx-account-group');
            const accSelect = document.getElementById('tx-account');
            if (e.target.value === 'completed') {
                accGroup.style.display = 'block';
                accSelect.required = true;
            } else {
                accGroup.style.display = 'none';
                accSelect.required = false;
                accSelect.value = '';
            }
        });

        // Recurring Modal binds
        document.getElementById('btn-manage-recurring').addEventListener('click', () => this.openRecurringModal());
        document.getElementById('btn-close-recurring').addEventListener('click', () => this.closeRecurringModal());
        document.getElementById('btn-cancel-rec').addEventListener('click', () => {
            document.getElementById('form-recurring').reset();
            document.getElementById('rec-id').value = '';
            document.getElementById('btn-cancel-rec').style.display = 'none';
        });
        document.getElementById('form-recurring').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveRecurring();
        });

        // Categories Modal binds
        document.getElementById('btn-manage-categories').addEventListener('click', () => this.openCategoriesModal());
        document.getElementById('btn-close-categories').addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('btn-cancel-cat').addEventListener('click', () => {
            document.getElementById('form-category').reset();
            document.getElementById('cat-id').value = '';
            document.getElementById('btn-cancel-cat').style.display = 'none';
        });
        document.getElementById('form-category').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveCategory();
        });
    },

    async loadData() {
        const [sumRes, txRes] = await Promise.all([
            API.get(`/finance/summary?month=${this.currentMonth}`),
            API.get(`/finance/transactions?month=${this.currentMonth}`),
            this.loadCategories(), // Load categories alongside
            this.loadAccounts() // Load accounts alongside
        ]);

        if (sumRes.success) {
            const data = sumRes.data;
            document.getElementById('kpi-to-receive').textContent = Utils.formatCurrency(data.total_to_receive);
            document.getElementById('kpi-to-pay').textContent = Utils.formatCurrency(data.total_to_pay);
            
            const balance = data.total_received - data.total_paid;
            const balEl = document.getElementById('kpi-balance');
            balEl.textContent = Utils.formatCurrency(balance);
            balEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
        }

        if (txRes.success) {
            this.transactions = txRes.data;
            this.renderTable();
        }
    },

    async loadCategories() {
        const res = await API.get('/finance/categories');
        if (res.success) {
            this.categories = res.data;
            this.populateRecCategories();
        }
    },

    populateRecCategories() {
        const select = document.getElementById('rec-category');
        if (!select) return;
        select.innerHTML = '<option value="">Sem Categoria</option>';
        this.categories.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`;
        });
    },

    async loadAccounts() {
        const res = await API.get('/accounts');
        if (res.success) {
            this.accounts = res.data;
            this.renderAccountsGrid();
            this.renderAccountsSelects();
        }
    },

    renderAccountsGrid() {
        const container = document.getElementById('accounts-container');
        if (!this.accounts || this.accounts.length === 0) {
            container.innerHTML = '<div style="font-size:14px; color:var(--text-muted);">Nenhuma conta configurada.</div>';
            return;
        }

        const typeNames = {
            'cash': 'Dinheiro', 'checking': 'Conta Corrente', 'savings': 'Poupança', 
            'credit_card': 'Cartão Crédito', 'other': 'Outro'
        };

        container.innerHTML = this.accounts.map(acc => `
            <div style="min-width: 180px; max-width: 250px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display:flex; flex-direction:column; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight: 600; font-size: 13px; color: ${acc.color}">${Utils.escapeHTML(acc.name)}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${typeNames[acc.type] || acc.type}</span>
                </div>
                <div style="font-size: 16px; font-weight: bold; color: ${acc.current_balance >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${Utils.formatCurrency(acc.current_balance)}
                </div>
            </div>
        `).join('');
    },

    renderAccountsSelects() {
        let options = '<option value="">Selecione uma conta...</option>';
        this.accounts.forEach(acc => {
            options += `<option value="${acc.id}">${Utils.escapeHTML(acc.name)} (Saldo: ${Utils.formatCurrency(acc.current_balance)})</option>`;
        });
        document.getElementById('tx-account').innerHTML = options;
        document.getElementById('pay-account').innerHTML = options;
    },

    renderTable() {
        const tbody = document.getElementById('finance-table-body');
        
        let filtered = this.transactions;
        if (this.filterType) filtered = filtered.filter(t => t.type === this.filterType);
        if (this.filterStatus) filtered = filtered.filter(t => t.status === this.filterStatus);

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma transação encontrada.</td></tr>';
            return;
        }

        const todayDateStr = new Date().toISOString().substring(0, 10);

        tbody.innerHTML = filtered.map(tx => {
            const isIncome = tx.type === 'income';
            const isPending = tx.status === 'pending';
            const isLate = isPending && tx.due_date < todayDateStr;
            
            const typeBadge = isIncome 
                ? '<span class="badge" style="background:var(--success);color:#fff;">Receita</span>'
                : '<span class="badge" style="background:var(--danger);color:#fff;">Despesa</span>';
                
            let statusBadge = '';
            if (tx.status === 'completed') statusBadge = '<span class="badge" style="background:var(--info);color:#fff;">Concluído</span>';
            else if (tx.status === 'partial') statusBadge = '<span class="badge" style="background:var(--primary);color:#fff;">Parcial</span>';
            else if (isLate) statusBadge = '<span class="badge" style="background:var(--warning);color:#fff;">Atrasado</span>';
            else statusBadge = '<span class="badge">Pendente</span>';

            const amountColor = isIncome ? 'var(--success)' : 'var(--danger)';
            const paid = tx.paid_amount || 0;
            const isCompleted = tx.status === 'completed';

            let actionBtn = '';
            if (!isCompleted) {
                actionBtn += `<button class="btn btn-sm btn-ghost" onclick="FinancePage.markAsPaid(${tx.id}, '${tx.type}', ${tx.amount}, ${paid})" title="${isIncome ? 'Receber' : 'Pagar'}">✅</button>`;
            } else {
                actionBtn += `<button class="btn btn-sm btn-ghost" onclick="FinancePage.openViewModal(${tx.id})" title="Ver Detalhes">👁️</button>`;
            }
            actionBtn += `<button class="btn btn-sm btn-ghost" onclick="FinancePage.deleteTransaction(${tx.id})" style="color:var(--danger);" title="Excluir">🗑️</button>`;

            const rowStyle = 'cursor:pointer; transition: background 0.2s;';
            const rowHover = 'onmouseover="this.style.background=\'var(--bg-input)\'" onmouseout="this.style.background=\'\'"';
            const rowClick = !isCompleted 
                ? `onclick="if(!event.target.closest('button')) FinancePage.openPayModal(${tx.id}, '${tx.type}', ${tx.amount}, ${paid})"`
                : `onclick="if(!event.target.closest('button')) FinancePage.openViewModal(${tx.id})"`;

            // Categoria visual
            const catBadge = tx.category_name 
                ? `<span class="badge" style="background:${tx.category_color}20; color:${tx.category_color}; border: 1px solid ${tx.category_color}40; margin-top:4px; font-size:10px;">${Utils.escapeHTML(tx.category_name)}</span>`
                : '';

            return `
                <tr style="${rowStyle}" ${rowHover} ${rowClick} title="${isPending ? 'Clique na linha para realizar a baixa' : ''}">
                    <td data-label="Vencimento" style="${isLate ? 'color:var(--warning);font-weight:bold;' : ''}">${Utils.formatDate(tx.due_date)}</td>
                    <td data-label="Descrição">
                        <strong>${Utils.escapeHTML(tx.description)}</strong>
                        ${tx.reference_type === 'sale' ? `<br><small style="color:var(--text-muted)">Venda #${String(tx.reference_id).padStart(4,'0')}</small>` : ''}
                        ${catBadge ? `<br>${catBadge}` : ''}
                    </td>
                    <td data-label="Tipo" class="hide-mobile">${typeBadge}</td>
                    <td data-label="Valor">
                        <span style="color:${amountColor}; font-weight:600;">${Utils.formatCurrency(tx.amount)}</span>
                        ${tx.status === 'partial' ? `<br><small style="color:var(--text-muted)">Restante: ${Utils.formatCurrency(tx.amount - paid)}</small>` : ''}
                    </td>
                    <td data-label="Status">${statusBadge}</td>
                    <td data-label="Ações" style="text-align:right">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    },

    openModal(type) {
        document.getElementById('tx-type').value = type;
        document.getElementById('modal-transaction-title').textContent = type === 'income' ? 'Nova Receita' : 'Nova Despesa';
        document.getElementById('tx-desc').value = '';
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-date').value = new Date().toISOString().substring(0, 10);
        document.getElementById('tx-status').value = 'pending';
        document.getElementById('tx-notes').value = '';
        
        document.getElementById('tx-account-group').style.display = 'none';
        document.getElementById('tx-account').required = false;
        document.getElementById('tx-account').value = '';
        
        // Exibir barcode apenas para despesas
        const barcodeGroup = document.getElementById('tx-barcode-group');
        const barcodeInput = document.getElementById('tx-barcode');
        if (barcodeGroup && barcodeInput) {
            barcodeGroup.style.display = type === 'expense' ? 'block' : 'none';
            barcodeInput.value = '';
        }

        // Populate Categories Select based on type
        const selectCat = document.getElementById('tx-category');
        selectCat.innerHTML = '<option value="">Sem Categoria</option>';
        if (this.categories) {
            this.categories.filter(c => c.type === type).forEach(c => {
                selectCat.innerHTML += `<option value="${c.id}">${Utils.escapeHTML(c.name)}</option>`;
            });
        }

        document.getElementById('modal-transaction').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('modal-transaction').style.display = 'none';
    },

    async saveTransaction() {
        const catId = document.getElementById('tx-category').value;
        const accId = document.getElementById('tx-account').value;
        const data = {
            type: document.getElementById('tx-type').value,
            category_id: catId ? parseInt(catId) : null,
            account_id: accId ? parseInt(accId) : null,
            description: document.getElementById('tx-desc').value.trim(),
            amount: parseFloat(document.getElementById('tx-amount').value.toString().replace(/\./g, '').replace(',', '.')),
            due_date: document.getElementById('tx-date').value,
            status: document.getElementById('tx-status').value,
            notes: document.getElementById('tx-notes').value.trim(),
            barcode: document.getElementById('tx-barcode') ? document.getElementById('tx-barcode').value.trim() : ''
        };

        const result = await API.post('/finance/transactions', data);
        if (result.success) {
            Toast.success(result.message);
            this.closeModal();
            this.loadData();
        } else {
            Toast.error(result.message);
        }
    },

    async markAsPaid(id, type, amount, paidAmount) {
        this.openPayModal(id, type, amount, paidAmount);
    },

    openPayModal(id, type, amount, paidAmount) {
        const remaining = amount - (paidAmount || 0);
        document.getElementById('pay-tx-id').value = id;
        document.getElementById('pay-tx-type').value = type;
        document.getElementById('pay-date').value = new Date().toISOString().substring(0, 10);
        
        const amountInput = document.getElementById('pay-amount');
        amountInput.value = remaining.toFixed(2);
        amountInput.max = remaining.toFixed(2);
        document.getElementById('pay-amount-hint').textContent = `Saldo Devedor Restante: ${Utils.formatCurrency(remaining)}`;

        // Populate Inline History
        const tx = this.transactions.find(t => t.id === id);
        const historyContainer = document.getElementById('pay-history-container');
        if (tx && tx.payments && tx.payments.length > 0) {
            const methodNames = {
                'cash': 'Dinheiro', 'pix': 'PIX', 'credit': 'Cartão de Crédito', 
                'debit': 'Cartão de Débito', 'transfer': 'Transferência', 'boleto': 'Boleto'
            };
            const tbody = document.getElementById('inline-history-body');
            tbody.innerHTML = tx.payments.map(p => `
                <tr>
                    <td>${Utils.formatDate(p.payment_date)}</td>
                    <td>${methodNames[p.payment_method] || p.payment_method}</td>
                    <td style="text-align:right; font-weight:bold; color:var(--success)">${Utils.formatCurrency(p.amount)}</td>
                </tr>
            `).join('');
            historyContainer.style.display = 'block';
        } else {
            historyContainer.style.display = 'none';
        }

        document.getElementById('pay-account').value = '';

        document.getElementById('modal-pay-title').textContent = type === 'income' ? 'Confirmar Recebimento' : 'Confirmar Pagamento';
        document.getElementById('modal-pay').style.display = 'flex';
    },

    closePayModal() {
        document.getElementById('modal-pay').style.display = 'none';
    },

    async confirmPayment() {
        const id = document.getElementById('pay-tx-id').value;
        const method = document.getElementById('pay-method').value;
        const date = document.getElementById('pay-date').value;
        const amount = document.getElementById('pay-amount').value;
        const accId = document.getElementById('pay-account').value;

        const result = await API.put(`/finance/transactions/${id}/pay`, { 
            payment_method: method, 
            payment_date: date, 
            amount: amount,
            account_id: accId ? parseInt(accId) : null
        });
        if (result.success) {
            Toast.success(result.message);
            this.closePayModal();
            this.loadData();
        } else {
            Toast.error(result.message);
        }
    },

    openViewModal(id) {
        const tx = this.transactions.find(t => t.id === id);
        if (!tx) return;

        const isIncome = tx.type === 'income';
        const typeStr = isIncome ? '<span style="color:var(--success);font-weight:bold;">Receita</span>' : '<span style="color:var(--danger);font-weight:bold;">Despesa</span>';
        const amountStr = `<span style="color:${isIncome ? 'var(--success)' : 'var(--danger)'};font-weight:bold;">${Utils.formatCurrency(tx.amount)}</span>`;

        let detailsHtml = `
            <div style="margin-bottom:8px;"><strong>Descrição:</strong> ${Utils.escapeHTML(tx.description)}</div>
            <div style="margin-bottom:8px;"><strong>Tipo:</strong> ${typeStr}</div>
            <div style="margin-bottom:8px;"><strong>Valor Total:</strong> ${amountStr}</div>
            <div style="margin-bottom:8px;"><strong>Valor Pago:</strong> ${Utils.formatCurrency(tx.paid_amount || 0)}</div>
            <div style="margin-bottom:8px;"><strong>Vencimento:</strong> ${Utils.formatDate(tx.due_date)}</div>
        `;
        if (tx.category_name) detailsHtml += `<div style="margin-bottom:8px;"><strong>Categoria:</strong> ${Utils.escapeHTML(tx.category_name)}</div>`;
        if (tx.notes) detailsHtml += `<div style="margin-bottom:8px;"><strong>Observação:</strong> ${Utils.escapeHTML(tx.notes)}</div>`;

        document.getElementById('view-tx-details').innerHTML = detailsHtml;

        const historyContainer = document.getElementById('view-history-container');
        if (tx.payments && tx.payments.length > 0) {
            const methodNames = {
                'cash': 'Dinheiro', 'pix': 'PIX', 'credit': 'Cartão', 
                'debit': 'Débito', 'transfer': 'Transferência', 'boleto': 'Boleto'
            };
            const tbody = document.getElementById('view-inline-history-body');
            tbody.innerHTML = tx.payments.map(p => `
                <tr>
                    <td>${Utils.formatDate(p.payment_date)}</td>
                    <td>${methodNames[p.payment_method] || p.payment_method}</td>
                    <td style="text-align:right; font-weight:bold; color:var(--success)">${Utils.formatCurrency(p.amount)}</td>
                </tr>
            `).join('');
            historyContainer.style.display = 'block';
        } else {
            historyContainer.style.display = 'none';
        }

        // Barcode
        const barcodeContainer = document.getElementById('view-barcode-container');
        const barcodeInput = document.getElementById('view-barcode-input');
        if (tx.barcode && tx.barcode.trim() !== '') {
            barcodeInput.value = tx.barcode;
            barcodeContainer.style.display = 'block';
        } else {
            barcodeContainer.style.display = 'none';
        }

        // Attachments
        const attachViewArea = document.getElementById('attachment-view-area');
        const attachLink = document.getElementById('attachment-link');
        if (tx.attachment_path) {
            attachLink.href = tx.attachment_path;
            attachViewArea.style.display = 'block';
        } else {
            attachViewArea.style.display = 'none';
        }

        // Set current view tx id to form
        document.getElementById('form-upload-attachment').dataset.txId = id;

        document.getElementById('modal-view-tx').style.display = 'flex';
    },

    async deleteTransaction(id) {
        Modal.confirm('Tem certeza que deseja excluir esta transação permanentemente?', async () => {
            const result = await API.delete(`/finance/transactions/${id}`);
            if (result.success) {
                Toast.success(result.message);
                this.loadData();
            } else {
                Toast.error(result.message);
            }
        });
    },

    // ==========================================
    // Categoria Management
    // ==========================================
    openCategoriesModal() {
        document.getElementById('modal-categories').style.display = 'flex';
        this.renderCategoriesTable();
    },

    closeCategoriesModal() {
        document.getElementById('modal-categories').style.display = 'none';
    },

    renderCategoriesTable() {
        const tbody = document.getElementById('categories-table-body');
        if (!this.categories || !this.categories.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhuma categoria cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = this.categories.map(c => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${c.color};"></span>
                        ${Utils.escapeHTML(c.name)}
                    </div>
                </td>
                <td>${c.type === 'income' ? '<span class="badge" style="background:var(--success);color:#fff;">Receita</span>' : '<span class="badge" style="background:var(--danger);color:#fff;">Despesa</span>'}</td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-ghost" onclick="FinancePage.editCategory(${c.id})" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="FinancePage.deleteCategory(${c.id})" style="color:var(--danger);" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    editCategory(id) {
        const c = this.categories.find(cat => cat.id === id);
        if (!c) return;
        document.getElementById('cat-id').value = c.id;
        document.getElementById('cat-name').value = c.name;
        document.getElementById('cat-type').value = c.type;
        document.getElementById('cat-color').value = c.color;
        document.getElementById('btn-cancel-cat').style.display = 'inline-block';
    },

    async saveCategory() {
        const id = document.getElementById('cat-id').value;
        const data = {
            name: document.getElementById('cat-name').value.trim(),
            type: document.getElementById('cat-type').value,
            color: document.getElementById('cat-color').value
        };

        let result;
        if (id) {
            result = await API.put(`/finance/categories/${id}`, data);
        } else {
            result = await API.post('/finance/categories', data);
        }

        if (result.success) {
            Toast.success(result.message);
            document.getElementById('btn-cancel-cat').click(); // reseta o form
            await this.loadCategories();
            this.renderCategoriesTable();
        } else {
            Toast.error(result.message);
        }
    },

    async deleteCategory(id) {
        Modal.confirm('Deseja realmente excluir esta categoria?', async () => {
            const result = await API.delete(`/finance/categories/${id}`);
            if (result.success) {
                Toast.success(result.message);
                await this.loadCategories();
                this.renderCategoriesTable();
            } else {
                Toast.error(result.message);
            }
        });
    },

    // ==========================================
    // Contas Bancárias Management
    // ==========================================
    openAccountsModal() {
        document.getElementById('modal-accounts').style.display = 'flex';
        this.renderAccountsTable();
    },

    closeAccountsModal() {
        document.getElementById('modal-accounts').style.display = 'none';
    },

    renderAccountsTable() {
        const tbody = document.getElementById('accounts-table-body');
        if (!this.accounts || !this.accounts.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhuma conta cadastrada.</td></tr>';
            return;
        }

        const typeNames = {
            'cash': 'Dinheiro', 'checking': 'Conta Corrente', 'savings': 'Poupança', 
            'credit_card': 'Cartão Crédito', 'other': 'Outro'
        };

        tbody.innerHTML = this.accounts.map(acc => `
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${acc.color};"></span>
                        ${Utils.escapeHTML(acc.name)}
                    </div>
                </td>
                <td><span class="badge" style="background:var(--bg-secondary);color:var(--text);">${typeNames[acc.type] || acc.type}</span></td>
                <td style="text-align:right; font-weight:bold; color:${acc.current_balance >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${Utils.formatCurrency(acc.current_balance)}
                </td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-ghost" onclick="FinancePage.editAccount(${acc.id})" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="FinancePage.deleteAccount(${acc.id})" style="color:var(--danger);" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    editAccount(id) {
        const acc = this.accounts.find(a => a.id === id);
        if (!acc) return;
        document.getElementById('acc-id').value = acc.id;
        document.getElementById('acc-name').value = acc.name;
        document.getElementById('acc-type').value = acc.type;
        document.getElementById('acc-color').value = acc.color;
        document.getElementById('acc-initial-balance').value = acc.initial_balance;
        document.getElementById('btn-cancel-acc').style.display = 'inline-block';
    },

    async saveAccount() {
        const id = document.getElementById('acc-id').value;
        const data = {
            name: document.getElementById('acc-name').value.trim(),
            type: document.getElementById('acc-type').value,
            color: document.getElementById('acc-color').value,
            initial_balance: parseFloat(document.getElementById('acc-initial-balance').value) || 0
        };

        let result;
        if (id) {
            result = await API.put(`/accounts/${id}`, data);
        } else {
            result = await API.post('/accounts', data);
        }

        if (result.success) {
            Toast.success(result.message);
            document.getElementById('btn-cancel-acc').click(); // reseta o form
            await this.loadAccounts();
            this.renderAccountsTable();
            this.loadData(); // atualiza a tela
        } else {
            Toast.error(result.message);
        }
    },

    async deleteAccount(id) {
        Modal.confirm('Deseja realmente excluir esta conta? Isso não apagará o histórico, mas removerá a conta da lista.', async () => {
            const result = await API.delete(`/accounts/${id}`);
            if (result.success) {
                Toast.success(result.message);
                await this.loadAccounts();
                this.renderAccountsTable();
                this.loadData(); // atualiza a tela
            } else {
                Toast.error(result.message);
            }
        });
    },

    // ==========================================
    // Recurring Transactions Management
    // ==========================================
    async openRecurringModal() {
        document.getElementById('modal-recurring').style.display = 'flex';
        await this.loadRecurring();
    },

    closeRecurringModal() {
        document.getElementById('modal-recurring').style.display = 'none';
    },

    async loadRecurring() {
        const res = await API.get('/finance/recurring');
        if (res.success) {
            this.renderRecurringTable(res.data);
        }
    },

    renderRecurringTable(recurringList) {
        const tbody = document.getElementById('recurring-table-body');
        if (!recurringList || !recurringList.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma transação fixa cadastrada.</td></tr>';
            return;
        }

        tbody.innerHTML = recurringList.map(r => `
            <tr>
                <td>Dia <strong>${r.day_of_month}</strong></td>
                <td>
                    <strong>${Utils.escapeHTML(r.description)}</strong>
                    ${r.category_name ? `<br><span class="badge" style="background:${r.category_color}20; color:${r.category_color}; border: 1px solid ${r.category_color}40; margin-top:4px; font-size:10px;">${Utils.escapeHTML(r.category_name)}</span>` : ''}
                </td>
                <td>${r.type === 'income' ? '<span class="badge" style="background:var(--success);color:#fff;">Receita</span>' : '<span class="badge" style="background:var(--danger);color:#fff;">Despesa</span>'}</td>
                <td style="text-align:right; font-weight:bold; color:${r.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
                    ${Utils.formatCurrency(r.amount)}
                </td>
                <td style="text-align:right">
                    <button class="btn btn-sm btn-ghost" onclick='FinancePage.editRecurring(${JSON.stringify(r).replace(/'/g, "&#39;")})' title="Editar">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="FinancePage.deleteRecurring(${r.id})" style="color:var(--danger);" title="Excluir">🗑️</button>
                </td>
            </tr>
        `).join('');
    },

    editRecurring(r) {
        document.getElementById('rec-id').value = r.id;
        document.getElementById('rec-desc').value = r.description;
        document.getElementById('rec-type').value = r.type;
        document.getElementById('rec-amount').value = r.amount;
        document.getElementById('rec-day').value = r.day_of_month;
        document.getElementById('rec-category').value = r.category_id || '';
        document.getElementById('btn-cancel-rec').style.display = 'inline-block';
    },

    async saveRecurring() {
        const id = document.getElementById('rec-id').value;
        const data = {
            description: document.getElementById('rec-desc').value.trim(),
            type: document.getElementById('rec-type').value,
            amount: parseFloat(document.getElementById('rec-amount').value),
            day_of_month: parseInt(document.getElementById('rec-day').value),
            category_id: document.getElementById('rec-category').value || null
        };

        let result;
        if (id) {
            result = await API.put(`/finance/recurring/${id}`, data);
        } else {
            result = await API.post('/finance/recurring', data);
        }

        if (result.success) {
            Toast.success(result.message);
            document.getElementById('btn-cancel-rec').click(); // reseta o form
            await this.loadRecurring();
            this.loadData(); // atualiza a dashboard caso algo tenha gerado
        } else {
            Toast.error(result.message);
        }
    },

    async deleteRecurring(id) {
        Modal.confirm('Tem certeza que deseja excluir esta transação recorrente? (As que já foram geradas não serão apagadas)', async () => {
            const result = await API.delete(`/finance/recurring/${id}`);
            if (result.success) {
                Toast.success(result.message);
                this.loadRecurring();
            } else {
                Toast.error(result.message);
            }
        });
    }
};

window.FinancePage = FinancePage;

/**
 * StockCell - PDV (Ponto de Venda)
 */
const PDVPage = {
    cart: [],
    selectedPayment: 'pix',
    splitMode: false,
    discount: 0,
    isCashRegisterClosed: false,

    render() {
        return `
        <div class="pdv-container">
            <div class="pdv-left">
                <div class="pdv-search-area">
                    <div style="position:relative;">
                        ${Icons.search}
                        <input type="text" class="pdv-barcode-input" id="pdv-barcode"
                            placeholder="Buscar por nome ou código de barras..."
                            autocomplete="off" autofocus>
                    </div>
                    <div id="pdv-search-results" style="margin-top:var(--space-sm);display:none;"></div>
                </div>
                <div class="pdv-cart">
                    <div class="pdv-cart-header">
                        <strong>🛒 Carrinho</strong>
                        <span class="pdv-cart-count" id="pdv-cart-count">0 itens</span>
                    </div>
                    <div class="pdv-cart-items" id="pdv-cart-items">
                        <div class="pdv-cart-empty">
                            <div class="pdv-cart-empty-icon">🛒</div>
                            <span>Carrinho vazio</span>
                            <span style="font-size:var(--font-size-xs)">Escaneie ou busque um produto</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="pdv-right">
                <div class="pdv-summary">
                    <h3 style="margin-bottom:var(--space-md);">Resumo</h3>
                    <div class="pdv-summary-row">
                        <span>Subtotal</span>
                        <span id="pdv-subtotal">R$ 0,00</span>
                    </div>
                    <div class="pdv-summary-row">
                        <span>Desconto</span>
                        <input type="number" class="pdv-discount-input" id="pdv-discount" value="0" min="0" step="0.01" placeholder="0,00">
                    </div>
                    <div class="pdv-summary-row total">
                        <span>TOTAL</span>
                        <span id="pdv-total">R$ 0,00</span>
                    </div>
                    <div class="pdv-payment-methods">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);">
                            <div class="pdv-payment-title" style="margin:0;">Forma de Pagamento</div>
                            <label style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-xs);color:var(--text-secondary);cursor:pointer;">
                                <input type="checkbox" id="pdv-split-toggle" style="accent-color:var(--accent-primary);">
                                Dividir
                            </label>
                        </div>
                        <!-- Modo simples (um método) -->
                        <div id="pdv-pay-single">
                            <div class="pdv-payment-buttons">
                                <button class="pdv-pay-btn" data-method="cash">
                                    <span class="pdv-pay-btn-icon">💵</span>Dinheiro
                                </button>
                                <button class="pdv-pay-btn selected" data-method="pix">
                                    <span class="pdv-pay-btn-icon">📱</span>PIX
                                </button>
                                <button class="pdv-pay-btn" data-method="debit">
                                    <span class="pdv-pay-btn-icon">💳</span>Débito
                                </button>
                                <button class="pdv-pay-btn" data-method="credit">
                                    <span class="pdv-pay-btn-icon">💳</span>Crédito
                                </button>
                                <button class="pdv-pay-btn" data-method="store_credit">
                                    <span class="pdv-pay-btn-icon">📝</span>A Prazo
                                </button>
                            </div>
                            <div id="pdv-cash-container" style="display:none;margin-top:var(--space-sm);">
                                <label style="display:block;font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:4px;">Valor Recebido:</label>
                                <input type="number" class="form-input" id="pdv-cash-received" min="0" step="0.01" placeholder="0,00" style="width:100%;font-size:var(--font-size-md);font-weight:700;">
                                <div id="pdv-cash-change" style="display:none;margin-top:6px;padding:8px 12px;border-radius:var(--radius-sm);background:rgba(16,185,129,0.1);border:1px solid var(--success);">
                                    <span style="font-size:var(--font-size-xs);color:var(--text-secondary);">Troco:</span>
                                    <span id="pdv-cash-change-value" style="font-size:var(--font-size-lg);font-weight:800;color:var(--success);margin-left:8px;">R$ 0,00</span>
                                </div>
                            </div>
                            <div id="pdv-due-date-container" style="display:none;margin-top:var(--space-sm);">
                                <div style="display:flex; gap:10px;">
                                    <div style="flex:1;">
                                        <label style="display:block;font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:4px;">1º Vencimento:</label>
                                        <input type="date" class="form-input" id="pdv-due-date" style="width:100%;">
                                    </div>
                                    <div style="width:70px;">
                                        <label style="display:block;font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:4px;">Parcelas:</label>
                                        <input type="number" min="1" max="24" value="1" class="form-input" id="pdv-installments" style="width:100%;">
                                    </div>
                                    <div style="width:80px; display:none;" id="pdv-interval-container">
                                        <label style="display:block;font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:4px;">Intervalo:</label>
                                        <input type="number" min="1" value="30" class="form-input" id="pdv-interval" title="Dias entre parcelas" style="width:100%;">
                                    </div>
                                </div>
                                <div id="pdv-installments-preview" style="font-size:var(--font-size-xs); color:var(--text-muted); margin-top:8px;"></div>
                            </div>
                        </div>
                        <!-- Modo split (múltiplos métodos) -->
                        <div id="pdv-pay-split" style="display:none;">
                            <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
                                <div style="display:flex;align-items:center;gap:var(--space-sm);">
                                    <span style="width:70px;font-size:var(--font-size-sm);">💵 Dinheiro</span>
                                    <input type="number" class="form-input pdv-split-input" id="pdv-split-cash" min="0" step="0.01" value="0" placeholder="0,00" style="flex:1;padding:8px;font-size:var(--font-size-sm);">
                                </div>
                                <div style="display:flex;align-items:center;gap:var(--space-sm);">
                                    <span style="width:70px;font-size:var(--font-size-sm);">📱 PIX</span>
                                    <input type="number" class="form-input pdv-split-input" id="pdv-split-pix" min="0" step="0.01" value="0" placeholder="0,00" style="flex:1;padding:8px;font-size:var(--font-size-sm);">
                                </div>
                                <div style="display:flex;align-items:center;gap:var(--space-sm);">
                                    <span style="width:70px;font-size:var(--font-size-sm);">💳 Débito</span>
                                    <input type="number" class="form-input pdv-split-input" id="pdv-split-debit" min="0" step="0.01" value="0" placeholder="0,00" style="flex:1;padding:8px;font-size:var(--font-size-sm);">
                                </div>
                                <div style="display:flex;align-items:center;gap:var(--space-sm);">
                                    <span style="width:70px;font-size:var(--font-size-sm);">💳 Crédito</span>
                                    <input type="number" class="form-input pdv-split-input" id="pdv-split-credit" min="0" step="0.01" value="0" placeholder="0,00" style="flex:1;padding:8px;font-size:var(--font-size-sm);">
                                </div>
                                <div style="display:flex;align-items:center;gap:var(--space-sm);">
                                    <span style="width:70px;font-size:var(--font-size-sm);">📝 A Prazo</span>
                                    <div style="flex:1;display:flex;gap:4px;">
                                        <input type="number" class="form-input pdv-split-input" id="pdv-split-store_credit" min="0" step="0.01" value="0" placeholder="0,00" style="width:50%;padding:8px;font-size:var(--font-size-sm);">
                                        <input type="date" class="form-input" id="pdv-split-due-date" title="1º Vencimento" style="width:50%;padding:8px;font-size:var(--font-size-sm);">
                                    </div>
                                </div>
                                <div id="pdv-split-installments-area" style="display:flex;align-items:center;gap:var(--space-sm);margin-top:-5px;margin-bottom:10px;padding-left:70px;">
                                    <span style="font-size:var(--font-size-xs);color:var(--text-muted);">Parcelas:</span>
                                    <input type="number" class="form-input" id="pdv-split-installments" min="1" max="24" value="1" style="width:60px;padding:4px;font-size:var(--font-size-xs);">
                                    <span style="font-size:var(--font-size-xs);color:var(--text-muted);display:none;" id="pdv-split-interval-label">Intervalo (dias):</span>
                                    <input type="number" class="form-input" id="pdv-split-interval" min="1" value="30" style="width:60px;padding:4px;font-size:var(--font-size-xs);display:none;">
                                </div>
                                <div id="pdv-split-preview" style="font-size:var(--font-size-xs);color:var(--text-muted);padding-left:70px;margin-top:-5px;margin-bottom:5px;"></div>
                                <div style="display:flex;justify-content:space-between;font-size:var(--font-size-xs);padding-top:4px;border-top:1px solid var(--border-light);">
                                    <span style="color:var(--text-muted);">Soma dos pagamentos:</span>
                                    <span id="pdv-split-sum" style="font-weight:700;">R$ 0,00</span>
                                </div>
                                <div id="pdv-split-warning" style="display:none;font-size:var(--font-size-xs);color:var(--warning);font-weight:600;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pdv-finalize-bottom">
                    <button class="pdv-finalize" id="pdv-finalize" disabled>
                        💰 Finalizar Venda
                    </button>
                </div>
            </div>
        </div>`;
    },

    bind() {
        this._initChecks();
        const barcodeInput = document.getElementById('pdv-barcode');
        const discountInput = document.getElementById('pdv-discount');

        // Barcode/search input - scanner USB envia ENTER no final
        barcodeInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = barcodeInput.value.trim();
                if (!value) return;
                await this.searchAndAdd(value);
                barcodeInput.value = '';
                barcodeInput.focus();
            }
        });

        // Busca com debounce para digitação manual
        barcodeInput.addEventListener('input', Utils.debounce(async (e) => {
            const value = e.target.value.trim();
            if (value.length >= 2) { await this.showSearchResults(value); }
            else { this.hideSearchResults(); }
        }, 400));

        // Discount
        discountInput.addEventListener('input', () => {
            this.discount = parseFloat(discountInput.value) || 0;
            this.updateTotals();
        });

        // Payment method buttons (single mode)
        document.querySelectorAll('.pdv-pay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.method === 'cash' && this.isCashRegisterClosed) {
                    Toast.warning('Caixa está fechado. Abra o caixa primeiro.');
                    return;
                }
                document.querySelectorAll('.pdv-pay-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedPayment = btn.dataset.method;
                // Toggle cash received field
                const cashContainer = document.getElementById('pdv-cash-container');
                if (cashContainer) {
                    cashContainer.style.display = this.selectedPayment === 'cash' ? 'block' : 'none';
                    if (this.selectedPayment === 'cash') {
                        document.getElementById('pdv-cash-received')?.focus();
                    }
                }
                // Toggle due date field
                const dateContainer = document.getElementById('pdv-due-date-container');
                if (dateContainer) {
                    dateContainer.style.display = this.selectedPayment === 'store_credit' ? 'block' : 'none';
                    if (this.selectedPayment === 'store_credit' && !document.getElementById('pdv-due-date').value) {
                        const nextMonth = new Date();
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        document.getElementById('pdv-due-date').value = nextMonth.toISOString().substring(0, 10);
                    }
                }
            });
        });

        // Cash received → calculate change in real time
        const cashInput = document.getElementById('pdv-cash-received');
        if (cashInput) {
            cashInput.addEventListener('input', () => this._updateCashChange());
        }

        // Split toggle
        document.getElementById('pdv-split-toggle').addEventListener('change', (e) => {
            this.splitMode = e.target.checked;
            document.getElementById('pdv-pay-single').style.display = this.splitMode ? 'none' : '';
            document.getElementById('pdv-pay-split').style.display = this.splitMode ? '' : 'none';
            if (this.splitMode) this.updateSplitSum();
        });

        // Installment changes (single mode)
        const updatePreviewSingle = () => {
            const inst = parseInt(document.getElementById('pdv-installments')?.value) || 1;
            const container = document.getElementById('pdv-interval-container');
            if (container) container.style.display = inst > 1 ? 'block' : 'none';
            this.updateInstallmentsPreview();
        };
        document.getElementById('pdv-installments')?.addEventListener('input', updatePreviewSingle);
        document.getElementById('pdv-interval')?.addEventListener('input', updatePreviewSingle);
        document.getElementById('pdv-due-date')?.addEventListener('change', updatePreviewSingle);

        // Split inputs
        document.querySelectorAll('.pdv-split-input').forEach(input => {
            input.addEventListener('input', () => {
                this.updateSplitSum();
                this.updateInstallmentsPreviewSplit();
            });
        });
        
        // Installment changes (split mode)
        const updatePreviewSplit = () => {
            const inst = parseInt(document.getElementById('pdv-split-installments')?.value) || 1;
            const lbl = document.getElementById('pdv-split-interval-label');
            const inp = document.getElementById('pdv-split-interval');
            if (lbl && inp) {
                lbl.style.display = inst > 1 ? 'inline-block' : 'none';
                inp.style.display = inst > 1 ? 'inline-block' : 'none';
            }
            this.updateInstallmentsPreviewSplit();
        };
        document.getElementById('pdv-split-installments')?.addEventListener('input', updatePreviewSplit);
        document.getElementById('pdv-split-interval')?.addEventListener('input', updatePreviewSplit);
        document.getElementById('pdv-split-due-date')?.addEventListener('change', updatePreviewSplit);

        // Finalize button
        document.getElementById('pdv-finalize').addEventListener('click', () => this.finalizeSale());

        // Focus on barcode input
        barcodeInput.focus();
    },

    async _initChecks() {
        this.isCashRegisterClosed = false;
        try {
            const [setRes, statRes] = await Promise.all([
                API.get('/settings/store'),
                API.get('/cashregister/status')
            ]);
            if (statRes.success && statRes.data.status === 'closed') {
                const isStrict = setRes.success && setRes.data.pdv_strict_lock === 'true';
                if (isStrict) {
                    document.querySelector('.pdv-container').innerHTML = `
                        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-card);border-radius:var(--radius-lg);padding:var(--space-2xl);text-align:center;min-height:500px;">
                            <div style="font-size:48px;margin-bottom:var(--space-md);">🔒</div>
                            <h2 style="margin-bottom:var(--space-sm);">Caixa Fechado</h2>
                            <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);max-width:400px;">
                                O bloqueio rigoroso do PDV está ativado. Para realizar qualquer venda, é necessário abrir o caixa primeiro.
                            </p>
                            <button class="btn btn-primary" onclick="App.navigate('cashregister')">Ir para Controle de Caixa</button>
                        </div>
                    `;
                } else {
                    this.isCashRegisterClosed = true;
                    const banner = document.createElement('div');
                    banner.style.cssText = 'background:var(--warning-bg);color:var(--warning);padding:var(--space-sm) var(--space-md);text-align:center;font-weight:600;font-size:var(--font-size-sm);border-bottom:1px solid rgba(255,186,8,0.2);';
                    banner.innerHTML = '⚠️ Caixa Fechado. Pagamento em dinheiro bloqueado.';
                    document.querySelector('.pdv-container').prepend(banner);

                    const cashBtn = document.querySelector('.pdv-pay-btn[data-method="cash"]');
                    if (cashBtn) {
                        cashBtn.style.opacity = '0.5';
                        cashBtn.style.cursor = 'not-allowed';
                    }
                    const splitCash = document.getElementById('pdv-split-cash');
                    if (splitCash) {
                        splitCash.disabled = true;
                        splitCash.title = "Caixa Fechado";
                    }
                }
            }
        } catch (e) {}
    },

    async searchAndAdd(query) {
        // Tenta buscar por código de barras primeiro
        let result = await API.get(`/products/barcode/${encodeURIComponent(query)}`);
        if (result.success) {
            this.addToCart(result.data);
            this.hideSearchResults();
            return;
        }
        // Busca por nome
        result = await API.get(`/products?search=${encodeURIComponent(query)}&limit=1`);
        if (result.success && result.data.length === 1) {
            this.addToCart(result.data[0]);
            this.hideSearchResults();
        } else if (result.success && result.data.length > 1) {
            this.showSearchResultsList(result.data);
        } else {
            Toast.warning('Produto não encontrado.');
        }
    },

    async showSearchResults(query) {
        const result = await API.get(`/products?search=${encodeURIComponent(query)}&limit=8`);
        if (result.success && result.data.length) {
            this.showSearchResultsList(result.data);
        } else {
            this.hideSearchResults();
        }
    },

    showSearchResultsList(products) {
        const container = document.getElementById('pdv-search-results');
        container.style.display = 'block';
        container.innerHTML = products.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer;border-radius:var(--radius-sm);transition:background 0.15s;"
                 onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''"
                 onclick="PDVPage.addToCart(${JSON.stringify(p).replace(/"/g,'&quot;')});PDVPage.hideSearchResults();document.getElementById('pdv-barcode').value='';document.getElementById('pdv-barcode').focus();">
                <div>
                    <strong style="font-size:var(--font-size-sm)">${Utils.escapeHTML(p.name)}</strong>
                    <div style="font-size:var(--font-size-xs);color:var(--text-muted)">${Utils.escapeHTML(p.barcode || p.internal_code || '')} ${p.brand ? '• ' + Utils.escapeHTML(p.brand) : ''}</div>
                </div>
                <div style="text-align:right">
                    <strong style="color:var(--success)">${Utils.formatCurrency(p.sale_price)}</strong>
                    <div style="font-size:var(--font-size-xs);color:${p.current_stock <= (p.min_stock||5) ? 'var(--warning)' : 'var(--text-muted)'}">Estoque: ${p.current_stock}</div>
                </div>
            </div>
        `).join('');
    },

    hideSearchResults() {
        const container = document.getElementById('pdv-search-results');
        if (container) { container.style.display = 'none'; container.innerHTML = ''; }
    },

    async addToCart(product) {
        if (product.track_serial) {
            // Exige bipar IMEI(s)
            const imeis = await this.promptForIMEI(product);
            if (!imeis || imeis.length === 0) return;
            
            let addedCount = 0;
            for (const imei of imeis) {
                // Verifica se o IMEI já está no carrinho
                const inCart = this.cart.find(i => i.serial_number === imei);
                if (inCart) {
                    Toast.warning(`O IMEI ${imei} já está no carrinho.`);
                    continue;
                }

                this.cart.push({
                    product_id: product.id,
                    name: product.name,
                    barcode: product.barcode || product.internal_code || '',
                    unit_price: product.sale_price,
                    quantity: 1,
                    max_stock: product.current_stock,
                    serial_number: imei
                });
                addedCount++;
            }
            
            if (addedCount > 0) {
                this.renderCart();
                Toast.success(`${addedCount} unidade(s) adicionada(s)!`);
            }
            return;
        }

        const existing = this.cart.find(item => item.product_id === product.id && !item.serial_number);
        if (existing) {
            if (existing.quantity >= product.current_stock) {
                Toast.warning(`Estoque máximo atingido (${product.current_stock}).`);
                return;
            }
            existing.quantity++;
        } else {
            this.cart.push({
                product_id: product.id,
                name: product.name,
                barcode: product.barcode || product.internal_code || '',
                unit_price: product.sale_price,
                quantity: 1,
                max_stock: product.current_stock,
            });
        }
        this.renderCart();
        Toast.success(`${product.name} adicionado!`);
    },

    promptForIMEI(product) {
        return new Promise((resolve) => {
            let quantity = 1;
            let validatedImeis = new Array(product.current_stock).fill(null); // guarda os IMEIs já validados e verdes
            
            const renderInputs = () => {
                let html = '';
                for(let i=0; i<quantity; i++) {
                    const val = validatedImeis[i] || '';
                    const isGreen = val !== '';
                    html += `
                        <div style="margin-bottom:8px; position:relative;">
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:2px;">Aparelho ${i+1}</label>
                            <input type="text" class="form-input pdv-imei-scan-input" data-index="${i}" value="${val}"
                                placeholder="Bipar IMEI ${i+1}..." 
                                style="font-size:16px; font-weight:bold; width:100%; border-color:${isGreen ? 'var(--success)' : 'var(--border)'}; background-color:${isGreen ? 'rgba(16,185,129,0.05)' : ''};" 
                                ${isGreen ? 'readonly tabindex="-1"' : ''}>
                        </div>
                    `;
                }
                document.getElementById('pdv-imei-inputs-container').innerHTML = html;
                
                // Bind events to new inputs
                document.querySelectorAll('.pdv-imei-scan-input').forEach(input => {
                    input.addEventListener('keydown', async (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if(input.readOnly) return;
                            
                            const idx = parseInt(input.dataset.index);
                            const imei = input.value.trim();
                            const err = document.getElementById('pdv-imei-error');
                            err.style.display = 'none';

                            if (!imei) return;

                            // Check duplicate in current modal
                            for (let j=0; j<quantity; j++) {
                                if (j !== idx && validatedImeis[j] === imei) {
                                    input.style.borderColor = 'var(--danger)';
                                    err.textContent = `O IMEI ${imei} já foi bipado nesta lista.`;
                                    err.style.display = 'block';
                                    input.select();
                                    return;
                                }
                            }
                            
                            // Check in cart
                            const inCart = PDVPage.cart.find(i => i.serial_number === imei);
                            if (inCart) {
                                input.style.borderColor = 'var(--danger)';
                                err.textContent = `O IMEI ${imei} já está no carrinho.`;
                                err.style.display = 'block';
                                input.select();
                                return;
                            }

                            input.disabled = true; // prevent double scan
                            try {
                                const r = await API.get(`/products/${product.id}/serials/validate/${imei}`);
                                if (r.success) {
                                    validatedImeis[idx] = imei;
                                    input.style.borderColor = 'var(--success)';
                                    input.style.backgroundColor = 'rgba(16,185,129,0.05)';
                                    input.readOnly = true;
                                    input.disabled = false;
                                    
                                    // Move to next or finish
                                    if (idx + 1 < quantity) {
                                        document.querySelector(`.pdv-imei-scan-input[data-index="${idx+1}"]`)?.focus();
                                    } else {
                                        // All green?
                                        const allValid = Array.from({length: quantity}).every((_, i) => validatedImeis[i]);
                                        if (allValid) {
                                            closeAndResolve(validatedImeis.slice(0, quantity));
                                        }
                                    }
                                } else {
                                    input.style.borderColor = 'var(--danger)';
                                    err.textContent = r.message || 'IMEI indisponível.';
                                    err.style.display = 'block';
                                    input.disabled = false;
                                    input.focus();
                                    input.select();
                                }
                            } catch(ex) {
                                input.style.borderColor = 'var(--danger)';
                                err.textContent = 'Erro de comunicação ao validar IMEI.';
                                err.style.display = 'block';
                                input.disabled = false;
                                input.focus();
                                input.select();
                            }
                        }
                    });
                });
                
                // Focus first empty input
                for(let i=0; i<quantity; i++) {
                    if (!validatedImeis[i]) {
                        document.querySelector(`.pdv-imei-scan-input[data-index="${i}"]`)?.focus();
                        break;
                    }
                }
            };

            Modal.open({
                title: `Venda de Itens Rastreados`,
                content: `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--border-light);">
                        <div>
                            <strong style="font-size:16px;">${Utils.escapeHTML(product.name)}</strong>
                            <div style="font-size:12px; color:var(--text-muted)">Estoque disponível: ${product.current_stock}</div>
                        </div>
                        <div style="text-align:right;">
                            <label style="font-size:11px; color:var(--text-muted); display:block;">Quantidade</label>
                            <input type="number" id="pdv-imei-qty" class="form-input" value="1" min="1" max="${product.current_stock}" style="width:70px; text-align:center; font-weight:bold; font-size:16px;">
                        </div>
                    </div>
                    <div id="pdv-imei-inputs-container" style="max-height: 250px; overflow-y: auto; padding-right:5px; margin-bottom:10px;"></div>
                    <div id="pdv-imei-error" style="color:var(--danger); font-size:var(--font-size-xs); font-weight:600; text-align:center; display:none;"></div>
                `,
                footer: `
                    <button class="btn btn-secondary" id="btn-imei-cancel">Cancelar</button>
                    <!-- O botão de confirmar é invisível pois o fluxo fecha sozinho ao bipar todos -->
                    <button class="btn btn-primary" id="btn-imei-confirm" style="display:none;">Confirmar</button>
                `
            });

            setTimeout(() => {
                const qtyInput = document.getElementById('pdv-imei-qty');
                qtyInput.addEventListener('change', (e) => {
                    let q = parseInt(e.target.value);
                    if (isNaN(q) || q < 1) q = 1;
                    if (q > product.current_stock) {
                        q = product.current_stock;
                        Toast.warning('Estoque insuficiente para maior quantidade.');
                    }
                    e.target.value = q;
                    quantity = q;
                    renderInputs();
                });
                renderInputs();
            }, 100);

            const closeAndResolve = (val) => {
                document.querySelector('.modal-overlay')?.remove();
                resolve(val);
                setTimeout(() => document.getElementById('pdv-barcode')?.focus(), 100);
            };

            document.getElementById('btn-imei-cancel').addEventListener('click', () => closeAndResolve(null));
        });
    },

    renderCart() {
        const container = document.getElementById('pdv-cart-items');
        const countEl = document.getElementById('pdv-cart-count');

        if (!this.cart.length) {
            container.innerHTML = `<div class="pdv-cart-empty"><div class="pdv-cart-empty-icon">🛒</div><span>Carrinho vazio</span></div>`;
            countEl.textContent = '0 itens';
            this.updateTotals();
            return;
        }

        const totalItems = this.cart.reduce((s, i) => s + i.quantity, 0);
        countEl.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'itens'}`;

        container.innerHTML = this.cart.map((item, idx) => `
            <div class="pdv-cart-item">
                <div class="pdv-cart-item-info">
                    <div class="pdv-cart-item-name">${Utils.escapeHTML(item.name)}</div>
                    <div class="pdv-cart-item-code">
                        ${Utils.escapeHTML(item.barcode)}
                        ${item.serial_number ? `<br><span style="color:var(--accent-primary); font-weight:bold; font-size:11px;">IMEI: ${Utils.escapeHTML(item.serial_number)}</span>` : ''}
                    </div>
                    <div class="pdv-cart-item-price">${Utils.formatCurrency(item.unit_price)} cada</div>
                </div>
                <div class="pdv-cart-item-qty">
                    ${item.serial_number ? `
                    <span class="pdv-qty-value" style="margin:0 10px;">${item.quantity}</span>
                    ` : `
                    <button class="pdv-qty-btn" onclick="PDVPage.changeQty(${idx},-1)">−</button>
                    <span class="pdv-qty-value">${item.quantity}</span>
                    <button class="pdv-qty-btn" onclick="PDVPage.changeQty(${idx},1)">+</button>
                    `}
                </div>
                <div class="pdv-cart-item-total">${Utils.formatCurrency(item.unit_price * item.quantity)}</div>
                <button class="pdv-cart-item-remove" onclick="PDVPage.removeItem(${idx})">✕</button>
            </div>
        `).join('');

        this.updateTotals();
    },

    changeQty(index, delta) {
        const item = this.cart[index];
        if (!item) return;
        const newQty = item.quantity + delta;
        if (newQty < 1) { this.removeItem(index); return; }
        if (newQty > item.max_stock) { Toast.warning('Estoque insuficiente.'); return; }
        item.quantity = newQty;
        this.renderCart();
    },

    removeItem(index) {
        this.cart.splice(index, 1);
        this.renderCart();
    },
    updateTotals() {
        const subtotal = this.cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - this.discount);

        const subtotalEl = document.getElementById('pdv-subtotal');
        const totalEl = document.getElementById('pdv-total');
        const finalizeBtn = document.getElementById('pdv-finalize');

        if (subtotalEl) subtotalEl.textContent = Utils.formatCurrency(subtotal);
        if (totalEl) totalEl.textContent = Utils.formatCurrency(total);
        if (finalizeBtn) finalizeBtn.disabled = this.cart.length === 0;
        if (this.splitMode) this.updateSplitSum();
    },

    _updateCashChange() {
        const subtotal = this.cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - this.discount);
        const received = parseFloat(document.getElementById('pdv-cash-received')?.value) || 0;
        const changeEl = document.getElementById('pdv-cash-change');
        const changeValEl = document.getElementById('pdv-cash-change-value');
        if (changeEl && changeValEl) {
            if (received > 0) {
                const change = received - total;
                changeEl.style.display = '';
                changeValEl.textContent = Utils.formatCurrency(Math.max(0, change));
                changeValEl.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
            } else {
                changeEl.style.display = 'none';
            }
        }
    },

    updateSplitSum() {
        const cash = parseFloat(document.getElementById('pdv-split-cash')?.value) || 0;
        const pix = parseFloat(document.getElementById('pdv-split-pix')?.value) || 0;
        const debit = parseFloat(document.getElementById('pdv-split-debit')?.value) || 0;
        const credit = parseFloat(document.getElementById('pdv-split-credit')?.value) || 0;
        const store_credit = parseFloat(document.getElementById('pdv-split-store_credit')?.value) || 0;
        const sum = cash + pix + debit + credit + store_credit;
        const total = this.cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0) - this.discount;
        const sumEl = document.getElementById('pdv-split-sum');
        const warnEl = document.getElementById('pdv-split-warning');
        if (sumEl) {
            sumEl.textContent = Utils.formatCurrency(sum);
            sumEl.style.color = Math.abs(sum - total) < 0.01 ? 'var(--success)' : 'var(--danger)';
        }
        if (warnEl) {
            if (Math.abs(sum - total) >= 0.01 && sum > 0) {
                const diff = total - sum;
                warnEl.style.display = '';
                warnEl.textContent = diff > 0 ? `Faltam ${Utils.formatCurrency(diff)}` : `Excede ${Utils.formatCurrency(Math.abs(diff))}`;
            } else { warnEl.style.display = 'none'; }
        }
    },

    updateInstallmentsPreview() {
        const previewEl = document.getElementById('pdv-installments-preview');
        if (!previewEl) return;
        const subtotal = this.cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - this.discount);
        if (total <= 0 || this.selectedPayment !== 'store_credit') {
            previewEl.innerHTML = '';
            return;
        }

        const inst = parseInt(document.getElementById('pdv-installments').value) || 1;
        if (inst <= 1) { previewEl.innerHTML = ''; return; }

        const interval = parseInt(document.getElementById('pdv-interval').value) || 30;
        const firstDate = document.getElementById('pdv-due-date').value;
        if (!firstDate) { previewEl.innerHTML = 'Informe o 1º vencimento.'; return; }

        const instAmount = total / inst;
        previewEl.innerHTML = `Serão ${inst} parcelas de <strong>${Utils.formatCurrency(instAmount)}</strong><br>a cada ${interval} dias.`;
    },

    updateInstallmentsPreviewSplit() {
        const previewEl = document.getElementById('pdv-split-preview');
        if (!previewEl) return;
        
        const store_credit = parseFloat(document.getElementById('pdv-split-store_credit')?.value) || 0;
        if (store_credit <= 0) { previewEl.innerHTML = ''; return; }

        const inst = parseInt(document.getElementById('pdv-split-installments').value) || 1;
        if (inst <= 1) { previewEl.innerHTML = ''; return; }

        const interval = parseInt(document.getElementById('pdv-split-interval').value) || 30;
        const firstDate = document.getElementById('pdv-split-due-date').value;
        if (!firstDate) { previewEl.innerHTML = 'Informe o 1º vencimento.'; return; }

        const instAmount = store_credit / inst;
        previewEl.innerHTML = `${inst}x de <strong>${Utils.formatCurrency(instAmount)}</strong> (A cada ${interval} dias).`;
    },

    async finalizeSale() {
        if (!this.cart.length) return;
        
        if (this.isCashRegisterClosed) {
            if (!this.splitMode && this.selectedPayment === 'cash') {
                Toast.warning('Caixa está fechado. Pagamento em dinheiro bloqueado.');
                return;
            }
            if (this.splitMode && (parseFloat(document.getElementById('pdv-split-cash')?.value) || 0) > 0) {
                Toast.warning('Caixa está fechado. Pagamento em dinheiro bloqueado.');
                return;
            }
        }

        const subtotal = this.cart.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
        const total = Math.max(0, subtotal - this.discount);

        const paymentLabels = { cash: 'Dinheiro', pix: 'PIX', debit: 'Débito', credit: 'Crédito', store_credit: 'A Prazo' };
        let payments = [];
        let confirmMsg = '';

        if (this.splitMode) {
            const cash = parseFloat(document.getElementById('pdv-split-cash')?.value) || 0;
            const pix = parseFloat(document.getElementById('pdv-split-pix')?.value) || 0;
            const debit = parseFloat(document.getElementById('pdv-split-debit')?.value) || 0;
            const credit = parseFloat(document.getElementById('pdv-split-credit')?.value) || 0;
            const store_credit = parseFloat(document.getElementById('pdv-split-store_credit')?.value) || 0;
            const store_credit_date = document.getElementById('pdv-split-due-date')?.value;
            const sum = cash + pix + debit + credit + store_credit;
            
            if (Math.abs(sum - total) >= 0.01) {
                Toast.warning(`A soma dos pagamentos (${Utils.formatCurrency(sum)}) deve ser igual ao total (${Utils.formatCurrency(total)}).`);
                return;
            }
            if (store_credit > 0 && !store_credit_date) {
                Toast.warning('Informe a data de vencimento para o valor A Prazo.');
                return;
            }

            if (cash > 0) payments.push({ method: 'cash', amount: cash });
            if (pix > 0) payments.push({ method: 'pix', amount: pix });
            if (debit > 0) payments.push({ method: 'debit', amount: debit });
            if (credit > 0) payments.push({ method: 'credit', amount: credit });
            if (store_credit > 0) {
                const inst = parseInt(document.getElementById('pdv-split-installments').value) || 1;
                const interval = parseInt(document.getElementById('pdv-split-interval').value) || 30;
                payments.push({ method: 'store_credit', amount: store_credit, due_date: store_credit_date, installments: inst, interval_days: interval });
            }
            
            if (!payments.length) { Toast.warning('Informe pelo menos um valor de pagamento.'); return; }
            confirmMsg = `Confirmar venda de <strong>${Utils.formatCurrency(total)}</strong>?<br><br>` +
                payments.map(p => {
                    let desc = `${paymentLabels[p.method]}: <strong>${Utils.formatCurrency(p.amount)}</strong>`;
                    if (p.due_date) {
                        desc += p.installments > 1 
                            ? `<br>└ ${p.installments}x de ${Utils.formatCurrency(p.amount / p.installments)} (1º Venc: ${Utils.formatDate(p.due_date)})`
                            : ` (Venc: ${Utils.formatDate(p.due_date)})`;
                    }
                    return desc;
                }).join('<br><br>');
        } else {
            const dueDate = document.getElementById('pdv-due-date')?.value;
            if (this.selectedPayment === 'store_credit' && !dueDate) {
                Toast.warning('Informe a data de vencimento para venda A Prazo.');
                return;
            }
            const inst = parseInt(document.getElementById('pdv-installments')?.value) || 1;
            const interval = parseInt(document.getElementById('pdv-interval')?.value) || 30;
            payments = [{ method: this.selectedPayment, amount: total, due_date: dueDate, installments: inst, interval_days: interval }];
            
            // Cash change info
            let cashChangeInfo = '';
            if (this.selectedPayment === 'cash') {
                const received = parseFloat(document.getElementById('pdv-cash-received')?.value) || 0;
                if (received > 0 && received >= total) {
                    const change = received - total;
                    cashChangeInfo = `<br><br>💵 Recebido: <strong>${Utils.formatCurrency(received)}</strong><br>💰 Troco: <strong style="color:var(--success)">${Utils.formatCurrency(change)}</strong>`;
                } else if (received > 0 && received < total) {
                    Toast.warning('Valor recebido é menor que o total.');
                    return;
                }
            }
            confirmMsg = `Confirmar venda de <strong>${Utils.formatCurrency(total)}</strong> via <strong>${paymentLabels[this.selectedPayment]}</strong>?${cashChangeInfo}`;
        }

        Modal.confirm(
            confirmMsg,
            async () => {
                let cash_received = 0;
                let cash_change = 0;
                if (!this.splitMode && this.selectedPayment === 'cash') {
                    const received = parseFloat(document.getElementById('pdv-cash-received')?.value) || 0;
                    if (received > total) {
                        cash_received = received;
                        cash_change = received - total;
                    } else if (received === total) {
                        cash_received = received;
                        cash_change = 0;
                    }
                }

                const data = {
                    items: this.cart.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        serial_number: i.serial_number,
                        discount: 0,
                    })),
                    payments,
                    discount_amount: this.discount,
                    cash_received,
                    cash_change
                };

                const result = await API.post('/sales', data);
                if (result.success) {
                    Toast.success(result.message);
                    this.showReceipt(result.data);
                    this.cart = [];
                    this.discount = 0;
                    this.splitMode = false;
                    this.renderCart();
                    const discInput = document.getElementById('pdv-discount');
                    if (discInput) discInput.value = '0';
                    const cashReceivedInput = document.getElementById('pdv-cash-received');
                    if (cashReceivedInput) cashReceivedInput.value = '';
                    const cashChangeEl = document.getElementById('pdv-cash-change');
                    if (cashChangeEl) cashChangeEl.style.display = 'none';
                    const cashContainer = document.getElementById('pdv-cash-container');
                    if (cashContainer) cashContainer.style.display = 'none';
                    const splitToggle = document.getElementById('pdv-split-toggle');
                    if (splitToggle) splitToggle.checked = false;
                    document.getElementById('pdv-pay-single').style.display = '';
                    document.getElementById('pdv-pay-split').style.display = 'none';
                    document.querySelectorAll('.pdv-split-input').forEach(i => i.value = '0');
                    document.getElementById('pdv-barcode')?.focus();
                } else {
                    Toast.error(result.message);
                }
            },
            'Finalizar Venda'
        );
    },

    showReceipt(sale) {
        this.lastSale = sale;
        const payLabels = { cash: 'Dinheiro', pix: 'PIX', debit: 'Cartão Débito', credit: 'Cartão Crédito', store_credit: 'A Prazo' };
        Modal.open({
            title: `✅ Venda ${Utils.formatOrder(sale.id, sale.created_at)} Concluída`,
            size: 'md',
            content: `
                <div style="text-align:center;margin-bottom:var(--space-lg);">
                    <div style="font-size:2.5rem;margin-bottom:var(--space-sm);">🎉</div>
                    <div style="font-size:var(--font-size-2xl);font-weight:800;color:var(--success);">${Utils.formatCurrency(sale.total)}</div>
                    <div style="color:var(--text-secondary);font-size:var(--font-size-sm);">${payLabels[sale.payments?.[0]?.method] || 'N/A'} • ${Utils.formatDateTime(sale.created_at)}</div>
                </div>
                <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-md);font-size:var(--font-size-sm);">
                    <table style="width:100%;">
                        <thead><tr style="color:var(--text-muted);">
                            <th style="text-align:left;padding:4px 0;">Produto</th>
                            <th style="text-align:center">Qtd</th>
                            <th style="text-align:right">Total</th>
                        </tr></thead>
                        <tbody>
                            ${(sale.items || []).map(i => `<tr>
                                <td style="padding:4px 0;">${Utils.escapeHTML(i.product_name)}</td>
                                <td style="text-align:center">${i.quantity}</td>
                                <td style="text-align:right">${Utils.formatCurrency(i.total)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    ${sale.discount_amount > 0 ? `<div style="border-top:1px solid var(--border-color);margin-top:var(--space-sm);padding-top:var(--space-sm);display:flex;justify-content:space-between;"><span>Desconto</span><span>-${Utils.formatCurrency(sale.discount_amount)}</span></div>` : ''}
                </div>
            `,
            footer: `<button class="btn btn-secondary" onclick="PDVPage.printReceipt()">🖨️ Imprimir Cupom</button>
                     <button class="btn btn-primary" onclick="document.querySelector('.modal-overlay').remove()">OK</button>`,
        });
    },

    printReceipt() {
        if (!this.lastSale) return;
        const sale = this.lastSale;
        const storeSettings = JSON.parse(localStorage.getItem('sc_offline_settings') || '{}');
        const storeName = storeSettings.store_name || 'StockCell';
        const storeCNPJ = storeSettings.store_cnpj || '';
        const storePhone = storeSettings.store_phone || '';
        const storeAddress = storeSettings.store_address || '';

        const payLabels = { cash: 'Dinheiro', pix: 'PIX', debit: 'Cartão Débito', credit: 'Cartão Crédito', store_credit: 'A Prazo' };
        const orderNum = sale._offline ? `OFF-${sale.id}` : Utils.formatOrder(sale.id, sale.created_at);
        const saleDate = Utils.formatDateTime(sale.created_at);

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Cupom ${orderNum}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; font-size:12px; color:#000; background:#fff; width:280px; margin:0 auto; padding:10px; }
        .center { text-align:center; }
        .bold { font-weight:bold; }
        .line { border-top:1px dashed #000; margin:8px 0; }
        .row { display:flex; justify-content:space-between; padding:2px 0; }
        .store-name { font-size:16px; font-weight:bold; }
        .item-name { width:100%; }
        .item-detail { display:flex; justify-content:space-between; padding-left:10px; color:#555; }
        .total-row { font-size:14px; font-weight:bold; }
        .footer { font-size:10px; text-align:center; color:#666; margin-top:10px; }
        @media print {
            body { width:80mm; margin:0; padding:5mm; }
            @page { size:80mm auto; margin:0; }
        }
    </style>
</head>
<body>
    <div class="center">
        <div class="store-name">${Utils.escapeHTML(storeName)}</div>
        ${storeCNPJ ? `<div>CNPJ: ${Utils.escapeHTML(storeCNPJ)}</div>` : ''}
        ${storeAddress ? `<div>${Utils.escapeHTML(storeAddress)}</div>` : ''}
        ${storePhone ? `<div>Tel: ${Utils.escapeHTML(storePhone)}</div>` : ''}
    </div>

    <div class="line"></div>
    <div class="row"><span>Venda:</span> <span>${orderNum}</span></div>
    <div class="row"><span>Data:</span> <span>${saleDate}</span></div>
    <div class="row"><span>Vendedor:</span> <span>${Utils.escapeHTML(sale.user_name || (Auth.getUser()?.fullName || '-'))}</span></div>
    ${sale.customer_name ? `<div class="row"><span>Cliente:</span> <span>${Utils.escapeHTML(sale.customer_name)}</span></div>` : ''}
    <div class="line"></div>

    <div class="bold">ITENS</div>
    ${(sale.items || []).map((item, i) => `
        <div class="item-name">${i + 1}. ${Utils.escapeHTML(item.product_name || item.name)}</div>
        <div class="item-detail">
            <span>${item.quantity}x ${Utils.formatCurrency(item.unit_price)}</span>
            <span class="bold">${Utils.formatCurrency(item.unit_price * item.quantity)}</span>
        </div>
    `).join('')}

    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>${Utils.formatCurrency((sale.total || 0) + (sale.discount_amount || 0))}</span></div>
    ${sale.discount_amount > 0 ? `<div class="row"><span>Desconto:</span><span>-${Utils.formatCurrency(sale.discount_amount)}</span></div>` : ''}
    <div class="row total-row"><span>TOTAL:</span><span>${Utils.formatCurrency(sale.total)}</span></div>

    <div class="line"></div>
    <div class="bold">PAGAMENTO</div>
    ${(sale.payments || []).map(p => `<div class="row"><span>${payLabels[p.method] || p.method}</span><span>${Utils.formatCurrency(p.amount)}</span></div>`).join('')}
    ${sale.cash_received > sale.total ? `<div class="row" style="margin-top:4px;"><span>Valor Recebido:</span><span>${Utils.formatCurrency(sale.cash_received)}</span></div>
    <div class="row"><span>Troco:</span><span>${Utils.formatCurrency(sale.cash_change)}</span></div>` : ''}

    <div class="line"></div>
    <div class="footer">
        <div>Obrigado pela preferência!</div>
        <div>${Utils.escapeHTML(storeName)} - ${saleDate}</div>
        <div style="margin-top:8px;font-weight:bold;">Em caso de trocas, apresente este cupom</div>
        <div style="margin-top:5px;">--- NAO E DOCUMENTO FISCAL ---</div>
        ${sale._offline ? '<div style="margin-top:5px;font-size:8px;">Cupom Gerado Offline</div>' : ''}
    </div>

    <script>window.onload = () => window.print();</script>
</body>
</html>`;

        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();
        } else {
            Toast.warning('O navegador bloqueou a abertura do cupom. Verifique os pop-ups.');
        }
    },
};

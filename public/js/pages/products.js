/**
 * StockCell - Página de Produtos (CRUD)
 */
const ProductsPage = {
    products: [],
    categories: [],
    pagination: {},

    render() {
        return `
            <div class="page-content page-enter">
                <div class="page-header">
                    <div>
                        <h2 class="page-title">Produtos</h2>
                        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie seu catálogo de produtos</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-product">${Icons.plus} Novo Produto</button>
                </div>

                <div class="card">
                    <div class="card-header" style="flex-wrap:wrap;gap:var(--space-sm);">
                        <div class="search-bar" style="max-width:400px;flex:1;">
                            ${Icons.search}
                            <input type="text" class="form-input" id="product-search" placeholder="Buscar por nome, marca, código de barras...">
                        </div>
                        <div style="display:flex;gap:var(--space-sm);align-items:center;">
                            <select class="form-input" id="product-cat-filter" style="width:auto;min-width:160px;">
                                <option value="">Todas categorias</option>
                            </select>
                            <label style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-sm);color:var(--text-secondary);cursor:pointer;white-space:nowrap;">
                                <input type="checkbox" id="product-low-stock"> Estoque baixo
                            </label>
                        </div>
                    </div>
                    <div id="products-list"></div>
                    <div id="products-pagination" style="padding:var(--space-md);display:flex;justify-content:space-between;align-items:center;"></div>
                </div>
            </div>
        `;
    },

    async bind() {
        document.getElementById('btn-new-product').addEventListener('click', () => this.openForm());
        document.getElementById('product-search').addEventListener('input', Utils.debounce(() => this.loadProducts(), 300));
        document.getElementById('product-cat-filter').addEventListener('change', () => this.loadProducts());
        document.getElementById('product-low-stock').addEventListener('change', () => this.loadProducts());
        
        if (sessionStorage.getItem('sc_filter_lowstock')) {
            const cb = document.getElementById('product-low-stock');
            if (cb) cb.checked = true;
            sessionStorage.removeItem('sc_filter_lowstock');
        }

        await this.loadCategories();
        await this.loadProducts();
    },

    async loadCategories() {
        const result = await API.get('/categories?active=true');
        if (result.success) {
            this.categories = result.data;
            const select = document.getElementById('product-cat-filter');
            if (select) {
                this.categories.forEach(c => {
                    select.innerHTML += `<option value="${c.id}">${c.icon} ${Utils.escapeHTML(c.name)}</option>`;
                });
            }
        }
    },

    async loadProducts(page = 1) {
        const search = document.getElementById('product-search')?.value || '';
        const catId = document.getElementById('product-cat-filter')?.value || '';
        const lowStock = document.getElementById('product-low-stock')?.checked || false;

        let url = `/products?page=${page}&limit=20`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (catId) url += `&category_id=${catId}`;
        if (lowStock) url += `&low_stock=true`;

        const result = await API.get(url);
        if (result.success) {
            this.products = result.data;
            this.pagination = result.pagination;
            this.renderList();
            this.renderPagination();
        }
    },

    renderList() {
        const container = document.getElementById('products-list');
        if (!this.products.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Nenhum produto encontrado</div></div>`;
            return;
        }
        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead><tr>
                        <th>Código</th><th>Produto</th><th>Categoria</th>
                        <th style="text-align:right">Custo</th><th style="text-align:right">Venda</th>
                        <th style="text-align:right" class="hide-mobile">Margem</th><th style="text-align:center">Estoque</th>
                        <th style="width:120px;text-align:center">Ações</th>
                    </tr></thead>
                    <tbody>
                        ${this.products.map(p => `
                            <tr onclick="ProductsPage.openForm(${p.id})" style="cursor:pointer;" class="clickable-row">
                                <td data-label="Código"><code style="font-size:var(--font-size-xs);color:var(--accent-secondary);">${Utils.escapeHTML(p.barcode || p.internal_code || '-')}</code></td>
                                <td data-label="Produto">
                                    <strong>${Utils.escapeHTML(p.name)}</strong>
                                    ${p.brand ? `<br><span style="font-size:var(--font-size-xs);color:var(--text-muted)">${Utils.escapeHTML(p.brand)} ${p.compatible_model ? '• ' + Utils.escapeHTML(p.compatible_model) : ''}</span>` : ''}
                                </td>
                                <td data-label="Categoria">${p.category_icon || ''} ${Utils.escapeHTML(p.category_name || '-')}</td>
                                <td data-label="Custo" style="text-align:right">${Utils.formatCurrency(p.cost_price)}</td>
                                <td data-label="Venda" style="text-align:right;font-weight:600">${Utils.formatCurrency(p.sale_price)}</td>
                                <td data-label="Margem" style="text-align:right" class="hide-mobile"><span class="${parseFloat(p.profit_margin) > 0 ? 'text-success' : 'text-danger'}">${p.profit_margin}%</span></td>
                                <td data-label="Estoque" style="text-align:center">
                                    ${p.is_low_stock
                                        ? `<span class="badge badge-warning">${p.current_stock} ⚠️</span>`
                                        : `<span class="badge badge-success">${p.current_stock}</span>`}
                                </td>
                                <td data-label="Ações" style="text-align:center" onclick="event.stopPropagation()">
                                    <button class="btn btn-ghost btn-sm" onclick="ProductsPage.deleteProduct(${p.id},'${Utils.escapeHTML(p.name).replace(/'/g,"\\\\'")}')" title="Excluir">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderPagination() {
        const container = document.getElementById('products-pagination');
        if (!container || this.pagination.pages <= 1) { if(container) container.innerHTML = ''; return; }
        const { page, pages, total } = this.pagination;
        container.innerHTML = `
            <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">${total} produto(s)</span>
            <div style="display:flex;gap:var(--space-xs);">
                <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="ProductsPage.loadProducts(${page - 1})">← Anterior</button>
                <span style="padding:6px 12px;font-size:var(--font-size-sm);color:var(--text-secondary)">${page} / ${pages}</span>
                <button class="btn btn-secondary btn-sm" ${page >= pages ? 'disabled' : ''} onclick="ProductsPage.loadProducts(${page + 1})">Próxima →</button>
            </div>
        `;
    },

    async openForm(id = null) {
        let product = { name:'', brand:'', barcode:'', internal_code:'', compatible_model:'', category_id:'', cost_price:'', sale_price:'', current_stock:0, min_stock:5, notes:'', track_serial:0, unit_type:'un', variations:[], serials:[] };
        if (id) {
            const r = await API.get(`/products/${id}`);
            if (r.success) product = r.data;
        }

        this.currentProduct = product; // Store for tab switching

        const catOptions = this.categories.map(c => `<option value="${c.id}" ${product.category_id == c.id ? 'selected' : ''}>${c.icon} ${Utils.escapeHTML(c.name)}</option>`).join('');

        Modal.open({
            title: id ? 'Editar Produto' : 'Novo Produto',
            size: 'lg',
            content: `
                <div class="tabs-container">
                    <div class="tabs-header">
                        <button type="button" class="tab-btn active" onclick="ProductsPage.switchTab('basic')">Dados Básicos</button>
                        ${id ? `<button type="button" class="tab-btn" onclick="ProductsPage.switchTab('variations')">Grade / Variações</button>` : ''}
                        ${id && product.track_serial ? `<button type="button" class="tab-btn" onclick="ProductsPage.switchTab('serials')">Rastreabilidade / IMEI</button>` : ''}
                    </div>

                    <div class="tabs-content">
                        <!-- TAB BÁSICO -->
                        <div id="tab-basic" class="tab-pane active">
                            <form id="product-form">
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
                                    <div class="form-group" style="grid-column:1/-1; margin-bottom:var(--space-sm);">
                                        <label class="form-label" style="font-weight:bold;">Tipo de Item</label>
                                        <div style="display:flex; gap:15px;">
                                            <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                                                <input type="radio" name="prod_is_service" value="0" ${!product.is_service ? 'checked' : ''} onchange="ProductsPage.toggleServiceFields()"> Produto Físico (Peças, Acessórios)
                                            </label>
                                            <label style="cursor:pointer; display:flex; align-items:center; gap:5px;">
                                                <input type="radio" name="prod_is_service" value="1" ${product.is_service ? 'checked' : ''} onchange="ProductsPage.toggleServiceFields()"> Mão de Obra / Serviço
                                            </label>
                                        </div>
                                    </div>
                                    <div class="form-group" style="grid-column:1/-1">
                                        <label class="form-label">Nome *</label>
                                        <input type="text" class="form-input" id="prod-name" value="${Utils.escapeHTML(product.name)}" placeholder="Ex: Capa iPhone 15 Pro Max Silicone" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Código de Barras (EAN)</label>
                                        <input type="text" class="form-input" id="prod-barcode" value="${Utils.escapeHTML(product.barcode || '')}" placeholder="Escaneie ou digite">
                                        <span class="form-hint">Use o scanner ou digite manualmente</span>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Código Interno</label>
                                        <input type="text" class="form-input" id="prod-internal" value="${Utils.escapeHTML(product.internal_code || '')}" placeholder="Auto-gerado se vazio">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Marca</label>
                                        <input type="text" class="form-input" id="prod-brand" value="${Utils.escapeHTML(product.brand || '')}" placeholder="Ex: Samsung, Apple">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Modelo Compatível</label>
                                        <input type="text" class="form-input" id="prod-model" value="${Utils.escapeHTML(product.compatible_model || '')}" placeholder="Ex: iPhone 15, Galaxy S24">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Categoria</label>
                                        <select class="form-input" id="prod-category"><option value="">Selecione...</option>${catOptions}</select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Tipo de Unidade</label>
                                        <select class="form-input" id="prod-unit">
                                            <option value="un" ${product.unit_type === 'un' ? 'selected' : ''}>Unidade (un)</option>
                                            <option value="kg" ${product.unit_type === 'kg' ? 'selected' : ''}>Quilograma (kg)</option>
                                            <option value="l" ${product.unit_type === 'l' ? 'selected' : ''}>Litro (L)</option>
                                            <option value="m" ${product.unit_type === 'm' ? 'selected' : ''}>Metro (m)</option>
                                            <option value="cx" ${product.unit_type === 'cx' ? 'selected' : ''}>Caixa (cx)</option>
                                        </select>
                                    </div>
                                    <div class="form-group physical-only">
                                        <label class="form-label">Preço de Custo (R$)</label>
                                        <input type="number" class="form-input" id="prod-cost" value="${product.cost_price || ''}" step="0.01" min="0" placeholder="0,00">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Preço de Venda (R$) *</label>
                                        <input type="number" class="form-input" id="prod-sale" value="${product.sale_price || ''}" step="0.01" min="0.01" placeholder="0,00" required>
                                    </div>
                                    ${!id ? `
                                    <div class="form-group physical-only">
                                        <label class="form-label">Estoque Inicial</label>
                                        <input type="number" class="form-input" id="prod-stock" value="${product.current_stock || 0}" min="0">
                                    </div>` : ''}
                                    <div class="form-group physical-only">
                                        <label class="form-label">Estoque Mínimo</label>
                                        <input type="number" class="form-input" id="prod-minstock" value="${product.min_stock || 5}" min="0">
                                        <span class="form-hint">Alerta quando abaixo deste valor</span>
                                    </div>
                                    <div class="form-group physical-only" style="grid-column:1/-1; display:flex; align-items:center; gap:10px;">
                                        <input type="checkbox" id="prod-track-serial" ${product.track_serial ? 'checked' : ''} style="width:20px;height:20px;">
                                        <label class="form-label" style="margin:0;cursor:pointer;" for="prod-track-serial">
                                            Rastrear Número de Série / IMEI
                                            <div class="form-hint">Se ativado, exige bipar o IMEI na hora da venda ou uso em O.S.</div>
                                        </label>
                                    </div>
                                    <div class="form-group" style="grid-column:1/-1">
                                        <label class="form-label">Observações</label>
                                        <textarea class="form-input" id="prod-notes" rows="2" placeholder="Anotações sobre o produto...">${Utils.escapeHTML(product.notes || '')}</textarea>
                                    </div>
                                </div>
                                <div id="prod-margin" style="margin-top:var(--space-sm);padding:var(--space-sm) var(--space-md);background:var(--bg-secondary);border-radius:var(--radius-md);font-size:var(--font-size-sm);color:var(--text-secondary);"></div>
                            </form>
                        </div>

                        <!-- TAB VARIAÇÕES -->
                        ${id ? `
                        <div id="tab-variations" class="tab-pane">
                            <div style="margin-bottom:var(--space-md);">
                                <h4>Grade de Variações</h4>
                                <p style="font-size:var(--font-size-sm);color:var(--text-secondary);">Cadastre cores, tamanhos ou modelos específicos para este produto.</p>
                            </div>
                            <div id="prod-variations-list"></div>
                            <form id="variation-form" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:15px; background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-md);">
                                <input type="text" id="var-name" placeholder="Atributo (Ex: Cor)" class="form-input" style="flex:1" required>
                                <input type="text" id="var-value" placeholder="Valor (Ex: Azul)" class="form-input" style="flex:1" required>
                                <input type="text" id="var-barcode" placeholder="Cód. Barras" class="form-input" style="flex:1">
                                <input type="number" id="var-price" placeholder="Acréscimo R$" class="form-input" style="width:120px" step="0.01">
                                <button type="submit" class="btn btn-primary">Adicionar</button>
                            </form>
                        </div>
                        ` : ''}

                        <!-- TAB IMEI -->
                        ${id && product.track_serial ? `
                        <div id="tab-serials" class="tab-pane">
                            <div style="margin-bottom:var(--space-md);">
                                <h4>Controle de IMEI/Série</h4>
                                <p style="font-size:var(--font-size-sm);color:var(--text-secondary);">Adicione os seriais em estoque. O estoque total será ajustado automaticamente.</p>
                            </div>
                            <form id="serial-form" style="display:flex; gap:10px; margin-bottom:15px;">
                                <input type="text" id="serial-number" placeholder="Bipar/Digitar Serial" class="form-input" style="flex:1" required>
                                <button type="submit" class="btn btn-primary">Adicionar Serial</button>
                            </form>
                            <div id="prod-serials-list"></div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" id="modal-save-prod">${id ? 'Salvar Configurações Básico' : 'Cadastrar'}</button>
            `,
        });

        // Eventos da Tab Básica
        const calcMargin = () => {
            const cost = parseFloat(document.getElementById('prod-cost')?.value) || 0;
            const sale = parseFloat(document.getElementById('prod-sale')?.value) || 0;
            const el = document.getElementById('prod-margin');
            if (el && cost > 0 && sale > 0) {
                const margin = ((sale - cost) / cost * 100).toFixed(1);
                const profit = sale - cost;
                el.innerHTML = `💰 Lucro: <strong class="${profit > 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(profit)}</strong> | Margem: <strong class="${margin > 0 ? 'text-success' : 'text-danger'}">${margin}%</strong>`;
            } else if (el) { el.innerHTML = ''; }
        };
        document.getElementById('prod-cost')?.addEventListener('input', calcMargin);
        document.getElementById('prod-sale')?.addEventListener('input', calcMargin);
        calcMargin();
        
        this.toggleServiceFields();

        document.getElementById('modal-save-prod').addEventListener('click', () => this.saveProduct(id));

        // Eventos Variações
        if (id) {
            this.renderVariationsList();
            document.getElementById('variation-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addVariation(id);
            });
        }

        // Eventos Seriais
        if (id && product.track_serial) {
            this.renderSerialsList();
            document.getElementById('serial-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addSerial(id);
            });
        }
    },

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        event.currentTarget.classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');

        // Mostra o botão de Salvar apenas na Aba Básica
        const saveBtn = document.getElementById('modal-save-prod');
        if (saveBtn) {
            saveBtn.style.display = tabId === 'basic' ? 'inline-flex' : 'none';
        }
    },

    toggleServiceFields() {
        const isService = document.querySelector('input[name="prod_is_service"]:checked')?.value === '1';
        document.querySelectorAll('.physical-only').forEach(el => {
            el.style.display = isService ? 'none' : 'block';
        });
        if (isService) {
            document.getElementById('prod-track-serial').checked = false;
        }
    },

    async saveProduct(id) {
        const is_service = document.querySelector('input[name="prod_is_service"]:checked')?.value === '1';
        const data = {
            is_service: is_service,
            name: document.getElementById('prod-name').value,
            barcode: document.getElementById('prod-barcode').value || null,
            internal_code: document.getElementById('prod-internal').value || null,
            brand: document.getElementById('prod-brand').value,
            compatible_model: document.getElementById('prod-model').value,
            category_id: document.getElementById('prod-category').value || null,
            unit_type: document.getElementById('prod-unit').value,
            cost_price: parseFloat(document.getElementById('prod-cost').value || 0),
            sale_price: parseFloat(document.getElementById('prod-sale').value || 0),
            current_stock: parseInt(document.getElementById('prod-stock') ? document.getElementById('prod-stock').value : 0),
            min_stock: parseInt(document.getElementById('prod-minstock').value || 0),
            track_serial: document.getElementById('prod-track-serial').checked ? 1 : 0,
            notes: document.getElementById('prod-notes').value
        };

        if (is_service) {
            data.cost_price = 0;
            data.current_stock = 0;
            data.min_stock = 0;
            data.track_serial = 0;
        }

        if (!data.name.trim()) { Toast.warning('Nome do produto é obrigatório.'); return; }
        if (!data.sale_price || data.sale_price <= 0) { Toast.warning('Preço de venda é obrigatório.'); return; }

        const result = id ? await API.put(`/products/${id}`, data) : await API.post('/products', data);
        if (result.success) {
            Toast.success(result.message);
            document.querySelector('.modal-overlay')?.remove();
            this.loadProducts();
        } else {
            Toast.error(result.message);
        }
    },

    deleteProduct(id, name) {
        Modal.confirm(`Deseja excluir o produto "${name}"?`, async () => {
            const result = await API.delete(`/products/${id}`);
            if (result.success) { Toast.success(result.message); this.loadProducts(); }
            else { Toast.error(result.message); }
        });
    },

    // ==========================================
    // VARIAÇÕES
    // ==========================================
    renderVariationsList() {
        const container = document.getElementById('prod-variations-list');
        const v = this.currentProduct.variations;
        if (!v || !v.length) {
            container.innerHTML = `<div class="empty-state" style="padding:15px; font-size:13px;">Nenhuma variação cadastrada.</div>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table" style="font-size:12px;">
                <thead><tr><th>Atributo</th><th>Valor</th><th>Cód Barras</th><th>Acréscimo</th><th>Ações</th></tr></thead>
                <tbody>
                    ${v.map(item => `
                        <tr>
                            <td>${Utils.escapeHTML(item.attribute_name)}</td>
                            <td><strong>${Utils.escapeHTML(item.attribute_value)}</strong></td>
                            <td>${Utils.escapeHTML(item.barcode || '-')}</td>
                            <td>${item.additional_price > 0 ? '+ ' + Utils.formatCurrency(item.additional_price) : '-'}</td>
                            <td><button class="btn btn-ghost btn-sm" onclick="ProductsPage.deleteVariation(${item.id})" style="padding:4px;"><span style="color:var(--danger)">🗑️</span></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async addVariation(productId) {
        const data = {
            attribute_name: document.getElementById('var-name').value,
            attribute_value: document.getElementById('var-value').value,
            barcode: document.getElementById('var-barcode').value || null,
            additional_price: parseFloat(document.getElementById('var-price').value) || 0
        };

        const result = await API.post(`/products/${productId}/variations`, data);
        if (result.success) {
            Toast.success(result.message);
            document.getElementById('variation-form').reset();
            const r = await API.get(`/products/${productId}`);
            if (r.success) {
                this.currentProduct = r.data;
                this.renderVariationsList();
            }
        } else {
            Toast.error(result.message);
        }
    },

    async deleteVariation(vid) {
        if (!confirm('Excluir esta variação?')) return;
        const result = await API.delete(`/products/variations/${vid}`);
        if (result.success) {
            Toast.success('Variação excluída.');
            const productId = this.currentProduct.id;
            const r = await API.get(`/products/${productId}`);
            if (r.success) {
                this.currentProduct = r.data;
                this.renderVariationsList();
            }
        } else { Toast.error(result.message); }
    },

    // ==========================================
    // SERIALS / IMEI
    // ==========================================
    renderSerialsList() {
        const container = document.getElementById('prod-serials-list');
        const s = this.currentProduct.serials;
        if (!s || !s.length) {
            container.innerHTML = `<div class="empty-state" style="padding:15px; font-size:13px;">Nenhum serial em estoque.</div>`;
            return;
        }
        container.innerHTML = `
            <table class="data-table" style="font-size:12px;">
                <thead><tr><th>Serial / IMEI</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                    ${s.map(item => `
                        <tr>
                            <td><strong>${Utils.escapeHTML(item.serial_number)}</strong></td>
                            <td>
                                ${item.status === 'available' ? '<span class="badge badge-success">Disponível</span>' : 
                                  item.status === 'sold' ? '<span class="badge badge-secondary">Vendido</span>' : 
                                  `<span class="badge badge-warning">${item.status}</span>`}
                            </td>
                            <td>
                                ${item.status === 'available' ? `<button class="btn btn-ghost btn-sm" onclick="ProductsPage.deleteSerial(${item.id})" style="padding:4px;"><span style="color:var(--danger)">🗑️</span></button>` : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async addSerial(productId) {
        const data = {
            serial_number: document.getElementById('serial-number').value
        };

        const result = await API.post(`/products/${productId}/serials`, data);
        if (result.success) {
            Toast.success(result.message);
            document.getElementById('serial-form').reset();
            document.getElementById('serial-number').focus();
            const r = await API.get(`/products/${productId}`);
            if (r.success) {
                this.currentProduct = r.data;
                this.renderSerialsList();
                this.loadProducts(); // Update stock in background
            }
        } else {
            Toast.error(result.message);
        }
    },

    async deleteSerial(sid) {
        if (!confirm('Remover este serial do estoque?')) return;
        const result = await API.delete(`/products/serials/${sid}`);
        if (result.success) {
            Toast.success('Serial excluído e estoque atualizado.');
            const productId = this.currentProduct.id;
            const r = await API.get(`/products/${productId}`);
            if (r.success) {
                this.currentProduct = r.data;
                this.renderSerialsList();
                this.loadProducts(); // Update stock in background
            }
        } else { Toast.error(result.message); }
    }
};

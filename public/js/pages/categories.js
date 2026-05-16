/**
 * StockCell - Página de Categorias (CRUD)
 */
const CategoriesPage = {
    categories: [],

    render() {
        return `
            <div class="page-content page-enter">
                <div class="page-header">
                    <div>
                        <h2 class="page-title">Categorias</h2>
                        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);">Gerencie as categorias dos seus produtos</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-category">
                        ${Icons.plus} Nova Categoria
                    </button>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div class="search-bar">
                            ${Icons.search}
                            <input type="text" class="form-input" id="category-search" placeholder="Buscar categoria...">
                        </div>
                    </div>
                    <div id="categories-list"></div>
                </div>
            </div>
        `;
    },

    bind() {
        document.getElementById('btn-new-category').addEventListener('click', () => this.openForm());
        document.getElementById('category-search').addEventListener('input', Utils.debounce((e) => this.loadCategories(e.target.value), 300));
        this.loadCategories();
    },

    async loadCategories(search = '') {
        const url = search ? `/categories?search=${encodeURIComponent(search)}` : '/categories';
        const result = await API.get(url);
        if (result.success) {
            this.categories = result.data;
            this.renderList();
        }
    },

    renderList() {
        const container = document.getElementById('categories-list');
        if (!this.categories.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏷️</div><div class="empty-state-text">Nenhuma categoria cadastrada</div></div>`;
            return;
        }
        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width:50px">Ícone</th>
                            <th>Nome</th>
                            <th>Descrição</th>
                            <th style="text-align:center">Produtos</th>
                            <th style="text-align:center">Status</th>
                            <th style="width:120px;text-align:center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.categories.map(cat => `
                            <tr>
                                <td style="font-size:1.4rem;text-align:center">${Utils.escapeHTML(cat.icon)}</td>
                                <td><strong>${Utils.escapeHTML(cat.name)}</strong></td>
                                <td style="color:var(--text-secondary)">${Utils.escapeHTML(cat.description) || '-'}</td>
                                <td style="text-align:center">
                                    <span class="badge badge-info">${cat.product_count || 0}</span>
                                </td>
                                <td style="text-align:center">
                                    ${cat.active ? '<span class="badge badge-success">Ativa</span>' : '<span class="badge badge-danger">Inativa</span>'}
                                </td>
                                <td style="text-align:center">
                                    <button class="btn btn-ghost btn-sm" onclick="CategoriesPage.openForm(${cat.id})" title="Editar">✏️</button>
                                    <button class="btn btn-ghost btn-sm" onclick="CategoriesPage.deleteCategory(${cat.id},'${Utils.escapeHTML(cat.name)}')" title="Excluir">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async openForm(id = null) {
        let category = { name: '', description: '', icon: '📦', sort_order: 0 };
        if (id) {
            const result = await API.get(`/categories/${id}`);
            if (result.success) category = result.data;
        }

        const emojis = ['📱','📦','🛡️','🔌','🎧','🔋','🚗','🖥️','⌚','🎮','💡','🔧','📷','🎒','💎'];

        Modal.open({
            title: id ? 'Editar Categoria' : 'Nova Categoria',
            content: `
                <form id="category-form">
                    <div class="form-group">
                        <label class="form-label">Ícone</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;" id="icon-picker">
                            ${emojis.map(e => `
                                <button type="button" class="btn btn-secondary btn-sm icon-pick ${category.icon === e ? 'active' : ''}"
                                    data-icon="${e}" style="font-size:1.2rem;width:42px;height:42px;padding:0;
                                    ${category.icon === e ? 'border-color:var(--accent-primary);background:rgba(var(--accent-primary-rgb),0.2);' : ''}"
                                >${e}</button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="cat-icon" value="${category.icon}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nome *</label>
                        <input type="text" class="form-input" id="cat-name" value="${Utils.escapeHTML(category.name)}" required placeholder="Ex: Capas e Cases">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descrição</label>
                        <input type="text" class="form-input" id="cat-description" value="${Utils.escapeHTML(category.description || '')}" placeholder="Breve descrição da categoria">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ordem de exibição</label>
                        <input type="number" class="form-input" id="cat-order" value="${category.sort_order || 0}" min="0">
                    </div>
                </form>
            `,
            footer: `
                <button class="btn btn-secondary" id="modal-cancel-cat">Cancelar</button>
                <button class="btn btn-primary" id="modal-save-cat">${id ? 'Salvar' : 'Criar'}</button>
            `,
            size: 'md',
        });

        // Icon picker
        document.querySelectorAll('.icon-pick').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.icon-pick').forEach(b => { b.style.borderColor = ''; b.style.background = ''; });
                btn.style.borderColor = 'var(--accent-primary)';
                btn.style.background = 'rgba(var(--accent-primary-rgb),0.2)';
                document.getElementById('cat-icon').value = btn.dataset.icon;
            });
        });

        document.getElementById('modal-cancel-cat').addEventListener('click', () => document.querySelector('.modal-overlay').remove());
        document.getElementById('modal-save-cat').addEventListener('click', () => this.saveCategory(id));
    },

    async saveCategory(id) {
        const data = {
            name: document.getElementById('cat-name').value,
            description: document.getElementById('cat-description').value,
            icon: document.getElementById('cat-icon').value,
            sort_order: parseInt(document.getElementById('cat-order').value) || 0,
        };

        if (!data.name.trim()) { Toast.warning('Nome da categoria é obrigatório.'); return; }

        const result = id ? await API.put(`/categories/${id}`, data) : await API.post('/categories', data);

        if (result.success) {
            Toast.success(result.message);
            document.querySelector('.modal-overlay')?.remove();
            this.loadCategories();
        } else {
            Toast.error(result.message);
        }
    },

    deleteCategory(id, name) {
        Modal.confirm(`Deseja excluir a categoria "${name}"?`, async () => {
            const result = await API.delete(`/categories/${id}`);
            if (result.success) {
                Toast.success(result.message);
                this.loadCategories();
            } else {
                Toast.error(result.message);
            }
        });
    },
};

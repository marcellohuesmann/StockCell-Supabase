/**
 * StockCell - OfflineDB (IndexedDB Wrapper)
 * Espelha o banco do servidor localmente para uso offline.
 */
const OfflineDB = {
    DB_NAME: 'stockcell_offline',
    DB_VERSION: 5,
    _db: null,

    STORES: ['products', 'categories', 'customers', 'suppliers', 'sales', 'sale_items', 'payments', 'transactions', 'transaction_categories', 'transaction_payments', 'bank_accounts', 'stock_movements', 'cash_registers', 'cash_movements', 'offline_queue', 'sync_meta'],

    async init() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Products
                if (!db.objectStoreNames.contains('products')) {
                    const ps = db.createObjectStore('products', { keyPath: 'id' });
                    ps.createIndex('barcode', 'barcode', { unique: false });
                    ps.createIndex('name', 'name', { unique: false });
                    ps.createIndex('category_id', 'category_id', { unique: false });
                }
                // Categories
                if (!db.objectStoreNames.contains('categories'))
                    db.createObjectStore('categories', { keyPath: 'id' });
                // Customers
                if (!db.objectStoreNames.contains('customers'))
                    db.createObjectStore('customers', { keyPath: 'id' });
                // Suppliers
                if (!db.objectStoreNames.contains('suppliers'))
                    db.createObjectStore('suppliers', { keyPath: 'id' });
                // Sales
                if (!db.objectStoreNames.contains('sales')) {
                    const ss = db.createObjectStore('sales', { keyPath: 'id' });
                    ss.createIndex('uuid', 'uuid', { unique: false });
                    ss.createIndex('status', 'status', { unique: false });
                    ss.createIndex('created_at', 'created_at', { unique: false });
                }
                // Sale Items
                if (!db.objectStoreNames.contains('sale_items')) {
                    const si = db.createObjectStore('sale_items', { keyPath: 'id' });
                    si.createIndex('sale_id', 'sale_id', { unique: false });
                }
                // Payments
                if (!db.objectStoreNames.contains('payments')) {
                    const pm = db.createObjectStore('payments', { keyPath: 'id' });
                    pm.createIndex('sale_id', 'sale_id', { unique: false });
                }
                // Transactions (finance)
                if (!db.objectStoreNames.contains('transactions'))
                    db.createObjectStore('transactions', { keyPath: 'id' });
                // Transaction Categories (Finance)
                if (!db.objectStoreNames.contains('transaction_categories'))
                    db.createObjectStore('transaction_categories', { keyPath: 'id' });
                // Transaction Payments (Finance - Partial payments)
                if (!db.objectStoreNames.contains('transaction_payments')) {
                    const tp = db.createObjectStore('transaction_payments', { keyPath: 'id' });
                    tp.createIndex('transaction_id', 'transaction_id', { unique: false });
                }
                // Bank Accounts
                if (!db.objectStoreNames.contains('bank_accounts')) {
                    db.createObjectStore('bank_accounts', { keyPath: 'id' });
                }
                // Stock Movements
                if (!db.objectStoreNames.contains('stock_movements')) {
                    const sm = db.createObjectStore('stock_movements', { keyPath: 'id' });
                    sm.createIndex('product_id', 'product_id', { unique: false });
                }
                // Cash Registers
                if (!db.objectStoreNames.contains('cash_registers')) {
                    const cr = db.createObjectStore('cash_registers', { keyPath: 'id' });
                    cr.createIndex('uuid', 'uuid', { unique: false });
                    cr.createIndex('status', 'status', { unique: false });
                }
                // Cash Movements
                if (!db.objectStoreNames.contains('cash_movements')) {
                    const cm = db.createObjectStore('cash_movements', { keyPath: 'id' });
                    cm.createIndex('cash_register_id', 'cash_register_id', { unique: false });
                }
                // Offline Queue (pending operations to sync)
                if (!db.objectStoreNames.contains('offline_queue'))
                    db.createObjectStore('offline_queue', { keyPath: 'uuid' });
                // Sync metadata
                if (!db.objectStoreNames.contains('sync_meta'))
                    db.createObjectStore('sync_meta', { keyPath: 'key' });
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };
            request.onerror = (e) => {
                console.error('OfflineDB init error:', e);
                reject(e);
            };
        });
    },

    // ---- Generic CRUD ----
    async getAll(storeName) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async get(storeName, id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(storeName, data) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async putBulk(storeName, items) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            items.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async delete(storeName, id) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async clear(storeName) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async getByIndex(storeName, indexName, value) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const index = tx.objectStore(storeName).index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async count(storeName) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    // ---- Queue Management ----
    async enqueue(operation) {
        operation.uuid = operation.uuid || crypto.randomUUID();
        operation.created_at = new Date().toISOString();
        await this.put('offline_queue', operation);
        return operation.uuid;
    },

    async getQueue() {
        return this.getAll('offline_queue');
    },

    async dequeue(uuid) {
        return this.delete('offline_queue', uuid);
    },

    // ---- Sync Meta ----
    async getSyncTimestamp() {
        const meta = await this.get('sync_meta', 'last_sync');
        return meta ? meta.value : null;
    },

    async setSyncTimestamp(ts) {
        await this.put('sync_meta', { key: 'last_sync', value: ts });
    },

    nextLocalId() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        const str = `${pad(d.getDate())}${pad(d.getMonth()+1)}${String(d.getFullYear()).substring(2)}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const rand = Math.floor(Math.random() * 10);
        return parseInt(str + rand, 10);
    },
};

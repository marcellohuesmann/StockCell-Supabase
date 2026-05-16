/**
 * StockCell - Toast Notifications
 */
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'info', duration = 4000) {
        if (!this.container) this.init();

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${Utils.escapeHTML(message)}</span>
            <button class="toast-close" onclick="Toast.dismiss(this.parentElement)">✕</button>
        `;

        this.container.appendChild(toast);

        // Auto dismiss
        setTimeout(() => this.dismiss(toast), duration);
    },

    dismiss(toast) {
        if (!toast || !toast.parentElement) return;
        toast.classList.add('closing');
        setTimeout(() => toast.remove(), 300);
    },

    success(msg) { this.show(msg, 'success'); },
    warning(msg) { this.show(msg, 'warning'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
};

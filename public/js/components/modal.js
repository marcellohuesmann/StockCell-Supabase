/**
 * StockCell - Modal System
 */
const Modal = {
    open(options) {
        const { title, content, footer, size = 'md', onClose } = options;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'modal-overlay-' + Utils.uid();

        const maxWidths = { sm: '380px', md: '520px', lg: '720px', xl: '900px' };

        overlay.innerHTML = `
            <div class="modal" style="max-width: ${maxWidths[size] || maxWidths.md}">
                <div class="modal-header">
                    <h3 class="modal-title">${title || ''}</h3>
                    <button class="modal-close" id="modal-close-btn">${Icons.x}</button>
                </div>
                <div class="modal-body">${content || ''}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        document.body.appendChild(overlay);

        // Close handlers
        const close = () => {
            overlay.style.animation = 'fadeOut 0.2s ease forwards';
            setTimeout(() => {
                overlay.remove();
                if (onClose) onClose();
            }, 200);
        };

        overlay.querySelector('#modal-close-btn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);

        return { close, overlay };
    },

    confirm(message, onConfirm, title = 'Confirmar') {
        const modal = this.open({
            title,
            content: `<p style="color: var(--text-secondary)">${message}</p>`,
            footer: `
                <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
                <button class="btn btn-danger" id="modal-confirm">Confirmar</button>
            `,
        });

        modal.overlay.querySelector('#modal-cancel').addEventListener('click', modal.close);
        modal.overlay.querySelector('#modal-confirm').addEventListener('click', () => {
            modal.close();
            if (onConfirm) onConfirm();
        });
    },
};

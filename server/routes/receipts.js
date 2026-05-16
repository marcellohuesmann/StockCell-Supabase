const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/receipts/:saleId
 * Retorna HTML do cupom formatado para impressao/PDF
 */
router.get('/:saleId', (req, res) => {
    try {
        const db = getDatabase();
        const sale = db.prepare(`
            SELECT s.*, u.full_name as user_name, c.name as customer_name, c.cpf as customer_cpf
            FROM sales s LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?
        `).get(req.params.saleId);

        if (!sale) return res.status(404).json({ success: false, message: 'Venda n\u00e3o encontrada.' });

        const items = db.prepare('SELECT si.*, p.name as product_name, p.barcode FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?').all(req.params.saleId);
        const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(req.params.saleId);

        const getSetting = (key) => { const r = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key); return r ? r.value : ''; };
        const storeName = getSetting('store_name') || 'StockCell';
        const storeCNPJ = getSetting('store_cnpj');
        const storePhone = getSetting('store_phone');
        const storeAddress = getSetting('store_address');

        const payLabels = { pix: 'PIX', debit: 'Cart\u00e3o D\u00e9bito', credit: 'Cart\u00e3o Cr\u00e9dito', cash: 'Dinheiro' };
        const orderNum = `#${String(sale.id).padStart(4, '0')}`;
        const saleDate = new Date(sale.created_at).toLocaleString('pt-BR');

        const formatBRL = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

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
        <div class="store-name">${storeName}</div>
        ${storeCNPJ ? `<div>CNPJ: ${storeCNPJ}</div>` : ''}
        ${storeAddress ? `<div>${storeAddress}</div>` : ''}
        ${storePhone ? `<div>Tel: ${storePhone}</div>` : ''}
    </div>

    <div class="line"></div>
    <div class="row"><span>Venda: ${orderNum}</span><span>${saleDate}</span></div>
    <div class="row"><span>Vendedor: ${sale.user_name || '-'}</span></div>
    ${sale.customer_name ? `<div class="row"><span>Cliente: ${sale.customer_name}</span></div>` : ''}
    ${sale.customer_cpf ? `<div class="row"><span>CPF: ${sale.customer_cpf}</span></div>` : ''}
    <div class="line"></div>

    <div class="bold">ITENS</div>
    ${items.map((item, i) => `
        <div class="item-name">${i + 1}. ${item.product_name}</div>
        <div class="item-detail">
            <span>${item.quantity}x ${formatBRL(item.unit_price)}</span>
            <span class="bold">${formatBRL(item.total)}</span>
        </div>
    `).join('')}

    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>${formatBRL(sale.subtotal)}</span></div>
    ${sale.discount_amount > 0 ? `<div class="row"><span>Desconto:</span><span>-${formatBRL(sale.discount_amount)}</span></div>` : ''}
    <div class="row total-row"><span>TOTAL:</span><span>${formatBRL(sale.total)}</span></div>

    <div class="line"></div>
    <div class="bold">PAGAMENTO</div>
    ${payments.map(p => `<div class="row"><span>${payLabels[p.method] || p.method}</span><span>${formatBRL(p.amount)}</span></div>`).join('')}
    ${sale.cash_received > sale.total ? `<div class="row" style="margin-top:4px;"><span>Valor Recebido:</span><span>${formatBRL(sale.cash_received)}</span></div>
    <div class="row"><span>Troco:</span><span>${formatBRL(sale.cash_change)}</span></div>` : ''}

    <div class="line"></div>
    <div class="footer">
        <div>Obrigado pela prefer\u00eancia!</div>
        <div>${storeName} - ${saleDate}</div>
        <div style="margin-top:8px;font-weight:bold;">Em caso de trocas, apresente este cupom</div>
        <div style="margin-top:5px;">--- NAO E DOCUMENTO FISCAL ---</div>
    </div>

    <script>window.onload = () => window.print();</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error) {
        console.error('Erro ao gerar cupom:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar cupom.' });
    }
});

module.exports = router;

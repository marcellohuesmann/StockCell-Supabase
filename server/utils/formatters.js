/**
 * Formatadores para o padrão brasileiro
 */

function formatCurrency(value) {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatCPF(cpf) {
    if (!cpf) return '-';
    const c = cpf.replace(/[^\d]/g, '');
    if (c.length !== 11) return cpf;
    return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCNPJ(cnpj) {
    if (!cnpj) return '-';
    const c = cnpj.replace(/[^\d]/g, '');
    if (c.length !== 14) return cnpj;
    return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatPhone(phone) {
    if (!phone) return '-';
    const c = phone.replace(/[^\d]/g, '');
    if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone;
}

function formatOrderNumber(id) {
    return `#${String(id).padStart(4, '0')}`;
}

module.exports = { formatCurrency, formatDate, formatDateTime, formatCPF, formatCNPJ, formatPhone, formatOrderNumber };

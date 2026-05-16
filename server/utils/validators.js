/**
 * Validadores de dados
 */

/**
 * Valida CPF (formato e dígitos verificadores)
 */
function isValidCPF(cpf) {
    if (!cpf) return true; // CPF é opcional
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // Todos dígitos iguais

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;

    return true;
}

/**
 * Valida CNPJ (formato e dígitos verificadores)
 */
function isValidCNPJ(cnpj) {
    if (!cnpj) return true; // CNPJ é opcional
    cnpj = cnpj.replace(/[^\d]/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    let digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
}

/**
 * Valida código de barras EAN-13
 */
function isValidEAN13(barcode) {
    if (!barcode) return true;
    barcode = barcode.replace(/[^\d]/g, '');
    if (barcode.length !== 13) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12]);
}

/**
 * Valida email (formato básico)
 */
function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida telefone brasileiro
 */
function isValidPhone(phone) {
    if (!phone) return true;
    const cleaned = phone.replace(/[^\d]/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
}

module.exports = {
    isValidCPF,
    isValidCNPJ,
    isValidEAN13,
    isValidEmail,
    isValidPhone,
};

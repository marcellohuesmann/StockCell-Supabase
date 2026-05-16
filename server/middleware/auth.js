/**
 * Middleware de autenticação
 * Verifica se o usuário tem uma sessão ativa
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Sessão expirada. Faça login novamente.',
    });
}

/**
 * Middleware para verificar se é admin
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão de administrador necessária.',
    });
}

module.exports = { requireAuth, requireAdmin };

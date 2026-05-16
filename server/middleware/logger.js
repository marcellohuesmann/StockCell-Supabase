const { getDatabase } = require('../database/init');

/**
 * Middleware de log de atividades
 * Registra ações do usuário no banco
 */
function logActivity(action, entity = null, entityId = null, description = null) {
    return (req, res, next) => {
        // Registra após a resposta ser enviada
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const db = getDatabase();
                    db.prepare(`
                        INSERT INTO activity_log (user_id, action, entity, entity_id, description)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        req.session?.userId || null,
                        action,
                        entity,
                        entityId,
                        description || `${action} executado com sucesso`
                    );
                } catch (err) {
                    console.error('Erro ao registrar atividade:', err.message);
                }
            }
        });
        next();
    };
}

module.exports = { logActivity };

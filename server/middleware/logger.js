const supabase = require('../database/supabase');

/**
 * Middleware de log de atividades
 * Registra ações do usuário no banco
 */
function logActivity(action, entity = null, entityId = null, description = null) {
    return (req, res, next) => {
        // Registra após a resposta ser enviada
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await supabase.from('activity_log').insert({
                        user_id: req.session?.userId || null,
                        action,
                        entity,
                        entity_id: entityId,
                        description: description || `${action} executado com sucesso`
                    });
                } catch (err) {
                    console.error('Erro ao registrar atividade:', err.message);
                }
            }
        });
        next();
    };
}

module.exports = { logActivity };

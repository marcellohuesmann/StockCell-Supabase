const express = require('express');
const { getDatabase } = require('../database/init');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/logs
 * Retorna os logs de atividade
 */
router.get('/', requireAdmin, (req, res) => {
    try {
        const db = getDatabase();
        const { date, user_id, action } = req.query;
        let query = `
            SELECT l.*, u.username, u.full_name 
            FROM activity_log l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            query += " AND DATE(l.created_at) = ?";
            params.push(date);
        }
        if (user_id) {
            query += " AND l.user_id = ?";
            params.push(user_id);
        }
        if (action) {
            query += " AND l.action = ?";
            params.push(action);
        }

        query += " ORDER BY l.created_at DESC LIMIT 200";

        const logs = db.prepare(query).all(...params);
        res.json({ success: true, data: logs });
    } catch (e) {
        console.error('Logs Error:', e);
        res.status(500).json({ success: false, message: 'Erro ao buscar logs.' });
    }
});

module.exports = router;

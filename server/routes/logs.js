const express = require('express');
const supabase = require('../database/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/logs
 * Retorna os logs de atividade
 */
router.get('/', requireAdmin, async (req, res) => {
    try {
        const { date, user_id, action } = req.query;
        let query = supabase.from('activity_log').select('*, users(username, full_name)');
        
        if (date) {
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            query = query.gte('created_at', date).lt('created_at', nextDay.toISOString().split('T')[0]);
        }
        if (user_id) {
            query = query.eq('user_id', user_id);
        }
        if (action) {
            query = query.eq('action', action);
        }
        
        query = query.order('created_at', { ascending: false }).limit(200);

        const { data: logsRaw, error } = await query;
        if (error) throw error;
        
        const logs = (logsRaw || []).map(l => ({
            ...l,
            username: l.users?.username,
            full_name: l.users?.full_name
        }));
        
        res.json({ success: true, data: logs });
    } catch (e) {
        console.error('Logs Error:', e);
        res.status(500).json({ success: false, message: 'Erro ao buscar logs.' });
    }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcrypt');
const supabase = require('../database/supabase');

const router = express.Router();

/**
 * POST /api/auth/login
 * Autentica o usuário
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuário e senha são obrigatórios.',
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, password_hash, full_name, role, active')
            .eq('username', username.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário ou senha incorretos.',
            });
        }

        if (!user.active) {
            return res.status(403).json({
                success: false,
                message: 'Usuário desativado. Contate o administrador.',
            });
        }

        const passwordValid = bcrypt.compareSync(password, user.password_hash);

        if (!passwordValid) {
            // Registrar tentativa falha
            await supabase.from('activity_log').insert({
                user_id: user.id,
                action: 'login_failed',
                description: 'Tentativa de login com senha incorreta'
            });

            return res.status(401).json({
                success: false,
                message: 'Usuário ou senha incorretos.',
            });
        }

        // Cria sessão
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.fullName = user.full_name;
        req.session.role = user.role;

        // Registrar login bem-sucedido
        await supabase.from('activity_log').insert({
            user_id: user.id,
            action: 'login',
            description: 'Login realizado com sucesso'
        });

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor.',
        });
    }
});

/**
 * POST /api/auth/logout
 * Encerra a sessão do usuário
 */
router.post('/logout', async (req, res) => {
    const userId = req.session?.userId;

    if (userId) {
        try {
            await supabase.from('activity_log').insert({
                user_id: userId,
                action: 'logout',
                description: 'Logout realizado'
            });
        } catch (err) {
            // Silently fail - logout should always work
        }
    }

    req.session = null;
    res.json({
        success: true,
        message: 'Logout realizado com sucesso.',
    });
});

/**
 * GET /api/auth/session
 * Verifica se o usuário tem uma sessão ativa
 */
router.get('/session', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            success: true,
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                fullName: req.session.fullName,
                role: req.session.role,
            },
        });
    } else {
        res.json({
            success: true,
            authenticated: false,
        });
    }
});

/**
 * PUT /api/auth/password
 * Altera a senha do usuário logado
 */
router.put('/password', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({
                success: false,
                message: 'Não autenticado.',
            });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Senha atual e nova senha são obrigatórias.',
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'A nova senha deve ter pelo menos 6 caracteres.',
            });
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.session.userId)
            .single();

        if (userError || !user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
            return res.status(400).json({
                success: false,
                message: 'Senha atual incorreta.',
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 12);
        
        await supabase
            .from('users')
            .update({ 
                password_hash: newHash,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.session.userId);

        await supabase.from('activity_log').insert({
            user_id: req.session.userId,
            action: 'password_change',
            description: 'Senha alterada com sucesso'
        });

        res.json({
            success: true,
            message: 'Senha alterada com sucesso!',
        });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor.',
        });
    }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase } = require('../database/init');
const { logActivity } = require('../middleware/logger');

const router = express.Router();

/**
 * POST /api/auth/login
 * Autentica o usuário
 */
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Usuário e senha são obrigatórios.',
            });
        }

        const db = getDatabase();
        const user = db.prepare(
            'SELECT id, username, password_hash, full_name, role, active FROM users WHERE username = ?'
        ).get(username.toLowerCase().trim());

        if (!user) {
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
            db.prepare(`
                INSERT INTO activity_log (user_id, action, description)
                VALUES (?, 'login_failed', 'Tentativa de login com senha incorreta')
            `).run(user.id);

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
        db.prepare(`
            INSERT INTO activity_log (user_id, action, description)
            VALUES (?, 'login', 'Login realizado com sucesso')
        `).run(user.id);

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
router.post('/logout', (req, res) => {
    const userId = req.session?.userId;

    if (userId) {
        try {
            const db = getDatabase();
            db.prepare(`
                INSERT INTO activity_log (user_id, action, description)
                VALUES (?, 'logout', 'Logout realizado')
            `).run(userId);
        } catch (err) {
            // Silently fail - logout should always work
        }
    }

    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao encerrar sessão.',
            });
        }
        res.json({
            success: true,
            message: 'Logout realizado com sucesso.',
        });
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
router.put('/password', (req, res) => {
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

        const db = getDatabase();
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);

        if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
            return res.status(400).json({
                success: false,
                message: 'Senha atual incorreta.',
            });
        }

        const newHash = bcrypt.hashSync(newPassword, 12);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
            .run(newHash, req.session.userId);

        db.prepare(`
            INSERT INTO activity_log (user_id, action, description)
            VALUES (?, 'password_change', 'Senha alterada com sucesso')
        `).run(req.session.userId);

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

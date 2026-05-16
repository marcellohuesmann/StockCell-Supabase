const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * Executa backup do banco de dados SQLite.
 * Usa db.backup() do better-sqlite3 (cópia segura, não trava o DB).
 */
async function runBackup(db) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `stockcell-backup-${timestamp}.db`;

        // Backup local
        const localDest = path.join(config.backup.localPath, filename);
        await db.backup(localDest);
        console.log(`💾 Backup local criado: ${filename}`);

        // Backup OneDrive (se configurado)
        if (config.backup.onedrivePath) {
            try {
                if (!fs.existsSync(config.backup.onedrivePath)) {
                    fs.mkdirSync(config.backup.onedrivePath, { recursive: true });
                }
                const onedriveDest = path.join(config.backup.onedrivePath, filename);
                fs.copyFileSync(localDest, onedriveDest);
                console.log(`☁️  Backup OneDrive criado: ${filename}`);
            } catch (e) {
                console.warn('⚠️  Falha no backup OneDrive:', e.message);
            }
        }

        // Rotação: manter apenas os últimos N backups locais
        rotateBackups(config.backup.localPath, config.backup.maxLocalBackups);

        return { success: true, filename };
    } catch (error) {
        console.error('❌ Erro no backup:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Remove backups antigos, mantendo apenas os últimos N.
 */
function rotateBackups(dir, maxKeep) {
    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.startsWith('stockcell-backup-') && f.endsWith('.db'))
            .sort()
            .reverse();

        if (files.length > maxKeep) {
            const toDelete = files.slice(maxKeep);
            for (const file of toDelete) {
                fs.unlinkSync(path.join(dir, file));
                console.log(`🗑️  Backup antigo removido: ${file}`);
            }
        }
    } catch (e) {
        console.warn('⚠️  Erro na rotação de backups:', e.message);
    }
}

/**
 * Inicia scheduler de backup automático.
 */
function startBackupScheduler(db) {
    const intervalMs = config.backup.intervalHours * 60 * 60 * 1000;
    console.log(`⏰ Backup automático: a cada ${config.backup.intervalHours}h`);

    setInterval(() => {
        runBackup(db);
    }, intervalMs);

    // Primeiro backup 5 min após iniciar
    setTimeout(() => runBackup(db), 5 * 60 * 1000);
}

module.exports = { runBackup, startBackupScheduler };

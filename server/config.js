const path = require('path');
const os = require('os');

// Detecta pasta do OneDrive para backup
function getOneDrivePath() {
    const possiblePaths = [
        path.join(os.homedir(), 'OneDrive'),
        path.join(os.homedir(), 'OneDrive - Personal'),
        path.join(os.homedir(), 'OneDrive - Pessoal'),
    ];
    const fs = require('fs');
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const config = {
    // Servidor
    port: process.env.PORT || 3000,
    host: '0.0.0.0', // Aceita conexões de qualquer dispositivo na rede

    // Banco de dados
    dbPath: path.join(__dirname, '..', 'data', 'stockcell.db'),

    // Sessão
    session: {
        secret: 'stockcell-secret-key-2026-change-in-production',
        name: 'stockcell.sid',
        maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },

    // Backup
    backup: {
        localPath: path.join(__dirname, '..', 'data', 'backups'),
        onedrivePath: getOneDrivePath()
            ? path.join(getOneDrivePath(), 'StockCell_Backups')
            : null,
        intervalHours: 4, // Backup automático a cada 4 horas
        maxLocalBackups: 10, // Manter últimos 10 backups locais
    },

    // Upload de imagens de produtos
    uploads: {
        path: path.join(__dirname, '..', 'public', 'uploads'),
        maxSize: 5 * 1024 * 1024, // 5MB
    },

    // NF-e (preparado para futuro)
    nfe: {
        enabled: false,
        // Quando ativado, configurar:
        // certificadoPath: '',
        // certificadoSenha: '',
        // ambiente: 'homologacao', // ou 'producao'
        // uf: 'SP',
    },

    // Informações da loja (padrão, editável via settings)
    store: {
        name: 'StockCell',
        defaultAdmin: {
            username: 'admin',
            password: 'StockCell@2026',
            fullName: 'Administrador',
        },
    },
};

module.exports = config;

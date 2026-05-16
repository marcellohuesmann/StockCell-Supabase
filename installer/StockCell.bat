@echo off
title StockCell - Sistema de Gestao
cd /d "%~dp0"

REM Usa o Node.js embutido (IGNORA qualquer Node.js do sistema)
set "NODE_PATH=%~dp0node"
set "PATH=%NODE_PATH%;%PATH%"

REM Verifica se o node_modules existe, senao instala
if not exist "node_modules\better-sqlite3" (
    echo.
    echo ========================================
    echo   Instalando dependencias...
    echo   Aguarde, isso pode levar alguns minutos.
    echo ========================================
    echo.
    echo Node.js embutido:
    "%NODE_PATH%\node.exe" -e "console.log('  Versao: ' + process.version)"
    echo.
    echo Instalando pacotes...
    "%NODE_PATH%\node.exe" "%NODE_PATH%\node_modules\npm\bin\npm-cli.js" install --production
    if errorlevel 1 (
        echo.
        echo ERRO: Falha ao instalar dependencias.
        echo Tente executar como Administrador.
        pause
        exit /b 1
    )
    echo.
    echo Instalacao concluida!
    echo.
) else (
    REM Verifica se o modulo nativo e compativel com esta versao do Node
    "%NODE_PATH%\node.exe" -e "try{require('better-sqlite3');console.log('OK')}catch(e){process.exit(1)}" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ========================================
        echo   Reconstruindo modulos nativos...
        echo ========================================
        echo.
        "%NODE_PATH%\node.exe" "%NODE_PATH%\node_modules\npm\bin\npm-cli.js" rebuild better-sqlite3
        echo.
    )
)

echo.
echo ========================================
echo   Iniciando StockCell...
echo   Nao feche esta janela!
echo ========================================
echo.

"%NODE_PATH%\node.exe" server.js

pause

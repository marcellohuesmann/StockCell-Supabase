# Implementação Fase 4: Ferramenta de Migração PWA (Backup/Restore)

Este plano foi atualizado com base no feedback do usuário. Descreve o desenvolvimento da ferramenta para migração offline de dados entre um dispositivo móvel autônomo e um novo Servidor/PC através da transferência de um arquivo físico (JSON).

## Objetivo
Criar uma via segura para exportar 100% da base de dados do IndexedDB (PWA Offline) em formato JSON pelo celular, e uma rotina no backend do PC capaz de ingerir este arquivo, limpar a base atual e assumir os dados móveis, gerenciando conflitos de usuários de forma inteligente.

## Proposed Changes

### Frontend (Exportação no Celular)
Adicionar a capacidade de ler o IndexedDB e baixar um arquivo no celular.
- **`public/js/pages/settings.js`**:
  - Nova aba "Migração PWA" ou botão na área de configurações.
  - Botão **"Exportar Base Local (Download JSON)"**.
  - Chama `OfflineDB.getAll()` para todas as stores críticas e faz o download de um `.json`.

### Frontend (Restauração no PC)
- **Prompt de Backup Prévio**:
  - Ao selecionar o arquivo JSON para restaurar, o sistema exibirá uma mensagem perguntando: *"Deseja realizar um backup dos dados atuais do PC antes de prosseguir?"* com opções SIM e NÃO. Se sim, chama a rota de backup existente.

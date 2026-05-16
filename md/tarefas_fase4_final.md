# Tarefas: Fase 4 Final (Agilidade e Refinamentos)

- [x] **1. Busca Global (Ctrl+K)**
    - [x] Backend: Criar `server/routes/search.js` e expor `/api/search` em `server.js`
    - [x] Frontend: Adicionar listener global para `Ctrl+K` em `public/js/app.js`
    - [x] Frontend: Criar Modal customizado com campo de pesquisa debounced e exibição de resultados

- [x] **2. Código de Barras de Boleto**
    - [x] Banco de Dados: Adicionar coluna `barcode TEXT` via `init.js` nas transações
    - [x] Backend: Atualizar rotas `POST` e `PUT` de financeiro para capturar `barcode`
    - [x] Frontend: Inserir campo visual de código de barras no modal de Despesas

- [x] **3. Baixa Simplificada no Financeiro**
    - [x] Frontend: Inserir botão "✔️" inline na listagem (`finance.js`) para transações pendentes
    - [x] Frontend: Disparar modal de confirmação rápida chamando API de pagamento integral

- [x] **4. Anexos/Comprovantes nas Transações**
    - [x] Banco de Dados: Adicionar coluna `attachment_path TEXT` via `init.js`
    - [x] Backend: Configurar acesso estático `/uploads` e criar rota `POST` usando `multer` para upload
    - [x] Frontend: Adicionar seção de Anexos nos Detalhes da Transação com botões Upload/Visualizar

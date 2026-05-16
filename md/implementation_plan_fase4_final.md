# Plano de Implementação: Fase 4 Final (Agilidade e Refinamentos)

Este plano cobre a implementação simultânea das 4 últimas funcionalidades da Fase 4 solicitadas.

## 1. Busca Global (Ctrl+K)
**Objetivo:** Permitir busca instantânea de produtos, clientes e vendas de qualquer tela do sistema.
* **Backend:** Criação do arquivo `server/routes/search.js` e montagem no `server.js` na rota `/api/search`. Ele fará uma união de buscas em tabelas principais limitando os resultados por relevância.
* **Frontend:** No `public/js/app.js`, adicionar um ouvinte global para `Ctrl+K`. Ao disparar, abrirá um modal fixo com um campo de pesquisa em tempo real. Os resultados serão clicáveis, redirecionando o usuário para a aba e modal específicos.

## 2. Código de Barras de Boleto
**Objetivo:** Adicionar campo de código de barras nas contas a pagar.
* **Banco de Dados:** Migração no `init.js` para adicionar a coluna `barcode TEXT` na tabela `transactions`.
* **Backend:** Atualizar `routes/finance.js` (POST e PUT) para aceitar e salvar o campo `barcode`.
* **Frontend:** No modal de "Nova Transação" no Financeiro, adicionar campo "Código de Barras". Adicionar opção de copiar código de barras na visualização de detalhes.

## 3. Baixa Simplificada no Financeiro
**Objetivo:** Acelerar a rotina de baixar contas com um clique.
* **Frontend:** No `finance.js`, a lista de contas ganhará um pequeno botão circular "✔️" nas contas que estiverem `pending`.
* Ao clicar, abrirá um aviso rápido: *"Confirma a baixa total utilizando o Saldo do Caixa Principal?"* e fará a requisição direta para a API já existente de pagamentos.

## 4. Anexos/Comprovantes nas Transações
**Objetivo:** Guardar PDF de boletos ou imagens de recibos.
* **Banco de Dados:** Migração no `init.js` para adicionar a coluna `attachment_path TEXT` na tabela `transactions`.
* **Backend:** Em `server.js` habilitar acesso estático à pasta `/uploads/finance`. Em `routes/finance.js` criar a rota `POST /api/finance/transactions/:id/upload` usando a biblioteca `multer` para processamento seguro de imagens e PDFs.
* **Frontend:** Na tela de detalhes da transação (`finance.js`), existirá uma área "Anexo". Caso não exista arquivo, um botão de upload (via `<input type="file">`). Caso já exista, um botão de download/visualização do comprovante.

> [!IMPORTANT]
> **Modificações de Banco de Dados**
> Faremos as migrações (adicionando as 2 novas colunas) na inicialização sem apagar nada do que você já tem no sistema.

## Verificação do Plano
- Após a implementação, rodaremos testes manuais subindo um PDF pequeno e baixando uma conta via clique simples.
- Validação do atalho `Ctrl+K`.

Por favor, analise a proposta e, se estiver de acordo, confirme para executarmos as 4 frentes simultaneamente!

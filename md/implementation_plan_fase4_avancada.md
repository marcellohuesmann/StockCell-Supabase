# Plano de Implementação: Fase 4 Avançada

Este plano detalha como implementaremos as 4 novas funcionalidades solicitadas, seguindo exatamente a ordem proposta.

## 1. Transações Recorrentes (Despesas/Receitas Fixas)
**Objetivo:** Automatizar a geração de contas mensais (aluguel, conta de luz, mensalidades).

* **Banco de Dados (`schema.sql` e `init.js`):**
  * Criar tabela `recurring_transactions` (id, type, category_id, account_id, description, amount, day_of_month, last_generated_month, status).
* **Backend (`server.js` e `routes/finance.js`):**
  * Criar rotas CRUD para gerenciar as recorrências (`/api/finance/recurring`).
  * Criar uma rotina automática no servidor que roda na inicialização (e a cada 24h) verificando a tabela `recurring_transactions` e inserindo os registros do mês vigente na tabela `transactions` caso não existam.
* **Frontend (`finance.js`):**
  * Adicionar aba ou botão "Despesas/Receitas Fixas" na tela do Financeiro para gerenciar a tabela de recorrências.

---

## 2. Parcelamento A Prazo (Crediário)
**Objetivo:** Permitir que uma venda a prazo no PDV seja dividida em múltiplas parcelas, gerando vários vencimentos.

* **Backend (`routes/sales.js`):**
  * Adaptar o POST de vendas. Quando o método for `store_credit`, aceitar um array de parcelas ou os parâmetros `installments` e `interval_days`.
  * Inserir `N` registros na tabela `transactions` (Contas a Receber) com o mesmo `reference_id` da venda, mas com `due_date` correspondente a cada parcela (ex: 30, 60, 90 dias).
* **Frontend (`pdv.js` e `cashregister.css`):**
  * No modal de pagamento final da venda, se a opção for "A Prazo (Fiado)", abrir campos para "Quantidade de Parcelas".
  * Exibir uma prévia automática dos vencimentos na tela antes de confirmar a venda.

---

## 3. Pedidos de Compra
**Objetivo:** Formalizar pedidos junto aos fornecedores, dando entrada automática no estoque e gerando Contas a Pagar.

* **Banco de Dados:** As tabelas `purchase_orders` e `purchase_items` já existem no `schema.sql`.
* **Backend (`routes/purchases.js`):**
  * Criar as rotas de API para Pedidos de Compra (POST, GET, PUT).
  * Ao dar um PUT marcando o pedido como `received` (Recebido), o backend deverá:
    1. Dar entrada no estoque via `stock_movements`.
    2. (Opcional) Gerar uma transação de Despesa (`transactions`) se o pedido não foi pago à vista.
* **Frontend (`pages/stock.js` ou nova página `purchases.js`):**
  * Criar interface com duas abas no módulo de Estoque: "Visão Geral" e "Pedidos de Compra".
  * Formulário de criação de pedido selecionando o Fornecedor e os produtos/quantidades/custos.

---

## 4. Ferramenta de Migração PWA (Safety Net)
**Objetivo:** Garantir a recuperação e transferência manual de dados offline de dispositivos móveis para o servidor, contornando bloqueios rígidos de IP ou Firewall.

* **Frontend (`offline/sync.js` e `settings.js`):**
  * Adicionar botão em Configurações: "Exportar Dados PWA (Backup Manual)".
  * Ação do botão: Lê o IndexedDB (`pendingRequests`, `sales`, etc) e faz o download de um arquivo `stockcell-mobile-data.json`.
* **Backend (`routes/sync.js` ou `routes/settings.js`):**
  * Criar endpoint de importação (`/api/sync/import-pwa`).
  * Processará o JSON recebido, integrando as vendas pendentes e atualizando o banco central.

> [!IMPORTANT]
> **Revisão de Escopo:** Este é um grande pacote de atualizações. Para garantirmos a qualidade, a execução ocorrerá rigorosamente etapa por etapa. Primeiramente focaremos no backend e frontend das **Transações Recorrentes**. Assim que estiver testado e validado, passaremos ao **Parcelamento a Prazo**, e assim por diante.

# Checklist: Baixas Parciais

- [x] **1. Banco de Dados**
  - [x] Atualizar `schema.sql`: adicionar `paid_amount` na tabela `transactions`.
  - [x] Atualizar `schema.sql`: criar a tabela `transaction_payments`.
  - [x] Atualizar `init.js`: adicionar nova Migration para modificar as tabelas no DB existente.

- [x] **2. Backend API**
  - [x] Atualizar `GET /api/finance/summary` para usar `paid_amount` e o saldo devedor.
  - [x] Atualizar `PUT /api/finance/transactions/:id/pay` para suportar baixas parciais e gravar no DB.
  - [x] Atualizar `GET /api/finance/transactions` para retornar pagamentos associados.
  - [x] Atualizar `DELETE /api/finance/transactions/:id` para apagar os pagamentos vinculados (ON DELETE CASCADE ou via código).

- [x] **3. Sincronização Offline (PWA)**
  - [x] `public/js/offline/db.js`: Incrementar `DB_VERSION` para 4 e adicionar a store `transaction_payments`.
  - [x] `public/js/offline/api-offline.js`: Atualizar `_handleFinance` (sumário e listagem).
  - [x] `public/js/offline/api-offline.js`: Atualizar lógica do endpoint de `/pay` para inserir `transaction_payments` e atualizar `paid_amount`.
  - [x] `server/routes/sync.js`: Retornar `transaction_payments` em `pull-all` e atualizar `push-transaction` / novo `push-payment` se necessário.
  - [x] `public/js/offline/sync.js`: Fazer pull do `transaction_payments` e push de pagamentos pendentes.

- [x] **4. Frontend UI**
  - [x] Atualizar a tabela de listagem no `finance.js` para exibir "Valor Total" e "Saldo Devedor" + tag "Parcial".
  - [x] Atualizar o Modal de Pagamento (`modal-pay`) no `finance.js` para pedir o Valor Pago (preenchendo com o saldo restante por padrão).
  - [x] Ao clicar na linha, se houver histórico de pagamentos parciais, talvez mostrá-los em um alerta, ou pelo menos focar na baixa restante.

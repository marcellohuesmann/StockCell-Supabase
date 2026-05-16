# Plano de Implementação: Baixas Parciais (Fase 4)

Este plano detalha a arquitetura e as mudanças necessárias para permitir que contas a pagar/receber sejam quitadas parcialmente, gerando um histórico de pagamentos e mantendo saldos devedores (Baixas Parciais).

## User Review Required
> [!IMPORTANT]
> **Impacto na Interface e Processos**
> 1. O botão "Baixar Transação" passará a pedir o **Valor Pago**. Por padrão, ele virá preenchido com o saldo total restante.
> 2. O resumo do mês (KPIs superiores) considerará apenas o que *realmente foi pago* para a métrica "Recebido/Pago", e o *saldo devedor* para "A Receber/A Pagar".
> 3. Uma conta pode ter status: Pendente, Parcialmente Pago, ou Concluído.
> 
> Por favor, confirme se o fluxo esperado de informar o valor no momento da baixa faz sentido para a sua operação.

## Open Questions
> [!NOTE]
> Você gostaria que fosse possível *cancelar* uma baixa parcial específica que foi feita errada, ou no primeiro momento apenas a exclusão da transação inteira já resolve? (Para a versão inicial, sugiro mantermos a baixa definitiva, com exclusão possível apenas na transação pai).

## Proposed Changes

---

### Database Layer (SQLite)
Precisamos de uma nova tabela para rastrear cada pagamento individual e uma coluna para facilitar o cálculo.
#### [MODIFY] [schema.sql](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/server/database/schema.sql)
- Adicionar coluna `paid_amount REAL DEFAULT 0` na tabela `transactions`.
- Criar nova tabela `transaction_payments` com as colunas: `id`, `transaction_id`, `amount`, `payment_method`, `payment_date`, `created_at`.
#### [MODIFY] [init.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/server/database/init.js)
- Criar a migration correspondente para instâncias existentes: adicionar coluna `paid_amount` na `transactions` e criar a tabela `transaction_payments`. Atualizar `paid_amount` para igual a `amount` para transações que já estavam `completed`.

---

### Backend API
As rotas precisam manipular os múltiplos pagamentos e calcular métricas baseadas no valor pago vs. valor total.
#### [MODIFY] [finance.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/server/routes/finance.js)
- `GET /api/finance/summary`: Alterar o cálculo. 
  - `total_received` = `SUM(paid_amount)` (onde type = income).
  - `total_to_receive` = `SUM(amount - paid_amount)` (onde type = income).
- `PUT /api/finance/transactions/:id/pay`: Passar a receber o campo `amount`.
  - Inserir na tabela `transaction_payments`.
  - Atualizar a `transactions` somando o valor ao `paid_amount`.
  - Mudar o status para `partial` se `paid_amount < amount`, ou `completed` se quitado.

---

### Offline Sync Engine (PWA)
Para que você possa continuar dando baixas mesmo se o provedor de internet cair.
#### [MODIFY] [db.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/public/js/offline/db.js)
- Aumentar `DB_VERSION` para `4`.
- Adicionar store `transaction_payments`.
#### [MODIFY] [api-offline.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/public/js/offline/api-offline.js)
- Replicar a lógica de pagamento parcial na rota falsa `PUT /finance/transactions/:id/pay` offline.
#### [MODIFY] [sync.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/server/routes/sync.js) e [public/.../sync.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/public/js/offline/sync.js)
- Incluir sincronização da nova tabela `transaction_payments`.

---

### Frontend UI
A interface precisa refletir os saldos devedores e permitir a inserção de valor no modal de pagamento.
#### [MODIFY] [finance.js](file:///c:/Users/Marcello/OneDrive/HTML/Livro_Caixa/public/js/pages/finance.js)
- **Modal de Baixa (`modal-pay`)**: Adicionar o input de `Valor (R$)`.
- **`renderTable()`**: 
  - Atualizar o badge para mostrar "Parcial" se for o caso.
  - Exibir o valor total e, abaixo (menor), o `Saldo Devedor` se houver pagamentos parciais.
  - Ao abrir o modal de pagamento, calcular `amount - paid_amount` e preencher o input.

## Verification Plan

### Automated Tests
- Validar se a migration insere o `paid_amount` corretamente.

### Manual Verification
- Na interface Web:
  1. Criar uma conta de R$ 1.000.
  2. Pagar R$ 300 e verificar se o saldo muda para R$ 700 (e o status para Parcial).
  3. Pagar R$ 700 e verificar se o status vira Concluído.
  4. Checar os KPIs (cards superiores) para garantir que somaram R$ 300 em pago e R$ 700 a pagar.

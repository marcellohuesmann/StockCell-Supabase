# Walkthrough: Baixas Parciais

O recurso de **Baixas Parciais** foi totalmente implementado, permitindo que você controle contas que não são pagas integralmente de uma só vez.

## 🗄️ 1. Banco de Dados e Migrações
- Adicionamos a coluna `paid_amount` na tabela `transactions`. Isso significa que transações antigas que já estavam "concluídas" tiveram seu valor pago atualizado para ser igual ao valor total da conta, mantendo o histórico perfeito.
- Criamos a tabela `transaction_payments` para rastrear exatamente *quando*, *como* (Pix, Dinheiro, etc.) e *quanto* foi pago em cada baixa.

## ⚙️ 2. Motor Lógico (API e PWA Offline)
- **KPIs (Cards do Topo):** O sistema agora é mais inteligente. Se você tem uma conta de R$ 1.000 e pagou R$ 300, o card de "Total Pago" vai somar apenas R$ 300, e o card de "A Pagar" manterá o registro dos R$ 700 restantes.
- **Sincronização:** O IndexedDB do celular (PWA) foi atualizado para a Versão 4. Toda a matemática de saldo devedor e múltiplos pagamentos foi replicada no arquivo `api-offline.js`. Isso significa que se você for em um cliente sem internet e ele te der apenas R$ 50 de uma dívida de R$ 200, você pode dar a baixa parcial lá mesmo que o celular sincronizará perfeitamente depois.

## 🖥️ 3. Interface Visual
- **Badge Parcial:** Ao invés de ficar apenas como "Pendente" ou "Concluído", contas pagas pela metade agora ganham uma tag azul clara escrita **"Parcial"**.
- **Coluna de Valores:** Na listagem, abaixo do valor grandão da conta, aparecerá um texto menor em cinza dizendo: `Restante: R$ X,XX`, para você saber de bater o olho quanto falta para liquidar.
- **Modal Inteligente:** Quando você clicar em uma conta para dar baixa, o sistema calculará o "Saldo Devedor Restante" e já preencherá o input de Valor Pago automaticamente com esse saldo. Você pode pagar o valor sugerido (quitando a dívida) ou apagar e digitar um valor menor.

> [!TIP]
> **Teste Agora Mesmo!**
> Tente cadastrar uma "Venda a Prazo" ou uma Despesa de R$ 1000. Depois, dê uma baixa parcial de R$ 300. Você verá a tag mudar para "Parcial" e o saldo devedor apontar R$ 700!

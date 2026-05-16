# Plano de Implementação: Bipagem em Lote de IMEI no PDV

O objetivo desta melhoria é otimizar o fluxo do caixa para a venda de múltiplos aparelhos iguais, eliminando a necessidade de pesquisar o produto várias vezes.

## Fluxo Proposto

1. **Seleção de Quantidade**:
   - Ao bipar/buscar um produto rastreado no PDV, o Modal de Rastreamento será aberto.
   - O Modal conterá um campo **Quantidade**, pré-preenchido com `1` (podendo ir até o estoque atual).
   - Ao alterar a quantidade, o modal exibirá exatamente essa quantidade de campos de IMEI. (Ex: se colocar 3, aparecerão 3 campos de texto para bipar).

2. **Validação Visual em Tempo Real**:
   - Cada campo de IMEI, ao ser preenchido (ou "bipado", que aciona o `Enter`), fará uma requisição ao servidor para checar a disponibilidade.
   - **Verde**: O IMEI existe e está disponível.
   - **Vermelho**: O IMEI não existe, já foi vendido, ou está duplicado entre os campos.

3. **Confirmação em Lote**:
   - O botão "Validar e Adicionar" só permitirá prosseguir quando **todos** os campos exigidos estiverem verdes (validados com sucesso).
   - Ao confirmar, o PDV adicionará as 3 unidades ao carrinho de uma só vez (3 linhas distintas no carrinho, cada uma com seu IMEI correspondente).

## Modificações Necessárias

### `public/js/pages/pdv.js`
- **`promptForIMEI(product)`**:
  - Refatorar completamente o HTML interno do modal.
  - Adicionar listener para o input de `quantidade` para renderizar `N` inputs de IMEI.
  - Adicionar evento `input` ou `keydown (Enter)` em cada campo para disparar a função assíncrona de validação e mudar a cor da borda/fundo do input.
  - Retornar um array `[imei1, imei2, ...]` ao invés de uma única string.
- **`addToCart(product)`**:
  - Preparar para receber um *array de IMEIs* e realizar um loop, inserindo cada um deles na array `this.cart`.

## Questão em Aberto / Aprovação
Quando você digita "1" na quantidade e bipa o primeiro celular com o leitor USB, o leitor costuma enviar um comando de "Enter" no final. Nós precisamos garantir que esse "Enter" não feche o modal prematuramente, mas sim que pule para o próximo campo (se a quantidade for > 1) ou apenas valide a cor. **Você concorda que o botão final de confirmar deva ser clicado manualmente ou se todos os campos estiverem preenchidos e verdes ele já pode fechar sozinho?**

## Plano de Verificação
- Pesquisar um produto celular com estoque > 2.
- No modal, alterar a quantidade para 2.
- Bipar 1 IMEI válido e ver o input ficar verde.
- Digitar 1 IMEI inválido e ver o input ficar vermelho (e bloquear a confirmação).
- Corrigir o 2º IMEI para válido, clicar em Confirmar.
- Checar se 2 itens entraram no carrinho de forma separada.

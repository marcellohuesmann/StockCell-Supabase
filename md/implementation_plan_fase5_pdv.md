# Plano de Implementação: Fase 5 - Integração de Serial/IMEI no PDV

Este plano detalha como o sistema lidará com vendas de produtos que exigem rastreamento de Número de Série/IMEI (celulares, eletrônicos caros).

O objetivo é garantir que o operador do caixa (PDV) seja forçado a informar *qual* aparelho exato está sendo vendido.

## Mudanças Propostas

### 1. Frontend do PDV (`public/js/pages/pdv.js`)

**Fluxo de Adição ao Carrinho:**
- Quando um produto for selecionado (via busca ou leitor de código de barras), verificaremos a propriedade `track_serial`.
- **Se `track_serial = 0`:** O fluxo segue normal (adiciona ao carrinho com qtd = 1).
- **Se `track_serial = 1`:** 
  - O sistema abrirá imediatamente um **Modal Obrigatório** pedindo para bipar o Número de Série/IMEI do aparelho.
  - O operador bipa o IMEI.
  - O PDV fará uma requisição rápida `GET /api/products/:id/serials/:imei` para validar se aquele IMEI existe no estoque e está com status `available`.
  - Se estiver disponível, o produto entra no carrinho *amarrado* àquele IMEI específico. No carrinho aparecerá: `Nome do Produto (IMEI: 123456)`.

**Controle de Quantidade:**
- Produtos com IMEI atrelado não podem ter a quantidade alterada clicando no "+". Para vender 2 iPhones, o caixa precisará bipar o IMEI do 1º e depois bipar o IMEI do 2º (criando duas linhas separadas no carrinho).

### 2. Backend de Vendas (`server/routes/sales.js`)

**Endpoint de Finalização (`POST /api/sales`)**:
- Quando o payload da venda chegar, ele conterá a lista de itens. Se o item tiver um IMEI atrelado (`item.serial_number`), o backend deverá:
  1. Verificar a disponibilidade do IMEI novamente (prevenção de concorrência).
  2. Atualizar a tabela `product_serials` mudando o `status` daquele IMEI de `available` para `sold`.
  3. Vincular o IMEI vendido ao histórico da venda (pode ser no campo `notes` do `sale_items` ou criando uma coluna nova se necessário, mas o mais simples é registrar no histórico de movimentação).
  4. Diminuir o estoque principal como de costume.

## Aprovação de Layout e Fluxo
Quando um produto possui IMEI, ele será adicionado no carrinho como **1 linha por aparelho**. (Ex: Se vender 2 celulares iguais, aparecerão 2 linhas no carrinho, cada uma com seu IMEI). Isso facilita a emissão de nota/recibo depois com os seriais discriminados. Você aprova esse comportamento no momento da venda?

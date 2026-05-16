# Plano de Implementação: Fase 5 Inicial (Estoque Avançado & Assistência Técnica)

O objetivo desta fase é transformar o StockCell de um sistema de vendas padrão para uma plataforma profissional capaz de gerenciar serviços técnicos (O.S.) e rastreabilidade total de estoque (IMEI/Grades).

Devido à grande complexidade, faremos isso em etapas estruturadas.

## Parte 1: Gestão Avançada de Estoque

### 1.1. Grade de Produtos / Variações
**Objetivo:** Permitir que um mesmo produto tenha variações (Ex: Camiseta P/M/G ou Capinha iPhone Azul/Preta) sem precisar criar 10 produtos diferentes.
* **Banco de Dados:** Criação da tabela `product_variations` (id, product_id, attribute_name, attribute_value, barcode, additional_price, current_stock).
* **Backend:** Refatoração de `/api/products` para salvar e retornar variações.
* **Frontend:** No modal de produto, adicionar aba "Variações". No PDV, ao selecionar um produto com variações, abrir um popup rápido para escolher a cor/tamanho.

### 1.2. Controle de IMEI e Números de Série
**Objetivo:** Rastrear aparelhos ou peças caras individualmente, exigindo bipar o serial na venda e na entrada.
* **Banco de Dados:** Criação da tabela `product_serials` (id, product_id, serial_number, status, purchase_date, sale_id). Adição do campo `track_serial` (boolean) na tabela `products`.
* **Frontend:** Ao tentar vender um produto com `track_serial = true` no PDV, o sistema exigirá que o usuário escaneie o IMEI específico. Na tela de "Pedidos de Compra", exigirá a entrada dos IMEIs ao receber o estoque.

### 1.3. Múltiplos Locais de Estoque (Loja vs. Depósito)
* **Banco de Dados:** Tabela `stock_locations` (id, name, type). Tabela `stock_balances` (product_id, location_id, quantity).
* **UI:** Permitir transferências entre loja e depósito. O PDV sempre baixa da "Loja".

## Parte 2: Módulo de Assistência Técnica (O.S.)

Este é um módulo totalmente novo que ganhará um ícone próprio na barra de navegação lateral.

### 2.1. Criação e Gestão de O.S.
* **Banco de Dados:** Tabela `service_orders` (id, uuid, customer_id, device_info, defect_reported, device_password, technical_report, internal_notes, status, total_amount, created_at).
* **Frontend:** Nova página `os.js`. Listagem estilo Kanban (cartões arrastáveis) ou tabela com filtros de status: *Entrada, Orçamento, Aguardando Peça, Consertado, Entregue*. Modal complexo para criar O.S., coletando senha de desbloqueio, padrão de desenho e foto do aparelho (opcional).

### 2.2. Consumo Automático de Peças (Estoque)
* **Banco de Dados:** Tabela `os_items` (id, os_id, product_id, quantity, unit_price, is_service). Permite adicionar tanto *Serviços* (Mão de obra) quanto *Peças* (Telas, Baterias).
* **Lógica:** Ao mudar a O.S. para "Consertado" ou "Aprovado", o sistema reserva/baixa as peças do estoque, usando os movimentos de estoque com o motivo "Consumo Interno (O.S. #123)".

### 2.3. Aprovação Digital (Link de Orçamento)
* **Backend:** Criação de uma rota pública `/os/view/:uuid` (sem necessidade de login) para que o cliente acesse pelo celular dele.
* **Frontend:** Botão "Enviar pelo WhatsApp" que gera um texto formatado com o link mágico. Ao clicar no link, o cliente vê o laudo, o valor, e clica em "Aprovar Orçamento" ou "Recusar". Isso muda o status da O.S. automaticamente no painel da loja.

---

> [!IMPORTANT]
> **Estratégia de Execução (Ordem Proposta)**
> Para não sobrecarregar o sistema de uma vez e garantir que nada quebre:
> 1. Concluir as pendências visuais da Fase 4 (Ctrl+K, Boleto, Baixa Rápida).
> 2. Construir o Backend das Variações e IMEIs.
> 3. Atualizar o PDV para suportar Variações e IMEIs.
> 4. Criar o Módulo Base de O.S. (Tabelas e UI de Listagem/Criação).
> 5. Integrar Peças (Estoque) nas O.S. e Link de Aprovação.

Você aprova este roteiro para a Fase 5? Assim que confirmar, executarei primeiro a conclusão da Fase 4 e já emendarei no Banco de Dados da Fase 5!

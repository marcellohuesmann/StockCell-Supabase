# Plano de Implementação: Fase 5 - Gestão Avançada de Estoque (Frontend)

O backend das rotas de Produtos para gerenciar Grade/Variações (`product_variations`) e Seriais/IMEI (`product_serials`) já foi configurado e a estrutura do banco já está ativa. 

Neste plano, detalharei as alterações necessárias na interface (Frontend) para acomodar essas novas funcionalidades sem poluir a visão básica para quem não as utiliza.

## Mudanças Propostas

### 1. Refatoração do Modal de Produtos (`products.js`)
O modal de cadastro/edição de Produto atualmente é um longo formulário. Ele será transformado em um sistema de **Abas (Tabs)**.

#### Aba 1: Dados Básicos
- Conterá os campos originais (Nome, Código, Preço, etc).
- Dois novos seletores de configuração avançada:
  - `Tipo de Unidade`: "Unidade", "Kg", "Litro", etc.
  - `Rastrear Número de Série/IMEI`: Toggle (`[ ] Sim / [x] Não`).

#### Aba 2: Grade e Variações
Esta aba só estará disponível no modo "Editar" (após o produto existir no banco).
- Tabela listando as variações atuais (Ex: Cor Azul, Tamanho M).
- Formulário para adicionar nova variação:
  - `Nome do Atributo` (Ex: Cor)
  - `Valor` (Ex: Preto)
  - `Código de Barras Específico` (Opcional)
  - `Acréscimo de Preço` (Ex: R$ 5,00)
  - `Estoque da Variação`

#### Aba 3: Rastreador de IMEI / Serial
Esta aba só aparecerá se a configuração `Rastrear Número de Série/IMEI` estiver ativada na Aba 1.
- Tabela listando todos os seriais em estoque (Status: Disponível, Vendido, Defeito).
- Campo rápido para "Bipar" (scan) ou digitar e adicionar múltiplos Seriais rapidamente.
- Ao excluir um serial disponível, o estoque do produto será decrementado automaticamente.

### 2. Fluxo no PDV (`sales.js`) - (Será feito posteriormente)
Após a tela de Produtos estar funcionando, o próximo passo lógico (não coberto imediatamente neste plano, mas no próximo) será interceptar a adição de um produto no PDV:
- Se o produto tiver `track_serial = true`, o PDV abrirá um pop-up pedindo para bipar o Serial Exato que está sendo vendido, em vez de apenas incrementar a quantidade.

## Questão em Aberto / Aprovação
Transformar o Modal em Abas pode deixar o cadastro um clique "mais longe" para as informações avançadas, mas deixará a visualização muito mais limpa. Você concorda com essa divisão em 3 abas (Básico, Variações, IMEI)?

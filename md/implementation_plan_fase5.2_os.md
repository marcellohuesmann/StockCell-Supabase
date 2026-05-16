# Plano de Implementação: Fase 5.2 - Módulo de Assistência Técnica (O.S.)

Agora que a gestão avançada de estoque (IMEI e Variações) está 100% concluída, o próximo grande passo é a **Assistência Técnica**. Este módulo permitirá gerenciar consertos de aparelhos dos clientes, desde a entrada até a devolução e cobrança.

## 1. Banco de Dados (`schema.sql`)
Precisamos criar as tabelas fundamentais para gerenciar as Ordens de Serviço:
- **`service_orders`**: Guardará os dados principais (cliente, modelo do aparelho, IMEI do cliente, senha de tela, defeito relatado, laudo técnico, status, valor de peças e mão de obra).
- **`os_items`**: Guardará os itens adicionados ao orçamento da O.S. (podendo ser `produto` puxado direto do seu estoque ou `serviço` de mão de obra avulsa).

## 2. Backend (API - `server/routes/os.js`)
Criar o controlador completo para:
- Criar, Editar, Listar e Excluir Ordens de Serviço.
- Avançar o **Status** da O.S. (`Orçamento` -> `Aguardando Peça` -> `Aprovado` -> `Em Reparo` -> `Pronto` -> `Entregue`).
- Ao mudar para "Entregue", o sistema vai perguntar como foi o pagamento, e registrar a venda/receita no Livro Caixa/Financeiro automaticamente, e dar baixa nas peças utilizadas no estoque!

## 3. Frontend (`public/js/pages/os.js`)
Desenvolver a interface visual exclusiva para o módulo técnico:
- **Layout de Visualização**: Exibir as ordens abertas.
- **Formulário de O.S.**: Modal organizado (Dados do Aparelho, Problema, Orçamento de Peças/Serviços).
- **Integração de Estoque**: Dentro da O.S., ao adicionar uma peça, ele vai puxar do seu cadastro de Produtos (e reservar do estoque).
- **Comprovante (Termo de Entrada)**: Geração de um recibo simples formatado para impressora térmica contendo o termo de responsabilidade para o cliente assinar ao deixar o aparelho.

## Questão em Aberto / Aprovação
Para a tela inicial de Assistência Técnica, como você prefere visualizar os consertos abertos?
- **Opção A:** Em formato de **Lista/Tabela** (igual à tela de produtos, com paginação e barra de busca).
- **Opção B:** Em formato **Kanban** (quadros com colunas visuais: *Orçamentando*, *Em Reparo*, *Pronto*, onde você pode arrastar os cartões ou ver o volume de trabalho claramente).

## Plano de Execução
1. Atualizar o `schema.sql` e banco de dados.
2. Criar a rota no backend `os.js` e registrar no `server.js`.
3. Criar a interface básica (Tabela ou Kanban) no frontend e vincular ao menu principal.
4. Desenvolver o Modal de Nova O.S. e Testar.

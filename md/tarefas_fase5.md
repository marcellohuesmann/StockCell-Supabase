# Tarefas: Fase 5 (Gestão Avançada de Estoque e Assistência Técnica O.S.)

## 1. Gestão Avançada de Estoque
- [x] **Banco de Dados**
    - [x] Criar tabelas `product_variations` e `product_serials` via `schema.sql`
    - [x] Adicionar colunas `unit_type` e `track_serial` em `products` via `init.js`
- [x] **Backend (API)**
    - [x] Criar rotas para gerenciar variações (`/api/products/:id/variations`)
    - [x] Criar rotas para gerenciar seriais/IMEI (`/api/products/:id/serials`)
    - [x] Ajustar rota de Venda (`POST /api/sales`) para dar baixa em seriais específicos
- [x] **Frontend (Produtos)**
    - [x] Atualizar Modal de Produto para ter abas ("Básico", "Variações", "Rastreabilidade/IMEI")
    - [x] Interface para cadastrar/editar grade (Cores, Tamanhos)
    - [x] Interface para listar e bipar IMEIs/Seriais no estoque
- [x] **Frontend (PDV)**
    - [x] Ajustar PDV para solicitar escolha do Serial/IMEI caso o produto tenha `track_serial` ativado

## 2. Módulo de Assistência Técnica (O.S.)
- [x] **Banco de Dados**
    - [x] Criar tabelas `service_orders` e `os_items` via `schema.sql`
- [ ] **Backend (API)**
    - [ ] Criar rotas CRUD para `service_orders` em `server/routes/os.js` (incluindo status pipeline)
    - [ ] Integração com Financeiro (quando O.S. for "Entregue" e paga)
- [ ] **Frontend (O.S.)**
    - [ ] Criar `public/js/pages/os.js` com Kanban/Lista de O.S. (Orçamentando, Aguardando Peça, Aprovado, Em Reparo, Pronto)
    - [ ] Modal completo de O.S. (Cliente, Aparelho, Defeito Relatado, Laudo Técnico, Peças/Serviços, Senha do Aparelho)
    - [ ] Impressão de Comprovante de Entrada (Termo de responsabilidade)
    - [ ] Link Público / Geração de texto WhatsApp para aprovação de orçamento
- [ ] **Integração no App**
    - [ ] Adicionar botão de "Assistência Técnica" na Sidebar e Bottom Nav
    - [ ] Exibir atalhos de O.S. no Dashboard (Quantas prontas, quantas na bancada)

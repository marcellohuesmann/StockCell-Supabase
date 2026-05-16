# Guia de Comandos - StockCell

Esta tabela reúne os principais comandos e atalhos utilizados para rodar, parar, compilar e gerenciar a aplicação StockCell no ambiente Windows.

| Ação | Comando / Caminho | Descrição |
| :--- | :--- | :--- |
| **Iniciar Aplicação (Desenvolvimento)** | `npm run dev` | Inicia o servidor Node com *watch*. Qualquer alteração no código reiniciará o servidor automaticamente. Ideal para programar. |
| **Iniciar Aplicação (Produção/Padrão)** | `npm start` ou `node server.js` | Inicia a aplicação normalmente, travando o terminal até que seja fechado. |
| **Iniciar Minimizado (Sem janela CMD)** | Duplo clique em `StockCellMinimized.vbs` | Inicia o servidor oculto em segundo plano. É a forma como o cliente final inicia o sistema. |
| **Parar a Aplicação (Modo Terminal)** | `Ctrl + C` | Pressionar Ctrl+C no terminal onde o `npm start` ou `npm run dev` está rodando para encerrar o processo. |
| **Parar a Aplicação (Modo Minimizado)** | Duplo clique em `StopStockCell.bat` | Fecha forçadamente todos os processos `node.exe` em execução no sistema. Usado para desligar o servidor que roda escondido. |
| **Compilar Instalador (.exe)** | Compilar via Inno Setup | Abra o arquivo `installer/stockcell.iss` no Inno Setup Compiler e clique no botão de **Run (F9)** ou **Compile (Ctrl+F9)**. O arquivo `.exe` gerado ficará na pasta `installer/output/`. |
| **Acessar Banco de Dados** | `C:\StockCell\data\stockcell.db` | Caminho do arquivo de banco de dados SQLite oficial onde os dados do usuário ficam salvos, garantindo que não sejam perdidos na atualização. |
| **Acessar a Aplicação (Local)** | `http://localhost:3000` | URL para abrir o sistema no navegador da máquina servidora. |
| **Acessar a Aplicação (Rede WiFi)** | `http://[IP-DA-MÁQUINA]:3000` | URL para abrir o sistema no celular ou em outro computador conectado no mesmo roteador (ex: `http://192.168.0.15:3000`). |

> [!TIP]
> **Dica para Atualizações:** Sempre que fizer alterações cruciais no sistema e gerar um novo instalador (`.exe`), lembre-se de alterar o número da versão no arquivo `package.json`, no `public/service-worker.js` e na primeira linha do `installer/stockcell.iss`.

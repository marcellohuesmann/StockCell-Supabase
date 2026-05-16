# Regras e Conceitos de Rede do StockCell

Este documento define os princípios arquiteturais do StockCell PWA, para garantir que as expectativas e os comportamentos do sistema sejam padronizados.

## 1. O Conceito de "Estar Online"
- Ter acesso à internet (4G, 5G ou Wi-Fi externo) **não significa** estar online para o sistema.
- Para este projeto, **estar "online" significa obrigatoriamente ter acesso à rede local onde o Servidor/PC está rodando**. 
- Se o dispositivo consegue navegar na web mas não consegue pingar o IP do Servidor do StockCell, ele deve ser considerado **Offline**.

## 2. PWA e Modo Offline
- Como o sistema atua primariamente numa rede LAN via IP (ex: 192.168.x.x), o navegador sempre acusará `navigator.onLine = true` se houver 4G. 
- Por isso, o sistema StockCell não deve confiar em eventos nativos do navegador, e sim no seu próprio controle de estabilidade (`window.serverIsReachable`), validando ativamente a comunicação com o PC via "heartbeats" ou verificações de timeout em requisições críticas.

## 3. Tolerância de Espera
- Nunca travar a aplicação esperando um servidor inatingível. Se o app for aberto via rede 4G, ele deve abortar a tentativa de comunicação rapidamente (ex: 3 segundos) e liberar o uso offline/login offline, evitando telas de carregamento infinitas.

# Diagramas de arquitetura e dados

Projeto: **Flesh to Chrome** — especificação da Sprint 1.

Fonte única: [`../diagramas.json`](../diagramas.json). Mermaid e SVG abaixo são gerados por `python3 isn/scripts/gerar_diagramas.py` a partir da raiz do repositório. Não editar as versões geradas separadamente.

Os diagramas descrevem o sistema planejado, não comprovam implementação. Propostas e decisões pendentes têm rótulo Dxx e/ou traço pontilhado; ver [registro de decisões](07-decisoes-pendentes.md).

## 1. AWS — microsserviços e serviços gerenciados

Arquitetura de referência: implantação e dados próprios para Conta, Campanha, Partidas, Comunicações e Auditoria. Blocos com múltiplas tabelas são agrupamentos visuais, não banco compartilhado entre serviços. Cada domínio acessa apenas seus dados. Tempo real é candidato D04. Conta AWS ainda não criada; Free Tier e orçamento no documento 12. Route 53 resolve nomes para os destinos; suas setas são registros DNS, não passagem de tráfego HTTP. ACM fornece certificados. api.* e ws.* são nomes propostos (D08/D04); detalhes e custos no documento 12, seção 3.1. Documento 13 recomenda WSS para o protótipo; API Gateway/Lambda segue em validação. Heartbeat não estende o limite de 2 h; renovar no lobby. D03/D07 aprovadas: salas privadas por código/link, central de notificações e feedback SES/SNS/SQS no documento 14. Compra notifica apenas no jogo, sem e-mail.

```mermaid
flowchart TD
  browser["Navegador Phaser + teclado/gamepad"]
  s3["S3 privado: frontend e assets"]
  google["Google: identidade externa"]
  cdn["CloudFront: CDN"]
  cognito["Cognito Lite: login social"]
  http["API Gateway HTTP + JWT"]
  ws["API Gateway WSS: protótipo — D04"]
  account["Lambda Conta"]
  campaign["Lambda Campanha"]
  match["Lambdas Partidas"]
  accountdb["DynamoDB accounts + outbox"]
  savedb["DynamoDB campaigns + outbox"]
  matchdb["DynamoDB matches + outbox"]
  events["Streams + publicadores por domínio"]
  auditq["SQS Auditoria + DLQ"]
  comq["SQS Comunicações + DLQ"]
  audit["Lambda Auditoria"]
  com["Lambda Comunicações"]
  auditdb["DynamoDB audit"]
  comdb["DynamoDB communications"]
  ses["SES: e-mail transacional"]
  ops["CloudWatch + IAM + Pulumi/CI"]
  dns["Route 53: DNS público do domínio"]
  acm["ACM: certificados HTTPS"]
  browser -->|"carrega jogo"| cdn
  cdn -->|"origem privada"| s3
  browser -->|"login"| cognito
  cognito -->|"federação"| google
  browser -->|"REST / JWT"| http
  browser -.->|"tempo real"| ws
  http -->|"/me, /auth"| account
  http -->|"/me/campaign"| campaign
  http -->|"/matches"| match
  ws -.->|"mensagens"| match
  account --> accountdb
  campaign --> savedb
  match --> matchdb
  accountdb -->|"outbox"| events
  savedb -->|"outbox"| events
  matchdb -->|"outbox"| events
  events -->|"eventos críticos"| auditq
  events -->|"gatilhos"| comq
  auditq --> audit
  comq --> com
  audit --> auditdb
  com --> comdb
  com -->|"envio"| ses
  http -->|"consulta própria"| audit
  http -->|"notificações"| com
  browser -->|"resolução DNS"| dns
  dns -->|"Alias do site"| cdn
  dns -->|"Alias api.* proposto"| http
  dns -.->|"ws.* se adotado"| ws
  acm -->|"TLS / us-east-1"| cdn
  acm -->|"TLS regional"| http
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class ws pending
```

![AWS — microsserviços e serviços gerenciados](../imagens/diagrama-aws-microsservicos.svg)

## 2. AWS — eventos, auditoria e notificações

Fluxo proposto por serviço produtor: mudança e outbox na mesma transação. Streams ativa publicador; SQS e consumidores permitem retentativas. Destinos deduplicam eventId; falhas repetidas vão para DLQ. Outbox preservada permite reconciliar publicação perdida. SES não bloqueia save e Streams não substitui armazenamento permanente. D07 aprovada no documento 14 define categorias/preferências e feedback de entrega SES via SNS/SQS, detalhado no fluxo de comunicações.

```mermaid
flowchart TD
  request["Operação crítica validada"]
  domain["Lambda do domínio produtor"]
  db["DynamoDB próprio: estado + outbox"]
  reply["Responder após transação durável"]
  stream["DynamoDB Streams"]
  pub["Publicador Lambda do domínio"]
  auditq["SQS Auditoria"]
  comq["SQS Comunicações"]
  audit["Consumidor Auditoria"]
  com["Consumidor Comunicações"]
  auditdb["DynamoDB audit: eventId único"]
  comdb["DynamoDB communications: notificação e entrega"]
  dlqa["DLQ Auditoria: alarme e reprocessamento"]
  dlqc["DLQ Comunicações: alarme e reprocessamento"]
  ses["SES: envio por evento"]
  recover["Reconciliação da outbox pendente"]
  request --> domain
  domain -->|"transação"| db
  db --> reply
  db --> stream
  stream --> pub
  pub --> auditq
  pub -->|"se houver gatilho"| comq
  pub -->|"confirmar publicação"| db
  auditq --> audit
  comq --> com
  audit -->|"idempotente"| auditdb
  com -->|"idempotente"| comdb
  com -->|"envio controlado"| ses
  auditq -->|"tentativas esgotadas"| dlqa
  comq -->|"tentativas esgotadas"| dlqc
  recover -->|"republicar eventId"| pub
```

![AWS — eventos, auditoria e notificações](../imagens/diagrama-aws-eventos.svg)

## 3. Visão geral — jogo, serviços e nuvem

Visão de contexto; detalhamento físico nos diagramas AWS. Conta, Campanha, Partidas, Auditoria e Comunicações são microsserviços independentes em Lambda, com tabelas DynamoDB próprias. S3/CloudFront entregam o jogo; Cognito/Google autenticam. Sincronização multiplayer continua sujeita à prova D04. D06: visitante joga somente na sessão, sem save persistente; login permite vincular progresso à conta conforme D05, sem histórico retroativo.

```mermaid
flowchart TD
  teclado["Teclado"]
  pad["Gamepad físico — D01"]
  static["S3 + CloudFront: frontend"]
  input["Ações de entrada comuns"]
  browser["Navegador: Phaser"]
  api["Microsserviços via HTTP API"]
  local["Estado visitante: sessão / cache: conta autenticada"]
  multi["Multiplayer: salas e resultados"]
  db["DynamoDB: tabelas por serviço"]
  google["Cognito + Google"]
  notify["Comunicações + SES"]
  audit["Auditoria persistente"]
  teclado --> input
  pad -.->|"mesmas ações"| input
  input --> browser
  browser -->|"carrega"| static
  browser -->|"HTTPS"| api
  browser -->|"estado / cache"| local
  browser -.->|"tempo real"| multi
  api --> db
  api -->|"autenticação"| google
  api -->|"eventos"| notify
  api -->|"operações críticas"| audit
  api -->|"salas / consulta"| multi
  multi -->|"grava resultado"| db
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class pad pending
```

![Visão geral — jogo, serviços e nuvem](../imagens/diagrama-visao-geral.svg)

## 4. Microsserviços do backend e seus dados

Cada serviço tem Lambda(s), IAM role, pacote e tabela próprios, com implantação independente. As conexões de eventos representam outbox/publicação por filas, detalhadas no diagrama AWS de eventos. Não há leitura direta da tabela de outro serviço. Identidade e e-mail são terceirizados para Cognito/Google e SES. Se a loja for implementada, Campanha também mantém aquisições por conta em itens separados do save; débito/desbloqueio/outbox consistentes, sem acesso à tabela Conta (D11; documentos 08/09).

```mermaid
flowchart TD
  api["API Gateway: rotas REST"]
  auth["Conta / Lambda"]
  save["Campanha / Lambda"]
  match["Partidas / Lambdas"]
  accounts["DynamoDB accounts"]
  saves["DynamoDB campaigns"]
  matches["DynamoDB matches"]
  events["Outbox / eventos duráveis"]
  audit["Auditoria / Lambda"]
  notify["Comunicações / Lambda"]
  logs["DynamoDB audit"]
  messages["DynamoDB communications"]
  cognito["Cognito + Google"]
  ses["Amazon SES"]
  api --> auth
  api --> save
  api --> match
  auth --> cognito
  auth --> accounts
  save --> saves
  match --> matches
  accounts --> events
  saves --> events
  matches --> events
  events -->|"SQS"| audit
  events -->|"SQS"| notify
  audit --> logs
  notify --> messages
  notify --> ses
  api -->|"consulta"| audit
  api -->|"notificações"| notify
```

![Microsserviços do backend e seus dados](../imagens/diagrama-modulos-backend.svg)

## 5. Ambientes e implantação

Pulumi mantém base e serviços independentes por ambiente. Dev local é padrão; dev em nuvem é temporário e isolado de produção. AWS gerenciada/Lambda/DynamoDB são a base; conta ainda não criada, com elegibilidade, capacidade e orçamento em D08. Não provisionar compute ocioso como requisito de microsserviços. Base DNS/HTTPS compartilhada via Route 53 e ACM; subdomínios de dev não exigem nova zona pública.

```mermaid
flowchart TD
  git["Repositório Git"]
  dev["Desenvolvimento local"]
  ci["CI: validação e build"]
  iac["Pulumi / stacks isoladas"]
  devcloud["Dev em nuvem — se utilizado"]
  prod["Produção AWS"]
  devdb["Dados e credenciais de dev"]
  domain["nihil-legere-possum.lat"]
  proddb["Dados e credenciais de prod"]
  dns["Route 53 + ACM: nomes e HTTPS"]
  git --> dev
  git -->|"branch de deploy"| ci
  ci -->|"checks aprovados"| iac
  iac -.->|"D08"| devcloud
  iac -->|"publicação automática"| prod
  devcloud -.->|"isolamento"| devdb
  prod --> domain
  prod --> proddb
  iac -->|"configuração via IaC"| dns
  dns -->|"domínio público"| domain
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class devcloud pending
```

![Ambientes e implantação](../imagens/diagrama-ambientes.svg)

## 6. Entrada por teclado e gamepad físico

Controle físico confirmado. D01 cobre botões, compatibilidade e vários controles. D02 aprovada: desconexão pausa campanha com retomada explícita pelo controle/teclado; multiplayer segue sem pausa e com aviso. Teclado e gamepad usam as mesmas restrições do gameplay; não existe celular remoto neste desenho.

```mermaid
flowchart TD
  keyboard["Teclado"]
  pad["Controle físico"]
  detect["Detecção/adaptação — D01"]
  actions["Ações comuns: pular, slide, ataque, scan, dash, menus"]
  rules["Implantes, cooldowns e bloqueios"]
  localgame["Campanha / simulação local"]
  netgame["Multiplayer: entrada para sincronização — D04"]
  menu["Menu: confirmar, voltar e navegar"]
  keyboard --> actions
  pad --> detect
  detect -.->|"mapeamento pendente"| actions
  actions --> rules
  actions --> menu
  rules --> localgame
  rules -.->|"mesmas ações"| netgame
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class detect,netgame pending
```

![Entrada por teclado e gamepad físico](../imagens/diagrama-entrada.svg)

## 7. Multiplayer — salas, sincronização e resultado

Dois navegadores com jogadores autenticados, criação/entrada em sala e resultado/classificação persistidos. D03 aprovada: código/link privado, convite de 10 min, uma partida ativa por conta, reserva atômica da segunda vaga e histórico privado de 30 dias. Cancelar sala se alguém sair antes da largada. Não há ranking global nem busca pública inicial. API Gateway HTTP, Lambda Partidas e DynamoDB próprio atendem salas/resultados. WSS é recomendado para o protótipo; API Gateway/Lambda, autoridade, presença e prazos de rede seguem em D04. Renovar conexão no lobby; não retomar corrida após derrota. Ver documentos 12–14.

```mermaid
flowchart TD
  p1["Jogador 1 autenticado: teclado/gamepad"]
  p2["Jogador 2 autenticado: teclado/gamepad"]
  c1["Cliente 1 / Phaser"]
  c2["Cliente 2 / Phaser"]
  rest["REST: salas, entrada e prontidão"]
  realtime["API Gateway WSS: protótipo — D04"]
  authority["Lambda Partidas: validação — D04"]
  events["Auditoria: entrada, saída e resultado"]
  history["DynamoDB matches: resultado"]
  presence["Partidas: presença e prazos — D04"]
  p1 --> c1
  p2 --> c2
  c1 -->|"HTTPS / sessão"| rest
  c2 -->|"HTTPS / sessão"| rest
  c1 -.->|"ações/estado"| realtime
  c2 -.->|"ações/estado"| realtime
  rest -.->|"participantes"| authority
  realtime -.->|"sincronização"| authority
  authority --> events
  authority -->|"gravação no backend"| history
  realtime -.->|"sinais / queda"| presence
  presence -.->|"avalia queda"| authority
  authority -.->|"estado / resultado"| realtime
  realtime -.->|"entrega"| c1
  realtime -.->|"entrega"| c2
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class realtime,authority,presence pending
```

![Multiplayer — salas, sincronização e resultado](../imagens/diagrama-multiplayer.svg)

## 8. Modelo lógico — cardinalidades e separação de dados

Detalhes no documento 08. D05 aprova isolamento por conta. D10 separa memória pendente e consolidada pela retirada. D11 aprova aquisições cosméticas por conta, independentes de campanha/snapshot/reset; loja continua opcional. Proposta física: itens de aquisições separados na tabela do serviço Campanha, para débito/desbloqueio/outbox consistentes. D03/D07 aprovadas: histórico privado e central por conta, ambos com 30 dias de exibição; deduplicação tem retenção própria. Implementação da loja permanece opcional. Compra não gera entrega de e-mail. D06: Campanha persistente pertence apenas à conta autenticada; visitante não gera registro e perde progresso ao fechar/recarregar. Importação registra estado atual, sem histórico retroativo.

```mermaid
flowchart TD
  user["Usuário"]
  campaign["Campanha ativa"]
  notice["Notificação no jogo"]
  email["Entrega de e-mail"]
  snapshot["Snapshot pré-Portão"]
  audit["Evento de auditoria"]
  participant["Participante autenticado"]
  state["Estado: créditos, implantes, memórias pendentes/consolidadas, retry e final"]
  skin["Cosmético da conta — loja opcional"]
  match["Partida / resultado e classificação"]
  user -->|"1 : 0..1"| campaign
  user -->|"1 : N"| notice
  user -->|"1 : N"| email
  campaign -->|"1 : 0..1"| snapshot
  campaign -->|"contém"| state
  user -->|"1 : N"| audit
  user -->|"1 : N"| participant
  match -->|"2 prontos para iniciar"| participant
  user -.->|"1 : N opcional"| skin
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class skin pending
```

![Modelo lógico — cardinalidades e separação de dados](../imagens/diagrama-dados.svg)

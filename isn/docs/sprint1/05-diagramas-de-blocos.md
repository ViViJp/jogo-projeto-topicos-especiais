# Diagramas de arquitetura e dados

Projeto: **Flesh to Chrome** — especificação da Sprint 1.

Fonte única: [`../diagramas.json`](../diagramas.json). Mermaid e SVG abaixo são gerados por `python3 isn/scripts/gerar_diagramas.py` a partir da raiz do repositório. Não editar as versões geradas separadamente.

Os diagramas descrevem o sistema planejado, não comprovam implementação. Propostas e decisões pendentes têm rótulo Dxx e/ou traço pontilhado; ver [registro de decisões](07-decisoes-pendentes.md).

## 1. AWS — microsserviços e serviços gerenciados

Arquitetura de referência: implantação e dados próprios para Conta, Campanha, Partidas, Comunicações e Auditoria. Blocos com múltiplas tabelas são agrupamentos visuais, não banco compartilhado entre serviços. Cada domínio acessa apenas seus dados. Tempo real é candidato D04. Conta AWS ainda não criada; Free Tier e orçamento no documento 12. Route 53 resolve nomes para os destinos; suas setas são registros DNS, não passagem de tráfego HTTP. ACM fornece certificados. api.* e ws.* são nomes propostos (D08/D04); detalhes e custos no documento 12, seção 3.1.

```mermaid
flowchart TD
  browser["Navegador Phaser + teclado/gamepad"]
  s3["S3 privado: frontend e assets"]
  google["Google: identidade externa"]
  cdn["CloudFront: CDN"]
  cognito["Cognito Lite: login social"]
  http["API Gateway HTTP + JWT"]
  ws["API Gateway WebSocket — D04"]
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

Fluxo proposto por serviço produtor: mudança e outbox na mesma transação. Streams ativa publicador; SQS e consumidores permitem retentativas. Destinos deduplicam eventId; falhas repetidas vão para DLQ. Outbox preservada permite reconciliar publicação perdida. SES não bloqueia save e Streams não substitui armazenamento permanente.

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

Visão de contexto; detalhamento físico nos diagramas AWS. Conta, Campanha, Partidas, Auditoria e Comunicações são microsserviços independentes em Lambda, com tabelas DynamoDB próprias. S3/CloudFront entregam o jogo; Cognito/Google autenticam. Sincronização multiplayer continua sujeita à prova D04.

```mermaid
flowchart TD
  teclado["Teclado"]
  pad["Gamepad físico — D01/D02"]
  static["S3 + CloudFront: frontend"]
  input["Ações de entrada comuns"]
  browser["Navegador: Phaser"]
  api["Microsserviços via HTTP API"]
  local["Save local / localStorage"]
  multi["Multiplayer: salas e resultados"]
  db["DynamoDB: tabelas por serviço"]
  google["Cognito + Google"]
  notify["Comunicações + SES — D07"]
  audit["Auditoria persistente"]
  teclado --> input
  pad -.->|"mesmas ações"| input
  input --> browser
  browser -->|"carrega"| static
  browser -->|"HTTPS"| api
  browser -->|"save local"| local
  browser -.->|"tempo real"| multi
  api --> db
  api -->|"autenticação"| google
  api -.->|"eventos"| notify
  api -->|"operações críticas"| audit
  api -->|"salas / consulta"| multi
  multi -->|"grava resultado"| db
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class pad,notify pending
```

![Visão geral — jogo, serviços e nuvem](../imagens/diagrama-visao-geral.svg)

## 4. Microsserviços do backend e seus dados

Cada serviço tem Lambda(s), IAM role, pacote e tabela próprios, com implantação independente. As conexões de eventos representam outbox/publicação por filas, detalhadas no diagrama AWS de eventos. Não há leitura direta da tabela de outro serviço. Identidade e e-mail são terceirizados para Cognito/Google e SES.

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

Pulumi mantém base e serviços independentes por ambiente. Dev local é padrão; dev em nuvem é temporário e isolado de produção. AWS gerenciada/Lambda/DynamoDB são a base; conta ainda não criada, com elegibilidade, capacidade e orçamento em D08/D09. Não provisionar compute ocioso como requisito de microsserviços. Base DNS/HTTPS compartilhada via Route 53 e ACM; subdomínios de dev não exigem nova zona pública.

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

Controle físico é escopo confirmado. Botões, compatibilidade, vários controles e desconexão estão em D01/D02. Não existe celular remoto neste desenho. Teclado continua disponível e ambos usam as mesmas restrições do gameplay.

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

ZIP RF22/RF23 e UC09 confirmam dois jogadores autenticados, criação/entrada em sala e resultado/classificação da corrida gravados. Dois navegadores são a topologia proposta. D03 ainda cobre descoberta/compartilhamento da sala e visibilidade/retenção; D04 cobre protocolo e autoridade. Ranking global não está definido. Implementação de referência: API Gateway HTTP para salas, Lambda Partidas e DynamoDB próprio para resultados. API Gateway WebSocket é candidato a validar em custo/latência; não enviar cada frame como save/auditoria. Ver documento 12.

```mermaid
flowchart TD
  p1["Jogador 1 autenticado: teclado/gamepad"]
  p2["Jogador 2 autenticado: teclado/gamepad"]
  c1["Cliente 1 / Phaser"]
  c2["Cliente 2 / Phaser"]
  rest["REST: salas, entrada e prontidão"]
  realtime["API Gateway WebSocket — D04"]
  authority["Lambda Partidas: validação — D04"]
  events["Auditoria: entrada, saída e resultado"]
  history["DynamoDB matches: resultado"]
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
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class realtime,authority pending
```

![Multiplayer — salas, sincronização e resultado](../imagens/diagrama-multiplayer.svg)

## 8. Modelo lógico — cardinalidades e separação de dados

Detalhes dos campos no documento 08. O ZIP confirma sala/partida, participantes autenticados e resultado persistido; formato dos dados é proposta de modelagem. Cosméticos são opcionais D11. Snapshot não é segundo slot. D03 cobre visibilidade/retenção dos resultados, não sua existência. O mapeamento físico agora usa tabelas DynamoDB por microsserviço, conforme documentos 08/12; linhas de relação não autorizam acesso cruzado entre serviços.

```mermaid
flowchart TD
  user["Usuário"]
  campaign["Campanha ativa"]
  notice["Notificação no jogo — D07"]
  email["Entrega de e-mail — D07"]
  snapshot["Snapshot pré-Portão"]
  audit["Evento de auditoria"]
  participant["Participante autenticado"]
  state["Estado: créditos, implantes, memórias, retry e final"]
  skin["Cosmético desbloqueado — D11"]
  match["Partida / resultado e classificação"]
  user -->|"1 : 0..1"| campaign
  user -.->|"1 : N"| notice
  user -.->|"1 : N"| email
  campaign -->|"1 : 0..1"| snapshot
  campaign -->|"contém"| state
  user -->|"1 : N"| audit
  user -->|"1 : N"| participant
  match -->|"2 prontos para iniciar"| participant
  user -.->|"1 : N opcional"| skin
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class notice,email,skin pending
```

![Modelo lógico — cardinalidades e separação de dados](../imagens/diagrama-dados.svg)

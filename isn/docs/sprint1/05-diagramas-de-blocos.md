# Diagramas de blocos

Projeto: Flesh to Chrome  
Sprint 1 — visão de arquitetura (ainda pode mudar na implementação)

As figuras estão em PNG em [`../imagens/`](../imagens/). Também tem Mermaid pra editar fácil.

---

## 1. Visão geral — cliente, servidor e nuvem

O browser baixa o frontend e fala com a API. A API cuida de save da campanha, multiplayer/salas, OAuth e e-mail.

```mermaid
flowchart LR
  usuario[Usuario]
  browser[Browser_Frontend_Phaser]
  api[Backend_API_REST]
  db[(Banco_save_ranking)]
  oauth[Provedor_OAuth_Google]
  email[Email_notificacoes]
  mp[Multiplayer_salas]
  static[Hospedagem_estatica]

  usuario --> browser
  browser --> static
  browser -->|HTTPS| api
  api --> db
  api --> oauth
  api --> email
  api --> mp
```

![Visão geral](../imagens/diagrama-visao-geral.png)

---

## 2. Módulos do backend

```mermaid
flowchart TB
  fe[Frontend_Phaser]

  subgraph backend [Backend]
    auth[Auth_OAuth]
    save[Save_campanha]
    game[Game_progress_API]
    notify[Email_notificacoes]
    audit[Auditoria]
    multi[Multiplayer]
    rank[Ranking_partida]
  end

  db[(Banco)]
  google[Google]
  mailer[SES_ou_similar]

  fe --> auth
  fe --> save
  fe --> game
  fe --> multi
  auth --> google
  auth --> db
  save --> db
  game --> db
  multi --> db
  multi --> rank
  save --> audit
  auth --> audit
  game --> audit
  multi --> audit
  notify --> mailer
  auth --> notify
```

![Módulos do backend](../imagens/diagrama-modulos-backend.png)

| Módulo | Função |
| --- | --- |
| Auth | login/logout com Google, sessão/token |
| Save | grava/lê progresso da campanha |
| Game progress | fase, implante, Portão |
| Multiplayer | salas / partida 1v1 |
| Ranking | resultado da corrida multiplayer |
| E-mail | boas-vindas e avisos |
| Auditoria | log de operações críticas |

---

## 3. Ambientes: desenvolvimento × produção

```mermaid
flowchart TB
  subgraph dev [Desenvolvimento]
    localFE[Frontend_local]
    localAPI[API_dev]
    localDB[(DB_dev)]
  end

  subgraph prod [Producao]
    domain[nihil-legere-possum.lat]
    cloudFE[Frontend_nuvem]
    cloudAPI[API_prod]
    cloudDB[(DB_prod)]
  end

  git[Repositorio_Git] -->|CI_CD_Pulumi| prod
  localFE --> localAPI --> localDB
  domain --> cloudFE
  cloudFE --> cloudAPI --> cloudDB
```

![Ambientes](../imagens/diagrama-ambientes.png)

- **Dev:** pra testar sem gastar / sem quebrar produção.  
- **Prod:** domínio público, subida automática com CI/CD + IaC (Pulumi), região `sa-east-1`.

---

## Observação

Sprint 1 = diagrama de blocos. Nomes exatos de serviços AWS a gente fecha no Pulumi depois.

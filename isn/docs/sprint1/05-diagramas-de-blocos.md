# Diagramas de blocos

Projeto: Flesh to Chrome  
Sprint 1 — visão de arquitetura (ainda pode mudar na implementação)

As figuras estão em PNG em [`../imagens/`](../imagens/) (abrimos direto no GitHub/Preview). Também tem o Mermaid abaixo pra quem quiser editar fácil.

---

## 1. Visão geral — cliente, servidor e nuvem

O browser baixa o frontend e fala com a API. A API usa banco, OAuth e serviço de e-mail. Em produção isso vive na AWS.

```mermaid
flowchart LR
  usuario[Usuario]
  browser[Browser_Frontend_Phaser]
  api[Backend_API_REST]
  db[(Banco_de_dados)]
  oauth[Provedor_OAuth_Google]
  email[Email_notificacoes]
  static[Hospedagem_estatica]

  usuario --> browser
  browser --> static
  browser -->|HTTPS| api
  api --> db
  api --> oauth
  api --> email
```

![Visão geral](../imagens/diagrama-visao-geral.png)

---

## 2. Módulos do backend

Separação bem direta do que a API precisa ter pra atender a disciplina + o jogo:

```mermaid
flowchart TB
  fe[Frontend_Phaser]

  subgraph backend [Backend]
    auth[Auth_OAuth]
    save[Save_progresso]
    game[Game_progress_API]
    notify[Email_notificacoes]
    audit[Auditoria]
  end

  db[(Banco)]
  google[Google]
  mailer[SES_ou_similar]

  fe --> auth
  fe --> save
  fe --> game
  auth --> google
  auth --> db
  save --> db
  game --> db
  save --> audit
  auth --> audit
  game --> audit
  notify --> mailer
  auth --> notify
```

![Módulos do backend](../imagens/diagrama-modulos-backend.png)

Resumo do que cada bloco faz:

| Módulo | Função |
| --- | --- |
| Auth | login/logout com Google, sessão/token |
| Save | grava/lê progresso da campanha |
| Game progress | endpoints ligados a estado do jogo (fase, implante, Portão) |
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
- **Prod:** domínio público, subida automática com CI/CD + IaC (Pulumi), região padrão da disciplina `sa-east-1`.

---

## Observação

Isso é diagrama de blocos da Sprint 1. Nomes exatos de serviços AWS (S3, CloudFront, ECS, RDS, etc.) a gente fecha quando for montar o Pulumi de verdade.

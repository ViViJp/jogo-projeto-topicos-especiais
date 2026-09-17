# Contrato REST inicial — proposta para ISN

Este documento especifica a API prevista, **não uma API já implementada**. Prefixo proposto `/api/v1`, transporte HTTPS e JSON. A base usa API Gateway HTTP com integração por microsserviço Lambda e autenticação Cognito/Google; detalhes restantes estão em D03–D08 e no documento 12. Este contrato não especifica o protocolo de sincronização por frame.

## Convenções

- Chamadas privadas usam access token Cognito em `Authorization: Bearer ...`, validado pelo JWT authorizer do HTTP API. Cada serviço valida ainda proprietário/participação. Não aceitar identidade declarada no corpo como prova de autenticação. Obtenção, armazenamento, renovação e logout dos tokens serão detalhados na integração Cognito; não presumir invalidação imediata de todo access token já emitido apenas por limpar sessão local.
- Rotas `/me` operam somente sobre o usuário da sessão; não recebem `userId` arbitrário.
- Erro JSON: `{ "error": { "code": "SAVE_CONFLICT", "message": "A campanha foi alterada em outra sessão.", "requestId": "..." } }`.
- `401`: sessão ausente/expirada; `403`: operação sem permissão; `404`: recurso ausente ou não visível; `409`: conflito de revisão/estado; `422`: dados inválidos; `503`: indisponibilidade. Lista vazia retorna `200` com `items: []`.
- Listagens usam `cursor` e `limit`, com resposta `{items, nextCursor}`; teto de página deve ser fixado na implementação.
- Escritas de campanha enviam `expectedRevision`; criação usa revisão zero. Resposta inclui nova revisão. Reenvio de operação com `operationId` já processado retorna o resultado anterior; reutilização com conteúdo diferente é conflito. Escopo da chave: conta/operação.

## Conta e sessão

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /auth/google/start` | Destino de retorno validado pelo backend | Adaptador do serviço Conta: `302` para fluxo Cognito com Google; não autentica senhas por conta própria. |
| `GET /auth/google/callback` | Retorno do fluxo Cognito e correlação | Serviço Conta integra retorno Cognito, valida identidade e registra acesso/primeiro cadastro. Entrega/renovação de tokens detalhadas na integração; primeiro cadastro solicita UC07. |
| `GET /me` | Sessão | `200` com `id`, nome e e-mail disponível. |
| `POST /auth/logout` | Sessão | `204`; registra saída e integra encerramento/revogação suportados pelo Cognito; frontend descarta credenciais. Access tokens seguem política de expiração/revogação definida na implementação. |

## Roteamento e responsabilidade

Um HTTP API por ambiente encaminha `/auth/*` e `/me` a Conta; `/me/campaign*` a Campanha; `/matches*` a Partidas; `/me/notifications*` a Comunicações; `/me/audit-events` a Auditoria. Cada microsserviço possui implantação, IAM e dados próprios. Rotas de início/callback de login não exigem JWT prévio, mas devem validar o fluxo externo. HTTP API é um produto AWS que oferece APIs RESTful; não é obrigação usar o produto comercial REST API.

## Campanha

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /me/campaign` | Sessão | `200` com campanha, estado, versão e revisão; `404` sem save. |
| `PUT /me/campaign` | `operationId`, `expectedRevision`, `schemaVersion`, `source`, `state` | Criação `201` ou atualização `200`; validações RN01–RN06 e auditoria da mudança. |
| `POST /me/campaign/reset` | `operationId`, `expectedRevision`, `confirmed: true` | `200` com estado inicial e nova revisão; exige confirmação na UI; preserva cosméticos. |
| `POST /me/campaign/restore-gate` | `operationId`, `expectedRevision` | `200` com snapshot restaurado e nova revisão; `409` sem snapshot. |

`state` é o objeto definido integralmente em [08-modelagem-de-dados.md](08-modelagem-de-dados.md). `source` distingue `online`, `local-sync` e `guest-import`; não autoriza acesso nem comprova eventos offline. Não enviar créditos transitórios como consolidados. O backend deriva eventos críticos das transições aceitas, em vez de disponibilizar um endpoint público para escrever logs arbitrários.

Exemplo de resposta de uma campanha inicial (identificadores ilustrativos):

```json
{
  "id": "campaign-123",
  "revision": 1,
  "schemaVersion": 1,
  "updatedAt": "2026-09-16T20:00:00Z",
  "state": {
    "phase": "ascent",
    "stageId": "esgoto",
    "resumePoint": { "kind": "start" },
    "checkpointId": null,
    "credits": { "total": 0, "consolidatedIds": [] },
    "implants": [],
    "bodyState": "original-human",
    "gateChoice": null,
    "descent": {
      "step": null,
      "chainStatus": "inactive",
      "memories": [],
      "removals": [],
      "retryUsedByStage": {}
    },
    "ending": null,
    "endings": [],
    "preGateSnapshot": null
  }
}
```

Na atualização, o cliente envia `state` junto de `operationId`, `expectedRevision`, `schemaVersion` e `source`; `id`, `revision` e `updatedAt` da resposta são definidos pelo servidor. IDs/enums acima são uma proposta de serialização; a semântica obrigatória está no modelo. Conflito `409` mantém campanha remota intacta e apresenta resolução ao jogador, conforme D05.

## Comunicações e auditoria

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /me/notifications` | Paginação | `200`, lista de notificações próprias com tipo, conteúdo, data e leitura. |
| `PATCH /me/notifications/{id}` | `read: true` | `200` com leitura registrada; não altera conteúdo. |
| `GET /me/audit-events` | Paginação; filtro opcional por tipo | `200`, eventos próprios sanitizados. |

Envio de e-mail/notificação é interno e acionado por evento; não há endpoint público para disparo arbitrário. Gatilhos e canal no jogo são proposta D07; papel administrativo depende de D06.

## Partidas multiplayer — escopo confirmado, contrato técnico proposto

O ZIP confirma dois usuários autenticados, criação/entrada em salas no backend e resultado/classificação da corrida persistidos. As rotas abaixo propõem como atender esse escopo; D03/D04 ainda definem topologia, descoberta/convite, visibilidade e sincronização. Sessão válida é obrigatória em todas as rotas de partida; visitante recebe `401`. Não está definida busca pública de adversários.

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `POST /matches` | `operationId` | `201`, ID, pista/versão de regras e estado aguardando; inclui criador como participante. |
| `POST /matches/{id}/participants` | `operationId` | `200`, entrada autorizada; `409` se cheia/iniciada. |
| `POST /matches/{id}/ready` | `operationId` | `200`, prontidão registrada; iniciar somente com dois participantes autenticados e prontos. |
| `GET /matches/{id}` | Sessão de participante | `200`, estado e resultado/classificação persistidos se encerrada. |
| `POST /matches/{id}/leave` | `operationId` | `200`; se em corrida, aplicar derrota por abandono conforme RN08; pré-largada em D04. |

Controle de ingresso deve verificar convite/permissão segundo a solução escolhida em D03, além de conhecer o ID. Somente participantes podem consultar estado privado da partida.

O resultado consultável inclui participantes, tempos bruto/ajustado, créditos, classificação, vencedor ou empate e DNF/abandono, conforme a regra aplicável. Formato dos campos é proposta de contrato; não representa ranking global. A gravação é interna ao backend e não usa um endpoint no qual o cliente escolhe livremente o vencedor.

REST cobre organização e consulta. API Gateway WebSocket é o candidato de canal de tempo real, condicionado a D04, e cobre largada, entradas/estados sequenciados, checkpoint, coleta, chegada, desconexão e resultado. Cliente não publica unilateralmente vencedor nem tempo final confiável; o mecanismo de validação/autoridade deve ser fechado em D04. Gamepad produz entrada no navegador e usa o mesmo caminho do teclado; não há rota de gamepad no backend.

## Cobertura e limites

Este contrato cobre os recursos nucleares de ISN. Loja opcional e API administrativa ficam fora até D11/D06. A política exata de sessão, limites de payload/taxa, schemas executáveis e transporte multiplayer são detalhamento futuro, não decisões implícitas deste documento.

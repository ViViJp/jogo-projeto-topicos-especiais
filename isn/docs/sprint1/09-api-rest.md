# Contrato REST inicial — proposta para ISN

Este documento especifica a API prevista, **não uma API já implementada**. Prefixo proposto `/api/v1`, transporte HTTPS e JSON. A base usa API Gateway HTTP com integração por microsserviço Lambda e autenticação Cognito/Google; D03/D07 estão aprovadas; detalhes restantes estão em D04/D06/D08 e no documento 12. Este contrato não especifica o protocolo de sincronização por frame.

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

Um HTTP API por ambiente encaminha `/auth/*` e `/me` a Conta; `/me/campaign*` e, se loja implementada, `/me/cosmetics*` a Campanha; `/matches*` e `/me/matches` a Partidas; `/me/notifications*` e `/me/notification-preferences` a Comunicações; `/me/audit-events` a Auditoria. Cada microsserviço possui implantação, IAM e dados próprios. Rotas de início/callback de login não exigem JWT prévio, mas devem validar o fluxo externo. HTTP API é um produto AWS que oferece APIs RESTful; não é obrigação usar o produto comercial REST API.

## Campanha

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /me/campaign` | Sessão | `200` com campanha, estado, versão e revisão; `404` sem save. |
| `PUT /me/campaign` | `operationId`, `expectedRevision`, `schemaVersion`, `source`, `state` | Criação `201` ou atualização `200`; validações RN01–RN06 e auditoria da mudança. |
| `POST /me/campaign/reset` | `operationId`, `expectedRevision`, `confirmed: true` | `200` com estado inicial e nova revisão; exige confirmação na UI; preserva cosméticos. |
| `POST /me/campaign/restore-gate` | `operationId`, `expectedRevision` | `200` com snapshot restaurado e nova revisão; `409` sem snapshot. |

`state` é o objeto definido integralmente em [08-modelagem-de-dados.md](08-modelagem-de-dados.md). `source` distingue `online`, `local-sync` e `guest-import`; não autoriza acesso nem comprova eventos offline. Não enviar créditos transitórios como consolidados. Memória coletada vai para `descent.pendingMemory`; só a conclusão da retirada a transfere para `descent.memories`. Morte, reinício manual ou saída anterior limpam a pendente, sem apagar consolidadas. Ao carregar após saída, normalizar a coleta pendente da sessão anterior antes de retomar/sincronizar; não depender de um pedido enviado durante o fechamento do navegador. Validar a transição conjunta com implantes/corpo. O backend deriva eventos críticos das transições aceitas, em vez de disponibilizar um endpoint público para escrever logs arbitrários.

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
      "pendingMemory": null,
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

## Cosméticos por conta — escopo opcional, vínculo aprovado D11

Proposta técnica de rotas; aquisição por conta é requisito quando a loja for implementada. Autenticação obrigatória, proprietário derivado da sessão; encaminhar ao serviço Campanha para manter débito/desbloqueio consistentes. Catálogo/preço e origem da compra são validados pelo backend. Não há integração de pagamento real.

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /me/cosmetics` | Sessão | `200`, itens adquiridos pela conta; usados na sincronização entre dispositivos. |
| `POST /me/cosmetics/purchases` | `operationId`, `cosmeticId`; revisão esperada do saldo quando aplicável | `201` após aquisição durável; reenvio idêntico retorna a operação original sem novo débito. Valida saldo/preço e registra débito, item e outbox de forma consistente. |

Sem sessão: `401`; saldo insuficiente ou revisão divergente: erro sem aquisição/débito parcial. Mesma operação com conteúdo diferente: `409`. Falha de rede não confirma compra; consultar propriedade ou repetir a operação original. PUT/reset/restauração de campanha não alteram propriedade dos itens. Conflito entre saves exige respeitar compras já registradas ao reconciliar saldo; nunca importar desbloqueios do cache visitante. Schema de catálogo/saldo e seleção visual serão detalhados na implementação da loja.

## Comunicações e auditoria

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `GET /me/notifications` | Cursor; limite 20 | `200`, notificações próprias não expiradas com categoria, alvo autorizado, data e leitura; D07 define 30 dias. |
| `GET /me/notification-preferences` | Sessão | D07 aprovada: `200`, categorias/canais habilitados. |
| `PATCH /me/notification-preferences` | Preferências e revisão esperada | D07 aprovada: `200`, política atualizada para a própria conta; `409` se revisão divergir. |
| `PATCH /me/notifications/{id}` | `read: true` | `200` com leitura registrada; não altera conteúdo. |
| `GET /me/audit-events` | Paginação; filtro opcional por tipo | `200`, eventos próprios sanitizados. |

Envio de e-mail/notificação é interno e acionado por evento; não há endpoint público para disparo arbitrário. Compra cosmética gera notificação no jogo e não cria entrega de e-mail. Gatilhos, canais, retenção e preferências seguem D07 aprovada no [documento 14](14-salas-e-notificacoes.md); papel administrativo depende de D06.

## Partidas multiplayer — escopo confirmado, contrato técnico proposto

O sistema exige dois usuários autenticados, criação/entrada em salas no backend e resultado/classificação persistidos. As rotas abaixo atendem ao modelo D03 aprovado; D04 cobre a validação da sincronização e autoridade da corrida. Sessão válida é obrigatória em todas as rotas de partida; visitante recebe `401`. D03 define código/link privado no primeiro escopo, sem busca pública de adversários; modelo aprovado no [documento 14](14-salas-e-notificacoes.md).

| Método e rota | Entrada | Saída / efeitos |
| --- | --- | --- |
| `POST /matches` | `operationId` | D03 aprovada: `201`, ID, pista/versão, código/link de convite e expiração do lobby; criador no primeiro slot. |
| `POST /matches/join` | `operationId`, `inviteCode` | D03 aprovada: resolve convite por chave e reserva segunda vaga; `200` com sala autorizada. Convite inválido/expirado é rejeitado, sem expor detalhes privados. |
| `GET /me/matches` | Cursor; limite 20 | D03 aprovada: `200`, resultados próprios dos últimos 30 dias. |
| `POST /matches/{id}/connection-ticket` | Sessão autenticada; participante autorizado | Proposta: `201`, ticket de uso único e validade curta para abrir WSS; definir TTL, entrega e consumo atômico em D04. Não registrar o segredo em logs. |
| `POST /matches/{id}/ready` | `operationId` | `200`, prontidão registrada; iniciar somente com dois participantes autenticados e prontos. |
| `GET /matches/{id}` | Sessão de participante | `200`, estado e resultado/classificação persistidos se encerrada. |
| `POST /matches/{id}/leave` | `operationId` | `200`; se em corrida, aplicar derrota por abandono conforme RN08; antes da largada, cancelar a sala conforme D03. |

Conforme D03, conhecer o ID não basta: entrada exige convite vigente e sessão; o código é uma credencial compartilhável, não convite nominal. Consumi-lo e reservar vaga/vínculo ativo atomicamente; repetição idempotente não ocupa nova vaga. Rate limit e expiração são validados pelo backend, sem depender da remoção TTL. Somente participantes podem consultar estado privado da partida.

O resultado consultável inclui participantes, tempos bruto/ajustado, créditos, classificação, vencedor ou empate e DNF/abandono, conforme a regra aplicável. Formato dos campos é proposta de contrato; não representa ranking global. A gravação é interna ao backend e não usa um endpoint no qual o cliente escolhe livremente o vencedor.

REST cobre organização e consulta. WSS é recomendado no [estudo de transportes](13-transporte-multiplayer.md); API Gateway WebSocket é o candidato a hospedagem, condicionado a D04, e cobre largada, entradas/estados sequenciados, checkpoint, coleta, chegada, desconexão e resultado. Cliente não publica unilateralmente vencedor nem tempo final confiável; o mecanismo de validação/autoridade deve ser fechado em D04. Gamepad produz entrada no navegador e usa o mesmo caminho do teclado; não há rota de gamepad no backend.

### Contrato de tempo real proposto — D04

Mensagens têm tipo, versão, partida, geração da conexão e sequência; eventos críticos têm ID para deduplicação. O servidor associa o participante à sessão, valida vínculo/taxa e rejeita eventos antigos. Prever `heartbeat`/`heartbeatAck`, largada com referência temporal, snapshots, marcos, confirmação e resultado. Heartbeat é mensagem de aplicação, não endpoint REST nem prova de legitimidade do gameplay.

Renovar conexão no lobby com novo ticket; confirmar estado/prontidão antes da corrida. Reenvio não duplica chegada/créditos e não reabre resultado. Desconexão confirmada segue RN08; REST permite consultar o resultado após reconectar. Intervalos, schemas, autoridade, mecanismo de verificação de presença e duração máxima estão propostos/pendentes no documento 13.

## Cobertura e limites

Este contrato cobre os recursos nucleares de ISN. Loja opcional tem contrato inicial proposto acima e sincronização por conta aprovada em D11; cronograma e schemas detalhados continuam pendentes. API administrativa depende de D06. A política exata de sessão, limites de payload/taxa, schemas executáveis e transporte multiplayer são detalhamento futuro, não decisões implícitas deste documento.

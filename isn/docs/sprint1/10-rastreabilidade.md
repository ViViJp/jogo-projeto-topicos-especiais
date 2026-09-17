# Rastreabilidade da Sprint 1

Esta matriz relaciona requisitos, regras, casos e diagramas. **Cobertura documental não é implementação.** Números RF/RNF estão em [02-requisitos.md](02-requisitos.md), RN em [03-regras-de-negocio.md](03-regras-de-negocio.md), UC em [04-casos-de-uso.md](04-casos-de-uso.md) e D em [07-decisoes-pendentes.md](07-decisoes-pendentes.md).

## Requisitos da disciplina

| Requisito | Regras/casos | Evidência documental | Decisão pendente |
| --- | --- | --- | --- |
| RF-ISN-01 cliente-servidor | UC01/04 | Visão geral e módulos | D08 |
| RF-ISN-02 frontend sob demanda | UC01 | Hospedagem no diagrama geral | — |
| RF-ISN-03 backend nuvem | RN10 | Arquitetura, ambientes | D08 |
| RF-ISN-04 REST | UC02/04/07/08/13 | Contrato 09-api-rest.md | D03–D08 |
| RF-ISN-05 autenticação/autorização | RN01; UC02/04/08 | Conta, proprietário e erros de API | D03/D06 |
| RF-ISN-06 banco | RN01/10; UC04 | Modelo 08 e diagrama de dados | D05/D08 |
| RF-ISN-07 modelo/arquitetura | RN01/08/10 | Documentos 05 e 08 | D03–D08 |
| RF-ISN-08 e-mail/notificações | RN10; UC07 | Dois canais no modelo/fluxo de login | D07 |
| RF-ISN-09 operações críticas | RN10; UC08 | Catálogo de eventos, banco e API | D06 |
| RF-ISN-10 dev/prod | RN10 | Diagrama de ambientes | D08 |
| RF-ISN-11 IaC | RN10 | Pulumi para toda implantação em nuvem | D08 |
| RF-ISN-12 CI/CD | RN10 | Fluxo de deploy com falhas | D08 |
| Responsividade | RNF01; UC01/14 | Viewports, teclado/gamepad | D01/D09 |
| Baixa latência | RNF02–04 | Critérios de medição da campanha/API/multiplayer | D04/D09 |
| Custo mínimo | RNF05 | Estimativa por carga/serviço como critério | D08/D09 |

## Produto, GDD e cobertura

| Função / origem | Requisito | Regra / caso | Diagrama / dados |
| --- | --- | --- | --- |
| Auto-runner, ações e hazards — GDD §14 | RF-J01 | RN02; UC03 | Entrada e loop gameplay |
| Setores e implantes — §§14/16 | RF-J02 | RN04; UC05 | Clínica e campanha; corpo/implantes |
| Créditos/checkpoints/anti-farming — §14.4/14.12 | RF-J03 | RN03; UC03/09 | Loop; IDs consolidados |
| Save único, local e Novo Jogo — §20 | RF-J04 | RN01; UC04/09 | Login; campanha/snapshot |
| Sincronização por conta — extensão ISN | RF-J05 | RN01; UC02/04 | Nuvem; revisão/proprietário; D05 |
| Portão e repetição dos finais — §18 | RF-J06 | RN05; UC06/12 | Campanha; snapshot pré-Portão |
| Glitches/retirada/bioprinting — §§15/18 | RF-J07 | RN06; UC10/11 | Descida; memórias/retiradas/retry; D10 |
| Flesh/Hollow/epílogo — §18 | RF-J08 | RN06; UC10/12 | Campanha/descida; estado corporal |
| Prólogo, pai, George — §15 | RF-J09 | RN04–06; UC05/06/10/12 | Campanha/descida; cenas narrativas |
| Pausa/reinício/replay restrito — §19 | RF-J10 | RN07; UC09 | Gameplay/gamepad; continuidade |
| Multiplayer — GDD §21 + ZIP RF22/RF23 e UC09 | RF-J11/14 | RN08; UC13 | Login obrigatório, salas e resultado persistido; D03 parcialmente resolvida, D04 pendente |
| Gamepad físico — solicitação desta revisão | RF-J12 | RN02/07; UC14 | Entrada e fluxo gamepad; D01/D02 |
| Loja e cosméticos — §25, opcionais | RF-J13 | RN09; UC15 | Entidade separada; D11 |

## Cobertura da entrega solicitada

- Requisitos funcionais e não funcionais: documento 02.
- Regras de negócio: documento 03.
- Casos de uso: documento 04.
- Diagramas: documento 05, com visão geral, backend, ambientes, entrada, multiplayer e dados.
- Fluxogramas: documento 06, com login, gameplay, clínica, campanha, descida, multiplayer, gamepad e deploy.
- Complementos de especificação: decisões 07, modelagem 08, API 09, esta matriz, comparação ZIP 11 e arquitetura AWS/custos 12.
- Diretriz de microsserviços: RNF07, cinco serviços com tabelas/IAM/implantação próprios; diagramas AWS de blocos e eventos, documento 12.
- D08 parcialmente resolvida pela seleção de serviços gerenciados; conta ainda não criada, elegibilidade e limites devem ser confirmados. D04 permanece condicionado a prova de sincronização multiplayer.

Resultado/classificação por corrida é requisito confirmado no ZIP. Não há compromisso de implementar skins, chat, ranking global, pagamentos reais, app mobile ou controle remoto por celular como parte do núcleo. O que foi acrescentado como proposta técnica está identificado para revisão, sem alterar silenciosamente o GDD.

## Correspondência com os IDs da versão ZIP

Os IDs atuais foram preservados para não quebrar referências desta revisão. No ZIP, UC09 é multiplayer; nesta documentação, seu equivalente é **UC13**. UC09 atual trata pausa/reinício/Novo Jogo.

| IDs no ZIP | IDs / conteúdo nesta revisão |
| --- | --- |
| RF01–RF06 | RF-ISN-01–06; domínio no resumo e UC01; login/save nos RF-J04/05 |
| RF07 | RF-J04/05; persistência local mantida pelo GDD §20; divergência registrada no documento 11 |
| RF08–RF12 | RF-ISN-08–12; RN10, comunicações, auditoria e ambientes |
| RF13 | RF-J01 |
| RF14–RF17 | RF-J02; clínica sem decisão sim/não confirmada |
| RF18–RF19 | RF-J01/03; RN02/03 |
| RF20 | RF-J06 |
| RF21 | RF-J04/05 e modelo completo de campanha |
| RF22 | RF-J11; login dos dois jogadores e salas confirmados |
| RF23 | RF-J14; resultado/classificação persistidos, separados da campanha |
| RNF01 e RNF04 | RNF01 atual: responsividade/resolução desktop |
| RNF02 | RNF02–04 atuais: gameplay, API e multiplayer |
| RNF03 | RNF05 atual: custo |

Fontes e critérios da integração estão em [11-reconciliacao-zip.md](11-reconciliacao-zip.md). O ZIP não traz novas decisões de gamepad ou mudança no GDD.

DNS e HTTPS: Route 53 + ACM constam no diagrama AWS e no documento 12, seção 3.1. A zona pode ser associada ao plano CloudFront conforme elegibilidade; registrador/delegação e nomes dos subdomínios ficam em D08.

# Rastreabilidade da Sprint 1

Esta matriz relaciona requisitos, regras, casos e diagramas. **Cobertura documental não é implementação.** Números RF/RNF estão em [02-requisitos.md](02-requisitos.md), RN em [03-regras-de-negocio.md](03-regras-de-negocio.md), UC em [04-casos-de-uso.md](04-casos-de-uso.md) e D em [07-decisoes-pendentes.md](07-decisoes-pendentes.md).

## Requisitos da disciplina

| Requisito | Regras/casos | Evidência documental | Decisão pendente |
| --- | --- | --- | --- |
| RF-ISN-01 cliente-servidor | UC01/04 | Visão geral e módulos | D08 |
| RF-ISN-02 frontend sob demanda | UC01 | Hospedagem no diagrama geral | — |
| RF-ISN-03 backend nuvem | RN10 | Arquitetura, ambientes | D08 |
| RF-ISN-04 REST | UC02/04/07/08/13 | Contrato 09-api-rest.md | D04/D06/D08 |
| RF-ISN-05 autenticação/autorização | RN01; UC02/04/08 | Conta, proprietário e erros de API | D06 |
| RF-ISN-06 banco | RN01/10; UC04 | Modelo 08 e diagrama de dados | D05 aprovada; D08 pendente |
| RF-ISN-07 modelo/arquitetura | RN01/08/10 | Documentos 05 e 08 | D04/D06/D08 |
| RF-ISN-08 e-mail/notificações | RN10; UC07 | Central, e-mails seletivos e feedback; D07 aprovada | D08: liberação SES |
| RF-ISN-09 operações críticas | RN01/10; UC02/04/08 | Catálogo de eventos, banco e API; campanha registrada após login, sem histórico retroativo de visitante (D06 aprovada) | D06: somente retenção/acesso operacional |
| RF-ISN-10 dev/prod | RN10 | Diagrama de ambientes | D08 |
| RF-ISN-11 IaC | RN10 | Pulumi para toda implantação em nuvem | D08 |
| RF-ISN-12 CI/CD | RN10 | Fluxo de deploy com falhas | D08 |
| Responsividade | RNF01; UC01/14 | Viewports, teclado/gamepad; sem meta de FPS | D01 |
| Baixa latência — orientação de qualidade | RNF02–04 | Funcionamento de campanha/API/multiplayer; sem meta numérica exigida na entrega (D09 resolvida) | D04: sincronização e operação |
| Custo mínimo | RNF05 | Estimativa por carga/serviço como critério | D08 |

## Produto, GDD e cobertura

| Função / origem | Requisito | Regra / caso | Diagrama / dados |
| --- | --- | --- | --- |
| Auto-runner, ações e hazards — GDD §14 | RF-J01 | RN02; UC03 | Entrada e loop gameplay |
| Setores e implantes — §§14/16 | RF-J02 | RN04; UC05 | Clínica e campanha; corpo/implantes |
| Créditos/checkpoints/anti-farming — §14.4/14.12 | RF-J03 | RN03; UC03/09 | Loop; IDs consolidados |
| Save único por conta e Novo Jogo — §20, atualizado por D06; visitante somente na sessão | RF-J04 | RN01; UC04/09 | Login; campanha/snapshot |
| Sincronização por conta — extensão ISN | RF-J05 | RN01; UC02/04 | Nuvem; escolha explícita, revisão e cache por conta; D05 aprovada |
| Portão e repetição dos finais — §18 | RF-J06 | RN05; UC06/12 | Campanha; snapshot pré-Portão |
| Glitches/retirada/bioprinting — §§15/18 | RF-J07 | RN06; UC10/11 | Descida; perda por morte/reinício/saída antes da retirada e consolidação no procedimento; D10/D12 aprovadas; memória após último checkpoint |
| Flesh/Hollow/epílogo — §18 | RF-J08 | RN06; UC10/12 | Campanha/descida; estado corporal |
| Prólogo, pai, George — §15 | RF-J09 | RN04–06; UC05/06/10/12 | Campanha/descida; cenas narrativas |
| Pausa/reinício/replay restrito — §19 | RF-J10 | RN07; UC09 | Gameplay/gamepad; continuidade |
| Multiplayer — GDD §21 e requisitos ISN | RF-J11/14 | RN08; UC13 | Login obrigatório, salas e resultado persistido; D03 aprovada, D04 pendente |
| Gamepad físico — solicitação desta revisão | RF-J12 | RN02/07; UC14 | Entrada e fluxo gamepad; D02 aprovada, D01 pendente |
| Loja e cosméticos — §25, opcionais | RF-J13 | RN09; UC15 | Aquisições sincronizadas por conta (D11 aprovada); cronograma opcional |

## Cobertura da entrega solicitada

- Requisitos funcionais e não funcionais: documento 02.
- Regras de negócio: documento 03.
- Casos de uso: documento 04.
- Diagramas: documento 05, com visão geral, backend, ambientes, entrada, multiplayer e dados.
- Fluxogramas: documento 06, com login, gameplay, clínica, campanha, descida, multiplayer, gamepad e deploy.
- Complementos de especificação: decisões 07, modelagem 08, API 09, esta matriz, arquitetura AWS/custos 12, estudo de transporte 13 e modelo de salas/notificações 14.
- Diretriz de microsserviços: RNF07, cinco serviços com tabelas/IAM/implantação próprios; diagramas AWS de blocos e eventos, documento 12.
- D08 parcialmente resolvida pela seleção de serviços gerenciados; conta ainda não criada, elegibilidade e limites devem ser confirmados. D04 permanece condicionado a prova de sincronização multiplayer; documento 13 compara MQTT/WebTransport/WebSocket, recomenda WSS e distingue timeout do serviço, heartbeat e derrota por desconexão.

Resultado/classificação por corrida é requisito do sistema. Não há compromisso de implementar skins, chat, ranking global, pagamentos reais, app mobile ou controle remoto por celular como parte do núcleo. O que foi acrescentado como proposta técnica está identificado para revisão, sem alterar silenciosamente o GDD.

## Cobertura consolidada

Os identificadores atuais são a referência da documentação. UC13 trata multiplayer; UC09 trata pausa, reinício e Novo Jogo.

| Área | Requisitos e conteúdo |
| --- | --- |
| Web, nuvem e identidade | RF-ISN-01–06; domínio no resumo/UC01; login e save RF-J04/05 |
| Persistência e operação | Save por conta e cache local RF-J04/05; D06 substitui persistência de visitante do GDD §20; comunicações/auditoria/ambientes RF-ISN-08–12 e RN10 |
| Gameplay e progressão | RF-J01/02/03; clínica sem escolha sim/não, movimento, implantes e créditos |
| Campanha e finais | RF-J04/05/06; modelo completo de campanha e estado pré-Portão |
| Multiplayer | RF-J11/14; login dos dois participantes, salas privadas e resultado persistido separado da campanha |
| Qualidade | RNF01: responsividade desktop; RNF02–04: gameplay, API e multiplayer; RNF05: custo |

DNS e HTTPS: Route 53 + ACM constam no diagrama AWS e no documento 12, seção 3.1. A zona pode ser associada ao plano CloudFront conforme elegibilidade; registrador/delegação e nomes dos subdomínios ficam em D08.

## Cenários de aceite das decisões de 17/09/2026

Especificação para a implementação futura, não testes executados nesta revisão documental.

| Decisão | Cenário | Resultado esperado |
| --- | --- | --- |
| D02 | Desconectar controle durante campanha; reconectar | Física/cooldowns pausam; aviso e teclado disponíveis; retomada só por ação do jogador. |
| D02 | Desconectar controle durante corrida multiplayer | Corrida continua; aviso/teclado; não registrar derrota por queda de periférico. |
| D05 | Login com cópias divergentes; cancelar; depois escolher uma | Nenhuma sobrescrita ao cancelar; escolha explícita respeita revisão e proprietário, sem união automática. |
| D05 | Trocar da conta A para B com alterações locais pendentes | Nenhum save, aquisição ou envio de A é associado a B; visitante continua separado. |
| D06 | Jogar sem autenticar; fechar e reabrir o jogo | Campanha visitante descartada; nenhum save persistente nem histórico de campanha de visitante. |
| D06 | Iniciar como visitante e autenticar durante a sessão; confirmar vinculação D05 | Progresso atual salvo na conta com importação auditada; nenhuma reconstrução das ações anteriores ao login. |
| D06 | Autenticar com campanha remota divergente do progresso visitante | Solicitar escolha conforme D05; não sobrescrever automaticamente. Cancelar mantém visitante somente na sessão aberta. |
| D10 | Coletar memória e morrer, reiniciar ou sair antes da retirada | Perder pendente, permitir recoleta; checkpoint não a protege e carregamento não a restaura. |
| D10 | Retirar implante; depois morrer, reiniciar ou sair | Preservar memória consolidada, corpo e retirada; não exigir nova coleta nem repetir procedimento. |
| D10 | Memória D1 consolidada e D2 pendente; morrer | Manter D1, perder somente D2; morte não consome retry nem quebra cadeia por si só. |
| D11 | Comprar na conta A; abrir em outro dispositivo; criar Novo Jogo | Item disponível na mesma conta e preservado pelo reset; conta B não o recebe. |
| D11 | Repetir solicitação de compra após resposta perdida | Uma aquisição e um débito, quando aplicável; confirmação recuperável sem duplicação. |

D12 aprovada: todos os glitches ficam após o último checkpoint e antes da área de retirada; verificar essa ordem nos mapas. A revisão não altera posição de checkpoint nem código do jogo.

D03/D07 aprovadas: modelo, experiência, retenção e estimativas no [documento 14](14-salas-e-notificacoes.md). Compra cosmética notifica somente no jogo; e-mail é excluído desse evento.

Aceite D07: concluir compra cosmética gera confirmação no jogo e nenhuma solicitação de envio SES, independentemente das preferências de e-mail.

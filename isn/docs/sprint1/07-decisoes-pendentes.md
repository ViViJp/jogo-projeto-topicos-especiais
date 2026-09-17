# Decisões para verificar com a equipe

Este registro explicita o que não está fechado no GDD ou não está definido tecnicamente. **Proposta não significa decisão aprovada ou funcionalidade implementada.** Nos diagramas, linhas tracejadas e rótulos Dxx identificam essas dependências; conexões sólidas também podem representar especificação futura, não implementação existente.

## Inclusões solicitadas nesta revisão

- **Gamepad físico conectado ao navegador:** confirmado pelo responsável. É uma ampliação do GDD §6, que lista teclado. Não inclui controle remoto por celular ou touch.
- **Multiplayer:** incluído em requisitos, casos, diagramas e fluxos; regras vêm do GDD §21. O ZIP confirma sua inclusão no escopo ISN, com login, salas e resultado persistido; o GDD mantém desenvolvimento após a campanha. API Gateway WebSocket/Lambda é agora o candidato de referência, sujeito à prova de custo/latência D04.

## Diretriz AWS e microsserviços

O responsável determinou prioridade para microsserviços, serviços gerenciados AWS, escalabilidade e custo baixo; informou que a conta ainda não foi criada. A arquitetura de referência usa cinco serviços Lambda, dados DynamoDB por domínio, Cognito, Route 53/ACM, S3/CloudFront, SQS, SES e CloudWatch. Detalhes e fontes atuais do Free Tier estão no [documento 12](12-arquitetura-aws-microsservicos.md). D08 fica parcialmente resolvida; criação/quotas/elegibilidade e teto de custo continuam pendentes.

## Definições encontradas no ZIP

A [comparação de versões](11-reconciliacao-zip.md) registra as fontes. D03 foi **parcialmente resolvida**: dois jogadores autenticados, criação/entrada em sala mantida pelo backend e gravação de resultado/classificação da corrida são requisitos, não propostas. A clínica também foi esclarecida: procedimento sem opção sim/não. Não houve alteração no GDD ou no código do jogo.

## Pontos pendentes

| ID | O que falta decidir | Proposta / consequência | Onde aparece |
| --- | --- | --- | --- |
| D01 | Botões do gamepad, controles e navegadores suportados; remapeamento; vibração; tratamento de vários controles conectados | Um controle por cliente, teclado como alternativa, mesmas ações e menus. Não prometer remapeamento/vibração sem decisão. Validar tabela de botões com hardware real. | Entrada, UC14, RF-J12 |
| D02 | Gamepad desconectado: pausar campanha automaticamente? Como retomar? | Proposta: pausar campanha e informar fallback para teclado; multiplayer continua, com aviso. Não confundir desconexão do periférico com queda da rede. | Fluxo gamepad; RN07 |
| D03 — parcialmente resolvida | Como localizar/compartilhar sala: código, convite ou busca? Confirmar topologia de dois navegadores; definir retenção, visibilidade e consulta de resultados. | ZIP confirma login dos dois jogadores, salas no backend e resultado/classificação por corrida persistidos. Dois clientes continuam proposta de topologia. Não há definição de ranking global, chat, matchmaking público ou split-screen. | Arquitetura multiplayer, UC13, API e modelo de partidas |
| D04 | Transporte, autoridade de simulação/resultado, frequência de sincronização e detecção de desconexão | Candidato: API Gateway WebSocket + Lambda Partidas, com mensagens de ações/marcos, sem execução contínua por frame em Lambda. Fazer prova de custo/latência antes de fechar transporte e autoridade. Definir timeout, queda simultânea, abandono pré-largada e limite quando ninguém termina. Não introduzir reconexão com tolerância após derrota sem rever GDD §21.7. | Serviço multiplayer; RN08; fluxo da partida |
| D05 | Como reconciliar save local/remoto, importar visitante e trocar de conta? | Proposta: revisar as duas cópias, escolher explicitamente, nunca sobrescrever silenciosamente, usar revisão contra concorrência e separar cache por conta. Definir armazenamento da cópia visitante após login/logout. | UC04, diagrama de persistência, REST |
| D06 | Auditoria offline, retenção, consulta operacional e privilégios administrativos | Backend registra operações que processa. Importação local é evento de importação, não prova de cada ação passada. Validar se a disciplina exige envio posterior do histórico offline. Proposta de consulta privada do próprio usuário; papel administrativo ainda não definido. | RN10, modelo e API de auditoria |
| D07 | Canais/gatilhos de notificação e política de reenvio | Proposta mínima: primeiro cadastro gera e-mail + notificação no jogo; final gera notificação no jogo. Push do navegador não está assumido. SES selecionado como provedor de referência; definir tentativas, retenção e aprovação de saída do sandbox. | UC07; componente de comunicação |
| D08 — parcialmente resolvida | Criar conta, confirmar elegibilidade Free Plan, região final, quotas, plano CloudFront e associação da zona DNS, registrador/delegação do domínio, nomes de API/WebSocket, capacidade DynamoDB e integração IaC. | Arquitetura de referência definida no documento 12: Lambda por domínio, HTTP API, Cognito, DynamoDB, Route 53/ACM, S3/CloudFront, SQS, SES e CloudWatch. Dev local é padrão; nuvem sempre via Pulumi. Não há garantia de custo zero permanente. | Diagramas AWS, ambientes, banco e implantação |
| D09 | Equipamento de referência, metas finais de latência/FPS, carga multiplayer e teto de custo | Metas numéricas de RNF são propostas; medir e validar antes de declarar atendimento. | RNF e planejamento de infraestrutura |
| D10 | Memória recuperada persiste ao morrer antes da ReForge? Em qual marco fica consolidada? | GDD define créditos, cadeia e retirada, mas não fecha esse caso. Proposta para discussão: persistir memória ao recuperá-la e retirada ao concluir procedimento; não aplicar automaticamente regra de perda de créditos às memórias. | UC10/11, estado da descida e fluxo |
| D11 | Cosméticos opcionais terão sincronização por conta? Quando entram no cronograma? | Manter fora do núcleo; separar desbloqueios do reset da campanha. Não incluir gateway real. Contrato da loja fica para decisão de implementação. | UC15, entidade opcional |

## Decisões já estabelecidas que não devem ficar em aberto

- Prioridade para microsserviços independentes e serviços AWS gerenciados; conta ainda não criada.
- Um único save de campanha e confirmação de Novo Jogo (GDD §20).
- Teclado continua suportado; gamepad físico foi autorizado nesta revisão.
- Ordem dos implantes e das quatro retiradas; não há ramo de campanha por recusar implante da subida.
- Uma repetição especial após concluir setor sem glitch; segunda falha ou recusa quebra a cadeia.
- Hollow preserva os implantes restantes, corta o percurso restante por transições e leva ao epílogo.
- Save pré-Portão e restauração integral para repetir os finais.
- Multiplayer sem pausa, sem PvP e independente da carteira/save da campanha.
- Dois jogadores autenticados, criação/entrada em salas no backend e resultado/classificação da corrida gravados (ZIP RF22/RF23, regras §7 e UC09).
- Clínica sem decisão sim/não do jogador: a aceitação é narrativa, o procedimento acontece (ZIP RF15 e UC05).

## Atualização do GDD

O GDD não foi reescrito nesta revisão: continua sendo a referência original de comparação. Depois de fechar D01/D02, incorporar suporte a gamepad em §§6, 19, 22 e 26. Incorporar login, salas e resultado persistido já definidos no ZIP e, depois, os detalhes restantes D03/D04 em §§21–22; integração de nuvem D05 em §20; consolidação de memórias D10 em §18. Isso evita atribuir ao GDD decisões que ele ainda não contém.

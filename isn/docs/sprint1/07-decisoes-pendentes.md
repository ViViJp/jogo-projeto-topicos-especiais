# Registro de decisões e pontos para verificar

Este registro distingue decisões aprovadas pelo responsável e pontos ainda não fechados no GDD ou tecnicamente. **Proposta não significa decisão aprovada ou funcionalidade implementada.** Nos diagramas, linhas tracejadas e rótulos Dxx identificam essas dependências; conexões sólidas também podem representar especificação futura, não implementação existente.

## Inclusões solicitadas nesta revisão

- **Gamepad físico conectado ao navegador:** confirmado pelo responsável. É uma ampliação do GDD §6, que lista teclado. Não inclui controle remoto por celular ou touch.
- **Multiplayer:** incluído em requisitos, casos, diagramas e fluxos; regras vêm do GDD §21. Seu escopo inclui login, salas e resultado persistido; o GDD mantém desenvolvimento após a campanha. O [estudo de transportes](13-transporte-multiplayer.md) recomenda WSS para o protótipo após comparar MQTT e WebTransport; API Gateway/Lambda continua sujeito à prova de custo/latência e autoridade D04.

## Diretriz AWS e microsserviços

O responsável determinou prioridade para microsserviços, serviços gerenciados AWS, escalabilidade e custo baixo; informou que a conta ainda não foi criada. A arquitetura de referência usa cinco serviços Lambda, dados DynamoDB por domínio, Cognito, Route 53/ACM, S3/CloudFront, SQS, SES, SNS para feedback de e-mail e CloudWatch. Detalhes e fontes atuais do Free Tier estão no [documento 12](12-arquitetura-aws-microsservicos.md). D08 fica parcialmente resolvida; criação/quotas/elegibilidade e teto de custo continuam pendentes.

## Decisões aprovadas em 17/09/2026

| ID | Definição aprovada | Consequências |
| --- | --- | --- |
| D02 — resolvida | Gamepad desconectado pausa automaticamente a campanha e informa a alternativa pelo teclado. Multiplayer continua com aviso, sem pausa. | Retomar a campanha por ação do jogador após reconectar ou escolher teclado; não confundir periférico com rede. Botões/hardware continuam em D01. |
| D03 — resolvida | Salas privadas por código de 10 caracteres/link, convite de 10 min, uma sala/partida ativa por conta, reserva atômica da segunda vaga e histórico privado de 30 dias. | Dois navegadores autenticados; cancelar sala se alguém sair antes da largada. Sem busca pública inicial. Regras e modelo no documento 14; validação de tempo real continua em D04. |
| D06 — escopo de campanha aprovado | Conforme validação do responsável com o professor, registro de campanha começa após autenticação. Progresso iniciado como visitante é vinculado à conta conforme D05; sem login, fechar/recarregar descarta a campanha. | Não manter save persistente nem histórico de campanha de visitante. Registrar a importação aceita, sem reconstrução retroativa das ações anteriores ao login. Retenção e acesso operacional são detalhamento futuro. |
| D07 — resolvida | Central por conta com categorias, leitura e preferências; retenção de 30 dias, até 5 tentativas e feedback SES/SNS/SQS. E-mail só para boas-vindas e final opcional. | Compra cosmética gera confirmação apenas no jogo, sem e-mail. Chaves de deduplicação têm retenção própria; custos/liberação SES seguem validação operacional. Documento 14. |
| D05 — resolvida | Comparar cópias local/remota; escolha explícita em conflito/importação; nunca sobrescrever silenciosamente; revisão contra concorrência e cache por conta. | UC04 detalha login, importação e troca de conta. Nenhuma mesclagem automática de progresso, créditos ou memórias. |
| D09 — resolvida | O responsável confirmou com o professor que não há exigência de latência/FPS para a entrega final. Não há meta numérica de desempenho a aprovar. | Removidas as metas propostas de FPS e tempo de resposta. Verificações funcionais permanecem; métricas são opcionais para diagnóstico. Orçamento, dimensionamento e limites operacionais seguem em D08; carga/sincronização da corrida em D04. |
| D10 — resolvida | Memória coletada se perde ao morrer, reiniciar manualmente a fase ou sair do jogo antes da retirada do implante daquela fase. Concluir a retirada consolida a memória, que não se perde em mortes posteriores. | Checkpoint não consolida memória. Recoletar após morte; preservar memórias de retiradas anteriores. Procedimento e consolidação formam uma única transição. Ao carregar a campanha, não restaurar coleta pendente da sessão encerrada. D12 aprovada posiciona todo glitch após o último checkpoint, antes da retirada. |
| D11 — sincronização aprovada | Toda aquisição cosmética concluída fica salva na conta compradora e sincronizada entre dispositivos. | Desbloqueios não pertencem ao slot da campanha, não são apagados por Novo Jogo nem transferidos ao trocar de conta. Cronograma da loja opcional continua pendente. |
| D12 — resolvida | Todas as memórias ficam após o último checkpoint e antes da área de remoção dos implantes. | Perder a pendente permite recoletá-la ao voltar do checkpoint; verificar essa ordem nos mapas, sem checkpoint intermediário entre memória e retirada. |

Detalhamento operacional de D05 atualizado por D06: visitante mantém estado somente na sessão, separado do cache persistente de cada identidade autenticada. Após login, importação explicitamente confirmada vincula o progresso escolhido à conta; conflitos exigem escolha e nunca sobrescrita silenciosa. Cancelar mantém o estado visitante somente na sessão aberta. Não há cópia persistente de visitante após importação. Logout não converte progresso da conta em save visitante; troca de conta não envia alterações pendentes da conta anterior para a nova. Continua existindo uma campanha ativa por conta, sem seletor de vários slots.

## Pontos pendentes

| ID | O que falta decidir | Proposta / consequência | Onde aparece |
| --- | --- | --- | --- |
| D01 | Botões do gamepad, controles e navegadores suportados; remapeamento; vibração; tratamento de vários controles conectados | Um controle por cliente, teclado como alternativa, mesmas ações e menus. Não prometer remapeamento/vibração sem decisão. Validar tabela de botões com hardware real. | Entrada, UC14, RF-J12 |
| D04 | Validar transporte/hospedagem, autoridade, taxa de snapshots, carga multiplayer, presença e desconexão | Documento 13 recomenda WSS; testar API Gateway + Lambda. MQTT/WSS e WebTransport são alternativas, não eliminam timeout. Fechar heartbeat/prazo de queda, verificação de presença quando ambos silenciam, renovação no lobby, duração máxima da corrida e falhas de infraestrutura. Os 120 s do GDD são alvo, não teto. Queda simultânea segue pendente; saída antes da largada cancela a sala conforme D03 aprovada. Retorno à corrida após derrota exige rever GDD §21.7. | Documentos 12/13; RN08; UC13; diagrama e fluxo multiplayer |
| D06 — escopo resolvido; operação pendente | Retenção da auditoria, consulta operacional e privilégios administrativos | A dúvida sobre histórico de visitante foi resolvida com o professor: registro de campanha a partir do login, sem histórico retroativo. Backend audita operações processadas e importação aceita. UC08 prevê consulta privada do próprio usuário; retenção e eventual papel administrativo serão detalhados durante o desenvolvimento e não reabrem o escopo definido para a Sprint 1. | RN01/10; UC02/04/08; modelo e API de auditoria |
| D08 — parcialmente resolvida | Criar conta, confirmar elegibilidade Free Plan, região final, quotas, plano CloudFront e associação da zona DNS, registrador/delegação do domínio, nomes de API/WebSocket, capacidade DynamoDB, carga de dimensionamento, teto de custo, limites operacionais de requisições/criação de salas e integração IaC. | Arquitetura de referência definida no documento 12: Lambda por domínio, HTTP API, Cognito, DynamoDB, Route 53/ACM, S3/CloudFront, SQS, SES, SNS para feedback de e-mail e CloudWatch. Dev local é padrão; nuvem sempre via Pulumi. Não há garantia de custo zero permanente. | Diagramas AWS, ambientes, banco e implantação |
| D11 — vínculo resolvido; cronograma pendente | Quando implementar a loja opcional e finalizar seu contrato técnico? | Compras ficam salvas e sincronizadas na conta compradora, decisão de 17/09/2026. Login é necessário para concluir aquisição por conta; Novo Jogo não apaga desbloqueios. Loja continua posterior ao núcleo, com pagamento somente simulado. | RN09; UC15; dados/API; arquitetura |

## Decisões já estabelecidas que não devem ficar em aberto

- Prioridade para microsserviços independentes e serviços AWS gerenciados; conta ainda não criada.
- Um único save por conta e confirmação de Novo Jogo; visitante sem persistência entre sessões (D06 atualiza a previsão do GDD §20).
- Teclado continua suportado; gamepad físico foi autorizado nesta revisão.
- Ordem dos implantes e das quatro retiradas; não há ramo de campanha por recusar implante da subida.
- Uma repetição especial após concluir setor sem glitch; segunda falha ou recusa quebra a cadeia.
- Hollow preserva os implantes restantes, corta o percurso restante por transições e leva ao epílogo.
- Save pré-Portão e restauração integral para repetir os finais.
- Multiplayer sem pausa, sem PvP e independente da carteira/save da campanha.
- Dois jogadores autenticados, criação/entrada em salas no backend e resultado/classificação da corrida gravados (RN08; UC13).
- Clínica sem decisão sim/não do jogador: a aceitação é narrativa, o procedimento acontece (RN04; UC05).

## Atualização do GDD

O GDD não foi reescrito nesta revisão: continua sendo a referência original de comparação. As definições aprovadas de D02/D03/D05/D06/D07/D10/D11/D12 são extensões/esclarecimentos do responsável registrados na ISN; incorporar ao GDD pausa por gamepad (§19), reconciliação de saves e persistência somente após login, com perda da campanha de visitante ao fechar/recarregar (§20), memória consolidada na retirada e posicionada após o último checkpoint (§§16/18) e cosméticos por conta (§25). Depois de fechar D01, incorporar mapeamento e compatibilidade em §§6, 22 e 26. Incorporar login, salas privadas e resultado persistido de D03 em §§21–22, canais de D07 na integração de nuvem e, depois, os detalhes restantes de D04. Isso evita atribuir ao GDD decisões que ele ainda não contém.

# D03 e D07 aprovadas — salas e notificações com custo controlado

Modelo aprovado pelo responsável em **17/09/2026**, com exclusão do e-mail de compra. Esta é uma especificação para implementação, não funcionalidades já implementadas. O modelo reaproveita os cinco microsserviços do [documento 12](12-arquitetura-aws-microsservicos.md). D12 foi aprovada separadamente: todas as memórias ficam após o último checkpoint e antes da área de retirada do implante.

## 1. D03: salas privadas por código e link

**Modelo aprovado:** botão “Criar sala” e botão “Entrar com código”. Cada sala comporta dois jogadores autenticados. Quem cria copia o código ou um link e compartilha por um canal de sua escolha; o jogo não envia convites a terceiros automaticamente. Abrir o link preenche o convite, solicita login se necessário e pede confirmação de entrada.

| Modelo | Benefício | Trabalho/custo adicional | Recomendação |
| --- | --- | --- | --- |
| Código + link para sala privada | Jogar com alguém conhecido; consulta direta | Validação do convite e reserva de vaga | **Primeira versão** |
| Lista de salas públicas | Encontrar desconhecidos | Índice de salas abertas, paginação, atualização e disputa de vagas | Evolução se houver demanda |
| “Jogar agora” com pareamento automático | Adversário encontrado pelo sistema | Fila de espera, cancelamento, regras de pareamento, concorrência e tratamento de baixa população | Adiar |

Essa preferência é uma avaliação de engenharia: a consulta por código evita varrer salas e manter um diretório atualizado. Não exige Redis, OpenSearch ou um servidor de lobby permanentemente ligado. Uma lista pública pequena também pode ser barata; o modelo privado reduz principalmente a complexidade e o número de consultas necessárias. A limitação é explícita: o jogador precisa de alguém com quem compartilhar o convite.

### Experiência definida

1. Usuário autenticado cria sala. Backend escolhe pista/versão válidas, registra o criador e devolve código e link.
2. Convite com **10 caracteres aleatórios**, exibidos em dois grupos para facilitar digitação; não derivar de ID sequencial ou nome. Exemplo de apresentação: `K7M4Q-9T2RX`.
3. Segundo jogador abre o link ou digita o código, autentica e confirma. Backend resolve o convite e reserva a segunda vaga atomicamente.
4. Lobby mostra os dois nomes de exibição e prontidão. Ambos carregam a pista e confirmam estar prontos. O serviço Partidas coordena a largada usando o canal de tempo real D04.
5. Depois da corrida, cada participante consulta o resultado privado. Revanche cria nova sala/partida e novo convite.

Parâmetros aprovados: convite/sala aguardando expira após **10 minutos sem largada**, uma sala/partida ativa por conta, código invalidado ao preencher a sala, cancelar ou iniciar. Antes da largada, cancelar a sala se alguém sair, sem reposição ou transferência de anfitrião; regra aprovada em D03. A expiração do lobby deixa de valer após largada; duração máxima da corrida continua em D04.

### Modelo lógico e DynamoDB

Todos os itens abaixo pertencem ao **serviço Partidas**, na tabela `matches`. Chaves ilustrativas, não schema implementado:

| Item | Chave de acesso | Campos essenciais |
| --- | --- | --- |
| Sala | `PK=MATCH#id`, `SK=META` | Criador, estado, dois slots, prontidão, pista, versão, `lobbyExpiresAt`, revisão |
| Convite | `PK=INVITE#hashDoCodigo`, `SK=META` | `matchId`, expiração, consumido/revogado |
| Vínculo ativo | `PK=USER#id`, `SK=ACTIVE` | `matchId`, validade aplicável ao estado; liberação condicional |
| Resumo de resultado | `PK=USER#id`, `SK=RESULT#data#matchId` | Resultado visível ao participante e referência à partida |

Gerar código com fonte criptográfica e reservar sua chave com condição de inexistência; colisão gera novo código. Usar leitura direta do convite e da sala, sem `Scan`. O hash evita armazenar o código em texto no item de busca, mas o código continua sendo uma credencial de convite. Quem possui o código e autentica pode disputar a vaga; não é convite vinculado a uma pessoa específica. Não devolver dados privados apenas por conhecer o ID da partida. Restringir tentativas por conta, limite de criação e tamanho dos pedidos; definir limiares em D09.

Ingresso usa transação/condições: convite vigente e não consumido, sala aguardando e não expirada, segundo slot livre, usuário diferente do criador e sem outra partida ativa. Atualizar vaga, convite e vínculo do usuário na mesma operação; `operationId` permite reenvio idempotente. Duas pessoas simultâneas não podem ocupar a segunda vaga. Prontidão/largada também verificam revisão e dois participantes, com uma única transição para execução. [Transações DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).

O prazo deve ser validado pelo backend em cada operação. DynamoDB TTL apenas remove resíduos posteriormente; itens expirados podem permanecer por dias. Expirar um convite não termina uma corrida iniciada. Ao criar nova sala, liberar vínculo antigo apenas se o estado/expiração observados ainda coincidirem; TTL sozinho não deve deixar o usuário preso nem permitir duas partidas ativas. [TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).

Histórico aprovado: últimos **30 dias**, privado para os dois participantes, consultado por chave do usuário e ordenado pela data, com páginas de 20. Não é ranking global. A retenção do histórico está aprovada; auditoria D06 e deduplicação têm políticas distintas. O índice lógico por usuário pode ser materializado pelo serviço ao finalizar a partida, sem índice global inicial. [Consultas por chave](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html).

### Rede e custo

REST cria/entra/consulta; WSS já proposto em D04 informa prontidão e mudanças do lobby. Abrir a conexão somente quando estiver na sala, encerrar ao sair e evitar polling contínuo. Uma recuperação REST após erro é aceitável; a notificação persistente de resultado não controla a largada nem a corrida.

Link definido: rota do frontend com código no fragmento, removido do endereço após captura. Se precisar atravessar login, guardar temporariamente a intenção de convite no navegador, com expiração, e pedir confirmação depois; não registrar código/ticket em logs nem tratar o fragmento como autenticação da conta.

O custo cresce com ações reais e mensagens; não há cobrança fixa de um novo servidor de lobby. Contabilizar transações, leituras, vínculos por usuário, mensagens e tempo conectado conforme [estudo de transporte](13-transporte-multiplayer.md). A capacidade acadêmica inicial de DynamoDB é hipótese, não capacidade já demonstrada para salas concorrentes. O maior volume tende a vir da sincronização da corrida, não da digitação do código; validar isso por métricas.

## 2. D07: central de notificações e e-mails seletivos

**Modelo aprovado:** uma central na conta com lista paginada, itens lidos/não lidos, categorias e preferências de e-mail. O jogador recebe informação útil sem e-mail por checkpoint, coleta ou mensagem da corrida. Avisos não interrompem a ação; toast e central aparecem preferencialmente no menu/pós-partida.

| Evento | Notificação persistente no jogo | E-mail |
| --- | --- | --- |
| Primeiro cadastro da conta | Boas-vindas | Uma vez |
| Primeira aquisição de implante/retirada por etapa da campanha | Marco de progresso, sem antecipar narrativa | Não |
| Conclusão de final | Final alcançado, sem spoilers de outros finais | Opcional, desativado inicialmente; uma vez por tipo de final/conta |
| Partida encerrada | Link para resultado privado | Não |
| Compra cosmética concluída, se loja implementada | Confirmação da aquisição | Não; confirmação somente no jogo |
| Falha de sincronização | Aviso local imediato, enquanto houver erro | Não; não depende de uma fila remota para avisar falta de rede |

Compra cosmética nunca cria entrega de e-mail, mesmo com preferências de final habilitadas; sua confirmação permanece na central e na tela de aquisição.

Não criar notificações por morte, memória pendente, reenvio de save ou heartbeat. Marcos são deduplicados por campanha/etapa para que replay não produza spam. Deduplicação de e-mail por final/conta é política de comunicação; não cria conquista nem muda o snapshot do GDD. Resultados e compras continuam disponíveis em suas telas mesmo se a notificação atrasar ou o usuário desativar uma categoria opcional.

### Funcionamento e recuperação

1. Reaproveitar outbox dos serviços Conta, Campanha e Partidas → SQS Comunicações → Lambda Comunicações.
2. Consumidor aplica categoria, preferência e chave estável por evento/destinatário/canal; grava notificação na tabela `communications`. Evitar que falha de um destinatário/canal duplique entregas já concluídas aos demais.
3. Para evento elegível a e-mail, criar estado de entrega separado, respeitar preferências e limites e enviar via SES. Uma confirmação do SES significa aceite para envio, não leitura pelo usuário.
4. Executar até **5 tentativas** para falha transitória, espaçadas por política de fila/visibilidade e limitadas pela validade do evento; depois DLQ e alarme. Não repetir destinatário permanentemente inválido. Resposta incerta exige reconciliação antes de novo envio; não prometer e-mail exatamente uma vez.
5. Para acompanhar entrega, bounce e reclamação, usar **SES → SNS Standard → SQS de feedback → Lambda Comunicações**. Esse componente está aprovado em D07; sem compute permanentemente ligado. Persistir correlação, processar feedback idempotente/fora de ordem e bloquear novos envios ao endereço com bounce permanente/reclamação. [Feedback SES/SNS](https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html), [preços SNS](https://aws.amazon.com/sns/pricing/).

Não habilitar SNS por e-mail, SMS, push do navegador, campanhas periódicas ou serviços de marketing nesta versão. SNS aqui transporta somente feedback técnico para SQS. Política da fila aceita apenas os produtores/tópico previstos. Preferências pertencem ao serviço Comunicações; credenciais e proprietário continuam derivados da sessão.

### Dados, leitura e retenção

Modelo na mesma tabela `communications`: itens `USER#id / NOTIF#data#id`, preferências `USER#id / PREFERENCES`, deduplicação por chave estável e entregas por evento/canal. Notificação inclui categoria, texto/template, alvo interno autorizado, `createdAt`, `readAt` e `expiresAt`; entrega inclui tentativas, estado e correlação SES.

Consultar 20 itens por página na abertura da central/menu; marcar leitura com operação idempotente. Sem contador global consultado a cada segundo, varredura de todos os usuários ou socket exclusivo para notificações. Estado de resultado vem do serviço Partidas; o link da notificação não dispensa autorização no destino.

Manter **30 dias** para exibição da central e estado detalhado de entrega. O backend filtra expiração, independentemente da limpeza TTL. Deduplicação vive pelo menos pelo horizonte de replay/reprocessamento da outbox/DLQ; chaves de boas-vindas e e-mail de final por conta duram enquanto a conta existir. Não expirar a chave junto da notificação e voltar a enviar boas-vindas. Preferências e supressão de endereço não expiram automaticamente com a central. Retenção de auditoria permanece em D06.

### Estimativa de custo do modelo

Exemplo de dimensionamento, sem benchmark: **1.000 contas**, média de 20 notificações no mês → 20.000 itens pequenos criados, mais leituras, confirmações, entregas e deduplicação. Os itens devem ter tamanho limitado; não anexar screenshots ou save completo. SQS mede requisições de envio, recebimento e exclusão, não apenas eventos; usar lotes quando aplicável e contabilizar tentativas/leituras vazias. Sua página publica franquia de 1 milhão de requisições/mês. [Preços SQS](https://aws.amazon.com/sqs/pricing/).

Como cenário de volume para boas-vindas e finais habilitados, sem e-mails de compras, com **2.000 e-mails/mês**, envio básico SES à la carte a US$ 0,10/1.000 representa **US$ 0,20**; no Essentials a US$ 0,16/1.000, **US$ 0,32**. São apenas valores de envio, sem dados, Lambda, banco, filas, SNS, logs ou impostos. A AWS informa Essentials como padrão para novas contas SES desde julho de 2026, com opção de mudança para à la carte. Para este uso simples, adotar à la carte sem extras e confirmar condições na criação; não presumir a tarifa anterior como padrão da nova conta. [Preços SES](https://aws.amazon.com/ses/pricing/).

O custo total deve ser calculado na região escolhida, com créditos/franquias separados do valor bruto. A estimativa acima não garante produção inteira por centavos. Não contratar IP dedicado, VDM adicional ou planos com mensalidade para atender este volume. SES em sandbox limita envio a destinatários verificados; produção exige liberação e remetente verificado. [Sandbox SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## 3. Decisões aprovadas e validações restantes

- **D03 aprovada:** salas privadas por código/link, validade de 10 min, uma partida ativa por conta, cancelamento pré-largada, histórico privado de 30 dias e ausência inicial de busca pública.
- **D07 aprovada:** categorias/canais da tabela, preferências, retenção, limite de tentativas e inclusão de SNS/SQS para feedback SES; compras geram aviso apenas no jogo, sem e-mail.
- **D04/D09:** transporte validado, tratamento de desconexão, frequência e carga, limites de abuso e orçamento final. Compartilhar código não resolve sincronização da corrida.

Critérios para implementação: dois ingressos concorrentes reservam uma única vaga; convite vencido é rejeitado mesmo antes do TTL; usuário não acessa resultado alheio; evento repetido não cria nova notificação; troca de conta não mistura central/preferências; falha de e-mail não bloqueia login, save, compra ou resultado.

Fluxos correspondentes: [salas por convite](../imagens/fluxo-salas-convite.svg) e [central/e-mail](../imagens/fluxo-notificacoes.svg), gerados junto dos [fluxogramas](06-fluxogramas.md).

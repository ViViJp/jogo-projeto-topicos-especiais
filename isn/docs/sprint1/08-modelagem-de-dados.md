# Modelagem lógica e persistência

Modelo lógico proposto para ISN, agora mapeado para DynamoDB por microsserviço (documento 12); capacidade/quotas em D08. A semântica da campanha deriva do GDD; armazenamento na nuvem e dados de serviços são extensão ISN. O sistema inclui salas, dois participantes autenticados e resultado/classificação persistidos; seus campos abaixo são proposta de modelagem, não hipótese de escopo. Entidade lógica não obriga tabela relacional: estruturas aninhadas podem ser documentos.

## Entidades e cardinalidades

| Entidade | Identificação e atributos principais | Relação / restrição |
| --- | --- | --- |
| Usuário | `id`, `provider`, `providerSubject`, nome, e-mail, criação | Par provedor/subject único; e-mail não é identidade primária. |
| Campanha | `id`, `userId`, `revision`, `schemaVersion`, `state`, atualização | Usuário tem zero ou uma campanha ativa; revisão muda a cada gravação. |
| SnapshotPortão | Estado integral de campanha anterior à escolha | Zero ou um por campanha; não contém snapshot recursivo nem revisão de transporte. |
| Notificação | `id`, `userId`, `eventKey`, categoria, conteúdo, alvo, criação, leitura, expiração | Usuário tem várias; leitura só pelo proprietário. D07 define 30 dias de exibição; deduplicação tem prazo próprio. |
| PreferênciaComunicação | `userId`, categorias, canais, revisão | D07 aprovada, pertence a Comunicações; finais por e-mail desativados inicialmente. |
| EntregaEmail | `id`, `userId`, `eventKey`, estado, tentativas, último erro sanitizado | Chave por evento/canal para evitar repetição de boas-vindas. |
| EventoAuditoria | `id`, `userId` quando conhecido, tipo, recurso, resultado, data UTC, correlação, metadados | Persistente, sem tokens; retenção D06; não guarda cópia irrestrita de payloads. |
| Partida / sala | `id`, estado, pista, versão das regras, início, limite após primeira chegada, resultado/classificação | Escopo definido; dois participantes autenticados e prontos para iniciar. Independente da campanha. Detalhes D03/D04. |
| ParticipantePartida | partida, `userId`, tempo bruto/ajustado, créditos coletados, checkpoint, estado final, posição na classificação | Vinculado a usuário autenticado; até dois participantes. Resultado persistente e estado transitório da corrida separados do save. |
| CosméticoDesbloqueado | `userId`, `cosmeticId`, origem, `operationId`, data de aquisição | Único por conta/item, sincronizado na nuvem (D11 aprovada); não pertence ao slot nem é apagado por Novo Jogo/restauração. Loja opcional. |

Gamepad não exige entidade de nuvem: é entrada local do cliente. Preferências de botão só serão acrescentadas se D01 aprovar remapeamento. Posições por frame não são gravadas como campanha nem como eventos de auditoria.

## Estado completo da campanha

| Campo lógico em `state` | Conteúdo / invariantes |
| --- | --- |
| `phase` | `ascent`, `descent`, `epilogue` ou `ending`; distingue contexto de mapas reutilizados. |
| `stageId` | Esgoto, Industrial, Meio Urbano, Corporativo ou Topo. |
| `resumePoint` | Início/checkpoint ou marco narrativo persistente: clínica, pré-Portão, memória/reciclagem, epílogo/final. Evita retomar gameplay no meio de procedimento concluído. |
| `checkpointId` | Nulo antes da ativação; pertence ao setor/contexto atual. |
| `credits.total` | Pontuação consolidada do save; não inclui coleta transitória. Novo Jogo zera. |
| `credits.consolidatedIds` | IDs únicos com referência de fase/mapa; total deve ser coerente com eles e valores do mapa. |
| `credits.balance` | Somente se loja opcional implementada; separado da pontuação total. |
| `implants` | Pernas, braços, olhos, propulsores atualmente presentes; habilidades derivadas. |
| `bodyState` | Humano original, combinação de implantes, Chrome completo ou humano bioprintado; coerente com ramo e retiradas. |
| `gateChoice` | Nula, Chrome ou descida. |
| `descent.step` | Nulo antes da descida; D1–D4 em progressão sequencial. |
| `descent.chainStatus` | Inativa antes da descida; ativa, quebrada ou concluída após iniciada. |
| `descent.memories` | IDs de memórias consolidadas pela conclusão da retirada correspondente; mortes não as removem (D10 aprovada). |
| `descent.pendingMemory` | Nulo ou ID da memória coletada na fase atual antes da retirada. Morte, reinício manual e saída limpam esse campo e reabilitam a coleta; ao carregar, não restaurar o pendente da sessão anterior; checkpoint não o promove a consolidado. |
| `descent.removals` | Procedimentos concluídos, em ordem; distintos de memórias coletadas. |
| `descent.retryUsedByStage` | Uso da repetição especial por setor; não incrementado por morte/reinício manual. |
| `ending` | Final corrente, quando concluído: Chrome, Flesh ou Hollow. |
| `endings` | Finais registrados no estado do save; comportamento de restauração segue snapshot integral. Não pressupõe conquista permanente de conta. |
| `preGateSnapshot` | Cópia integral pré-escolha, sem o próprio campo; restaurada por Continuar do Portão. |

Estado transitório (posição por frame, créditos ainda não consolidados, animação, pulso de scan) não substitui marcos persistentes. Save da campanha não recebe créditos ou tempo do multiplayer.

## Validações e atualização

1. A sessão identifica o proprietário; backend rejeita leitura/gravação alheia.
2. Uma gravação exige revisão esperada; conflito devolve erro sem sobrescrever a versão atual (D05 aprovada).
3. Validar fase, checkpoint, ordem de implantes/retiradas, conjunto de IDs de créditos e coerência entre corpo/cadeia/final.
4. Gravar campanha e evento de outbox na mesma transação do DynamoDB do serviço Campanha. Streams/publicador encaminha o evento ao serviço Auditoria por SQS, com deduplicação e recuperação. A projeção de auditoria é assíncrona; não confirmar save sem evento durável.
5. Novo Jogo substitui estado da campanha após confirmação na interface; não apaga cosméticos independentes.
6. Restauração pré-Portão copia estado narrativo anterior integralmente; revisão de transporte continua monotônica.
7. Sincronização local pendente não deve ser apresentada como já gravada na nuvem. Importação recebe origem explícita; validar estrutura não prova legitimidade de cada ação offline.

## Invariantes das decisões aprovadas

- Memória pendente e consolidada são estados diferentes. A mesma memória não ocupa ambos; retirada concluída exige sua memória consolidada e a ausência do implante. Persistir retirada/memória/corpo de forma atômica; reenvio não repete procedimento.
- Morte, reinício manual e saída limpam apenas memória pendente, preservam retiradas e memórias anteriores e não incrementam retry. Carregamento de campanha após saída normaliza `pendingMemory` para nulo mesmo se o navegador não executou o salvamento de saída. Próxima fase da cadeia não pode permanecer habilitada com base numa coleta perdida. Checkpoint e gravação local/remota não consolidam por si sós.
- O cache é identificado por ambiente e identidade da conta; visitante tem espaço próprio. Importar exige confirmação, revisão esperada e não muda o proprietário de cosméticos. Logout/troca de conta isola envios pendentes.
- Aquisições cosméticas são itens por conta, separados de `state`, snapshot e reset. Proposta técnica: serviço Campanha possui esses itens na própria tabela, em chaves separadas da campanha, para transacionar débito, desbloqueio e outbox sem acesso a outra tabela de serviço. Reset/restauração/PUT de campanha não excluem nem criam esses itens. A reconciliação de saldo deve respeitar débitos já registrados; uma cópia antiga não estorna compras automaticamente.
- Contrato e mapeamento físico da loja são propostas de implementação; sua propriedade/sincronização por conta estão aprovadas. Manter registro idempotente da operação e unicidade conta/item. Nenhuma aquisição concluída depende apenas de `localStorage`.

D12 aprovada exige em cada setor: último checkpoint → memória → área de retirada. Checkpoint posterior à memória antes do procedimento viola o percurso definido; validação dos mapas deve verificar a ordem.

## Multiplayer: transitório e histórico

Durante a corrida são necessários estado dos dois participantes, sequência de mensagens, checkpoint, créditos, relógio e chegadas. A autoridade e o protocolo estão em D04. O backend deve gravar resultado/classificação da corrida, conforme RF-J14/UC13; não é preciso persistir cada frame. D03 define histórico privado de 30 dias, paginado por usuário, sem exposição pública. Convite aleatório e expirável resolve sala por chave direta; transação reserva a segunda vaga e consome convite. Sala, convite, vínculo ativo por conta e resumo de resultado têm chaves detalhadas no [documento 14](14-salas-e-notificacoes.md). Classificação é por partida; não há modelo de ranking global aprovado. Resultado final deve ser calculado uma vez pela autoridade escolhida, usando a versão das regras da partida.

Proposta D04 para presença: vínculo de `connectionId`/geração com participante, `connectedAt`, último sinal observado pelo servidor, sequência e prazo de avaliação. Dados continuam no domínio Partidas; definir frequência de escrita e verificador de prazos com custo medido. Eventos atrasados de conexão anterior não invalidam a atual. DynamoDB TTL é limpeza, não cronômetro para derrota ou janela de 20 s. Transições de encerramento precisam de atualização condicional/versionada. Ver [estudo de transportes](13-transporte-multiplayer.md).

## Mapeamento físico por microsserviço

| Tabela própria | Serviço proprietário | Entidades e separação |
| --- | --- | --- |
| `accounts` | Conta | Perfil vinculado ao `sub` do Cognito e outbox; credenciais no Cognito. |
| `campaigns` | Campanha | Campanha, snapshot, memórias pendentes/consolidadas e outbox; se loja implementada, aquisições por conta em itens separados e preservados pelo reset. |
| `matches` | Partidas | Sala, participantes, conexões, classificação e outbox; nenhum save de campanha. |
| `communications` | Comunicações | Notificações, entregas e deduplicação de eventos. |
| `audit` | Auditoria | Eventos próprios e consulta autorizada, sem depender dos logs operacionais. |

Prefixos/stacks separam dev e prod. Somente o serviço proprietário escreve/lê sua tabela; relações lógicas entre entidades não são autorização de acesso cruzado. Esquemas REST podem compor vários itens sem refletir a estrutura física. Limite de item, perfis de capacidade, recuperação da outbox e política de escala estão no [documento 12](12-arquitetura-aws-microsservicos.md).

O diagrama de dados correspondente está em [05-diagramas-de-blocos.md](05-diagramas-de-blocos.md).

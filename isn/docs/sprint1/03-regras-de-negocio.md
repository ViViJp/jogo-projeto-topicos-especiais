# Regras de negócio

Referências: [GDD 1.0.0](../../../gdd.md) e especificação ISN aprovada. RN01–RN09 distinguem regras do jogo e extensões ISN. Novas escolhas técnicas ficam em [decisões pendentes](07-decisoes-pendentes.md), sem reabrir decisões fechadas pelo GDD.

## RN01 — Conta, save e autorização

- Visitante pode jogar a campanha completa, mas seu progresso existe somente na sessão atual. Fechar/recarregar o jogo descarta a campanha; não gravar save de visitante em `localStorage` nem na nuvem. Checkpoints permitem retorno por morte/reinício dentro da sessão, sem preservação entre sessões. Esta definição validada com o professor substitui a persistência de visitante prevista no GDD §20 para o escopo ISN.
- Após autenticação, vincular o progresso da sessão à conta conforme D05; manter um único save por conta na nuvem e cache local identificado pela conta. Preservar o progresso durante o fluxo de autenticação para permitir essa vinculação; falha/cancelamento não cria registro de campanha na conta. Backend identifica o proprietário pela sessão e valida leitura, atualização e reinício; o cliente não escolhe outro proprietário.
- Persistir fase, checkpoint, carteira, IDs de créditos consolidados, implantes atuais, ramo narrativo, estado da descida, fragmentos, retry especial, finais e snapshot pré-Portão. O estado corporal deve ser reconstruível após recarregar.
- Checkpoint ativado leva o Continue ao checkpoint; sem checkpoint, ao início da fase. Créditos não consolidados são descartados na retomada.
- Novo Jogo exige confirmação antes de substituir a campanha e zerar carteira/progresso. Não cria outro slot. Cosméticos opcionais permanecem separados.
- Login não deve sobrescrever silenciosamente uma campanha local ou remota. D05 foi aprovada: comparar cópias, exigir escolha explícita em conflito/importação e controlar revisão contra concorrência. Cache persistente separado por conta; estado de visitante somente na sessão; logout/troca de conta não transfere progresso nem desbloqueios. Cancelar a escolha preserva as cópias; não mesclar créditos, memórias ou ramos automaticamente. A vinculação confirmada passa a usar o contexto da conta, sem criar slots adicionais nem save persistente de visitante. Cancelar a reconciliação mantém o progresso visitante apenas enquanto a sessão continuar aberta.

## RN02 — Movimento e ações

- Corrida da esquerda para a direita, velocidade-base fixa; dificuldade por level design. Pulo e slide estão disponíveis desde o início. Não há HUB, sistema de vidas ou chefe no Topo.
- Slide tem duração fixa, reduz hitbox e não pode ser cancelado por pulo; impede ataque, scan e dash.
- Salto duplo exige pernas; ataque/quebra exige braços; scan exige olhos; dash exige propulsores.
- Ataque funciona no ar. Bandido morre com um golpe; drone é indestrutível; contato com ambos é letal. Ataque tem recuperação inicial de 0,3 s após a animação.
- Quebrável para Alex e permite apenas atacar durante a janela inicial de 0,5 s; sem reação, há morte. Essa exceção não altera a regra dos hazards letais.
- Scan manual funciona no chão/no ar sem parar a corrida; pulso inicial de 0,75 s, sem sobreposição. Revela rotas, paredes falsas e armadilhas até sair do trecho. Morte oculta novamente os elementos.
- Dash funciona no chão/no ar, inclusive em queda; não concede invencibilidade; cooldown inicial de 2 s com feedback sonoro. Durante dash não há pulo, slide, ataque ou scan.
- Valores de movimento e combate permanecem sujeitos aos playtests do GDD §26. A matriz completa de compatibilidade é a do GDD §14.11.
- Teclado e gamepad físico devem gerar as mesmas ações e respeitar as mesmas restrições; gamepad não acrescenta poderes, aceleração ou vantagens. Mapeamento/compatibilidade permanecem em D01; desconexão segue D02 aprovada e RN07.

## RN03 — Créditos, morte e checkpoints

- Hazard letal causa morte em um hit. Antes do checkpoint, retornar ao início da fase; depois, ao checkpoint.
- Na campanha, checkpoint e fim de fase consolidam créditos. Morte, saída e reinício manual descartam somente os não consolidados, que reaparecem.
- Crédito consolidado tem ID estável por fase/mapa e não pode pontuar novamente no mesmo save, inclusive após reinício manual.
- Reiniciar Fase volta ao início da fase atual e preserva créditos consolidados. Não habilita seleção de fases concluídas.
- Fases 1–4 têm um checkpoint; a Fase 5 começa com um checkpoint sujeito a validação por playtest.
- Checkpoint diegético: videogame e TV de tubo, parada breve segura, animação/feedback, consolidação, save e retomada automática.
- HUD apresenta créditos da fase X/Y e total da campanha. Na descida não há créditos comuns.

## RN04 — Ascensão e clínica

| Fase concluída | Próximo implante | Habilidade liberada |
| --- | --- | --- |
| 1 — Esgoto | Pernas | Salto duplo |
| 2 — Industrial | Braços | Ataque/quebra |
| 3 — Meio Urbano | Olhos | Scan |
| 4 — Corporativo | Propulsores | Dash |

A campanha inclui aceitação consciente de Alex na narrativa e transformação visual. Na interface, o procedimento acontece sem opção de aceitar/recusar. Não há decisão sim/não do jogador nem ramo alternativo por recusar os quatro implantes. A recusa narrativa de George acontece na descida, quando Alex pede a remoção. O Topo exige domínio do conjunto e termina no Portão.

## RN05 — Portão e Chrome

- Criar snapshot narrativo automático imediatamente antes da escolha, separado do estado corrente.
- Aceitar conversão leva ao Chrome: Alex encontra fisicamente o pai, que o reconhece, mas não é reconhecido de volta.
- Recusar recarrega o Topo no contexto de descida, com o primeiro glitch. Escolha e progresso subsequente não apagam o snapshot pré-Portão.
- Depois dos créditos, oferecer Continuar do Portão, Novo Jogo, Multiplayer e Menu Principal. Continuar do Portão restaura integralmente a campanha anterior à escolha.

## RN06 — Descida, ReForge, Flesh e Hollow

| Ordem | Setor | Memória | Remoção / perda |
| --- | --- | --- | --- |
| D1 | Topo | Quem Alex era | Propulsores / dash |
| D2 | Corporativo | Rua/voz | Olhos / scan |
| D3 | Meio Urbano | Amigos | Braços / ataque aumentado |
| D4 | Industrial | Família | Pernas / salto duplo |
| Epílogo | Esgoto | Retorno ao lar | Estado humano ou implantes restantes |

- Os glitches são manifestações neurológicas em rotas secretas; não objetos físicos comuns. Recuperar uma memória habilita a próxima da cadeia.
- Mesmos mapas-base, direção horizontal e câmera da subida; ajustes de rotas/obstáculos devem permitir avançar com as habilidades restantes.
- Após a primeira memória, Alex pede ajuda a George, que se recusa. A ReForge recolhe o implante e reconstrói tecido orgânico por bioprinting; remove a habilidade e altera a aparência.
- Na unidade Industrial, o rosto do pai aparece como holograma/interface, não encontro físico.
- Concluir um setor sem memória oferece uma única repetição especial daquele setor. Aceitar reinicia do começo com a cadeia ativa; recusar ou concluir novamente sem a memória quebra a cadeia.
- Reinício manual durante a tentativa permanece disponível e não consome o retry especial por si só. Morte também não equivale a concluir o setor sem memória.
- D10 aprovada: a memória coletada fica pendente até concluir a retirada do implante correspondente. Morrer, reiniciar manualmente a fase ou sair do jogo antes disso apaga somente essa memória pendente e torna o glitch novamente coletável; o jogador precisa recuperá-lo de novo. Checkpoint não consolida memória.
- Retirada, bioprinting, perda da habilidade e consolidação da memória são persistidos juntos. Depois do procedimento, mortes não apagam aquela memória nem restauram o implante. Memórias consolidadas em fases anteriores permanecem. Salvar uma coleta pendente não a torna consolidada.
- A perda por morte, reinício manual ou saída não consome retry especial nem quebra a cadeia por si só; a progressão derivada da coleta perdida precisa ser recalculada. Memórias consolidadas também sobrevivem a reinício da fase e saída/retorno na campanha atual: Novo Jogo e restauração integral pré-Portão mantêm suas regras.
- Ao carregar a campanha após saída, limpar qualquer memória pendente presente na cópia local/remota antes de retomar o percurso. Não depender apenas do evento de fechamento do navegador; salvar uma coleta não pode contornar a perda na saída. Pausar dentro da mesma sessão não equivale a sair do jogo.
- D12 aprovada: todas as memórias ficam após o último checkpoint e antes da área de retirada do implante. Não há checkpoint posterior à memória antes da retirada; a ordem do percurso permite recoleta ao voltar do checkpoint. Validar essa disposição nos mapas sem alterar as regras de retorno.
- Cadeia quebrada implica Hollow: futuros glitches desaparecem, cessam as retiradas e o corpo preserva exatamente os implantes restantes. Transições/cutscenes abreviam os setores restantes e conduzem ao epílogo.
- Quatro retiradas levam ao Flesh: retorno humano à família, com marcas do bioprinting. Hollow retorna com implantes restantes e incapacidade emocional de reconexão.

## RN07 — Menu, pausa e replay

- Pausa da campanha congela movimento, física, obstáculos, inimigos, animações relevantes e cooldown de dash.
- Reinício é permitido apenas na fase atual. Não há replay livre de fases concluídas; as exceções narrativas são descida, retry especial e retorno ao Portão.
- D02 aprovada: ao perder o gamepad na campanha, pausar automaticamente e avisar que o teclado está disponível. Reconectar não retoma sozinho; o jogador escolhe retomar pelo controle ou teclado.
- A corrida multiplayer continua sem pausa, com aviso e alternativa pelo teclado. Perder o gamepad não representa queda de rede nem derrota automática.

## RN08 — Multiplayer

Modo incluído no escopo ISN, com desenvolvimento após o núcleo narrativo conforme GDD §24.5. Login, salas e resultado persistido são requisitos definidos; D03 aprova o modelo de salas, enquanto D04 mantém validações de sincronização e desconexão.

- Exige dois jogadores autenticados. Visitante deve concluir login antes de criar/entrar em sala ou participar da corrida.
- Backend mantém sala/partida; o jogador cria ou entra em uma sala e a largada exige dois participantes prontos. D03 aprovada: sala privada por código/link, validade de 10 min antes da largada e uma sala/partida ativa por conta; busca pública fica para evolução. Modelo e regras definidos no [documento 14](14-salas-e-notificacoes.md), aprovados para implementação.
- Backend registra resultado/classificação de cada corrida e o sistema mostra o vencedor. Isso não estabelece ranking global, temporadas ou placar público; D03 define histórico privado de 30 dias, visível somente aos participantes.

- Dois jogadores, pista própria, sem colisão entre jogadores e sem PvP, quatro implantes disponíveis, duração-alvo aproximada de 120 s e checkpoint central.
- Créditos começam em zero, são individuais e exclusivos da partida. Coleta não remove o item do adversário. Após morte, créditos permanecem e não reaparecem para quem já os coletou.
- Morte retorna ao início ou checkpoint conforme ativação; cronômetro continua.
- Tempo ajustado = tempo bruto − bônus de créditos. Valores iniciais: 20 créditos, 0,5 s por crédito e bônus máximo de 10 s; sujeitos a playtest.
- Quando o primeiro termina, abrir janela de 20 s para o segundo. Se ambos terminarem, comparar tempos ajustados; se o segundo não terminar no prazo, recebe DNF. Terminar primeiro não garante vitória.
- Desempate: mais créditos, depois menor tempo bruto, depois empate.
- Desconexão durante a corrida concede vitória ao adversário. Detecção, quedas simultâneas, falha de infraestrutura e abandono antes da largada estão em D04. Heartbeat evita inatividade do transporte; não garante ausência de queda nem autoriza retornar à corrida perdida. Renovação planejada de conexão ocorre no lobby. Ver [estudo de transportes](13-transporte-multiplayer.md); duração-alvo de 120 s não estabelece um limite máximo quando ninguém termina.
- Scan é individual. Não há pausa nem alteração do save, da carteira ou dos finais da campanha.
- Teclado/gamepad são alternativas de entrada; não é obrigatório possuir dois gamepads para uma partida entre dois navegadores, conforme arquitetura proposta.

## RN09 — Cosméticos opcionais

Somente após estabilização do escopo prioritário. Loja no Menu Principal, sem HUB. Separar pontuação total e saldo gastável. Skins não alteram habilidades, hitbox, dificuldade ou finais. Novo Jogo não remove desbloqueios. Vitrine em reais usa somente pagamento simulado; não há gateway real, compra de vidas ou de implantes. Créditos não compram skins da vitrine representativa. Ver GDD §25.

D11 aprovada: toda compra concluída fica vinculada e salva na conta autenticada e os desbloqueios são sincronizados entre dispositivos. Novo Jogo, restauração pré-Portão, conflito de save e troca de dispositivo não removem aquisições. Trocar de conta carrega apenas os itens da nova conta; não transfere propriedade. Visitante deve autenticar para concluir uma aquisição.

Confirmação de compra exige registro durável no backend; erro de rede não deve anunciar compra concluída. Repetir a mesma solicitação não cobra nem desbloqueia duas vezes. Desbloqueios já salvos podem ser representados no cache da respectiva conta; editar/importar campanha não concede itens. A loja continua opcional e sem pagamento real.

## RN10 — Auditoria, comunicação e operação (extensão ISN)

Catálogo inicial obrigatório para operações processadas pelo backend:

| Evento | Conteúdo específico além de ator, data UTC, resultado e identificador de correlação |
| --- | --- |
| Login/logout | Provedor e resultado; nunca token, senha ou credencial |
| Criação, sincronização e reinício de campanha | ID da campanha, revisão anterior/nova e tipo da alteração |
| Checkpoint e consolidação | Fase/checkpoint e referência da revisão salva |
| Implante, Portão, memória, retirada, retry e final | Tipo da transição e revisão salva; memória recuperada, perda da pendente e consolidação na retirada; contemplar restauração pré-Portão |
| Acesso negado ou conflito de versão | Recurso e motivo, sem conteúdo privado de outro usuário |
| Entrada/saída e encerramento de partida | Partida, participante autenticado, resultado/classificação, DNF ou desconexão |
| Compra simulada, se implementada | Cosmético e tipo de transação, separado da campanha |

Auditoria é persistente, consultável por autorização e não serve como armazenamento do gameplay. D06: conforme esclarecimento do professor, o registro de campanha começa com a autenticação. O estado atual iniciado como visitante pode ser vinculado à conta, registrando a importação aceita, sem reconstruir ou enviar o histórico das ações anteriores ao login. Quem nunca autentica não tem campanha nem histórico de campanha mantidos pelo sistema. Isso não elimina logs operacionais de acesso/segurança dos serviços. Após login, registrar as operações críticas processadas pelo backend; falhas de sincronização mantêm pendência no cache da respectiva conta. Retenção e acesso operacional continuam como detalhamento D06. Não registrar cada frame ou pressionamento como operação crítica.

D07 aprovada: central de notificações por conta com categorias, lidas/não lidas e preferências. Primeiro cadastro, marcos consolidados da campanha, resultados e compras opcionais geram avisos no jogo; e-mail apenas para boas-vindas e final se habilitado. Compra cosmética gera confirmação somente no jogo, sem e-mail. Não enviar a cada morte/checkpoint/coleta. Matriz de eventos, retenção e custo no [documento 14](14-salas-e-notificacoes.md). Falha no provedor de e-mail não bloqueia login, save ou partida. Repetição de login não repete boas-vindas; retentativas usam uma chave do evento para evitar duplicação.

Ambientes mantêm dados e credenciais separados. Qualquer implantação em nuvem usa Pulumi; produção é publicada automaticamente por CI/CD. A base agora é microsserviços Lambda com tabelas DynamoDB próprias, Cognito, S3/CloudFront, SQS, SES e CloudWatch, conforme documento 12. Conta ainda não criada; quotas, elegibilidade Free Tier, região final e orçamento permanecem em D08. Eventos críticos usam registro durável no serviço produtor e projeção assíncrona em Auditoria; indisponibilidade de e-mail não bloqueia save.

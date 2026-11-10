# Fluxogramas

Projeto: **Flesh to Chrome** — especificação da Sprint 1.

Fonte única: [`../diagramas.json`](../diagramas.json). Mermaid e SVG abaixo são gerados por `python3 isn/scripts/gerar_diagramas.py` a partir da raiz do repositório. Não editar as versões geradas separadamente.

Os diagramas descrevem o sistema planejado, não comprovam implementação. Propostas e decisões pendentes têm rótulo Dxx e/ou traço pontilhado; ver [registro de decisões](07-decisoes-pendentes.md).

## 1. Login, save local e comunicações

D06 aprovada: sem login, campanha apenas na sessão; fechar/recarregar descarta progresso. Preservar estado durante autenticação e vincular à conta conforme D05: comparar cópias, confirmar importação e exigir escolha em conflito. Cache persistente isolado por conta; auditar importação aceita, sem histórico anterior ao login. Cancelar mantém visitante somente na sessão aberta. Troca de conta não transfere envios nem cosméticos. Descartar memória pendente apenas ao retomar após saída (D10), não ao autenticar na mesma sessão. Primeiro cadastro dispara comunicação D07 sem bloquear a campanha.

```mermaid
flowchart TD
  start(["Abrir site / menu"])
  login{"Entrar na conta?"}
  local["Jogar como visitante: apenas nesta sessão"]
  provider["Autenticar: Cognito + Google"]
  ok{"Login válido?"}
  account["Identificar conta e auditar"]
  first{"Primeiro cadastro?"}
  resolve["Comparar cópias / confirmar escolha"]
  send["Solicitar e-mail + notificação sem bloquear"]
  play(["Continuar; limpar memória pendente se nova sessão"])
  commDone(["Fim da tarefa de comunicação"])
  persist["Salvar na conta e auditar importação aceita"]
  start --> login
  login -->|"não"| local
  local --> play
  login -->|"sim"| provider
  provider --> ok
  ok -->|"cancelou / erro"| start
  ok -->|"sim"| account
  account --> first
  account -->|"carregar"| resolve
  first -->|"sim"| send
  first -->|"não"| commDone
  send --> commDone
  resolve -->|"confirmada"| persist
  persist --> play
  resolve -->|"cancelar: preservar contexto"| play
  local -->|"login durante sessão"| provider
```

![Login, save local e comunicações](../imagens/fluxo-login.svg)

## 2. Loop da fase e persistência

Checkpoint e fim de fase são avaliados mesmo sem obstáculos. Na campanha, créditos não consolidados se perdem na morte; o modo multiplayer usa a regra própria RN08. A descida não contém créditos comuns. Após morte, scan do trecho volta a oculto. D06: salvamento persistente somente após autenticação; para visitante, marcos e snapshot existem apenas na sessão e são descartados ao fechar/recarregar.

```mermaid
flowchart TD
  start(["Iniciar / retomar fase"])
  run["Correr e processar ações / coleta"]
  lethal{"Colisão letal?"}
  death["Morrer: descartar créditos transitórios"]
  restore["Retomar início ou checkpoint; ocultar scan"]
  break{"Preso em quebrável?"}
  attack{"Atacou na janela?"}
  check{"Ativou checkpoint?"}
  save["Consolidar, salvar e retomar corrida"]
  finish{"Fim da fase?"}
  next(["Consolidar restante; clínica, Portão ou descida"])
  start --> run
  run --> lethal
  lethal -->|"sim"| death
  death --> restore
  restore --> run
  lethal -->|"não"| break
  break -->|"sim"| attack
  attack -->|"não"| death
  attack -->|"sim"| check
  break -->|"não"| check
  check -->|"sim"| save
  save --> finish
  check -->|"não"| finish
  finish -->|"não"| run
  finish -->|"sim"| next
```

![Loop da fase e persistência](../imagens/fluxo-gameplay.svg)

## 3. Clínica, implante e próxima fase

O procedimento acontece sem escolha de aceitar/recusar. Aceitação de Alex é narrativa. D06: atualizar estado da sessão; persistir cache e sincronizar na nuvem somente para conta autenticada. Visitante perde campanha ao fechar/recarregar. Falha de rede mantém cache da conta e pendência, sem bloquear gameplay.

```mermaid
flowchart TD
  start(["Concluir Fase 1–4"])
  scene["George: procedimento sem escolha sim/não"]
  implant["Instalar implante da fase"]
  ability["Atualizar corpo e habilidade"]
  local["Atualizar sessão; cache só se autenticado"]
  auth{"Autenticado?"}
  sync["Sincronizar e auditar no backend"]
  next(["Seguir para próxima fase"])
  error["Falha: manter local e informar pendência"]
  start --> scene
  scene --> implant
  implant --> ability
  ability --> local
  local --> auth
  auth -->|"sim"| sync
  auth -->|"não"| next
  sync -->|"sucesso"| next
  sync -->|"erro"| error
  error --> next
```

![Clínica, implante e próxima fase](../imagens/fluxo-clinica.svg)

## 4. Campanha completa e finais

A descida usa a ordem e o retry do fluxo específico. Snapshot pré-Portão permanece separado; restauração integral permite repetir a escolha. Corpo de Hollow é o estado preservado na quebra, sem novas retiradas. D06: salvamento persistente somente após autenticação; para visitante, marcos e snapshot existem apenas na sessão e são descartados ao fechar/recarregar.

```mermaid
flowchart TD
  start(["Novo Jogo confirmado / prólogo"])
  sectors["Fases 1–4 e clínicas em ordem"]
  top["Fase 5 — Topo"]
  snap["Salvar snapshot pré-Portão"]
  gate{"Aceitar conversão?"}
  chrome["Chrome: encontro físico com pai"]
  descent["Recusar: D1–D4 / memórias e ReForge"]
  chain{"Cadeia completa?"}
  flesh["Flesh: humano bioprintado / família"]
  hollow["Hollow: corpo preservado / transições / família"]
  menu["Créditos e menu pós-final"]
  restore["Continuar do Portão: restaurar snapshot"]
  start --> sectors
  sectors --> top
  top --> snap
  snap --> gate
  gate -->|"sim"| chrome
  gate -->|"não"| descent
  descent --> chain
  chain -->|"sim"| flesh
  chain -->|"quebrou"| hollow
  chrome --> menu
  flesh --> menu
  hollow --> menu
  menu -->|"continuar"| restore
  restore --> gate
  menu -->|"Novo Jogo confirmado"| start
```

![Campanha completa e finais](../imagens/fluxo-campanha.svg)

## 5. Descida — memória, retry e retirada

D10 aprovada: memória fica pendente até a retirada do implante da fase. Morte, reinício manual ou saída antes disso apagam a pendente e exigem recoleta; checkpoint não consolida. Retirada consolida memória, corpo e perda de habilidade juntos; memórias anteriores sobrevivem. Morte/saída/reinício não consomem retry por si sós. Retorno segue RN01/RN03; D12 aprovada: todas as memórias após o último checkpoint e antes da área de retirada, permitindo recoleta. D1 Topo/propulsores → D2 Corporativo/olhos → D3 Urbano/braços → D4 Industrial/pernas. George recusa ajuda somente na primeira etapa. D06: salvamento persistente somente após autenticação; para visitante, marcos e snapshot existem apenas na sessão e são descartados ao fechar/recarregar.

```mermaid
flowchart TD
  start(["Entrar no setor D1–D4"])
  play["Percorrer setor / procurar memória"]
  found{"Recuperou memória?"}
  endstage{"Concluiu sem memória?"}
  first{"Retry disponível?"}
  accept{"Aceita repetir?"}
  retry["Registrar retry; reiniciar setor"]
  hollow(["Quebrar cadeia; preservar corpo; Hollow"])
  pending["Memória após último checkpoint; antes da retirada"]
  travel["Percorrer caminho até a retirada"]
  lost{"Morreu, reiniciou ou saiu?"}
  clear["Perder pendente; manter consolidadas; recoleta ativa"]
  resume["Retomar conforme RN01/RN03; sem consumir retry"]
  arrived{"Chegou à retirada?"}
  george["Na primeira etapa: George recusa; buscar ReForge"]
  reforge["Retirar / bioprintar; consolidar memória e salvar"]
  last{"Quatro retiradas?"}
  flesh(["Epílogo Flesh"])
  start --> play
  play --> found
  play -->|"morte / reinício / saída"| clear
  found -->|"não"| endstage
  endstage -->|"não"| play
  endstage -->|"sim"| first
  first -->|"sim"| accept
  first -->|"não"| hollow
  accept -->|"sim"| retry
  accept -->|"não"| hollow
  retry --> play
  found -->|"sim"| pending
  pending --> travel
  travel --> lost
  lost -->|"sim"| clear
  clear -->|"ao retomar"| resume
  resume --> play
  lost -->|"não"| arrived
  arrived -->|"não"| travel
  arrived -->|"sim / primeira"| george
  arrived -->|"sim / demais"| reforge
  george --> reforge
  reforge --> last
  last -->|"sim"| flesh
  last -->|"não / próximo setor"| start
```

![Descida — memória, retry e retirada](../imagens/fluxo-descida.svg)

## 6. Partida multiplayer e resultado

Dois jogadores autenticados, salas no backend e resultados persistidos. D03 aprovada: entrada por código/link privado e cancelamento da sala se alguém sair antes da largada. D04 cobre autoridade, transporte e detecção de queda. Durante a janela única de 20 s, o segundo continua sujeito a morte, checkpoint e desconexão. Resultado não altera campanha nem define ranking global. WSS recomendado para protótipo; conexão recente antes da largada. Não retomar corrida após derrota. Duração máxima sem chegada, queda simultânea e falha de infraestrutura continuam em D04. Documento 14 detalha o ingresso aprovado.

```mermaid
flowchart TD
  start{"Dois jogadores prontos?"}
  race["Corrida WSS: estado e presença — D04"]
  drop{"Desconexão de rede?"}
  win["Vitória do adversário; exceções D04"]
  dead{"Jogador morreu?"}
  respawn["Início/checkpoint; manter tempo e créditos"]
  first{"Primeiro terminou?"}
  window["Abrir janela de 20 s"]
  second{"Segundo terminou no prazo?"}
  dnf["DNF para segundo / primeiro vence"]
  score["Comparar tempo ajustado; aplicar desempate"]
  result["Gravar classificação e auditar no backend"]
  launch["Largada simultânea"]
  menu(["Menu multiplayer"])
  auth{"Autenticado?"}
  login["Entrar com provedor externo"]
  valid{"Login concluído?"}
  room["Criar ou entrar em sala"]
  wait["Aguardar / cancelar — D04"]
  cancel(["Retornar ao menu sem entrar"])
  show(["Exibir vencedor / resultado"])
  start -->|"sim"| launch
  race --> drop
  drop -->|"sim"| win
  win --> result
  drop -->|"não"| dead
  dead -->|"sim"| respawn
  respawn --> first
  dead -->|"não"| first
  first -->|"não"| race
  first -->|"sim"| window
  window --> second
  second -->|"não"| dnf
  second -->|"sim"| score
  dnf --> result
  score --> result
  launch -.-> race
  menu --> auth
  auth -->|"não"| login
  auth -->|"sim"| room
  login --> valid
  valid -->|"sim"| room
  valid -->|"cancelou / erro"| cancel
  room --> start
  start -.->|"não"| wait
  wait -.->|"aguardar"| start
  wait -.->|"cancelar"| menu
  result --> show
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class race,win,wait pending
```

![Partida multiplayer e resultado](../imagens/fluxo-multiplayer.svg)

## 7. Gamepad físico — conexão e perda de dispositivo

D02 aprovada: desconexão pausa automaticamente a campanha e informa teclado disponível; retomada depende de ação do jogador, não apenas da reconexão. Multiplayer continua com aviso e alternativa pelo teclado. D01 ainda define mapeamento/hardware. Desconexão física não declara derrota de rede.

```mermaid
flowchart TD
  start(["Abrir jogo / conectar controle"])
  detect{"Controle reconhecido?"}
  keyboard["Informar e manter teclado"]
  map["Mapear ações — D01"]
  play["Jogar / navegar menus"]
  lost{"Controle desconectou?"}
  mode{"Está na campanha?"}
  pause["Pausar campanha e informar teclado"]
  continue["Multiplayer continua; informar teclado"]
  resume["Controle ou teclado: retomar por ação do jogador"]
  start --> detect
  detect -->|"não"| keyboard
  detect -.->|"sim"| map
  keyboard --> play
  map -.->|"mesmas ações"| play
  play --> lost
  lost -->|"não"| play
  lost -->|"sim"| mode
  mode -->|"sim"| pause
  mode -->|"não"| continue
  pause --> resume
  resume --> play
  continue --> play
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class map pending
```

![Gamepad físico — conexão e perda de dispositivo](../imagens/fluxo-gamepad.svg)

## 8. Publicação automática de produção

Pipeline publica serviços alterados de forma independente; base compartilhada e contratos versionados em Pulumi. Dev em nuvem usa stack própria. A seleção de Lambda e serviços gerenciados reduz compute permanente; implantação depende de quotas/plano/custos confirmados para a conta ainda não criada. Pulumi gerencia zona/registros Route 53 e certificados ACM na base. A verificação pós-deploy inclui resolução DNS e HTTPS; nameservers dependem da delegação inicial no registrador.

```mermaid
flowchart TD
  push(["Push na branch de produção"])
  ci["CI: checks e build"]
  ok{"Validação passou?"}
  fix["Corrigir e enviar novo commit"]
  iac["Aplicar Pulumi na stack de produção"]
  publish["Publicar frontend / serviços alterados"]
  health{"Verificação pós-deploy passou?"}
  prod(["Produção disponível no domínio"])
  fail["Sinalizar falha; recuperar versão conforme estratégia"]
  push --> ci
  ci --> ok
  ok -->|"não"| fix
  fix --> ci
  ok -->|"sim"| iac
  iac -->|"sucesso"| publish
  iac -->|"erro"| fail
  publish -->|"sucesso"| health
  publish -->|"erro"| fail
  health -->|"sim"| prod
  health -->|"não"| fail
```

![Publicação automática de produção](../imagens/fluxo-deploy.svg)

## 9. Salas privadas — código e link (D03 aprovada)

Modelo aprovado: convite aleatório de 10 caracteres, expiração de lobby em 10 min e uma partida ativa por conta. Código/link compartilham o mesmo convite; sem busca pública. Reserva da segunda vaga em transação. Saída antes da largada cancela a sala. TTL apenas limpa resíduos; duração/autoridade da corrida continuam em D04. Histórico privado de 30 dias. Documento 14.

```mermaid
flowchart TD
  host(["Criador autenticado"])
  create["REST: criar sala e convite"]
  db["Partidas: sala, convite e vínculo ativo"]
  share["Copiar código ou link; compartilhar"]
  guest(["Convidado: abrir link ou digitar código"])
  login["Autenticar e confirmar entrada"]
  join["Resolver código por chave direta"]
  valid{"Convite vigente e vaga livre?"}
  deny(["Recusar sem expor sala privada"])
  reserve["Reservar vaga e consumir convite atomicamente"]
  lobby["Lobby privado: dois participantes"]
  ready{"Dois prontos e conexão válida?"}
  wait["Aguardar; tratar saída ou expiração"]
  start(["Iniciar corrida pelo canal D04"])
  host --> create
  create --> db
  db --> share
  share -->|"convite"| guest
  guest --> login
  login --> join
  join --> valid
  valid -->|"não"| deny
  valid -->|"sim"| reserve
  reserve -->|"condições mantidas"| lobby
  reserve -->|"vaga perdida"| deny
  lobby --> ready
  ready -->|"não"| wait
  wait -->|"se ainda vigente"| lobby
  ready -.->|"sim"| start
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class ready,start pending
```

![Salas privadas — código e link (D03 aprovada)](../imagens/fluxo-salas-convite.svg)

## 10. Central e e-mail seletivo (D07 aprovada)

D07 aprovada: central com categorias, leitura e preferências; sem polling contínuo nem avisos por frame. Compra gera confirmação apenas no jogo. SES envia boas-vindas e final habilitado; SNS Standard e SQS de feedback registram entrega/bounce/reclamação. Retenção de exibição não elimina prematuramente deduplicação. Modelo do documento 14 aprovado; implementação ainda não executada.

```mermaid
flowchart TD
  event(["Evento de Conta, Campanha ou Partidas"])
  queue["Outbox / publicador → SQS Comunicações"]
  worker["Lambda: categoria, preferência e deduplicação"]
  inbox["DynamoDB: central da conta"]
  email{"Boas-vindas ou final habilitado?"}
  read["REST: consultar e marcar leitura"]
  skip(["Somente central"])
  ses["SES: enviar e registrar correlação"]
  end(["Menu: avisos e preferências"])
  sns["SNS: entrega, bounce ou reclamação"]
  feedback["SQS feedback → Lambda Comunicações"]
  delivery["Atualizar entrega / suprimir endereço inválido"]
  retry["Falha transitória: tentativas limitadas"]
  dlq(["DLQ e alarme; reconciliar envio incerto"])
  event --> queue
  queue --> worker
  worker --> inbox
  worker --> email
  inbox --> read
  read --> end
  email -->|"não"| skip
  email -->|"sim"| ses
  ses -->|"feedback assíncrono"| sns
  sns --> feedback
  feedback --> delivery
  ses -->|"erro transitório"| retry
  retry -->|"se elegível"| ses
  retry -->|"limite / ambiguidade"| dlq
```

![Central e e-mail seletivo (D07 aprovada)](../imagens/fluxo-notificacoes.svg)

# Fluxogramas

Projeto: **Flesh to Chrome** — especificação da Sprint 1.

Fonte única: [`../diagramas.json`](../diagramas.json). Mermaid e SVG abaixo são gerados por `python3 isn/scripts/gerar_diagramas.py` a partir da raiz do repositório. Não editar as versões geradas separadamente.

Os diagramas descrevem o sistema planejado, não comprovam implementação. Propostas e decisões pendentes têm rótulo Dxx e/ou traço pontilhado; ver [registro de decisões](07-decisoes-pendentes.md).

## 1. Login, save local e comunicações

Primeiro cadastro, e não ausência de save, dispara boas-vindas. Login não é necessário para persistência local. D05 define reconciliação; envio de comunicação é independente e não bloqueia carregar a campanha.

```mermaid
flowchart TD
  start(["Abrir site / menu"])
  login{"Entrar na conta?"}
  local["Carregar ou criar save local"]
  provider["Autenticar: Cognito + Google"]
  ok{"Login válido?"}
  account["Identificar conta e auditar"]
  first{"Primeiro cadastro?"}
  resolve["Comparar saves local e remoto — D05"]
  send["Solicitar e-mail + notificação sem bloquear — D07"]
  play(["Continuar campanha"])
  commDone(["Fim da tarefa de comunicação"])
  start --> login
  login -->|"não"| local
  local --> play
  login -->|"sim"| provider
  provider --> ok
  ok -->|"cancelou / erro"| start
  ok -->|"sim"| account
  account --> first
  account -.->|"carregar"| resolve
  first -.->|"sim"| send
  resolve -.->|"após reconciliação"| play
  first -->|"não"| commDone
  send -.-> commDone
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class resolve,send pending
```

![Login, save local e comunicações](../imagens/fluxo-login.svg)

## 2. Loop da fase e persistência

Checkpoint e fim de fase são avaliados mesmo sem obstáculos. Na campanha, créditos não consolidados se perdem na morte; o modo multiplayer usa a regra própria RN08. A descida não contém créditos comuns. Após morte, scan do trecho volta a oculto.

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

ZIP RF15 e UC05 esclarecem que o procedimento acontece sem escolha de aceitar/recusar. Aceitação de Alex é narrativa. Save local permanece conforme GDD; sincronização em nuvem só para autenticado, sem bloquear gameplay por falha de rede.

```mermaid
flowchart TD
  start(["Concluir Fase 1–4"])
  scene["George: procedimento sem escolha sim/não"]
  implant["Instalar implante da fase"]
  ability["Atualizar corpo e habilidade"]
  local["Salvar localmente"]
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

A descida usa a ordem e o retry do fluxo específico. Snapshot pré-Portão permanece separado; restauração integral permite repetir a escolha. Corpo de Hollow é o estado preservado na quebra, sem novas retiradas.

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

D1 Topo/propulsores → D2 Corporativo/olhos → D3 Urbano/braços → D4 Industrial/pernas. Apenas a conclusão do setor sem memória aciona a falha especial. Morte/reinício durante tentativa seguem RN03/RN06, sem consumir retry. D10 define persistência da memória antes do procedimento.

```mermaid
flowchart TD
  start(["Entrar no setor D1–D4"])
  play["Percorrer setor / procurar memória"]
  found{"Recuperou memória?"}
  endstage{"Concluiu sem memória?"}
  first{"Retry disponível?"}
  accept{"Aceita repetir?"}
  retry["Registrar retry usado; reiniciar setor"]
  george["Primeira retirada: George recusa ajudar"]
  reforge["ReForge: retirar implante e bioprintar"]
  persist["Salvar retirada, corpo e habilidade"]
  last{"Quatro retiradas?"}
  flesh(["Epílogo Flesh"])
  hollow(["Quebrar cadeia: preservar corpo e seguir Hollow"])
  start --> play
  play --> found
  found -->|"não"| endstage
  endstage -->|"não"| play
  endstage -->|"sim"| first
  first -->|"sim"| accept
  first -->|"não"| hollow
  accept -->|"sim"| retry
  accept -->|"não"| hollow
  retry --> play
  found -->|"sim / primeira"| george
  found -->|"sim / demais"| reforge
  george --> reforge
  reforge --> persist
  persist --> last
  last -->|"sim"| flesh
  last -->|"não / próximo setor"| start
```

![Descida — memória, retry e retirada](../imagens/fluxo-descida.svg)

## 6. Partida multiplayer e resultado

Login dos dois participantes, criação/entrada em sala e resultado/classificação persistidos são definidos pelo ZIP. D03 cobre a descoberta da sala; D04 cobre protocolo e casos de cancelamento/desconexão. Durante a janela única de 20 s, o segundo continua sujeito a morte, checkpoint e desconexão. Resultado não altera campanha nem define ranking global.

```mermaid
flowchart TD
  start{"Dois jogadores prontos?"}
  race["Processar corrida e sincronizar — D04"]
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

D01 define mapeamento/hardware; D02 propõe pausa automática na campanha. A desconexão física não declara derrota multiplayer: o jogador pode continuar pelo teclado e a partida não pausa.

```mermaid
flowchart TD
  start(["Abrir jogo / conectar controle"])
  detect{"Controle reconhecido?"}
  keyboard["Informar e manter teclado"]
  map["Mapear ações — D01"]
  play["Jogar / navegar menus"]
  lost{"Controle desconectou?"}
  mode{"Está na campanha?"}
  pause["Proposta D02: pausar e informar fallback"]
  continue["Multiplayer continua; informar teclado"]
  resume["Reconectar / usar teclado e retomar"]
  start --> detect
  detect -->|"não"| keyboard
  detect -.->|"sim"| map
  keyboard --> play
  map -.->|"mesmas ações"| play
  play --> lost
  lost -->|"não"| play
  lost -->|"sim"| mode
  mode -.->|"sim"| pause
  mode -->|"não"| continue
  pause -.->|"D02"| resume
  resume -.->|"D02"| play
  continue --> play
  classDef pending fill:#fff7ed,stroke:#b45309,stroke-dasharray:5 4
  class map,pause,resume pending
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

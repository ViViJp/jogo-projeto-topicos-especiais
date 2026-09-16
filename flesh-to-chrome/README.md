# Flesh to Chrome — protótipo técnico

Auto-runner 2D cyberpunk baseado no GDD `gdd.md`, na ideia original
`Cyberpunk.md` e no `levelDesign.md` do projeto acadêmico.

Stack conforme a Seção 22 do GDD: **TypeScript + Phaser `^4.2.1` + Parcel**.

## Changelog

- **v0.4.1** — dois pedidos separados. (1) **Fundo cinza, não mais
  quase-preto** - depois de assistir aos vídeos de gameplay enviados
  (não tinha realmente analisado quadro a quadro antes - ver "Correções e
  decisões de v0.4.1"), ficou claro que o problema de "sombra" nunca foi
  só a cor de fundo: a calça/bota de Alex já são desenhadas quase pretas
  na própria arte (`#200c0d`, luminância ~18) e cobrem ~9,7% do sprite -
  contra um fundo também quase preto (`#000010`, v0.3.2), a perna
  praticamente some. Só dava pra abrir mais distância indo mais CLARO, não
  mais escuro - exatamente o pedido do usuário. Novo fundo `#36393c`
  (cinza levemente frio, luminância ~57), recalibrado pelo mesmo método
  de luminância mas maximizando a menor distância nos DOIS sentidos (não
  só pra baixo) dentro de uma faixa que ainda lê como "cinza" pro clima
  do jogo. (2) **Bug do checkpoint corrigido: personagem caía
  infinitamente ao reaparecer.** Causa: o runtime só guardava o X do
  checkpoint, nunca o Y - inofensivo no mapa antigo (uma elevação de chão
  só), mas quebrado no mapa da v0.4.0 (duas elevações): o único checkpoint
  real do mapa fica na elevação "principal" (~80px mais alto na tela que
  a elevação "profunda" do spawn), então o respawn sempre reaparecia
  Alex abaixo do chão de verdade, direto num vão sem fundo - um loop de
  queda/morte/respawn no mesmo lugar quebrado. Corrigido guardando e
  usando o Y de cada checkpoint (`TiledCheckpointObj.y`, `GameSceneData.
  checkpointY`, `SaveData.checkpoint.y` - aditivo, não quebra saves
  antigos nem o formato documentado na Seção 20.1). Ver "Correções e
  decisões de v0.4.1" pro detalhe completo dos dois.
- **v0.4.0** — troca do blockout da Fase 1 por um mapa Tiled novo/mais
  completo, encontrado dentro do `.rar` do projeto pai enviado
  (`jogo-projeto-topicos-especiais.rar`) a pedido explícito ("verifica se
  existe um outro mapa... implemente ele... mexer apenas se existir uma
  outra versão do mapa") - confirmado que é de fato uma versão diferente
  (1050×28 tiles, era 720×20) antes de tocar em qualquer coisa. Mudanças:
  (1) **mapa novo integrado** - duas elevações de chão, plataformas
  opcionais de risco, e agora dois tilesets no mesmo mapa (`tileset-sewer`
  pro chão/primeiro plano, como antes, e `crystal-cave-tiles`, novo, só
  pro pano de fundo distante da caverna). (2) **hazards por objeto de
  verdade** - o mapa antigo nunca teve nenhum objeto real da classe
  `hazard` (só um `hazard=true` nos tiles, mecanismo velho da v0.2.0); este
  segue o contrato (§5.3) com objetos `hazard`/`kind` na layer `objects` -
  poços de água tóxica (já existiam) e um tipo novo, `electric_wire`
  (fios na altura da cabeça, exigindo passar deslizando por baixo - **não
  documentado no contrato**, comportamento inferido pela geometria do
  objeto e testado explicitamente, ver "Correções e decisões de v0.4.0").
  (3) **altura do pulo (`-640`) mantida sem alteração**, mas revalidada do
  zero no mapa novo - não só pelo script de coluna, mas por playthrough
  completo no motor de física real (chegou até a Clínica sem nenhuma
  morte) mais rastreamento frame a frame da trajetória nos dois pontos
  mais arriscados do mapa (o degrau de subida de elevação e uma zona de
  teto baixo que só se passa deslizando). (4) **pose de agachamento/slide
  conferida contra o mapa novo e contra o `electric_wire`** especificamente
  - testado que correr por baixo do fio sem deslizar mata e que deslizar
  passa ileso, nas duas ocorrências do hazard no mapa; os 4 poços de água
  tóxica também testados individualmente (todos matam ao toque). (5)
  **"sombra"** - fundo calibrado por luminância na v0.3.2 (`#000010`)
  mantido sem remedir (conferido que a layer `background` do mapa novo
  nunca sobrepõe onde o personagem realmente passa) e reconfirmado
  visualmente com screenshots novos, correndo e deslizando sobre o
  terreno novo. Ver "Correções e decisões de v0.4.0" para o detalhe de
  cada validação, incluindo uma observação de level design registrada (não
  corrigida silenciosamente) sobre degraus que exigem pulo no meio do
  percurso normal.
- **v0.3.2** — segunda rodada no mesmo par de ajustes da v0.3.1, depois de
  feedback dizendo que "tudo continua igual" mesmo após aquela entrega.
  Investigação completa antes de mexer em qualquer valor (ver "Correções e
  decisões de v0.3.2" para o passo a passo): o build entregue em zip da
  v0.3.1 excluía a pasta `dist/` de propósito (só o código-fonte, pra não
  duplicar peso), e por isso é bem possível que o problema real tenha sido
  rodar o build antigo por engano - mas os dois ajustes em si também foram
  reavaliados e um deles, de fato, era pequeno demais pra se perceber.
  (1) **"sombra"** - o critério da v0.3.1 (maior distância de COR/matiz
  entre o fundo e os tons da arte) media a coisa errada: contraste visual
  entre cores escuras é dominado por diferença de LUMINÂNCIA (brilho), não
  de matiz, e o fundo escolhido (`#000345`) tinha distância de cor alta mas
  luminância quase idêntica à dos tons mais escuros da arte (gap de só 8,5
  num intervalo 0-255) - por isso continuava "sumindo" apesar da métrica
  antiga parecer boa. Novo fundo (`#000010`, quase preto) escolhido
  maximizando o gap de LUMINÂNCIA contra os tons realmente significativos
  do spritesheet (>=0,05% dos pixels, pra não perseguir ruído de poucos
  pixels) - gap de ~16,3, quase o dobro do anterior e perto do teto teórico
  do formato de arte usado (~18,1, só alcançável com preto absoluto, que
  colidiria com uns poucos pixels de contorno preto puro da própria arte).
  Confirmado visualmente (zoom em screenshot real de gameplay, não só a
  métrica) - ver "Correções e decisões de v0.3.2". (2) **altura do pulo** -
  tentativa de reduzir mais (`-640` → `-600`, depois `-620`) revertida: a
  validação por "distância de coluna" usada até aqui (checa só se o PONTO
  de pouso cai sobre uma coluna com chão) não simula a trajetória vertical
  do salto, e um playthrough real (bot no motor de física de verdade, não
  só o script analítico) mostrou o personagem "raspando" na parede de uma
  plataforma estreita da Fase 1 em vez de pousar em cima dela, com os dois
  valores testados - morte 100% reproduzível. `-640` (já validado por
  completo na v0.3.1) é o piso seguro conhecido para essa sequência
  específica de plataformas; reduzir mais exigiria redesenhar essa parte do
  mapa, não só ajustar a física global - por ora o pulo fica como estava.
- **v0.3.1** — dois ajustes de playtest na Fase 1 (mapa Tiled real,
  v0.3.0): (1) **pulo mais baixo** - `PHYSICS.jump.velocityY` de -680 para
  -640 (altura máxima 144,5px→128px, alcance horizontal 272px→256px);
  como esse valor é global (não há física por fase neste motor), a Fase
  2-intro também é afetada - conferido que nenhum gap dela fica maior que
  o novo alcance (o mais apertado, 230px na "rota de risco", já vem depois
  do salto duplo ser liberado, então tem essa folga extra como rede de
  segurança mesmo assim). A Fase 1 foi revalidada por completo com o novo
  valor (mesma metodologia da v0.3.0: janela de decolagem exata + dois
  percursos completos num Chromium headless) - continua sem nenhuma morte
  obrigatória, e a margem mínima entre travessias na verdade **melhorou**
  (63px contra 47px antes, coincidência da nova geometria de salto com o
  ritmo específico deste mapa). (2) **"sombra" no personagem, de novo** -
  o mesmo bug de contraste da v0.2.2 (ver aquele changelog), mas dessa vez
  contra o céu do mapa Tiled: medindo todos os tons opacos do spritesheet
  de Alex, a calça (`#101414`) ficava só ~24 de distância de cor do fundo
  da Fase 1 (`#080e2a`, o tom "corrigido" na v0.2.2) - próxima o bastante
  pra "sumir" visualmente contra o fundo escuro, sobretudo parado/andando.
  Novo fundo (`#000345`) escolhido varrendo a paleta inteira da arte (não
  só o tom antes identificado) em busca da maior distância mínima possível
  dentro de uma faixa igualmente escura - agora >50 de distância de
  qualquer tom da arte, o dobro do critério anterior. Ver "Correções e
  decisões de v0.3.1" para o detalhe de cada medição.
- **v0.3.0** — reintegra o mapa real da Fase 1 (Tiled) seguindo o
  `TILED_PHASER_CONTRACT1.md` (v0.1, recebido da equipe), revertendo a
  decisão "provisória" da v0.2.1 só para essa fase. A Fase 1 agora carrega
  `src/assets/maps/esgoto/fase-1.json` de verdade (`TiledFase1.ts` +
  `TiledLevelRuntime.ts`, novo runtime dedicado, no lugar de
  `LevelBuilder`/`phase1.ts`); a Fase 2-intro **continua** no formato
  desenhado à mão (o contrato só cobre grid 16×16 da Fase 1 - as outras
  fases ainda estão em 32×32 e não formalizadas). Física mantida em
  320px/s e gravidade 1600 (a mesma da v0.2.1/v0.1, não a recalibração da
  v0.2.0) - ver "Correções e decisões de v0.3.0" para o detalhe técnico
  completo (a observação sobre `type`/`class`, o offset vertical, o bug de
  boot do Parcel encontrado e corrigido, a divergência do mecanismo de
  hazard entre contrato e mapa real, e principalmente a metodologia de
  validação usada pra garantir que a fase é jogável de ponta a ponta com a
  física atual, incluindo dois enganos do próprio processo de validação
  que quase geraram um relatório de bug falso - registrados ali para quem
  for revalidar no futuro).
- **v0.2.2** — corrige o "personagem continua como se tivesse uma sombra"
  reportado em playtest logo após a v0.2.1. Não era um bug de
  renderização: a arte LPC de Alex não tem nenhuma camada de sombra
  própria (conferido pixel a pixel — o PNG só tem alpha 0 ou 255, sem
  nenhum pixel semitransparente). O problema era falta de contraste: os
  tons de sombreado da própria arte (cabelo cobrindo um olho, calça)
  incluem um tom (`#101414`) quase idêntico ao fundo da Fase 1
  (`#0a1410` — distância de cor ~7, imperceptível), então esses pedaços
  do personagem "somiam" visualmente no fundo escuro e davam a impressão
  de uma sombra grudada nele, principalmente parado/andando devagar. A
  primeira tentativa de correção (um sprite-contorno ciano atrás de Alex)
  piorou as coisas — como a arte não fica centralizada dentro do frame
  64×64, o contorno ficava desproporcional para um lado e criava exatamente
  o mesmo efeito de "sombra", só que azul; foi descartada. A correção que
  ficou foi trocar as cores de fundo por fase (`PHASE_BACKGROUND` em
  `GameScene.ts`) por tons igualmente escuros mas medidos para ficarem
  longe de todos os tons escuros do spritesheet (Fase 1: `#0a1410` →
  `#080e2a`; Fase 2-intro: `#140f0a` → `#100802`) — mesmo clima sombrio,
  sem nenhum tom da arte coincidindo com o fundo. Validado visualmente com
  captura de tela (personagem lendo nitidamente contra o novo fundo, sem
  nenhum pedaço "sumindo").
- **v0.2.1** — reverte o nível/mapa da v0.2.0 de volta ao formato
  desenhado à mão (`LevelBuilder`/`phase1.ts`), **mantendo** a arte real
  de Alex (spritesheet LPC) e a correção do tremor de câmera. Em
  playtest, a integração dos mapas Tiled reais fez a gameplay ficar
  "estranha"/menos fluida: com a física recalibrada para a escala dos
  mapas (180px/s, gravidade 900), os pulos ficaram bem mais altos e
  lentos (quase o dobro do tempo no ar: ~1,51s contra ~0,85s antes), e o
  ritmo de gaps de algumas fases (ex.: Fase 2, gaps de 128px separados por
  plataformas de só 192px) obrigava o jogador a pular quase
  ininterruptamente — o efeito visual de pular a cada instante, com pulos
  altos e lentos, é o que provavelmente foi percebido como o personagem
  "tremendo": não é um bug de renderização (a posição do sprite foi
  medida frame a frame e está estável parado/correndo no chão — ver
  commit desta versão), é o padrão de movimento em si ficando repetitivo
  e "pulante" demais. `BASE_RUN_SPEED`/`GRAVITY_Y`/`doubleJump.airControl`
  voltam aos valores da v0.1.2 (320 / 1600 / 140) e o carregamento de
  fase volta a usar `src/levels/index.ts` (`LEVELS`) em vez de
  `TiledPhases`/`LevelRuntime` orientado a tilemap. Os mapas Tiled e os
  demais assets entregues (`src/assets/`) **continuam no projeto** — só
  não são carregados pelo `GameScene` nesta versão — para uma eventual
  reintegração futura seguir a recomendação de dimensão na seção
  "Reintegrando os mapas Tiled no futuro", mais abaixo.
- **v0.2.0** — integração da arte e dos mapas reais entregues pela equipe
  (pasta `.rar` recebida): os 5 mapas Tiled (`fase-1`..`fase-5`) e o
  spritesheet LPC de Alex (`alex-flesh.png`) substituem por completo os
  placeholders e o nível desenhado à mão da v0.1. Como os mapas reais têm
  uma escala bem diferente da que o protótipo assumia, o motor foi
  **reconstruído em cima deles** (decisão tomada explicitamente com a
  equipe, ver discussão no início deste ciclo): física recalibrada
  (`BASE_RUN_SPEED`, `GRAVITY_Y`, hitbox de Alex — todos medidos a partir
  dos mapas/sprites reais, não mais "provisório"), leitura de fase migrada
  de `LevelBuilder`/`phase1.ts` para os `.json` do Tiled
  (`src/levels/TiledPhases.ts` + `src/objects/LevelRuntime.ts`), e as 5
  fases (não mais só a Fase 1 + início da Fase 2) validadas matemática e
  empiricamente de ponta a ponta. Ver "Correções e decisões de v0.2.0"
  mais abaixo para o detalhe de cada bug encontrado (dois deles bem sérios
  — colisão de chão e carregamento do mapa, ambos silenciosos até serem
  testados) e o escopo explicitamente deixado de fora desta entrega.
- **v0.1.2** — corrigidos dois problemas reportados no segundo playtest: o
  slide só voltava a ficar em pé depois do tempo máximo (550ms), ignorando
  quando o jogador soltava o botão antes disso; e o trecho dos "fios
  energizados" (e toda a "sequência de domínio" logo depois) tinha
  espaçamento curto demais entre o fim de um gap e o obstáculo aéreo
  seguinte, tornando aquele trecho impossível de passar dependendo de
  quando o jogador pulasse — o "muro amarelo sem solução" relatado. Ver
  "Correções" mais abaixo para o detalhe técnico e como foi validado.
- **v0.1.1** — corrigidos dois bugs reportados em playtest: o slide fazia o
  personagem afundar/atravessar o chão (o corpo físico e o sprite visual
  descasavam ao redimensionar o hitbox) e o cano baixo matava o jogador no
  meio de um pulo, mesmo passando visualmente por cima dele (a colisão do
  obstáculo aéreo só checava a posição X, ignorando a altura). Ver
  "Correções" mais abaixo para o detalhe técnico.
- **v0.1.0** — entrega inicial (Marco 1 + Marco 2).

## O que esta build entrega

Esta entrega implementa o **Marco 2 — Vertical Slice** do cronograma (GDD
seção 24.2), com toda a arquitetura de sistemas já pronta para os marcos
seguintes. Desde a v0.3.0, a **Fase 1 usa o mapa Tiled real** entregue pela
equipe, seguindo `TILED_PHASER_CONTRACT1.md` (ver Changelog e "Correções e
decisões de v0.3.0" abaixo); a **Fase 2-intro continua** no formato
desenhado à mão da v0.1 (`LevelBuilder`/`phase2Intro.ts`), porque o
contrato ainda só cobre o grid 16×16 da Fase 1 — ver "Reintegrando os
mapas Tiled das Fases 2-5" para a próxima etapa dessa migração:

- Corrida automática, pulo, slide, salto duplo — com os tempos/valores de
  referência da Seção 14 do GDD (todos marcados como "provisório" onde o
  GDD pede validação por playtest — Seção 26).
- Matriz de compatibilidade de ações da Seção 14.11 (o que pode ser feito
  em cada estado: correndo, no ar, em slide, em dash, preso em quebrável).
- Ataque, scan e dash **já implementados no `PlayerController`**
  (`src/entities/Player.ts`), prontos para ligar quando `abilities.arms`,
  `abilities.eyes` e `abilities.thrusters` forem ativados nas próximas
  fases — não é necessário reescrever a máquina de estados do jogador.
- Sistema de créditos com consolidação por checkpoint, anti-farming por
  ID único e descarte de créditos não consolidados ao morrer (Seção 14.4).
- Checkpoints diegéticos (visual/trigger — a animação "jogando videogame"
  fica para quando houver arte final).
- Save único em `localStorage`, no formato descrito na Seção 20.1 (já com
  os campos de descida/fragmentos/finais reservados para o Marco 4).
- HUD (`Créditos da fase: X/Y`, `Total: Z`), câmera seguindo Alex a ~35%
  da tela (Seção 22.4), pausa que congela física/tweens (Seção 19.2).
- **Fase 1 — Esgoto/Periferia completa**, carregada a partir do mapa Tiled
  real (`fase-1.json`, layers `ground`/`hazards`/`deco`/`objects` — ver
  "Correções e decisões de v0.3.0"): spawn → gaps sobre água tóxica →
  rota de créditos normal (chão) / risco (plataforma elevada) → checkpoint
  → trecho final → saída para a Clínica de George → pernas mecânicas →
  salto duplo liberado. Validada matemática e empiricamente de ponta a
  ponta (ver metodologia abaixo) - nenhuma morte obrigatória em nenhuma
  das 15 travessias de gap da fase.
- **Início da Fase 2 — Industrial**: gap impossível de salto simples, teste
  seguro do salto duplo e uma rota de risco com créditos, encerrando numa
  tela de "fim do protótipo" com o roadmap restante (não é um final
  narrativo — ver `src/scenes/EndingScene.ts`).
- Alex usa o spritesheet LPC real (`alex-flesh.png`, seção 23.1, mantido
  da v0.2.0), com corrida animada e hitbox medida a partir do
  bounding-box alfa dos frames reais (`src/utils/AlexSprite.ts`). O
  spritesheet não tem uma pose própria de "deslizar" (só um "sentar");
  até a arte final trazer uma pose dedicada, o slide usa o frame existente
  mais próximo — puramente cosmético, não afeta a hitbox nem a mecânica.
  O resto do nível (chão, canos, água, quebráveis) continua em
  placeholder gerado em runtime (`src/utils/PlaceholderTextures.ts`).
- Todas as cenas da Seção 22.2 existem no código (`Boot`, `Menu`, `Game`,
  `Clinic`, `Ending`, `Multiplayer`), inclusive as que ainda são stubs.

## Como rodar

```bash
npm install
npm run dev      # servidor de desenvolvimento com hot reload
# ou
npm start        # mesma coisa, abrindo o navegador automaticamente
```

Outros comandos:

```bash
npm run typecheck   # tsc --noEmit
npm run build        # build de produção em dist/
```

Testado com Node 22 / npm 10. O build de produção foi verificado tanto por
`tsc --noEmit` quanto rodando a build final num Chromium headless (boot do
Phaser, navegação de menu, corrida, pulo, slide, morte e reinício do
checkpoint — sem erros de console). A partir da v0.3.0, a Fase 1 (mapa
Tiled real) tem validação adicional: percursos completos do spawn até a
Clínica de George sem nenhuma morte, incluindo o mapa atual (v0.4.0) e
seus hazards por objeto testados individualmente — ver "Correções e
decisões de v0.4.0" e "Correções e decisões de v0.3.0".

## Controles (Seção 19.1 do GDD)

| Ação | Teclas |
| --- | --- |
| Pulo / Salto duplo | Espaço, W, ↑ |
| Slide | S, ↓ |
| Ataque | J, clique esquerdo |
| Scan | L, E |
| Dash | K, Shift |
| Pausa / voltar | Esc |
| Confirmar | Enter |

## Arquitetura

```
src/
  main.ts                 # bootstrap do Phaser.Game
  config/                 # constantes (dimensões, física, teclas)
  scenes/                 # Boot, Menu, Game, Clinic, Ending, Multiplayer
  entities/Player.ts       # PlayerController (máquina de estados completa)
  systems/                 # Input, Créditos, Save, HUD, Habilidades
  levels/                  # dados de fase (builder sequencial + registry)
  levels/TiledFase1.ts     # config/import estático do mapa Tiled da Fase 1
  objects/LevelRuntime.ts        # runtime da(s) fase(s) desenhada(s) à mão
  objects/TiledLevelRuntime.ts   # runtime da Fase 1 a partir do mapa Tiled
  utils/AlexSprite.ts      # frames/animações do spritesheet LPC real
  utils/PlaceholderTextures.ts  # texturas placeholder do resto do nível
  assets/maps/**/*.json    # os 5 mapas Tiled reais (fase-1 .. fase-5) -
                           # só fase-1.json é carregado pelo GameScene
                           # nesta versão, ver "Reintegrando os mapas
                           # Tiled das Fases 2-5" abaixo
  assets/tiles/**          # tilesets de cada fase (idem)
  assets/player/           # spritesheet LPC de Alex (em uso)
```

### Sobre o formato de nível

O GDD define Tiled/JSON como ferramenta de level design (Seção 7.1). A
v0.2.0 chegou a integrar os 5 mapas Tiled reais entregues pela equipe, mas
a v0.2.1 reverteu tudo (ver Changelog) porque a gameplay resultante ficou
pior; a v0.3.0 reintegra especificamente a **Fase 1**, agora seguindo
`TILED_PHASER_CONTRACT1.md` e com a física original (320px/s, gravidade
1600 — não a recalibração da v0.2.0). `GameScene.ts` decide por fase qual
runtime usar (`isTiledPhase()`): `fase1` carrega `TiledLevelRuntime` a
partir de `fase-1.json`; `fase2-intro` continua no formato próprio
(`LevelBuilder`/`LevelTypes.ts`, via `src/levels/index.ts`/`LEVELS`), com
cada fase descrita por um `LevelBuilder` sequencial (chão, gaps,
obstáculos aéreos, créditos, checkpoints) na mesma ordem dos nós dos
fluxogramas de `levelDesign.md` — os comentários no código de
`phase2Intro.ts` apontam para cada nó correspondente.

Os mapas `.json` do Tiled e os tilesets reais das Fases 2-5 **continuam no
repositório** (`src/assets/maps/`, `src/assets/tiles/`) para quando fizer
sentido migrá-las também — ver a seção logo abaixo.

### Reintegrando os mapas Tiled das Fases 2-5

A reintegração da Fase 1 na v0.3.0 confirma que **é possível usar os
mapas Tiled reais sem reproduzir o problema da v0.2.0**, desde que dois
cuidados sejam respeitados — os mesmos já identificados na v0.2.1 e agora
validados na prática:

- **Tile 32×32px** (o que a equipe já usa) está ótimo — o problema nunca
  foi o tamanho do tile.
- **Gaps de até ~6-7 tiles (96-112px, tile 16×16) ou ~3 tiles (96px, tile
  32×32)** por pulo simples, deixando uma margem real sob os 256px de
  alcance máximo do salto simples (valor atualizado na v0.3.1 - era
  272px até a v0.3.0). Gaps maiores só em fases com salto duplo liberado
  (Fase 2 em diante), com boa margem mesmo assim.
- **Plataformas de pelo menos ~8-10 tiles (256-320px)** entre um gap e o
  próximo — é exatamente o número que faltou na Fase 2 real (192px foi
  curto demais) e o que faz o jogador *correr* em vez de só encadear
  pulos. Regra prática: se o jogador consegue pousar e precisar pular de
  novo em menos de meio segundo (~160px a 320px/s), a plataforma está
  curta demais.
- **Altura total do mapa até ~18-20 tiles (576-640px)**, cabendo dentro
  dos 720px da tela — este motor **não tem scroll vertical de câmera**
  (`GameScene.update()` só ajusta `scrollX`), então qualquer parte do
  mapa acima ou abaixo da janela de 720px fica invisível mesmo que a
  física continue normal por baixo dos panos. Reserve uns 100-120px no
  topo para a HUD não sobrepor a ação.
- Uma única fileira de chão "andável" por coluna (ou 2-3 linhas
  empilhadas só por profundidade visual) — é o modelo que o script de
  validação (`ground_nodes`, descrito na v0.2.0) já assume.

Com essas faixas respeitadas, o mesmo script de reachability construído
para a v0.2.0 (grafo de nós + janela de decolagem com folga mínima)
continua servindo para validar a fase antes de qualquer playtest — só que
com um refinamento importante descoberto validando a Fase 1 na v0.3.0: ver
"Metodologia de validação (atualizada na v0.3.0)" mais abaixo antes de
reusar o script, porque a versão simples (só checar se o pouso alcança o
**início** da próxima plataforma) pode aprovar erradamente uma travessia
que na verdade **ultrapassa** uma plataforma curta e cai no vão seguinte.

**Nota técnica sobre o JSON do mapa e o Parcel** (válida para a Fase 1,
já religada nesta versão, e para quando as Fases 2-5 também forem):
`new URL('./mapa.json',
import.meta.url)` faz o Parcel tratar o arquivo como módulo JS (roda pelo
transformer de JSON padrão), não como asset estático copiável — o que
quebraria o carregador de rede do Phaser (`load.tilemapTiledJSON`), que
espera uma URL servindo JSON puro. A solução é importar o `.json`
estaticamente (`import fase1Map from "./fase-1.json"`, já suportado por
`resolveJsonModule` no `tsconfig.json`) e registrar os dados direto no
cache de tilemap do Phaser em `GameScene.preload()`
(`this.cache.tilemap.add(key, { format: TILED_JSON, data })`), sem passar
pelo carregador de rede.

### Sobre os valores numéricos

Todo valor de tempo/velocidade/distância vem acompanhado de um comentário
`// provisório` quando corresponde a um item da Seção 26 (Validações
Pendentes de Playtest) do GDD. Eles estão centralizados em
`src/config/GameConfig.ts` para facilitar o ajuste fino durante os
playtests, sem precisar caçar números espalhados pelo código.
`BASE_RUN_SPEED`/`GRAVITY_Y` chegaram a ser recalibrados na v0.2.0 para
bater com a escala dos mapas Tiled reais; a v0.2.1 reverteu isso de volta
aos valores originais (320px/s, gravidade 1600) porque o feel resultante
da recalibração, testado em playtest, ficou pior — ver Changelog.

### Correções de bugs reportados em playtest

**Slide afundando/atravessando o chão.** Ao entrar em slide, o código
reescalava a mesma textura em pé (`setDisplaySize`) e redimensionava o
corpo físico com `body.setSize(..., true)`. O parâmetro `true` centraliza
o corpo dentro do frame original, ignorando o origin bottom-center do
sprite — então o corpo de colisão ficava desalinhado do sprite visual (às
vezes flutuando acima do chão, às vezes afundado nele, dependendo do
frame). A correção troca de textura (`tex_player` ↔ `tex_player_slide`,
uma pose própria e mais baixa) e recalcula o corpo a partir do novo frame
com offset explícito zero, então "pés" do sprite e do corpo físico ficam
sempre no mesmo lugar. Ver `Player.setPose()`.

**Morte no meio do pulo, sem colidir com nada visível ("parede
invisível").** O cano/fios matavam o jogador checando só se a posição X
estava dentro da faixa do obstáculo, ignorando completamente a altura
(Y). Resultado: mesmo pulando bem acima do cano (visualmente livre), o
jogador morria ao entrar naquela faixa de X, porque o pulo padrão (altura
~144px) facilmente ultrapassava a pequena faixa Y onde o cano era
desenhado (~20px de espessura) — a morte parecia vir do nada. A correção
troca isso por um collider físico real e "honesto": um retângulo alto (do
topo da tela até a folga exata que cabe o slide) ligado via
`physics.add.overlap`. Agora pular nunca livra o cano (ele visualmente
ocupa todo aquele trecho vertical, como um teto baixo/tubulação que
desce), e só quem está deslizando — com a hitbox reduzida — passa por
baixo sem sobrepor o obstáculo. Ver `LevelRuntime.buildOverheadColliders()`
e o `physics.add.overlap` na `GameScene`.

Ambas as correções foram validadas rodando a build final num Chromium
headless com os inputs cronometrados a partir dos dados reais da Fase 1
(coordenadas de cada gap/obstáculo em `phase1.ts`): a sequência de 4 pulos
+ slide sustentado sobre o primeiro cano completa sem morrer, e tentar
passar pelo cano sem deslizar ainda mata o jogador corretamente (o
comportamento pretendido pelo design, só que agora justificado por uma
colisão visível).

### Correções de bugs reportados no segundo playtest (v0.1.2)

**Slide não "voltava" ao soltar o botão.** O GDD (seção 14.3) pede "duração
fixa" para o slide, e a v0.1.1 implementava isso literalmente: uma vez
iniciado, o slide só terminava depois de `PHYSICS.slide.durationMs`
(550ms), não importa se o jogador tivesse soltado o botão bem antes disso.
Na prática isso significava até mais de meio segundo de atraso entre
soltar o botão e Alex ficar em pé de novo — e o texto do GDD também deixa
claro que só o *pulo* não pode cancelar o slide ("não pode ser cancelado
por pulo"), sem dizer nada sobre soltar o botão. A correção trata os
550ms como um **teto de segurança** (evita ficar deslizando para sempre se
o jogador segurar o botão por muito tempo) e não como um tempo mínimo
obrigatório: existe agora também um `PHYSICS.slide.minDurationMs` (180ms,
só para evitar um toque acidental de 1 frame gerar um "flash" de slide),
e a partir desse mínimo o personagem levanta assim que o botão é solto.
Ver `Player.updateTimers()`/`GameConfig.PHYSICS.slide`.

**"Muro amarelo" sem solução (fios energizados após o checkpoint, e toda a
sequência de domínio logo depois).** Esse era um bug real de level design,
não de física de colisão. A distância entre o fim de um gap e o começo do
próximo obstáculo aéreo (cano/fios) era curta demais (90px) para garantir
espaço de pouso + reação, dependendo de exatamente quando o jogador
decidisse pular o gap anterior. Com a velocidade/gravidade/impulso de pulo
atuais (`GameConfig`), um pulo cobre sempre ~272px na horizontal
(`2 * |jump.velocityY| / GRAVITY_Y * BASE_RUN_SPEED`); pulando no último
instante seguro (bem na borda do gap), o pouso acontece em
`gapStart + 272`. Se o obstáculo aéreo começasse antes desse ponto (mais
uma margem de reação para começar a deslizar a tempo), não existia
NENHUM timing de pulo que evitasse morrer encostando nele sem estar
deslizando — o "não tem como passar, pois para isso precisamos pular e
isso não é possível" relatado. A correção recalculou (com um script de
validação dedicado que simula a mesma lógica do `LevelBuilder`) o
espaçamento de toda a Fase 1 — não só do trecho reportado, mas também da
"sequência de domínio" logo depois, que tinha o mesmo problema em vários
pontos — garantindo pelo menos ~40-60px de margem de sobra além do pior
caso matematicamente necessário em cada transição gap→obstáculo e
obstáculo→gap. Ver os comentários no início do item 10 em
`src/levels/phase1.ts`.

Ambas as correções foram validadas de ponta a ponta rodando a build final
num Chromium headless: um percurso completo pela Fase 1 inteira (todos os
gaps e obstáculos aéreos, incluindo o trecho dos fios e toda a sequência
de domínio), pulando/deslizando sempre no instante mais tardio ainda
seguro segundo os cálculos acima, chegou até a Clínica de George sem
nenhuma morte. Também foi validado separadamente que soltar o botão de
slide bem depois do mínimo (300ms) faz Alex levantar em menos de um
frame perceptível (~50ms), em vez dos ~550ms de antes.

### Correções e decisões de v0.4.1

**Contexto:** dois pedidos diretos, sem relação técnica entre si. (1)
"ainda continua com problema da sombra... me explique a causa antes de
mexer... conseguiu verificar com os vídeos que enviei?" - resposta
honesta: não, não tinha analisado os vídeos quadro a quadro antes; fiz
isso primeiro, expliquei a causa real antes de tocar em qualquer código
(ver a mensagem anterior desta conversa), e só depois de aprovação
("quero um fundo acinzentado, não preto") entrei em código. (2) "existe
um problema no checkpoint, o personagem está caindo infinitamente."

**Fundo cinza.** A causa raiz (detalhada na resposta em texto, não
repetida aqui por completo) é que a calça/bota de Alex já são quase
pretas na arte original (`#200c0d`, luminância ~18,1, ~9,7% de todos os
pixels opacos do sprite) - contra qualquer fundo também quase preto, essa
parte do personagem vira uma mancha sem contorno, e nenhuma recalibração
de fundo ESCURO resolve isso de verdade (o gap de luminância pra baixo já
estava perto do teto teórico desde a v0.3.2). O pedido de ir pra cinza é
na prática a correção certa: só dá pra abrir mais distância indo mais
CLARO que a calça, não mais escuro.

Recalibrado com o mesmo método de luminância (ITU-R BT.601) contra os 37
tons opacos significativos do spritesheet (>=0,05% dos pixels), mas desta
vez maximizando a menor distância em QUALQUER direção (pra cima ou pra
baixo), restrito a uma faixa de luminância 40-160 que ainda lê como
"cinza" (abaixo disso continua perto demais de preto; acima vira cinza
claro/prateado, destoante do esgoto sombrio). O maior "vão" nessa faixa
fica entre o fim dos tons de sombreado mais escuros (~50,5) e o início do
próximo grupo, tons de pele/músculo em sombra (~63,6) - ponto médio ~57.
Escolhido `#36393c` (cinza levemente frio, luminância ~56,6): gap de
~6,1 pra baixo e ~7,0 pra cima contra os tons mais próximos - bem mais
apertado que os ~16,3 que dava pra abrir indo pra preto absoluto (v0.3.2),
mas é o melhor gap disponível dentro da restrição de realmente parecer
cinza (o próximo vão de verdade só aparece em luminância ~126, que já é
um cinza médio/claro demais pro que parece ter sido pedido). Confirmado
visualmente com screenshot de gameplay real: a calça/bota agora têm
silhueta nitidamente separada do fundo.

**Bug do checkpoint - queda infinita ao reaparecer.** Reproduzido e
diagnosticado com o motor de física real (Playwright), não só lendo
código: teleportar o personagem pro checkpoint real do mapa
(`checkpoint_01`, x=2864, y=256 no JSON - elevação "principal", linha 16
do grid) e forçar uma morte mostrava o respawn reaparecendo em y=480 (X
certo, mas por causa do bug, ANTES da correção, em y errado - ver
próximo parágrafo) e caindo até ser resgatado por um hazard ou pelo
`fallDeathY`, morrendo nesse mesmo lugar quebrado de novo, num ciclo que
não se resolvia sozinho - exatamente "caindo infinitamente" do ponto de
vista de quem está jogando.

Causa: `TiledLevelRuntime`/`LevelRuntime` só guardavam o X de cada
checkpoint (`TiledCheckpointObj { id, x }`), e todo respawn em
`GameScene` (`createTiled`/`createLegacy`, os dois `scene.restart()` de
morte/pausa, e `MenuScene.continueGame()` via save) sempre usava o Y do
SPAWN inicial da fase, nunca o Y do checkpoint específico. No mapa
desenhado à mão e no mapa antigo da Fase 1 (uma elevação de chão só) isso
nunca importava, porque todo ponto do nível tinha o mesmo Y de chão. O
mapa da v0.4.0 tem duas elevações (a "profunda" do spawn e a "principal"
depois do degrau, ~80px mais alto na tela), e o único checkpoint real do
mapa fica na elevação principal - então o respawn reaparecia Alex ~80px
abaixo do chão de verdade daquele ponto, direto num vão sem fundo.

Corrigido guardando o Y de cada checkpoint (do objeto Tiled, já com
`offsetY` aplicado - o mesmo valor real usado pra desenhar o marcador
visual do checkpoint, que por sinal tinha o mesmo bug: usava uma
constante fixa de chão em vez do Y de verdade do objeto, então o
retângulo ficava flutuando no lugar errado também) e usando esse Y em
TODO ponto que hoje usa X: `GameSceneData.checkpointY`, os dois
`scene.restart()`, `SaveData.checkpoint.y` (persistido - `SaveState.
updateCheckpoint` agora recebe Y), e `MenuScene.continueGame()` lendo o
save. O nível desenhado à mão (`LevelRuntime`) também foi atualizado pra
mesma assinatura de callback (`onCheckpoint(id, x, y)`), passando sempre
`level.groundY` - sem mudança de comportamento ali (elevação única), só
consistência de tipo entre os dois formatos de nível.

Cuidado extra com o save persistido: `checkpoint.y` é um campo ADITIVO no
`SaveData` (Seção 20.1) - um save salvo antes desta versão não tem esse
campo, e `SaveState.load()` foi ajustado pra não deixar isso virar
`undefined` no objeto mesclado (cairia pra `0`, que é o comportamento
antigo/seguro: `checkpointX/Y <= 0` sempre volta pro spawn da fase, nunca
pra um checkpoint quebrado).

**Validação.** Reproduzido o bug isolado (teleportar pro checkpoint real,
matar, rastrear Y/velocidade/estado do respawn quadro a quadro) - antes
da correção não foi possível reproduzir sem reverter o código (a correção
já estava sendo aplicada durante a investigação), mas o teste confirma o
comportamento correto pós-fix: respawn em y=480 (o Y de verdade do
checkpoint), personagem fica `grounded`/`running` em ~1,4s sem nunca
ultrapassar a superfície real do chão - sem queda descontrolada. Rodado
de novo o playthrough completo da Fase 1 (bot no motor de física real,
gap-jump + fallback reativo) e a bateria dos 6 hazards individuais
(4× `toxic_water`, 2× `electric_wire`) depois das duas mudanças: mesmo
resultado de antes (chega à Clínica sem morte, todos os hazards reagem
como esperado) - confirma que nem a mudança de fundo nem a de checkpoint
afetaram física, colisão ou o comportamento dos hazards.

Nota de rigor metodológico: durante essa bateria, um teste isolado de
`electric_wire_01` com slide (que teleporta o personagem já parado bem
perto do fio, em vez de fazê-lo pular o vão de `toxic_water_02` antes)
morreu de forma intermitente - investigado a fundo (rastreamento
quadro a quadro de posição/hitbox/estado) e confirmado que é um artefato
desse método de teste específico, não um bug real: teleportar direto
"em pé" já na altura do chão faz o motor de física levar alguns quadros
pra reconhecer que o personagem está no chão (`grounded`), e só depois
disso o slide consegue ativar (`handleSlide` exige estado `running`,
que só existe depois de aterrissar de verdade) - nesse intervalo curto
o personagem ainda está com a hitbox de pé, e o fio fica bem perto o
suficiente do ponto de teleporte pra esse intervalo ocasionalmente não
terminar a tempo. Uma abordagem de teste mais realista (pular o vão de
verdade a partir de antes dele, como um jogador faria, e segurar slide
durante a aproximação) passou consistentemente em 5 execuções seguidas -
confirma que isso não acontece em jogo real, só nesse teste sintético
específico.

### Correções e decisões de v0.4.0

**Contexto:** pedido explícito de verificar se o `.rar` do projeto pai
(`jogo-projeto-topicos-especiais.rar`, enviado junto com uma cópia
idêntica do `TILED_PHASER_CONTRACT1.md`) continha outra versão do mapa da
Fase 1 e, só nesse caso, integrá-la - com atenção a três pontos
específicos (altura do pulo, animação de agachamento/slide, sombra) e a
instrução explícita de não mexer em mais nada além disso se não houvesse
mapa novo. Primeiro passo foi justamente essa verificação: `md5sum` e
dimensões do JSON (`public/assets/maps/esgoto/fase-1.json` dentro do rar)
contra o mapa em uso - diferentes (1050×28 contra 720×20, hashes
diferentes), então a integração prosseguiu.

**Estrutura do mapa novo.** Duas elevações de chão (uma "profunda" no
trecho inicial, a principal depois de um degrau), plataformas opcionais
elevadas pra rota de risco, e dois tilesets: `tileset-sewer` (chão/
primeiro plano - note que o `name` interno do tileset mudou de `"sewer"`
pra `"tileset-sewer"` nesta exportação, conferido lendo o JSON em vez de
assumir, por causa do aviso do contrato §8 sobre nomes variarem por
exportação) e `crystal-cave-tiles` (novo, só na layer `background`).
`TiledLevelRuntime` agora carrega os dois tilesets e passa um array pro
`createLayer` de cada layer (a API do Phaser aceita isso quando uma layer
pode ter tiles de mais de um tileset). O deslocamento vertical do mapa
(`TILED_FASE1_OFFSET_Y`) foi recalculado porque a linha do chão principal
mudou de 16 (mapa antigo) pra 21 (mapa novo) no grid - conferido que nada
fica cortado no viewport de 720px com o novo valor (pano de fundo cai em
y=224-400, fundo do mapa em y≈656).

**Hazards - mudança de mecanismo, não só de conteúdo.** O mapa antigo
nunca teve um objeto real da classe `hazard`; usava só uma propriedade
`hazard=true` nos tiles da layer `hazards` (mecanismo antigo, v0.2.0,
puramente visual sem objeto de colisão dedicado). O mapa novo segue o
contrato à risca (§5.3): objetos de verdade na layer `objects`, classe
`hazard`, com uma propriedade `kind`. Dois tipos usados: `toxic_water`
(4 poços, já existia como conceito) e `electric_wire` (2 fios, tipo novo
neste mapa). `TiledLevelRuntime.buildObjectHazards()` cria uma
`Phaser.GameObjects.Zone` estática por objeto e registra overlap contra o
jogador; o comportamento por `kind` é decidido por um mapa
(`HAZARD_KIND_BEHAVIOR`): `toxic_water` mata em qualquer estado
(`"floor"`), `electric_wire` só mata fora do estado `sliding` (`"overhead"`).

**A inferência do `electric_wire` - sinalizada porque não está no
contrato.** O contrato documenta a classe `hazard`/propriedade `kind` em
geral, mas `electric_wire` como valor específico não aparece nele - é um
tipo novo que só existe neste mapa. A inferência de comportamento
("mata, exceto deslizando por baixo") veio da geometria do objeto no
JSON: 32×16px, posicionado ~16px acima da superfície do chão principal -
ou seja, na altura da cabeça de Alex parado/correndo, mas acima do teto
da hitbox reduzida do slide (`PLAYER_SLIDE_SIZE`) - e do contexto do
`levelDesign.md` do projeto (fios/obstáculos baixos pedindo pra abaixar).
Como isso é uma decisão de implementação e não algo confirmado no
documento oficial, fica registrado aqui explicitamente em vez de
silenciosamente assumido como certo - se o level designer documentar um
comportamento diferente pro `electric_wire` no contrato, é só trocar a
entrada em `HAZARD_KIND_BEHAVIOR`.

**Validação de pulo (`-640` mantido) - playthrough completo, não só o
script de coluna.** O script de "distância de coluna" (desde a v0.3.0)
continua útil pra iteração rápida, mas desde o incidente da v0.3.2 (ver
abaixo) não é mais tratado como validação final sozinho. Neste mapa: (1)
**bot de playthrough completo** (Playwright dirigindo o motor de física
real, gatilho de pulo por detecção de vão + um gatilho reativo novo -
"se estiver no chão, correndo, e o X não avançar em 350ms, pula" - pra
não precisar mapear manualmente cada obstáculo do mapa de 1050 tiles)
percorreu o mapa inteiro e chegou até a Clínica sem nenhuma morte. (2) O
gatilho reativo disparou em 6 pontos (x ≈ 1091, 1763, 1939, 2163, 2659,
3475) - investigados individualmente lendo a layer `ground` ao redor de
cada X: em todos os 6, é o mesmo padrão, um degrau real subindo da linha
21 (chão principal) pra uma linha mais alta (16-18, ou seja 48-80px de
altura), não uma plataforma flutuante nem nada anômalo. É o comportamento
esperado de um jogador de verdade nesse tipo de degrau (bater na parede e
pular pra subir no patamar), não um sintoma de física quebrada - por isso
o "gatilho reativo" está descrito aqui como observação de design válida,
não como muleta escondendo um problema. (3) Os dois trechos mais
arriscados do mapa foram rastreados quadro a quadro à parte (posição
`body.top`/`body.bottom` reais do corpo físico, não só a posição final):
o degrau de subida de elevação (~x=845-1058) é limpo pelo pulo `-640` sem
raspar em nenhuma parede, e a zona de teto baixo (~x=1060-1245, plataforma
opcional a 32px de altura) só é passável deslizando - confirmado com uma
folga real de só ~2px entre o topo do corpo agachado e o teto, funcional
mas apertada (registrado como dado de nivelamento, útil se o level design
quiser dar mais folga numa próxima revisão).

**Hazards testados de verdade, um por um.** Além do playthrough completo
(que naturalmente pula por cima dos vãos onde os hazards ficam, sem
tocar neles - os poços de água tóxica e os fios ficam exatamente nos
vãos que o mapa já exige pular), cada hazard foi testado isoladamente
teleportando o personagem pra logo antes de cada objeto e conferindo o
resultado real no motor de física: os 4 poços de `toxic_water` matam ao
toque em todos os casos; os 2 `electric_wire` matam se o personagem
estiver correndo/parado (não deslizando) e são passáveis ilesos segurando
o slide durante a travessia - nos dois casos, nas duas ocorrências de
cada hazard no mapa.

**"Sombra" - fundo mantido, não remedido, mas reconfirmado.** O valor
calibrado por luminância na v0.3.2 (`#000010`) continua o mesmo: a layer
`background` do mapa novo (tileset `crystal-cave-tiles`) só cobre as
linhas 0-11 do grid, e o personagem nunca chega perto dessas linhas
(ele transita nas linhas 16-26) - ou seja, é sempre a cor de câmera, não
um tile do pano de fundo novo, que fica atrás dele nos trechos onde
realmente passa, a mesma situação de antes. Reconfirmado visualmente com
screenshots novos de gameplay real no terreno novo (correndo e
deslizando, não só o boot inicial) - contraste da silhueta contra o fundo
segue nítido.

**Antes de finalizar:** removido o hook de debug temporário em `main.ts`
(`window.__game`, usado pra inspecionar o jogo via Playwright durante a
validação) - conferido com `git diff --stat` que o arquivo final é
idêntico ao da v0.3.2 nesse ponto. Rebuild limpo (`dist/` e
`.parcel-cache` apagados e reconstruídos do zero) e checado headless mais
uma vez antes do empacotamento final.

### Correções e decisões de v0.3.2

**Contexto:** depois de entregar a v0.3.1 (pulo -640, fundo `#000345`), o
feedback foi "tudo continua igual, não está evoluindo" - e, questionado
sobre o quê especificamente, a resposta foi "tanto a sombra quanto o
pulo". Como as duas mudanças estavam mensuravelmente presentes no código
(conferido de novo linha por linha) e no bundle compilado (grep no JS
final por `-640`/ausência de `-680`, e pelo valor decimal do novo fundo),
a investigação seguiu por duas frentes: (1) será que o problema é só
build desatualizado, e (2) será que as mudanças, mesmo reais, eram
pequenas demais pra perceber jogando.

**Build desatualizado - causa provável, corrigida independente do resto.**
O zip da v0.3.1 excluía a pasta `dist/` de propósito (só código-fonte),
exigindo rodar `npm install` + `npm run build`/`npm run dev` pra ver as
mudanças compiladas. Reabrir um zip antigo ou manter um `npm run dev`
anterior rodando faz literalmente nada mudar na tela, mesmo com o
código-fonte correto. O zip a partir de agora vem com `dist/` já
buildado, pra eliminar essa variável.

**"Sombra" - métrica errada, não só valor errado.** O critério usado até
a v0.3.1 (maximizar a distância euclidiana de COR/RGB entre o fundo e os
tons opacos do spritesheet) mede principalmente diferença de matiz. Mas
contraste visual entre duas cores muito escuras é dominado por diferença
de LUMINÂNCIA (brilho percebido, `0,299R + 0,587G + 0,114B`) - o olho
humano distingue muito pior tons escuros entre si do que tons claros
(lei de Weber), então duas cores podem estar "longe" em RGB e "perto" em
brilho, e vão continuar parecendo se misturar. Foi exatamente o caso:
`#000345` (v0.3.1) tinha distância de cor de 51 contra a calça de Alex
(`#101414`), mas luminância quase igual à dela (~9,6 contra ~18,8 - gap
de só 8,5 num intervalo 0-255).

Medido de novo contra os tons *significativos* do spritesheet (>=0,05%
dos pixels opacos - descarta ruído de poucos pixels, tipo 6 pixels de
contorno preto puro em 313 mil pixels opacos, que não formam nenhuma
mancha visível). Os tons de sombreado reais da arte (cabelo, calça,
coturno) formam um degradê praticamente contínuo de luminância ~18 a
~50 - não existe "brecha" no meio pro fundo ocupar sem ficar perto de
algum tom de verdade. A única forma de abrir um gap bem maior sem
abandonar um fundo escuro/atmosférico (precisaria subir a luminância pra
~70+, um cinza médio, destoante do clima do jogo) é ir **mais escuro**
que o tom mais escuro da arte, não tentar ficar "ao lado" dele só
mudando o matiz. Novo fundo: `#000010` (quase preto absoluto, com um
traço mínimo de azul pra não virar um "buraco" sem cor nenhuma) - gap de
luminância de ~16,3 contra o pior tom, perto do teto teórico (~18,1, só
com preto puro `#000000`, descartado por colidir exatamente com os tais
6 pixels de contorno). Verificado visualmente com zoom 8x num screenshot
real de gameplay rodando (não só a métrica isolada): a calça e as botas
agora têm silhueta nitidamente visível contra o novo fundo.

**Altura do pulo - tentativa de reduzir mais, revertida com evidência
concreta.** Testados `-600` (altura 112,5px, alcance 240px) e `-620`
(altura 120px, alcance 248px), ambos aprovados pelo script de validação
por "distância de coluna" (o mesmo usado desde a v0.3.0: verifica se o
X de pouso cai sobre uma coluna com chão). Só que essa metodologia tem
um ponto cego real: ela nunca simula a trajetória VERTICAL da parábola
do salto, só o ponto final. Um playthrough de verdade (bot Playwright
dirigindo o motor de física real, não o script analítico) expôs o
problema: numa sequência de 3 plataformas estreitas (128px, separadas
por vãos de 64px, por volta de x=1300-1700 do mapa da Fase 1), um arco
mais baixo/mais raso chega ao início da próxima plataforma DESCENDO
rápido demais - o personagem raspa na parede esquerda do bloco de chão
(que tem 64px de espessura, não é uma borda fina de 1 tile) em vez de
pousar em cima. O corpo fica travado no eixo X por vários frames
(colado na parede, `vy` continua subindo em queda livre) até escorregar
pra baixo da borda do bloco e cair no vazio - morte 100% reproduzível,
tanto em `-600` quanto em `-620`, sempre nesse mesmo trecho (confirmado
rastreando posição/velocidade frame a frame, não só "morreu ou não").

`-640` (o valor da v0.3.1, já validado por dois percursos completos sem
morte) permanece como piso seguro conhecido para essa sequência
específica de plataformas. Reduzir mais exigiria redesenhar essa parte
do mapa (plataformas mais largas ou vãos menores) - não é algo que dá
pra resolver só ajustando a constante de física global. O pulo continua
em `-640` nesta versão; se o feedback depois de testar o build atualizado
(com a build `dist/` já pronta) ainda for que a altura precisa mudar,
o próximo passo tem que ser no nível (`fase-1.json`), não na física.

Reforço de metodologia pro futuro: a partir de agora, qualquer mudança em
`PHYSICS.jump`/`doubleJump` precisa passar pelo playthrough real em
Chromium headless antes de ser considerada validada - o script de
"distância de coluna" continua útil pra iteração rápida, mas não é mais
tratado como validação final sozinho, exatamente pelo motivo acima.

### Correções e decisões de v0.3.1

**Pulo reduzido (-680 → -640).** Feedback direto de playtest na Fase 1
Tiled: o pulo estava "muito alto" pro grid 16×16 do mapa real (visualmente
desproporcional a plataformas de 1-2 tiles de espessura). Como
`GameConfig.PHYSICS` é global (não existe física por fase neste motor), o
ajuste também afeta a Fase 2-intro - conferido que nenhum gap dela excede
o novo alcance de 256px (o maior, 230px na "rota de risco" de créditos,
fica com 26px de margem; mas esse trecho já vem depois do jogador ganhar
o salto duplo na própria Fase 2, então mesmo se a margem do salto simples
fosse zero ainda sobraria o salto duplo como alternativa - não é um
bloqueio). A Fase 1 foi revalidada do zero com o novo alcance (256px, não
mais 272px), repetindo a mesma metodologia de duas camadas da v0.3.0:

- **Reachability exato:** recalculando a janela de decolagem segura de
  cada uma das 15 travessias de gap da fase com `JUMP_RANGE=256`, todas
  continuam com janela real (nenhuma ficou vazia). A margem mínima -
  antes 47px em três travessias - passou pra **63px em quatro
  travessias** (a geometria específica desses vãos combina melhor com o
  alcance menor; não é o caso geral, é coincidência desta fase). A imensa
  maioria das travessias segue com 63-192px de folga.
- **Percurso completo:** dois percursos independentes do spawn até a
  Clínica de George num Chromium headless com a build final, sem nenhuma
  morte, coletando os 30 créditos da rota segura - mesmo critério de
  aprovação da v0.3.0.

**"Sombra" no personagem (de novo) - medição completa desta vez.** O
mesmo tipo de bug da v0.2.2 ("personagem continua como se tivesse uma
sombra") voltou a ser reportado, agora especificamente na Fase 1 Tiled.
Causa: o fundo escolhido na v0.2.2 (`#080e2a`) foi medido só contra UM tom
problemático identificado então (`#101414`, a calça de Alex, distância de
cor ~7 na época) - mas nunca foi verificado sistematicamente contra TODOS
os tons opacos do spritesheet. Varrendo `alex-flesh.png` (`Image.getpixel`
pixel a pixel, todos os tons com alpha ≥200) e medindo a distância
euclidiana de cada um até o fundo da Fase 1, dois tons ficavam bem mais
próximos do que os demais: a calça `#101414` (distância ~24,2) e um tom de
sombra do cabelo/rosto `#1D131E` (distância ~24,7) - contra 30-58 de
distância dos outros ~35 tons da arte. Próximo o bastante, numa paleta
inteira escura, pra ler como a calça/perna "sumindo" contra o céu do
mapa - exatamente o efeito relatado, mais visível aqui porque a Fase 1
Tiled tem trechos de céu aberto atrás do personagem (o nível desenhado à
mão da v0.1/Fase 2-intro usa um fundo mais compacto).

Correção: busca em grade (script Python dedicado, não escolha visual) por
uma cor dentro de uma faixa igualmente escura (luminância ≤18, o mesmo
peso visual do tom anterior) que **maximiza a distância mínima** até
qualquer um dos ~35 tons opacos do spritesheet (não só o pior caso
identificado por acaso). Resultado: `#000345` (distância mínima 51,2 até
qualquer tom da arte - mais que o dobro do `#080e2a` anterior). Validado
visualmente: captura de tela com zoom 4× mostra a calça nitidamente
distinta do céu, sem nenhum pedaço "sumindo" contra o fundo, parado ou
correndo. Ver `TILED_FASE1_BACKGROUND` em `TiledFase1.ts` para a medição
completa comentada no código.

### Correções e decisões de v0.3.0

**Seguindo o contrato.** `TiledLevelRuntime.ts` lê `fase-1.json` conforme
`TILED_PHASER_CONTRACT1.md`: layer `ground` vira colisão física (mesmo
grid do tilemap, incluindo as duas elevações da fase — chão baixo
"seguro" e a plataforma elevada "arriscada" que corre paralela a ele em
parte do percurso); `deco` é puramente visual (sem colisão, mesmo o tile
`solid=true` do tileset que aparece nela — o contrato é explícito que
`deco` não colide por padrão); e a "Classe" de cada objeto veio no campo
`type` do JSON exportado, não em `class` — exatamente a ressalva do §8 do
contrato ("Observação sobre Tiled JSON"), confirmada inspecionando o JSON
real antes de escrever o parser. Só 4 das 6 layers recomendadas existem
no mapa entregue (sem `deco-back`/`background`) e só 4 das 12 classes de
objeto do §5/§6 estão em uso (`spawn`, `phase_end`, `credit`,
`checkpoint`/`clinic` — os dois últimos aparecem no mapa mas ainda não
foram formalizados no documento) — o parser trata os dois como opcionais
em vez de assumir que vão existir.

**Offset vertical (`TILED_FASE1_OFFSET_Y = 304`).** O mapa tem só 320px de
altura (20 linhas × 16px); a tela é 720px e este motor **não tem scroll
vertical de câmera** (`GameScene.update()` só ajusta `scrollX`). Sem
ajuste, o mapa inteiro ficaria espremido no topo da tela. O offset desloca
todas as layers e coordenadas de objeto pra baixo até a linha principal do
chão (linha 16) cair em y=560 — o mesmo `GROUND_Y` do nível desenhado à
mão, pra manter a mesma moldura visual entre as duas fases.

**Divergência entre contrato e mapa real no mecanismo de hazard.** O
contrato (§3) diz que a *lógica* de perigo deveria vir de objetos
(`hazard`/`kind` em `objects`), com a layer `hazards` só pro visual. O
mapa entregue não tem nenhum objeto da classe `hazard` — a água tóxica
(50 tiles, todos do tipo "poço sem fundo", não "obstáculo aéreo") só
existe via propriedade customizada `hazard=true` no tileset, o mecanismo
mais antigo da v0.2.0. `TiledLevelRuntime` lê essa propriedade (senão
seriam 50 tiles de água puramente decorativos, sem matar ninguém) e
também aceita um futuro objeto `hazard` na layer `objects`, se/quando o
mapa passar a seguir o contrato à risca nesse ponto — não é uma decisão
unilateral de mudar o mapa, só o runtime aceitando os dois formatos.

**Checkpoint posicionado dentro de um vão do chão (observação pro level
design, não bloqueante).** O objeto `checkpoint_1` está em x=6304, mas o
chão da Fase 1 só existe até x=6240 e retoma em x=6320 — ou seja, o
marcador cai nos 16px vazios entre duas plataformas. Isso não quebra o
jogo (o respawn cai um pouco e alcança o chão real menos de 0,1s depois,
bem antes da queda virar morte por queda), mas não é a posição pretendida
— provavelmente o checkpoint deveria estar alguns pixels antes ou depois.
Registrado aqui em vez de corrigido silenciosamente, seguindo o mesmo
princípio do achado abaixo: mudança de mapa é decisão de quem mantém o
Tiled, não deste runtime.

**Bug de boot que deixava o jogo inteiro em branco (Parcel).** Com dois
assets carregados via `new URL(..., import.meta.url)` no mesmo bundle (o
spritesheet de Alex e o tileset da Fase 1), o Parcel passou a içar as
duas chamadas pra escopo de módulo de nível superior
(`var tc={};tc=import.meta.resolve("dIn4j");`, antes até da definição da
classe `GameScene`) — e uma delas lançava
`Failed to resolve module specifier` antes de qualquer código do jogo
rodar, deixando a tela em branco (nem o menu aparecia). Encontrado
inspecionando o bundle final (`dist/*.js` e o import map que o Parcel
injeta em `dist/index.html`) depois de reproduzir o erro num Chromium
headless. Depois de mover a segunda URL pra um método próprio na
`GameScene` (no mesmo padrão do `alexUrl()` já existente) e limpar
`.parcel-cache` por completo, o erro parou de se reproduzir em builds
limpos consecutivos — mas o bundle final **continua** com as duas
chamadas içadas pro mesmo padrão de escopo de módulo (conferido de novo
nesta versão), então a causa exata de por que parou de falhar não está
100% confirmada (pode ter sido só o cache sujo da tentativa anterior).
Registrado pra quem mexer de novo nesse trecho ficar de olho: se a tela
ficar em branco de novo depois de adicionar um terceiro asset via
`new URL(...)`, comece por aqui.

**Metodologia de validação (atualizada na v0.3.0) — e um engano do
próprio processo de validação, registrado por transparência.** A primeira
tentativa de calcular a "janela de decolagem segura" de cada travessia de
gap só checava se o pouso **alcançava** o início da próxima plataforma —
o mesmo critério usado (com sucesso) pra validar as 5 fases desenhadas à
mão na v0.2.0. Rodado às pressas contra o mapa real da Fase 1, esse
critério chegou a indicar 3 travessias como "matematicamente impossíveis"
no trecho de plataformas minúsculas sobre água tóxica (x≈3424–3744, uma
"escada" de 3 plataformas de 4 tiles/64px cada). Antes de reportar isso
como um problema do mapa, refazer o cálculo do zero (script Python
independente, direto do `fase-1.json`) mostrou que o critério original
tinha um furo: ele não verificava se o pulo **ultrapassava** a plataforma
alvo inteira e caía no vão *seguinte* — o que é exatamente o que acontece
nessas plataformas de 64px, mais estreitas que a maioria dos gaps do
resto da fase. Corrigindo o critério (checar que o pouso cai em cima de
chão real, não só "além do início do próximo pedaço"), as 3 travessias
"impossíveis" viraram travessias com janela real, só que mais apertada
que o normal (47-64px, contra 128-208px no resto da fase). Um teste de
bot num Chromium headless bateu no mesmo tipo de furo em duas tentativas
diferentes (uma pulando cedo demais dentro da própria plataforma de
partida sem cruzar o vão real, outra recalculando o ponto de decolagem
sem levar em conta que o pouso do pulo anterior já podia estar além do
próximo marco) antes de convergir pra uma estratégia "pula no último
instante em que o pouso ainda é seguro", calculada a cada frame a partir
da posição real do jogador — a mesma lógica de decisão que garante que
nenhuma das duas classes de erro acima se repita, porque não depende de
nenhum ponto pré-calculado que possa ficar desatualizado.

Com essa correção, a fase inteira (as 15 travessias de gap, do spawn até
o portão de saída da Clínica) foi validada em duas camadas, como nas
fases da v0.2.0: (1) o script de reachability corrigido, confirmando
janela real (>0px de folga) em toda travessia — a mais apertada é 47px
(~150ms a 320px/s), acima do mínimo de 40px usado como critério de
aprovação desde a v0.2.0, mas notavelmente mais justa que o resto da fase
(a maioria das travessias tem 128-208px de folga); e (2) dois percursos
completos rodando a build final de produção num Chromium headless, do
spawn até a Clínica de George, sem nenhuma morte e coletando os 30
créditos da rota segura (o bot não tentou a rota de risco). As travessias
mais apertadas (o trecho de água tóxica x≈1312-1824 e x≈3424-3744, e o
par de vãos x≈5376-5568) ficam acima do critério de aprovação do projeto,
mas valeria a pena a equipe de level design dar uma olhada se quiser mais
folga aí — não é um bloqueio, é uma sugestão registrada pra próxima
revisão do mapa, seguindo o mesmo princípio de não alterar o mapa
unilateralmente por conta própria.

### Correções e decisões de v0.2.0

> Registro histórico da integração dos mapas Tiled reais, revertida na
> v0.2.1 e religada (só pra Fase 1, seguindo o contrato) na v0.3.0 — ver
> Changelog e "Correções e decisões de v0.3.0" acima. Os dois bugs abaixo
> (colisão de chão e carregamento do JSON) são reais e os dois já estavam
> corrigidos em `TiledLevelRuntime`/`TiledFase1.ts` desde o primeiro
> commit da v0.3.0 (reaproveitando a correção descrita aqui) — não
> precisaram ser redescobertos.

**Colisão de chão completamente quebrada ao trocar para os tilemaps
reais (bug crítico, silencioso).** Ao ligar a colisão do Phaser com
`ground.setCollisionByExclusion([0])` — o valor "óbvio" para "todo tile
diferente de 0 colide" —, Alex caía direto através de todo o chão em
todas as fases. Causa: no Tiled/JSON uma célula vazia vale `0`, mas o
Phaser 4 representa essa mesma célula internamente como `Tile.index =
-1`, não `0`. Excluir só `[0]` não excluía nada de verdade — toda célula
do grid (inclusive o ar vazio) contava como "colidível", o que zera o
cálculo interno de faces do tilemap (nenhum tile parece ter uma face
exposta, já que os vizinhos "colidem" por igual) e desliga a colisão do
jogo inteiro por baixo dos panos, sem erro nenhum no console. Encontrado
lendo a documentação (`node_modules/phaser/skills/tilemaps/SKILL.md`) e o
código-fonte da física Arcade do próprio Phaser 4.2.1. Correção: `
ground.setCollisionByExclusion([-1, 0])`. Ver `LevelRuntime` (construtor).

**Mapa não carregava (Parcel empacotava o `.json` do Tiled como módulo
JS).** Ver a nota técnica na seção "Sobre o formato de nível" acima —
resumo: `new URL('./mapa.json', ...)` não serve JSON puro sob o Parcel;
a correção foi importar o `.json` estaticamente e registrar os dados
direto no cache de tilemap do Phaser, sem passar pelo carregador de rede.

**"Tremor de tela" reportado em mais de uma máquina.** Com
`Phaser.Scale.FIT`, o fator de escala do canvas quase nunca é um número
inteiro (depende do tamanho da janela do jogador) — e por padrão o
Phaser desenha com antialiasing e permite posições sub-pixel de câmera,
o que faz as bordas dos tiles (arte em pixel art, com padrão repetido)
"tremerem" visivelmente durante o scroll, principalmente em janelas cujo
fator de escala fica longe de um número inteiro. É por isso que o bug
batia "em algumas máquinas e não em outras": depende só do tamanho da
janela, não do hardware. A Fase 1 da v0.1 usava retângulos sólidos sem
padrão repetido, então o problema não aparecia até a arte real (com
tiles) entrar em cena. Correção em `main.ts`: `pixelArt: true` +
`render: { antialias: false, roundPixels: true }`, e a posição da câmera
(`scrollX`) passou a ser sempre arredondada (`Math.floor`) em
`GameScene.update()`.

**Simplificação de conteúdo divulgada — trecho da Fase 1 (x≈6880–9920)
reconstruído.** Durante a validação matemática (ver abaixo), esse trecho
original do mapa — uma sequência de poços de água tóxica intercalados
com plataformas elevadas de 48-80px — exigia timing de pulo
praticamente pixel-perfect em vários pontos (a janela de decolagem segura
ficava menor que a própria largura da plataforma-alvo, ou seja, sem
nenhuma folga real). Como o critério deste projeto é que toda fase seja
**sempre** passável de forma justa (sem sorte/frame-perfect), e não havia
tempo neste ciclo para redesenhar esse trecho mantendo a mesma dificuldade
"de precisão", ele foi substituído por um piso contínuo e seguro no mesmo
intervalo (removendo também os hazards e restos de plataforma que ali
existiam). Isso troca parte da dificuldade de precisão original por
garantia de imparcialidade — uma troca deliberada, registrada aqui em vez
de silenciosa, para a equipe de level design decidir se quer desenhar uma
versão mais generosa (folga ≥40px) desse trecho num próximo ciclo.

**Metodologia de validação.** Cada uma das 5 fases foi validada em duas
camadas antes de ser considerada pronta: (1) um script Python
(reachability + análise de física) que modela o chão de cada mapa como um
grafo de nós alcançáveis por corrida/pulo/salto-duplo, calculando para
cada aresta a janela de decolagem no pior caso e exigindo pelo menos 40px
de folga real nela (não só "existe algum instante que funciona") — e
verificando também que nenhum obstáculo aéreo "mata sem chance de reação"
(pouso no pior caso + margem de reação não pode cair dentro do obstáculo);
(2) rodando a build final de verdade num Chromium headless, com um bot
que joga a fase pulando/deslizando no instante correto segundo a mesma
lógica da análise, do spawn até o portão de saída. As 5 fases passam em
ambas as camadas — sem nenhuma morte obrigatória em nenhuma delas.

## Roadmap — o que falta (mapeado ao cronograma do GDD, Seção 24)

Esta entrega cobre os Marcos 1 e 2. Os próximos passos, em ordem:

- **Marco 3 — Ascensão completa** (Seção 24.3): completar as Fases 2–5 com
  todos os obstáculos descritos no `levelDesign.md` (prensas, esteiras,
  jatos de vapor, trituradoras na Fase 2; bandidos/drones na Fase 3;
  rotas escondidas/scan na Fase 4; domínio do kit completo na Fase 5),
  ligar `abilities.arms/eyes/thrusters` nas clínicas correspondentes,
  implementar inimigos simples (`Bandido ciborgue`, `Drone policial` —
  Seção 14.6) e objetos quebráveis (Seção 14.7, já suportados pela
  máquina de estados do jogador via `enterPressedState`/
  `resolvePressedSuccess`), e o Portão ao final da Fase 5. Os mapas Tiled
  reais entregues pela equipe (`src/assets/maps/`) são o material natural
  para desenhar essas fases — a Fase 1 já foi religada na v0.3.0 seguindo
  o contrato (`TILED_PHASER_CONTRACT1.md`); ver "Reintegrando os mapas
  Tiled das Fases 2-5" para o que falta pra estender às demais.
- **Marco 4 — Narrativa, descida e finais** (Seção 24.4): prólogo, arco de
  George, propagandas do pai, escolha Chrome/Flesh no Portão, glitches
  (Seção 18.3), retry especial, ReForge Industries e bioprinting (Seção
  15.5/15.6), Hollow, Flesh e epílogo. O formato de save já reserva os
  campos `descentState`, `preGateSave` e `endingReached` em
  `src/systems/SaveState.ts` para isso.
- **Marco 5 — Multiplayer** (Seção 24.5): implementar `MultiplayerScene`
  (hoje um stub) com a lógica da Seção 21 (pista própria, créditos
  individuais, tempo ajustado, DNF, desconexão).
- **Marco 6 — Polimento e entrega** (Seção 24.6): playtests para calibrar
  os valores marcados como provisórios, arte final substituindo os
  placeholders, áudio, e — só depois de tudo estável — a loja cosmética
  opcional do Mercador (Seção 25).

## Equipe (GDD Seção 8)

| Integrante | Responsabilidade principal |
| --- | --- |
| Vitor Nascimento | Programação / Phaser |
| Victor Blum | Game design / level design / GDD |
| João Pedro | Arte 2D / UI |

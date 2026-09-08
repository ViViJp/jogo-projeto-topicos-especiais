# Flesh to Chrome — protótipo técnico

Auto-runner 2D cyberpunk baseado no GDD `gdd.md`, na ideia original
`Cyberpunk.md` e no `levelDesign.md` do projeto acadêmico.

Stack conforme a Seção 22 do GDD: **TypeScript + Phaser `^4.2.1` + Parcel**.

## Changelog

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
seguintes:

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
- **Fase 1 — Esgoto/Periferia completa**, seguindo nó a nó o fluxograma de
  `levelDesign.md`: trecho seguro → primeiro pulo → gaps → cano baixo →
  pulo+slide → água tóxica → rota de créditos normal/risco → tubulação
  rompida → checkpoint → fios energizados → sequência de domínio → clínica
  de George → pernas mecânicas → salto duplo liberado.
- **Início da Fase 2 — Industrial**: gap impossível de salto simples, teste
  seguro do salto duplo e uma rota de risco com créditos, encerrando numa
  tela de "fim do protótipo" com o roadmap restante (não é um final
  narrativo — ver `src/scenes/EndingScene.ts`).
- Todas as cenas da Seção 22.2 existem no código (`Boot`, `Menu`, `Game`,
  `Clinic`, `Ending`, `Multiplayer`), inclusive as que ainda são stubs.
- Zero assets externos: toda a arte é placeholder gerado em runtime
  (`src/utils/PlaceholderTextures.ts`), como pede o Nível 1 do escopo
  (Seção 7.4). Basta trocar por spritesheets reais quando a arte
  (Seção 23.1) estiver pronta — física e colisão não mudam.

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
checkpoint — sem erros de console).

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
  objects/LevelRuntime.ts  # instancia chão/hazards/créditos/checkpoints
  utils/PlaceholderTextures.ts
```

### Sobre o formato de nível

O GDD define Tiled/JSON como ferramenta de level design (Seção 7.1), mas
nenhum `.tmj` foi fornecido pela equipe de design ainda. Por isso este
protótipo usa um formato próprio (`src/levels/LevelTypes.ts`) — mais
simples, mas com a mesma função. Quando a equipe de level design exportar
mapas reais do Tiled, o caminho recomendado é escrever um
`TiledLevelAdapter` que traduza o `.tmj` exportado para este mesmo
`LevelData`, sem precisar tocar em `Player`, nos sistemas ou nas cenas.

As fases atuais (`src/levels/phase1.ts`, `phase2Intro.ts`) são descritas
com um `LevelBuilder` sequencial (chão, gaps, obstáculos aéreos, créditos,
checkpoints), na mesma ordem dos nós dos fluxogramas de `levelDesign.md`
— os comentários no código apontam para cada nó correspondente.

### Sobre os valores numéricos

Todo valor de tempo/velocidade/distância vem acompanhado de um comentário
`// provisório` quando corresponde a um item da Seção 26 (Validações
Pendentes de Playtest) do GDD. Eles estão centralizados em
`src/config/GameConfig.ts` para facilitar o ajuste fino durante os
playtests, sem precisar caçar números espalhados pelo código.

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
  `resolvePressedSuccess`), e o Portão ao final da Fase 5.
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

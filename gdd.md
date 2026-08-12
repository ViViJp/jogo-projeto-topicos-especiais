# Game Design Document — Flesh to Chrome

Revision: 0.1.0  
Base: template de Benjamin “HeadClot” Stanley  
Fonte complementar: `Cyberpunk.md`

---

- Overview
  - Theme / Setting / Genre
  - Core Gameplay Mechanics Brief
  - Targeted platforms
  - Monetization model
  - Project Scope
  - Influences
  - The elevator Pitch
  - Project Description (Brief)
  - Project Description (Detailed)
- What sets this project apart?
  - Core Gameplay Mechanics (Detailed)
- Story and Gameplay
  - Story (Brief)
  - Story (Detailed)
  - Gameplay (Brief)
  - Gameplay (Detailed)
- Assets Needed
- Schedule

---

# Overview

## Theme / Setting / Genre

### Theme

Ascensão social, ganância, transumanismo, desigualdade, perda de humanidade, obsessão pelo sucesso.

### Setting

**Glitch City** — megacidade cyberpunk vertical e socialmente estratificada. Setores pobres, esgotos e industriais nos níveis inferiores; distritos corporativos luxuosos no topo.

### Genre

2D auto-runner / action platformer.

### Título

**Flesh to Chrome**

## Core Gameplay Mechanics Brief

- Corrida automática (horizontal, por fase)
- Pular
- Agachar
- Atacar / quebrar
- Salto duplo (upgrade)
- Visão artificial (upgrade)
- Dash (upgrade)
- Coleta de créditos
- Sistema de vidas (proposta)
- Escolha de final (aceitar ou recusar o último implante)

## Targeted platforms

- Desktop, navegador web
- Engine: **Phaser**

## Monetization model

Trabalho acadêmico, jogo jogável de graça no navegador.

Modelo documentado (não precisa de pagamento real na entrega):

- **Skins cosméticas** (aparência do personagem / cromo)
- Compra com **valor representativo** (preço simbólico na loja, para demonstrar o sistema)
- Créditos coletados in-game também podem desbloquear extras (vidas, skins básicas)
- Nada que altere poder de combate (pay-to-win)

> Detalhe a fechar: se o “valor representativo” é só vitrine acadêmica (preço fictício em R$) ou também um catálogo interno em créditos.

## Project Scope

### Game Time Scale

- **Prazo:** até o fim do semestre (~2–3 meses)
- **Custo:** acadêmico (sem orçamento formal; ferramentas gratuitas / Phaser)
- **Conteúdo alvo:** 5 fases + 4 upgrades + 2 finais + loja de skins

### Team Size

- **Core team:** 3–4 pessoas
- Papéis sugeridos (nomes a preencher):
  - Programação / Phaser (player, fases, colisão, UI)
  - Game design / GDD / balanceamento
  - Arte 2D / placeholders → pixel art depois
  - Áudio / narrativa / QA (pode acumular com outro papel)
- **Marketing:** não se aplica (entrega de disciplina)
- **Licenças:** Phaser (open source), assets próprios ou com licença livre

### Entrega mínima vs. desejável

| Mínimo jogável | Desejável |
| --- | --- |
| 1 fase com corrida, pulo, agachar, obstáculos, morte e restart | 5 fases |
| Placeholders visuais | Pass de arte pixel + neon |
| 1 upgrade funcionando | 4 upgrades + loja + 2 finais |

## Influences

### RoboCop (filme)

Cinema. O nome **Alex Murphy** e o arco “homem vira máquina a serviço de um sistema” vêm daqui. O jogo inverte o tom de justiça: aqui a transformação é voluntária, movida por ganância, não por dever.

### Rayman Jungle Run (jogo)

Game. Referência de auto-runner 2D polido: corrida automática, timing de pulo/agachar, fases curtas e leitura clara de obstáculos. É o “como se joga”.

### BIT.TRIP RUNNER (jogo)

Game. Referência de ritmo, falha punitiva e leitura de padrões. Ajuda a justificar 1 hit = morte e a sensação de “uma fase é uma música de obstáculos”.

### Cyberpunk 2077 (jogo)

Game. Referência de mundo, cromo, clínicas de implante e desigualdade urbana. Visual e temática (não a jogabilidade de FPS).

## The elevator Pitch

Um auto-runner cyberpunk no navegador em que você sobe os andares de Glitch City trocando carne por cromo — e no topo descobre se ainda resta humanidade para aproveitar o que conquistou.

## Project Description (Brief)

**Flesh to Chrome** é um auto-runner 2D no navegador. Alex Murphy vive à margem de Glitch City e decide subir até o pináculo da sociedade. Cada fase é um setor social: o chão corre sozinho, o jogador desvia, quebra, coleta créditos e sobrevive.

Ao fim de cada fase, Alex recebe uma peça mecânica nova (pernas, braços, olhos, propulsores). O cenário fica mais limpo e luxuoso; o corpo, menos humano. Créditos compram vidas e extras; skins têm valor representativo na loja. No último implante, o jogador escolhe: aceitar o cromo total (final trágico) ou recuar (final humano).

## Project Description (Detailed)

Glitch City é uma torre social. Embaixo, esgoto, periferia industrial e violência. No topo, vidro, neon corporativo e silêncio. Alex está cansado de viver na margem. Ele aceita clínicas clandestinas, dívida moral e modificações irreversíveis para “chegar lá”.

A jogabilidade é um runner horizontal por fase. Não há exploração livre: o desafio é timing, leitura de obstáculo e uso do upgrade daquele setor. A progressão narrativa e a progressão mecânica são a mesma coisa — cada andar desbloqueia um verbo novo.

Os créditos servem à sobrevivência (vidas, no modelo Crash) e à fantasia de consumo (skins / valor representativo). Isso reforça o tema: o mesmo recurso que te mantém vivo também te vende identidade.

O contraste visual é parte do design. Fases baixas são sujas, apertadas, cheias de sucata. Fases altas são amplas, limpas, letais de outro jeito (vidro, drones, segurança corporativa). No fim, chegar ao topo sem humanidade é vitória oca; recusar o último implante é abrir mão do “sucesso” para não desaparecer.

O projeto é acadêmico (disciplina de tópicos especiais), feito em Phaser por um time de 3–4 pessoas, com placeholders no começo e 5 fases como alvo do semestre.

# What sets this project apart?

- **Upgrade = andar social:** cada implante muda o corpo e o verbo de jogo.
- **Cidade vertical, fases horizontais:** a subida é estrutura de campanha, não o eixo do nível.
- **Dois finais amarrados ao último cromo:** a escolha moral é também escolha de kit mecânico.
- **Tema de consumo no meta:** créditos, vidas e skins ecoam a ganância do protagonista.
- **Web + Phaser:** sessão curta, fácil de apresentar e jogar no navegador.

## Core Gameplay Mechanics (Detailed)

### 1. Corrida automática

Alex corre sozinho da esquerda para a direita. O jogador não controla velocidade base; controla **quando** pular, agachar, atacar e (depois) dashar.

Isso mantém o foco em timing e leitura de nível, no estilo Jungle Run / BIT.TRIP. Cada fase é um percurso fechado, não um mundo aberto.

### 2. Pular e agachar

Verbos base da Fase 1. Pulo evita buracos, lâminas e barreiras baixas. Agachar passa sob canos, drones e tetos baixos.

A combinação dos dois já permite uma fase completa sem upgrades. Falha = hit (ver vidas).

### 3. Coleta de créditos

Moedas / chips espalhados no percurso, inclusive em rotas arriscadas (pulo justo, quebrar caixa, plataforma alta).

Uso híbrido: **vidas e extras** na clínica / loja entre fases. 100 créditos = 1 vida (proposta). Skins podem ter preço representativo separado.

### 4. Salto duplo — pernas mecânicas (Fase 2)

Detalhe: após a Fase 1, cirurgia automática. Pernas cromadas. O cenário industrial exige gaps maiores.

Como funciona: um segundo pulo no ar, com cooldown interno de “já usou neste pulo”. Não substitui o pulo normal.

### 5. Atacar / quebrar — braços mecânicos (Fase 3)

Detalhe: soco / golpe curto à frente. Quebra caixas, barricadas e alguns inimigos fracos. Não é combo de luta; é ferramenta de runner.

Como funciona: botão de ataque com hitbox à frente por poucos frames. Obstáculos quebráveis vs. sólidos precisam de leitura visual clara (cor / crack).

### 6. Visão artificial — olhos (Fase 4)

Detalhe: o setor corporativo esconde plataformas, armadilhas e rotas de créditos atrás de camuflagem / vidro / HUD.

Como funciona: toggle ou visão permanente na fase. Plataformas “fantasmas” só colidem / aparecem com os olhos ativos. Risco: a visão pode ofuscar o cenário (feedback de “menos humano”).

### 7. Dash — propulsores (Fase 5, final cromo)

Detalhe: só se o jogador **aceitar** o último implante. Atravessa vãos longos, i-frames curtos ou quebra de laser.

Como funciona: impulso horizontal rápido com cooldown. Recusar o implante = Fase 5 alternativa **sem** dash (final humano), mais lenta / outra rota.

### 8. Vidas (proposta, estilo Crash)

- 1 hit = morte da tentativa
- 100 créditos = +1 vida
- Checkpoints no meio da fase
- 0 vidas = game over → volta ao início da fase ou hub entre fases

Ainda em discussão no time; isto é a proposta oficial no GDD até alguém vetar.

# Story and Gameplay

## Story (Brief)

Alex Murphy, cansado da margem de Glitch City, sobe andar por andar vendendo o próprio corpo. Cada clínica o deixa mais capaz e menos humano. No último implante ele escolhe: virar cromo puro no topo, ou recuar e viver (talvez mais embaixo) ainda como gente.

## Story (Detailed)

Alex vive anos nos andares baixos: trabalho precário, violência, neon que não é para ele. A promessa da cidade é simples — quem se modifica, sobe. Ele entra no circuito de clínicas clandestinas.

**Arco por fase**

1. **Submundo** — ainda carne. Medo, fome, sucata. Ele decide que “dessa vez vai”.
2. **Industrial** — pernas novas. Corre mais longe, já não sente o chão como antes.
3. **Meio da cidade** — braços. Quebra o que o bloqueava; começa a quebrar pessoas/sistemas no caminho (inimigos como obstáculo moral, não cutscene longa).
4. **Corporativo** — olhos. Vê o que os ricos escondem. Também deixa de ver o que era humano.
5. **Topo** — a clínica final oferece propulsores / cromo completo.

**Final A — Chrome (trágico):** aceita. Chega ao pináculo. Corpo máquina, sucesso vazio. A cidade o aceita; ele já não sabe por quê queria isso.

**Final B — Flesh (humano):** recusa. Enfrenta o último trecho sem o dash (ou entra num epílogo de descida / exílio). Não é o topo dos cartões-postais, mas resta alguém para lembrar quem ele era.

Tom: sátira amarga, não comédia leve. Diálogos curtos entre fases (clínica, vendedor de cromo, anúncios da cidade). Sem novela: o corpo na tela conta a história.

Personagem jogável: **Alex Murphy**. NPCs de apoio (clínico, vendedor, voz de anúncio corporativo) — nomes a definir.

## Gameplay (Brief)

Cinco fases horizontais de auto-runner. Entre fases: clínica (upgrade automático da peça daquele andar) + loja (vidas, extras, skins a valor representativo). Quatro upgrades ao longo da campanha; o quinto (dash) é a escolha do final. Placeholders visuais no protótipo.

## Gameplay (Detailed)

### Estrutura de uma run

1. HUD: vidas, créditos, setor atual.
2. Corrida automática; obstáculos em padrões crescentes.
3. Créditos em rotas de risco.
4. Checkpoint.
5. Chegada → cutscene curta da clínica → loja → próxima fase.

### Mapa de fases

| Fase | Setor | Verbos | Upgrade ao terminar |
| --- | --- | --- | --- |
| 1 | Submundo / esgoto / periferia | Correr, pular, agachar, coletar | Pernas → salto duplo |
| 2 | Industrial | + salto duplo | Braços → atacar / quebrar |
| 3 | Meio urbano | + ataque | Olhos → visão artificial |
| 4 | Corporativo | + visão | Escolha: propulsores ou recusa |
| 5A | Topo (final cromo) | + dash | — |
| 5B | Topo / exílio (final humano) | sem dash, rota alternativa | — |

### Controles (proposta)

| Ação | Teclado |
| --- | --- |
| Pular / salto duplo | Espaço / W / ↑ |
| Agachar | S / ↓ |
| Atacar | J / clique |
| Dash | K / Shift |
| Visão (se toggle) | L / E |

### Morte e restart

Hit em espinho, buraco, inimigo ou laser consome 1 vida e volta ao checkpoint. Sem vidas: restart da fase. (Proposta.)

### Loja entre fases

- Vidas extras
- Skins (valor representativo)
- Nada que pule fase ou dê invencibilidade permanente

### Dificuldade

Cada setor ensina o upgrade novo em 10–20s “seguros” e depois exige o verbo. Fase 5A é o exame do dash; Fase 5B é o exame de tudo **menos** o dash (pulo, visão, ataque, paciência).

# Assets Needed

Estilo visual: **placeholders primeiro** (retângulos, cores por camada). Meta posterior: pixel art + neon cyberpunk (não fechado).

Jogo 2D; **sem assets 3D**.

## 2D

- Player Alex: corpo humano → 4 estágios de cromo (+ skin variants)
- Tilesets: submundo, industrial, urbano, corporativo, topo
- Obstáculos: buraco, espinho, cano, caixa quebrável, laser, drone
- Inimigos simples (silhueta / hitbox)
- Coletável de crédito
- UI: vidas, créditos, loja, título, tela de final A/B
- Backgrounds em camadas (parallax) por setor
- Ícones de implante na clínica

## 3D

Não se aplica.

## Sound

- Ambiência por setor (5 camadas: sucata → fábrica → rua → escritório → silêncio de luxo)
- Passos / corrida
- Pulo, aterrissagem, agachar
- Hit, morte, checkpoint
- Quebrar caixa / soco
- Dash / propulsor
- Pickup de crédito
- UI da loja e da clínica
- Stingers dos dois finais
- Música loop curta por fase (pode ser 1 tema com variações)

## Code (Phaser)

- Game boot / cenas (menu, fase, clínica, loja, ending)
- Player controller (run auto, jump, crouch, attack, double jump, dash, vision)
- Spawner / tilemap de obstáculos
- Coleta e carteira de créditos
- Vidas + checkpoint + game over
- Persistência simples (fase atual, upgrades, skins) — localStorage
- Sistema de skins / vitrine de preço representativo
- Flag de escolha do final → carrega Fase 5A ou 5B
- HUD

## Animation

- Player: idle (loja), run, jump, double jump, crouch, attack, dash, hit, death
- Transição visual de implante (clínica)
- Caixa quebrando, crédito coletado
- Parallax / luzes de neon
- Inimigos: loop simples + morte

# Schedule

Semestre (~8–12 semanas). Ajustar datas quando a disciplina publicar o calendário.

### Marco 1 — Runner mínimo (semanas 1–2)

- Projeto Phaser no ar no navegador
- Player corre, pula, agacha
- 1 trecho de obstáculos + morte + restart
- Placeholders

### Marco 2 — Loop de fase (semanas 3–4)

- Créditos + HUD
- 1 fase completa (Fase 1)
- Tela entre fases (clínica stub)
- Proposta de vidas implementada

### Marco 3 — Upgrades (semanas 5–7)

- Salto duplo, ataque, visão
- Fases 2–4 jogáveis (ainda placeholders)
- Loja: vidas + 1 skin com preço representativo

### Marco 4 — Finais e conteúdo (semanas 8–10)

- Dash + escolha do implante
- Fase 5A e 5B
- Textos / anúncios / dois endings

### Marco 5 — Polimento e entrega (semanas 11–12)

- Pass rápido de arte ou placeholders consistentes
- Áudio mínimo
- Balanceamento e bugfix
- Build web + GDD alinhado ao build

---

## Aberto / a preencher no time

- Nomes e papéis dos 3–4 integrantes
- Calendário oficial da disciplina
- Se visão artificial é toggle ou permanente na Fase 4
- Fechamento do sistema de vidas (proposta Crash acima)
- Lista inicial de skins e tabela de “valor representativo”
- Nomes dos NPCs da clínica / loja
- Estilo de arte final (depois dos placeholders)

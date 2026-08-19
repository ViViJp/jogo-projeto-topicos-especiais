# Game Design Document — Flesh to Chrome

Revision: 0.2.2  
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
- Hub de setores (rejogar fases já visitadas com o kit atual)
- Zonas secretas (1 por fase 1–4; só alcançáveis com o upgrade da fase seguinte; não definem o final)
- Escolha no Portão: ficar no topo, voltar ao esgoto com as partes, ou descer perdendo os implantes
- Três finais: Chrome (topo, máquina) / Hollow (esgoto, ainda com partes) / Flesh (esgoto, sem nenhuma parte, família)

## Targeted platforms

- Desktop, navegador web

## Monetization model

Trabalho acadêmico, jogo jogável de graça no navegador.

Modelo documentado (não precisa de pagamento real na entrega):

- **Skins cosméticas** (aparência do personagem / cromo)
- Compra com **valor representativo** (preço simbólico na loja, para demonstrar o sistema)
- Créditos coletados in-game também podem desbloquear extras (vidas, skins básicas)
- Nada que altere poder de combate (pay-to-win)

### Detalhamento da vitrine

Créditos (in-game), gastos no hub / Mercador:

| Item | Preço (créditos) | Efeito |
| --- | --- | --- |
| Vida extra | 100 | +1 vida (modelo Crash; proposta) |
| Skin “Sucata” | 80 | Só visual |
| Skin “Tinta de rua” | 150 | Só visual |
| Skin “Cabo desencapado” | 200 | Só visual |

Valor representativo (simula dinheiro real). O botão **Comprar** abre um modal: *pagamento simulado — compra registrada*. Não há gateway real.

| Item | Preço representativo | Efeito |
| --- | --- | --- |
| Skin “Neon Elite” | R$ 4,90 | Só visual |
| Skin “Chrome Mirror” | R$ 9,90 | Só visual |
| Skin “Vektor Special” | R$ 14,90 | Só visual |

Créditos **não** compram as skins de vitrine; R$ simbólico **não** compra vidas.

## Project Scope

### Game Time Scale

- **Prazo:** até o fim do semestre (~2–3 meses)
- **Custo:** acadêmico (sem orçamento formal; ferramentas gratuitas / Phaser)
- **Conteúdo alvo:** 5 fases + 4 upgrades + hub + 4 zonas secretas + descida (reusa os mapas) + 3 finais + loja de skins (não obrigatória no mínimo jogável)

### Team Size

- **Core team:** 3 pessoas
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
| 1 upgrade funcionando | 4 upgrades + loja + hub + 3 finais |

### Corte de escopo (se o tempo apertar)

1. Descida reusa os mesmos tilemaps, mesma direção L→R; percurso invertido é extra.
2. 4 segredos = 1 rota curta por mapa, não um nível novo.
3. Hollow pode ser a mesma cutscene de Flesh com a família ausente (ele ainda está cromado).

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

Ao fim de cada fase, Alex recebe uma peça mecânica nova (pernas, braços, olhos, propulsores). O cenário fica mais limpo e luxuoso; o corpo, menos humano. Créditos compram vidas e extras; skins têm valor representativo na loja.

No topo, o Portão. Três saídas:

- **Final Chrome:** atravessa o Portão. Fica no topo, corpo máquina.
- **Final Hollow:** volta ao esgoto **ainda com as partes mecânicas**. Quarto vazio; a família não está.
- **Final Flesh:** desce os setores perdendo **todas** as partes (incluindo o salto duplo). Chega no esgoto **sem nenhuma peça mecânica**. A família está lá.

Quem define família vs. sozinho é o corpo: carne = Flesh; cromo no esgoto = Hollow. As zonas secretas não mudam o final.

Entre fases, um **hub** deixa rejogar setores já visitados com o kit atual: teases da primeira passagem viram rotas secretas.

## Project Description (Detailed)

Glitch City é uma torre social. Embaixo, esgoto, periferia industrial e violência. No topo, vidro, neon corporativo e silêncio. Alex está cansado de viver na margem. Ele aceita clínicas clandestinas, dívida moral e modificações irreversíveis para “chegar lá”.

A jogabilidade é um runner horizontal por fase. Não há exploração livre: o desafio é timing, leitura de obstáculo e uso do upgrade daquele setor. A progressão narrativa e a progressão mecânica são a mesma coisa — cada andar desbloqueia uma nova acão de jogador (uma nova função de personagem).

O hub entra depois da clínica: setores já visitados podem ser refeitos com o kit novo. A subida continua linear (sem chave obrigatória para avançar). Voltar é como alcançar o que a primeira visita mostrou e não deixou pegar.

Os créditos servem à sobrevivência (vidas, no modelo Crash) e à fantasia de consumo (skins / valor representativo). Isso reforça o tema: o mesmo recurso que te mantém vivo também te vende identidade.

O contraste visual é parte do design. Fases baixas são sujas, apertadas, cheias de sucata. Fases altas são amplas, limpas, letais de outro jeito (vidro, drones, segurança corporativa). No fim, chegar ao topo sem humanidade é vitória oca. Voltar ao esgoto ainda cromado é o Hollow. Só quem perde **todas** as partes mecânicas na descida chega em casa como carne e encontra a família (Flesh).

O projeto é acadêmico (disciplina de tópicos especiais), feito em Phaser por um time de 3 pessoas, com placeholders no começo e 5 fases como alvo do semestre.

# What sets this project apart?

- **Upgrade = andar social:** cada implante muda o corpo e o acão de jogo para o personagem.
- **Cidade vertical, fases horizontais:** a subida é estrutura de campanha, não o eixo do nível.
- **Hub + zonas secretas:** ver o inacessível na subida e voltar com a peça certa.
- **Três finais:** Chrome = fica no topo com as partes. Hollow = volta ao esgoto com as partes. Flesh = volta ao esgoto sem nenhuma parte mecânica (família).
- **Tema de consumo no meta:** créditos, vidas e skins ecoam a ganância do protagonista.
- **Web + Phaser:** sessão curta, fácil de apresentar e jogar no navegador.

## Core Gameplay Mechanics (Detailed)

### 1. Corrida automática

Alex corre sozinho da esquerda para a direita. O jogador não controla velocidade base; controla **quando** pular, agachar, atacar e (depois) dashar.

Isso mantém o foco em timing e leitura de nível, no estilo Jungle Run / BIT.TRIP. Cada fase é um percurso fechado, não um mundo aberto.

A descida, na entrega, reusa esse eixo. “Voltar” é seleção de setor + kit reduzido; espelhar o mapa (correr para a esquerda) é extra.

### 2. Pular e agachar

Acões base da Fase 1. Pulo evita buracos, lâminas e barreiras baixas. Agachar passa sob canos, drones e tetos baixos.

A combinação dos dois já permite uma fase completa sem upgrades. Falha = hit (ver vidas).

### 3. Coleta de créditos

Moedas / chips espalhados no percurso, inclusive em rotas arriscadas (pulo justo, quebrar caixa, plataforma alta).

Uso híbrido: **vidas e extras** na clínica / loja entre fases. 100 créditos = 1 vida (proposta). Skins podem ter preço representativo separado. Créditos não desbloqueiam finais.

### 4. Salto duplo — pernas mecânicas (Fase 2)

Detalhe: após a Fase 1, cirurgia automática. Pernas cromadas. O cenário industrial exige gaps maiores.

Como funciona: um segundo pulo no ar, com cooldown interno de “já usou neste pulo”. Não substitui o pulo normal. Também abre o **segredo da Fase 1** no replay do hub. Na descida Flesh, as pernas saem **antes** de ele correr o esgoto de volta — chega na primeira fase já sem pulo duplo.

### 5. Atacar / quebrar — braços mecânicos (Fase 3)

Detalhe: soco / golpe curto à frente. Quebra caixas, barricadas e alguns inimigos fracos. Não é combo de luta; é ferramenta de runner.

Como funciona: botão de ataque com hitbox à frente por poucos frames. Obstáculos quebráveis vs. sólidos precisam de leitura visual clara (cor / crack). Abre o **segredo da Fase 2**.

### 6. Visão artificial — olhos (Fase 4)

Detalhe: o setor corporativo esconde plataformas, armadilhas e rotas de créditos atrás de camuflagem / vidro / HUD.

Como funciona: toggle fase. Plataformas “fantasmas” só colidem / aparecem com os olhos ativos. Risco: a visão pode ofuscar o cenário, não mostrando espinhos e outras ameaças (feedback de “menos humano”). Abre o **segredo da Fase 3**.

### 7. Dash — propulsores (após Fase 4)

Detalhe: após a Fase 4, cirurgia automática. Impulso horizontal com cooldown e i-frames curtos. Exame da Fase 5 (topo) e **segredo da Fase 4**.

No Portão o jogador não ganha um sexto implante: escolhe ficar com o cromo (**Final Chrome**) ou recusar e descer, perdendo as peças uma a uma.

### 8. Hub de setores

Depois da clínica, o mapa de Glitch City. Setores já visitados podem ser refeitos **com o kit atual**. Progresso da campanha (próxima fase nova) continua linear. Fragmentos coletados persistem como coletável opcional (não definem o final).

Não existe chave obrigatória para subir. Voltar é opcional na subida. Na descida Flesh, o percurso 4 → 3 → 2 → 1 é o caminho em que Vektor arranca as peças **antes** de cada setor; o esgoto de volta já é em carne.

### 9. Zonas secretas (fragmentos)

Uma rota curta por fase 1–4, visível na primeira passagem (luz, plataforma alta, parede rachada) e inalcançável com o kit daquela visita.

| Setor | Fragmento | Ferramenta exigida | Quando fica pegável |
| --- | --- | --- | --- |
| 1 Esgoto | Lembrança da família (ex.: foto) | Salto duplo | Após Fase 1, replay no hub |
| 2 Industrial | Lembrança do trabalho / nome antigo | Braços (quebrar) | Após Fase 2 |
| 3 Meio urbano | Lembrança da rua / voz | Olhos | Após Fase 3 |
| 4 Corporativo | Lembrança do que ele ainda era | Dash | Após Fase 4 |

Na descida Flesh, o jogador **já perdeu** a ferramenta daquele setor ao entrar (Vektor opera **antes** da corrida). Segredos que precisarem do upgrade ficam para o replay do hub na subida.

### 10. Portão e descida

Fim da Fase 5 — o jogador escolhe:

- **Atravessar o Portão** → **Final Chrome.** Fica no topo. Todas as partes mecânicas. Campanha encerra.
- **Voltar ao esgoto agora** → **Final Hollow.** Chega em casa **ainda com as partes mecânicas**. Sozinho; o quarto está vazio.
- **Descer pelas clínicas** → **Final Flesh.** Percurso 4 → 3 → 2 → 1. Vektor arranca um implante **antes** de cada setor (dash → olhos → braços → pernas). Ele entra no esgoto (Fase 1 de volta) **sem nenhuma parte mecânica**. Família.

Quem define sozinho vs. família é só o corpo (cromo no esgoto vs. carne). Zonas secretas não entram nessa conta.

### 11. Vidas (proposta, estilo Crash)

- 1 hit = morte da tentativa
- 100 créditos = +1 vida
- Checkpoints no meio da fase
- 0 vidas = game over → volta ao início da fase ou hub entre fases

Ainda em discussão no time; isto é a proposta oficial no GDD até alguém vetar.

# Story and Gameplay

## Story (Brief)

Alex Murphy, cansado da margem de Glitch City, sobe andar por andar vendendo o próprio corpo. Cada clínica o deixa mais capaz e menos humano. No Portão ele escolhe: ficar máquina no topo, voltar ao esgoto ainda cromado, ou descer perdendo **todas** as partes mecânicas e chegar em casa só de carne, com a família.

## Story (Detailed)

Alex vive anos nos andares baixos: trabalho precário, violência; que não é para ele. A promessa da cidade é simples — quem se modifica, sobe. Ele entra no circuito de clínicas clandestinas.

**Arco por fase**

1. **Esgoto** — ainda carne. Medo, fome, sucata. Ele decide que “dessa vez vai”.
2. **Industrial** — pernas novas. Corre mais longe, já não sente o chão como antes.
3. **Meio da cidade** — braços. Quebra o que o bloqueava; começa a quebrar pessoas/sistemas no caminho (inimigos como obstáculo moral, não cutscene longa).
4. **Corporativo** — olhos. Vê o que os ricos escondem. Também deixa de ver o que era humano.
5. **Topo** — dash. O Portão. George Vektor oferece ficar máquina de vez.

Os fragmentos das zonas secretas são coisas que ele **não olhou** enquanto subia: uma foto no cano, uma caixa que ele não parou para abrir, uma plataforma que só os olhos de elite revelam, um vão que só o propulsor cruza. São coletáveis opcionais. Não decidem o final.

**Final Chrome (trágico):** atravessa o Portão. Chega ao pináculo. Corpo máquina, sucesso vazio. A cidade o aceita; ele já não sabe por quê queria isso.

**Final Hollow:** recusa o Portão e volta ao esgoto **ainda com as partes mecânicas**. Endereço certo, pessoa errada. O quarto está vazio.

**Final Flesh (família):** recusa o Portão e desce pelas clínicas, perdendo **todas** as partes mecânicas. Entra no esgoto sem pulo duplo, sem braços, sem olhos, sem dash. Carne. A família ainda está lá.

Tom: sátira amarga, não comédia leve. Diálogos curtos entre fases (clínica, vendedor de cromo, anúncios da cidade). Sem novela: o corpo na tela conta a história.

Personagem jogável: **Alex Murphy**. NPCs de apoio (clínico - George Vektor, vendedor - Mercador)

## Gameplay (Brief)

Cinco fases horizontais de auto-runner. Entre fases: clínica (upgrade automático da peça daquele andar) + loja (vidas, extras, skins a valor representativo) + hub (replay opcional). Quatro upgrades ao longo da campanha. No Portão: Chrome (topo, máquina), Hollow (esgoto com as partes) ou Flesh (esgoto sem nenhuma parte, família). Placeholders visuais no protótipo.

## Gameplay (Detailed)

### Estrutura de uma run

1. HUD: vidas, créditos, setor atual, fragmentos (4 slots).
2. Corrida automática; obstáculos em padrões crescentes.
3. Créditos em rotas de risco; teases de zona secreta.
4. Checkpoint.
5. Chegada → cutscene curta da clínica → loja → hub (próxima fase e/ou replay).

### Mapa de fases

| Fase | Setor | Ações | Upgrade ao terminar | Segredo (replay) |
| --- | --- | --- | --- | --- |
| 1 | esgoto / periferia | Correr, pular, agachar, coletar | Pernas -> salto duplo | Foto (precisa salto duplo) |
| 2 | Industrial | + salto duplo | Braços -> atacar / quebrar | Caixa/rota quebrável |
| 3 | Meio urbano | + ataque | Olhos -> visão artificial | Plataforma fantasma |
| 4 | Corporativo | + visão | Propulsores -> dash | Vão de dash |
| 5 | Topo | + dash | — (escolha do Portão) | — |

**Descida Flesh (se escolher as clínicas)** — Vektor arranca a peça **antes** de cada setor. O esgoto de volta já é sem nenhuma parte mecânica; esse é o único caminho da família.

| Ordem | Setor | Perde **antes** de entrar | Kit na corrida |
| --- | --- | --- | --- |
| D1 | 4 Corporativo | dash | sem dash |
| D2 | 3 Meio urbano | olhos | sem dash, sem olhos |
| D3 | 2 Industrial | braços | sem dash, sem olhos, sem braços |
| D4 | 1 Esgoto | pernas (salto duplo) | **nenhuma parte mecânica** |
| — | Casa | — | carne → **Final Flesh** (família) |

**Final Hollow** não usa essa tabela: o jogador volta ao esgoto direto, **ainda com as partes**.

### Controles (proposta)

| Ação | Teclado |
| --- | --- |
| Pular / salto duplo | Espaço / W / ↑ |
| Agachar | S / ↓ |
| Atacar | J / clique |
| Dash | K / Shift |
| Visão (se toggle) | L / E |

### Morte e restart

Hit em espinho, buraco, inimigo ou laser consome 1 vida e volta ao checkpoint. Sem vidas: restart da fase. (Proposta.) Hub, créditos, skins e fragmentos salvam.

### Loja entre fases

- Vidas extras
- Skins (valor representativo)
- Sempre acessível no hub. Skins não alteram hitbox. Ver tabelas em Monetization.

### Dificuldade

Cada setor ensina o upgrade novo em 10–20s “seguros” e depois exige a caracteristica do personagem. Teases de segredo devem ser legíveis na primeira visita. A descida é o exame do kit reduzido (mais difícil sem as peças).

# Assets Needed

Estilo visual: **placeholders primeiro** (retângulos, cores por camada). Meta posterior: pixel art + neon cyberpunk (não fechado).

Jogo 2D; **sem assets 3D**.

## 2D

- Player Alex: corpo humano → 4 estágios de cromo (+ skin variants)
- Tilesets: esgoto, industrial, urbano, corporativo, topo
- Obstáculos: buraco, espinho, cano, caixa quebrável, laser, drone
- Inimigos simples (silhueta / hitbox)
- Coletável de crédito
- UI: vidas, créditos, loja, título, tela dos três finais
- Backgrounds em camadas (parallax) por setor
- Ícones de implante na clínica (colocar e arrancar)
- 4 props de fragmento + teaser visível
- Portão do topo
- Hub: mapa vertical da cidade
- Família no esgoto (presente / ausente)

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
- Pickup de fragmento
- UI da loja e da clínica
- Extração de implante (descida)
- Stingers dos três finais
- Música loop curta por fase (pode ser 1 tema com variações)

## Code (Phaser)

- Game boot / cenas (menu, fase, clínica, loja, hub, ending)
- Player controller (run auto, jump, crouch, attack, double jump, dash, vision)
- Spawner / tilemap de obstáculos
- Coleta e carteira de créditos
- Vidas + checkpoint + game over
- Persistência simples (fase atual, upgrades, skins, fragmentos, flag de descida)
- Sistema de skins / vitrine de preço representativo
- Hub (setores liberados + replay com kit atual)
- Flag do Portão → Chrome, Hollow (volta com as partes) ou descida Flesh 4→1 (extração **antes** de cada setor; esgoto já em carne)
- HUD

## Animation

- Player: idle (loja), run, jump, double jump, crouch, attack, dash, hit, death
- Transição visual de implante (clínica) e extração (descida)
- Caixa quebrando, crédito coletado, fragmento
- Parallax / luzes de neon
- Inimigos: loop simples + morte
- Família (idle simples) / quarto vazio

# Schedule

Semestre (~8–12 semanas). Ajustar datas quando a disciplina publicar o calendário.

### Marco 1 — Runner mínimo (semanas 1–2)

- Phaser no navegador
- Corre, pula, agacha
- Obstáculos + morte + restart
- Placeholders

### Marco 2 — Loop de fase (semanas 3–4)

- Créditos + HUD
- Fase 1 completa
- Clínica stub + loja (vida 100 créditos + 1 skin)

### Marco 3 — Upgrades e hub (semanas 5–7)

- Salto duplo, ataque, visão, dash
- Fases 2–5 jogáveis
- Hub: replay de setor visitado
- Rotas secretas (mínimo 1–2 se o tempo apertar; o GDD descreve 4)

### Marco 4 — Portão e descida (semanas 8–10)

- Escolha do Portão → Final Chrome
- Descida reusando mapas + perda de implante
- Finais Flesh (família) e Hollow
- Textos curtos (Vektor, Mercador, anúncios)

### Marco 5 — Polimento e entrega (semanas 11–12)

- Placeholders consistentes ou pass rápido de arte
- Áudio mínimo
- Balanceamento
- Build web + GDD alinhado ao build

---

## Aberto / a preencher no time

- Fechamento do sistema de vidas (proposta Crash acima)
- Estilo de arte final (depois dos placeholders)
- Texto exato das 3 cutscenes
- Nomes e papéis dos 3 integrantes

# Game Design Document — Flesh to Chrome

Revision: 0.2.0  
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
- Zonas secretas (1 por fase 1–4; só alcançáveis com o upgrade da fase seguinte)
- Escolha no topo: Portão (Final Chrome) ou volta (descida)
- Descida: rejogar 4 → 3 → 2 → 1, Marrow/Vektor arranca 1 implante por andar
- Três finais: Chrome / Flesh / Hollow

## Targeted platforms

- Desktop, navegador web
- Engine: Phaser

## Monetization model

Jogo acadêmico, **grátis** no navegador. A loja existe para demonstrar dois tipos de gasto: **créditos in-game** e **valor representativo** (simula dinheiro real). Nenhum item muda poder, pulo, dash, vidas máximas permanentes nem pula fase — **sem pay-to-win**.

### Moeda in-game — créditos

Coletados nas fases (rotas de risco pagam mais). Gastam-se no hub / Mercador:

| Item | Preço (créditos) | Efeito |
| --- | --- | --- |
| Vida extra | 100 | +1 vida (modelo Crash; proposta) |
| Skin “Sucata” | 80 | Só visual |
| Skin “Tinta de rua” | 150 | Só visual |
| Skin “Cabo desencapado” | 200 | Só visual |

### Valor representativo — “dinheiro real” (simulado)

Vitrine do Mercador com preços em R$ fictícios. Na entrega acadêmica o botão **Comprar** abre um modal: *pagamento simulado — compra registrada*. Não há gateway real.

| Item | Preço representativo | Efeito |
| --- | --- | --- |
| Skin “Neon Elite” | R$ 4,90 | Só visual |
| Skin “Chrome Mirror” | R$ 9,90 | Só visual |
| Skin “Vektor Special” | R$ 14,90 | Só visual |

Créditos **não** compram as skins de vitrine; R$ simbólico **não** compra vidas. Os dois eixos ficam separados de propósito: sobreviver custa suor; identidade de elite custa o cartão.

## Project Scope

### Game Time Scale

- **Prazo:** até o fim do semestre (~2–3 meses)
- **Custo:** acadêmico (sem orçamento formal)
- **Conteúdo alvo:** 5 fases de subida + hub de replay + 4 zonas secretas + descida (reusa os mesmos mapas) + 3 finais + loja (créditos + vitrine)

### Team Size

- **Core team:** 3 pessoas
- Papéis sugeridos (nomes a preencher):
  - Programação / Phaser (player, fases, colisão, UI, hub, persistência)
  - Game design / GDD / balanceamento / rotas secretas
  - Arte 2D / placeholders → pixel art depois
  - Áudio / narrativa / QA (acumula com outro papel)
- **Marketing:** não se aplica
- **Licenças:** Phaser (open source), assets próprios ou com licença livre

### Entrega mínima vs. desejável

| Mínimo jogável | Desejável |
| --- | --- |
| 1 fase com corrida, pulo, agachar, obstáculos, morte e restart | 5 fases de subida |
| Placeholders visuais | Pass de arte pixel + neon |
| 1 upgrade funcionando | 4 upgrades + hub + 4 segredos |
| Final Chrome (portão) | Descida + finais Flesh e Hollow + loja |

### Corte de escopo (se o tempo apertar)

1. Descida usa **os mesmos tilemaps, mesma direção L→R**, só muda HUD (“retorno ao setor”) e o kit (implante a menos). Percurso invertido (correr para a esquerda) é extra, não requisito da entrega.
2. 4 segredos = 1 plataforma / 1 rota curta por mapa, não um nível novo.
3. Hollow pode ser a mesma cutscene de Flesh com 2–3 linhas e um sprite a menos (família ausente).

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

Um auto-runner cyberpunk no navegador em que você sobe Glitch City trocando carne por cromo — e no topo escolhe ficar máquina ou descer, devolver as peças e descobrir se ainda resta alguém esperando no esgoto.

## Project Description (Brief)

**Flesh to Chrome** é um auto-runner 2D no navegador. Alex Murphy vive à margem de Glitch City e sobe setor por setor. Cada fase dá um implante novo. Entre fases, um **hub** deixa rejogar setores já visitados com o kit atual: teases da primeira passagem viram rotas secretas.

No topo, o Portão. Atravessar é o **Final Chrome** (sucesso oco). Recusar inicia a **descida**: os mesmos setores, um implante a menos a cada andar. Quatro **fragmentos** escondidos (um por fase 1–4) só saem com o verbo que você ainda não tinha na primeira visita. Trazer os quatro para casa é o **Final Flesh**. Descer sem eles é o **Final Hollow** — o esgoto, sem a família.

Créditos compram vidas e skins baratas. O Mercador vende cromo de vitrine a preço em R$ representativo (pagamento simulado).

## Project Description (Detailed)

Glitch City é uma torre social. Embaixo, esgoto, periferia industrial e violência. No topo, vidro, neon corporativo e silêncio. Alex aceita clínicas, dívida moral e cromo para “chegar lá”.

A subida é linear e ensina um verbo por andar. O jogo deixa de ser um corredor estático no **hub**: depois de cada implante, o mapa da cidade reabre os andares de baixo. O salto que não existia na Fase 1 agora alcança uma prateleira que o jogador já viu e não pegou. Interatividade = **voltar com ferramenta nova**, não árvore de diálogo.

O Portão no topo é a pergunta do tema. Quem atravessa fecha o pacto. Quem volta paga o preço mecânico: Vektor arranca as peças na ordem inversa. Sem dash o corporativo dói; sem pernas o esgoto, que você já “ganhou”, vira outro jogo.

Os fragmentos são memória, não loot de poder: foto, voz, brinquedo, nome. Quem os carrega ainda consegue reconhecer o que deixou. Quem só desce o corpo chega num quarto vazio.

O consumo no meta ecoa o tema. Crédito de rua compra mais uma chance. O cartão (simulado) compra brilho. Nenhum dos dois compra humanidade — isso só o caminho de volta.

# What sets this project apart?

- **Upgrade = andar social:** cada implante muda o corpo e o verbo de jogo.
- **Hub + tease:** ver o inacessível na subida e voltar com a peça certa.
- **Descida como inverso moral e mecânico:** perde cromo, ganha (ou não) a família.
- **Três finais** amarrados a uma escolha + coletáveis, sem novela.
- **Duas carteiras:** suor (créditos) vs. vitrine (R$ simbólico), zero pay-to-win.
- **Web + Phaser:** sessão curta, fácil de apresentar no navegador.

## Core Gameplay Mechanics (Detailed)

### 1. Corrida automática

Alex corre sozinho da esquerda para a direita. O jogador controla **quando** pular, agachar, atacar e (depois) dashar. Cada fase é um percurso fechado.

A descida, na entrega, reusa esse eixo. “Voltar” é seleção de setor + kit reduzido, não obrigatoriamente espelhar o mapa.

### 2. Pular e agachar

Verbos da Fase 1. Pulo: buracos, lâminas, barreiras baixas. Agachar: canos, drones, tetos baixos. Falha = hit (ver vidas).

### 3. Coleta de créditos

Chips em rotas de risco. Alimentam vidas e skins baratas. Não desbloqueiam fragmentos nem finais.

### 4. Salto duplo — pernas (após Fase 1)

Segundo pulo no ar, uma vez por voo. Abre gaps da Fase 2 e o **segredo da Fase 1** no replay.

### 5. Atacar / quebrar — braços (após Fase 2)

Golpe curto à frente. Caixas vs. sólidos com leitura visual clara. Abre o **segredo da Fase 2**.

### 6. Visão artificial — olhos (após Fase 3)

Toggle na fase. Plataformas fantasma só existem com os olhos ligados; o HUD pode esconder ameaças (menos humano). Abre o **segredo da Fase 3**.

### 7. Dash — propulsores (após Fase 4)

Impulso horizontal com cooldown e i-frames curtos. Exame da Fase 5 (topo) e **segredo da Fase 4**.

### 8. Hub de setores

Depois da clínica, o mapa de Glitch City. Setores já visitados podem ser refeitos **com o kit atual**. Progresso da campanha (próxima fase nova) continua linear. Fragmentos coletados persistem (localStorage).

Não existe chave obrigatória para subir. Voltar é opcional na subida e **necessário** se o jogador recusar o Portão e quiser o Final Flesh.

### 9. Zonas secretas (fragmentos)

Uma rota curta por fase 1–4, visível na primeira passagem (luz, plataforma alta, parede rachada) e inalcançável com o kit daquela visita.

| Setor | Fragmento | Ferramenta exigida | Quando fica pegável |
| --- | --- | --- | --- |
| 1 Esgoto | Lembrança da família (ex.: foto) | Salto duplo | Após Fase 1, replay ou descida |
| 2 Industrial | Lembrança do trabalho / nome antigo | Braços (quebrar) | Após Fase 2 |
| 3 Meio urbano | Lembrança da rua / voz | Olhos | Após Fase 3 |
| 4 Corporativo | Lembrança do que ele ainda era | Dash | Após Fase 4 |

Na descida, o jogador **ainda tem** a ferramenta daquele segredo e só a perde **depois** de completar aquele setor (Vektor opera na clínica de retorno).

### 10. Portão e descida

Fim da Fase 5:

- **Atravessar o Portão** → Final Chrome. Campanha encerra. Fragmentos não mudam esse final (a ganância ganha mesmo com a memória no bolso).
- **Recusar** → modo descida: ordem 4 → 3 → 2 → 1. Após cada setor, um implante é removido (dash → olhos → braços → pernas). Chega ao esgoto em carne.

Fragmentos 4/4 na chegada → **Final Flesh**. Menos de 4 → **Final Hollow**.

### 11. Vidas (proposta, estilo Crash)

- 1 hit = morte da tentativa
- 100 créditos = +1 vida (loja ou automático — o time fecha na implementação)
- Checkpoints no meio da fase
- 0 vidas = restart da fase; hub e fragmentos salvam

# Story and Gameplay

## Story (Brief)

Alex Murphy sobe Glitch City vendendo o corpo. No Portão, fica cromo ou volta. Na volta, Vektor devolve carne trecho a trecho. Se Alex trouxer as quatro lembranças, a família ainda está no esgoto. Se só trouxer o corpo, o quarto está vazio.

## Story (Detailed)

Alex vive nos andares baixos. A cidade promete: quem se modifica, sobe. Ele entra no circuito do **George Vektor** (clínico) e do **Mercador** (vitrine de identidade).

**Arco de subida**

1. **Esgoto** — carne. Medo, sucata, a decisão.
2. **Industrial** — pernas. O chão já não é o mesmo.
3. **Meio da cidade** — braços. Quebra o que o bloqueava; começa a quebrar gente no caminho.
4. **Corporativo** — olhos. Vê o que os ricos escondem; deixa de ver o que era humano.
5. **Topo** — dash. O Portão. Vektor oferece o último fecho de cromo / o status que a cidade reconhece.

Os fragmentos são coisas que ele **não olhou** enquanto subia: uma foto no cano, uma caixa que ele não parou para abrir, uma plataforma que só os olhos de elite revelam, um vão que só o propulsor cruza. Cada uma é uma versão dele que a subida tornou inconveniente.

**Final Chrome:** atravessa. Pináculo, corpo máquina, vitória oca. A cidade o aceita. Ele não sabe mais por que queria isso.

**Final Flesh:** recusa, desce, devolve as quatro peças, entrega as quatro lembranças. Não é o cartão-postal. Resta alguém — e restam pessoas no esgoto que ainda usam o nome dele.

**Final Hollow:** recusa e desce, mas a corrida de volta foi só corpo. Sem os fragmentos, a família não está. Ele voltou ao endereço certo, pessoa errada.

Tom: sátira amarga. Falas curtas na clínica, no Mercador e nos anúncios da cidade. O corpo na tela conta o resto.

## Gameplay (Brief)

Cinco fases de subida. Hub para replay com kit atual. Quatro fragmentos opcionais na subida, recuperáveis na descida. Portão = Chrome. Recusa = descida 4→1 com perda de implante. 4/4 = Flesh; <4 = Hollow. Loja: créditos vs. R$ simbólico.

## Gameplay (Detailed)

### Estrutura de uma sessão (subida)

1. HUD: vidas, créditos, setor, fragmentos (4 slots).
2. Corrida; obstáculos; teases de segredo.
3. Checkpoint.
4. Chegada → clínica (implante automático) → Mercador / loja → **mapa do hub** (próxima fase nova e/ou replay).

### Mapa de fases

| Fase | Setor | Verbos na primeira visita | Upgrade ao terminar | Segredo (replay) |
| --- | --- | --- | --- | --- |
| 1 | Esgoto / periferia | Correr, pular, agachar, coletar | Pernas → salto duplo | Foto (precisa salto duplo) |
| 2 | Industrial | + salto duplo | Braços → atacar | Caixa/rota quebrável |
| 3 | Meio urbano | + ataque | Olhos → visão | Plataforma fantasma |
| 4 | Corporativo | + visão | Propulsores → dash | Vão de dash |
| 5 | Topo | + dash | — (escolha do Portão) | — |

**Descida (se recusar o Portão)**

| Ordem | Setor | Kit ao entrar | Perde depois | Pode pegar o fragmento? |
| --- | --- | --- | --- | --- |
| D1 | 4 Corporativo | tudo, incl. dash | dash | sim, se ainda não tiver |
| D2 | 3 Meio urbano | sem dash | olhos | sim |
| D3 | 2 Industrial | sem olhos | braços | sim |
| D4 | 1 Esgoto | sem braços, **ainda com salto duplo** | pernas | sim |
| — | Casa | carne | — | avalia 4/4 → Flesh ou Hollow |

### Controles (proposta)

| Ação | Teclado |
| --- | --- |
| Pular / salto duplo | Espaço / W / ↑ |
| Agachar | S / ↓ |
| Atacar | J / clique |
| Dash | K / Shift |
| Visão (toggle) | L / E |

### Morte e restart

Hit consome 1 vida e volta ao checkpoint. Sem vidas: restart da fase. Hub, créditos, skins e fragmentos salvam.

### Loja (Mercador)

Ver tabela em Monetization. Sempre acessível no hub. Skins não alteram hitbox.

### Dificuldade

Cada fase nova ensina o upgrade em 10–20s e depois exige o verbo. Teases de segredo devem ser **legíveis e injustos na primeira visita** (o jogador entende *por que* não alcançou). Replay e descida é o exame do kit completo, depois do kit reduzido.

# Assets Needed

Estilo visual: **placeholders primeiro**. Meta posterior: pixel art + neon (não fechado). Jogo 2D; **sem 3D**.

## 2D

- Player Alex: humano → 4 estágios de cromo (+ skins)
- Tilesets: esgoto, industrial, urbano, corporativo, topo
- Obstáculos: buraco, espinho, cano, caixa quebrável, laser, drone, plataforma fantasma
- 4 props de fragmento + teaser visível
- Portão do topo
- Hub: mapa vertical da cidade
- UI: vidas, créditos, 4 slots de fragmento, loja (créditos + vitrine R$), finais Chrome / Flesh / Hollow
- Ícones de implante na clínica (colocar e arrancar)
- Família no esgoto (presente / ausente)

## 3D

Não se aplica.

## Sound

- Ambiência por setor (5 camadas)
- Passos, pulo, agachar, hit, morte, checkpoint
- Quebrar, dash, pickup de crédito, pickup de fragmento
- UI da loja / clínica / extração de implante
- Stingers dos três finais
- Música por fase (um tema com variações; descida = o mesmo tema mais seco)

## Code (Phaser)

- Cenas: menu, fase, clínica, loja, hub, endings
- Player (run, jump, crouch, attack, double jump, dash, vision)
- Tilemap / spawner
- Créditos + carteira
- Vidas + checkpoint + game over
- Persistência: fase, kit, fragmentos, skins, flag de descida (localStorage)
- Hub (setores liberados + replay com kit atual)
- Loja em dois eixos (créditos vs. compra simulada)
- Flag do Portão → Chrome ou descida 4→1 com perda de implante
- Avaliação 4/4 vs <4 no fim da descida
- HUD

## Animation

- Player: idle, run, jump, double jump, crouch, attack, dash, hit, death
- Clínica: implante e extração
- Caixa, crédito, fragmento
- Portão
- Família (idle simples) / quarto vazio
- Parallax / neon
- Inimigos: loop + morte

# Schedule

Semestre (~8–12 semanas). Ajustar ao calendário da disciplina.

### Marco 1 — Runner mínimo (semanas 1–2)

- Phaser no navegador
- Corre, pula, agacha
- Obstáculos + morte + restart
- Placeholders

### Marco 2 — Loop de fase (semanas 3–4)

- Créditos + HUD
- Fase 1 completa
- Clínica stub + loja (vida 100 créditos + 1 skin barata + 1 skin R$ simulada)

### Marco 3 — Upgrades e hub (semanas 5–7)

- Salto duplo, ataque, visão, dash
- Fases 2–5 jogáveis
- Hub: replay de setor visitado
- 4 teases + 4 rotas secretas (mínimo: 1–2 rotas se o tempo apertar, o GDD mantém 4)

### Marco 4 — Portão e descida (semanas 8–10)

- Escolha do Portão → Final Chrome
- Descida reusando mapas + perda de implante
- Finais Flesh e Hollow
- Textos curtos (Vektor, Mercador, anúncios)

### Marco 5 — Polimento e entrega (semanas 11–12)

- Placeholders consistentes ou pass rápido de arte
- Áudio mínimo
- Balanceamento
- Build web + GDD = build

---

## Decisões fechadas nesta revisão

- Subida linear 1→5; hub para rejogar com kit atual; **sem** chave obrigatória para avançar.
- Segredo da fase N exige o upgrade ganho **ao terminar N**.
- Descida = recusar o Portão; implementação pode manter L→R.
- Três finais: Chrome (portão), Flesh (descida + 4 fragmentos), Hollow (descida sem os 4).
- Monetização acadêmica: créditos vs. vitrine R$ simulada; só cosmético + vidas por crédito.

## Aberto / a preencher no time

- Nomes e papéis dos 3 integrantes
- Calendário oficial da disciplina
- Fechar vidas: 100 créditos automáticos vs. compra na loja
- Texto exato dos 4 fragmentos e das 3 cutscenes
- Estilo de arte final (depois dos placeholders)

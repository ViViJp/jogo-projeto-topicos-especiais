# Game Design Document — Flesh to Chrome

**Revision:** 1.0.0 — adequação ao template obrigatório, preservando o design conceitualmente fechado
**Base:** template de Benjamin “HeadClot” Stanley  
**Fonte complementar:** `Cyberpunk.md`  
**Última revisão:** setembro de 2026

---

---

# 1. Overview

## 1.1 Título

**Flesh to Chrome**

## 1.2 Tema

Ascensão social, ganância, transumanismo, desigualdade, perda de humanidade e obsessão pelo sucesso.

> **Quanto mais poderoso o protagonista se torna como personagem jogável, menos humano ele se torna como pessoa.**

## 1.3 Ambientação

**Glitch City** é uma megacidade cyberpunk vertical e socialmente estratificada.

Os níveis inferiores concentram esgoto, sucata, moradias precárias, infraestrutura improvisada e indústria pesada. Os níveis intermediários representam o espaço urbano e comercial. Os setores superiores pertencem às corporações e à elite.

A campanha representa uma ascensão social. As fases são horizontais, mas cada setor concluído corresponde a um novo nível da cidade e da hierarquia social.

> **Observação:** “Glitch City” era um nome anterior do projeto e agora é utilizado intencionalmente como nome da cidade.

## 1.4 Gênero

**2D auto-runner / action platformer**, com progressão linear, upgrades de movimento e narrativa integrada às modificações corporais.

---

# 2. Design Pillars

Toda funcionalidade de gameplay ou conteúdo deve reforçar pelo menos um dos quatro pilares abaixo.

1. **Movimento simples, execução precisa** — poucas ações, leitura rápida e desafio baseado em timing.
2. **Upgrade é narrativa** — cada implante altera o gameplay e representa uma perda de humanidade.
3. **Ascensão visual e social** — cada novo setor deve parecer mais rico, limpo e controlado que o anterior.
4. **Poder tem custo** — a evolução mecânica reforça a crítica ao consumo, ao status e à substituição do corpo.

---

# 3. Core Gameplay Loop

**correr automaticamente → identificar obstáculo → executar a ação correta → coletar créditos opcionalmente → alcançar o checkpoint → enfrentar combinações mais difíceis → concluir o setor**

O jogador não explora livremente o cenário. O desafio principal é reconhecer padrões, reagir rapidamente, aprender com a repetição e executar a ação correta.

---

# 4. Meta Gameplay Loop

**concluir setor → passar pela clínica → aceitar um novo implante → testar a nova habilidade → avançar → chegar ao Portão → aceitar ou rejeitar a conversão final**

Ao recusar o Portão, a campanha entra na sequência de descida:

**retornar pelos setores → recuperar memórias → abandonar implantes em sequência → chegar ao lar → Flesh ou Hollow**

Não haverá HUB.

---

# 5. Core Gameplay Mechanics — Brief

## 5.1 Mecânicas de núcleo

- Corrida automática.
- Pulo.
- Slide.
- Ataque/quebra.
- Salto duplo.
- Scan.
- Dash.
- Coleta opcional de créditos.
- Morte em um hit.
- Checkpoints.
- Progressão por implantes.
- Transformação visual de Alex.
- Escolha no Portão.
- Final Chrome.
- Caminho Flesh.
- Hollow como resultado intermediário da descida.

## 5.2 Conteúdo secundário

- Multiplayer competitivo.
- Parallax avançado.
- Áudio específico por setor.

## 5.3 Conteúdo opcional — somente se houver tempo

- Skins cosméticas.
- Loja de skins.
- Mercador como interface da loja.
- Vitrine de monetização fictícia com pagamento simulado.

Esses elementos não fazem parte do núcleo do MVP e só devem ser implementados depois que campanha, finais, save, multiplayer e estabilidade estiverem resolvidos.

A carteira de créditos permanece no MVP como **pontuação da campanha**. Se a loja opcional for implementada, o jogo deve registrar separadamente **pontuação total obtida** e **saldo de créditos disponível para cosméticos**, evitando que gastar créditos apague a pontuação já conquistada.

---

# 6. Targeted Platforms

- **Desktop Web Browser**
- Teclado
- Resolução lógica: **1280 × 720**
- Scaling responsivo
- Chrome/Chromium e Firefox

Fora do escopo principal:

- Android;
- iOS;
- controles touch.

---

# 7. Project Scope

## 7.1 Game Time Scale e contexto de produção

- **Prazo:** novembro de 2026.
- **Equipe:** 3 pessoas.
- **Engine:** Phaser.
- **Versão declarada no repositório:** Phaser `^4.2.1`.
- **Linguagem:** TypeScript.
- **Bundler:** Parcel.
- **Level design:** Tiled/JSON.
- **Experiência prévia com jogos/Phaser:** inicial.
- **Custo/orçamento:** projeto acadêmico, sem orçamento formal; prioriza ferramentas gratuitas, software open source e produção própria.
- **Marketing:** não se aplica como requisito da entrega acadêmica. A vitrine de monetização é apenas uma demonstração de modelo de receita.
- **Licenças:** Phaser/open source e assets próprios ou com licenças compatíveis com uso acadêmico e distribuição web.


## 7.2 Team Size

**Core team:** 3 integrantes.

Os papéis e responsáveis estão detalhados na Seção 8 — Equipe.

## 7.3 Entrega mínima vs. entrega-alvo

| Nível | Conteúdo |
| --- | --- |
| Protótipo técnico | Corrida, pulo, slide, obstáculos, colisão, câmera, morte/restart e placeholders. |
| Vertical Slice | Fase 1 completa, checkpoint, créditos, clínica de George, pernas mecânicas, salto duplo e início da Fase 2. |
| Campanha núcleo | Cinco fases, quatro implantes, save, Portão e Final Chrome. |
| MVP narrativo completo | Escolha no Portão, descida, quatro glitches/memórias, bioprinting, Final Flesh, Hollow e epílogo. |
| Conteúdo posterior | Multiplayer, parallax avançado, áudio adicional e monetização cosmética simulada. |

## 7.4 Nível 1 — Protótipo técnico

- Corrida.
- Pulo.
- Slide.
- Obstáculos.
- Colisão.
- Câmera.
- Morte/restart.
- Placeholders.

## 7.5 Nível 2 — Vertical Slice

- Fase 1.
- Clínica.
- Pernas.
- Salto duplo.
- Trecho inicial da Fase 2.
- Transformação visual.

**concluir fase → sacrificar corpo → ganhar poder → gameplay muda**

## 7.6 Nível 3 — Ascensão completa

- 5 fases.
- 4 implantes.
- Inimigos simples.
- Checkpoints.
- Créditos.
- Clínicas.
- Portão.
- Prólogo.
- Final Chrome.
- Persistência.

## 7.7 Nível 4 — MVP narrativo completo

Meta principal da equipe:

- escolha no Portão;
- Final Chrome;
- descida;
- quatro fragmentos;
- retirada sequencial dos implantes;
- Final Flesh;
- Hollow como resultado de falha da descida;
- epílogo no Esgoto.

## 7.8 Conteúdo posterior ao núcleo narrativo

- Multiplayer.
- Parallax avançado.
- Áudio adicional.
- Skins cosméticas.
- Loja do Mercador.
- Vitrine de monetização simulada.

## 7.9 Fallback de escopo

Se a descida completa se mostrar inviável próximo à entrega:

- manter Final Chrome completo;
- manter a opção de recusar o Portão;
- substituir temporariamente a descida completa por um Hollow em cutscene.

Essa é uma medida de emergência, não a meta principal.

---

# 8. Team Size / Equipe

| Integrante | Responsabilidade principal | Secundária |
| --- | --- | --- |
| Vitor Nascimento | Programação / Phaser | Integração / QA |
| Victor Blum | Game design / level design / GDD | Narrativa / balanceamento |
| João Pedro | Arte 2D / UI | Áudio / QA |

**Escopo:** Victor Blum  
**Player Controller:** Vitor Nascimento  
**Level design:** Victor Blum  
**Assets/UI:** João Pedro

---

# 9. Influences

## RoboCop

Relação homem/máquina, perda de identidade e transformação corporal.

O protagonista se chama **Alex Murphy** por decisão da equipe.

## Rayman Jungle Run

Auto-runner 2D, leitura rápida de obstáculos e timing.

## BIT.TRIP RUNNER

Ritmo, repetição, padrões e falha rápida.

## Cyberpunk 2077

Implantes, desigualdade, clínicas e estética corporativa. Não é referência para RPG, mundo aberto ou combate complexo.

---

# 10. The Elevator Pitch

**Flesh to Chrome é um auto-runner cyberpunk em que um homem escala uma cidade dividida por classes, substituindo partes do próprio corpo por máquinas para alcançar o topo — e descobrindo que cada nova habilidade também o afasta daquilo que tentava salvar.**

---

# 11. Project Description

## 11.1 Brief

Alex Murphy vive nos níveis mais baixos de Glitch City com os avós e o tio paterno.

Desde criança, ouve do avô histórias sobre o topo. Anos depois, encontra em um jornal uma matéria sobre um dos ciborgues mais bem-sucedidos da alta sociedade e reconhece nele o pai, que havia abandonado a família mais de oito anos antes.

Alex passa a querer:

- reencontrar o pai;
- compreender como ele chegou ao topo.

Ao concluir cada uma das quatro primeiras fases, Alex aceita conscientemente um implante instalado por George Vektor:

1. pernas;
2. braços;
3. olhos;
4. propulsores.

Sua hesitação diminui a cada procedimento.

No topo, Alex finalmente chega ao mundo que motivou sua obsessão e precisa decidir se aceita a conversão completa ou abandona o caminho que percorreu.

## 11.2 Detailed

Glitch City funciona simultaneamente como cenário e metáfora da campanha. Os setores inferiores representam precariedade, improviso e sobrevivência; conforme Alex sobe, a arquitetura torna-se mais limpa, luxuosa e controlada. A ascensão física entre setores corresponde à ascensão social que o protagonista deseja.

Alex Murphy inicia a história vivendo com os avós e o tio paterno nos níveis inferiores. O pai abandonou a família há mais de oito anos. Quando Alex encontra uma matéria sobre um dos ciborgues mais bem-sucedidos da elite e reconhece o próprio pai, passa a tratar aquela trajetória como prova de que alguém de sua origem pode chegar ao topo.

A campanha é um auto-runner horizontal dividido em cinco fases. Alex corre automaticamente e o jogador controla principalmente timing de pulo, slide, ataque, scan e dash. Cada uma das quatro primeiras fases termina com um procedimento realizado por George Vektor. As cirurgias substituem progressivamente pernas, braços, olhos e, por fim, adicionam propulsores.

As modificações são voluntárias. Alex começa hesitante, mas demonstra cada vez menos resistência à substituição do corpo. Em paralelo, George também muda: o médico inseguro passa a tratar Alex como sua principal obra e como instrumento para conquistar reputação.

A progressão mecânica e a narrativa são a mesma estrutura. Pernas liberam salto duplo; braços liberam ataque/quebra; olhos liberam scan; propulsores liberam dash. A Fase 5 exige domínio do conjunto completo e termina no Portão.

No Portão, o jogador pode aceitar a conversão completa e seguir para o **Final Chrome**, ou recusar e iniciar o caminho de descida. Chrome encerra a obsessão de forma trágica: Alex chega ao topo, encontra fisicamente o pai, mas já não é capaz de reconhecê-lo.

Na descida, glitches neurológicos provocados pela integração dos implantes com o cérebro de Alex despertam memórias reprimidas. Cada memória recuperada permite abandonar uma camada de cromo. George se recusa a desfazer sua “obra”, então Alex utiliza a **ReForge Industries**, corporação que lucra reciclando implantes valiosos e substituindo-os por partes orgânicas bioprintadas, baratas e imperfeitas.

Completar toda a cadeia leva ao **Final Flesh**: Alex retorna humano à família, embora carregue cicatrizes e sequelas físicas. Falhar definitivamente em recuperar um glitch interrompe a cadeia e leva ao **Hollow**, no qual ele retorna parcialmente mecanizado e emocionalmente incapaz de se reconectar.

O multiplayer é separado da campanha. Ele reutiliza o moveset completo em uma corrida competitiva de dois jogadores, sem PvP direto, na qual o resultado combina tempo e créditos. A loja cosmética e a monetização simulada são opcionais e só entram se houver tempo após a estabilização do núcleo do projeto.

---

# 12. What Sets This Project Apart?

- **Upgrade = transformação narrativa.**
- **Progressão social visível.**
- **Poder com consequência.**
- **Descida como perda jogável das habilidades.**
- **Runner como linguagem principal.**
- **Pai como espelho narrativo do destino de Alex.**
- **George como espelho secundário:** ele também se torna mais ganancioso à medida que a jornada de Alex aumenta sua reputação.

---

# 13. Story and Gameplay

## 13.1 Story — Brief

Alex Murphy descobre que o pai que abandonou sua família tornou-se um ciborgue de sucesso no topo de Glitch City. Convencido de que também pode ascender, Alex substitui progressivamente o próprio corpo por tecnologia. No Portão, precisa decidir entre concluir a transformação ou abandonar a obsessão e reconstruir aquilo que ainda resta de sua humanidade.

## 13.2 Story — Detailed

A história começa nos setores inferiores de Glitch City, onde Alex vive com os avós e o tio paterno. As histórias contadas pelo avô alimentaram desde a infância uma fascinação pelo topo da sociedade. A descoberta de que seu pai alcançou exatamente esse espaço transforma a fascinação em objetivo.

George Vektor viabiliza a subida oferecendo procedimentos experimentais acessíveis. Cada cirurgia torna Alex mais capaz e, ao mesmo tempo, menos resistente à substituição corporal. George percorre um arco paralelo: a insegurança inicial é substituída por orgulho e ganância conforme o sucesso de Alex melhora sua reputação.

No topo, o Portão materializa a decisão temática do jogo. Aceitar a conversão leva ao Chrome. Recusar inicia a descida, na qual glitches neurológicos fazem Alex recuperar memórias que os implantes e sua obsessão haviam reprimido.

Como George se recusa a retirar os implantes, Alex utiliza a ReForge Industries. A empresa recupera o cromo — material socialmente mais valioso — e fornece substitutos orgânicos bioprintados de qualidade inferior. A cada remoção Alex perde uma habilidade especial e recupera uma parte imperfeita de sua condição humana.

No caminho Flesh, a imagem do pai reaparece como holograma corporativo na Fase 2 — Industrial. Mesmo depois de chegar ao símbolo que perseguiu, Alex continua descendo para a família. Se recuperar todas as memórias, chega ao Flesh. Se quebrar a cadeia, chega ao Hollow.

## 13.3 Gameplay — Brief

Cinco fases horizontais de auto-runner compõem a subida. A base é corrida automática, pulo e slide. Cada setor acrescenta uma habilidade nova: salto duplo, ataque, scan e dash. O jogador coleta créditos opcionais, ativa checkpoints e aprende padrões de obstáculos.

Ao recusar o Portão, os mesmos setores são revisitados em contexto de descida. Memórias escondidas em pequenas rotas secretas permitem retirar implantes de forma sequencial, reduzindo o moveset até o retorno humano.

## 13.4 Gameplay — Detailed

A velocidade-base é fixa e a dificuldade é construída pelo espaçamento, combinação e leitura dos obstáculos. O jogo utiliza morte em um hit para hazards fatais, restart rápido e checkpoints diegéticos representados por videogame e televisão de tubo.

Créditos funcionam como pontuação persistente da campanha. Antes de um checkpoint, morrer faz perder apenas créditos ainda não consolidados. Durante a descida, créditos comuns são removidos para concentrar a atenção nos glitches e nas decisões narrativas.

Objetos quebráveis não matam imediatamente: ao colidir, Alex recebe uma pequena janela para reagir com ataque. O scan funciona como pulso temporário e revela elementos daquele trecho. O dash possui cooldown e não concede invencibilidade.

A descida mantém os mesmos mapas-base e direção horizontal, mas adiciona rotas secretas, glitches, unidades da ReForge Industries e mudanças de atmosfera. Se um glitch for perdido, o jogador recebe uma única oportunidade especial de repetir a fase. Uma segunda falha quebra o caminho Flesh.

Fases concluídas não podem ser livremente selecionadas para replay durante a campanha. O jogador pode reiniciar apenas a fase atual, utilizar o retry especial da descida ou retornar aos setores quando a própria narrativa exige.

O multiplayer utiliza uma pista própria para dois jogadores. Os créditos são individuais, o cronômetro continua durante mortes e o vencedor é definido por tempo ajustado após bônus de coleta. O modo não altera save, finais ou progressão da campanha.

---

# 14. Core Gameplay Mechanics — Detailed

## 14.1 Corrida automática

Alex corre automaticamente da esquerda para a direita.

- A velocidade-base é fixa em todas as fases.
- O jogador não controla aceleração ou desaceleração.
- A dificuldade cresce pelo level design, não pelo aumento de velocidade.

O valor numérico final será definido por playtest.

## 14.2 Pulo

- disponível desde a Fase 1;
- resposta imediata;
- trajetória previsível;
- usado para buracos, obstáculos e inimigos;
- altura e duração finais serão ajustadas por playtest.

## 14.3 Slide

- duração fixa;
- reduz a hitbox;
- mantém a velocidade;
- não concede impulso;
- não pode ser cancelado por pulo;
- enquanto estiver em slide, Alex não pode atacar, usar scan ou dash.

A duração final será validada por playtest.

## 14.4 Créditos

Créditos aparecem principalmente em rotas de maior risco.

### Carteira por campanha

A carteira representa a pontuação total do save atual.

**Novo Jogo** reinicia a carteira.

### HUD

- `Créditos da fase: X/Y`
- `Total: Z`

### Consolidação

- checkpoint consolida os créditos obtidos antes dele;
- morte preserva créditos já consolidados;
- créditos coletados depois do último checkpoint são perdidos ao morrer;
- créditos não consolidados reaparecem quando o trecho reinicia;
- final da fase consolida o restante.

### Reinício manual

Ao usar **Reiniciar Fase**:

- a fase volta ao início;
- créditos consolidados permanecem;
- créditos não consolidados são descartados;
- créditos ainda disponíveis reaparecem;
- IDs já consolidados impedem duplicação.

### Anti-farming

Cada crédito possui identificador próprio.

Créditos já consolidados não aumentam novamente a carteira do mesmo save.

### Função no MVP

> **Pontuação acumulada da campanha.**

Se a loja cosmética opcional for implementada, passam a existir dois valores derivados da coleta:

- **Pontuação total de créditos:** nunca diminui e representa o desempenho da campanha.
- **Saldo de créditos:** pode ser gasto em skins básicas e extras exclusivamente cosméticos.

Nenhum gasto interfere em progressão, finais, habilidades ou dificuldade.

### Descida

Não existem créditos comuns durante a descida Flesh/Hollow.

O foco passa para:

- glitches/memórias;
- retirada dos implantes;
- consequência narrativa.

Isso mantém a pontuação comparável entre os caminhos do Portão.

## 14.5 Salto duplo — pernas mecânicas

Adquirido depois da Fase 1.

Permite um segundo salto antes de tocar o chão e uma correção limitada da trajetória.

## 14.6 Ataque — braços mecânicos

Adquirido depois da Fase 2.

Usos:

- destruir caixas;
- quebrar barricadas;
- derrotar inimigos simples;
- liberar passagens.

Não haverá combos, armas equipáveis, árvore de habilidades ou HP complexo.

### Bandido ciborgue

- 1 HP;
- derrotado com um golpe;
- contato causa morte.

### Drone policial blindado

- indestrutível;
- funciona como obstáculo móvel;
- contato causa morte.

### Ataque aéreo

Alex pode atacar no ar.

### Cadência inicial

Um novo ataque só pode ser iniciado depois de:

1. a animação do golpe terminar;
2. uma recuperação inicial de **0,3 segundo**.

Esse valor será validado por playtest.

## 14.7 Objetos quebráveis e colisão

Caixas e barricadas não causam morte instantânea.

Ao tocar um quebrável sem atacar:

- Alex para;
- entra em um breve estado de pressão contra o obstáculo;
- ainda pode atacar para destruí-lo;
- se não reagir dentro da janela permitida, morre.

A apresentação simula que Alex está sendo comprimido pelo avanço inevitável do percurso, sem exigir que a câmera pare de segui-lo.

**Janela inicial de reação:** 0,5 segundo.

Esse valor será validado por playtest.

## 14.8 Perigos fatais

A regra **1 hit = morte** se aplica a:

- bandidos ciborgues;
- drones policiais;
- água tóxica;
- espinhos;
- armadilhas;
- máquinas industriais;
- lasers;
- quedas;
- outros hazards explicitamente definidos como letais.

Objetos quebráveis seguem a regra específica da seção anterior.

## 14.9 Scan — olhos mecânicos

Adquirido depois da Fase 3.

O scan é um pulso instantâneo.

### Regras

- manual;
- utilizável no chão e no ar;
- não interrompe movimento;
- revela rotas;
- revela paredes falsas;
- revela armadilhas.

### Duração inicial

**0,75 segundo.**

### Anti-spam

Enquanto o pulso estiver ativo, outro scan não pode ser executado.

### Persistência da revelação

Os elementos revelados permanecem destacados até Alex sair daquele trecho.

Ao morrer e reiniciar o trecho, voltam ao estado oculto.

## 14.10 Dash — propulsores

Adquirido depois da Fase 4.

- chão e ar;
- utilizável durante queda;
- utilizável após salto;
- mantém a altura inicial no começo do impulso;
- não concede invencibilidade;
- cooldown de 2 segundos;
- som informa quando volta a estar disponível.

Distância e velocidade serão validadas por playtest.

## 14.11 Compatibilidade entre ações

| Estado | Pular | Slide | Atacar | Scan | Dash |
| --- | --- | --- | --- | --- | --- |
| Correndo | Sim | Sim | Sim | Sim | Sim |
| No ar | — | Não | Sim | Sim | Sim |
| Em slide | Não | — | Não | Não | Não |
| Em dash | Não | Não | Não | Não | — |
| Preso em quebrável | Não | Não | Sim | Não | Não |

## 14.12 Morte e checkpoints

- sem vidas;
- 1 hit fatal = morte;
- antes do checkpoint: início da fase;
- depois do checkpoint: retorno ao checkpoint;
- Fases 1–4: 1 checkpoint;
- Fase 5: 1 checkpoint inicialmente;
- restart rápido.

### Checkpoint diegético

O checkpoint é representado por um videogame e uma televisão de tubo.

Ao atravessá-lo:

1. Alex faz uma parada breve em área segura;
2. ocorre uma animação curta dele jogando;
3. há feedback visual e sonoro;
4. créditos anteriores são consolidados;
5. o checkpoint é salvo;
6. a corrida recomeça automaticamente.

A duração da parada será validada por playtest.

---

# 15. Narrativa e Personagens — Detailed

## 15.1 Prólogo

Apresentar:

- avós;
- tio paterno;
- ausência do pai;
- precariedade;
- histórias do avô;
- jornal;
- motivação.

Cutscene curta com imagens e poucas falas.

## 15.2 Pai de Alex

O pai:

- abandonou a família há mais de oito anos;
- tornou-se ciborgue de grande sucesso;
- inicia indiretamente a jornada;
- aparece em propaganda durante a subida;
- reconhece Alex no Final Chrome;
- não é reconhecido por Alex após a conversão completa.

### Final Chrome

O reencontro físico é exclusivo e central nesse final:

- o pai reconhece Alex;
- chama seu nome;
- Alex não o reconhece;
- Alex continua andando.

### Caminho Flesh

A imagem do pai também é utilizada por interfaces corporativas de reciclagem.

Durante a descida, Alex volta a ser confrontado com essa imagem na **Fase 2 — Industrial**, quando já abandonou quase toda a ascensão.

Esse encontro continua sendo apenas corporativo: um **holograma/interface pré-programada**, não a presença física do pai.

Mesmo tão próximo do fim da descida, Alex escolhe continuar rumo à família. O encontro físico com o pai permanece exclusivo do Final Chrome.

## 15.3 George Vektor — início

George é um cirurgião de implantes pouco experiente.

Alex confia nele porque:

1. é uma das poucas opções acessíveis;
2. oferece procedimentos experimentais baratos ou gratuitos;
3. clínicas de elite estão fora do alcance social de Alex;
4. a obsessão de Alex pela ascensão supera sua percepção de risco.

George vê Alex como oportunidade para:

- obter experiência;
- validar procedimentos;
- aumentar reputação.

## 15.4 Arco de George

### Pernas

- nervoso;
- explica riscos;
- ainda trata Alex principalmente como paciente.

### Braços

- mais confiante;
- satisfeito com o primeiro resultado.

### Olhos

- começa a falar em reputação e oportunidades.

### Propulsores

- demonstra orgulho excessivo;
- passa a tratar Alex como sua grande obra.

### Recusa no caminho Flesh

Depois que Alex rejeita Chrome e recupera o primeiro glitch:

1. procura uma clínica de George;
2. informa que quer remover os implantes;
3. George se recusa.

George não quer destruir aquilo que considera sua maior obra e teme perder o prestígio conquistado.

Depois disso, Alex procura outra solução.

Referências posteriores a George nos finais são opcionais e ficam fora do MVP.

## 15.5 ReForge Industries — corporação de reciclagem

**ReForge Industries** é uma das maiores corporações de Glitch City e é especializada em:

- remoção de implantes;
- recuperação de peças;
- reciclagem;
- revenda de tecnologia;
- produção rápida de substitutos biológicos.

O nome **ReForge Industries** é utilizado em placas, interfaces, hologramas e elementos de worldbuilding.

### Modelo econômico

A retirada pode ser oferecida sem cobrança porque a corporação lucra com o valor das peças mecânicas recuperadas.

As partes orgânicas bioprintadas são baratas e de qualidade inferior.

Isso reforça a lógica:

> **o cromo vale mais que a carne.**

## 15.6 Bioprinting

Quando um implante é removido, a clínica produz rapidamente uma substituição orgânica compatível com o DNA de Alex.

Características:

- funcional;
- barata;
- produzida rapidamente;
- inferior ao tecido original;
- sem capacidades aumentadas.

Pode apresentar:

- diferença de tonalidade;
- diferença de tamanho;
- cicatrizes;
- assimetrias.

Essas marcas permanecem até o Final Flesh.

### Função mecânica

- pernas biológicas → corrida e pulo simples, sem salto duplo;
- braços biológicos → sem força aumentada para quebráveis reforçados;
- olhos biológicos → visão normal, sem scan;
- retirada dos propulsores → remove dash e repara o tecido da região.

## 15.7 Hologramas

As unidades de reciclagem usam hologramas com rostos de ciborgues famosos.

- são interfaces pré-programadas;
- não possuem consciência;
- não representam comunicação real com a pessoa exibida.

Na descida, uma unidade da **Fase 2 — Industrial** utiliza o rosto do pai de Alex.

## 15.8 Mercador

O Mercador é o personagem/interface planejado para a loja cosmética opcional.

- não faz parte do núcleo do MVP;
- só será implementado se houver tempo após a estabilização da campanha;
- não exige HUB;
- a loja pode ser acessada pelo **Menu Principal**;
- vende apenas conteúdo visual;
- não oferece vidas, atributos, implantes ou qualquer vantagem de gameplay.

Se a loja não for implementada, o Mercador permanece apenas como conceito documentado de pós-MVP.

---

# 16. Level Design

## 16.1 Fase 1 — Esgoto / Periferia

**Objetivo:** corrida, pulo e slide.

Perigos:

- quedas;
- água tóxica;
- canos baixos;
- tubulações rompidas;
- fios energizados próximos à água.

Final: George instala as pernas.

## 16.2 Fase 2 — Industrial

**Objetivo:** salto duplo.

Elementos:

1. gap impossível com salto simples;
2. teste seguro;
3. gaps variados;
4. salto duplo + slide;
5. prensas;
6. esteiras;
7. jatos de vapor;
8. braços mecânicos industriais;
9. máquinas trituradoras;
10. checkpoint;
11. combinação final.

Final: George instala os braços.

### Durante a descida

Uma unidade da **ReForge Industries** utiliza um holograma com o rosto do pai de Alex. Mesmo diante do símbolo que originou sua obsessão, Alex continua descendo em direção à família.

## 16.3 Fase 3 — Meio Urbano

**Objetivo:** ataque.

Elementos:

1. quebráveis;
2. bandido ciborgue;
3. drone policial;
4. ataque + pulo;
5. drone + slide;
6. barricadas;
7. portões elétricos;
8. obstáculos urbanos;
9. checkpoint;
10. combinação.

Final: George instala os olhos.

## 16.4 Fase 4 — Corporativo

**Objetivo:** scan.

Elementos:

1. rota escondida;
2. parede falsa;
3. armadilha oculta;
4. scan + salto duplo;
5. lasers;
6. portas automatizadas;
7. pisos falsos;
8. checkpoint;
9. combinação;
10. propaganda do pai.

Final: George instala os propulsores.

## 16.5 Fase 5 — Topo

**Objetivo:** dash + domínio do kit.

Estrutura inicial:

- aproximadamente 120 segundos;
- ~90 s de desafio;
- ~30 s contemplativos;
- 1 checkpoint.

Possíveis obstáculos:

- grandes vãos de dash;
- grades de laser;
- barreiras rotativas;
- portas temporizadas;
- sequências de dash + salto + ataque + scan.

Não haverá chefe.

---

# 17. Duração e Validação das Fases

Hipótese para as Fases 1–4:

**90–120 segundos sem mortes.**

A Fase 5 começa com 1 checkpoint.

Esses valores permanecem provisórios até os playtests.

---

# 18. Finais e Caminho de Descida

## 18.1 Estrutura

### Chrome — final principal

Aceitar a conversão completa.

### Flesh — final principal

Recusar a conversão e completar toda a cadeia de redenção.

### Hollow — desfecho intermediário

Recusar Chrome, mas falhar na cadeia de redenção.

## 18.2 Sequência do Portão

**concluir Fase 5 → chegar ao Portão → escolher Chrome ou Flesh**

### Chrome

A conversão completa ocorre e segue para o Final Chrome.

### Flesh

1. Alex rejeita o Portão;
2. Fase 5 é carregada novamente no contexto de descida;
3. o primeiro glitch passa a existir;
4. Alex recupera o primeiro glitch;
5. procura George;
6. George se recusa;
7. Alex procura a ReForge Industries;
8. remove o primeiro implante;
9. segue para a Fase 4.

## 18.3 Natureza dos fragmentos

Os fragmentos são **glitches neurológicos provocados pela integração entre os implantes e o cérebro de Alex**.

Não são objetos físicos comuns.

- lugares ligados ao passado funcionam como gatilhos;
- os implantes entram em conflito com memórias humanas reprimidas;
- o jogador percebe isso como ruído e glitch;
- alcançar o núcleo do glitch recupera uma memória;
- cada memória permite acessar a próxima.

Se a cadeia é quebrada, os glitches seguintes deixam de se manifestar.

Os glitches ficam no final de pequenas rotas secretas.

## 18.4 Ordem da descida

| Ordem | Setor | Memória/glitch | Implante removido |
| --- | --- | --- | --- |
| D1 | Topo | memória de quem Alex era | propulsores |
| D2 | Corporativo | memória da rua/voz | olhos |
| D3 | Meio Urbano | memória dos amigos | braços |
| D4 | Industrial | memória da família | pernas |
| Epílogo | Esgoto | — | humano |

## 18.5 Mapas da descida

- mesmo mapa-base;
- mesma direção horizontal;
- mesma câmera.

Podem receber:

- rotas secretas;
- glitches;
- unidades da ReForge Industries;
- iluminação diferente;
- ambientação diferente;
- pequenos encurtamentos.

## 18.6 Cadeia de redenção

A retirada é obrigatoriamente sequencial.

### Primeira falha

Ao concluir um setor sem recuperar o glitch:

1. aparece a mensagem:

> **“Alex sente que esqueceu um dos motivos de estar descendo.”**

2. o jogador recebe uma única oportunidade especial de repetir a fase;
3. se aceitar, reinicia do começo com a cadeia ativa;
4. se recusar, a cadeia quebra;
5. se falhar novamente, a cadeia quebra.

### Depois da quebra

- glitches seguintes desaparecem;
- ruído/glitch de memória é desativado;
- novas retiradas não acontecem;
- estado corporal atual é preservado;
- o jogo segue para Hollow.

### Reinício manual

Enquanto a tentativa estiver ativa, **Reiniciar Fase** continua disponível.

O retry especial só é consumido quando a fase é concluída sem o glitch.

## 18.7 Hollow após a falha

Depois da quebra da cadeia, Alex não percorre integralmente os setores restantes.

O jogo avança por:

- transições;
- pequenas cutscenes;
- imagens dos setores inferiores.

Depois segue ao epílogo.

### Aparência

Hollow usa exatamente o estado corporal em que a cadeia foi quebrada:

- falhou no primeiro → todos os implantes;
- no segundo → sem propulsores;
- no terceiro → pernas + braços;
- no quarto → apenas pernas.

## 18.8 Retirada nas unidades de reciclagem

1. memória recuperada;
2. Alex encontra unidade da ReForge Industries;
3. holograma aparece;
4. implante é removido;
5. peça mecânica é recolhida;
6. parte orgânica é bioprintada/reconstruída;
7. Alex continua sem a habilidade correspondente.

## 18.9 Epílogo

### Flesh

Alex chega ao Esgoto completamente humano, mas com marcas do bioprinting.

Um trecho curto leva até a casa da família.

### Hollow

O mesmo epílogo-base é reaproveitado com a aparência e reação correspondentes aos implantes restantes.

## 18.10 Final Flesh

Alex retorna para sua verdadeira família.

Está novamente humano, mas carrega cicatrizes e diferenças físicas das substituições.

## 18.11 Final Hollow

Alex retorna parcialmente mecanizado e não consegue falar com a família.

A incapacidade é emocional e simbólica.

## 18.12 Repetição dos finais

Antes do Portão, existe um save narrativo automático.

Depois dos créditos:

- `Continuar do Portão`
- `Novo Jogo`
- `Multiplayer`
- `Menu Principal`

Continuar do Portão restaura integralmente o estado anterior à escolha.

---

# 19. Controles e Interface

## 19.1 Teclas

### Pulo
- `Espaço`
- `W`
- `↑`

### Slide
- `S`
- `↓`

### Ataque
- `J`
- clique esquerdo

### Scan
- `L`
- `E`

### Dash
- `K`
- `Shift`

### Pausa / voltar
- `Esc`

### Confirmar
- `Enter`

## 19.2 Pausa

### Campanha

A pausa congela:

- movimento;
- física;
- obstáculos;
- inimigos;
- animações relevantes;
- cooldown do dash.

### Multiplayer

Não existe pausa durante a corrida.

## 19.3 Reiniciar fase

Disponível no menu de pausa.

Volta ao início da fase atual.

## 19.4 Replay

Fases concluídas não podem ser repetidas livremente durante a campanha.

Exceções:

- reinício da fase atual;
- retry especial do glitch;
- retorno narrativo da descida.

---

# 20. Save e Menu

## 20.1 Save

Existe um único save de campanha.

`localStorage` armazena:

- fase atual;
- checkpoint;
- carteira;
- créditos consolidados;
- implantes;
- estado da descida;
- fragmentos;
- finais;
- save pré-Portão.

## 20.2 Novo Jogo

Se já existir save:

1. exibir confirmação;
2. apagar somente depois de confirmação.

## 20.3 Continue

Ao fechar o navegador:

- se checkpoint da fase já foi ativado → volta ao checkpoint;
- caso contrário → início da fase.

Checkpoint persiste entre sessões.

Créditos consolidados permanecem.

Créditos não consolidados são perdidos e reaparecem no mapa.

---

# 21. Multiplayer

## 21.1 Conceito

Corrida competitiva simultânea:

- 2 jogadores;
- pista própria;
- sem colisão;
- sem PvP;
- quatro implantes;
- duração-alvo ~120 s;
- 1 checkpoint central.

## 21.2 Créditos

- começam em zero;
- exclusivos da partida;
- não entram na campanha;
- cada jogador possui sua própria cópia lógica;
- coletar não remove o crédito do adversário.

## 21.3 Créditos e morte

Créditos coletados permanecem após morte.

Para aquele jogador, não reaparecem.

Para o adversário, continuam disponíveis caso ainda não tenham sido coletados.

## 21.4 Pontuação

**Tempo ajustado = tempo bruto − bônus de créditos**

Valores iniciais:

- 20 créditos;
- 0,5 s por crédito;
- máximo de 10 s.

O vencedor é calculado quando:

- ambos terminarem;
- ou expirar o limite do segundo jogador.

Terminar primeiro não garante a vitória.

## 21.5 Morte

### Antes do checkpoint
- volta ao início;
- cronômetro continua.

### Depois do checkpoint
- volta ao checkpoint;
- cronômetro continua.

## 21.6 Finalização

Quando o primeiro jogador termina:

- começa limite de 20 s para o segundo;
- se terminar, calcula-se o tempo ajustado dos dois;
- se não terminar, recebe DNF.

## 21.7 Desconexão

Desconexão durante a corrida concede vitória automática ao adversário.

## 21.8 Empate

1. mais créditos;
2. menor tempo bruto;
3. empate.

## 21.9 Scan

O scan é individual por jogador.

---

# 22. Technical Design

## 22.1 Stack

- TypeScript
- Parcel
- Phaser `^4.2.1`
- Tiled/JSON

## 22.2 Cenas

- `BootScene`
- `MenuScene`
- `GameScene`
- `ClinicScene`
- `EndingScene`
- `MultiplayerScene`

Não haverá `HubScene`.

## 22.3 Sistemas

- Player Controller
- Input
- Level Config
- Obstacles
- Enemies
- Breakable State
- Credits
- Checkpoints
- Upgrade State
- HUD
- Save State
- Camera
- Audio
- Fragment/Memory State
- Recycling State
- Multiplayer Sync

## 22.4 Câmera

- acompanha Alex;
- Alex entre 30% e 40% da tela;
- maior espaço à frente;
- pouco movimento vertical;
- limites do mapa.

---

# 23. Assets Needed

## 23.1 2D

### Personagem — Alex

Estados necessários:

1. humano original;
2. pernas mecânicas;
3. pernas + braços;
4. pernas + braços + olhos;
5. pernas + braços + olhos + propulsores;
6. robô completo;
7. humano bioprintado do Final Flesh.

O humano bioprintado pode reutilizar a base do humano original com diferenças de tonalidade, cicatrizes e assimetria.

### Cenários e tilesets

- Esgoto / Periferia.
- Industrial.
- Meio Urbano.
- Corporativo.
- Topo.

### Obstáculos e elementos jogáveis

- buracos;
- água tóxica;
- canos;
- fios energizados;
- caixas e barricadas quebráveis;
- prensas;
- esteiras;
- jatos de vapor;
- braços mecânicos industriais;
- trituradoras;
- lasers;
- drones;
- pisos falsos;
- portas automatizadas;
- barreiras de segurança;
- créditos;
- glitches/memórias;
- checkpoints com videogame + TV de tubo.

### Assets narrativos

- família;
- pai;
- George Vektor;
- Mercador, se a loja opcional for implementada;
- jornal;
- clínicas de George;
- unidades da ReForge Industries;
- hologramas corporativos;
- Portão;
- quatro memórias/glitches;
- propaganda do pai;
- interfaces da loja e da monetização simulada, se implementadas.

## 23.2 3D

**Não se aplica.**

Flesh to Chrome é um jogo 2D. Nenhum asset 3D é necessário para o escopo atual.

## 23.3 Sound

- ambiência por setor;
- passos/corrida;
- pulo;
- aterrissagem;
- slide;
- ataque;
- quebra de objetos;
- morte;
- checkpoint;
- dash;
- recarga do dash;
- scan;
- coleta de créditos;
- glitch/memória;
- interfaces;
- clínicas;
- máquinas da ReForge Industries;
- stingers/cues dos finais;
- trilha ou loops por fase.

## 23.4 Code

A implementação técnica está detalhada na Seção 22 — Technical Design.

Sistemas necessários:

- boot e gerenciamento de cenas;
- Player Controller;
- input;
- tilemaps/Level Config;
- obstáculos e hazards;
- inimigos simples;
- objetos quebráveis;
- créditos e anti-farming;
- checkpoints;
- upgrades;
- HUD;
- save/localStorage;
- câmera;
- áudio;
- glitches/memórias;
- ReForge/bioprinting;
- finais e save pré-Portão;
- multiplayer/sincronização;
- loja e persistência cosmética somente se houver tempo.

## 23.5 Animation

Animações principais:

- Run;
- Jump/Fall;
- Slide;
- Attack;
- Double Jump;
- Dash;
- Death;
- checkpoint/jogando videogame;
- transições de implantação;
- transições de retirada/bioprinting;
- quebra de objetos;
- coleta de créditos;
- efeitos dos glitches;
- loops simples de inimigos;
- animações mínimas de família/cutscenes.

Referência inicial:

- Run: 6–8 frames;
- Jump: 2–4;
- Slide: 2–4;
- Attack: 3–5;
- Death: 4–6.

Os valores são referência de produção e podem mudar de acordo com a arte disponível.

---

# 24. Schedule

## 24.1 Marco 1 — Protótipo técnico

**Objetivo:** provar o runner.

- Phaser funcionando no navegador;
- corrida automática;
- pulo;
- slide;
- obstáculos;
- colisão;
- câmera;
- morte/restart;
- placeholders.

**Critério de saída:** percurso curto jogável e repetível sem bug bloqueador.

## 24.2 Marco 2 — Vertical Slice

**Objetivo:** provar a relação entre transformação e gameplay.

- Fase 1;
- créditos;
- HUD;
- checkpoint;
- clínica de George;
- pernas mecânicas;
- salto duplo;
- início da Fase 2;
- save básico.

**Critério de saída:** Fase 1 → clínica → transformação → nova habilidade.

## 24.3 Marco 3 — Ascensão completa

- Fases 2, 3, 4 e 5;
- braços/ataque;
- olhos/scan;
- propulsores/dash;
- inimigos;
- obstáculos específicos;
- ReForge Industries preparada como elemento de worldbuilding;
- Portão;
- save da campanha.

**Critério de saída:** campanha jogável do início ao Portão.

## 24.4 Marco 4 — Narrativa, descida e finais

- prólogo;
- arco de George;
- pai/propagandas;
- escolha Chrome/Flesh;
- glitches;
- retry especial;
- ReForge Industries;
- bioprinting;
- Hollow;
- Flesh;
- epílogo;
- save pré-Portão.

**Critério de saída:** Chrome, Flesh e Hollow alcançáveis conforme as regras do GDD.

## 24.5 Marco 5 — Multiplayer

- pista própria;
- dois jogadores;
- sincronização;
- quatro implantes;
- checkpoint central;
- créditos individuais;
- tempo ajustado;
- DNF;
- desconexão;
- resultado final.

**Critério de saída:** corrida completa e resultado reproduzível.

## 24.6 Marco 6 — Polimento e entrega

- playtests;
- balanceamento;
- correções;
- pass de arte;
- áudio;
- estabilidade;
- alinhamento entre build e GDD;
- build web final.

### Conteúdo somente se sobrar tempo

Depois que todos os itens anteriores estiverem estáveis:

- skins;
- Mercador;
- loja cosmética;
- persistência de cosméticos;
- vitrine de preço representativo;
- pagamento simulado;
- parallax e áudio não essenciais.

## 24.7 Feature Freeze

O feature freeze deve ocorrer aproximadamente **2–3 semanas antes da entrega final**.

Depois dele:

- nenhuma funcionalidade nova;
- finalizar sistemas iniciados;
- corrigir bugs;
- testar;
- balancear;
- estabilizar a build.

---

# 25. Monetization Model

## 25.1 Modelo de receita

**Flesh to Chrome é um trabalho acadêmico e será jogável gratuitamente no navegador.**

A versão de entrega não precisa processar pagamentos reais.

Se houver tempo após a conclusão e estabilização do núcleo do jogo, poderá ser implementada uma vitrine de monetização para demonstrar um modelo comercial possível.

Princípios:

- apenas **skins e extras cosméticos**;
- nenhum conteúdo pago aumenta poder;
- nenhum item comprado facilita fases;
- não existe pay-to-win;
- não existem vidas compráveis;
- os implantes narrativos nunca são vendidos;
- o sistema de pagamento em reais é apenas **representativo/simulado**.

## 25.2 Loja do Mercador

A loja é apresentada pelo **Mercador**.

Como o jogo não possui HUB, a loja será acessível por uma opção no **Menu Principal**.

A implementação da loja é **opcional e só deve ocorrer se sobrar tempo**.

### Créditos in-game

Créditos podem desbloquear skins básicas.

Para preservar a função de pontuação:

- **Pontuação total** = todos os créditos obtidos durante a campanha; nunca diminui.
- **Saldo de créditos** = valor disponível para compras cosméticas; diminui quando algo é desbloqueado.

| Item | Preço (créditos) | Efeito |
| --- | ---: | --- |
| Skin “Sucata” | 80 | Apenas visual |
| Skin “Tinta de rua” | 150 | Apenas visual |
| Skin “Cabo desencapado” | 200 | Apenas visual |

**Vidas extras foram removidas do modelo antigo**, pois Flesh to Chrome não possui sistema de vidas.

## 25.3 Vitrine com valor representativo

Algumas skins podem aparecer com preço simbólico em reais para demonstrar um modelo comercial.

O botão **Comprar** abre um modal informando:

> **Pagamento simulado — compra registrada.**

Não existe gateway de pagamento real.

| Item | Preço representativo | Efeito |
| --- | ---: | --- |
| Skin “Neon Elite” | R$ 4,90 | Apenas visual |
| Skin “Chrome Mirror” | R$ 9,90 | Apenas visual |
| Skin “Vektor Special” | R$ 14,90 | Apenas visual |

### Regras

- créditos in-game não compram as skins da vitrine representativa;
- valor representativo em reais não compra créditos;
- valor representativo não compra vidas;
- valor representativo não compra habilidades;
- valor representativo não compra checkpoints ou vantagens;
- todas as compras simuladas são exclusivamente cosméticas.

## 25.4 Persistência dos cosméticos

Caso a loja seja implementada:

- skins desbloqueadas ficam registradas separadamente do save da campanha;
- iniciar **Novo Jogo** reinicia a campanha e o saldo corrente, mas não apaga skins já desbloqueadas;
- o jogador pode selecionar uma skin antes de iniciar ou continuar a campanha;
- skins não alteram hitbox, animações funcionais ou leitura de gameplay.

## 25.5 Prioridade de implementação

A monetização simulada fica abaixo de:

1. campanha completa;
2. finais Chrome/Flesh/Hollow;
3. estabilidade;
4. save;
5. multiplayer;
6. balanceamento;
7. correção de bugs.

Se não houver tempo, esta seção permanece apenas como **modelo documentado de receita**, sem implementação no build final.

---

# 26. Validações Pendentes de Playtest

## 26.1 Movimento e combate

- [ ] Pulo: altura, duração e sensação.
- [ ] Salto duplo: correção de trajetória.
- [ ] Slide: duração e hitbox.
- [ ] Ataque: alcance, animação e recuperação de 0,3 s.
- [ ] Quebráveis: janela de reação de 0,5 s.
- [ ] Dash: distância, velocidade e cooldown de 2 s.

## 26.2 Campanha

- [ ] Duração das Fases 1–4: 90–120 s.
- [ ] Checkpoint da Fase 5: validar 1 checkpoint.
- [ ] Checkpoint diegético: duração da parada.
- [ ] Scan: pulso de 0,75 s.
- [ ] Sinalização dos glitches: ruído + efeito visual.
- [ ] Densidade de créditos.

## 26.3 Descida

- [ ] Reutilização dos mapas.
- [ ] Retry do glitch: validar se uma única segunda tentativa parece justa.
- [ ] Epílogo no Esgoto.
- [ ] Clareza visual da perda das habilidades após bioprinting.

## 26.4 Multiplayer

- [ ] Duração: ~120 s.
- [ ] 20 créditos.
- [ ] 0,5 s por crédito.
- [ ] bônus máximo de 10 s.
- [ ] checkpoint central.
- [ ] limite de 20 s para o segundo jogador terminar.

---

# 27. Critério de Estabilidade

O GDD está **conceitualmente fechado**.

As decisões narrativas e mecânicas principais estão definidas. A partir desta revisão, mudanças devem ocorrer apenas por:

- resultados de playtest;
- limitações técnicas comprovadas;
- balanceamento;
- cortes de escopo necessários;
- correções de inconsistência entre documentação e build.

A loja cosmética e a monetização simulada são conteúdo opcional e não impedem o congelamento conceitual do GDD.

Novas funcionalidades devem ser movidas para pós-MVP, salvo quando resolverem um problema real identificado durante desenvolvimento.
# Game Design Document — Flesh to Chrome

**Revision:** 0.11.0 — versão consolidada para repositório, com decisões narrativas e mecânicas fechadas e pendências restritas a playtests  
**Base:** template de Benjamin “HeadClot” Stanley  
**Fonte complementar:** `Cyberpunk.md`  
**Última revisão:** agosto de 2026

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

## 5.3 Fora do MVP

- Skins cosméticas.
- Loja de skins.
- Vitrine de monetização fictícia.

A carteira de créditos permanece no MVP como **pontuação da campanha**, com possibilidade de ganhar função comercial em uma versão futura.

---

# 6. Plataforma

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

## 7.1 Contexto

- **Equipe:** 3 pessoas
- **Engine:** Phaser
- **Versão declarada no repositório:** Phaser `^4.2.1`
- **Linguagem:** TypeScript
- **Bundler:** Parcel
- **Level design:** Tiled/JSON
- **Prazo:** novembro de 2026
- **Experiência prévia com jogos/Phaser:** inicial

## 7.2 Nível 1 — Protótipo técnico

- Corrida.
- Pulo.
- Slide.
- Obstáculos.
- Colisão.
- Câmera.
- Morte/restart.
- Placeholders.

## 7.3 Nível 2 — Vertical Slice

- Fase 1.
- Clínica.
- Pernas.
- Salto duplo.
- Trecho inicial da Fase 2.
- Transformação visual.

**concluir fase → sacrificar corpo → ganhar poder → gameplay muda**

## 7.4 Nível 3 — Ascensão completa

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

## 7.5 Nível 4 — MVP narrativo completo

Meta principal da equipe:

- escolha no Portão;
- Final Chrome;
- descida;
- quatro fragmentos;
- retirada sequencial dos implantes;
- Final Flesh;
- Hollow como resultado de falha da descida;
- epílogo no Esgoto.

## 7.6 Conteúdo posterior ao núcleo narrativo

- Multiplayer.
- Parallax avançado.
- Áudio adicional.
- Cosméticos.

## 7.7 Fallback de escopo

Se a descida completa se mostrar inviável próximo à entrega:

- manter Final Chrome completo;
- manter a opção de recusar o Portão;
- substituir temporariamente a descida completa por um Hollow em cutscene.

Essa é uma medida de emergência, não a meta principal.

---

# 8. Equipe

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

# 9. Influências

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

# 10. Elevator Pitch

**Flesh to Chrome é um auto-runner cyberpunk em que um homem escala uma cidade dividida por classes, substituindo partes do próprio corpo por máquinas para alcançar o topo — e descobrindo que cada nova habilidade também o afasta daquilo que tentava salvar.**

---

# 11. Project Description

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

---

# 12. Diferenciais

- **Upgrade = transformação narrativa.**
- **Progressão social visível.**
- **Poder com consequência.**
- **Descida como perda jogável das habilidades.**
- **Runner como linguagem principal.**
- **Pai como espelho narrativo do destino de Alex.**
- **George como espelho secundário:** ele também se torna mais ganancioso à medida que a jornada de Alex aumenta sua reputação.

---

# 13. Mecânicas Detalhadas

## 13.1 Corrida

Alex corre automaticamente da esquerda para a direita.

## 13.2 Pulo

- disponível desde a Fase 1;
- resposta imediata;
- trajetória previsível;
- ajustado por playtest.

## 13.3 Slide

- duração fixa;
- reduz a hitbox;
- mantém velocidade;
- não concede impulso;
- não pode ser cancelado por pulo.

## 13.4 Créditos

Créditos aparecem principalmente em rotas de maior risco.

### Carteira por campanha

A carteira representa a **pontuação total do save atual**.

**Novo Jogo** reinicia a carteira.

### HUD

O HUD mostra:

- `Créditos da fase: X/Y`
- `Total: Z`

### Consolidação

- checkpoint consolida os créditos obtidos antes dele;
- morte preserva os créditos já consolidados;
- créditos coletados depois do checkpoint são perdidos se Alex morrer;
- créditos ainda não consolidados reaparecem quando o trecho reinicia;
- final da fase consolida o restante.

### Anti-farming

Cada crédito possui identificador próprio.

Créditos já consolidados não aumentam novamente a carteira do mesmo save.

### Função

No MVP:

> **pontuação acumulada da campanha.**

No futuro, uma loja cosmética pode utilizar os créditos, desde que não altere a progressão obrigatória.

### Descida

Não existem créditos comuns durante a descida Flesh/Hollow.

Durante essa parte da campanha, o foco passa exclusivamente para:

- fragmentos;
- memórias;
- retirada dos implantes;
- consequência narrativa.

Isso mantém a pontuação da campanha comparável entre os caminhos do Portão.

## 13.5 Salto duplo

Adquirido depois da Fase 1.

Permite correção limitada de trajetória.

## 13.6 Braços / ataque

Adquirido depois da Fase 2.

Usos:

- caixas;
- barricadas;
- inimigos simples;
- passagens.

### Bandido ciborgue

- 1 HP;
- derrotado com um golpe.

### Drone policial blindado

- indestrutível;
- evitado com pulo ou slide.

Alex pode atacar no ar.

## 13.7 Scan

Adquirido depois da Fase 3.

O scan é um **pulso instantâneo**.

### Regras

- manual;
- utilizável no chão ou no ar;
- não interrompe movimento;
- revela rotas;
- revela paredes falsas;
- revela armadilhas;
- sem cooldown visual independente.

### Duração inicial

**0,75 segundo.**

O valor pode ser ajustado entre 0,5 e 1 segundo conforme playtest.

### Anti-spam

Enquanto o efeito visual do pulso estiver ativo, um novo scan não pode ser disparado.

Esse bloqueio funciona naturalmente pela duração da animação e não exige indicador de cooldown.

## 13.8 Dash

Adquirido depois da Fase 4.

- utilizável no chão e no ar;
- utilizável durante queda;
- utilizável após salto;
- mantém a altura inicial;
- não concede invencibilidade;
- cooldown de 2 segundos;
- som informa quando volta a estar disponível.

## 13.9 Compatibilidade

| Estado | Pular | Slide | Atacar | Scan | Dash |
| --- | --- | --- | --- | --- | --- |
| Correndo | Sim | Sim | Sim | Sim | Sim |
| No ar | — | Não | Sim | Sim | Sim |
| Em slide | Não | — | Não | Não | Não |
| Em dash | Não | Não | Não | Não | — |

## 13.10 Morte e checkpoints

- sem vidas;
- 1 hit = morte;
- antes do checkpoint: início da fase;
- depois: checkpoint;
- Fases 1–4: 1 checkpoint;
- Fase 5: 1 checkpoint inicialmente;
- restart rápido.

---

# 14. Narrativa e personagens

## 14.1 Prólogo

Apresentar:

- avós;
- tio paterno;
- ausência do pai;
- precariedade;
- histórias do avô;
- jornal;
- motivação.

A apresentação pode ser feita por cutscene curta com imagens e poucas falas.

## 14.2 Pai de Alex

O pai:

- abandonou a família;
- tornou-se ciborgue de sucesso;
- inicia indiretamente a jornada;
- aparece em propaganda na Fase 4;
- serve de rosto corporativo no topo;
- reconhece Alex no Final Chrome;
- não é reconhecido por Alex.

### Uso da imagem do pai

Na Fase 4, seu rosto aparece como propaganda e símbolo de sucesso.

No setor superior, a empresa de reciclagem utiliza hologramas com rostos de ciborgues famosos. Na última instalação, o holograma utiliza o rosto do pai de Alex.

O holograma é uma **interface corporativa pré-programada**, sem consciência e sem presença real do pai.

Esse encontro indireto encerra o arco da obsessão no caminho Flesh:

> Alex finalmente chega ao símbolo que perseguiu, mas decide não continuar vivendo para alcançá-lo.

## 14.3 George Vektor — início

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

## 14.4 Arco de George Vektor

George também sofre uma transformação narrativa durante a subida.

No início:

- inseguro;
- técnico;
- interessado nos resultados;
- ainda trata Alex principalmente como paciente.

Conforme Alex avança:

- George ganha confiança;
- passa a enxergar o caso como prova de seu talento;
- aumenta sua ambição;
- começa a falar mais sobre reputação;
- torna-se progressivamente possessivo em relação ao “resultado” que criou.

### Progressão

**Pernas:** George demonstra nervosismo e explica riscos.  
**Braços:** fica satisfeito com o sucesso do primeiro procedimento.  
**Olhos:** começa a falar sobre como o caso pode abrir portas para sua carreira.  
**Propulsores:** demonstra orgulho excessivo e passa a tratar Alex como sua grande obra.

### Recusa no topo

Quando Alex decide abandonar os implantes, George se recusa a ajudá-lo.

Sua motivação combina dois fatores:

1. **não quer destruir aquilo que considera sua maior obra;**
2. **teme que a retirada prejudique o prestígio e a reputação conquistados com o caso de Alex.**

O paralelo temático é:

> **Alex percebe o custo da ascensão; George ainda escolhe continuar subindo.**

## 14.5 Rede corporativa de reciclagem

A retirada dos implantes não depende de George.

Glitch City possui uma grande rede corporativa de **reciclagem e descarte de implantes**.

As instalações existem em diferentes setores para:

- remover implantes descartados;
- recuperar peças;
- reciclar componentes;
- encaminhar material para reaproveitamento.

A empresa é uma das grandes corporações do topo de Glitch City.

O nome da empresa será definido durante a produção da identidade visual das áreas corporativas.

### Hologramas

Cada unidade utiliza um holograma com a aparência de um ciborgue famoso da cidade.

Nos setores inferiores, são utilizados rostos diversos.

Na unidade do setor superior, a interface utiliza o rosto do pai de Alex.

Os hologramas são interfaces pré-programadas e não possuem consciência ou comunicação real com as pessoas representadas.

## 14.6 Mercador

Conceito futuro ligado à loja cosmética.

Não precisa aparecer no MVP.

---

# 15. Level Design

## 15.1 Fase 1 — Esgoto / Periferia

**Objetivo:** corrida, pulo e slide.

Perigos:

- quedas;
- água tóxica;
- canos.

Final:

- George instala pernas.

## 15.2 Fase 2 — Industrial

**Objetivo:** salto duplo.

1. gap impossível;
2. teste seguro;
3. gaps variados;
4. salto duplo + slide;
5. maquinário;
6. checkpoint;
7. combinação;
8. George instala braços.

## 15.3 Fase 3 — Meio Urbano

**Objetivo:** ataque.

1. objeto quebrável;
2. bandido;
3. drone;
4. ataque + pulo;
5. drone + slide;
6. checkpoint;
7. combinação;
8. George instala olhos.

## 15.4 Fase 4 — Corporativo

**Objetivo:** scan.

1. rota escondida;
2. parede falsa;
3. armadilha;
4. scan + salto duplo;
5. checkpoint;
6. combinação;
7. propaganda do pai;
8. George instala propulsores.

## 15.5 Fase 5 — Topo

**Objetivo:** dash + domínio do kit.

- aproximadamente 120 segundos;
- ~90 s de desafio;
- ~30 s contemplativos.

Não haverá chefe.

---

# 16. Duração e validação das fases

Hipótese inicial para as Fases 1–4:

**90–120 segundos sem mortes.**

A Fase 5 começa com **1 checkpoint**.

Esses valores serão mantidos inicialmente e ajustados somente com base em playtests.

---

# 17. Finais

## 17.1 Estrutura

### Final Chrome — final principal

Aceitar a conversão completa.

### Final Flesh — final principal

Recusar a conversão e completar toda a cadeia de redenção.

### Hollow — desfecho intermediário

Recusar Chrome, mas falhar em completar a cadeia de redenção.

## 17.2 Final Chrome

Alex aceita o Portão.

Depois da conversão completa:

- encontra o pai real;
- o pai reconhece Alex;
- chama seu nome;
- Alex não o reconhece;
- Alex continua andando.

## 17.3 Decisão antes da descida

No caminho de recusa, Alex não precisa encontrar fisicamente o pai.

Na última instalação corporativa de reciclagem, ele vê o holograma com o rosto do pai.

Esse momento simboliza que ele finalmente alcançou aquilo que perseguia.

Em vez de continuar, Alex escolhe iniciar a descida.

## 17.4 Ordem da descida

| Ordem | Setor | Fragmento | Implante removido |
| --- | --- | --- | --- |
| D1 | Topo | memória de quem Alex era | propulsores |
| D2 | Corporativo | memória da rua/voz | olhos |
| D3 | Meio Urbano | memória dos amigos | braços |
| D4 | Industrial | memória da família | pernas |
| Epílogo | Esgoto | — | humano |

## 17.5 Mapas

A descida usa:

- mesmo mapa-base;
- mesma direção horizontal;
- mesma câmera.

As fases podem receber pequenas alterações:

- fragmentos;
- instalações de reciclagem;
- iluminação;
- ambientação;
- encurtamentos.

## 17.6 Cadeia de redenção

A retirada dos implantes é **obrigatoriamente sequencial**.

Para continuar retirando peças, Alex precisa ter encontrado todos os fragmentos anteriores.

### Se um fragmento for perdido

- a cadeia Flesh é interrompida;
- novas retiradas deixam de ocorrer;
- Alex continua descendo;
- termina em Hollow;
- fragmentos seguintes deixam de aparecer;
- ruído e glitch relacionados aos fragmentos são desativados;
- nenhuma combinação não sequencial de sprites é criada.

### Aviso ao jogador

Ao terminar o setor sem encontrar o fragmento, aparece uma mensagem como:

> **“Alex sente que esqueceu um dos motivos de estar descendo.”**

A mensagem comunica a consequência sem revelar explicitamente que o caminho Flesh foi perdido.

## 17.7 Fragmentos

Enquanto a cadeia estiver ativa:

- ruído cresce com proximidade;
- glitch visual cresce com proximidade;
- o fragmento mostra uma imagem;
- o fragmento mostra uma frase curta.

## 17.8 Retirada pela rede de reciclagem

Depois de encontrar um fragmento válido:

1. a memória é apresentada;
2. Alex encontra uma unidade automatizada de reciclagem;
3. o holograma corporativo é exibido;
4. o sistema realiza a retirada;
5. o componente é descartado/reciclado;
6. Alex continua descendo.

George não participa da remoção depois de se recusar a ajudar.

## 17.9 Epílogo no Esgoto

Depois de retirar as pernas na Fase 2, Alex retorna humano.

O Esgoto funciona como **epílogo jogável curto**, terminando na casa da família.

## 17.10 Final Flesh

Condição:

- recusar o Portão;
- manter a cadeia ativa;
- encontrar os quatro fragmentos;
- retirar os quatro implantes.

Alex retorna humano e se reconcilia com a família.

## 17.11 Hollow

Condição:

- recusar o Portão;
- perder pelo menos um fragmento;
- quebrar a cadeia de redenção.

A cena reutiliza a estrutura visual do retorno Flesh com alterações de:

- estado corporal;
- expressão;
- texto;
- reação à família.

Alex não consegue falar com a família.

## 17.12 Repetição de finais

Antes do Portão, o jogo cria um save automático.

Depois de um final:

**Continuar do Portão**

restaura integralmente:

- carteira;
- implantes;
- fragmentos;
- estado narrativo.

Nada obtido durante a tentativa de descida anterior permanece.

---

# 18. Multiplayer

Modo separado da campanha.

## 18.1 Conceito

**Corrida competitiva simultânea**

- 2 jogadores;
- pista própria;
- sem colisão;
- sem PvP;
- quatro implantes;
- aproximadamente 120 segundos;
- 1 checkpoint central.

## 18.2 Créditos

- começam em zero;
- não entram na campanha;
- aparecem em rotas de risco.

## 18.3 Pontuação

**Tempo ajustado = tempo bruto − bônus de créditos**

Valores iniciais de teste:

- 20 créditos;
- 0,5 s de bônus por crédito;
- bônus máximo de 10 s.

## 18.4 Morte

- volta ao checkpoint;
- cronômetro continua.

## 18.5 Empate

1. mais créditos;
2. menor tempo bruto;
3. empate.

---

# 19. Technical Design

## 19.1 Stack

- TypeScript
- Parcel
- Phaser `^4.2.1`
- Tiled/JSON

## 19.2 Persistência

`localStorage`:

- fase;
- carteira;
- créditos consolidados;
- implantes;
- fragmentos;
- finais;
- save pré-Portão.

## 19.3 Cenas

- `BootScene`
- `MenuScene`
- `GameScene`
- `ClinicScene`
- `EndingScene`
- `MultiplayerScene`

Não haverá `HubScene`.

## 19.4 Sistemas

- Player Controller
- Input
- Level Config
- Obstacles
- Enemies
- Credits
- Checkpoints
- Upgrade State
- HUD
- Save State
- Camera
- Audio
- Multiplayer Sync

## 19.5 Câmera

- acompanha Alex;
- Alex entre 30% e 40% da tela;
- mais espaço à frente;
- pouco movimento vertical;
- limites do mapa.

---

# 20. Assets Needed

## 20.1 Estados de Alex

1. humano;
2. pernas;
3. pernas + braços;
4. pernas + braços + olhos;
5. pernas + braços + olhos + propulsores;
6. robô completo.

A cadeia sequencial impede a necessidade de estados extras.

## 20.2 Animações

- Run
- Jump/Fall
- Slide
- Attack
- Double Jump
- Dash
- Death

Referência:

- Run: 6–8 frames
- Jump: 2–4
- Slide: 2–4
- Attack: 3–5
- Death: 4–6

## 20.3 Cenários

- Esgoto
- Industrial
- Meio Urbano
- Corporativo
- Topo

## 20.4 Assets narrativos

- família;
- pai;
- George;
- jornal;
- clínicas de George;
- unidades de reciclagem;
- hologramas corporativos;
- Portão;
- quatro memórias;
- robô final;
- propaganda do pai.

## 20.5 Áudio

- pulo;
- aterrissagem;
- slide;
- morte;
- checkpoint;
- ataque;
- dash;
- recarga;
- scan;
- coleta;
- interface;
- glitch dos fragmentos;
- ambiente/trilha.

---

# 21. Schedule

## Marco 1 — Protótipo

Runner básico.

## Marco 2 — Vertical Slice

Fase 1 → George → pernas → início da Fase 2.

## Marco 3 — Ascensão

Fases 2–5, implantes, créditos, save e áudio mínimo.

## Marco 4 — Portão e finais

Chrome, recusa, descida, fragmentos, reciclagem, Flesh, Hollow e epílogo.

## Marco 5 — Multiplayer

Pista, kit, sincronização, créditos e resultado.

## Marco 6 — Polimento

Parallax, áudio adicional, balanceamento, correções e assets finais.

---

# 22. Feature Freeze

A partir do feature freeze:

- nenhuma nova funcionalidade;
- corrigir bugs;
- concluir sistemas;
- testar;
- balancear;
- estabilizar.

**Referência:** 2–3 semanas antes da entrega.

---

# 23. Validações Pendentes de Playtest

Esta seção contém apenas parâmetros que devem ser confirmados por testes de gameplay.

## Campanha

- [ ] **Duração das Fases 1–4:** validar se 90–120 segundos sem mortes produz um ritmo adequado.
- [ ] **Checkpoint da Fase 5:** validar se 1 checkpoint é suficiente para aproximadamente 120 segundos de fase.
- [ ] **Scan:** validar se o pulso visual de 0,75 s é confortável, legível e não deixa o uso excessivamente lento.

## Multiplayer

- [ ] **Quantidade de créditos:** validar se 20 créditos é adequado para uma pista de aproximadamente 120 segundos.
- [ ] **Peso individual:** validar se 0,5 s de bônus por crédito gera uma escolha relevante entre velocidade e coleta.
- [ ] **Bônus máximo:** validar se o limite de 10 s mantém o tempo bruto como fator principal da vitória.

---

# 24. Critério de estabilidade do GDD

A parte conceitual do GDD está fechada para orientar a implementação.

As únicas alterações esperadas nesta etapa devem resultar de:

1. playtests;
2. limitações técnicas comprovadas durante implementação;
3. ajustes de balanceamento;
4. necessidade de corte de escopo próxima à entrega.

Novas funcionalidades que não resolvam um problema identificado devem ser movidas para pós-MVP.

O GDD e o build devem sempre descrever o mesmo jogo.
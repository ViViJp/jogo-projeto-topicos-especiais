# Flesh to Chrome — Contrato Tiled ↔ Phaser

**Versão:** 0.14
**Data:** 2026-10-21
**Status:** contrato vivo — atualizar sempre que uma nova classe, propriedade, camada ou valor de comportamento for criado no Tiled.

## 1. Objetivo

Este documento define o contrato entre os mapas criados no **Tiled** e a integração feita no **Phaser**. O objetivo é evitar divergências de nomes, capitalização, propriedades e interpretação das camadas.

A regra principal é: **o Tiled descreve o mapa; o Phaser interpreta exatamente os nomes e propriedades definidos aqui.**

## 2. Fonte oficial do mapa

- Arquivo editável no Tiled: **fase-N.tmj**
- Arquivo consumido pelo jogo: **fase-N.json** exportado pelo Tiled
- Os arquivos gerados automaticamente por scripts antigos não devem sobrescrever o mapa manual.

Para a Fase 1:

- Grid: **16 × 16 px**
- Setor: **Esgoto**
- Orientação: **Orthogonal**
- Arquivo autoral: **src/assets/maps/esgoto/fase-1.tmj**
- Arquivo exportado: **src/assets/maps/esgoto/fase-1.json**

Para a Fase 2:

- Grid: **32 × 32 px**
- Setor: **Industrial**
- Orientação: **Orthogonal**
- Arquivo autoral: **src/assets/maps/industrial/fase-2.tmj**
- Arquivo exportado: **src/assets/maps/industrial/fase-2.json**
- Status: **blockout integrado ao Phaser; ciclos e animações individuais dos hazards ainda pendentes**

Para a Fase 3:

- Grid: **16 × 16 px**
- Setor: **Meio Urbano**
- Orientação: **Orthogonal**
- Arquivo autoral: **src/assets/maps/meio-urbano/fase-3.tmj**
- Arquivo exportado: **src/assets/maps/meio-urbano/fase-3.json**
- Tileset: **warped-city-environment**
- Status: **blockout autoral integrado ao Phaser e disponível no seletor temporário de fases**

> **Exportação da Fase 3:** o arquivo `.tmj` pode permanecer comprimido para
> edição no Tiled, mas o `.json` consumido pelo jogo deve usar dados de layer
> em array, sem `encoding: base64` e sem `compression: zlib`. O parser Tiled do
> Phaser 4 ignora layers comprimidas e carregaria a fase sem chão.

## 3. Camadas oficiais

A ordem recomendada no painel do Tiled, de cima para baixo, é:

1. **objects** — objetos lógicos e pontos de gameplay
2. **deco-low-ceilings** — visual deslocado dos canos baixos da Fase 2
3. **deco** — decoração em primeiro plano
4. **hazards** — representação visual de perigos
5. **ground** — geometria sólida e plataformas
6. **deco-back** — decoração atrás do jogador
7. **background** — fundo visual sem colisão

### Regras

- **ground**: tudo que deve ter colisão física sólida com Alex.
- **hazards**: apenas o visual do perigo; a lógica letal fica em **objects**.
- **deco** e **deco-back**: sem colisão por padrão.
- **deco-low-ceilings**: Tile Layer exclusiva da Fase 2, sem colisão, com deslocamento vertical de **12 px**.
- **background**: sem colisão.
- **objects**: nunca deve ser renderizada como parte visual do cenário final.
- Um elemento letal não deve depender apenas de um tile visual: ele deve possuir um objeto lógico correspondente.

## 4. Convenções gerais de objetos

### Capitalização

Classes, propriedades enumeradas e valores de enumeração devem ser escritos sempre em minúsculas.

Correto:

~~~text
credit
hazard
spawn
phase_end
broken_pipe
risk
normal
~~~

Evitar:

~~~text
Credit
Hazard
Spawn
BrokenPipe
Risk
Safe
~~~

A integração trata esses valores como case-sensitive.

### IDs e nomes

- IDs lógicos devem ser únicos dentro da fase.
- Padrão de ID recomendado: **f<fase>-<tipo>-<nn>**.
- Exemplos: **f1-risk-01**, **f1-safe-01**, **f1-cp1**.
- Objetos de hazard devem usar nomes sequenciais, como **toxic_water_01**, **electric_wire_01** e **broken_pipe_01**.

### Coordenadas

- Retângulos ligados à geometria do mapa devem, sempre que possível, ficar alinhados ao grid.
- Na Fase 1, dimensões de retângulos preferencialmente devem ser múltiplos de **16 px**.
- Na Fase 2, dimensões de retângulos preferencialmente devem ser múltiplos de **32 px**.
- A hitbox de um hazard deve cobrir o trecho visual realmente letal, sem invadir área segura.
- Um ajuste interno menor que o tile é permitido quando necessário para acompanhar a silhueta da arte, mas precisa ser validado no Phaser.
- Objetos do tipo Point (**spawn**, **credit**) podem ficar centralizados sobre tiles e não precisam obrigatoriamente ter X/Y múltiplos de 16.

## 5. Classes implementadas

### 5.1 **spawn**

**Função:** define onde Alex nasce ao iniciar a fase.

**Geometria Tiled:** Point Object.

~~~text
Nome: spawn
Classe: spawn
~~~

**Propriedades personalizadas:** nenhuma.

**Comportamento esperado no Phaser:** localizar o objeto **spawn** e posicionar Alex em **x/y**.

### 5.2 **phase_end**

**Função:** região que encerra a fase quando Alex a atravessa.

**Geometria Tiled:** Rectangle Object.

~~~text
Nome: phase_end
Classe: phase_end
~~~

| Propriedade | Tipo | Exemplo | Obrigatória |
|---|---|---|---|
| **fase** | int | **1** | sim |

**Comportamento esperado no Phaser:** criar uma zona/trigger e encerrar ou transicionar a fase quando o jogador entrar nela.

### 5.3 **hazard**

**Função:** região de perigo. O visual deve estar na layer **hazards**; o Rectangle Object define a lógica.

**Geometria Tiled:** Rectangle Object.

~~~text
Nome: toxic_water_01
Classe: hazard

kind = toxic_water
~~~

| Propriedade | Tipo | Valores atuais | Obrigatória |
|---|---|---|---|
| **kind** | string | **toxic_water**, **electric_wire**, **broken_pipe** | sim |

#### Comportamento por **kind**

| kind | Representação | Regra no Phaser |
|---|---|---|
| **toxic_water** | água tóxica/poço contaminado | morte ao contato, em qualquer estado |
| **electric_wire** | fio/cabo energizado na altura do corpo | morte ao contato, exceto quando Alex passa corretamente em estado de slide |
| **broken_pipe** | cano ou tubulação rompida | morte imediata ao contato, em qualquer estado, inclusive corrida, pulo ou slide |

#### Regra específica para canos rompidos

Todo cano rompido que possa ser tocado pelo jogador deve ser tratado como hazard:

1. desenhar sua representação visual na layer **hazards**;
2. criar um Rectangle Object correspondente na layer **objects**;
3. usar **Classe = hazard**;
4. adicionar a propriedade string **kind = broken_pipe**;
5. usar nome sequencial **broken_pipe_01**, **broken_pipe_02**, etc.;
6. ajustar o retângulo ao trecho visual letal;
7. testar contato correndo, pulando e deslizando — os três devem resultar em morte.

Não colocar o cano rompido apenas em **ground**, pois colisão sólida e hazard letal são responsabilidades diferentes. Tiles estruturais não letais que sustentem o cano podem continuar em **ground**, mas a parte rompida/letal deve ficar visualmente em **hazards** e logicamente em **objects**.

**Comportamento esperado no Phaser:** criar uma zona física invisível para cada objeto. O comportamento deve ser despachado pelo valor de **kind**, sem depender de fallback para tipos desconhecidos.

### 5.4 **credit**

**Função:** ponto de spawn de um crédito coletável.

**Geometria Tiled:** Point Object.

Exemplo de rota de risco:

~~~text
Nome: credit_risk_01
Classe: credit
id: f1-risk-01
route: risk
~~~

Exemplo de rota normal:

~~~text
Nome: credit_safe_01
Classe: credit
id: f1-safe-01
route: normal
~~~

| Propriedade | Tipo | Valores | Obrigatória |
|---|---|---|---|
| **id** | string | único por crédito | sim |
| **route** | string | **normal** ou **risk** | sim |

O nome do objeto pode conter **safe**, mas o valor oficial de **route** deve ser **normal** para a rota comum e **risk** para a rota arriscada.

**Comportamento esperado no Phaser:** instanciar o coletável na posição do Point Object, usar **id** para persistência/coleta e **route** para telemetria ou balanceamento.

### 5.5 **checkpoint**

**Função:** define o checkpoint jogável da fase. Ao atravessar a área, o jogo consolida os créditos obtidos, salva a posição de retorno e executa o feedback do checkpoint diegético.

**Geometria Tiled:** Rectangle Object.

~~~text
Nome: checkpoint_01
Classe: checkpoint
id: f1-cp1
~~~

| Propriedade | Tipo | Exemplo | Obrigatória |
|---|---|---|---|
| **id** | string | **f1-cp1** | sim |

**Dimensão de blockout recomendada na Fase 1:** **32 × 80 px** (2 × 5 tiles), alinhada à grade sempre que possível.

**Comportamento esperado no Phaser:** criar uma zona/trigger invisível. Ao primeiro cruzamento válido, definir o checkpoint atual, consolidar créditos, persistir o estado e executar o feedback. Em caso de morte posterior, Alex deve retornar ao checkpoint.

**Representação visual:** videogame + televisão de tubo em uma layer visual ou instanciados pelo Phaser. O objeto **checkpoint** representa a lógica, não a arte.

## 6. Classes adicionais por fase

As classes abaixo estão normalizadas no mapa da Fase 2 e são interpretadas pelo runtime `TiledPhase2Runtime`. Os hazards industriais ainda usam um comportamento provisório, explicitado na seção 6.4.

### 6.1 **tutorial**

**Geometria Tiled:** Rectangle Object.

~~~text
Nome: tutorial_double_jump_01
Classe: tutorial
skill = double_jump
~~~

### 6.2 **conveyor**

**Função:** área de esteira que altera o deslocamento horizontal sem causar morte por si só.

**Geometria Tiled:** Rectangle Object.

| Propriedade | Tipo | Valores | Obrigatória |
| --- | --- | --- | --- |
| **direction** | string | **left** ou **right** | sim |
| **speed** | int | velocidade adicional em px/s | sim |

No runtime atual, a velocidade é aplicada somente enquanto o corpo de Alex está apoiado sobre a superfície e sobrepõe horizontalmente o retângulo. `right` soma a velocidade à corrida-base e `left` subtrai. Ao sair da esteira ou pular, Alex volta à velocidade-base.

### 6.3 **clinic**

**Função:** identifica a clínica e o implante concedido após a conclusão da fase.

**Geometria Tiled:** Rectangle Object.

| Propriedade | Tipo | Exemplo | Obrigatória |
| --- | --- | --- | --- |
| **implant** | string | **arms** | sim |
| **next** | string | **ClinicScene** | sim |

### 6.4 Novos valores de **hazard.kind**

| kind | Representação planejada | Regra provisória atual |
| --- | --- | --- |
| **press** | prensa industrial | morte imediata ao contato |
| **steam** | jato de vapor | morte imediata ao contato |
| **mech_arm** | braço mecânico | morte imediata ao contato |
| **crusher** | trituradora | morte ao contato |

Os quatro valores são reconhecidos explicitamente pelo runtime da Fase 2. Seus ciclos, estados ativos e animações continuam pendentes; até que sejam definidos, toda a área retangular autorada em `objects` permanece letal em qualquer estado de Alex.

### 6.5 **low_ceiling**

**Função:** mantém um obstáculo baixo atravessável somente durante o slide, sem obrigar a arte do cano a invadir a silhueta agachada de Alex.

**Geometria Tiled:** Rectangle Object cobrindo apenas a faixa superior ocupada pela hitbox em pé. Não usa propriedades personalizadas.

No mapa atual, a arte fica na Tile Layer **deco-low-ceilings**, desenhada na linha 9 e deslocada **12 px** para baixo. A base visual permanece em **Y = 332**, deixando **52 px** entre o piso em Y = 384 e o cano. O retângulo lógico **low_ceiling** possui **24 px** de altura e mata Alex somente quando o estado não é `sliding`. A hitbox agachada de **30 px** passa abaixo dele.

Cada cano baixo da Fase 2 possui **192 px de comprimento (6 tiles de 32 px)**, tanto no visual quanto no Rectangle Object lógico. Esse comprimento foi validado em playtest como atravessável ao manter o comando de slide pressionado durante todo o obstáculo. Alterações futuras na duração ou na renovação do slide exigem um novo teste dessa medida.

A layer visual não possui colisão. A regra de gameplay continua concentrada em um único Rectangle Object **low_ceiling** por cano, mantendo a layer **objects** livre de peças decorativas.

### 6.6 **breakable**

**Função:** barricada ou caixa destruível pelo ataque dos braços mecânicos.

**Geometria Tiled:** Rectangle Object alinhado ao volume que bloqueia o caminho.

| Propriedade | Tipo | Valores atuais | Obrigatória |
| --- | --- | --- | --- |
| **id** | string | identificador único, como **f3-breakable-01** | sim |
| **kind** | string | **barricade** | sim |

Ao tocar o quebrável sem atacar, Alex entra no estado de pressão definido pelo GDD. O objeto não é um hazard de morte imediata: o jogador possui a janela de reação configurada no código para executar o ataque.

### 6.7 **enemy**

**Função:** ponto lógico de criação de um inimigo da Fase 3.

**Geometria Tiled:** Rectangle Object envolvendo aproximadamente o volume inicial do inimigo.

| Propriedade | Tipo | Valores | Obrigatória |
| --- | --- | --- | --- |
| **kind** | string | **bandido** ou **drone** | sim |

- **bandido:** possui 1 HP, é destruído por um ataque e mata Alex ao contato;
- **drone:** é indestrutível, patrulha horizontalmente e mata Alex ao contato.

### 6.8 **hazard.kind = electric_gate**

O portão elétrico é um Rectangle Object da classe **hazard**, com `kind = electric_gate`. O visual correspondente fica na layer **hazards**. No blockout da Fase 3, ele possui **48 × 64 px** e deve ser ultrapassado com salto; contato causa morte imediata.

### 6.9 Tutorial de ataque

O objeto da classe **tutorial** usa `skill = attack`. Ele marca a área segura anterior à primeira barricada, sem possuir colisão própria.

## 7. Classes planejadas / ainda não formalizadas

Estas classes só entram no contrato oficial quando forem efetivamente criadas no mapa e implementadas:

- **scan_reveal**
- **gate**
- **ending_choice**
- **narrative**
- **zone**
- **animated_prop**

Ao criar uma delas, documentar:

1. nome exato da classe;
2. tipo de objeto;
3. propriedades obrigatórias;
4. valores permitidos;
5. comportamento esperado;
6. exemplo real;
7. teste realizado no Phaser.

## 8. Contratos atuais por fase

### 8.1 Fase 1

#### Layers

~~~text
objects
deco-low-ceilings
deco
hazards
ground
deco-back
background
~~~

#### Objetos usados

~~~text
spawn
phase_end
clinic
hazard
credit
checkpoint
~~~

#### Valores usados

~~~text
hazard.kind = toxic_water | electric_wire | broken_pipe
credit.route = normal | risk
phase_end.fase = 1
clinic.implant = legs
clinic.next = ClinicScene
checkpoint.id = f1-cp1
~~~

### 8.2 Fase 2 — esquema autoral

#### Layers

~~~text
objects
deco
hazards
ground
deco-back
background
~~~

#### Objetos usados

~~~text
spawn
tutorial
credit
hazard
low_ceiling
conveyor
checkpoint
clinic
phase_end
~~~

#### Valores usados

~~~text
tutorial.skill = double_jump
hazard.kind = press | steam | mech_arm | crusher
low_ceiling = volume letal em pé e atravessável somente durante o slide
deco-low-ceilings.offsetY = 12 px; visual sem colisão
conveyor.direction = left | right
conveyor.speed = int
credit.route = normal | risk
checkpoint.id = f2-cp1
clinic.implant = arms
clinic.next = ClinicScene
phase_end.fase = 2
~~~

### 8.3 Fase 3 — esquema autoral

#### Layers

~~~text
objects
deco
hazards
ground
deco-back
background
~~~

#### Objetos usados

~~~text
spawn
tutorial
breakable
enemy
credit
hazard
checkpoint
clinic
phase_end
~~~

#### Valores usados

~~~text
tutorial.skill = attack
breakable.kind = barricade
enemy.kind = bandido | drone
hazard.kind = electric_gate
credit.route = normal | risk
checkpoint.id = f3-cp1
clinic.implant = eyes
clinic.next = ClinicScene
phase_end.fase = 3
~~~

O mapa possui **30.720 px** de comprimento. Com a velocidade-base atual de **320 px/s**, o percurso linear equivale a aproximadamente **96 s sem mortes**, dentro da hipótese de 90–120 s do GDD. As pausas provocadas por quebráveis ainda precisam ser medidas em playtest.

## 9. Regras para integração Phaser

O responsável pela integração deve:

1. carregar o **fase-N.json** correspondente exportado do Tiled;
2. criar/renderizar as layers pelos nomes exatos;
3. aplicar colisão física sólida na layer **ground**;
4. não aplicar colisão por padrão em **background**, **deco-back** e **deco**;
5. tratar **hazards** como representação visual, mantendo a lógica letal em **objects**;
6. ler a Object Layer **objects**;
7. despachar o comportamento pela classe;
8. ler propriedades personalizadas sem alterar seus nomes;
9. implementar explicitamente todos os valores de **hazard.kind** usados pela fase integrada;
10. considerar classes e valores case-sensitive;
11. avisar o level designer antes de mudar qualquer nome usado pelo parser.

### Observação sobre Tiled JSON

Dependendo da versão/exportação do Tiled, a informação exibida na interface como **Classe** pode aparecer no JSON como **type**. A integração deve ser validada contra o JSON exportado real antes de fixar o parser.

## 10. Checklist antes de adicionar classe ou kind

- [ ] Definir nome em minúsculas.
- [ ] Definir Point, Rectangle ou outro tipo.
- [ ] Definir propriedades obrigatórias e seus tipos.
- [ ] Definir valores válidos para propriedades enumeradas.
- [ ] Definir comportamento em cada estado do jogador.
- [ ] Adicionar a definição neste documento.
- [ ] Informar o responsável pela integração.
- [ ] Implementar explicitamente o parser/comportamento no Phaser.
- [ ] Testar pelo menos um objeto real no jogo.

## 11. Checklist da Fase 1 antes do passe de decoração

1. Confirmar que o arquivo aberto é **fase-1.tmj**, não o backup nem o JSON exportado.
2. Confirmar o grid de **16 × 16 px** e as seis layers oficiais.
3. Ocultar temporariamente **background**, **deco-back** e **deco**.
4. Revisar **ground** sozinho e confirmar que contém somente geometria sólida.
5. Revisar **hazards** sozinho e localizar toda água, fio elétrico e cano rompido.
6. Para cada grupo visual em **hazards**, confirmar um objeto correspondente em **objects**.
7. Para cada cano rompido, usar **Classe = hazard** e **kind = broken_pipe**.
8. Conferir nomes sequenciais, propriedades e ausência de IDs duplicados.
9. Conferir se cada hitbox cobre apenas a área visual letal.
10. Salvar o TMJ e exportar **fase-1.json**.
11. Testar no Phaser todos os hazards e o respawn do checkpoint.
12. Somente depois bloquear **ground**, **hazards** e **objects** e iniciar **background → deco-back → deco**.

## 12. Histórico de alterações

### v0.14 — 2026-10-21

- integrado o blockout autoral da Fase 3 ao `GameScene` e ao seletor temporário;
- implementados no runtime créditos, checkpoint, clínica, inimigos, barricadas e portões elétricos;
- registrada a exigência de exportar o JSON de runtime sem compressão zlib.

### v0.13 — 2026-10-21

- criado o mapa autoral `fase-3.tmj` em grid 16 × 16 com o tileset Warped City;
- formalizadas as classes `breakable` e `enemy` e o hazard `electric_gate`;
- organizado o blockout em tutorial de ataque, escolhas agressiva/evasiva, área vertical, checkpoint e sequência final;
- dimensionado o percurso para aproximadamente 96 segundos na velocidade-base atual.

### v0.12 — 2026-10-19

- removido `steam_06`, que começava apenas 32 px após a saída inferior da terceira plataforma suspensa e tornava essa rota impossível;
- padronizados os sete canos baixos em 192 px (6 tiles), medida confirmada como atravessável em playtest;
- auditados os vãos e as sequências de hazards da Fase 2 contra a corrida, o salto e o salto duplo atuais.

### v0.11 — 2026-10-19

- reduzidas as rotas suspensas da Fase 2 de quatro para três;
- definida progressão: primeira plataforma segura, segunda com um vapor e terceira com dois vapores;
- removidos a quarta plataforma e os créditos `credit_risk_13` a `credit_risk_16`;
- ajustado o total da fase para 12 créditos opcionais.

### v0.10 — 2026-10-19

- distribuídas quatro rotas suspensas de risco pela Fase 2, incluindo a plataforma original;
- ampliada a fase de 4 para 16 créditos opcionais, todos com `route = risk` e IDs únicos;
- adicionados `steam_13` a `steam_16` sobre as plataformas, mantendo a rota inferior disponível;
- mantidas as plataformas em Y = 256 e os créditos em Y = 208, exigindo o uso consciente do salto duplo.

### v0.9 — 2026-10-19

- substituídos os 39 Tile Objects `low_ceiling_visual_*` pela Tile Layer `deco-low-ceilings`;
- mantida a base dos canos baixos em Y = 332 por meio de deslocamento vertical de 12 px;
- mantido apenas um Rectangle Object lógico `low_ceiling` por cano.

### v0.8 — 2026-10-19

- concluída a geometria de `ground` da Fase 2 até a clínica e o `phase_end`;
- colocado piso seguro sob o checkpoint em X = 16.000;
- adicionados seis vãos calculados entre 160 e 256 px na segunda metade da fase;
- autorada a combinação final com novas prensas, esteiras, jatos de vapor, braços mecânicos, trituradoras e canos baixos;
- mantida a duração estimada em aproximadamente 92 segundos considerando as cinco esteiras.

### v0.7 — 2026-10-18

- convertida a arte dos dois canos baixos em Tile Objects, permitindo uma abertura intermediária de 52 px;
- formalizada a classe **low_ceiling** para preservar a exigência do slide sem sobrepor o sprite ao cano;
- adicionados `low_ceiling_01` e `low_ceiling_02` ao mapa e ao runtime da Fase 2.

### v0.6 — 2026-10-15

- integrada a exportação `fase-2.json` ao Phaser, substituindo a prévia programática da Fase 2;
- implementada a colisão da layer **ground** e a leitura de spawn, créditos, checkpoint, clínica e fim de fase;
- implementadas as esteiras com velocidade adicional, direção e detecção de contato com a superfície;
- definidos temporariamente **press**, **steam**, **mech_arm** e **crusher** como hazards de morte imediata ao contato;
- mantidos ciclos e animações individuais dos hazards industriais como trabalho futuro.

### v0.5 — 2026-10-14

- registrada a Fase 2 como mapa industrial 32 × 32;
- normalizados nomes, IDs, Points e dimensões dos objetos do blockout;
- formalizado o esquema autoral de **tutorial**, **conveyor** e **clinic**;
- registrados os kinds industriais **press**, **steam**, **mech_arm** e **crusher** como pendentes de implementação no Phaser;
- diferenciada a esteira não letal dos objetos da classe **hazard**.

### v0.4 — 2026-10-14

- formalizado **hazard.kind = broken_pipe**;
- definido que todo cano rompido tocável deve possuir visual em **hazards** e Rectangle Object em **objects**;
- definido que **broken_pipe** causa morte em qualquer estado, inclusive slide;
- documentada a diferença entre estrutura sólida de **ground** e trecho letal do cano;
- adicionado checklist obrigatório antes do passe de decoração;
- atualizados caminhos e situação atual da Fase 1.

### v0.3 — 2026-09-12

- formalizado **hazard.kind = electric_wire**;
- registrado o slide como forma correta de atravessar o fio elétrico.

### v0.2 — 2026-09-12

- formalizada a classe **checkpoint**;
- definido **id = f1-cp1**;
- definido Rectangle Object como geometria oficial;
- documentados consolidação, persistência e respawn;
- registrada dimensão inicial de 32 × 80 px.

### v0.1 — 2026-09-12

- criadas as layers oficiais;
- formalizados **spawn**, **phase_end**, **hazard.kind = toxic_water** e **credit**;
- definidas convenções de capitalização, IDs e alinhamento à grade.

# Flesh to Chrome — Contrato Tiled ↔ Phaser

**Versão:** 0.4  
**Data:** 2026-10-14  
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

## 3. Camadas oficiais

A ordem recomendada no painel do Tiled, de cima para baixo, é:

1. **objects** — objetos lógicos e pontos de gameplay
2. **deco** — decoração em primeiro plano
3. **hazards** — representação visual de perigos
4. **ground** — geometria sólida e plataformas
5. **deco-back** — decoração atrás do jogador
6. **background** — fundo visual sem colisão

### Regras

- **ground**: tudo que deve ter colisão física sólida com Alex.
- **hazards**: apenas o visual do perigo; a lógica letal fica em **objects**.
- **deco** e **deco-back**: sem colisão por padrão.
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

## 6. Classes planejadas / ainda não formalizadas

Estas classes só entram no contrato oficial quando forem efetivamente criadas no mapa e implementadas:

- **clinic**
- **enemy**
- **breakable**
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

## 7. Contrato atual da Fase 1

### Layers

~~~text
objects
deco
hazards
ground
deco-back
background
~~~

### Objetos usados

~~~text
spawn
phase_end
hazard
credit
checkpoint
~~~

### Valores usados

~~~text
hazard.kind = toxic_water | electric_wire | broken_pipe
credit.route = normal | risk
phase_end.fase = 1
checkpoint.id = f1-cp1
~~~

## 8. Regras para integração Phaser

O responsável pela integração deve:

1. carregar o **fase-1.json** exportado do Tiled;
2. criar/renderizar as layers pelos nomes exatos;
3. aplicar colisão física sólida na layer **ground**;
4. não aplicar colisão por padrão em **background**, **deco-back** e **deco**;
5. tratar **hazards** como representação visual, mantendo a lógica letal em **objects**;
6. ler a Object Layer **objects**;
7. despachar o comportamento pela classe;
8. ler propriedades personalizadas sem alterar seus nomes;
9. implementar explicitamente todos os valores de **hazard.kind** definidos neste contrato;
10. considerar classes e valores case-sensitive;
11. avisar o level designer antes de mudar qualquer nome usado pelo parser.

### Observação sobre Tiled JSON

Dependendo da versão/exportação do Tiled, a informação exibida na interface como **Classe** pode aparecer no JSON como **type**. A integração deve ser validada contra o JSON exportado real antes de fixar o parser.

## 9. Checklist antes de adicionar classe ou kind

- [ ] Definir nome em minúsculas.
- [ ] Definir Point, Rectangle ou outro tipo.
- [ ] Definir propriedades obrigatórias e seus tipos.
- [ ] Definir valores válidos para propriedades enumeradas.
- [ ] Definir comportamento em cada estado do jogador.
- [ ] Adicionar a definição neste documento.
- [ ] Informar o responsável pela integração.
- [ ] Implementar explicitamente o parser/comportamento no Phaser.
- [ ] Testar pelo menos um objeto real no jogo.

## 10. Checklist da Fase 1 antes do passe de decoração

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

## 11. Histórico de alterações

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

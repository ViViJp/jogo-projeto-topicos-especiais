# Validação — hazards e fluxo das cinco fases

Documento da branch `fix/gameplay-hazards-and-flow`.

## Regras cobertas

- Fase 2: prensa, vapor, braço mecânico e trituradora alternam entre estados
  inativo, aviso e ativo. Prensa e braço estendem/recolhem, a pluma de vapor
  cresce a partir do bocal e a trituradora abre/fecha; as hitboxes seguem o
  movimento e só são letais durante a janela ativa.
- Fase 2: a prensa usa uma silhueta hidráulica própria, em vez dos blocos do
  chão. A pluma termina exatamente no topo do bocal e sua hitbox usa a mesma
  origem, sem desenhar vapor por cima do cano.
- Fase 2: obstáculos baixos usam dutos industriais visualmente distintos do
  chão; podem ser vencidos saltando por cima ou deslizando por baixo.
- Fase 5: o braço desenhado e os corpos físicos das barreiras rotativas usam
  o mesmo ângulo e relógio.
- Fases 4, 5 e multiplayer: barreiras de segurança são letais enquanto estão
  visíveis. O scan desativa somente a mais próxima à frente, desliga sua zona
  letal e oculta por completo a barreira e o aviso `SCAN`. A zona física vai
  do primeiro tile visível à superfície do chão. A desativação dura pela
  tentativa e volta após morte, sem qualquer janela aleatória de relógio.
- Checkpoints: Alex para por 900 ms diante da TV, senta voltado para a tela e
  anima mãos/controle em uma sequência diferente do slide. A pose permanece
  em primeiro plano e o checkpoint consolida e salva antes de continuar. No
  respawn, a TV volta já ativada sem repetir pose, som, mensagem ou consolidação.
- HUD: o catálogo da fase mantém todos os créditos, inclusive os consolidados;
  apenas os sprites coletados deixam de ser recriados. Assim numerador e total
  permanecem corretos após checkpoint e respawn.
- Reinício manual: volta ao spawn da fase, mantém IDs/créditos consolidados e
  descarta os não consolidados, conforme o GDD.
- Pausa: física, tweens, animações, relógio da cena, hazards e cooldowns ficam
  congelados.

## Verificações automatizadas

Execute:

```bash
npm run typecheck
npm run validate:assets
npm run test:gameplay
npm run test:multiplayer
npm run build
```

`test:gameplay` valida as três janelas e o progresso contínuo do ciclo
industrial, as quatro rotinas de movimento, o alinhamento do vapor, o sprite
dedicado da prensa, a animação/profundidade do checkpoint, os GIDs exclusivos dos obstáculos baixos,
continuidade geométrica do braço rotativo, seleção espacial das barreiras por
scan e a presença de spawn, checkpoint e saída nas cinco fases Tiled.

## Resultado do playtest automatizado em navegador — 07/11/2026

Firefox headless, Phaser real e mapas Tiled carregados pelo Parcel:

| Fase | HUD inicial | HUD após crédito + checkpoint + respawn | Checkpoint repetiu animação? | Saída |
| --- | ---: | ---: | --- | --- |
| 1 | 0/160 | 10/160 | não | aprovada em x=28.864 |
| 2 | 0/120 | 10/120 | não | aprovada em x=30.496 |
| 3 | 0/180 | 10/180 | não | aprovada em x=30.464 |
| 4 | 0/200 | 10/200 | não | aprovada em x=30.464 |
| 5 | 0/300 | 10/300 | não | aprovada em x=37.888 |

Em todas as fases, o catálogo manteve a quantidade total de créditos depois do
respawn, a TV permaneceu ativada e `checkpointInteraction` ficou ausente.

O comportamento anterior de apenas bloquear Alex foi substituído pela regra
definitiva: tocar uma barreira visível causa morte; usar o scan antes do contato
oculta a arte e o aviso, desliga o corpo letal e libera a passagem.

Teste de pausa: o relógio do hazard industrial permaneceu em **366,502 ms**
durante 800 ms pausados e avançou para **633,256 ms** somente após retomar. O
cooldown do dash permaneceu em **2.000 ms** durante a pausa e caiu para
**1.750,246 ms** após 250 ms de jogo retomado. O reinício manual zerou X/Y do
checkpoint e preservou carteira e IDs consolidados.

## Roteiro de playtest manual

Em **Selecionar fase**, percorra as fases 1–5 e registre resultado para cada
linha:

| Fase | Ponto de controle | Resultado esperado |
| --- | --- | --- |
| 1 | água, fios/cano, checkpoint, morte e clínica | slide e salto preservados; respawn no checkpoint |
| 2 | cada tipo industrial, dutos baixos e esteiras | movimento comunica ativação; hitbox acompanha arte/pluma; prensa recolhida não toca a silhueta em pé; máquina inativa não mata; duto não parece plataforma sólida |
| 3 | barricadas, inimigos, checkpoint e morte | ataque e restauração sem duplicação |
| 4 | paredes falsas, barreiras de segurança, propaganda e checkpoint | parede falsa bloqueia Alex até o primeiro scan válido e então permanece invisível/intangível; barreira visível mata e o scan oculta/desativa somente a próxima; propaganda permanece legível e checkpoint não possui torre ao fundo |
| 5 | dash, barreiras, quebráveis e barreiras rotativas | barreira visível mata; scan a torna invisível e libera a passagem sem timing aleatório; visual sempre coincide com a colisão |

Em qualquer fase, pause durante um hazard e durante o cooldown de dash,
aguarde alguns segundos e retome: estado e tempo restantes devem ser os
mesmos. Depois ative o checkpoint, abra a pausa e use **Reiniciar Fase**: Alex
deve voltar ao spawn, os créditos consolidados permanecem e os disponíveis
reaparecem.

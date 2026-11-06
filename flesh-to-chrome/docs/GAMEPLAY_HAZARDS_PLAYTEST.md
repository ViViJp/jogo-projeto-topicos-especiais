# Validação — hazards e fluxo das cinco fases

Documento da branch `fix/gameplay-hazards-and-flow`.

## Regras cobertas

- Fase 2: prensa, vapor, braço mecânico e trituradora alternam entre estados
  inativo, aviso e ativo. Apenas o estado ativo possui colisão letal.
- Fase 2: obstáculos baixos usam dutos industriais visualmente distintos do
  chão; podem ser vencidos saltando por cima ou deslizando por baixo.
- Fase 5: o braço desenhado e os corpos físicos das barreiras rotativas usam
  o mesmo ângulo e relógio.
- Checkpoints: Alex para por 900 ms diante da TV, assume a pose de jogo,
  recebe feedback visual/sonoro, consolida e salva antes de continuar.
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

`test:gameplay` valida as três janelas do ciclo industrial, os GIDs exclusivos
dos obstáculos baixos, limites entre ciclos, continuidade geométrica do braço
rotativo e a presença de spawn, checkpoint e saída nas cinco fases Tiled.

## Roteiro de playtest manual

Em **Selecionar fase**, percorra as fases 1–5 e registre resultado para cada
linha:

| Fase | Ponto de controle | Resultado esperado |
| --- | --- | --- |
| 1 | água, fios/cano, checkpoint, morte e clínica | slide e salto preservados; respawn no checkpoint |
| 2 | cada tipo industrial, dutos baixos e esteiras | aviso antecede ativação; máquina inativa não mata; duto não parece uma plataforma sólida |
| 3 | barricadas, inimigos, checkpoint e morte | ataque e restauração sem duplicação |
| 4 | scan, portas temporizadas e checkpoint | revelações e timers congelam na pausa |
| 5 | dash, portas, quebráveis e barreiras rotativas | visual sempre coincide com a colisão |

Em qualquer fase, pause durante um hazard e durante o cooldown de dash,
aguarde alguns segundos e retome: estado e tempo restantes devem ser os
mesmos. Depois ative o checkpoint, abra a pausa e use **Reiniciar Fase**: Alex
deve voltar ao spawn, os créditos consolidados permanecem e os disponíveis
reaparecem.

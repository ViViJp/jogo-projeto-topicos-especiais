# PR #25 — integração e validação

**Atualizado em:** 2026-11-03

## Estado da integração

- `feat/level-design-branch` atualizada com `origin/main`.
- Seletor temporário de fases e menu de Multiplayer preservados no merge.
- Os cinco mapas Tiled estão integrados ao `GameScene`.
- O seletor de fases usa `testMode: true`; checkpoints, conclusão, morte e
  reinício mantêm o estado apenas na sessão e não chamam métodos de escrita
  do `SaveState`.

## Validação automatizada

Executar na raiz:

```bash
npm install
npm run validate:assets
npm run typecheck
npm run build
```

Resultado da rodada de 2026-11-03:

- `npm install`: concluído, dependências atualizadas e 0 vulnerabilidades;
- `npm run validate:assets`: 5/5 fases aprovadas;
- `npm run typecheck`: aprovado sem erros;
- `npm run build`: aprovado; bundle de produção gerado;
- servidor Parcel iniciado e página, bundle e 25 imagens referenciadas pelo
  HTML responderam HTTP 200 (26 recursos no total).

`validate:assets` verifica, para as cinco fases:

- sincronização semântica entre o `.tmj` editável e o `.json` consumido;
- dimensões, grade e layers obrigatórias;
- classes de objetos, IDs sem duplicação e `hazard.kind` reconhecidos;
- propriedades de esteiras, portas automáticas, scan e clínicas;
- limites de GID, referências de tilesets e existência das imagens;
- assets carregados diretamente pelo runtime, incluindo os cinco estágios
  de Alex, inimigos, checkpoint e barricada.

## Matriz de mecânicas para playtest

| Fase | Verificações |
| --- | --- |
| 1 | colisão do chão; água, fios e canos letais; slide sob fios; checkpoint/respawn; clínica libera pernas |
| 2 | pulo e salto duplo; sete canos baixos; cinco esteiras nos dois sentidos; velocidade volta a `BASE_RUN_SPEED` ao sair; prensas/vapor/braços/trituradoras letais; clínica libera braços |
| 3 | ataque antecipado quebra barricada; ataque preso também quebra; bandido morre em um golpe; drone permanece blindado; contato com inimigo mata; clínica libera olhos |
| 4 | scan revela grupos próximos; paredes falsas ficam totalmente invisíveis e intangíveis após um scan válido; pisos falsos ficam translúcidos; spikes ocultos aparecem; grupos antigos são limpos; barreiras visíveis são letais e o scan as oculta/desativa; clínica libera propulsores |
| 5 | bateria e recarga do dash; lasers/barreiras letais mesmo durante dash; scan oculta/desativa a próxima barreira; quebráveis respondem ao ataque; conclusão retorna ao menu no modo de teste |

## Progressão e persistência

- Checkpoint consolida créditos e salva X/Y, carteira e IDs apenas na campanha.
- Morte descarta créditos ainda não consolidados e reinicia no último checkpoint.
- Clínica instala `legs`, `arms`, `eyes` e `thrusters` após as Fases 1–4,
  respectivamente, e avança pela ordem das cinco fases.
- Fim da Fase 5 encaminha para `EndingScene` na campanha.
- O modo de teste não chama `updateCheckpoint`, `setPhase`, `unlockAbility`
  ou `persist`; ao concluir, volta ao seletor.

## Pendências assumidas do blockout

- Fase 2: `press`, `steam`, `mech_arm` e `crusher` ainda não possuem ciclos
  individuais; o retângulo autorado é sempre letal.
- Fase 5: a barreira rotativa usa volume letal estático; rotação visual e
  janela temporal própria ainda não foram implementadas.
- Fase 5: escolhas Chrome/Flesh e os finais narrativos ainda são sinalização
  de blockout, sem ramificação interativa.
- As fases ainda precisam do passe final de decoração, áudio, animações e
  calibração por playtest humano completo após cada alteração de geometria.

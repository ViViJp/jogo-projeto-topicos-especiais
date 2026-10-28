# Mapas Tiled — Flesh to Chrome

Gerados a partir de `levelDesign.md` + GDD §16 (draft jogável; editável no Tiled).

## Arquivos

| Fase | Setor | Mapa | Tile |
| --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` | 16×16 |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 16×16 |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 (Foozle Sci-Fi Labs) |
| 5 | Topo | `topo/fase-5.json` | 32×32 |

## Camadas (todas as fases)

- `deco` — decoração / teto
- `ground` — colisão, plataformas, gaps
- `scan-visuals` — visuais da Fase 4 controlados pelo scan, sem colisão
- `hazards` — canos, prensas, barricadas (tiles)
- `objects` — spawn, checkpoint, créditos, inimigos, clínica, Portão

## Abrir no Tiled

1. Instale https://www.mapeditor.org/
2. Abra o projeto `.tmj` da fase desejada, por exemplo
   `flesh-to-chrome/src/assets/maps/corporativo/fase-4.tmj`
3. Edite, salve e exporte o `fase-N.json` na mesma pasta; essa é a versão
   preparada para ser carregada pelo jogo

Antes de editar objetos ou hazards, consulte
[`docs/TILED_PHASER_CONTRACT.md`](../../../docs/TILED_PHASER_CONTRACT.md).
Todo cano rompido tocável deve ter arte em `hazards` e um Rectangle
Object `hazard` com `kind = broken_pipe`.

As Fases 1–4 possuem projetos `.tmj` autorais. O mapa JSON da Fase 5 continua
como referência de produção e será migrado quando seu blockout for retomado.
Na Fase 4, `scan-visuals` deve permanecer sem colisão; somente `ground` recebe
colisão sólida, enquanto a letalidade continua definida pelos objetos.

## Phaser (Vitor)

```js
this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json');
this.load.image('sewer', 'assets/tiles/esgoto/tiles/tilesetSewer.png');
const map = this.make.tilemap({ key: 'fase-1' });
```

Object types úteis: `spawn`, `checkpoint`, `credit`, `clinic`, `enemy`,
`hazard`, `breakable`, `scan_reveal`, `automatic_door`, `narrative`,
`ending_choice`, `phase_end`.

# Mapas Tiled — Flesh to Chrome

Gerados a partir de `levelDesign.md` + GDD §16 (draft jogável; editável no Tiled).

## Arquivos

| Fase | Setor | Mapa | Tile |
| --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` | 16×16 |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 32×32 |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 |
| 5 | Topo | `topo/fase-5.json` | 32×32 |

## Camadas (todas as fases)

- `deco` — decoração / teto
- `ground` — colisão, plataformas, gaps
- `hazards` — canos, prensas, barricadas (tiles)
- `objects` — spawn, checkpoint, créditos, inimigos, clínica, Portão

## Abrir no Tiled

1. Instale https://www.mapeditor.org/
2. Para a Fase 1, abra `flesh-to-chrome/src/assets/maps/esgoto/fase-1.tmj`
3. Edite, salve e exporte; o `fase-1.json` gerado na mesma pasta é o arquivo carregado pelo jogo

Os mapas JSON das fases 2–5 são referências de produção e serão migrados
para projetos `.tmj` conforme seus blockouts forem retomados.

## Phaser (Vitor)

```js
this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json');
this.load.image('sewer', 'assets/tiles/esgoto/tiles/tilesetSewer.png');
const map = this.make.tilemap({ key: 'fase-1' });
```

Object types úteis: `spawn`, `checkpoint`, `credit`, `clinic`, `enemy`,
`hazard`, `breakable`, `scan_reveal`, `gate`, `ending_choice`, `phase_end`.

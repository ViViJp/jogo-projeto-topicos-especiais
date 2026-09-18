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

## Regenerar

```bash
python3 scripts/generate_tiled_maps.py          # todas
python3 scripts/generate_tiled_maps.py --fase 3 # uma fase
```

## Abrir no Tiled

1. Instale https://www.mapeditor.org/
2. **File → Open** → `public/assets/maps/<setor>/fase-N.json`
3. Edite e salve

## Phaser (Vitor)

```js
this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json');
this.load.image('sewer', 'assets/tiles/esgoto/tiles/tilesetSewer.png');
const map = this.make.tilemap({ key: 'fase-1' });
```

Object types úteis: `spawn`, `checkpoint`, `credit`, `clinic`, `enemy`,
`hazard`, `breakable`, `scan_reveal`, `gate`, `ending_choice`, `phase_end`.

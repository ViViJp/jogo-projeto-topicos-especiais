# Mapas Tiled — Flesh to Chrome

**Perspectiva:** side-view 2D (Mario / Celeste) — **não** top-down.  
Auto-runner horizontal (GDD) com **verticalidade obrigatória**.

## Arquivos

| Fase | Setor | Mapa | Tile | Notas |
| --- | --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` | 16×16 | Heightmap + fossos + previews PNG |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 | Salto duplo + máquinas em desnível |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 32×32 | Rua vs rooftops |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 | Scan / lasers / propaganda |
| 5 | Topo | `topo/fase-5.json` | 32×32 | Dash + Portão elevado |

## Padrão de level design

1. Side-view (perfil), câmera lateral  
2. Progressão esquerda → direita  
3. Chão sobe e desce (várias alturas) — corredor flat = rejeitado  
4. Camadas: `deco`, `ground`, `hazards`, `objects`  
5. Ritmo: seguro → ensina → combina → respira → climax  
6. Créditos em rota de risco **mais alta** ou mais perigosa  

Issues: [#3](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/3) [#4](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/4) [#5](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/5) [#6](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/6)

## Regenerar

```bash
python3 scripts/generate_tiled_maps.py          # todas
python3 scripts/generate_fase1_map.py           # só Fase 1 + previews
```

## Previews Fase 1

Abra no Finder / Preview:

- `esgoto/preview-start.png`
- `esgoto/preview-mid.png`
- `esgoto/preview-end.png`
- `esgoto/preview-full-mini.png`

## Abrir no Tiled

1. https://www.mapeditor.org/  
2. **File → Open** → `public/assets/maps/esgoto/fase-1.json`

## Phaser (Vitor)

```js
this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json');
this.load.image('sewer', 'assets/tiles/esgoto/tiles/tilesetSewer.png');
const map = this.make.tilemap({ key: 'fase-1' });
// colidir com layer "ground"; hazards = overlap; objects = spawn/checkpoint/...
```

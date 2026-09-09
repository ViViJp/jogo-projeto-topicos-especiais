# Mapas Tiled — Flesh to Chrome

**Perspectiva:** side-view 2D (Mario / Celeste) — **não** top-down.

**Perfil:** montanha / **ascensão** (GDD — Glitch City vertical):

- começa **baixo** (periferia) e termina **alto**
- descidas locais ok, mas o nível médio **não volta** ao do início
- cada setor da campanha também deve parecer mais rico/limpo (arte: issues #7 #8 #9)

| Fase | Spawn ≈Y | Fim ≈Y | Tendência |
| --- | --- | --- | --- |
| 1 Esgoto | 23 | 7 | sobe forte |
| 2 Industrial | 20 | 6 | sobe |
| 3 Meio Urbano | 19 | 7 | rua → rooftops |
| 4 Corporativo | 18 | 6 | sobe |
| 5 Topo | 18 | 4 | Portão no pico |

*(Y menor = mais alto na tela)*

## Arquivos

| Fase | Mapa | Tile |
| --- | --- | --- |
| 1 | `esgoto/fase-1.json` | 16×16 |
| 2 | `industrial/fase-2.json` | 32×32 |
| 3 | `meio-urbano/fase-3.json` | 32×32 |
| 4 | `corporativo/fase-4.json` | 32×32 |
| 5 | `topo/fase-5.json` | 32×32 |

Previews Fase 1: `esgoto/preview-*.png`

## Regenerar

```bash
python3 scripts/generate_tiled_maps.py
python3 scripts/generate_fase1_map.py   # + previews PNG
```

## Issues

- Layout: #3 #4  
- Arte urgente: [#7](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/7) [#8](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/8) [#9](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/9)  
- Phaser: #6  

# Mapas Tiled — Flesh to Chrome

**Edite só aqui:** `public/assets/maps/`  
O sync de runtime (`npm run sync-assets`) **não** copia mapas.

## Arquivos

| Fase | Setor | Arquivo | Tile |
| --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` + **`fase-1.tmj`** (LD) | 16×16 |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 32×32 |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 |
| 5 | Topo | `topo/fase-5.json` | 32×32 |

## Abrir no Tiled

1. https://www.mapeditor.org/
2. File → Open → `public/assets/maps/<setor>/fase-N.json` ou `fase-1.tmj`
3. Salve na raiz (`public/assets/`)

Packs: [`../LINKS-VICTOR.md`](../LINKS-VICTOR.md)

## Regenerar

Scripts `scripts/generate_*.py` são drafts opcionais.  
**Não** rode por cima do `fase-1.tmj` / mapas editados à mão.

## Phaser

Integração do `.tmj` no jogo = Motoca (`flesh-to-chrome/src/`).  
Hoje a Fase 1 jogável ainda usa LevelBuilder (`src/levels/phase1.ts`).

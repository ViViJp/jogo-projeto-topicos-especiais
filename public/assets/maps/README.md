# Mapas Tiled — Flesh to Chrome

Biblioteca oficial (Victor edita aqui): `public/assets/maps/`

Runtime Phaser (cópia / adaptação Motoca): `flesh-to-chrome/src/assets/maps/`

## Arquivos

| Fase | Setor | Mapa (raiz) | Tile |
| --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` + **`fase-1.tmj`** (LD Victor) | 16×16 |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 32×32 |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 |
| 5 | Topo | `topo/fase-5.json` | 32×32 |

## Camadas (padrão)

- `deco` / `background` / `deco-back` — decoração
- `ground` — colisão / plataformas / gaps
- `hazards` — água, canos, prensas, etc.
- `objects` — spawn, checkpoint, créditos, clínica, Portão

## Abrir no Tiled

1. Instale https://www.mapeditor.org/
2. **File → Open** → `public/assets/maps/<setor>/fase-N.json` (ou `fase-1.tmj`)
3. Edite e salve **na raiz** (`public/assets/`)
4. Rode `npm run sync-assets` se o Phaser precisar da cópia

Packs / links: [`../LINKS-VICTOR.md`](../LINKS-VICTOR.md)

## Regenerar (cuidado)

Scripts em `scripts/generate_*.py` são **geradores opcionais de draft**.
**Não** rode por cima do `fase-1.tmj` / mapas que o Victor já editou à mão.

## Phaser (Motoca)

A Fase 1 jogável carrega `flesh-to-chrome/src/assets/maps/esgoto/fase-1.json`
via `TiledFase1.ts` / `TiledLevelRuntime.ts`. Alinhar esse JSON com o
`fase-1.tmj` do Victor é responsabilidade da integração Phaser.

# Flesh to Chrome

Auto-runner 2D cyberpunk (projeto acadêmico). **Há um único jogo** neste repositório.

## Como rodar (única entrada)

```bash
cd flesh-to-chrome
npm install
npm run dev
```

Ou na raiz: `npm run dev` (roda `sync-assets` e encaminha para `flesh-to-chrome/`).

Stack oficial (GDD §22): **TypeScript + Phaser 4 + Parcel** em [`flesh-to-chrome/`](flesh-to-chrome/).

## Papéis do time

| Pessoa | Foco |
| --- | --- |
| **João Pedro** | Arte 2D / UI / áudio → editar em `public/assets/` |
| **Victor Blum** | Game / level design → mapas Tiled em `public/assets/maps/` |
| **Vitor Nascimento (Motoca)** | Phaser → código em `flesh-to-chrome/src/` |

## Workflow de assets (fonte única)

| O quê | Onde editar |
| --- | --- |
| Biblioteca oficial (arte, áudio, mapas LD) | **`public/assets/`** |
| Cópia de runtime (Parcel / Phaser) | `flesh-to-chrome/src/assets/` — **gerada**, não editar na mão |

```bash
npm run sync-assets   # public/assets → flesh-to-chrome/src/assets
```

`predev` / `prebuild` na raiz já chamam o sync. Detalhes: `scripts/sync_runtime_assets.py`.

Links de packs para o Victor (download manual): [`public/assets/LINKS-VICTOR.md`](public/assets/LINKS-VICTOR.md)

## Mapas

- Mapas Tiled (fases 1–5): `public/assets/maps/<setor>/fase-N.json`
- **Fonte LD Fase 1 (Victor):** [`public/assets/maps/esgoto/fase-1.tmj`](public/assets/maps/esgoto/fase-1.tmj)
- Runtime Phaser da Fase 1 hoje: `flesh-to-chrome/src/assets/maps/esgoto/fase-1.json` (integração Motoca)
- Não rode scripts antigos de “regenerar mapa” por cima do blockout do Victor

## Estado atual dos assets

- **Alex** (spritesheet LPC) e **áudio** (BGM/SFX) estão integrados no jogo
- Placeholders ainda existem para alguns hazards/UI gerados em runtime
- Tiles reais por setor em `public/assets/tiles/` (ver `sectors.json`)

## Docs

[`gdd.md`](gdd.md) · [`levelDesign.md`](levelDesign.md) · [`Cyberpunk.md`](Cyberpunk.md) · [`flesh-to-chrome/README.md`](flesh-to-chrome/README.md)

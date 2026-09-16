# Flesh to Chrome

Auto-runner 2D cyberpunk (projeto acadêmico). **Há um único jogo** neste repositório.

## Como rodar

```bash
# na raiz (sincroniza áudio/Alex e sobe o jogo):
npm run sync-assets
npm run dev

# ou:
cd flesh-to-chrome && npm install && npm run dev
```

Stack: **TypeScript + Phaser 4 + Parcel** em [`flesh-to-chrome/`](flesh-to-chrome/).

## Papéis

| Pessoa | Foco |
| --- | --- |
| **João Pedro** | Arte / UI / áudio → `public/assets/` |
| **Victor Blum** | Level design → `public/assets/maps/` |
| **Motoca** | Phaser → `flesh-to-chrome/src/` |

## Assets (fonte única)

| Editar | Cópia de runtime (Parcel) |
| --- | --- |
| **`public/assets/`** | `flesh-to-chrome/public/assets/` (só áudio + alex-flesh) |

```bash
npm run sync-assets
```

**Mapas NÃO entram no sync** — Victor edita só em `public/assets/maps/`.

Links de packs: [`public/assets/LINKS-VICTOR.md`](public/assets/LINKS-VICTOR.md)

## Mapas

- Fases 1–5: `public/assets/maps/<setor>/fase-N.json`
- LD Fase 1 (Victor): [`public/assets/maps/esgoto/fase-1.tmj`](public/assets/maps/esgoto/fase-1.tmj)
- O protótipo jogável atual usa LevelBuilder em `flesh-to-chrome/src/levels/` até o Motoca integrar o `.tmj`

## Estado

- Alex (LPC) + áudio (BGM/SFX) integrados
- BGM global: uma música por vez entre Menu / Fase / Clínica / restart
- Placeholders ainda em parte dos hazards/UI

Docs: [`gdd.md`](gdd.md) · [`levelDesign.md`](levelDesign.md) · [`flesh-to-chrome/README.md`](flesh-to-chrome/README.md)

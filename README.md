# Flesh to Chrome

Auto-runner 2D cyberpunk (projeto acadêmico). **Há um único jogo** neste repositório.

## Como rodar (única entrada)

```bash
cd flesh-to-chrome
npm install
npm run dev
```

Stack oficial (GDD §22): **TypeScript + Phaser 4 + Parcel** em [`flesh-to-chrome/`](flesh-to-chrome/).

Na raiz, `npm run dev` / `npm run build` apenas encaminham para essa pasta.

## Papéis do time

| Pessoa | Foco |
| --- | --- |
| **João Pedro** | Arte 2D / UI / áudio → `public/assets/` (+ cópia usada pelo protótipo em `flesh-to-chrome/public/assets/`) |
| **Victor Blum** | Game / level design → mapas Tiled em `public/assets/maps/` |
| **Vitor Nascimento (Motoca)** | Phaser / integração → código em `flesh-to-chrome/src/` (carregar tilemaps, física, cenas) |

## Assets

- Sprites, tiles, áudio, mapas: [`public/assets/`](public/assets/)
- Mapa Fase 1 (blockout Victor): [`public/assets/maps/esgoto/fase-1.tmj`](public/assets/maps/esgoto/fase-1.tmj)
- Integração Phaser do mapa: issue [#15](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/15) (Motoca)
- Docs: [`gdd.md`](gdd.md), [`levelDesign.md`](levelDesign.md), [`Cyberpunk.md`](Cyberpunk.md)

## O que **não** é o jogo

A pasta `src/` na raiz (Vite + Phaser 3) foi **removida** — era um segundo protótipo paralelo. Não recriar um app jogável na raiz.

## Referências

Direção: GDD + estética **cyberpunk** (ascensão social / Glitch City). Level design e playtest de pulos usam o mapa do Victor integrado no `flesh-to-chrome` (responsabilidade do Motoca).

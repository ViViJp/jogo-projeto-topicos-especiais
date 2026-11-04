# Flesh to Chrome

Auto-runner 2D cyberpunk (projeto acadêmico). **Há um único jogo** neste repositório.

## Como rodar

A aplicação oficial fica em `flesh-to-chrome/` (TypeScript + Phaser 4 + Parcel).

### Pela raiz do repositório

Os scripts da raiz encaminham os comandos para o projeto principal:

```bash
npm install
npm run dev
```

Outros comandos disponíveis na raiz: `npm run build`, `npm run typecheck`,
`npm run validate:assets` e `npm start`.

### Diretamente na pasta do jogo

```bash
cd flesh-to-chrome
npm install
npm run dev
```

## Papéis do time

| Pessoa | Foco |
| --- | --- |
| **João Pedro** | Arte 2D / UI / áudio → `flesh-to-chrome/src/assets/` |
| **Victor Blum** | Game / level design → mapas Tiled em `flesh-to-chrome/src/assets/maps/` |
| **Vitor Nascimento (Motoca)** | Phaser / integração → código em `flesh-to-chrome/src/` (carregar tilemaps, física, cenas) |

## Assets

- Sprites, tiles, áudio e mapas: [`flesh-to-chrome/src/assets/`](flesh-to-chrome/src/assets/)
- Mapa Fase 1 (blockout Victor): [`flesh-to-chrome/src/assets/maps/esgoto/fase-1.tmj`](flesh-to-chrome/src/assets/maps/esgoto/fase-1.tmj)
- Integração Phaser do mapa: issue [#15](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/15) (Motoca)
- Docs: [`gdd.md`](gdd.md), [`levelDesign.md`](levelDesign.md), [`Cyberpunk.md`](Cyberpunk.md)
- Contrato Tiled ↔ Phaser: [`flesh-to-chrome/docs/TILED_PHASER_CONTRACT.md`](flesh-to-chrome/docs/TILED_PHASER_CONTRACT.md)

## O que **não** é o jogo

A pasta `src/` na raiz (Vite + Phaser 3) foi **removida** — era um segundo protótipo paralelo. Não recriar um app jogável na raiz.

## Referências

Direção: GDD + estética **cyberpunk** (ascensão social / Glitch City). Level design e playtest de pulos usam os mapas de referência integrados ao runtime em `flesh-to-chrome/src/assets/`.

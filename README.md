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

## Multiplayer WebRTC (experimental)

O menu já expõe um lobby técnico com topologia WebRTC NxN: cada participante
abre um `RTCPeerConnection` e um DataChannel direto para cada outro participante.
A sinalização usa um servidor WebSocket apenas para presença, SDP e candidatos
ICE; o estado do jogo continua trafegando diretamente entre os dispositivos.

### Teste entre dispositivos na mesma rede

```bash
npm run dev:multiplayer
```

O comando inicia o jogo em `0.0.0.0:1234` e a sinalização em `0.0.0.0:8080`.
O terminal mostra um endereço como `http://192.168.1.10:1234`: abra exatamente
esse endereço nos dois dispositivos, entre em **Multiplayer** no primeiro e use
o botão de copiar convite. As portas 1234 e 8080 precisam estar liberadas no
firewall da máquina que executa o projeto.

O cliente deduz `ws://<host-do-jogo>:8080/ws`. Outro servidor pode ser escolhido
com `?signal=wss%3A%2F%2Fmeu-dominio%2Fws`. Para manter o teste antigo somente
entre abas, use `?signal=local`.

### Redes diferentes e TURN

O STUN público configurado atende conexões diretas compatíveis. Para redes com
NAT simétrico ou bloqueio de P2P, configure um relay TURN antes de iniciar:

```bash
TURN_URL=turn:turn.exemplo.com:3478 \
TURN_USERNAME=usuario \
TURN_CREDENTIAL=segredo \
npm run dev:multiplayer
```

O servidor publica essa configuração em `/ice-config`. Em produção, use
credenciais TURN temporárias e exponha jogo e WebSocket com HTTPS/WSS por um
proxy reverso. O servidor limita cada sala aos 2 jogadores definidos no GDD por
padrão; altere com `MAX_PEERS_PER_ROOM` sabendo que um mesh NxN cresce
quadraticamente.

### Corrida jogável

A pista multiplayer é independente da campanha e dura aproximadamente 120 s.
Os dois jogadores começam com os quatro implantes, têm cópias próprias dos 20
créditos e não colidem entre si. Há um checkpoint central; morrer mantém os
créditos coletados e não interrompe o cronômetro. Quando alguém termina, o outro
recebe 20 s antes do DNF. O resultado usa `tempo bruto - 0,5 s por crédito`, com
bônus máximo de 10 s, e aplica os desempates de créditos e tempo bruto do GDD.

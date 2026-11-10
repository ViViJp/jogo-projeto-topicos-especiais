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
`npm run validate:assets`, `npm run test:gameplay`, `npm run test:narrative`, `npm run test:multiplayer`
e `npm start`. Para executar toda a validação automatizada, use:

```bash
npm test
```

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
- Roteiro e resultados de gameplay: [`flesh-to-chrome/docs/GAMEPLAY_HAZARDS_PLAYTEST.md`](flesh-to-chrome/docs/GAMEPLAY_HAZARDS_PLAYTEST.md)
- Roteiro do fluxo narrativo: [`flesh-to-chrome/docs/NARRATIVE_FLOW_PLAYTEST.md`](flesh-to-chrome/docs/NARRATIVE_FLOW_PLAYTEST.md)

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

A pista multiplayer usa o mapa Tiled próprio
`flesh-to-chrome/src/assets/maps/multiplayer/multiplayer-race.tmj`, derivado da
Fase 5 e estendido no lugar do trecho contemplativo/Portão. Ela é independente
da campanha e dura aproximadamente 120 s.
Os dois jogadores começam com os quatro implantes, têm cópias próprias dos 20
créditos e não colidem entre si. Há um checkpoint central; morrer mantém os
créditos coletados e não interrompe o cronômetro. Quando alguém termina, o outro
recebe 20 s antes do DNF. O resultado usa `tempo bruto - 0,5 s por crédito`, com
bônus máximo de 10 s, e aplica os desempates de créditos e tempo bruto do GDD.
Direção: GDD + estética **cyberpunk** (ascensão social / Glitch City). Level design e playtest de pulos usam os mapas de referência integrados ao runtime em `flesh-to-chrome/src/assets/`.

### Segurança e aceite do multiplayer

O modo WebRTC é cliente-autoritativo. As mensagens são validadas por versão,
identificador da corrida, limites e consistência, mas um cliente modificado ainda
pode falsificar ações plausíveis; o servidor de sinalização não certifica o
resultado. A descrição da largada em duas fases, renegociação dos DataChannels,
restauração após morte e o roteiro de teste em dois dispositivos está em
[`flesh-to-chrome/docs/MULTIPLAYER_SECURITY_AND_PLAYTEST.md`](flesh-to-chrome/docs/MULTIPLAYER_SECURITY_AND_PLAYTEST.md).

Validação automatizada específica:

```bash
cd flesh-to-chrome
npm run test:multiplayer
```

Os mesmos testes podem ser executados pela raiz com `npm test`.

## Nuvem (ISN)

A infraestrutura da campanha fica em [`pulumi/`](pulumi/). É o que se executa com Pulumi; o cliente do jogo continua em `flesh-to-chrome/`.

```bash
cd pulumi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pulumi stack select prod --create
pulumi up
```

A stack tem que se chamar `prod`. Instruções em [`pulumi/README.md`](pulumi/README.md).

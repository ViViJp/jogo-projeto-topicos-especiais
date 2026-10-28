#!/usr/bin/env python3
"""Apply the reviewed PR #24 multiplayer fixes to a clean local checkout.

Run this from outside the repository, after fetching origin/main and checking
out origin's `teste-jogavel` branch. The script does not commit or push.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT_README = '''# Flesh to Chrome

Auto-runner 2D cyberpunk (projeto acadêmico). **Há um único jogo** neste repositório.

## Como rodar

A aplicação oficial fica em `flesh-to-chrome/` (TypeScript + Phaser 4 + Parcel).

### Pela raiz do repositório

Os scripts da raiz encaminham os comandos para o projeto principal:

```bash
npm install
npm run dev
```

Outros comandos disponíveis na raiz: `npm run build`, `npm run typecheck` e `npm start`.

### Diretamente na pasta do jogo

```bash
cd flesh-to-chrome
npm install
npm run dev
```

## Papéis do time

| Pessoa | Foco |
| --- | --- |
| **João Pedro** | Arte 2D / UI / áudio → `public/assets/` e assets integrados ao protótipo em `flesh-to-chrome/src/assets/` |
| **Victor Blum** | Game / level design → mapas Tiled em `public/assets/maps/` |
| **Vitor Nascimento (Motoca)** | Phaser / integração → código em `flesh-to-chrome/src/` (carregar tilemaps, física, cenas) |

## Assets

- Sprites, tiles, áudio e mapas de referência: [`public/assets/`](public/assets/)
- Mapa Fase 1 (blockout Victor): [`public/assets/maps/esgoto/fase-1.tmj`](public/assets/maps/esgoto/fase-1.tmj)
- Assets integrados ao runtime: `flesh-to-chrome/src/assets/`
- Integração Phaser do mapa: issue [#15](https://github.com/ViViJp/jogo-projeto-topicos-especiais/issues/15) (Motoca)
- Docs: [`gdd.md`](gdd.md), [`levelDesign.md`](levelDesign.md), [`Cyberpunk.md`](Cyberpunk.md)

## O que **não** é o jogo

A pasta `src/` na raiz (Vite + Phaser 3) foi **removida** — era um segundo protótipo paralelo. Não recriar um app jogável na raiz.

## Referências

Direção: GDD + estética **cyberpunk** (ascensão social / Glitch City). Level design e playtest de pulos usam os mapas de referência integrados ao runtime em `flesh-to-chrome/src/assets/`.
'''


def run_git(repo: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args], cwd=repo, text=True, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=False,
    )
    if check and result.returncode:
        raise RuntimeError(f"git {' '.join(args)} falhou: {result.stderr.strip()}")
    return result.stdout.rstrip("\n")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Não consegui aplicar '{label}': esperava 1 ocorrência, encontrei {count}.")
    return content.replace(old, new, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="caminho para a raiz local do repositório")
    args = parser.parse_args()
    repo = args.repo.resolve()
    if not (repo / ".git").exists():
        print(f"ERRO: {repo} não parece ser a raiz de um repositório Git.", file=sys.stderr)
        return 2

    branch = run_git(repo, "branch", "--show-current")
    if branch != "teste-jogavel":
        print(f"ERRO: branch atual é '{branch}', mas o PR #24 usa 'teste-jogavel'. Nenhum arquivo foi alterado.", file=sys.stderr)
        return 2

    status = run_git(repo, "status", "--porcelain", "--untracked-files=all")
    if status.strip():
        print("ERRO: a árvore de trabalho não está limpa. Guarde/commite suas mudanças antes de executar; nada foi alterado.", file=sys.stderr)
        print(status, file=sys.stderr)
        return 2

    # Ensure the baseline wrapper files can be restored from the fetched main.
    root_package = run_git(repo, "show", "origin/main:package.json") + "\n"
    root_lock = run_git(repo, "show", "origin/main:package-lock.json") + "\n"

    paths = {
        "mqtt": repo / "flesh-to-chrome/src/network/MqttClient.ts",
        "protocol": repo / "flesh-to-chrome/src/network/MultiplayerProtocol.ts",
        "room": repo / "flesh-to-chrome/src/network/Room.ts",
        "scene": repo / "flesh-to-chrome/src/scenes/MultiplayerScene.ts",
        "app_readme": repo / "flesh-to-chrome/README.md",
    }
    contents = {name: path.read_text(encoding="utf-8") for name, path in paths.items()}

    mqtt = contents["mqtt"]
    mqtt = replace_once(
        mqtt,
        'export type MqttConnectionState = "offline" | "connecting" | "online" | "reconnecting";',
        'export type MqttConnectionState = "offline" | "connecting" | "online" | "reconnecting" | "subscription_error";',
        "estado explícito de erro de inscrição MQTT",
    )
    mqtt = replace_once(
        mqtt,
        '  connect(): void {\n    if (this.client) return;\n',
        '''  connect(): void {
    // Uma recusa de SUBACK não fecha necessariamente o socket. Permitir uma
    // nova tentativa explícita, encerrando a conexão que ficou sem inscrição.
    if (this.client && this.state !== "subscription_error") return;
    if (this.client && this.state === "subscription_error") {
      const failedClient = this.client;
      this.client = undefined;
      failedClient.removeAllListeners();
      failedClient.on("error", () => undefined);
      failedClient.end(false);
    }
''',
        "reconexão após falha de SUBACK",
    )
    mqtt = replace_once(
        mqtt,
        '      if (error || refused) {\n        this.setState("online", `Falha ao entrar no tópico: ${error?.message ?? "broker recusou a inscrição"}`);\n        return;\n      }',
        '      if (error || refused) {\n        this.setState("subscription_error", `Falha ao entrar no tópico: ${error?.message ?? "broker recusou a inscrição"}. Tente sair/desconectar e conectar novamente.`);\n        return;\n      }',
        "não declarar online sem SUBACK válido",
    )
    mqtt = replace_once(
        mqtt,
        '    if (!this.client?.connected) return false;\n    this.client.publish(topic, payload, { qos: 0, retain: false });',
        '    if (!this.client?.connected || this.state !== "online" || !this.activeTopics.has(topic)) return false;\n    this.client.publish(topic, payload, { qos: 0, retain: false });',
        "publicação somente em tópico confirmado",
    )

    protocol = contents["protocol"]
    protocol = replace_once(
        protocol,
        '  | { type: "room_leave"; playerId: string };',
        '  | { type: "room_leave"; playerId: string }\n  | { type: "room_rejoin"; playerId: string; targetId: string };',
        "mensagem para exigir nova admissão após timeout",
    )
    protocol = replace_once(
        protocol,
        'const MESSAGE_TYPES = new Set(["room_hello", "room_welcome", "room_full", "room_presence", "room_leave"]);',
        'const MESSAGE_TYPES = new Set(["room_hello", "room_welcome", "room_full", "room_presence", "room_leave", "room_rejoin"]);',
        "validar a nova mensagem no protocolo",
    )

    room = contents["room"]
    room = replace_once(
        room,
        '      case "room_leave":\n        this.removePeer(message.playerId);\n        break;',
        '''      case "room_leave":
        this.removePeer(message.playerId);
        break;
      case "room_rejoin":
        if (this.role === "player" && message.targetId === this.playerId) {
          // O host expirou nossa presença. Recomeçar a negociação e aguardar
          // novo room_welcome antes de considerar a entrada confirmada.
          this.status = "searching";
          this.peers.clear();
          this.peers.set(message.playerId, { role: "host", lastSeen: Date.now() });
          this.stopTimers();
          this.announce();
        }
        break;''',
        "handshake de reentrada após timeout",
    )
    room = replace_once(
        room,
        '''  private onHello(message: Extract<RoomMessage, { type: "room_hello" }>): void {
    if (this.role !== "host") return;

    const known = this.peers.has(message.playerId);''',
        '''  private onHello(message: Extract<RoomMessage, { type: "room_hello" }>): void {
    if (this.role === "host" && message.role === "host") {
      // Colisão rara de códigos de sala: ambos elegem o menor playerId como
      // host. O outro se torna jogador e envia um novo hello para ser admitido.
      if (this.playerId.localeCompare(message.playerId) < 0) return;
      this.role = "player";
      this.status = "searching";
      this.peers.clear();
      this.stopTimers();
      this.announce();
      this.emit();
      return;
    }
    if (this.role !== "host") return;

    const known = this.peers.has(message.playerId);''',
        "eleição determinística para evitar dois hosts",
    )
    room = replace_once(
        room,
        '''  private removePeer(playerId: string): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    this.peers.delete(playerId);

    if (peer.role === "host" && this.role === "player") {''',
        '''  private removePeer(playerId: string, requestRejoin = false): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    this.peers.delete(playerId);

    if (requestRejoin && peer.role === "player" && this.role === "host") {
      this.publish({ type: "room_rejoin", playerId: this.playerId, targetId: playerId });
    }

    if (peer.role === "host" && this.role === "player") {''',
        "notificar jogador removido por timeout",
    )
    room = replace_once(
        room,
        'if (now - peer.lastSeen > PEER_TIMEOUT_MS) this.removePeer(playerId);',
        'if (now - peer.lastSeen > PEER_TIMEOUT_MS) this.removePeer(playerId, true);',
        "reentrada ao expirar presença",
    )
    room = replace_once(
        room,
        '''        if (this.role === "player" && this.status === "searching" && message.targetId === this.playerId) {
          this.onWelcome(message.hostId);
        }''',
        '''        if (
          this.role === "player" &&
          (this.status === "searching" || this.status === "joined") &&
          message.targetId === this.playerId
        ) {
          // Também processa a confirmação se a reconexão MQTT ocorreu antes
          // de o host expirar o jogador localmente.
          this.onWelcome(message.hostId);
        }''',
        "aceitar nova confirmação do host após reconexão",
    )

    scene = contents["scene"]
    scene = replace_once(
        scene,
        'import { Room, RoomState } from "../network/Room";',
        'import { Room, RoomState } from "../network/Room";\nimport { InputManager } from "../systems/InputManager";',
        "importar InputManager",
    )
    scene = replace_once(
        scene,
        'export class MultiplayerScene extends Phaser.Scene {\n  private mqtt?: MqttClient;',
        'export class MultiplayerScene extends Phaser.Scene {\n  private input$!: InputManager;\n  private returning = false;\n  private mqtt?: MqttClient;',
        "adicionar estado de controle e retorno",
    )
    scene = replace_once(
        scene,
        '  create(): void {\n    this.cameras.main.setBackgroundColor(0x05050a);',
        '  create(): void {\n    this.returning = false;\n    this.input$ = new InputManager(this);\n    this.cameras.main.setBackgroundColor(0x05050a);',
        "inicializar controles de teclado e gamepad",
    )
    scene = replace_once(
        scene,
        '    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 35, "ESC voltar ao menu", {',
        '    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 35, "ESC / B / SELECT voltar ao menu", {',
        "documentar controles de voltar",
    )
    scene = replace_once(
        scene,
        '    this.input.keyboard?.on("keydown-ESC", () => this.backToMenu());\n  }\n\n  private positionInput(): void {',
        '  }\n\n  update(): void {\n    if (!this.returning && this.input$.isCancelJustDown()) this.backToMenu();\n    this.input$.postUpdate();\n  }\n\n  private positionInput(): void {',
        "usar InputManager em update",
    )
    scene = replace_once(
        scene,
        '  private backToMenu(): void {\n    // `cleanup()` roda pelo evento SHUTDOWN assim que a cena para.\n    this.scene.start("MenuScene");\n  }',
        '  private backToMenu(): void {\n    if (this.returning) return;\n    this.returning = true;\n    // `cleanup()` roda pelo evento SHUTDOWN assim que a cena para.\n    this.scene.start("MenuScene");\n  }',
        "proteger transição duplicada para o menu",
    )
    scene = replace_once(
        scene,
        '      online: "Broker: conectado",\n      reconnecting: "Broker: reconectando...",',
        '      online: "Broker: conectado",\n      reconnecting: "Broker: reconectando...",\n      subscription_error: "Broker: inscrição recusada",',
        "mostrar erro de inscrição MQTT na UI",
    )
    scene = replace_once(
        scene,
        '      online: "#7CFCEA",\n      reconnecting: "#FFD37C",',
        '      online: "#7CFCEA",\n      reconnecting: "#FFD37C",\n      subscription_error: "#ff8a8a",',
        "colorir estado de falha MQTT",
    )

    app_readme = contents["app_readme"]
    app_readme = replace_once(
        app_readme,
        '''- **Marco 5 — Multiplayer** (Seção 24.5): implementar `MultiplayerScene`
  (hoje um stub) com a lógica da Seção 21 (pista própria, créditos
  individuais, tempo ajustado, DNF, desconexão).''',
        '''- **Marco 5 — Multiplayer** (Seção 24.5): a base de conexão MQTT/WebSocket,
  criação/entrada em salas, identificação de host e jogadores, presença e
  reconexão já está implementada em `src/network/` e integrada à
  `MultiplayerScene`. Ainda faltam a pista própria, movimentação e
  sincronização da corrida, créditos individuais, tempo ajustado, regras
  de DNF, tratamento completo de desconexão e apresentação dos resultados.''',
        "atualizar roadmap de multiplayer",
    )
    # The MQTT configuration section already appears once in the current branch;
    # extend it to document the newly protected rejoin/host behavior.
    app_readme = replace_once(
        app_readme,
        '- mensagens de boas-vindas e presença dos participantes.\n',
        '- mensagens de boas-vindas e presença dos participantes;\n- nova confirmação do host quando um jogador expira por timeout;\n- desempate determinístico caso dois clientes tentem ser host da mesma sala.\n',
        "documentar reentrada e eleição do host",
    )

    # Write only after every expected replacement has succeeded.
    for name, value in (("mqtt", mqtt), ("protocol", protocol), ("room", room), ("scene", scene), ("app_readme", app_readme)):
        paths[name].write_text(value, encoding="utf-8", newline="\n")
    (repo / "README.md").write_text(ROOT_README, encoding="utf-8", newline="\n")
    (repo / "package.json").write_text(root_package, encoding="utf-8", newline="\n")
    (repo / "package-lock.json").write_text(root_lock, encoding="utf-8", newline="\n")

    try:
        run_git(repo, "diff", "--check")
    except RuntimeError as exc:
        print(f"ERRO: validação de whitespace falhou: {exc}", file=sys.stderr)
        return 1

    print("Correções aplicadas na branch teste-jogavel. Nenhum commit/push foi feito.")
    print("Arquivos alterados:")
    print(run_git(repo, "status", "--short"))
    print("\nPróximos passos:")
    print("  npm run typecheck")
    print("  npm run build")
    print("  git diff --stat")
    print('  git add README.md flesh-to-chrome/README.md package.json package-lock.json flesh-to-chrome/src/network/MqttClient.ts flesh-to-chrome/src/network/MultiplayerProtocol.ts flesh-to-chrome/src/network/Room.ts flesh-to-chrome/src/scenes/MultiplayerScene.ts')
    print('  git commit -m "Fix multiplayer reconnection and preserve controls"')
    print('  git push origin teste-jogavel')
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"ERRO: {error}\nNenhum commit/push foi feito.", file=sys.stderr)
        raise SystemExit(2)

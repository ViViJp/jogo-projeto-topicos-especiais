import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { MULTIPLAYER_CONFIG } from "../config/MultiplayerConfig";
import { createClientId, ROOM_CAPACITY } from "../network/MultiplayerProtocol";
import { MqttClient, MqttConnectionState } from "../network/MqttClient";
import { Room, RoomState } from "../network/Room";
import { InputManager } from "../systems/InputManager";

/** Posição/tamanho do campo de código, em coordenadas do jogo (1280×720). */
const INPUT_BOX = { centerX: SCREEN_WIDTH / 2, top: 390, width: 220, height: 42, fontSize: 20 };

export class MultiplayerScene extends Phaser.Scene {
  private input$!: InputManager;
  private returning = false;
  private mqtt?: MqttClient;
  private room?: Room;
  private roomInput?: HTMLInputElement;
  private statusText?: Phaser.GameObjects.Text;
  private roomText?: Phaser.GameObjects.Text;
  private rosterText?: Phaser.GameObjects.Text;
  private actionText?: Phaser.GameObjects.Text;
  private createButton?: Phaser.GameObjects.Text;
  private joinButton?: Phaser.GameObjects.Text;
  private leaveButton?: Phaser.GameObjects.Text;
  /** Última sala tentada — o Room zera o código ao sair, mas a mensagem de erro precisa dele. */
  private lastRoomId = "";
  /** Remove os listeners de UI ligados ao Room/MqttClient (ver `cleanup`). */
  private uiUnsubscribers: Array<() => void> = [];
  private readonly onWindowResize = () => this.positionInput();
  private readonly onPageHide = () => this.room?.leave();

  constructor() {
    super("MultiplayerScene");
  }

  create(): void {
    this.returning = false;
    this.input$ = new InputManager(this);
    this.cameras.main.setBackgroundColor(0x05050a);
    this.createUi();
    this.createNetwork();

    // O Phaser NÃO chama um método `shutdown()` sozinho — só emite o evento.
    // Sem isto, sair da cena por qualquer caminho que não fosse o ESC deixava
    // a conexão MQTT e o <input> HTML vivos (e com o mesmo estado antigo).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    // Primeiro desliga a UI: quando o evento SHUTDOWN chega, o Phaser já
    // destruiu os textos, e o `disconnect()` abaixo ainda dispara um último
    // estado "offline" — que tentaria pintar um Text destruído (exceção que
    // derrubava a cena seguinte).
    this.uiUnsubscribers.forEach((off) => off());
    this.uiUnsubscribers = [];
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("pagehide", this.onPageHide);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onWindowResize);
    this.roomInput?.remove();
    this.roomInput = undefined;
    this.room?.destroy();
    this.room = undefined;
    this.mqtt = undefined;
  }

  private createUi(): void {
    this.add.text(SCREEN_WIDTH / 2, 90, "MULTIPLAYER", {
      fontFamily: "Courier New, monospace",
      fontSize: "44px",
      color: "#7CFCEA",
    }).setOrigin(0.5);

    this.add.text(SCREEN_WIDTH / 2, 135, "ETAPA 1 + 2 — MQTT / SALAS", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);

    this.statusText = this.add.text(SCREEN_WIDTH / 2, 190, "Broker: desconectado", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#ff8a8a",
      align: "center",
      wordWrap: { width: 900 },
    }).setOrigin(0.5);

    this.roomText = this.add.text(SCREEN_WIDTH / 2, 262, "Sala: —", {
      fontFamily: "Courier New, monospace",
      fontSize: "30px",
      color: "#FFD37C",
    }).setOrigin(0.5);

    this.rosterText = this.add.text(SCREEN_WIDTH / 2, 322, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
      align: "center",
      lineSpacing: 6,
    }).setOrigin(0.5);

    this.roomInput = document.createElement("input");
    this.roomInput.type = "text";
    this.roomInput.maxLength = 6;
    this.roomInput.placeholder = "CÓDIGO DA SALA";
    this.roomInput.autocomplete = "off";
    this.roomInput.spellcheck = false;
    Object.assign(this.roomInput.style, {
      position: "fixed",
      textAlign: "center",
      fontFamily: "Courier New, monospace",
      background: "#10131c",
      color: "#e8ecff",
      border: "1px solid #7CFCEA",
      outline: "none",
      textTransform: "uppercase",
      boxSizing: "border-box",
    });
    this.roomInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.joinRoom();
    });
    document.body.appendChild(this.roomInput);

    // O campo é HTML (fica por cima do canvas), então precisa acompanhar o
    // tamanho/posição reais do canvas — com Scale.FIT o canvas quase nunca
    // está em 1280×720, e coordenadas fixas em px jogavam o campo por cima
    // do título/status em qualquer janela de outro tamanho.
    this.positionInput();
    window.addEventListener("resize", this.onWindowResize);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onWindowResize);
    window.addEventListener("pagehide", this.onPageHide);

    this.createButton = this.makeButton(430, 485, "CRIAR SALA", () => this.createRoom());
    this.joinButton = this.makeButton(650, 485, "ENTRAR NA SALA", () => this.joinRoom());
    this.leaveButton = this.makeButton(540, 540, "SAIR / DESCONECTAR", () => this.leaveRoom());

    this.actionText = this.add.text(SCREEN_WIDTH / 2, 612, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#8892b0",
      align: "center",
      wordWrap: { width: 760 },
    }).setOrigin(0.5);

    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 35, "ESC / B / SELECT voltar ao menu", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);

  }

  update(): void {
    if (!this.returning && this.input$.isCancelJustDown()) this.backToMenu();
    this.input$.postUpdate();
  }

  private positionInput(): void {
    const input = this.roomInput;
    if (!input) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = rect.width / SCREEN_WIDTH;
    const sy = rect.height / SCREEN_HEIGHT;
    Object.assign(input.style, {
      left: `${rect.left + INPUT_BOX.centerX * sx}px`,
      top: `${rect.top + INPUT_BOX.top * sy}px`,
      width: `${INPUT_BOX.width * sx}px`,
      height: `${INPUT_BOX.height * sy}px`,
      fontSize: `${INPUT_BOX.fontSize * sy}px`,
      transform: "translateX(-50%)",
    });
  }

  private createNetwork(): void {
    const clientId = createClientId();
    const brokerUrl = MULTIPLAYER_CONFIG.brokerUrl;
    this.mqtt = new MqttClient({
      url: brokerUrl,
      clientId,
      keepAliveSeconds: MULTIPLAYER_CONFIG.keepAliveSeconds,
      reconnectDelayMs: MULTIPLAYER_CONFIG.reconnectDelayMs,
    });

    this.room = new Room(this.mqtt);
    this.uiUnsubscribers = [
      this.mqtt.onState((state, detail) => this.updateConnectionStatus(state, detail)),
      this.room.onState((state) => this.updateRoomState(state)),
    ];

    this.setAction(`Broker configurado para ${brokerUrl}.`);
  }

  private createRoom(): void {
    if (!this.room) return;
    try {
      const roomId = this.room.create();
      this.lastRoomId = roomId;
      if (this.roomInput) this.roomInput.value = roomId;
    } catch (error) {
      this.setAction(this.errorMessage(error));
    }
  }

  private joinRoom(): void {
    if (!this.room || !this.roomInput) return;
    const code = this.roomInput.value.trim().toUpperCase();
    if (!code) {
      this.setAction("Digite o código de 6 caracteres da sala.");
      return;
    }

    try {
      this.lastRoomId = code;
      this.room.join(code, "player");
    } catch (error) {
      this.setAction(this.errorMessage(error));
    }
  }

  private leaveRoom(): void {
    this.room?.leave();
    this.roomText?.setText("Sala: —");
    this.rosterText?.setText("");
    this.setAction("Você saiu da sala e desconectou do broker.");
  }

  private updateConnectionStatus(state: MqttConnectionState, detail?: string): void {
    const labels: Record<MqttConnectionState, string> = {
      offline: "Broker: desconectado",
      connecting: "Broker: conectando...",
      online: "Broker: conectado",
      reconnecting: "Broker: reconectando...",
      subscription_error: "Broker: inscrição recusada",
    };
    const colors: Record<MqttConnectionState, string> = {
      offline: "#ff8a8a",
      connecting: "#FFD37C",
      online: "#7CFCEA",
      reconnecting: "#FFD37C",
      subscription_error: "#ff8a8a",
    };
    this.statusText?.setText(detail ? `${labels[state]}\n${detail}` : labels[state]);
    this.statusText?.setColor(colors[state]);
  }

  private updateRoomState(state: RoomState): void {
    // Tentativas que terminaram sem entrar (ou sala que acabou).
    if (!state.roomId) {
      this.roomText?.setText("Sala: —");
      this.rosterText?.setText("");
      const id = this.lastRoomId;
      if (state.status === "not_found") {
        this.setAction(`Sala ${id} não encontrada: nenhum host respondeu. Confira o código e se o host já criou a sala.`);
      } else if (state.status === "full") {
        this.setAction(`A sala ${id} já está cheia (${ROOM_CAPACITY}/${ROOM_CAPACITY}).`);
      } else if (state.status === "host_left") {
        this.setAction(`O host saiu da sala ${id}. Crie uma sala nova ou entre em outra.`);
      }
      return;
    }

    const roleLabel = state.role === "host" ? "HOST" : "JOGADOR";
    this.roomText?.setText(`Sala: ${state.roomId}  |  ${roleLabel}`);

    const lines = state.players.map((p) => {
      const role = p.role === "host" ? "HOST" : "JOGADOR";
      return `${p.isSelf ? "►" : " "} ${p.playerId}  (${role})${p.isSelf ? "  — você" : ""}`;
    });
    if (state.status === "searching") {
      lines.push("  procurando a sala...");
    } else if (state.players.length < ROOM_CAPACITY) {
      lines.push("  aguardando o outro jogador...");
    }
    this.rosterText?.setText(lines.join("\n"));

    const offline = state.connection !== "online";
    if (state.status === "searching") {
      this.setAction(offline ? "Aguardando conexão com o broker..." : `Procurando a sala ${state.roomId}...`);
    } else if (state.status === "hosting") {
      this.setAction(
        state.players.length >= ROOM_CAPACITY
          ? `Sala ${state.roomId} completa: ${ROOM_CAPACITY}/${ROOM_CAPACITY} jogadores conectados.`
          : `Sala ${state.roomId} criada. Envie esse código para o segundo jogador.`
      );
    } else if (state.status === "joined") {
      this.setAction(`Você entrou na sala ${state.roomId}: ${state.players.length}/${ROOM_CAPACITY} jogadores conectados.`);
    }
  }

  private makeButton(x: number, y: number, label: string, action: () => void): Phaser.GameObjects.Text {
    return this.add.text(x, y, label, {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#e8ecff",
      backgroundColor: "#111827",
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.setButtonColor(label, "#FFD37C"))
      .on("pointerout", () => this.setButtonColor(label, "#e8ecff"))
      .on("pointerdown", action);
  }

  private setButtonColor(label: string, color: string): void {
    const button = [this.createButton, this.joinButton, this.leaveButton].find((item) => item?.text === label);
    button?.setColor(color);
  }

  private setAction(message: string): void {
    this.actionText?.setText(message);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  }

  private backToMenu(): void {
    if (this.returning) return;
    this.returning = true;
    // `cleanup()` roda pelo evento SHUTDOWN assim que a cena para.
    this.scene.start("MenuScene");
  }
}

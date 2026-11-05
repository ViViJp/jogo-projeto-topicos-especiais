import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { MultiplayerMessage } from "../multiplayer/MultiplayerProtocol";
import { BroadcastChannelSignaling } from "../multiplayer/SignalingTransport";
import { WebRtcMesh } from "../multiplayer/WebRtcMesh";
import { InputManager } from "../systems/InputManager";

const SIGNALING_CHANNEL = "flesh-to-chrome-webrtc-v1";

/** Lobby inicial do multiplayer e demonstracao do mesh WebRTC NxN. */
export class MultiplayerScene extends Phaser.Scene {
  private input$!: InputManager;
  private mesh?: WebRtcMesh;
  private statusText?: Phaser.GameObjects.Text;
  private peersText?: Phaser.GameObjects.Text;
  private localPeerId = "";
  private roomId = "";
  private lastHeartbeatAt = 0;
  private returning = false;

  constructor() {
    super("MultiplayerScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);
    this.returning = false;
    this.localPeerId = createPeerId();
    this.roomId = roomFromUrl();

    this.add
      .text(SCREEN_WIDTH / 2, 90, "MESH WEBRTC NxN", {
        fontFamily: "Courier New, monospace",
        fontSize: "42px",
        color: "#7CFCEA",
      })
      .setOrigin(0.5);

    this.add
      .text(
        SCREEN_WIDTH / 2,
        155,
        `SALA  ${this.roomId}\nVOCE  ${this.localPeerId}`,
        textStyle("#8892b0", "18px")
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(SCREEN_WIDTH / 2, 255, "Abrindo sinalizacao local...", textStyle("#FFD37C", "22px"))
      .setOrigin(0.5);
    this.peersText = this.add
      .text(SCREEN_WIDTH / 2, 325, "0 peers conectados", textStyle("#e8ecff", "26px"))
      .setOrigin(0.5);

    const copyButton = this.add
      .text(SCREEN_WIDTH / 2, 425, "[ COPIAR LINK PARA OUTRA ABA ]", {
        ...textStyle("#7CFCEA", "20px"),
        backgroundColor: "#102824",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => void this.copyInviteLink());
    copyButton.on("pointerover", () => copyButton.setColor("#FFD37C"));
    copyButton.on("pointerout", () => copyButton.setColor("#7CFCEA"));

    this.add
      .text(
        SCREEN_WIDTH / 2,
        510,
        "Abra o link em outras abas deste navegador para testar o mesh.\n" +
          "Cada participante estabelece um DataChannel direto com todos os demais.",
        { ...textStyle("#8892b0", "16px"), align: "center" }
      )
      .setOrigin(0.5);

    this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 42,
        "ESC / B / SELECT para voltar",
        textStyle("#565f80", "14px")
      )
      .setOrigin(0.5);

    this.startMesh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopMesh());
  }

  update(time: number): void {
    if (this.input$.isCancelJustDown()) this.backToMenu();

    if (this.mesh && time - this.lastHeartbeatAt >= 1000) {
      const message: MultiplayerMessage = { type: "peer-state", ready: true, sentAt: Date.now() };
      this.mesh.broadcast(message);
      this.lastHeartbeatAt = time;
    }
    this.input$.postUpdate();
  }

  private startMesh(): void {
    if (!("RTCPeerConnection" in window) || !("BroadcastChannel" in window)) {
      this.statusText
        ?.setText("Este navegador nao oferece as APIs WebRTC necessarias.")
        .setColor("#ff8a8a");
      return;
    }

    this.mesh = new WebRtcMesh({
      localPeerId: this.localPeerId,
      roomId: this.roomId,
      signaling: new BroadcastChannelSignaling(SIGNALING_CHANNEL),
    });
    this.mesh.addEventListener("peerconnected", () => this.refreshPeerStatus());
    this.mesh.addEventListener("peerdisconnected", () => this.refreshPeerStatus());
    this.mesh.addEventListener("message", (event) => {
      const detail = (event as CustomEvent<{ peerId: string; message: MultiplayerMessage }>).detail;
      if (detail.message.type === "peer-state") {
        this.statusText?.setText(`Estado recebido de ${detail.peerId}`).setColor("#7CFCEA");
      }
    });
    this.mesh.addEventListener("mesherror", (event) => {
      const error = (event as CustomEvent<unknown>).detail;
      console.error("Falha no mesh WebRTC", error);
      this.statusText?.setText("Falha ao negociar uma conexao WebRTC.").setColor("#ff8a8a");
    });
    try {
      this.mesh.start();
      this.statusText?.setText("Aguardando peers na sala...");
    } catch (error) {
      console.error("Falha ao abrir a sinalizacao WebRTC", error);
      this.mesh = undefined;
      this.statusText?.setText("Nao foi possivel abrir a sinalizacao local.").setColor("#ff8a8a");
    }
  }

  private refreshPeerStatus(): void {
    const peers = this.mesh?.connectedPeerIds() ?? [];
    this.peersText?.setText(
      `${peers.length} peer${peers.length === 1 ? "" : "s"} conectado${peers.length === 1 ? "" : "s"}`
    );
    this.statusText
      ?.setText(peers.length > 0 ? `Mesh ativo: ${peers.join(", ")}` : "Aguardando peers na sala...")
      .setColor(peers.length > 0 ? "#7CFCEA" : "#FFD37C");
  }

  private async copyInviteLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.statusText?.setText("Link copiado. Abra-o em uma nova aba.").setColor("#7CFCEA");
    } catch {
      this.statusText?.setText(`Use esta sala em outra aba: ${this.roomId}`).setColor("#FFD37C");
    }
  }

  private stopMesh(): void {
    this.mesh?.stop();
    this.mesh = undefined;
  }

  private backToMenu(): void {
    if (this.returning) return;
    this.returning = true;
    this.stopMesh();
    this.scene.start("MenuScene");
  }
}

function roomFromUrl(): string {
  const url = new URL(window.location.href);
  const requestedRoom = url.searchParams.get("room")?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const roomId = requestedRoom || randomToken(6);
  if (!requestedRoom) {
    url.searchParams.set("room", roomId);
    window.history.replaceState(null, "", url);
  }
  return roomId;
}

function createPeerId(): string {
  return `alex-${randomToken(5)}`;
}

function randomToken(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length)
    .toUpperCase();
}

function textStyle(color: string, fontSize: string): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: "Courier New, monospace", fontSize, color };
}

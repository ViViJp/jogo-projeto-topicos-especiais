import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { MultiplayerMessage } from "../multiplayer/MultiplayerProtocol";
import {
  BroadcastChannelSignaling,
  SignalingState,
  SignalingTransport,
  WebSocketSignaling,
} from "../multiplayer/SignalingTransport";
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
  private meshStartId = 0;

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
      .text(SCREEN_WIDTH / 2, 255, "Conectando ao servidor de sinalizacao...", textStyle("#FFD37C", "22px"))
      .setOrigin(0.5);
    this.peersText = this.add
      .text(SCREEN_WIDTH / 2, 325, "0 peers conectados", textStyle("#e8ecff", "26px"))
      .setOrigin(0.5);

    const copyButton = this.add
      .text(SCREEN_WIDTH / 2, 425, "[ COPIAR CONVITE PARA OUTRO DISPOSITIVO ]", {
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
        "Abra o link em outro computador ou celular conectado a rede.\n" +
          "Apos a sinalizacao, os DataChannels conectam os jogadores diretamente.",
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

    void this.startMesh();
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

  private async startMesh(): Promise<void> {
    const startId = ++this.meshStartId;
    if (!("RTCPeerConnection" in window) || !("WebSocket" in window)) {
      this.statusText
        ?.setText("Este navegador nao oferece as APIs WebRTC necessarias.")
        .setColor("#ff8a8a");
      return;
    }

    try {
      const signaling = resolveSignaling();
      const rtcConfiguration = signaling.serverUrl
        ? await loadIceConfiguration(signaling.serverUrl)
        : undefined;
      if (startId !== this.meshStartId) return;

      this.mesh = new WebRtcMesh({
        localPeerId: this.localPeerId,
        roomId: this.roomId,
        signaling: signaling.transport,
        rtcConfiguration,
      });
      this.mesh.addEventListener("peerconnected", () => this.refreshPeerStatus());
      this.mesh.addEventListener("peerdisconnected", () => this.refreshPeerStatus());
      this.mesh.addEventListener("signalingstate", (event) => {
        const { state } = (event as CustomEvent<{ state: SignalingState }>).detail;
        this.updateSignalingStatus(state);
      });
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
      this.mesh.start();
    } catch (error) {
      console.error("Falha ao abrir a sinalizacao WebRTC", error);
      this.mesh = undefined;
      this.statusText?.setText("Nao foi possivel abrir a sinalizacao.").setColor("#ff8a8a");
    }
  }

  private updateSignalingStatus(state: SignalingState): void {
    if ((this.mesh?.connectedPeerIds().length ?? 0) > 0) return;
    switch (state) {
      case "connecting":
        this.statusText?.setText("Conectando ao servidor de sinalizacao...").setColor("#FFD37C");
        break;
      case "open":
        this.statusText?.setText("Servidor conectado. Aguardando peers...").setColor("#7CFCEA");
        break;
      case "closed":
        this.statusText?.setText("Sinalizacao desconectada. Tentando novamente...").setColor("#FFD37C");
        break;
      case "error":
        this.statusText?.setText("Servidor indisponivel. Verifique npm run dev:multiplayer.").setColor("#ff8a8a");
        break;
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
    if (isLoopbackHost(window.location.hostname)) {
      this.statusText
        ?.setText("Abra o jogo pelo IP da rede local antes de copiar o convite.")
        .setColor("#FFD37C");
      return;
    }
    if (await copyText(window.location.href)) {
      this.statusText?.setText("Convite copiado. Abra-o no outro dispositivo.").setColor("#7CFCEA");
    } else {
      this.statusText?.setText(`Copie a URL do navegador. Sala: ${this.roomId}`).setColor("#FFD37C");
    }
  }

  private stopMesh(): void {
    this.meshStartId += 1;
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

interface ResolvedSignaling {
  transport: SignalingTransport;
  serverUrl?: string;
}

function resolveSignaling(): ResolvedSignaling {
  const configuredServer = new URL(window.location.href).searchParams.get("signal");
  if (configuredServer === "local") {
    if (!("BroadcastChannel" in window)) throw new Error("BroadcastChannel indisponivel.");
    return { transport: new BroadcastChannelSignaling(SIGNALING_CHANNEL) };
  }

  const serverUrl = configuredServer || defaultSignalingUrl();
  const parsedUrl = new URL(serverUrl);
  if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
    throw new Error("A URL de sinalizacao precisa usar ws:// ou wss://.");
  }
  return { transport: new WebSocketSignaling(parsedUrl.toString()), serverUrl: parsedUrl.toString() };
}

function defaultSignalingUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8080/ws`;
}

async function loadIceConfiguration(serverUrl: string): Promise<RTCConfiguration | undefined> {
  const configurationUrl = new URL(serverUrl);
  configurationUrl.protocol = configurationUrl.protocol === "wss:" ? "https:" : "http:";
  configurationUrl.pathname = "/ice-config";
  configurationUrl.search = "";
  configurationUrl.hash = "";

  const abortController = new AbortController();
  const timeout = window.setTimeout(() => abortController.abort(), 2500);
  try {
    const response = await fetch(configurationUrl, { signal: abortController.signal });
    if (!response.ok) return undefined;
    const value: unknown = await response.json();
    if (!isRecord(value) || !Array.isArray(value.iceServers)) return undefined;
    return value as RTCConfiguration;
  } catch {
    return undefined;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Em HTTP na rede local a Clipboard API moderna pode ser bloqueada.
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
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

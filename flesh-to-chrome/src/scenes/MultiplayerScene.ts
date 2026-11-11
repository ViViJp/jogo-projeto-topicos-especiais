import Phaser from "phaser";
import { CAMERA, GRAVITY_Y, SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { Player } from "../entities/Player";
import {
  TILED_MULTIPLAYER_BACKGROUND,
  TILED_MULTIPLAYER_CREDIT_COUNT,
  TILED_MULTIPLAYER_END_X,
  TILED_MULTIPLAYER_LENGTH,
  TILED_MULTIPLAYER_MAP_DATA,
  TILED_MULTIPLAYER_MAP_KEY,
  TILED_MULTIPLAYER_NAME,
  TILED_MULTIPLAYER_OFFSET_Y,
  TILED_MULTIPLAYER_SPAWN,
  TILED_MULTIPLAYER_TILESETS,
} from "../levels/TiledMultiplayer";
import {
  MAX_RACE_DURATION_MS,
  MULTIPLAYER_PROTOCOL_VERSION,
  MultiplayerMessage,
  PlayerSnapshotMessage,
  RaceFinishMessage,
} from "../multiplayer/MultiplayerProtocol";
import {
  BroadcastChannelSignaling,
  SignalingState,
  SignalingTransport,
  WebSocketSignaling,
} from "../multiplayer/SignalingTransport";
import { WebRtcMesh } from "../multiplayer/WebRtcMesh";
import { TILED_CHECKPOINT_TEXTURE_KEY } from "../objects/TiledLevelRuntime";
import {
  TILED_PHASE5_BARRICADE_TEXTURE_KEY,
  TILED_PHASE5_GATE_TEXTURE_KEY,
  TiledPhase5Runtime,
} from "../objects/TiledPhase5Runtime";
import { InputManager } from "../systems/InputManager";
import { AudioManager, BGM } from "../systems/AudioManager";
import {
  ALEX_ARMS_TEXTURE_KEY,
  ALEX_DASH_TEXTURE_KEY,
  ALEX_EYES_TEXTURE_KEY,
  ALEX_LEGS_TEXTURE_KEY,
  ALEX_SHEET_CONFIG,
  ALEX_TEXTURE_KEY,
  alexRunAnimationKey,
  alexSlideAnimationKey,
} from "../utils/AlexSprite";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";

const SIGNALING_CHANNEL = "flesh-to-chrome-webrtc-v1";
const SNAPSHOT_INTERVAL_MS = 1000 / 15;
const SECOND_PLAYER_LIMIT_MS = 20_000;
const RESULT_NETWORK_GRACE_MS = 1_000;
const START_COUNTDOWN_MS = 4_000;
const START_HANDSHAKE_TIMEOUT_MS = 8_000;
const START_MIN_LEAD_MS = 2_000;
const START_MAX_LEAD_MS = 15_000;
const FINISH_CONSISTENCY_TOLERANCE_MS = 2_500;
const MIN_PLAUSIBLE_RACE_TIME_MS = 15_000;
const ALL_ABILITIES = { legs: true, arms: true, eyes: true, thrusters: true } as const;

type RacePhase = "lobby" | "countdown" | "racing" | "finished";

interface RaceResult {
  rawTimeMs: number;
  credits: number;
}

/** Corrida competitiva descrita na secao 21 do GDD. */
export class MultiplayerScene extends Phaser.Scene {
  private input$!: InputManager;
  private mesh?: WebRtcMesh;
  private player?: Player;
  private runtime?: TiledPhase5Runtime;
  private opponentSprite?: Phaser.GameObjects.Sprite;
  private scanOverlay?: Phaser.GameObjects.Rectangle;

  private statusText?: Phaser.GameObjects.Text;
  private peersText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private creditsText?: Phaser.GameObjects.Text;
  private opponentText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private notificationText?: Phaser.GameObjects.Text;
  private lobbyObjects: Array<{ setVisible(value: boolean): unknown }> = [];

  private localPeerId = "";
  private roomId = "";
  private opponentPeerId?: string;
  private remoteReady = false;
  private preparedRaceId?: string;
  private startHandshakeTimer?: Phaser.Time.TimerEvent;
  private nextStartAttemptAt = 0;
  private phase: RacePhase = "lobby";
  private raceStartAt = 0;
  private finishDeadlineAt?: number;
  private localResult?: RaceResult;
  private remoteResult?: RaceResult;
  private localDnf = false;
  private remoteDnf = false;
  private collectedCredits = new Set<string>();
  private checkpoint: { x: number; y: number } = { ...TILED_MULTIPLAYER_SPAWN };
  private raceSpawn: { x: number; y: number } = { ...TILED_MULTIPLAYER_SPAWN };
  private raceLength = TILED_MULTIPLAYER_LENGTH;
  private raceEndX = TILED_MULTIPLAYER_END_X;
  private checkpointReached = false;
  private respawning = false;
  private returning = false;
  private meshStartId = 0;

  private lastHeartbeatAt = 0;
  private lastSnapshotAt = 0;
  private snapshotSequence = 0;
  private lastRemoteSequence = -1;
  private lastRemoteSentAt = 0;
  private lastRemoteCredits = 0;
  private remoteCheckpointReached = false;
  private remoteClockOffsetMs?: number;
  private remoteTarget?: { x: number; y: number; state: PlayerSnapshotMessage["state"]; credits: number };

  constructor() {
    super("MultiplayerScene");
  }

  preload(): void {
    const spritesheets = [
      { key: ALEX_TEXTURE_KEY, url: new URL("../assets/player/alex-flesh/alex-flesh.png", import.meta.url) },
      { key: ALEX_LEGS_TEXTURE_KEY, url: new URL("../assets/player/alex-legs/alex-legs.png", import.meta.url) },
      { key: ALEX_ARMS_TEXTURE_KEY, url: new URL("../assets/player/alex-arms/alex-arms.png", import.meta.url) },
      { key: ALEX_EYES_TEXTURE_KEY, url: new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url) },
      { key: ALEX_DASH_TEXTURE_KEY, url: new URL("../assets/player/alex-dash/alex-dash.png", import.meta.url) },
    ];
    spritesheets.forEach(({ key, url }) => {
      if (!this.textures.exists(key)) this.load.spritesheet(key, url.href, ALEX_SHEET_CONFIG);
    });

    const mapAssets = [
      {
        key: TILED_MULTIPLAYER_TILESETS[0].key,
        url: new URL("../assets/tiles/topo/cyber-purp/tileset.png", import.meta.url),
      },
      {
        key: TILED_MULTIPLAYER_TILESETS[1].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/traps/laser_idle.png", import.meta.url),
      },
      {
        key: TILED_MULTIPLAYER_TILESETS[2].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/interactive/barrier_idle.png", import.meta.url),
      },
    ];
    mapAssets.forEach(({ key, url }) => {
      if (!this.textures.exists(key)) this.load.image(key, url.href);
    });
    if (!this.textures.exists(TILED_PHASE5_BARRICADE_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE5_BARRICADE_TEXTURE_KEY,
        new URL("../assets/props/obstacles/phase5-barricade.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_PHASE5_GATE_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE5_GATE_TEXTURE_KEY,
        new URL("../assets/narrative/gate/portao.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
      this.load.image(
        TILED_CHECKPOINT_TEXTURE_KEY,
        new URL("../assets/props/checkpoint/tv-checkpoint.png", import.meta.url).href,
      );
    }
    if (!this.cache.tilemap.exists(TILED_MULTIPLAYER_MAP_KEY)) {
      this.cache.tilemap.add(TILED_MULTIPLAYER_MAP_KEY, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: TILED_MULTIPLAYER_MAP_DATA,
      });
    }
  }

  create(): void {
    generatePlaceholderTextures(this);
    AudioManager.playBgm(this, BGM.phase5, 0.3);
    this.cameras.main.setBackgroundColor(TILED_MULTIPLAYER_BACKGROUND);
    this.cameras.main.setScroll(0, 0);
    this.lobbyObjects = [];
    this.player = undefined;
    this.runtime = undefined;
    this.opponentSprite = undefined;
    this.scanOverlay = undefined;
    this.statusText = undefined;
    this.peersText = undefined;
    this.timerText = undefined;
    this.creditsText = undefined;
    this.opponentText = undefined;
    this.countdownText = undefined;
    this.notificationText = undefined;
    this.input$ = new InputManager(this);
    this.resetSessionState();
    this.createLobby();
    void this.startMesh();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.meshStartId += 1;
      this.clearStartHandshakeTimer();
      this.runtime?.destroy();
      this.mesh?.stop();
      this.mesh = undefined;
    });
  }

  update(time: number, delta: number): void {
    if (this.input$.isCancelJustDown()) {
      this.backToMenu();
      this.input$.postUpdate();
      return;
    }

    if (this.phase === "lobby" && this.mesh && time - this.lastHeartbeatAt >= 1000) {
      this.sendReady();
      this.lastHeartbeatAt = time;
    }

    if (this.phase === "countdown") this.updateCountdown();

    if (this.phase === "racing") {
      this.checkFinishDeadline();
      if (this.phase === "racing" && !this.localResult && !this.localDnf && !this.respawning) {
        this.player?.update(delta);
        if (this.player && this.runtime) this.runtime.update(this.player);
      }
      if (this.phase === "racing") {
        this.updateCamera();
        this.updateRaceHud();
      }
    }

    if ((this.phase === "countdown" || this.phase === "racing") && time - this.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
      this.sendSnapshot();
      this.lastSnapshotAt = time;
    }
    this.updateOpponent(delta);
    this.input$.postUpdate();
  }

  private resetSessionState(): void {
    this.localPeerId = createPeerId();
    this.roomId = roomFromUrl();
    this.opponentPeerId = undefined;
    this.remoteReady = false;
    this.preparedRaceId = undefined;
    this.clearStartHandshakeTimer();
    this.nextStartAttemptAt = 0;
    this.phase = "lobby";
    this.raceStartAt = 0;
    this.finishDeadlineAt = undefined;
    this.localResult = undefined;
    this.remoteResult = undefined;
    this.localDnf = false;
    this.remoteDnf = false;
    this.collectedCredits.clear();
    this.checkpoint = { ...TILED_MULTIPLAYER_SPAWN };
    this.raceSpawn = { ...TILED_MULTIPLAYER_SPAWN };
    this.raceLength = TILED_MULTIPLAYER_LENGTH;
    this.raceEndX = TILED_MULTIPLAYER_END_X;
    this.checkpointReached = false;
    this.respawning = false;
    this.returning = false;
    this.snapshotSequence = 0;
    this.lastRemoteSequence = -1;
    this.lastRemoteSentAt = 0;
    this.lastRemoteCredits = 0;
    this.remoteCheckpointReached = false;
    this.remoteTarget = undefined;
    this.remoteClockOffsetMs = undefined;
  }

  private createLobby(): void {
    this.addLobbyObject(
      this.add
        .text(SCREEN_WIDTH / 2, 82, "CORRIDA WEBRTC", textStyle("#7CFCEA", "42px"))
        .setOrigin(0.5)
    );
    this.addLobbyObject(
      this.add
        .text(
          SCREEN_WIDTH / 2,
          145,
          `SALA  ${this.roomId}\nVOCE  ${this.localPeerId}`,
          { ...textStyle("#8892b0", "18px"), align: "center" }
        )
        .setOrigin(0.5)
    );

    this.statusText = this.add
      .text(SCREEN_WIDTH / 2, 245, "Conectando ao servidor de sinalizacao...", textStyle("#FFD37C", "22px"))
      .setOrigin(0.5);
    this.peersText = this.add
      .text(SCREEN_WIDTH / 2, 305, "Aguardando oponente", textStyle("#e8ecff", "26px"))
      .setOrigin(0.5);
    this.addLobbyObject(this.statusText);
    this.addLobbyObject(this.peersText);

    const copyButton = this.add
      .text(SCREEN_WIDTH / 2, 400, "[ COPIAR CONVITE PARA O OPONENTE ]", {
        ...textStyle("#7CFCEA", "20px"),
        backgroundColor: "#102824",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => void this.copyInviteLink());
    copyButton.on("pointerover", () => copyButton.setColor("#FFD37C"));
    copyButton.on("pointerout", () => copyButton.setColor("#7CFCEA"));
    this.addLobbyObject(copyButton);

    this.addLobbyObject(
      this.add
        .text(
          SCREEN_WIDTH / 2,
          505,
          "2 jogadores • 20 creditos • 1 checkpoint • limite final de 20 s\n" +
            "Tempo ajustado = tempo bruto - 0,5 s por credito",
          { ...textStyle("#8892b0", "16px"), align: "center" }
        )
        .setOrigin(0.5)
    );
    this.addLobbyObject(
      this.add
        .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, "ESC / B / SELECT para voltar", textStyle("#565f80", "14px"))
        .setOrigin(0.5)
    );
  }

  private addLobbyObject<T extends { setVisible(value: boolean): unknown }>(object: T): T {
    this.lobbyObjects.push(object);
    return object;
  }

  private async startMesh(): Promise<void> {
    const startId = ++this.meshStartId;
    if (!("RTCPeerConnection" in window) || !("WebSocket" in window)) {
      this.statusText?.setText("Este navegador nao oferece WebRTC.").setColor("#ff8a8a");
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
      this.mesh.addEventListener("peerconnected", (event) => {
        const { peerId, recovered } = (event as CustomEvent<{ peerId: string; recovered: boolean }>).detail;
        this.handlePeerConnected(peerId, recovered);
      });
      this.mesh.addEventListener("peerreconnecting", (event) => {
        const { peerId } = (event as CustomEvent<{ peerId: string }>).detail;
        this.handlePeerReconnecting(peerId);
      });
      this.mesh.addEventListener("peerdisconnected", (event) => {
        const { peerId } = (event as CustomEvent<{ peerId: string }>).detail;
        this.handlePeerDisconnected(peerId);
      });
      this.mesh.addEventListener("signalingstate", (event) => {
        const { state } = (event as CustomEvent<{ state: SignalingState }>).detail;
        this.updateSignalingStatus(state);
      });
      this.mesh.addEventListener("message", (event) => {
        const detail = (event as CustomEvent<{ peerId: string; message: MultiplayerMessage }>).detail;
        this.handleNetworkMessage(detail.peerId, detail.message);
      });
      this.mesh.addEventListener("mesherror", (event) => {
        console.error("Falha no mesh WebRTC", (event as CustomEvent<unknown>).detail);
        if (this.phase === "lobby") {
          this.statusText?.setText("Falha ao negociar a conexao WebRTC.").setColor("#ff8a8a");
        }
      });
      this.mesh.addEventListener("protocolerror", (event) => {
        const detail = (event as CustomEvent<{ peerId: string; reason: string }>).detail;
        console.warn(`Pacote multiplayer rejeitado de ${detail.peerId}: ${detail.reason}`);
      });
      this.mesh.start();
    } catch (error) {
      console.error("Falha ao abrir a sinalizacao WebRTC", error);
      this.mesh = undefined;
      this.statusText?.setText("Nao foi possivel abrir a sinalizacao.").setColor("#ff8a8a");
    }
  }

  private handlePeerConnected(peerId: string, recovered: boolean): void {
    if (this.opponentPeerId && this.opponentPeerId !== peerId) return;
    this.opponentPeerId = peerId;
    if (recovered && this.phase !== "lobby") {
      this.flashRaceMessage("CONEXAO WEBRTC RECUPERADA");
      this.resendRaceState();
      return;
    }
    this.peersText?.setText(`Oponente conectado: ${peerId}`);
    this.statusText?.setText("Sincronizando largada...").setColor("#7CFCEA");
    this.sendReady();
  }

  private handlePeerReconnecting(peerId: string): void {
    if (peerId !== this.opponentPeerId) return;
    if (this.phase === "lobby") {
      this.statusText?.setText("Recuperando conexao WebRTC...").setColor("#FFD37C");
    } else if (this.phase !== "finished") {
      this.flashRaceMessage("CONEXAO INSTAVEL — RECONECTANDO (10 S)");
    }
  }

  private handlePeerDisconnected(peerId: string): void {
    if (peerId !== this.opponentPeerId) return;
    if (this.phase === "countdown" || this.phase === "racing") {
      this.showDisconnectVictory();
      return;
    }
    if (this.phase === "lobby") {
      this.clearStartHandshakeTimer();
      this.preparedRaceId = undefined;
      this.opponentPeerId = undefined;
      this.remoteReady = false;
      this.peersText?.setText("Aguardando oponente");
      this.statusText?.setText("Oponente desconectou. Convide novamente.").setColor("#FFD37C");
    }
  }

  private handleNetworkMessage(peerId: string, message: MultiplayerMessage): void {
    if (this.opponentPeerId && peerId !== this.opponentPeerId) return;
    this.opponentPeerId = peerId;

    switch (message.type) {
      case "peer-state":
        if (!this.isRemoteTimestampCurrent(message.sentAt)) return;
        this.updateRemoteClock(message.sentAt);
        this.remoteReady = message.ready;
        this.tryScheduleRace();
        break;
      case "race-prepare":
        if (this.isRemoteTimestampCurrent(message.sentAt)) {
          this.updateRemoteClock(message.sentAt);
          this.handleRacePrepare(peerId, message.raceId);
        }
        break;
      case "race-ready":
        if (this.isRemoteTimestampCurrent(message.sentAt)) {
          this.updateRemoteClock(message.sentAt);
          this.handleRaceReady(peerId, message.raceId);
        }
        break;
      case "race-start":
        this.handleRaceStart(peerId, message.raceId, message.startAt);
        break;
      case "player-snapshot":
        if (this.isSnapshotConsistent(message)) {
          this.updateRemoteClock(message.sentAt);
          this.applyRemoteSnapshot(message);
        }
        break;
      case "race-finish":
        if (this.isRaceMessageCurrent(message.raceId)) this.handleRemoteFinish(message);
        break;
      case "race-dnf":
        if (!this.isRaceMessageCurrent(message.raceId)) return;
        this.remoteDnf = true;
        this.showResults();
        break;
    }
  }

  private sendReady(): void {
    this.mesh?.broadcast({
      type: "peer-state",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      ready: true,
      sentAt: Date.now(),
    });
    this.tryScheduleRace();
  }

  private tryScheduleRace(): void {
    if (
      this.phase !== "lobby" ||
      !this.opponentPeerId ||
      !this.remoteReady ||
      this.preparedRaceId ||
      Date.now() < this.nextStartAttemptAt ||
      this.localPeerId.localeCompare(this.opponentPeerId) >= 0
    ) {
      return;
    }
    const raceId = randomToken(12);
    this.preparedRaceId = raceId;
    this.statusText?.setText("Aguardando confirmacao do oponente...").setColor("#FFD37C");
    this.mesh?.broadcast({
      type: "race-prepare",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId,
      sentAt: Date.now(),
    });
    this.armStartHandshakeTimeout(raceId);
  }

  private handleRacePrepare(peerId: string, raceId: string): void {
    if (
      this.phase !== "lobby" ||
      !this.remoteReady ||
      peerId !== this.opponentPeerId ||
      peerId.localeCompare(this.localPeerId) >= 0
    ) {
      return;
    }
    this.preparedRaceId = raceId;
    this.statusText?.setText("Pronto. Aguardando confirmacao da largada...").setColor("#7CFCEA");
    this.mesh?.broadcast({
      type: "race-ready",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId,
      sentAt: Date.now(),
    });
    this.armStartHandshakeTimeout(raceId);
  }

  private handleRaceReady(peerId: string, raceId: string): void {
    if (
      this.phase !== "lobby" ||
      raceId !== this.preparedRaceId ||
      peerId !== this.opponentPeerId ||
      this.localPeerId.localeCompare(peerId) >= 0
    ) {
      return;
    }
    this.clearStartHandshakeTimer();
    const startAt = Date.now() + START_COUNTDOWN_MS;
    this.mesh?.broadcast({
      type: "race-start",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId,
      startAt,
    });
    this.scheduleRace(raceId, startAt);
  }

  private handleRaceStart(peerId: string, raceId: string, remoteStartAt: number): void {
    if (
      this.phase !== "lobby" ||
      raceId !== this.preparedRaceId ||
      peerId !== this.opponentPeerId ||
      peerId.localeCompare(this.localPeerId) >= 0
    ) {
      return;
    }
    const localStartAt = remoteStartAt + (this.remoteClockOffsetMs ?? 0);
    const leadTime = localStartAt - Date.now();
    if (leadTime < START_MIN_LEAD_MS || leadTime > START_MAX_LEAD_MS) {
      this.failStartHandshake("Largada rejeitada por horario inconsistente.");
      return;
    }
    this.clearStartHandshakeTimer();
    this.scheduleRace(raceId, localStartAt);
  }

  private armStartHandshakeTimeout(raceId: string): void {
    this.clearStartHandshakeTimer();
    this.startHandshakeTimer = this.time.delayedCall(START_HANDSHAKE_TIMEOUT_MS, () => {
      if (this.phase === "lobby" && this.preparedRaceId === raceId) {
        this.failStartHandshake("Oponente nao confirmou a largada. Tentando novamente...");
      }
    });
  }

  private clearStartHandshakeTimer(): void {
    this.startHandshakeTimer?.remove(false);
    this.startHandshakeTimer = undefined;
  }

  private failStartHandshake(message: string): void {
    this.clearStartHandshakeTimer();
    this.preparedRaceId = undefined;
    this.remoteReady = false;
    this.nextStartAttemptAt = Date.now() + 2_000;
    this.statusText?.setText(message).setColor("#FFD37C");
  }

  private scheduleRace(raceId: string, startAt: number): void {
    if (this.phase !== "lobby") return;
    this.preparedRaceId = raceId;
    this.phase = "countdown";
    this.raceStartAt = startAt;
    this.createRaceWorld();
    this.updateCountdown();
  }

  private createRaceWorld(): void {
    this.lobbyObjects.forEach((object) => object.setVisible(false));
    this.physics.world.gravity.y = GRAVITY_Y;
    this.runtime = new TiledPhase5Runtime(
      this,
      new Set(),
      {
        onCreditCollected: (id) => this.handleCreditCollected(id),
        onCheckpoint: (_id, x, y) => this.handleCheckpoint(x, y),
        onEndGate: () => this.handleLocalFinish(),
      },
      {
        mapKey: TILED_MULTIPLAYER_MAP_KEY,
        tilesets: TILED_MULTIPLAYER_TILESETS,
        offsetY: TILED_MULTIPLAYER_OFFSET_Y,
        creditValue: 1,
        contextLabel: TILED_MULTIPLAYER_NAME,
        timeSource: () => Math.max(0, Date.now() - this.raceStartAt),
        endLabel: "LINHA DE CHEGADA",
      },
    );
    this.raceSpawn = { ...this.runtime.spawn };
    this.checkpoint = { ...this.runtime.spawn };
    this.raceLength = this.runtime.lengthPx;
    this.raceEndX = this.runtime.endGateX;
    this.physics.world.setBounds(0, 0, this.raceLength + SCREEN_WIDTH, SCREEN_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.raceLength + SCREEN_WIDTH, SCREEN_HEIGHT);

    this.player = new Player(
      this,
      this.raceSpawn.x,
      this.raceSpawn.y,
      ALL_ABILITIES,
      this.input$,
      {
        onDeath: () => this.handlePlayerDeath(),
        onScanPulse: (active) => this.handleScanPulse(active),
      }
    );
    this.player.sprite.setDepth(20);
    this.runtime.registerPhysics(this.player);

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.player.sprite.setVelocity(0, 0);

    this.opponentSprite = this.add
      .sprite(this.raceSpawn.x, this.raceSpawn.y, ALEX_DASH_TEXTURE_KEY)
      .setOrigin(0.5, 1)
      .setTint(0xff67d4)
      .setAlpha(0.68)
      .setDepth(20);
    this.opponentSprite.anims.play(alexRunAnimationKey(ALEX_DASH_TEXTURE_KEY), true);

    this.createRaceHud();
  }

  private createRaceHud(): void {
    this.add
      .rectangle(0, 0, SCREEN_WIDTH, 82, 0x05050a, 0.88)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.timerText = this.add
      .text(SCREEN_WIDTH / 2, 18, "00:00.000", textStyle("#FFD37C", "28px"))
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.creditsText = this.add
      .text(24, 18, `CREDITOS 0/${TILED_MULTIPLAYER_CREDIT_COUNT}`, textStyle("#7CFCEA", "18px"))
      .setScrollFactor(0)
      .setDepth(1001);
    this.opponentText = this.add
      .text(SCREEN_WIDTH - 24, 18, "OPONENTE 0%", textStyle("#ff67d4", "18px"))
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.countdownText = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "", textStyle("#FFD37C", "72px"))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1200);
    this.notificationText = this.add
      .text(SCREEN_WIDTH / 2, 105, "", {
        ...textStyle("#7CFCEA", "20px"),
        backgroundColor: "#05050acc",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100)
      .setVisible(false);
    this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 18,
        "PULO W/ESPACO  •  SLIDE S  •  ATAQUE J  •  SCAN E/L  •  DASH K/SHIFT",
        textStyle("#8892b0", "13px")
      )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(1001);
  }

  private updateCountdown(): void {
    const remaining = this.raceStartAt - Date.now();
    if (remaining > 0) {
      this.countdownText?.setText(String(Math.max(1, Math.ceil(remaining / 1000))));
      return;
    }

    this.phase = "racing";
    this.countdownText?.setText("CORRA!");
    this.time.delayedCall(650, () => this.countdownText?.setVisible(false));
    if (this.player) {
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      this.player.respawn(this.raceSpawn.x, this.raceSpawn.y);
    }
  }

  private handleCreditCollected(id: string): void {
    if (this.collectedCredits.has(id)) return;
    this.collectedCredits.add(id);
    this.creditsText?.setText(`CREDITOS ${this.collectedCredits.size}/${TILED_MULTIPLAYER_CREDIT_COUNT}`);
  }

  private handleCheckpoint(x: number, y: number): void {
    this.checkpoint = { x, y };
    this.checkpointReached = true;
    this.flashRaceMessage("CHECKPOINT CENTRAL ATIVADO");
  }

  private handlePlayerDeath(): void {
    if (this.phase !== "racing" || this.respawning || this.localResult || this.localDnf) return;
    this.respawning = true;
    this.handleScanPulse(false);
    this.cameras.main.shake(160, 0.01);
    this.flashRaceMessage("FALHA — CRONOMETRO CONTINUA");
    this.time.delayedCall(700, () => {
      if (this.phase !== "racing" || this.localResult || this.localDnf || !this.player) return;
      this.runtime?.resetMutableObstacles();
      this.player.respawn(this.checkpoint.x, this.checkpoint.y);
      this.respawning = false;
    });
  }

  private handleScanPulse(active: boolean): void {
    if (active) {
      if (!this.scanOverlay) {
        this.scanOverlay = this.add
          .rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x36e2ff, 0.1)
          .setOrigin(0)
          .setScrollFactor(0)
          .setDepth(900);
      }
      this.scanOverlay.setVisible(true);
      this.runtime?.setScanActive(true);
    } else {
      this.scanOverlay?.setVisible(false);
      this.runtime?.setScanActive(false);
    }
  }

  private handleLocalFinish(): void {
    if (this.phase !== "racing" || this.localResult || this.localDnf) return;
    const rawTimeMs = Math.max(0, Date.now() - this.raceStartAt);
    if (this.remoteResult && rawTimeMs > this.remoteResult.rawTimeMs + SECOND_PLAYER_LIMIT_MS) {
      this.localDnf = true;
      this.broadcastDnf();
      this.showResults();
      return;
    }
    this.localResult = { rawTimeMs, credits: this.collectedCredits.size };
    this.player?.sprite.setVelocity(0, 0);
    if (this.player?.sprite.body) this.player.sprite.body.enable = false;

    this.finishDeadlineAt ??= Date.now() + SECOND_PLAYER_LIMIT_MS;
    this.mesh?.broadcast({
      type: "race-finish",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId: this.preparedRaceId!,
      rawTimeMs,
      credits: this.collectedCredits.size,
      deadlineAt: this.finishDeadlineAt,
    });

    if (this.remoteResult || this.remoteDnf) this.showResults();
    else this.flashRaceMessage("VOCE TERMINOU — 20 S PARA O OPONENTE");
  }

  private handleRemoteFinish(message: RaceFinishMessage): void {
    if (this.phase !== "racing" && this.phase !== "countdown") return;
    if (this.remoteResult || this.remoteDnf) return;
    const convertedDeadline = message.deadlineAt + (this.remoteClockOffsetMs ?? 0);
    const expectedDeadline =
      this.finishDeadlineAt ?? this.raceStartAt + message.rawTimeMs + SECOND_PLAYER_LIMIT_MS;
    const elapsedNow = Math.max(0, Date.now() - this.raceStartAt);
    if (
      message.credits > TILED_MULTIPLAYER_CREDIT_COUNT ||
      message.credits < this.lastRemoteCredits ||
      message.rawTimeMs < MIN_PLAUSIBLE_RACE_TIME_MS ||
      message.rawTimeMs > MAX_RACE_DURATION_MS ||
      message.rawTimeMs > elapsedNow + FINISH_CONSISTENCY_TOLERANCE_MS ||
      Math.abs(convertedDeadline - expectedDeadline) > FINISH_CONSISTENCY_TOLERANCE_MS ||
      (this.remoteTarget !== undefined && this.remoteTarget.x < this.raceEndX - SCREEN_WIDTH * 2)
    ) {
      console.warn("race-finish rejeitado por valores inconsistentes", message);
      return;
    }
    if (this.localResult && message.rawTimeMs > this.localResult.rawTimeMs + SECOND_PLAYER_LIMIT_MS) {
      this.remoteDnf = true;
      this.showResults();
      return;
    }
    this.remoteResult = {
      rawTimeMs: Math.max(0, message.rawTimeMs),
      credits: Phaser.Math.Clamp(Math.floor(message.credits), 0, TILED_MULTIPLAYER_CREDIT_COUNT),
    };
    this.finishDeadlineAt ??= convertedDeadline;
    if (this.localResult || this.localDnf) this.showResults();
    else this.flashRaceMessage("OPONENTE TERMINOU — VOCE TEM 20 S");
  }

  private checkFinishDeadline(): void {
    if (!this.finishDeadlineAt || Date.now() < this.finishDeadlineAt || this.phase !== "racing") return;
    if (!this.localResult && !this.localDnf) {
      this.localDnf = true;
      this.player?.sprite.setVelocity(0, 0);
      if (this.player?.sprite.body) this.player.sprite.body.enable = false;
      this.broadcastDnf();
    } else if (this.localResult && !this.remoteResult) {
      if (Date.now() < this.finishDeadlineAt + RESULT_NETWORK_GRACE_MS) return;
      this.remoteDnf = true;
    }
    this.showResults();
  }

  private showResults(): void {
    if (this.phase === "finished") return;
    this.phase = "finished";
    this.player?.sprite.setVelocity(0, 0);
    if (this.player?.sprite.body) this.player.sprite.body.enable = false;

    const verdict = this.calculateVerdict();
    const localLine = this.formatResultLine("VOCE", this.localResult, this.localDnf);
    const remoteLine = this.formatResultLine("OPONENTE", this.remoteResult, this.remoteDnf);
    this.showResultOverlay(`${verdict}\n\n${localLine}\n${remoteLine}`);
  }

  private calculateVerdict(): string {
    if (this.localDnf) return "DERROTA — DNF";
    if (this.remoteDnf) return "VITORIA — OPONENTE DNF";
    if (!this.localResult || !this.remoteResult) return "RESULTADO INCOMPLETO";

    const localAdjusted = adjustedTime(this.localResult);
    const remoteAdjusted = adjustedTime(this.remoteResult);
    if (localAdjusted !== remoteAdjusted) return localAdjusted < remoteAdjusted ? "VITORIA" : "DERROTA";
    if (this.localResult.credits !== this.remoteResult.credits) {
      return this.localResult.credits > this.remoteResult.credits ? "VITORIA" : "DERROTA";
    }
    if (this.localResult.rawTimeMs !== this.remoteResult.rawTimeMs) {
      return this.localResult.rawTimeMs < this.remoteResult.rawTimeMs ? "VITORIA" : "DERROTA";
    }
    return "EMPATE";
  }

  private formatResultLine(label: string, result: RaceResult | undefined, dnf: boolean): string {
    if (dnf || !result) return `${label}: DNF`;
    return `${label}: ${formatTime(result.rawTimeMs)} bruto | ${result.credits} cr | ${formatTime(adjustedTime(result))} ajustado`;
  }

  private showDisconnectVictory(): void {
    if (this.phase === "finished") return;
    this.phase = "finished";
    this.player?.sprite.setVelocity(0, 0);
    if (this.player?.sprite.body) this.player.sprite.body.enable = false;
    this.showResultOverlay("VITORIA\n\nO oponente desconectou durante a corrida.");
  }

  private showResultOverlay(content: string): void {
    this.countdownText?.setVisible(false);
    this.add
      .rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 880, 360, 0x05050a, 0.96)
      .setStrokeStyle(3, 0x7cfcea)
      .setScrollFactor(0)
      .setDepth(2000);
    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30, `${content}\n\nESC / B para voltar ao menu`, {
        ...textStyle("#e8ecff", "22px"),
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);
  }

  private sendSnapshot(): void {
    if (!this.player || !this.preparedRaceId) return;
    const body = this.player.sprite.body!;
    this.mesh?.broadcast({
      type: "player-snapshot",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId: this.preparedRaceId,
      sequence: this.snapshotSequence,
      sentAt: Date.now(),
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      state: this.player.getState(),
      credits: this.collectedCredits.size,
      checkpointReached: this.checkpointReached,
      finished: this.localResult !== undefined,
    });
    this.snapshotSequence += 1;
  }

  private applyRemoteSnapshot(snapshot: PlayerSnapshotMessage): void {
    this.lastRemoteSequence = snapshot.sequence;
    this.lastRemoteSentAt = snapshot.sentAt;
    this.lastRemoteCredits = snapshot.credits;
    this.remoteCheckpointReached ||= snapshot.checkpointReached;
    this.remoteTarget = {
      x: Phaser.Math.Clamp(snapshot.x, 0, this.raceLength),
      y: Phaser.Math.Clamp(snapshot.y, -500, SCREEN_HEIGHT + 500),
      state: snapshot.state,
      credits: Phaser.Math.Clamp(Math.floor(snapshot.credits), 0, TILED_MULTIPLAYER_CREDIT_COUNT),
    };
  }

  private isSnapshotConsistent(snapshot: PlayerSnapshotMessage): boolean {
    if (!this.isRaceMessageCurrent(snapshot.raceId)) return false;
    if (this.phase !== "countdown" && this.phase !== "racing") return false;
    if (snapshot.sequence <= this.lastRemoteSequence || snapshot.sentAt < this.lastRemoteSentAt) return false;
    if (!this.isRemoteTimestampCurrent(snapshot.sentAt)) return false;
    if (snapshot.x < -64 || snapshot.x > this.raceLength + SCREEN_WIDTH) return false;
    if (snapshot.y < -500 || snapshot.y > SCREEN_HEIGHT + 500) return false;
    if (snapshot.credits > TILED_MULTIPLAYER_CREDIT_COUNT || snapshot.credits < this.lastRemoteCredits) return false;
    if (this.remoteCheckpointReached && !snapshot.checkpointReached) return false;
    if (snapshot.finished && !this.remoteResult) return false;
    return true;
  }

  private isRaceMessageCurrent(raceId: string): boolean {
    return this.preparedRaceId !== undefined && raceId === this.preparedRaceId;
  }

  private broadcastDnf(): void {
    if (!this.preparedRaceId) return;
    this.mesh?.broadcast({
      type: "race-dnf",
      protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
      raceId: this.preparedRaceId,
    });
  }

  private resendRaceState(): void {
    if (!this.preparedRaceId) return;
    if (this.phase === "countdown" || this.phase === "racing") {
      this.mesh?.broadcast({
        type: "race-start",
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        raceId: this.preparedRaceId,
        startAt: this.raceStartAt,
      });
      this.sendSnapshot();
    }
    if (this.localResult && this.finishDeadlineAt) {
      this.mesh?.broadcast({
        type: "race-finish",
        protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
        raceId: this.preparedRaceId,
        rawTimeMs: this.localResult.rawTimeMs,
        credits: this.localResult.credits,
        deadlineAt: this.finishDeadlineAt,
      });
    } else if (this.localDnf) {
      this.broadcastDnf();
    }
  }

  private updateRemoteClock(remoteSentAt: number): void {
    const candidate = Date.now() - remoteSentAt;
    // O menor valor observado reduz a parcela de latencia de rede da estimativa.
    this.remoteClockOffsetMs =
      this.remoteClockOffsetMs === undefined ? candidate : Math.min(this.remoteClockOffsetMs, candidate);
  }

  private isRemoteTimestampCurrent(remoteTimestamp: number): boolean {
    if (this.remoteClockOffsetMs === undefined) return true;
    return Math.abs(remoteTimestamp + this.remoteClockOffsetMs - Date.now()) <= 5_000;
  }

  private updateOpponent(delta: number): void {
    if (!this.opponentSprite || !this.remoteTarget) return;
    const interpolation = Math.min(1, delta / 80);
    this.opponentSprite.x = Phaser.Math.Linear(this.opponentSprite.x, this.remoteTarget.x, interpolation);
    this.opponentSprite.y = Phaser.Math.Linear(this.opponentSprite.y, this.remoteTarget.y, interpolation);
    this.opponentSprite.setAlpha(this.remoteTarget.state === "dead" ? 0.25 : 0.68);
    if (this.remoteTarget.state === "sliding") {
      this.opponentSprite.anims.play(alexSlideAnimationKey(ALEX_DASH_TEXTURE_KEY), true);
    } else {
      this.opponentSprite.anims.play(alexRunAnimationKey(ALEX_DASH_TEXTURE_KEY), true);
    }
  }

  private updateCamera(): void {
    if (!this.player) return;
    this.cameras.main.scrollX = Math.floor(
      Phaser.Math.Clamp(
        this.player.sprite.x - SCREEN_WIDTH * CAMERA.playerScreenRatioX,
        0,
        Math.max(0, this.raceLength - SCREEN_WIDTH)
      )
    );
  }

  private updateRaceHud(): void {
    const elapsed = this.localResult?.rawTimeMs ?? Math.max(0, Date.now() - this.raceStartAt);
    const deadlineSuffix =
      this.finishDeadlineAt && !(this.localResult && this.remoteResult)
        ? `  |  LIMITE ${Math.max(0, Math.ceil((this.finishDeadlineAt - Date.now()) / 1000))}s`
        : "";
    this.timerText?.setText(`${formatTime(elapsed)}${deadlineSuffix}`);
    const remoteProgress = this.remoteTarget
      ? Phaser.Math.Clamp(Math.floor((this.remoteTarget.x / this.raceEndX) * 100), 0, 100)
      : 0;
    const remoteCredits = this.remoteTarget?.credits ?? 0;
    this.opponentText?.setText(`OPONENTE ${remoteProgress}% | ${remoteCredits} cr`);
  }

  private flashRaceMessage(message: string): void {
    if (!this.notificationText) return;
    this.notificationText.setText(message).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.notificationText);
    this.tweens.add({
      targets: this.notificationText,
      alpha: 0,
      delay: 1100,
      duration: 350,
      onComplete: () => this.notificationText?.setVisible(false),
    });
  }

  private updateSignalingStatus(state: SignalingState): void {
    if (this.phase !== "lobby" || this.opponentPeerId) return;
    switch (state) {
      case "connecting":
        this.statusText?.setText("Conectando ao servidor de sinalizacao...").setColor("#FFD37C");
        break;
      case "open":
        this.statusText?.setText("Servidor conectado. Aguardando oponente...").setColor("#7CFCEA");
        break;
      case "closed":
        this.statusText?.setText("Sinalizacao desconectada. Reconectando...").setColor("#FFD37C");
        break;
      case "error":
        this.statusText?.setText("Servidor indisponivel. Use npm run dev:multiplayer.").setColor("#ff8a8a");
        break;
    }
  }

  private async copyInviteLink(): Promise<void> {
    if (isLoopbackHost(window.location.hostname)) {
      this.statusText?.setText("Abra o jogo pelo IP da rede local antes de copiar.").setColor("#FFD37C");
      return;
    }
    if (await copyText(window.location.href)) {
      this.statusText?.setText("Convite copiado. Envie ao oponente.").setColor("#7CFCEA");
    } else {
      this.statusText?.setText(`Copie a URL do navegador. Sala: ${this.roomId}`).setColor("#FFD37C");
    }
  }

  private backToMenu(): void {
    if (this.returning) return;
    this.returning = true;
    this.meshStartId += 1;
    this.mesh?.stop();
    this.mesh = undefined;
    this.scene.start("MenuScene");
  }
}

function adjustedTime(result: RaceResult): number {
  return Math.max(0, result.rawTimeMs - Math.min(result.credits * 500, 10_000));
}

function formatTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(safeMilliseconds / 60_000);
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1000);
  const millis = safeMilliseconds % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
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

function roomFromUrl(): string {
  const url = new URL(window.location.href);
  const requestedRoom = url.searchParams.get("room")?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const roomId = requestedRoom || randomToken(8);
  if (!requestedRoom) {
    url.searchParams.set("room", roomId);
    window.history.replaceState(null, "", url);
  }
  return roomId;
}

function createPeerId(): string {
  return `alex-${randomToken(6)}`;
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
    // HTTP na rede local pode bloquear a Clipboard API moderna.
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

import { MqttClient, MqttConnectionState } from "./MqttClient";
import {
  createPlayerId,
  createRoomId,
  decodeRoomMessage,
  encodeRoomMessage,
  roomTopic,
  ROOM_CAPACITY,
  RoomMessage,
} from "./MultiplayerProtocol";

export type RoomRole = "host" | "player";

/**
 * - `idle`: fora de qualquer sala;
 * - `hosting`: sala criada por este jogador (aguardando ou já com o 2º jogador);
 * - `searching`: entrou no tópico e aguarda o host responder (ainda NÃO está dentro);
 * - `joined`: o host respondeu `room_welcome` — jogador realmente dentro da sala;
 * - `not_found` / `full` / `host_left`: motivos pelos quais a tentativa/sala terminou.
 */
export type RoomStatus = "idle" | "hosting" | "searching" | "joined" | "not_found" | "full" | "host_left";

export interface RoomPlayer {
  playerId: string;
  role: RoomRole;
  isSelf: boolean;
}

export interface RoomState {
  roomId?: string;
  playerId: string;
  role?: RoomRole;
  connection: MqttConnectionState;
  status: RoomStatus;
  /** Quem está na sala agora (host primeiro). Vazio fora de uma sala. */
  players: RoomPlayer[];
}

/** Batimento: cada jogador admitido publica `room_presence` neste intervalo. */
const HEARTBEAT_MS = 3000;
/** Sem batimento por este tempo = desconectado (GDD 21.7). */
const PEER_TIMEOUT_MS = 12000;
/** Tempo que um jogador espera o host responder antes de concluir "sala não encontrada". */
const JOIN_TIMEOUT_MS = 5000;

interface Peer {
  role: RoomRole;
  lastSeen: number;
}

export class Room {
  private readonly mqtt: MqttClient;
  private readonly playerId: string;
  private roomId?: string;
  private role?: RoomRole;
  private status: RoomStatus = "idle";
  private readonly peers = new Map<string, Peer>();
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly messageListeners = new Set<(message: RoomMessage) => void>();
  private readonly unsubscribeState: () => void;
  private readonly unsubscribeMessage: () => void;
  private heartbeatTimer?: number;
  private sweepTimer?: number;
  private joinTimer?: number;

  constructor(mqtt: MqttClient, playerId = createPlayerId()) {
    this.mqtt = mqtt;
    this.playerId = playerId;
    this.unsubscribeState = mqtt.onState((state) => this.handleConnectionState(state));
    this.unsubscribeMessage = mqtt.onMessage((message) => this.handleMessage(message.topic, message.payload));
  }

  onState(listener: (state: RoomState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onMessage(listener: (message: RoomMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  get state(): RoomState {
    const players: RoomPlayer[] = [];
    if (this.roomId && this.role) {
      players.push({ playerId: this.playerId, role: this.role, isSelf: true });
      for (const [playerId, peer] of this.peers) {
        players.push({ playerId, role: peer.role, isSelf: false });
      }
      players.sort((a, b) => Number(b.role === "host") - Number(a.role === "host"));
    }
    return {
      roomId: this.roomId,
      playerId: this.playerId,
      role: this.role,
      connection: this.mqtt.state,
      status: this.status,
      players,
    };
  }

  get playerIdValue(): string {
    return this.playerId;
  }

  create(): string {
    const roomId = createRoomId();
    this.join(roomId, "host");
    return roomId;
  }

  join(roomId: string, role: RoomRole = "player"): void {
    const normalized = roomId.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      throw new Error("O código da sala deve ter 6 caracteres.");
    }

    // Trocar de sala NÃO derruba a conexão MQTT: só sai da sala anterior.
    this.leaveCurrentRoom();

    this.roomId = normalized;
    this.role = role;
    this.status = role === "host" ? "hosting" : "searching";

    const alreadyOnline = this.mqtt.state === "online";
    // connect() é idempotente. Se a conexão ainda está subindo, a inscrição
    // entra na fila e o anúncio sai quando o estado virar "online" (depois do
    // SUBACK). Se já está online, anuncia quando o SUBACK desta sala chegar.
    this.mqtt.connect();
    this.mqtt.subscribe(roomTopic(normalized), alreadyOnline ? () => this.announce() : undefined);
    this.emit();
  }

  /** Sai da sala atual e, por padrão, também desconecta do broker. */
  leave(disconnectBroker = true): void {
    this.leaveCurrentRoom();
    if (disconnectBroker) this.mqtt.disconnect();
    this.emit();
  }

  destroy(): void {
    this.unsubscribeState();
    this.unsubscribeMessage();
    this.leaveCurrentRoom();
    this.mqtt.disconnect();
    this.listeners.clear();
    this.messageListeners.clear();
  }

  // ---------------------------------------------------------------- conexão

  private handleConnectionState(connection: MqttConnectionState): void {
    // "online" = conectado E já inscrito na sala → (re)anuncia presença. Cobre
    // tanto a primeira conexão quanto qualquer reconexão automática.
    if (connection === "online" && this.roomId) this.announce();
    else this.emit();
  }

  /** Apresenta-se à sala. Só roda com a inscrição já confirmada pelo broker. */
  private announce(): void {
    const roomId = this.roomId;
    if (!roomId || !this.role) return;

    this.publish({ type: "room_hello", playerId: this.playerId, role: this.role });

    if (this.role === "host") {
      this.startTimers();
    } else if (this.status === "searching") {
      this.clearJoinTimer();
      this.joinTimer = window.setTimeout(() => this.failJoin("not_found"), JOIN_TIMEOUT_MS);
    }
    this.emit();
  }

  // ---------------------------------------------------------------- mensagens

  private handleMessage(topic: string, payload: string): void {
    if (!this.roomId || topic !== roomTopic(this.roomId)) return;
    const message = decodeRoomMessage(payload);
    if (!message || message.playerId === this.playerId) return;

    switch (message.type) {
      case "room_hello":
        this.onHello(message);
        break;
      case "room_welcome":
        if (this.role === "player" && this.status === "searching" && message.targetId === this.playerId) {
          this.onWelcome(message.hostId);
        }
        break;
      case "room_full":
        if (this.status === "searching" && message.targetId === this.playerId) this.failJoin("full");
        break;
      case "room_presence":
        this.touchPeer(message.playerId);
        break;
      case "room_leave":
        this.removePeer(message.playerId);
        break;
    }

    for (const listener of this.messageListeners) listener(message);
  }

  /** Só o host decide quem entra (capacidade de 2 jogadores, GDD 21.1). */
  private onHello(message: Extract<RoomMessage, { type: "room_hello" }>): void {
    if (this.role !== "host") return;

    const known = this.peers.has(message.playerId);
    if (!known && this.peers.size >= ROOM_CAPACITY - 1) {
      this.publish({ type: "room_full", playerId: this.playerId, targetId: message.playerId });
      return;
    }

    this.peers.set(message.playerId, { role: "player", lastSeen: Date.now() });
    this.publish({ type: "room_welcome", playerId: this.playerId, hostId: this.playerId, targetId: message.playerId });
    this.publish({ type: "room_presence", playerId: this.playerId, role: "host" });
    this.emit();
  }

  private onWelcome(hostId: string): void {
    this.clearJoinTimer();
    this.status = "joined";
    this.peers.set(hostId, { role: "host", lastSeen: Date.now() });
    this.startTimers();
    this.publish({ type: "room_presence", playerId: this.playerId, role: "player" });
    this.emit();
  }

  /**
   * Batimento de quem já foi admitido. Presença de desconhecido é ignorada:
   * o host só aceita quem passou pelo `room_hello`, e o jogador só conhece o
   * host (via `room_welcome`) — assim não aparecem jogadores "fantasma".
   */
  private touchPeer(playerId: string): void {
    const peer = this.peers.get(playerId);
    if (peer) peer.lastSeen = Date.now();
  }

  private removePeer(playerId: string): void {
    const peer = this.peers.get(playerId);
    if (!peer) return;
    this.peers.delete(playerId);

    if (peer.role === "host" && this.role === "player") {
      // O host saiu: a sala deixa de existir para quem entrou.
      this.leaveCurrentRoom();
      this.status = "host_left";
    }
    this.emit();
  }

  private failJoin(reason: "not_found" | "full"): void {
    if (this.status !== "searching") return;
    this.leaveCurrentRoom();
    this.status = reason;
    this.emit();
  }

  // ---------------------------------------------------------------- batimento

  private startTimers(): void {
    this.stopTimers();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.role) this.publish({ type: "room_presence", playerId: this.playerId, role: this.role });
    }, HEARTBEAT_MS);

    this.sweepTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [playerId, peer] of [...this.peers]) {
        if (now - peer.lastSeen > PEER_TIMEOUT_MS) this.removePeer(playerId);
      }
    }, 1000);
  }

  private stopTimers(): void {
    if (this.heartbeatTimer !== undefined) window.clearInterval(this.heartbeatTimer);
    if (this.sweepTimer !== undefined) window.clearInterval(this.sweepTimer);
    this.heartbeatTimer = undefined;
    this.sweepTimer = undefined;
    this.clearJoinTimer();
  }

  private clearJoinTimer(): void {
    if (this.joinTimer !== undefined) window.clearTimeout(this.joinTimer);
    this.joinTimer = undefined;
  }

  // ---------------------------------------------------------------- utilidades

  private publish(message: RoomMessage): void {
    if (!this.roomId) return;
    this.mqtt.publish(roomTopic(this.roomId), encodeRoomMessage(message));
  }

  private leaveCurrentRoom(): void {
    if (!this.roomId) return;

    // Só avisa a saída quem chegou a ser admitido na sala.
    if (this.status === "hosting" || this.status === "joined") {
      this.publish({ type: "room_leave", playerId: this.playerId });
    }
    this.mqtt.unsubscribe(roomTopic(this.roomId));

    this.stopTimers();
    this.peers.clear();
    this.roomId = undefined;
    this.role = undefined;
    this.status = "idle";
  }

  private emit(): void {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }
}

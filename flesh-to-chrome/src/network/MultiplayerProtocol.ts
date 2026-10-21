export const MQTT_DEFAULT_URL = "ws://localhost:9001";
export const MQTT_TOPIC_PREFIX = "flesh-to-chrome/rooms";

/** GDD 21.1 — corrida de 2 jogadores. */
export const ROOM_CAPACITY = 2;

export type RoomPlayerRole = "host" | "player";

/**
 * Mensagens do tópico `flesh-to-chrome/rooms/<sala>/room`.
 *
 * Handshake de entrada (quem chega NUNCA se considera "dentro" sem resposta):
 *
 *   jogador ── room_hello ───────────────▶ host
 *   jogador ◀── room_welcome (targetId) ── host      → entrou
 *   jogador ◀── room_full    (targetId) ── host      → sala cheia (2/2)
 *   (sem resposta em alguns segundos)                → sala não existe
 *
 * Depois de admitidos, host e jogador publicam `room_presence` periodicamente
 * (batimento). Quem ficar sem batimento por tempo demais é considerado
 * desconectado (GDD 21.7), mesmo que a aba tenha sido fechada sem avisar.
 */
export type RoomMessage =
  | { type: "room_hello"; playerId: string; role?: RoomPlayerRole }
  | { type: "room_welcome"; playerId: string; hostId: string; targetId?: string }
  | { type: "room_full"; playerId: string; targetId: string }
  | { type: "room_presence"; playerId: string; role: RoomPlayerRole }
  | { type: "room_leave"; playerId: string };

export function roomTopic(roomId: string): string {
  return `${MQTT_TOPIC_PREFIX}/${roomId}/room`;
}

export function createPlayerId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `P-${random}`;
}

/**
 * ID de conexão MQTT. NÃO usa `crypto.randomUUID()`: ele só existe em
 * contexto seguro (HTTPS ou localhost). O segundo jogador abre o jogo por
 * `http://IP-DO-HOST:porta`, que NÃO é contexto seguro — lá `randomUUID` é
 * `undefined`, a cena de multiplayer quebrava ao abrir e ficava tela vazia.
 * `getRandomValues` funciona em qualquer contexto.
 */
export function createClientId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `ftc-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function createRoomId(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return random.padEnd(6, "0").slice(0, 6);
}

export function encodeRoomMessage(message: RoomMessage): string {
  return JSON.stringify(message);
}

const MESSAGE_TYPES = new Set(["room_hello", "room_welcome", "room_full", "room_presence", "room_leave"]);

export function decodeRoomMessage(payload: string): RoomMessage | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return undefined;
    const { type, playerId } = parsed as { type?: unknown; playerId?: unknown };
    if (typeof type !== "string" || !MESSAGE_TYPES.has(type)) return undefined;
    if (typeof playerId !== "string" || playerId.length === 0) return undefined;
    return parsed as RoomMessage;
  } catch {
    return undefined;
  }
}

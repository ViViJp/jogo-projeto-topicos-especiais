export const MULTIPLAYER_PROTOCOL_VERSION = 2 as const;
export const MAX_RACE_DURATION_MS = 30 * 60 * 1000;
export const MAX_PROTOCOL_CREDITS = 100;

const MIN_PROTOCOL_TIMESTAMP = Date.UTC(2020, 0, 1);
const MAX_PROTOCOL_TIMESTAMP = Date.UTC(2100, 0, 1);
const MAX_COORDINATE = 1_000_000;
const MAX_ABSOLUTE_Y = 10_000;
const MAX_ABSOLUTE_VELOCITY = 10_000;
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;

interface RaceScopedMessage {
  protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
  raceId: string;
}

export interface PeerStateMessage {
  type: "peer-state";
  protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
  ready: boolean;
  sentAt: number;
}

export interface RacePrepareMessage extends RaceScopedMessage {
  type: "race-prepare";
  sentAt: number;
}

export interface RaceReadyMessage extends RaceScopedMessage {
  type: "race-ready";
  sentAt: number;
}

export type NetworkPlayerState =
  | "running"
  | "jumping"
  | "sliding"
  | "attacking"
  | "scanning"
  | "dashing"
  | "pressed"
  | "dead";

export interface PlayerSnapshotMessage extends RaceScopedMessage {
  type: "player-snapshot";
  sequence: number;
  sentAt: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  state: NetworkPlayerState;
  credits: number;
  checkpointReached: boolean;
  finished: boolean;
}

export interface RaceStartMessage extends RaceScopedMessage {
  type: "race-start";
  startAt: number;
}

export interface RaceFinishMessage extends RaceScopedMessage {
  type: "race-finish";
  rawTimeMs: number;
  credits: number;
  deadlineAt: number;
}

export interface RaceDnfMessage extends RaceScopedMessage {
  type: "race-dnf";
}

export type MultiplayerMessage =
  | PeerStateMessage
  | RacePrepareMessage
  | RaceReadyMessage
  | PlayerSnapshotMessage
  | RaceStartMessage
  | RaceFinishMessage
  | RaceDnfMessage;

export type WebRtcSignal =
  | { type: "presence"; requestReply: boolean }
  | { type: "offer"; description: RTCSessionDescriptionInit }
  | { type: "answer"; description: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "leave" };

export interface SignalEnvelope {
  roomId: string;
  from: string;
  to?: string;
  signal: WebRtcSignal;
}

/** Valida dados vindos do canal de sinalizacao antes de entrega-los ao WebRTC. */
export function isSignalEnvelope(value: unknown): value is SignalEnvelope {
  if (!isRecord(value) || !isIdentifier(value.roomId) || !isIdentifier(value.from)) return false;
  if (value.to !== undefined && !isIdentifier(value.to)) return false;
  if (!isRecord(value.signal) || typeof value.signal.type !== "string") return false;

  switch (value.signal.type) {
    case "presence":
      return typeof value.signal.requestReply === "boolean";
    case "offer":
      return isSessionDescription(value.signal.description, "offer");
    case "answer":
      return isSessionDescription(value.signal.description, "answer");
    case "ice-candidate":
      return isIceCandidate(value.signal.candidate);
    case "leave":
      return true;
    default:
      return false;
  }
}

/**
 * Validação estrutural e de limites absolutos do protocolo P2P.
 * Regras dependentes da corrida (raceId, mapa, ordem e relógio) ficam na cena.
 */
export function isMultiplayerMessage(value: unknown): value is MultiplayerMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.protocolVersion !== MULTIPLAYER_PROTOCOL_VERSION) return false;

  switch (value.type) {
    case "peer-state":
      return typeof value.ready === "boolean" && isTimestamp(value.sentAt);
    case "race-prepare":
    case "race-ready":
      return hasValidRaceId(value) && isTimestamp(value.sentAt);
    case "player-snapshot":
      return (
        hasValidRaceId(value) &&
        isIntegerInRange(value.sequence, 0, 0x7fffffff) &&
        isTimestamp(value.sentAt) &&
        isNumberInRange(value.x, -1024, MAX_COORDINATE) &&
        isNumberInRange(value.y, -MAX_ABSOLUTE_Y, MAX_ABSOLUTE_Y) &&
        isNumberInRange(value.velocityX, -MAX_ABSOLUTE_VELOCITY, MAX_ABSOLUTE_VELOCITY) &&
        isNumberInRange(value.velocityY, -MAX_ABSOLUTE_VELOCITY, MAX_ABSOLUTE_VELOCITY) &&
        isNetworkPlayerState(value.state) &&
        isIntegerInRange(value.credits, 0, MAX_PROTOCOL_CREDITS) &&
        typeof value.checkpointReached === "boolean" &&
        typeof value.finished === "boolean"
      );
    case "race-start":
      return hasValidRaceId(value) && isTimestamp(value.startAt);
    case "race-finish":
      return (
        hasValidRaceId(value) &&
        isIntegerInRange(value.rawTimeMs, 0, MAX_RACE_DURATION_MS) &&
        isIntegerInRange(value.credits, 0, MAX_PROTOCOL_CREDITS) &&
        isTimestamp(value.deadlineAt)
      );
    case "race-dnf":
      return hasValidRaceId(value);
    default:
      return false;
  }
}

function hasValidRaceId(value: Record<string, unknown>): boolean {
  return isIdentifier(value.raceId);
}

function isSessionDescription(value: unknown, expectedType: "offer" | "answer"): boolean {
  return (
    isRecord(value) &&
    value.type === expectedType &&
    typeof value.sdp === "string" &&
    value.sdp.length > 0 &&
    value.sdp.length <= 64 * 1024
  );
}

function isIceCandidate(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.candidate !== "string" || value.candidate.length > 4096) return false;
  if (value.sdpMid !== undefined && value.sdpMid !== null && typeof value.sdpMid !== "string") return false;
  if (
    value.sdpMLineIndex !== undefined &&
    value.sdpMLineIndex !== null &&
    !isIntegerInRange(value.sdpMLineIndex, 0, 65535)
  ) {
    return false;
  }
  return true;
}

function isNetworkPlayerState(value: unknown): value is NetworkPlayerState {
  return (
    typeof value === "string" &&
    ["running", "jumping", "sliding", "attacking", "scanning", "dashing", "pressed", "dead"].includes(value)
  );
}

function isTimestamp(value: unknown): value is number {
  return isIntegerInRange(value, MIN_PROTOCOL_TIMESTAMP, MAX_PROTOCOL_TIMESTAMP);
}

function isNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

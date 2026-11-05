export interface PeerStateMessage {
  type: "peer-state";
  ready: boolean;
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

export interface PlayerSnapshotMessage {
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

export interface RaceStartMessage {
  type: "race-start";
  startAt: number;
}

export interface RaceFinishMessage {
  type: "race-finish";
  rawTimeMs: number;
  credits: number;
  deadlineAt: number;
}

export interface RaceDnfMessage {
  type: "race-dnf";
}

export type MultiplayerMessage =
  | PeerStateMessage
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
  if (!isRecord(value) || typeof value.roomId !== "string" || typeof value.from !== "string") {
    return false;
  }
  if (value.to !== undefined && typeof value.to !== "string") return false;
  if (!isRecord(value.signal) || typeof value.signal.type !== "string") return false;

  switch (value.signal.type) {
    case "presence":
      return typeof value.signal.requestReply === "boolean";
    case "offer":
    case "answer":
      return isRecord(value.signal.description) && typeof value.signal.description.type === "string";
    case "ice-candidate":
      return isRecord(value.signal.candidate);
    case "leave":
      return true;
    default:
      return false;
  }
}

export function isMultiplayerMessage(value: unknown): value is MultiplayerMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "peer-state":
      return typeof value.ready === "boolean" && isFiniteNumber(value.sentAt);
    case "player-snapshot":
      return (
        isFiniteNumber(value.sequence) &&
        isFiniteNumber(value.sentAt) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        isFiniteNumber(value.velocityX) &&
        isFiniteNumber(value.velocityY) &&
        isNetworkPlayerState(value.state) &&
        isFiniteNumber(value.credits) &&
        typeof value.checkpointReached === "boolean" &&
        typeof value.finished === "boolean"
      );
    case "race-start":
      return isFiniteNumber(value.startAt);
    case "race-finish":
      return (
        isFiniteNumber(value.rawTimeMs) &&
        isFiniteNumber(value.credits) &&
        isFiniteNumber(value.deadlineAt)
      );
    case "race-dnf":
      return true;
    default:
      return false;
  }
}

function isNetworkPlayerState(value: unknown): value is NetworkPlayerState {
  return (
    typeof value === "string" &&
    ["running", "jumping", "sliding", "attacking", "scanning", "dashing", "pressed", "dead"].includes(value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

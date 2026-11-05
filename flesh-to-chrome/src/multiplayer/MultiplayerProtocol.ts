export interface PeerStateMessage {
  type: "peer-state";
  ready: boolean;
  sentAt: number;
}

export type MultiplayerMessage = PeerStateMessage;

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
  return (
    isRecord(value) &&
    value.type === "peer-state" &&
    typeof value.ready === "boolean" &&
    typeof value.sentAt === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

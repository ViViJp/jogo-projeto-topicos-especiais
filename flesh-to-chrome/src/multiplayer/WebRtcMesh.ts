import {
  isMultiplayerMessage,
  MultiplayerMessage,
  SignalEnvelope,
  WebRtcSignal,
} from "./MultiplayerProtocol";
import { SignalingTransport } from "./SignalingTransport";

interface PeerConnectionState {
  connection: RTCPeerConnection;
  controlChannel?: RTCDataChannel;
  stateChannel?: RTCDataChannel;
  pendingCandidates: RTCIceCandidateInit[];
  connected: boolean;
  makingOffer: boolean;
}

export interface WebRtcMeshOptions {
  localPeerId: string;
  roomId: string;
  signaling: SignalingTransport;
  rtcConfiguration?: RTCConfiguration;
}

const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** Um RTCPeerConnection e um DataChannel direto para cada participante. */
export class WebRtcMesh extends EventTarget {
  private readonly peers = new Map<string, PeerConnectionState>();
  private readonly configuration: RTCConfiguration;
  private started = false;

  constructor(private readonly options: WebRtcMeshOptions) {
    super();
    this.configuration = options.rtcConfiguration ?? DEFAULT_RTC_CONFIGURATION;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      this.options.signaling.open(
        (message) => void this.handleSignal(message),
        (state) => this.dispatchEvent(new CustomEvent("signalingstate", { detail: { state } }))
      );
      this.sendSignal({ type: "presence", requestReply: true });
    } catch (error) {
      this.started = false;
      this.options.signaling.close();
      throw error;
    }
  }

  stop(): void {
    if (!this.started) return;
    this.sendSignal({ type: "leave" });
    this.started = false;
    this.peers.forEach((_, peerId) => this.closePeer(peerId));
    this.options.signaling.close();
  }

  broadcast(message: MultiplayerMessage): void {
    const serialized = JSON.stringify(message);
    this.peers.forEach((peer) => {
      const preferredChannel = message.type === "player-snapshot" ? peer.stateChannel : peer.controlChannel;
      const fallbackChannel = message.type === "player-snapshot" ? peer.controlChannel : undefined;
      if (preferredChannel?.readyState === "open" && preferredChannel.bufferedAmount < 64 * 1024) {
        preferredChannel.send(serialized);
      } else if (fallbackChannel?.readyState === "open" && fallbackChannel.bufferedAmount < 64 * 1024) {
        fallbackChannel.send(serialized);
      }
    });
  }

  connectedPeerIds(): string[] {
    return [...this.peers.entries()]
      .filter(([, peer]) => peer.connected)
      .map(([peerId]) => peerId);
  }

  private async handleSignal(envelope: SignalEnvelope): Promise<void> {
    if (
      !this.started ||
      envelope.roomId !== this.options.roomId ||
      envelope.from === this.options.localPeerId ||
      (envelope.to !== undefined && envelope.to !== this.options.localPeerId)
    ) {
      return;
    }

    try {
      const peerId = envelope.from;
      switch (envelope.signal.type) {
        case "presence":
          if (envelope.signal.requestReply) {
            this.sendSignal({ type: "presence", requestReply: false }, peerId);
          }
          this.ensurePeer(peerId);
          // Regra deterministica: somente um lado cria a offer.
          if (this.options.localPeerId.localeCompare(peerId) < 0) await this.createOffer(peerId);
          break;
        case "offer":
          await this.acceptOffer(peerId, envelope.signal.description);
          break;
        case "answer":
          await this.acceptAnswer(peerId, envelope.signal.description);
          break;
        case "ice-candidate":
          await this.acceptCandidate(peerId, envelope.signal.candidate);
          break;
        case "leave":
          this.closePeer(peerId);
          break;
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent("mesherror", { detail: error }));
    }
  }

  private ensurePeer(peerId: string): PeerConnectionState {
    const current = this.peers.get(peerId);
    if (current) return current;

    const connection = new RTCPeerConnection(this.configuration);
    const state: PeerConnectionState = {
      connection,
      pendingCandidates: [],
      connected: false,
      makingOffer: false,
    };
    this.peers.set(peerId, state);

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) this.sendSignal({ type: "ice-candidate", candidate: candidate.toJSON() }, peerId);
    };
    connection.ondatachannel = ({ channel }) => this.configureDataChannel(peerId, state, channel);
    connection.onconnectionstatechange = () => {
      this.dispatchEvent(
        new CustomEvent("peerconnectionstate", {
          detail: { peerId, state: connection.connectionState },
        })
      );
      if (connection.connectionState === "failed" || connection.connectionState === "closed") {
        this.closePeer(peerId);
      }
    };

    return state;
  }

  private async createOffer(peerId: string): Promise<void> {
    const peer = this.ensurePeer(peerId);
    if (peer.makingOffer || peer.connection.signalingState !== "stable") return;

    peer.makingOffer = true;
    try {
      if (!peer.controlChannel) {
        this.configureDataChannel(peerId, peer, peer.connection.createDataChannel("control"));
      }
      if (!peer.stateChannel) {
        this.configureDataChannel(
          peerId,
          peer,
          peer.connection.createDataChannel("game-state", { ordered: false, maxRetransmits: 0 })
        );
      }
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      if (peer.connection.localDescription) {
        this.sendSignal({ type: "offer", description: peer.connection.localDescription.toJSON() }, peerId);
      }
    } finally {
      peer.makingOffer = false;
    }
  }

  private async acceptOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.ensurePeer(peerId);
    await peer.connection.setRemoteDescription(offer);
    await this.flushCandidates(peer);
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    if (peer.connection.localDescription) {
      this.sendSignal({ type: "answer", description: peer.connection.localDescription.toJSON() }, peerId);
    }
  }

  private async acceptAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.ensurePeer(peerId);
    await peer.connection.setRemoteDescription(answer);
    await this.flushCandidates(peer);
  }

  private async acceptCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.ensurePeer(peerId);
    if (!peer.connection.remoteDescription) {
      peer.pendingCandidates.push(candidate);
      return;
    }
    await peer.connection.addIceCandidate(candidate);
  }

  private async flushCandidates(peer: PeerConnectionState): Promise<void> {
    const candidates = peer.pendingCandidates.splice(0);
    for (const candidate of candidates) await peer.connection.addIceCandidate(candidate);
  }

  private configureDataChannel(
    peerId: string,
    peer: PeerConnectionState,
    channel: RTCDataChannel
  ): void {
    const isControlChannel = channel.label === "control";
    if (isControlChannel) peer.controlChannel = channel;
    else peer.stateChannel = channel;
    channel.onopen = () => {
      if (!isControlChannel || peer.connected) return;
      peer.connected = true;
      this.dispatchEvent(new CustomEvent("peerconnected", { detail: { peerId } }));
    };
    channel.onclose = () => {
      if (isControlChannel) this.closePeer(peerId);
      else if (peer.stateChannel === channel) peer.stateChannel = undefined;
    };
    channel.onerror = () => {
      this.dispatchEvent(
        new CustomEvent("mesherror", { detail: new Error(`DataChannel de ${peerId} falhou.`) })
      );
    };
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (typeof data !== "string") return;
      try {
        const message: unknown = JSON.parse(data);
        if (isMultiplayerMessage(message)) {
          this.dispatchEvent(new CustomEvent("message", { detail: { peerId, message } }));
        }
      } catch {
        // Um pacote invalido nao deve derrubar a partida local.
      }
    };
  }

  private closePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.peers.delete(peerId);
    peer.controlChannel?.close();
    peer.stateChannel?.close();
    peer.connection.close();
    if (peer.connected) this.dispatchEvent(new CustomEvent("peerdisconnected", { detail: { peerId } }));
  }

  private sendSignal(signal: WebRtcSignal, to?: string): void {
    if (!this.started) return;
    this.options.signaling.send({
      roomId: this.options.roomId,
      from: this.options.localPeerId,
      to,
      signal,
    });
  }
}

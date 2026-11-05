import { isSignalEnvelope, SignalEnvelope } from "./MultiplayerProtocol";

export interface SignalingTransport {
  open(onMessage: (message: SignalEnvelope) => void): void;
  send(message: SignalEnvelope): void;
  close(): void;
}

/**
 * Sinalizacao de desenvolvimento entre abas da mesma origem.
 *
 * O mesh nao depende deste transporte: em producao ele pode ser trocado por
 * WebSocket sem alterar as conexoes RTCPeerConnection ou o protocolo do jogo.
 */
export class BroadcastChannelSignaling implements SignalingTransport {
  private channel?: BroadcastChannel;

  constructor(private readonly channelName: string) {}

  open(onMessage: (message: SignalEnvelope) => void): void {
    if (this.channel) return;
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isSignalEnvelope(event.data)) onMessage(event.data);
    };
  }

  send(message: SignalEnvelope): void {
    if (!this.channel) throw new Error("Canal de sinalizacao ainda nao foi aberto.");
    this.channel.postMessage(message);
  }

  close(): void {
    this.channel?.close();
    this.channel = undefined;
  }
}

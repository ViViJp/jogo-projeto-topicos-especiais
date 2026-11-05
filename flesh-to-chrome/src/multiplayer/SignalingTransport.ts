import { isSignalEnvelope, SignalEnvelope } from "./MultiplayerProtocol";

export type SignalingState = "connecting" | "open" | "closed" | "error";

export interface SignalingTransport {
  open(
    onMessage: (message: SignalEnvelope) => void,
    onStateChange?: (state: SignalingState) => void
  ): void;
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
  private onStateChange?: (state: SignalingState) => void;

  constructor(private readonly channelName: string) {}

  open(
    onMessage: (message: SignalEnvelope) => void,
    onStateChange?: (state: SignalingState) => void
  ): void {
    if (this.channel) return;
    this.onStateChange = onStateChange;
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isSignalEnvelope(event.data)) onMessage(event.data);
    };
    this.onStateChange?.("open");
  }

  send(message: SignalEnvelope): void {
    if (!this.channel) throw new Error("Canal de sinalizacao ainda nao foi aberto.");
    this.channel.postMessage(message);
  }

  close(): void {
    this.channel?.close();
    this.channel = undefined;
    this.onStateChange?.("closed");
    this.onStateChange = undefined;
  }
}

/** Sinalizacao remota com fila de abertura e reconexao exponencial. */
export class WebSocketSignaling implements SignalingTransport {
  private socket?: WebSocket;
  private onMessage?: (message: SignalEnvelope) => void;
  private onStateChange?: (state: SignalingState) => void;
  private reconnectTimer?: number;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private hasOpened = false;
  private queue: SignalEnvelope[] = [];
  private presence?: SignalEnvelope;

  constructor(private readonly serverUrl: string) {}

  open(
    onMessage: (message: SignalEnvelope) => void,
    onStateChange?: (state: SignalingState) => void
  ): void {
    if (this.socket) return;
    this.onMessage = onMessage;
    this.onStateChange = onStateChange;
    this.manuallyClosed = false;
    this.connect();
  }

  send(message: SignalEnvelope): void {
    if (message.signal.type === "presence" && message.signal.requestReply) this.presence = message;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }

    // Evita crescimento ilimitado caso o servidor fique indisponivel.
    if (this.queue.length >= 256) this.queue.shift();
    this.queue.push(message);
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.queue = [];
    this.socket?.close(1000, "cliente saiu");
    this.socket = undefined;
    this.onStateChange?.("closed");
    this.onMessage = undefined;
    this.onStateChange = undefined;
  }

  private connect(): void {
    this.onStateChange?.("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.serverUrl);
    } catch {
      this.onStateChange?.("error");
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      const isReconnect = this.hasOpened;
      this.hasOpened = true;
      this.reconnectAttempt = 0;
      this.onStateChange?.("open");

      if (isReconnect && this.presence) socket.send(JSON.stringify(this.presence));
      const pending = this.queue.splice(0);
      pending.forEach((message) => socket.send(JSON.stringify(message)));
    };
    socket.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (typeof data !== "string") return;
      try {
        const message: unknown = JSON.parse(data);
        if (isSignalEnvelope(message)) this.onMessage?.(message);
      } catch {
        // O servidor nao e confiado implicitamente; mensagens invalidas sao ignoradas.
      }
    };
    socket.onerror = () => this.onStateChange?.("error");
    socket.onclose = () => {
      if (this.socket === socket) this.socket = undefined;
      if (this.manuallyClosed) return;
      this.onStateChange?.("closed");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || this.reconnectTimer !== undefined) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 10000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }
}

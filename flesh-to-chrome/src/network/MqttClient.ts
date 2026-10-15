import mqtt, { MqttClient as MqttJsClient } from "mqtt";

export type MqttConnectionState = "offline" | "connecting" | "online" | "reconnecting";

export interface MqttMessage {
  topic: string;
  payload: string;
}

export interface MqttClientOptions {
  url: string;
  clientId: string;
  keepAliveSeconds?: number;
  reconnectDelayMs?: number;
}

export type MqttStateListener = (state: MqttConnectionState, detail?: string) => void;
export type MqttMessageListener = (message: MqttMessage) => void;

/**
 * Adaptador MQTT do jogo.
 *
 * O protocolo MQTT/WebSocket é delegado ao MQTT.js (CONNECT, SUBSCRIBE,
 * PUBLISH, PINGREQ/PINGRESP e reconexão automática).
 *
 * Regras que esta classe garante (todas elas eram quebradas antes):
 *
 *  1. **Nunca existe mais de um client MQTT.js vivo por vez.** Antes,
 *     `connect()` só verificava `connected || reconnecting`; durante a
 *     PRIMEIRA tentativa de conexão nenhum dos dois é verdadeiro, então um
 *     segundo clique (ou "criar sala" → "entrar na sala") abria um segundo
 *     client com o MESMO clientId. O Mosquitto responde a isso derrubando o
 *     client antigo ("already connected, closing old connection") e os dois
 *     passam a se derrubar em loop — a conexão "pisca" e some.
 *  2. **clientId único por conexão** (`<base>-<n>`): uma conexão antiga que
 *     ainda está fechando nunca entra em conflito com a nova.
 *  3. **Eventos de clients antigos são ignorados** (`isCurrent`): o `close` de
 *     um client já encerrado não pode mais marcar o novo como "reconectando".
 *  4. **"online" só depois do SUBACK** das salas: antes o estado virava
 *     "online" ANTES de inscrever o tópico, então o `room_hello` saía e a
 *     resposta do host (`room_welcome`) chegava antes da inscrição existir —
 *     o jogador nunca recebia a resposta e ficava "na sala" sem entrar.
 */
export class MqttClient {
  private client?: MqttJsClient;
  private generation = 0;
  private everConnected = false;
  private lastError?: string;
  /** Tópicos desejados (sobrevivem a reconexões). */
  private readonly subscriptions = new Set<string>();
  /** Tópicos já confirmados (SUBACK) NA CONEXÃO ATUAL. */
  private readonly activeTopics = new Set<string>();
  private readonly ackCallbacks = new Map<string, Array<() => void>>();
  private readonly stateListeners = new Set<MqttStateListener>();
  private readonly messageListeners = new Set<MqttMessageListener>();
  private readonly options: Required<MqttClientOptions>;

  public state: MqttConnectionState = "offline";

  constructor(options: MqttClientOptions) {
    this.options = {
      keepAliveSeconds: 30,
      reconnectDelayMs: 1500,
      ...options,
    };
  }

  onState(listener: MqttStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onMessage(listener: MqttMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /** Idempotente: se já há uma conexão (conectada, conectando ou reconectando), não faz nada. */
  connect(): void {
    if (this.client) return;

    this.everConnected = false;
    this.lastError = undefined;
    this.activeTopics.clear();
    this.setState("connecting", `Conectando em ${this.options.url}...`);

    const client = mqtt.connect(this.options.url, {
      clientId: `${this.options.clientId}-${++this.generation}`,
      protocolVersion: 4,
      clean: true,
      keepalive: this.options.keepAliveSeconds,
      reconnectPeriod: this.options.reconnectDelayMs,
      connectTimeout: 5000,
      // A reinscrição é feita aqui (syncSubscriptions) para o estado "online"
      // só ser anunciado depois que ela terminar.
      resubscribe: false,
    });
    this.client = client;
    const isCurrent = () => this.client === client;

    client.on("connect", () => {
      if (!isCurrent()) return;
      this.everConnected = true;
      this.lastError = undefined;
      // Nova sessão (clean: true) = nenhuma inscrição vale mais no broker.
      this.activeTopics.clear();
      this.syncSubscriptions(client, () => {
        if (isCurrent()) this.setState("online");
      });
    });

    client.on("reconnect", () => {
      if (isCurrent()) this.setState("reconnecting", this.reconnectDetail("Tentando reconectar..."));
    });

    client.on("close", () => {
      if (!isCurrent()) return;
      this.activeTopics.clear();
      this.setState("reconnecting", this.reconnectDetail("Conexão com o broker perdida. Tentando reconectar..."));
    });

    client.on("offline", () => {
      if (isCurrent()) this.setState("reconnecting", this.reconnectDetail("Broker offline. Tentando reconectar..."));
    });

    client.on("error", (error: Error) => {
      if (!isCurrent()) return;
      this.lastError = error.message;
      this.setState("reconnecting", this.reconnectDetail(`MQTT: ${error.message}`));
    });

    client.on("message", (topic: string, payload: Uint8Array) => {
      if (!isCurrent()) return;
      const decoded = new TextDecoder().decode(payload);
      for (const listener of this.messageListeners) {
        listener({ topic, payload: decoded });
      }
    });
  }

  disconnect(): void {
    const client = this.client;
    this.client = undefined;
    this.activeTopics.clear();
    this.ackCallbacks.clear();

    if (!client) {
      this.setState("offline");
      return;
    }

    // `isCurrent()` passa a ser falso para este client: nenhum evento tardio
    // dele mexe mais no estado. O listener de erro vazio evita exceção
    // "unhandled error" se o socket falhar enquanto está fechando.
    client.removeAllListeners();
    client.on("error", () => undefined);
    client.end(false);
    this.setState("offline");
  }

  /**
   * Registra a inscrição. Se já estiver online, inscreve na hora e chama
   * `onAck` quando o broker confirmar (SUBACK). Se ainda estiver conectando,
   * a inscrição entra na fila e é feita antes do estado virar "online" —
   * nesse caso `onAck` NÃO é chamado (quem precisa reagir escuta o estado).
   */
  subscribe(topic: string, onAck?: () => void): void {
    this.subscriptions.add(topic);
    const client = this.client;
    if (!client?.connected || this.state !== "online") return;

    if (this.activeTopics.has(topic)) {
      onAck?.();
      return;
    }
    if (onAck) {
      const list = this.ackCallbacks.get(topic) ?? [];
      list.push(onAck);
      this.ackCallbacks.set(topic, list);
    }
    this.syncSubscriptions(client, () => undefined);
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    this.ackCallbacks.delete(topic);
    const wasActive = this.activeTopics.delete(topic);
    if (!wasActive || !this.client?.connected) return;

    this.client.unsubscribe(topic, (error?: Error | null) => {
      if (error) this.setState("online", `Falha ao sair do tópico: ${error.message}`);
    });
  }

  publish(topic: string, payload: string): boolean {
    if (!this.client?.connected) return false;
    this.client.publish(topic, payload, { qos: 0, retain: false });
    return true;
  }

  /**
   * Inscreve tudo o que está em `subscriptions` e ainda não foi confirmado.
   * Repete até não sobrar nada: uma sala pedida enquanto o SUBACK anterior
   * ainda estava a caminho também é inscrita antes de chamar `done`.
   */
  private syncSubscriptions(client: MqttJsClient, done: () => void): void {
    const pending = [...this.subscriptions].filter((topic) => !this.activeTopics.has(topic));
    if (pending.length === 0) {
      done();
      return;
    }

    client.subscribe(pending, { qos: 0 }, (error, granted) => {
      if (this.client !== client) return;
      const refused = granted?.some((g) => g.qos === 128);
      if (error || refused) {
        this.setState("online", `Falha ao entrar no tópico: ${error?.message ?? "broker recusou a inscrição"}`);
        return;
      }
      for (const topic of pending) {
        if (!this.subscriptions.has(topic)) {
          // Saiu da sala enquanto o SUBACK ainda estava a caminho.
          client.unsubscribe(topic);
          continue;
        }
        this.activeTopics.add(topic);
        const callbacks = this.ackCallbacks.get(topic);
        this.ackCallbacks.delete(topic);
        callbacks?.forEach((cb) => cb());
      }
      this.syncSubscriptions(client, done);
    });
  }

  private reconnectDetail(fallback: string): string {
    if (!this.everConnected) {
      const reason = this.lastError ? ` (${this.lastError})` : "";
      return (
        `Não foi possível conectar em ${this.options.url}${reason}. ` +
        "Verifique se o Mosquitto está rodando com o listener websockets (porta 9001)."
      );
    }
    return fallback;
  }

  private setState(state: MqttConnectionState, detail?: string): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state, detail);
  }
}

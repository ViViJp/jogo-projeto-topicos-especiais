import { MQTT_DEFAULT_URL } from "../network/MultiplayerProtocol";

const BROKER_WS_PORT = 9001;
const BROKER_STORAGE_KEY = "ftc:broker";

/**
 * Endereço do broker, em ordem de prioridade:
 *
 *  1. `?broker=ws://IP:9001` na URL do jogo (ou só `IP:9001`);
 *  2. `localStorage["ftc:broker"]` (útil para fixar um IP sem mexer na URL);
 *  3. o MESMO host de onde a página foi aberta, na porta 9001 — assim o
 *     segundo jogador, abrindo `http://IP-DO-HOST:1234` em outro computador,
 *     fala com o broker do host em vez do `localhost` DELE (que não tem
 *     broker nenhum e nunca conecta);
 *  4. `ws://localhost:9001`.
 */
export function resolveBrokerUrl(): string {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("broker");
    if (fromQuery) return fromQuery.includes("://") ? fromQuery : `ws://${fromQuery}`;

    const stored = window.localStorage.getItem(BROKER_STORAGE_KEY);
    if (stored) return stored.includes("://") ? stored : `ws://${stored}`;

    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      return `${scheme}://${host}:${BROKER_WS_PORT}`;
    }
  } catch {
    // localStorage/location indisponíveis (ex.: contexto restrito) — cai no padrão.
  }
  return MQTT_DEFAULT_URL;
}

/** Configuração de desenvolvimento do multiplayer. O broker deve expor MQTT sobre WebSocket. */
export const MULTIPLAYER_CONFIG = {
  get brokerUrl(): string {
    return resolveBrokerUrl();
  },
  keepAliveSeconds: 30,
  reconnectDelayMs: 1500,
};

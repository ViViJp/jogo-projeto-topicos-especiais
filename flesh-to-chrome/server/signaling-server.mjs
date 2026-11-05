import http from "node:http";
import os from "node:os";
import { WebSocket, WebSocketServer } from "ws";

const host = process.env.SIGNALING_HOST || "0.0.0.0";
const port = readPort(process.env.SIGNALING_PORT, 8080);
const gamePort = readPort(process.env.GAME_PORT, 1234);
const maxPeersPerRoom = readPositiveInteger(process.env.MAX_PEERS_PER_ROOM, 2);
const clients = new Map();

const server = http.createServer((request, response) => {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (request.url === "/health") {
    sendJson(response, 200, {
      status: "ok",
      peers: clients.size,
      rooms: new Set([...clients.values()].map((client) => client.roomId).filter(Boolean)).size,
    });
    return;
  }

  if (request.url === "/ice-config") {
    sendJson(response, 200, createIceConfiguration());
    return;
  }

  sendJson(response, 404, { error: "not_found" });
});

const webSocketServer = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

webSocketServer.on("connection", (socket) => {
  const client = { roomId: undefined, peerId: undefined, isAlive: true };
  clients.set(socket, client);

  socket.on("pong", () => {
    client.isAlive = true;
  });
  socket.on("message", (rawData, isBinary) => {
    if (isBinary) {
      socket.close(1003, "somente mensagens de texto");
      return;
    }

    const envelope = parseEnvelope(rawData.toString());
    if (!envelope) {
      socket.close(1008, "mensagem de sinalizacao invalida");
      return;
    }

    if (!client.roomId || !client.peerId) {
      if (envelope.signal.type !== "presence") {
        socket.close(1008, "presence deve ser a primeira mensagem");
        return;
      }
      if (roomSize(envelope.roomId) >= maxPeersPerRoom) {
        socket.close(1008, "sala cheia");
        return;
      }
      if (hasPeer(envelope.roomId, envelope.from)) {
        socket.close(1008, "peer duplicado");
        return;
      }
      client.roomId = envelope.roomId;
      client.peerId = envelope.from;
    } else if (client.roomId !== envelope.roomId || client.peerId !== envelope.from) {
      socket.close(1008, "identidade da conexao nao pode mudar");
      return;
    }

    relay(socket, envelope);
  });
  socket.on("close", () => {
    clients.delete(socket);
    if (client.roomId && client.peerId) {
      relay(socket, {
        roomId: client.roomId,
        from: client.peerId,
        signal: { type: "leave" },
      });
    }
  });
});

const heartbeat = setInterval(() => {
  clients.forEach((client, socket) => {
    if (!client.isAlive) {
      socket.terminate();
      return;
    }
    client.isAlive = false;
    socket.ping();
  });
}, 30000);

webSocketServer.on("close", () => clearInterval(heartbeat));

server.listen(port, host, () => {
  console.log(`Sinalizacao WebRTC ouvindo em ws://${displayHost(host)}:${port}/ws`);
  networkAddresses().forEach((address) => {
    console.log(`Jogo na rede local: http://${address}:${gamePort}`);
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clients.forEach((_, socket) => socket.close(1001, "servidor encerrando"));
    webSocketServer.close(() => server.close(() => process.exit(0)));
  });
}

function relay(sender, envelope) {
  const serialized = JSON.stringify(envelope);
  clients.forEach((recipient, socket) => {
    if (
      socket !== sender &&
      socket.readyState === WebSocket.OPEN &&
      recipient.roomId === envelope.roomId &&
      (envelope.to === undefined || recipient.peerId === envelope.to)
    ) {
      socket.send(serialized);
    }
  });
}

function parseEnvelope(serialized) {
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    return undefined;
  }

  if (!isRecord(value) || !validIdentifier(value.roomId) || !validIdentifier(value.from)) {
    return undefined;
  }
  if (value.to !== undefined && !validIdentifier(value.to)) return undefined;
  if (!isRecord(value.signal) || typeof value.signal.type !== "string") return undefined;

  switch (value.signal.type) {
    case "presence":
      return typeof value.signal.requestReply === "boolean" ? value : undefined;
    case "offer":
    case "answer":
      return isRecord(value.signal.description) && typeof value.signal.description.type === "string"
        ? value
        : undefined;
    case "ice-candidate":
      return isRecord(value.signal.candidate) ? value : undefined;
    case "leave":
      return value;
    default:
      return undefined;
  }
}

function validIdentifier(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,32}$/.test(value);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roomSize(roomId) {
  return [...clients.values()].filter((client) => client.roomId === roomId).length;
}

function hasPeer(roomId, peerId) {
  return [...clients.values()].some(
    (client) => client.roomId === roomId && client.peerId === peerId
  );
}

function createIceConfiguration() {
  const iceServers = [{ urls: process.env.STUN_URL || "stun:stun.l.google.com:19302" }];
  if (process.env.TURN_URL) {
    const turnServer = { urls: process.env.TURN_URL };
    if (process.env.TURN_USERNAME) turnServer.username = process.env.TURN_USERNAME;
    if (process.env.TURN_CREDENTIAL) turnServer.credential = process.env.TURN_CREDENTIAL;
    iceServers.push(turnServer);
  }
  return { iceServers };
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function displayHost(value) {
  return value === "0.0.0.0" ? "localhost" : value;
}

function networkAddresses() {
  const addresses = [];
  Object.values(os.networkInterfaces()).forEach((interfaces) => {
    interfaces?.forEach((networkInterface) => {
      if (networkInterface.family === "IPv4" && !networkInterface.internal) {
        addresses.push(networkInterface.address);
      }
    });
  });
  return [...new Set(addresses)];
}

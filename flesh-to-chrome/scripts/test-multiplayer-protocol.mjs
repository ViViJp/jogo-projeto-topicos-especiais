import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const filename = path.join(projectDirectory, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Dependência não permitida no teste: ${specifier}`);
    },
    console,
    URL,
    window: globalThis.window,
    WebSocket: globalThis.WebSocket,
    BroadcastChannel: globalThis.BroadcastChannel,
    EventTarget: globalThis.EventTarget,
    CustomEvent: globalThis.CustomEvent,
    RTCPeerConnection: globalThis.RTCPeerConnection,
  });
  new vm.Script(output, { filename }).runInContext(context);
  return module.exports;
}

const protocol = loadTypeScriptModule("src/multiplayer/MultiplayerProtocol.ts");
const now = Date.now();
const raceId = "RACE_123";
const version = protocol.MULTIPLAYER_PROTOCOL_VERSION;

const validSnapshot = {
  type: "player-snapshot",
  protocolVersion: version,
  raceId,
  sequence: 4,
  sentAt: now,
  x: 1200,
  y: 560,
  velocityX: 210,
  velocityY: 0,
  state: "running",
  credits: 3,
  checkpointReached: false,
  finished: false,
};

assert.equal(protocol.isMultiplayerMessage(validSnapshot), true);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, protocolVersion: 1 }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, raceId: "inválido" }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, sequence: 1.5 }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, x: 1_000_001 }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, velocityX: Infinity }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, credits: -1 }), false);
assert.equal(protocol.isMultiplayerMessage({ ...validSnapshot, state: "teleporting" }), false);

assert.equal(
  protocol.isMultiplayerMessage({
    type: "race-start",
    protocolVersion: version,
    raceId,
    startAt: now + 4000,
  }),
  true,
);
assert.equal(
  protocol.isMultiplayerMessage({
    type: "race-finish",
    protocolVersion: version,
    raceId,
    rawTimeMs: protocol.MAX_RACE_DURATION_MS + 1,
    credits: 20,
    deadlineAt: now + 20_000,
  }),
  false,
);
assert.equal(
  protocol.isMultiplayerMessage({
    type: "race-finish",
    protocolVersion: version,
    raceId,
    rawTimeMs: 120_000,
    credits: 101,
    deadlineAt: now + 20_000,
  }),
  false,
);

const validOffer = {
  roomId: "ROOM_1",
  from: "alex-01",
  to: "alex-02",
  signal: { type: "offer", description: { type: "offer", sdp: "v=0" } },
};
assert.equal(protocol.isSignalEnvelope(validOffer), true);
assert.equal(protocol.isSignalEnvelope({ ...validOffer, roomId: "../room" }), false);
assert.equal(
  protocol.isSignalEnvelope({
    ...validOffer,
    signal: { type: "offer", description: { type: "answer", sdp: "v=0" } },
  }),
  false,
);

// A fila do WebSocket só vale para a primeira abertura. Depois de uma queda,
// ofertas/candidatos antigos devem ser descartados e apenas presence é reenviado.
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances = [];

  readyState = FakeWebSocket.CONNECTING;
  sent = [];
  constructor() {
    FakeWebSocket.instances.push(this);
  }
  send(value) {
    this.sent.push(JSON.parse(value));
  }
  close() {}
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  disconnect() {
    this.readyState = 3;
    this.onclose?.();
  }
}

let scheduledReconnect;
globalThis.window = {
  setTimeout: (callback) => {
    scheduledReconnect = callback;
    return 1;
  },
  clearTimeout: () => undefined,
};
globalThis.WebSocket = FakeWebSocket;
const signalingModule = loadTypeScriptModule("src/multiplayer/SignalingTransport.ts", {
  "./MultiplayerProtocol": protocol,
});
const signaling = new signalingModule.WebSocketSignaling("ws://localhost:8080/ws");
signaling.open(() => undefined);
const firstSocket = FakeWebSocket.instances[0];
const presence = { roomId: "ROOM_1", from: "alex-01", signal: { type: "presence", requestReply: true } };
signaling.send(presence);
signaling.send(validOffer);
firstSocket.open();
assert.deepEqual(firstSocket.sent.map((message) => message.signal.type), ["presence", "offer"]);

firstSocket.disconnect();
signaling.send(validOffer);
assert.equal(typeof scheduledReconnect, "function");
scheduledReconnect();
const secondSocket = FakeWebSocket.instances[1];
secondSocket.open();
assert.deepEqual(secondSocket.sent.map((message) => message.signal.type), ["presence"]);

// Reabrir a sinalização precisa substituir o RTCPeerConnection, e não apenas
// reabrir o WebSocket mantendo DataChannels órfãos.
class FakeDataChannel {
  readyState = "connecting";
  bufferedAmount = 0;
  constructor(label) {
    this.label = label;
  }
  send() {}
  close() {
    this.readyState = "closed";
    this.onclose?.();
  }
}

class FakePeerConnection {
  static instances = [];
  signalingState = "stable";
  connectionState = "new";
  pendingLocalDescription;
  localDescription = null;
  remoteDescription = null;
  closed = false;
  constructor() {
    FakePeerConnection.instances.push(this);
  }
  createDataChannel(label) {
    return new FakeDataChannel(label);
  }
  async createOffer() {
    return { type: "offer", sdp: "v=0" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "v=0" };
  }
  async setLocalDescription(description) {
    this.localDescription = { ...description, toJSON: () => description };
  }
  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }
  async addIceCandidate() {}
  close() {
    this.closed = true;
    this.connectionState = "closed";
  }
}

class FakeSignalingTransport {
  sent = [];
  open(onMessage, onState) {
    this.onMessage = onMessage;
    this.onState = onState;
    onState("open");
  }
  send(message) {
    this.sent.push(message);
  }
  close() {}
  signal(message) {
    this.onMessage(message);
  }
  state(value) {
    this.onState(value);
  }
}

let nextTimer = 1;
globalThis.window = {
  setTimeout: () => nextTimer++,
  clearTimeout: () => undefined,
};
globalThis.RTCPeerConnection = FakePeerConnection;
globalThis.CustomEvent ??= class CustomEvent extends Event {
  constructor(type, init) {
    super(type);
    this.detail = init?.detail;
  }
};
const meshModule = loadTypeScriptModule("src/multiplayer/WebRtcMesh.ts", {
  "./MultiplayerProtocol": protocol,
  "./SignalingTransport": signalingModule,
});
const fakeSignaling = new FakeSignalingTransport();
const mesh = new meshModule.WebRtcMesh({
  localPeerId: "alex-A",
  roomId: "ROOM_1",
  signaling: fakeSignaling,
});
mesh.start();
fakeSignaling.signal({
  roomId: "ROOM_1",
  from: "alex-Z",
  signal: { type: "presence", requestReply: true },
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(FakePeerConnection.instances.length, 1);
const oldConnection = FakePeerConnection.instances[0];

fakeSignaling.state("closed");
fakeSignaling.state("open");
assert.equal(oldConnection.closed, true);
fakeSignaling.signal({
  roomId: "ROOM_1",
  from: "alex-Z",
  signal: { type: "presence", requestReply: true },
});
await new Promise((resolve) => setImmediate(resolve));
assert.equal(FakePeerConnection.instances.length, 2);
assert.ok(fakeSignaling.sent.filter((message) => message.signal.type === "presence").length >= 2);
mesh.stop();

const menuSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/MenuScene.ts"), "utf8");
const bootSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/BootScene.ts"), "utf8");
const multiplayerSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/MultiplayerScene.ts"), "utf8");
const notificationSceneSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/NotificationCenterScene.ts"), "utf8");
const notificationServiceSource = fs.readFileSync(path.join(projectDirectory, "src/network/NotificationService.ts"), "utf8");
const matchesSource = fs.readFileSync(path.join(projectDirectory, "../pulumi/services/partidas/index.js"), "utf8");
const matchServiceSource = fs.readFileSync(path.join(projectDirectory, "src/network/MatchService.ts"), "utf8");
const cloudSessionSource = fs.readFileSync(path.join(projectDirectory, "src/network/CloudSession.ts"), "utf8");
const infrastructureSource = fs.readFileSync(path.join(projectDirectory, "../pulumi/__main__.py"), "utf8");
const syncSource = fs.readFileSync(path.join(projectDirectory, "src/network/MatchResultSync.ts"), "utf8");
assert.match(menuSource, /openMultiplayer[\s\S]*?if \(!CloudSession\.current\(\)\)/,
  "visitante não pode abrir a cena multiplayer pelo menu");
assert.match(bootSource, /hasMultiplayerInvite\(\) && CloudSession\.current\(\)/,
  "convite direto também deve exigir sessão autenticada");
assert.match(multiplayerSource, /MatchService\.join/);
assert.match(multiplayerSource, /MatchService\.ready/);
assert.match(syncSource, /MatchService\.finish/);
assert.match(multiplayerSource, /kind: "finish"/);
assert.match(multiplayerSource, /await resolveSignaling\(/,
  "a sinalização publicada deve ser resolvida antes de abrir o mesh");
assert.doesNotMatch(multiplayerSource, /window\.location\.hostname}\/ws/,
  "produção não pode presumir /ws na origem estática");
assert.match(cloudSessionSource, /body\.signaling/,
  "cloud-config deve fornecer explicitamente o WSS publicado");
assert.match(infrastructureSource, /protocol_type="WEBSOCKET"/);
assert.match(infrastructureSource, /"signaling": endpoints\[1\]/);
assert.match(multiplayerSource, /if \(!this\.backendReady\) return;/,
  "handshake WebRTC deve aguardar prontidão confirmada pelo serviço Partidas");
assert.match(multiplayerSource, /handlePeerConnected[\s\S]*?confirmBackendReady/,
  "prontidão REST só pode ser confirmada depois que o DataChannel abrir");
assert.match(matchServiceSource, /heartbeat\(matchId: string, connected: boolean\)/);
assert.match(matchServiceSource, /observedOpponent: MatchParticipantResult/,
  "cada jogador deve confirmar o resultado recebido do adversário");
assert.match(matchesSource, /attribute_not_exists\(guestUserId\)/,
  "duas entradas simultâneas devem disputar uma única condição transacional");
assert.match(matchesSource, /async function finishMatch/);
assert.match(matchesSource, /submissionsAgree/);
assert.match(matchesSource, /resultStatus = :pending/);
assert.match(matchesSource, /async function recoverMatch/);
assert.match(matchesSource, /RESULT#/,
  "conclusão e abandono devem materializar histórico privado por participante");
assert.match(notificationSceneSource, /this\.ready = false;[\s\S]*?\+\+this\.loadGeneration/,
  "a central deve bloquear interação e invalidar carregamentos de execuções anteriores");
assert.match(notificationServiceSource, /const current = CloudSession\.current\(\);[\s\S]*?current\.profile\.id !== session\.profile\.id/,
  "notificações não podem usar o token de outra conta após troca de sessão");

console.log("Multiplayer: protocolo, fila de reconexão e renegociação WebRTC OK.");

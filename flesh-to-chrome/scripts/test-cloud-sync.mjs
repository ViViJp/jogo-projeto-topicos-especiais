import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function storage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const localStorage = storage();
const sessionStorage = storage();
sessionStorage.setItem("flesh-to-chrome:session", JSON.stringify({
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: Date.now() + 60_000,
  profile: { id: "player-1", name: "Alex", email: "alex@example.com" },
}));

const onlineListeners = [];
const window = {
  location: {
    hostname: "game.example.com",
    search: "",
    href: "https://game.example.com/",
    origin: "https://game.example.com",
    pathname: "/",
  },
  history: { replaceState: () => undefined },
  addEventListener: (type, listener) => {
    if (type === "online") onlineListeners.push(listener);
  },
  setTimeout,
  clearTimeout,
};

const requests = [];
const logoutRequests = [];
let requestMode = "load";
let logoutMode = "success";
let currentRevision = 1;
let slowCampaignStarted = false;
const restoredSave = {
  version: 1,
  currentPhaseId: "fase5",
  checkpoint: { x: 100, y: 20, consolidatedCreditIds: [] },
  wallet: 0,
  abilities: { legs: true, arms: true, eyes: true, thrusters: true },
  descentState: {
    active: false,
    step: null,
    chainStatus: "inactive",
    memories: [],
    pendingMemory: null,
    removals: [],
    retryUsedByStage: {},
  },
  preGateSave: null,
  endingReached: null,
};

function response(status, body = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

async function fetchMock(url, options = {}) {
  if (url === "/cloud-config.json") return response(200, { api: "https://api.example.com" });
  if (options.method === undefined && url.endsWith("/me/campaign")) {
    if (requestMode === "slow-load") {
      slowCampaignStarted = true;
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
        void resolve;
      });
    }
    return response(200, { revision: currentRevision, state: restoredSave });
  }
  if (url.endsWith("/auth/logout")) {
    logoutRequests.push({
      authorization: options.headers?.authorization,
      body: JSON.parse(options.body || "{}"),
    });
    if (logoutMode === "unavailable") throw new Error("logout network unavailable");
    if (logoutMode === "rejected") {
      return response(502, { error: { code: "TOKEN_REVOCATION_REJECTED" } });
    }
    return response(204, {});
  }
  const body = JSON.parse(options.body || "{}");
  requests.push({ url, method: options.method, body, authorization: options.headers?.authorization });
  if (requestMode === "unavailable") throw new Error("network unavailable");
  if (requestMode === "conflict") return response(409, {});
  currentRevision = body.expectedRevision + 1;
  return response(200, {
    revision: currentRevision,
    state: url.endsWith("/restore-gate") ? restoredSave : undefined,
  });
}

const source = fs.readFileSync(path.join(projectDirectory, "src/network/CloudSession.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: "CloudSession.ts",
}).outputText;
const module = { exports: {} };
const localRequire = (specifier) => {
  if (specifier === "./campaign-state") {
    return {
      toApiState: (save) => save,
      fromApiState: (state) => state,
      sameProgress: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    };
  }
  if (specifier === "./api-origin") {
    return { allowedApiOrigin: (value) => value, takeTicket: (href) => ({ ticket: null, href }) };
  }
  throw new Error(`Import inesperado: ${specifier}`);
};
new vm.Script(output, { filename: "CloudSession.ts" }).runInNewContext({
  module,
  exports: module.exports,
  require: localRequire,
  window,
  localStorage,
  sessionStorage,
  fetch: fetchMock,
  crypto: { randomUUID },
  URL,
  URLSearchParams,
  Date,
  JSON,
  Map,
  Set,
  Promise,
  console,
  queueMicrotask,
  AbortController,
});

const { CloudSession } = module.exports;
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(message);
}

await CloudSession.loadCampaign();
const saveAt = (x) => ({ ...restoredSave, checkpoint: { ...restoredSave.checkpoint, x } });

requestMode = "unavailable";
CloudSession.queueCampaignSync(saveAt(200));
await waitFor(
  () => requests.length > 0 && CloudSession.campaignSyncState().status === "pending",
  "falha deve manter sync pendente",
);
const firstAttempt = requests.at(-1).body;
const storedAfterFailure = JSON.parse(localStorage.getItem("flesh-to-chrome:campaign-sync:player-1"));
assert.equal(storedAfterFailure.length, 1);
assert.equal(storedAfterFailure[0].operationId, firstAttempt.operationId);
assert.equal(storedAfterFailure[0].attempted, true);

CloudSession.queueCampaignSync(saveAt(300));
const storedWithNewProgress = JSON.parse(localStorage.getItem("flesh-to-chrome:campaign-sync:player-1"));
assert.equal(storedWithNewProgress.length, 2, "novo progresso deve ficar atrás da tentativa em voo");

requestMode = "success";
assert.equal(onlineListeners.length, 1, "a recuperação online deve ser registrada uma única vez");
onlineListeners[0]();
await waitFor(() => CloudSession.campaignSyncState().status === "idle", "reconexão deve esvaziar a fila");
const retriedAttempt = requests.find((request, index) => index > 0 && request.body.operationId === firstAttempt.operationId);
assert.ok(retriedAttempt, "a retentativa deve reutilizar o operationId");
const successfulRequests = requests.filter((request) => request.method === "PUT" && request.body.expectedRevision >= 1);
assert.equal(successfulRequests.at(-1).body.state.checkpoint.x, 300);
assert.equal(successfulRequests.at(-1).body.expectedRevision, 2, "a segunda atualização deve respeitar a nova revisão");
assert.equal(localStorage.getItem("flesh-to-chrome:campaign-sync:player-1"), null);

requestMode = "conflict";
CloudSession.queueCampaignSync(saveAt(400));
await waitFor(() => CloudSession.campaignSyncState().status === "conflict", "HTTP 409 deve suspender a fila");
assert.equal(CloudSession.hasPendingCampaignSync("player-1"), true);
assert.equal(CloudSession.hasCampaignConflict("player-1"), true);

CloudSession.discardPendingCampaignSync("player-1");
CloudSession.resumeCampaignSync("player-1", currentRevision);
requestMode = "success";
let restoredEvent;
const unsubscribe = CloudSession.subscribeCampaignSync((state) => {
  if (state.completedAction === "restore") restoredEvent = state;
});
assert.equal(CloudSession.queueGateRestore(), true);
await waitFor(() => restoredEvent, "restore-gate deve concluir pela fila");
unsubscribe();
const restoreRequest = requests.find((request) => request.url.endsWith("/me/campaign/restore-gate"));
assert.ok(restoreRequest);
assert.equal(restoreRequest.method, "POST");
assert.equal(restoredEvent.restoredSave.currentPhaseId, "fase5");
assert.equal(CloudSession.campaignSyncState().status, "idle");

const confirmedLogout = await CloudSession.logout();
assert.equal(confirmedLogout.localLogout, "completed");
assert.equal(confirmedLogout.refreshTokenRevocation, "confirmed");
assert.equal(sessionStorage.getItem("flesh-to-chrome:session"), null);
sessionStorage.setItem("flesh-to-chrome:session", JSON.stringify({
  accessToken: "access-a",
  refreshToken: "refresh-a",
  expiresAt: Date.now() + 60_000,
  profile: { id: "player-a", name: "A", email: "a@example.com" },
}));
requestMode = "slow-load";
CloudSession.queueCampaignSync(saveAt(500));
await waitFor(() => slowCampaignStarted, "a leitura atrasada da conta A deve iniciar");
await CloudSession.logout();
sessionStorage.setItem("flesh-to-chrome:session", JSON.stringify({
  accessToken: "access-b",
  refreshToken: "refresh-b",
  expiresAt: Date.now() + 60_000,
  profile: { id: "player-b", name: "B", email: "b@example.com" },
}));
await tick();

const queueA = JSON.parse(localStorage.getItem("flesh-to-chrome:campaign-sync:player-a"));
assert.equal(queueA.length, 1, "a fila de A deve permanecer recuperável após o logout");
assert.equal(queueA[0].ownerId, "player-a");
assert.equal(
  requests.some((request) => request.body?.state?.checkpoint?.x === 500),
  false,
  "o save de A não pode ser enviado depois que B assume a sessão",
);

requestMode = "success";
CloudSession.resumeCampaignSync("player-b", currentRevision);
CloudSession.queueCampaignSync(saveAt(600));
await waitFor(() => requests.some((request) => request.body?.state?.checkpoint?.x === 600),
  "a fila de B deve continuar funcional");
const requestB = requests.find((request) => request.body?.state?.checkpoint?.x === 600);
assert.equal(requestB.authorization, "Bearer access-b");
assert.equal(localStorage.getItem("flesh-to-chrome:campaign-sync:player-a") !== null, true);

logoutMode = "rejected";
const rejectedLogout = await CloudSession.logout();
assert.equal(rejectedLogout.refreshTokenRevocation, "rejected");
assert.equal(sessionStorage.getItem("flesh-to-chrome:session"), null,
  "erro HTTP na revogação não pode preservar a sessão local");

sessionStorage.setItem("flesh-to-chrome:session", JSON.stringify({
  accessToken: "access-c",
  refreshToken: "refresh-c",
  expiresAt: Date.now() + 60_000,
  profile: { id: "player-c", name: "C", email: "c@example.com" },
}));
logoutMode = "unavailable";
const unavailableLogout = await CloudSession.logout();
assert.equal(unavailableLogout.refreshTokenRevocation, "unavailable");
assert.equal(sessionStorage.getItem("flesh-to-chrome:session"), null,
  "falha de rede na revogação não pode preservar a sessão local");

sessionStorage.setItem("flesh-to-chrome:session", JSON.stringify({
  accessToken: "expired-access",
  refreshToken: "valid-refresh",
  expiresAt: Date.now() - 1_000,
  profile: { id: "player-expired", name: "Expirado", email: "expired@example.com" },
}));
logoutMode = "success";
assert.equal(CloudSession.current(), null, "access token expirado não pode autenticar rotas protegidas");
assert.equal(CloudSession.stored().profile.id, "player-expired",
  "a sessão armazenada deve permanecer disponível para encerramento");
const expiredLogout = await CloudSession.logout();
assert.equal(expiredLogout.refreshTokenRevocation, "confirmed");
assert.equal(sessionStorage.getItem("flesh-to-chrome:session"), null);
assert.equal(logoutRequests.at(-1).body.refreshToken, "valid-refresh");
assert.equal(logoutRequests.at(-1).authorization, undefined,
  "a revogação não deve depender do access token expirado");

console.log("campaign sync e logout seguro: retry, conflito, isolamento e revogação OK");

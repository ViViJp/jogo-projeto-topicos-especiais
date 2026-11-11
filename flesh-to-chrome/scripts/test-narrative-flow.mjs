import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleCache = new Map();
const memoryStorage = new Map();
const localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, String(value)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};

function loadTypeScriptModule(filename) {
  const absolutePath = path.resolve(filename);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports;
  const source = fs.readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolutePath,
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(absolutePath, module);
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) throw new Error(`Import não suportado no teste: ${specifier}`);
    const resolved = path.resolve(path.dirname(absolutePath), `${specifier}.ts`);
    return loadTypeScriptModule(resolved);
  };
  new vm.Script(output, { filename: absolutePath }).runInNewContext({
    module,
    exports: module.exports,
    require: localRequire,
    console,
    localStorage,
  });
  return module.exports;
}

class FakeDisplayObject {
  constructor(value = "") {
    this.value = value;
    this.handlers = new Map();
    this.texture = { setFilter: () => this.texture };
  }

  on(event, handler) { this.handlers.set(event, handler); return this; }
  emit(event) { this.handlers.get(event)?.(); return this; }
  setAlpha() { return this; }
  setColor() { return this; }
  setDisplaySize() { return this; }
  setInteractive() { return this; }
  setOrigin() { return this; }
  setScale() { return this; }
  setStrokeStyle() { return this; }
  setText(value) { this.value = value; return this; }
  setTint() { return this; }
  setVisible() { return this; }
}

function createUiHarness(width = 1_920, height = 720) {
  const starts = [];
  const sprites = [];
  const texts = [];

  class Scene {
    constructor() {
      this.scale = { width, height };
      this.cameras = { main: { setBackgroundColor() {}, shake() {}, fadeOut() {} } };
      this.scene = { start: (key, data) => starts.push({ key, data }) };
      this.add = {
        circle: () => new FakeDisplayObject(),
        image: (_x, _y, texture) => new FakeDisplayObject(texture),
        rectangle: () => new FakeDisplayObject(),
        sprite: (_x, _y, texture, frame) => {
          sprites.push({ texture, frame });
          return new FakeDisplayObject(texture);
        },
        text: (_x, _y, value) => {
          const text = new FakeDisplayObject(value);
          texts.push(text);
          return text;
        },
      };
      this.tweens = { add() {} };
      this.sound = { add: () => ({ play() {}, stop() {} }) };
      this.events = { once() {} };
      this.input = { on() {} };
    }
  }

  return {
    Phaser: {
      Scene,
      Scenes: { Events: { SHUTDOWN: "shutdown" } },
      Textures: { FilterMode: { NEAREST: "nearest" } },
    },
    starts,
    sprites,
    texts,
  };
}

class FakeInputManager {
  isCancelJustDown() { return false; }
  isConfirmJustDown() { return false; }
  isMenuDownJustDown() { return false; }
  isMenuLeftJustDown() { return false; }
  isMenuRightJustDown() { return false; }
  isMenuUpJustDown() { return false; }
  postUpdate() {}
}

function loadSceneModule(filename, harness, saveStateModule) {
  const cache = new Map();
  const load = (moduleFilename) => {
    const absolutePath = path.resolve(moduleFilename);
    if (cache.has(absolutePath)) return cache.get(absolutePath).exports;
    const source = fs.readFileSync(absolutePath, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: absolutePath,
    }).outputText.replaceAll("import.meta.url", JSON.stringify(pathToFileURL(absolutePath).href));
    const module = { exports: {} };
    cache.set(absolutePath, module);
    const localRequire = (specifier) => {
      if (specifier === "phaser") return { __esModule: true, default: harness.Phaser };
      if (specifier.endsWith("/InputManager")) return { InputManager: FakeInputManager };
      if (specifier.endsWith("/SaveState")) return saveStateModule;
      if (!specifier.startsWith(".")) throw new Error(`Import não suportado no teste de UI: ${specifier}`);
      return load(path.resolve(path.dirname(absolutePath), `${specifier}.ts`));
    };
    new vm.Script(output, { filename: absolutePath }).runInNewContext({
      module,
      exports: module.exports,
      require: localRequire,
      console,
      URL,
    });
    return module.exports;
  };
  return load(filename);
}

function interactiveInput(active) {
  return {
    isCancelJustDown: () => active === "cancel",
    isConfirmJustDown: () => active === "confirm",
    isMenuDownJustDown: () => active === "down",
    isMenuLeftJustDown: () => active === "left",
    isMenuRightJustDown: () => active === "right",
    isMenuUpJustDown: () => active === "up",
    postUpdate() {},
  };
}

function fakeSaveModule(data) {
  const calls = { decline: 0, load: 0, mark: [], begin: 0 };
  const instance = {
    beginDescent() { calls.begin += 1; },
    declineDescentRetry() { calls.decline += 1; },
    get() { return data; },
    markEndingReached(ending) { calls.mark.push(ending); },
  };
  return {
    calls,
    module: {
      SaveState: class {
        static load() { calls.load += 1; return instance; }
      },
    },
  };
}

const { SaveState } = loadTypeScriptModule(path.join(projectDirectory, "src/systems/SaveState.ts"));
const { DESCENT_ROUTES } = loadTypeScriptModule(
  path.join(projectDirectory, "src/systems/DescentProgression.ts"),
);

assert.deepEqual(
  Array.from(DESCENT_ROUTES, (route) => route.targetSeconds),
  [30, 30, 30, 30, 5],
  "a descida deve usar quatro recortes de 30 s e um epilogo curto",
);
assert.deepEqual(
  Array.from(DESCENT_ROUTES, (route) => Array.from(route.requiredAbilities)),
  [
    ["legs", "arms", "eyes", "thrusters"],
    ["legs", "arms", "eyes"],
    ["legs", "arms"],
    ["legs"],
    [],
  ],
  "cada recorte deve exigir somente os implantes ainda presentes",
);

// O início autorizado pelo Portão da campanha precisa reconstruir o corpo
// completo, inclusive ao normalizar progresso antigo.
const directDescent = SaveState.newGame();
directDescent.beginDescent();
assert.deepEqual(
  Object.values(directDescent.get().abilities),
  [true, true, true, true],
  "a primeira fase Flesh deve começar com os quatro implantes",
);

const save = SaveState.newGame();
save.setPhase("fase5");
for (const ability of ["legs", "arms", "eyes", "thrusters"]) save.unlockAbility(ability);
save.updateCheckpoint(37888, 384, ["f5-credit-01"], 230);
const snapshot = save.createPreGateSave();
assert.equal(snapshot.currentPhaseId, "fase5");
assert.equal(snapshot.wallet, 230);
assert.equal(snapshot.preGateSave, null, "snapshot não pode apontar recursivamente para si mesmo");
assert.deepEqual(
  Object.values(snapshot.abilities),
  [true, true, true, true],
  "save pré-Portão preserva os quatro implantes",
);

save.markEndingReached("chrome");
save.setPhase("fase1");
const restored = save.restorePreGateSave();
assert.ok(restored);
assert.equal(restored.currentPhaseId, "fase5");
assert.equal(restored.wallet, 230);
assert.equal(restored.endingReached, null);
assert.ok(restored.preGateSave, "restaurar não consome o ponto pré-Portão");
assert.deepEqual(Array.from(restored.checkpoint.consolidatedCreditIds), ["f5-credit-01"]);

// Caminho Flesh completo: cada memoria autoriza exatamente uma retirada e
// a habilidade removida nao reaparece na fase seguinte.
save.beginDescent();
assert.equal(save.get().currentPhaseId, "fase5");
assert.equal(save.get().descentState.active, true);
assert.equal(save.get().wallet, 0, "creditos comuns nao acompanham a descida");
const descentSteps = [
  ["fase5", "glitch-topo-identidade", "thrusters", "fase4"],
  ["fase4", "glitch-corporativo-voz", "eyes", "fase3"],
  ["fase3", "glitch-urbano-amigos", "arms", "fase2-intro"],
  ["fase2-intro", "glitch-industrial-familia", "legs", "fase1"],
];
for (const [phase, fragment, implant, nextPhase] of descentSteps) {
  assert.equal(save.get().currentPhaseId, phase);
  assert.equal(save.recoverDescentFragment(fragment), true);
  assert.equal(save.completeDescentPhase(), "reforge");
  assert.equal(save.get().descentState.pendingRemoval, implant);
  const result = save.completeBioprinting();
  assert.ok(result);
  assert.equal(result.nextPhaseId, nextPhase);
  assert.equal(save.get().abilities[implant], false, `${implant} deve permanecer removido`);
}
assert.equal(save.get().descentState.active, false);
assert.equal(save.get().descentState.currentStep, 4);
assert.equal(save.get().descentState.epiloguePending, true,
  "a última ReForge deve preservar a pendência do trecho jogável");
assert.deepEqual(Object.values(save.get().abilities), [false, false, false, false]);
const interruptedBeforeSewer = SaveState.load();
assert.equal(interruptedBeforeSewer.get().descentState.epiloguePending, true,
  "fechar o jogo antes do Esgoto deve manter o percurso pendente");
assert.equal(interruptedBeforeSewer.completeDescentEpilogue(), true);
assert.equal(interruptedBeforeSewer.get().descentState.epiloguePending, false,
  "a pendência só termina ao concluir o percurso jogável");

// Hollow reproduzivel: primeira conclusao sem glitch oferece retry; a
// segunda quebra definitivamente a cadeia no estado corporal corrente.
save.restorePreGateSave();
save.beginDescent();
assert.equal(save.completeDescentPhase(), "retry");
assert.deepEqual(Array.from(save.get().descentState.retryUsedPhaseIds), ["fase5"]);
assert.equal(save.completeDescentPhase(), "hollow");
assert.equal(save.get().descentState.brokenChain, true);
assert.equal(save.get().abilities.thrusters, true, "falha no primeiro glitch preserva todos os implantes");

const read = (relativePath) => fs.readFileSync(path.join(projectDirectory, relativePath), "utf8");
const main = read("src/main.ts");
const menu = read("src/scenes/MenuScene.ts");
const prologue = read("src/scenes/PrologueScene.ts");
const clinic = read("src/scenes/ClinicScene.ts");
const gate = read("src/scenes/GateScene.ts");
const ending = read("src/scenes/EndingScene.ts");
const game = read("src/scenes/GameScene.ts");
const phase4 = read("src/objects/TiledPhase4Runtime.ts");
const retry = read("src/scenes/DescentRetryScene.ts");
const reforge = read("src/scenes/ReForgeScene.ts");
const epilogue = read("src/scenes/EpilogueScene.ts");
const descentRuntime = read("src/objects/DescentGlitchRuntime.ts");
const descentRouteRuntime = read("src/objects/DescentRouteRuntime.ts");
const georgeRefusal = read("src/scenes/GeorgeRefusalScene.ts");
const gdd = read("docs/gdd.md");
const narrativePlaytest = read("docs/NARRATIVE_FLOW_PLAYTEST.md");
const assetRegistry = read("docs/ASSET_REGISTRY.md");

assert.match(main, /PrologueScene/);
assert.match(main, /GateScene/);
assert.match(main, /GeorgeRefusalScene/);
assert.match(menu, /Continuar do Portão/);
assert.match(menu, /restorePreGateSave\(\)/);
assert.match(menu, /this\.scene\.start\("PrologueScene"\)/);
assert.match(menu, /Portão — escolha final \(teste\)/);
assert.match(menu, /this\.scene\.start\("GateScene", \{ testMode: true \}\)/);
assert.match(menu, /restorePreGateSave\(\)[\s\S]*?this\.scene\.start\("GateScene", \{ testMode: false \}\)/,
  "prévia → menu → Continuar do Portão deve reabrir a campanha fora do modo de teste");
assert.match(prologue, /PROLOGUE_FAMILY_KEY/);
assert.match(prologue, /PROLOGUE_NEWSPAPER_KEY/);
assert.match(prologue, /father\/pai-antes\.png/);
assert.match(prologue, /prologue\/jornal-pai\.png/);
assert.match(prologue, /PAI DE ALEX — ANTES DA ASCENSÃO/);
assert.match(prologue, /PAI DE ALEX — APÓS A CONVERSÃO/);
for (const phase of ["fase1", "fase2-intro", "fase3", "fase4"]) {
  assert.match(clinic, new RegExp(`(?:"${phase}"|${phase}):`), `clínica narrativa ausente para ${phase}`);
}
assert.match(clinic, /george-clinic-01/);
assert.match(clinic, /george-clinic-02/);
assert.match(clinic, /george-clinic-03/);
assert.match(clinic, /george-proud/);
assert.match(game, /Deseja assistir à cutscene da clínica de George\?/);
assert.match(game, /this\.scene\.start\("ClinicScene", \{ \.\.\.clinicData, testMode: true \}\)/);
assert.match(clinic, /if \(this\.data\$\.testMode\) \{[\s\S]*?this\.scene\.start\("MenuScene"\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?SaveState\.load\(\)/,
  "prévia da clínica deve voltar ao seletor antes de alterar o save");
assert.match(clinic, /this\.scene\.start\("GateScene", \{ testMode: false \}\)/,
  "campanha vinda da clínica deve limpar dados anteriores da prévia do Portão");
assert.match(game, /this\.data\$\.phaseId === "fase5"[\s\S]*?"GateScene"/);
assert.match(game, /implant: implantOverride,[\s\S]*?testMode: false/,
  "fim normal da Fase 5 deve iniciar o Portão fora do modo de teste");
assert.match(gate, /createPreGateSave\(\)/);
assert.match(gate, /!this\.testMode && !save\.hasPreGateSave\(\)/);
assert.match(gate, /const width = this\.scale\.width;/,
  "Portão deve usar a largura expandida do viewport");
assert.match(gate, /rectangle\(centerX, height \/ 2, width, height, 0x100718, 1\)/,
  "fundo do Portão deve cobrir toda a área lógica sem borda preta");
assert.doesNotMatch(gate, /SCREEN_WIDTH|SCREEN_HEIGHT/,
  "layout do Portão não pode permanecer preso à resolução base");
const gateY = Number(gate.match(/const gateY = (\d+);/)?.[1]);
const gateHeight = Number(gate.match(/const gateHeight = (\d+);/)?.[1]);
assert.ok(112 < gateY - gateHeight / 2,
  "subtítulo deve terminar antes do topo visual do Portão");
assert.doesNotMatch(gate, /markEndingReached\(/,
  "escolher Chrome ainda não significa concluir o final");
assert.match(gate, /\{ ending: "chrome", testMode: this\.testMode \}/);
assert.match(gate, /beginDescent\(\)/);
assert.match(gate, /this\.scene\.start\("GeorgeRefusalScene"\)/);
assert.match(gate, /if \(this\.testMode\) \{[\s\S]*?Inicie este caminho pelo Portão do seu save[\s\S]*?return;[\s\S]*?SaveState\.load\(\)/,
  "Flesh em modo de teste deve retornar antes de carregar ou modificar o save");
assert.doesNotMatch(gate, /Conteúdo em desenvolvimento/);
assert.match(gate, /this\.testMode && this\.input\$\.isCancelJustDown\(\)[\s\S]*?this\.scene\.start\("MenuScene"\)/,
  "ESC/B deve sair diretamente da prévia do Portão");
assert.match(gate, /ESC \/ B voltar ao seletor/,
  "prévia deve informar o comando de retorno ao seletor");
assert.match(gate, /isMenuLeftJustDown\(\)[\s\S]*?this\.selected = "chrome"/);
assert.match(gate, /isMenuRightJustDown\(\)[\s\S]*?this\.selected = "flesh"/);
assert.match(ending, /FINAL CHROME/);
assert.match(ending, /FINAL FLESH/);
assert.match(ending, /FINAL HOLLOW/);
assert.match(ending, /ALEX\? FILHO\?/);
assert.match(retry, /unica segunda oportunidade/);
assert.match(retry, /isMenuLeftJustDown\(\)[\s\S]*?this\.selectChoice\(true\)/,
  "esquerda deve sempre selecionar repetir setor");
assert.match(retry, /isMenuRightJustDown\(\)[\s\S]*?this\.selectChoice\(false\)/,
  "direita deve sempre selecionar aceitar Hollow");
assert.match(retry, /setInteractive\(\{ useHandCursor: true \}\)/);
assert.match(retry, /pointerdown[\s\S]*?this\.confirmChoice\(\)/,
  "as duas opções de retry devem aceitar clique");
assert.match(reforge, /completeBioprinting\(\)/);
assert.match(reforge, /recycling\/holograma-pai\.png/);
assert.match(reforge, /recycling\/holograma-ciborgue\.png/);
assert.match(reforge, /step\.implant === "legs"/);
assert.match(reforge, /OPERADOR CIBORGUE/);
assert.match(reforge, /usesFatherAvatar \? REFORGE_FATHER : REFORGE_CYBORG/);
assert.match(reforge, /avatarHologram\.setVisible\(this\.page >= 1\)/);
assert.match(georgeRefusal, /george-angry\/george-angry\.png/);
assert.match(georgeRefusal, /alex-dialogue\/alex-complete-dialogue\.png/);
assert.match(georgeRefusal, /Eu não sou sua obra, George/);
assert.match(georgeRefusal, /recuperar cada motivo que deixei para trás/);
assert.match(georgeRefusal, /this\.scene\.start\("GameScene"/);
assert.match(gdd, /30 segundos por setor/);
assert.match(gdd, /operador ciborgue anônimo/);
assert.match(gdd, /Cena de reprovação de George antes do primeiro setor/);
assert.match(epilogue, /ending: "flesh" \| "hollow"/);
assert.match(descentRuntime, /memory_glitch/);
assert.match(descentRouteRuntime, /doubleJumpHazard/);
assert.match(descentRouteRuntime, /attackBarrierX/);
assert.match(descentRouteRuntime, /DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY/,
  "a travessia urbana da descida deve usar arte própria");
assert.match(descentRouteRuntime, /this\.route\.phaseId === "fase3"[\s\S]*?\.image\([\s\S]*?DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY/,
  "o hazard da D3 não pode permanecer um retângulo vermelho provisório");
assert.match(descentRouteRuntime, /DESCENT_ATTACK_BARRIER_TEXTURE_KEY/,
  "o lacre da ReForge deve usar um sprite dedicado");
assert.match(descentRouteRuntime, /this\.spawnBarrierFragments\(this\.barrier\)/,
  "destruir o lacre deve iniciar sua animação de quebra");
assert.match(descentRouteRuntime, /const columns = 2;[\s\S]*?const rows = 3;/,
  "a animação do lacre deve produzir seis fragmentos");
assert.match(descentRouteRuntime, /alpha: 0,[\s\S]*?fragment\.destroy\(\)/,
  "os fragmentos do lacre devem cair, desaparecer e ser destruídos");
assert.match(descentRouteRuntime, /DESCENT_REFORGE_DOOR_CLOSED_KEY/);
assert.match(descentRouteRuntime, /DESCENT_REFORGE_DOOR_OPEN_KEY/);
assert.match(descentRouteRuntime, /setMemoryRecovered\(recovered: boolean\)/);
assert.match(descentRouteRuntime, /MEMÓRIA VALIDADA \/\/ ACESSO ABERTO/);
assert.match(descentRouteRuntime, /MEMÓRIA AUSENTE — AVANÇAR COMPROMETE A DESCIDA/);
assert.match(game, /this\.descentRouteRuntime\?\.setMemoryRecovered\(true\)/,
  "coletar o fragmento deve abrir a porta ReForge");
assert.match(reforge, /phaseId: "fase1"[\s\S]*?descent: true/,
  "a ultima retirada deve abrir o trecho curto jogavel do Esgoto");
assert.match(menu, /descentState\.epiloguePending[\s\S]*?this\.scene\.start\("GameScene"[\s\S]*?descent: true/,
  "Continuar após a última ReForge deve restaurar o trecho jogável do Esgoto");
assert.match(game, /descentRouteForPhase\(this\.data\$\.phaseId\)\?\.epilogue[\s\S]*?completeDescentEpilogue\(\)/,
  "a pendência do Esgoto só deve ser limpa na saída do percurso");
for (const [phaseId, map] of [
  ["fase2-intro", "src/assets/maps/industrial/fase-2.tmj"],
  ["fase3", "src/assets/maps/meio-urbano/fase-3.tmj"],
  ["fase4", "src/assets/maps/corporativo/fase-4.tmj"],
  ["fase5", "src/assets/maps/topo/fase-5.tmj"],
]) {
  const tiled = JSON.parse(read(map));
  const objects = tiled.layers.find((layer) => layer.name === "objects")?.objects ?? [];
  assert.equal(objects.filter((object) => object.type === "memory_glitch").length, 1, `${map}: glitch da descida`);
  const route = DESCENT_ROUTES.find((candidate) => candidate.phaseId === phaseId);
  assert.ok(route, `${phaseId}: recorte da descida ausente`);
  assert.equal(route.endX - route.startX, 9_600, `${phaseId}: recorte deve medir 30 s`);
  assert.ok(
    objects.some((object) => object.type === "memory_glitch" && object.x >= route.startX && object.x <= route.endX),
    `${phaseId}: glitch deve estar dentro do recorte`,
  );
  assert.equal(
    objects.filter((object) => ["tutorial", "checkpoint"].includes(object.type)
      && object.x >= route.startX && object.x <= route.endX).length,
    0,
    `${phaseId}: recorte nao pode conter tutorial/checkpoint da subida`,
  );

  const immediateThreats = objects.filter((object) => (
    ["enemy", "hazard", "low_ceiling"].includes(object.type)
    && (object.x ?? 0) < route.startX + 64
    && (object.x ?? 0) + (object.width ?? 0) > route.startX - 64
  ));
  for (const threat of immediateThreats) {
    assert.ok(
      route.spawnSafeStartPx !== undefined
        && route.startX + route.spawnSafeStartPx >= (threat.x ?? 0) + (threat.width ?? 0),
      `${phaseId}: ${threat.name} sobrepoe o spawn sem janela segura suficiente`,
    );
  }
}
const sewerRoute = DESCENT_ROUTES.find((route) => route.phaseId === "fase1");
assert.ok(sewerRoute?.epilogue);
assert.equal(sewerRoute.endX - sewerRoute.startX, 1_600,
  "Esgoto deve ser um epilogo contemplativo de aproximadamente 5 s");
const urbanRoute = DESCENT_ROUTES.find((route) => route.phaseId === "fase3");
const industrialRoute = DESCENT_ROUTES.find((route) => route.phaseId === "fase2-intro");
assert.ok(urbanRoute?.doubleJumpHazard, "grade elétrica exclusiva deve permanecer na D3");
assert.equal(industrialRoute?.doubleJumpHazard, undefined,
  "D4 deve usar os gaps industriais do mapa, sem repetir o piso elétrico da D3");
assert.match(ending, /father\/pai-portrait\.png/);
assert.match(ending, /prologue\/familia\.png/,
  "Flesh e Hollow devem mostrar avô e tio, não reutilizar o retrato do pai");
assert.match(ending, /this\.ending === "chrome" \? FATHER_PORTRAIT_KEY : FAMILY_PORTRAIT_KEY/,
  "retrato do pai deve permanecer exclusivo do Final Chrome");
assert.match(ending, /this\.ending === "chrome" \? "PAI DE ALEX \/\/ CONVERSÃO CORPORATIVA" : "FAMÍLIA DE ALEX \/\/ CASA"/);
assert.match(ending, /CONVERSÃO CORPORATIVA/);
assert.match(ending, /alexTextureForAbilities\(saveData\.abilities\)/,
  "Final Hollow deve preservar o estágio corporal salvo no epílogo");
assert.match(ending, /CROMO REMANESCENTE/);
assert.match(ending, /if \(!this\.testMode\) SaveState\.load\(\)\.markEndingReached\(this\.ending\)/);
assert.ok(
  ending.indexOf("markEndingReached(this.ending)") > ending.indexOf("this.pageIndex < this.pages.length - 1"),
  "o final só pode ser registrado depois da confirmação do último quadro",
);
assert.match(phase4, /TILED_FATHER_AD_TEXTURE_KEY/);
assert.match(phase4, /GLITCH CORP \/\/ PROGRAMA DE ASCENSÃO/);
assert.match(phase4, /O rosto da campanha é familiar/);
assert.match(narrativePlaytest, /Portão — escolha final \(teste\)/);
assert.match(narrativePlaytest, /endingReached/);
assert.match(narrativePlaytest, /reprova a decisão de Alex/);
for (const asset of [
  "george-angry.png",
  "holograma-ciborgue.png",
  "reforge-door-open.png",
  "reforge-door-closed.png",
  "urban-electric-floor.png",
  "reforge-security-seal.png",
]) {
  assert.match(assetRegistry, new RegExp(asset.replaceAll(".", "\\.")), `${asset}: registro de asset ausente`);
}

// Interações reais dos handlers das cenas com um Phaser mínimo. Estes casos
// complementam os contratos estáticos e falham se uma ação de UI voltar a
// escrever no save ou iniciar a cena incorreta.
const uiData = {
  currentPhaseId: "fase1",
  checkpoint: { x: 0, y: 0, consolidatedCreditIds: [] },
  wallet: 0,
  abilities: { legs: true, arms: true, eyes: false, thrusters: false },
  descentState: {
    active: false,
    brokenChain: false,
    epiloguePending: true,
    currentStep: 2,
    recoveredFragmentIds: [],
    retryUsedPhaseIds: [],
    pendingRemoval: null,
  },
  endingReached: null,
};

{
  const harness = createUiHarness();
  const save = fakeSaveModule(uiData);
  const { GateScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/GateScene.ts"), harness, save.module,
  );
  const scene = new GateScene();
  scene.init({ testMode: true });
  scene.selected = "flesh";
  scene.previewNotice = new FakeDisplayObject();
  scene.confirmChoice();
  assert.equal(save.calls.load, 0, "prévia Flesh não deve sequer carregar o SaveState ao confirmar");
  assert.equal(save.calls.begin, 0, "prévia Flesh não deve iniciar a descida no save real");
  assert.equal(harness.starts.length, 0, "prévia Flesh deve permanecer no Portão com a orientação");
}

{
  const harness = createUiHarness();
  const retryData = {
    ...uiData,
    currentPhaseId: "fase3",
    descentState: { ...uiData.descentState, active: true, epiloguePending: false, currentStep: 2 },
  };
  const save = fakeSaveModule(retryData);
  const { DescentRetryScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/DescentRetryScene.ts"), harness, save.module,
  );
  const scene = new DescentRetryScene();
  scene.create();
  assert.ok(harness.texts.some((text) => String(text.value).includes("OS AMIGOS")),
    "retry deve mostrar o nome da memória perdida");

  scene.retrySelected = false;
  scene.input$ = interactiveInput("left");
  scene.update();
  assert.equal(scene.retrySelected, true);
  scene.input$ = interactiveInput("left");
  scene.update();
  assert.equal(scene.retrySelected, true, "esquerda repetida deve continuar em Repetir setor");
  scene.input$ = interactiveInput("right");
  scene.update();
  assert.equal(scene.retrySelected, false);
  scene.input$ = interactiveInput("right");
  scene.update();
  assert.equal(scene.retrySelected, false, "direita repetida deve continuar em Aceitar Hollow");

  scene.retrySelected = true;
  scene.input$ = interactiveInput("confirm");
  scene.update();
  assert.equal(harness.starts.at(-1)?.key, "GameScene",
    "ENTER/A do teclado ou controle deve confirmar Repetir setor");

  const mouseChoice = scene.choice(0, 0, "CONTINUAR", false);
  mouseChoice.emit("pointerdown");
  assert.equal(harness.starts.at(-1)?.key, "EpilogueScene", "clique deve confirmar Aceitar Hollow");
  assert.equal(save.calls.decline, 1);
}

{
  const harness = createUiHarness();
  const pendingData = {
    ...uiData,
    descentState: { ...uiData.descentState, currentStep: 4, epiloguePending: true },
  };
  const save = fakeSaveModule(pendingData);
  const { MenuScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/MenuScene.ts"), harness, save.module,
  );
  const scene = new MenuScene();
  scene.continueGame();
  assert.equal(harness.starts.at(-1)?.key, "GameScene");
  assert.equal(harness.starts.at(-1)?.data?.phaseId, "fase1");
  assert.equal(harness.starts.at(-1)?.data?.descent, true,
    "Continuar após a quarta ReForge deve restaurar o corredor do Esgoto");
}

{
  const harness = createUiHarness();
  const save = fakeSaveModule(uiData);
  const { EndingScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/EndingScene.ts"), harness, save.module,
  );
  const scene = new EndingScene();
  scene.init({ ending: "hollow" });
  scene.create();
  assert.equal(harness.sprites.at(-1)?.texture, "alex-arms",
    "Final Hollow deve usar o estágio corporal correspondente aos implantes restantes");
}

{
  const harness = createUiHarness();
  const fleshData = {
    ...uiData,
    abilities: { legs: false, arms: false, eyes: false, thrusters: false },
    descentState: { ...uiData.descentState, epiloguePending: false, currentStep: 4 },
  };
  const save = fakeSaveModule(fleshData);
  const { EpilogueScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/EpilogueScene.ts"), harness, save.module,
  );
  const epilogueScene = new EpilogueScene();
  epilogueScene.init({ ending: "flesh" });
  epilogueScene.create();
  epilogueScene.input$ = interactiveInput("confirm");
  epilogueScene.update();
  assert.deepEqual(save.calls.mark, [], "concluir o percurso visual ainda não registra Final Flesh");
  assert.equal(harness.starts.at(-1)?.key, "EndingScene");

  const { EndingScene } = loadSceneModule(
    path.join(projectDirectory, "src/scenes/EndingScene.ts"), harness, save.module,
  );
  const endingScene = new EndingScene();
  endingScene.init({ ending: "flesh" });
  endingScene.create();
  endingScene.advance();
  endingScene.advance();
  assert.deepEqual(save.calls.mark, [], "Final Flesh não pode ser registrado antes do último quadro");
  endingScene.advance();
  assert.deepEqual(save.calls.mark, ["flesh"], "última confirmação deve registrar Final Flesh");
}

for (const [sceneSource, name] of [
  [retry, "DescentRetryScene"],
  [ending, "EndingScene"],
  [epilogue, "EpilogueScene"],
]) {
  assert.match(sceneSource, /this\.scale\.width/,
    `${name} deve posicionar o layout pela largura expandida atual`);
  assert.match(sceneSource, /this\.scale\.height/,
    `${name} deve posicionar o layout pela altura expandida atual`);
  assert.doesNotMatch(sceneSource, /SCREEN_WIDTH|SCREEN_HEIGHT/,
    `${name} não deve permanecer preso à resolução-base`);
}

console.log("Narrativa: Chrome, descida, retry, ReForge, Flesh, Hollow e epilogo reproduziveis OK.");

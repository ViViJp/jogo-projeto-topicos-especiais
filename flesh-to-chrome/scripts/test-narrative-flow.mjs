import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

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

const { SaveState } = loadTypeScriptModule(path.join(projectDirectory, "src/systems/SaveState.ts"));
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
assert.deepEqual(Object.values(save.get().abilities), [false, false, false, false]);

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
const narrativePlaytest = read("docs/NARRATIVE_FLOW_PLAYTEST.md");

assert.match(main, /PrologueScene/);
assert.match(main, /GateScene/);
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
assert.doesNotMatch(gate, /markEndingReached\(/,
  "escolher Chrome ainda não significa concluir o final");
assert.match(gate, /\{ ending: "chrome", testMode: this\.testMode \}/);
assert.match(gate, /beginDescent\(\)/);
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
assert.match(reforge, /completeBioprinting\(\)/);
assert.match(epilogue, /ending: "flesh" \| "hollow"/);
assert.match(descentRuntime, /memory_glitch/);
for (const map of [
  "src/assets/maps/industrial/fase-2.tmj",
  "src/assets/maps/meio-urbano/fase-3.tmj",
  "src/assets/maps/corporativo/fase-4.tmj",
  "src/assets/maps/topo/fase-5.tmj",
]) {
  const tiled = JSON.parse(read(map));
  const objects = tiled.layers.find((layer) => layer.name === "objects")?.objects ?? [];
  assert.equal(objects.filter((object) => object.type === "memory_glitch").length, 1, `${map}: glitch da descida`);
}
assert.match(ending, /father\/pai-portrait\.png/);
assert.match(ending, /CONVERSÃO CORPORATIVA/);
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
assert.match(narrativePlaytest, /sem criar snapshot ou modificar o save/);

console.log("Narrativa: Chrome, descida, retry, ReForge, Flesh, Hollow e epilogo reproduziveis OK.");

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

const read = (relativePath) => fs.readFileSync(path.join(projectDirectory, relativePath), "utf8");
const main = read("src/main.ts");
const menu = read("src/scenes/MenuScene.ts");
const prologue = read("src/scenes/PrologueScene.ts");
const clinic = read("src/scenes/ClinicScene.ts");
const gate = read("src/scenes/GateScene.ts");
const ending = read("src/scenes/EndingScene.ts");
const game = read("src/scenes/GameScene.ts");
const phase4 = read("src/objects/TiledPhase4Runtime.ts");

assert.match(main, /PrologueScene/);
assert.match(main, /GateScene/);
assert.match(menu, /Continuar do Portão/);
assert.match(menu, /restorePreGateSave\(\)/);
assert.match(menu, /this\.scene\.start\("PrologueScene"\)/);
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
assert.match(game, /this\.data\$\.phaseId === "fase5"[\s\S]*?"GateScene"/);
assert.match(gate, /createPreGateSave\(\)/);
assert.match(gate, /markEndingReached\("chrome"\)/);
assert.match(gate, /Conteúdo em desenvolvimento/);
assert.match(ending, /FINAL CHROME/);
assert.match(ending, /ALEX\? FILHO\?/);
assert.match(ending, /father\/pai-portrait\.png/);
assert.match(ending, /CONVERSÃO CORPORATIVA/);
assert.match(phase4, /TILED_FATHER_AD_TEXTURE_KEY/);
assert.match(phase4, /GLITCH CORP \/\/ PROGRAMA DE ASCENSÃO/);
assert.match(phase4, /O rosto da campanha é familiar/);

console.log("Narrativa: prólogo, clínicas, propaganda, Portão, Final Chrome e save pré-Portão OK.");

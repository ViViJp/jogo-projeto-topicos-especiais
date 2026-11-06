import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadTypeScriptModule(relativePath) {
  const filename = path.join(projectDirectory, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  new vm.Script(output, { filename }).runInNewContext({ module, exports: module.exports });
  return module.exports;
}

const motion = loadTypeScriptModule("src/objects/HazardMotion.ts");
const config = loadTypeScriptModule("src/config/GameConfig.ts");
const timing = { cycleMs: 1000, activeMs: 200, warningMs: 100, phaseMs: 0 };
assert.equal(motion.hazardCycleState(0, timing), "active");
assert.equal(motion.hazardCycleState(199, timing), "active");
assert.equal(motion.hazardCycleState(200, timing), "inactive");
assert.equal(motion.hazardCycleState(899, timing), "inactive");
assert.equal(motion.hazardCycleState(900, timing), "warning");
assert.equal(motion.hazardCycleState(999, timing), "warning");
assert.equal(motion.hazardCycleState(1000, timing), "active");
assert.equal(motion.hazardCycleState(900, { ...timing, phaseMs: 100 }), "active");
for (const [kind, values] of Object.entries(config.GAMEPLAY_TIMING.industrialHazards)) {
  assert.ok(values.activeMs > 0, `${kind}: precisa de janela ativa`);
  assert.ok(values.warningMs >= 300, `${kind}: aviso deve ser legível`);
  assert.ok(values.cycleMs - values.activeMs - values.warningMs >= 700, `${kind}: janela segura`);
}

const horizontal = motion.rotatingBarrierPoints(100, 200, 96, 7, 0);
assert.equal(horizontal.length, 7);
assert.equal(horizontal[0].x, 52);
assert.equal(horizontal[0].y, 200);
assert.equal(horizontal[6].x, 148);
assert.equal(horizontal[6].y, 200);
for (let index = 1; index < horizontal.length; index += 1) {
  assert.ok(horizontal[index].x > horizontal[index - 1].x);
}
const vertical = motion.rotatingBarrierPoints(100, 200, 96, 7, Math.PI / 2);
assert.ok(Math.abs(vertical[0].x - 100) < 0.000001);
assert.ok(Math.abs(vertical[0].y - 152) < 0.000001);
assert.ok(Math.abs(vertical[6].y - 248) < 0.000001);

const maps = [
  "src/assets/maps/esgoto/fase-1.json",
  "src/assets/maps/industrial/fase-2.json",
  "src/assets/maps/meio-urbano/fase-3.json",
  "src/assets/maps/corporativo/fase-4.json",
  "src/assets/maps/topo/fase-5.json",
];
for (const relativePath of maps) {
  const map = JSON.parse(fs.readFileSync(path.join(projectDirectory, relativePath), "utf8"));
  const objects = map.layers.find((layer) => layer.name === "objects")?.objects ?? [];
  assert.equal(objects.filter((object) => object.type === "spawn").length, 1, `${relativePath}: spawn`);
  assert.equal(objects.filter((object) => object.type === "checkpoint").length, 1, `${relativePath}: checkpoint`);
  assert.equal(objects.filter((object) => object.type === "phase_end").length, 1, `${relativePath}: phase_end`);
}

function objectProperty(object, name) {
  return object.properties?.find((property) => property.name === name)?.value;
}

const phase2 = JSON.parse(fs.readFileSync(path.join(projectDirectory, maps[1]), "utf8"));
const phase2Objects = phase2.layers.find((layer) => layer.name === "objects").objects;
const industrialKinds = new Set(
  phase2Objects.filter((object) => object.type === "hazard").map((object) => objectProperty(object, "kind")),
);
assert.deepEqual([...industrialKinds].sort(), ["crusher", "mech_arm", "press", "steam"]);
const lowCeilingLayer = phase2.layers.find((layer) => layer.name === "deco-low-ceilings");
const lowCeilingTiles = lowCeilingLayer.data.filter((gid) => gid !== 0);
assert.equal(lowCeilingTiles.length, 42, "fase2: sete obstáculos baixos com seis tiles cada");
assert.deepEqual(
  [...new Set(lowCeilingTiles)].sort((left, right) => left - right),
  [25, 26, 27],
  "fase2: obstáculos baixos devem usar o duto industrial, não os tiles do chão",
);

const phase5 = JSON.parse(fs.readFileSync(path.join(projectDirectory, maps[4]), "utf8"));
const phase5Objects = phase5.layers.find((layer) => layer.name === "objects").objects;
const rotatingBarriers = phase5Objects.filter(
  (object) => object.type === "hazard" && objectProperty(object, "kind") === "rotating_barrier",
);
assert.equal(rotatingBarriers.length, 5);
assert.ok(rotatingBarriers.every((barrier) => Math.max(barrier.width, barrier.height) >= 96));

const gameScene = fs.readFileSync(path.join(projectDirectory, "src/scenes/GameScene.ts"), "utf8");
assert.match(gameScene, /this\.time\.paused = true/);
assert.match(gameScene, /this\.anims\.pauseAll\(\)/);
assert.match(gameScene, /checkpointX: 0/);
assert.match(gameScene, /checkpointY: 0/);
for (const runtime of ["TiledPhase2Runtime.ts", "TiledPhase4Runtime.ts", "TiledPhase5Runtime.ts"]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.doesNotMatch(source, /scene\.time\.now/, `${runtime}: timer absoluto avança durante a pausa`);
}

console.log("Gameplay flow: ciclos, barreiras e estrutura das cinco fases validados.");

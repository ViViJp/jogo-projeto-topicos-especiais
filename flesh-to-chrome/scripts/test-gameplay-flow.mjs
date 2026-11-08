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
const { CreditsSystem } = loadTypeScriptModule("src/systems/CreditsSystem.ts");
const timing = { cycleMs: 1000, activeMs: 200, warningMs: 100, phaseMs: 0 };
assert.equal(motion.hazardCycleState(0, timing), "active");
assert.equal(motion.hazardCycleState(199, timing), "active");
assert.equal(motion.hazardCycleState(200, timing), "inactive");
assert.equal(motion.hazardCycleState(899, timing), "inactive");
assert.equal(motion.hazardCycleState(900, timing), "warning");
assert.equal(motion.hazardCycleState(999, timing), "warning");
assert.equal(motion.hazardCycleState(1000, timing), "active");
assert.equal(motion.hazardCycleState(900, { ...timing, phaseMs: 100 }), "active");
assert.equal(motion.hazardCycleSample(100, timing).progress, 0.5);
assert.equal(motion.hazardCycleSample(900, timing).progress, 0);
assert.ok(Math.abs(motion.hazardCycleSample(950, timing).progress - 0.5) < 0.000001);
const scanDoors = [
  { x: 500, width: 32, disabled: false },
  { x: 820, width: 32, disabled: false },
];
assert.equal(motion.nearestScanObstacleIndex(100, 900, scanDoors), 0);
scanDoors[0].disabled = true;
assert.equal(motion.nearestScanObstacleIndex(100, 900, scanDoors), 1);
assert.equal(motion.nearestScanObstacleIndex(900, 900, scanDoors), -1, "porta ultrapassada não consome scan");
assert.equal(motion.nearestScanObstacleIndex(0, 400, scanDoors), -1, "porta fora do alcance não abre");
for (const [kind, values] of Object.entries(config.GAMEPLAY_TIMING.industrialHazards)) {
  assert.ok(values.activeMs > 0, `${kind}: precisa de janela ativa`);
  assert.ok(values.warningMs >= 300, `${kind}: aviso deve ser legível`);
  assert.ok(values.cycleMs - values.activeMs - values.warningMs >= 700, `${kind}: janela segura`);
}
assert.ok(config.PHYSICS.attack.animDurationMs >= 350, "ataque precisa permanecer legível");
assert.ok(config.PHYSICS.attack.activeMs >= 250, "ataque precisa de janela ativa útil");
assert.ok(config.PHYSICS.attack.range >= 80, "ataque precisa alcançar o inimigo à frente");
assert.ok(config.PHYSICS.attack.activeMs < config.PHYSICS.attack.animDurationMs);

const credits = new CreditsSystem(30, ["old-phase-credit"]);
credits.collect("current-phase-credit", 10);
assert.equal(credits.getPhaseDisplayValue(0), 10);
assert.equal(credits.getTotal(), 30, "crédito só entra na carteira ao consolidar");
credits.consolidate();
assert.equal(credits.getTotal(), 40);
assert.equal(credits.getPhaseDisplayValue(10), 10, "HUD preserva consolidado da fase após respawn");
assert.deepEqual([...credits.getConsolidatedIds()].sort(), ["current-phase-credit", "old-phase-credit"]);

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
assert.deepEqual([...industrialKinds].sort(), ["mech_arm", "press", "steam"]);
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
const phase5Breakables = phase5Objects.filter((object) => object.type === "breakable");
const phase5Credits = phase5Objects.filter((object) => object.type === "credit");
for (const credit of phase5Credits) {
  assert.ok(
    !phase5Breakables.some((obstacle) => (
      credit.x >= obstacle.x
      && credit.x <= obstacle.x + obstacle.width
      && credit.y >= obstacle.y
      && credit.y <= obstacle.y + obstacle.height
    )),
    `fase5: ${credit.name} não pode ficar dentro de uma barricada`,
  );
}
const phase5RuntimeSource = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase5Runtime.ts"), "utf8");
assert.match(phase5RuntimeSource, /height \/ 2 - 16/, "fase5: barreira rotativa precisa de janela horizontal segura");
assert.match(phase5RuntimeSource, /TILED_PHASE5_BARRICADE_TEXTURE_KEY/);
assert.match(phase5RuntimeSource, /groundY \+ ASSET_BASELINE_PADDING/);
assert.match(phase5RuntimeSource, /TILED_PHASE5_GATE_TEXTURE_KEY/);
assert.match(phase5RuntimeSource, /bottomY \+ ASSET_BASELINE_PADDING/);

const gameScene = fs.readFileSync(path.join(projectDirectory, "src/scenes/GameScene.ts"), "utf8");
assert.match(gameScene, /this\.time\.paused = true/);
assert.match(gameScene, /this\.anims\.pauseAll\(\)/);
assert.match(gameScene, /checkpointX: 0/);
assert.match(gameScene, /checkpointY: 0/);
for (const runtime of ["TiledPhase2Runtime.ts", "TiledPhase4Runtime.ts", "TiledPhase5Runtime.ts"]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.doesNotMatch(source, /scene\.time\.now/, `${runtime}: timer absoluto avança durante a pausa`);
}
const phase2Runtime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase2Runtime.ts"), "utf8");
assert.match(phase2Runtime, /hazardCycleSample/);
assert.match(phase2Runtime, /updateFromGameObject/);
assert.match(phase2Runtime, /TILED_PHASE2_PRESS_TEXTURE_KEY/);
assert.match(phase2Runtime, /const nozzleY = hazard\.y \+ hazard\.height - this\.map\.tileHeight/);
assert.match(phase2Runtime, /const travel = hazard\.height \* 0\.96/);
assert.match(phase2Runtime, /const collisionHeight = Math\.max\(96, hazard\.height \* 1\.5\)/);
assert.match(phase2Runtime, /collisionHeight,\s*true,/);
assert.doesNotMatch(phase2Runtime, /hazard\.kind === "crusher"/);
assert.ok(
  fs.existsSync(path.join(projectDirectory, "src/assets/props/hazards/hydraulic-press.png")),
  "fase2: sprite dedicado da prensa",
);
for (const kind of ["press", "steam", "mech_arm"]) {
  assert.match(phase2Runtime, new RegExp(`hazard\\.kind === "${kind}"`), `fase2: movimento de ${kind}`);
}
for (const runtime of [
  "TiledLevelRuntime.ts",
  "TiledPhase2Runtime.ts",
  "TiledPhase3Runtime.ts",
  "TiledPhase4Runtime.ts",
  "TiledPhase5Runtime.ts",
]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.match(source, /if \(this\.consolidatedThisPhase\.has\([^)]*\.id\)\) continue/,
    `${runtime}: crédito consolidado deve sumir apenas da criação do sprite`);
  const creditCatalog = source.slice(
    source.indexOf(runtime === "TiledLevelRuntime.ts" ? 'for (const o of byType("credit"))' : "private readCredits"),
    source.indexOf(runtime === "TiledLevelRuntime.ts" ? 'for (const o of byType("checkpoint"))' : "private readCheckpoints"),
  );
  assert.doesNotMatch(creditCatalog, /consolidatedThisPhase/,
    `${runtime}: catálogo usado pelo HUD precisa manter créditos já consolidados`);
}
for (const runtime of ["TiledPhase4Runtime.ts", "TiledPhase5Runtime.ts"]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.match(source, /nearestScanObstacleIndex/);
  assert.match(source, /setDoorDisabled/);
  assert.match(source, /physics\.add\.overlap\(player\.sprite, door\.zone, \(\) => player\.kill\(\)\)/);
  assert.doesNotMatch(source, /collider\(player\.sprite, door\.zone/);
  assert.match(source, /const collisionTop =/);
  assert.match(source, /const collisionBottom = this\.groundSurfaceYAt\(x\)/);
  assert.match(source, /tile\.alpha = disabled \? 0 : 1/);
  assert.match(source, /\.setVisible\(!disabled\)/);
  assert.doesNotMatch(source, /% door\.cycleMs/, `${runtime}: porta não pode depender do relógio`);
}
const phase4Runtime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase4Runtime.ts"), "utf8");
assert.match(phase4Runtime, /this\.scene\.physics\.add\.collider\(player\.sprite, wall\.zone\)/);
assert.match(phase4Runtime, /body\.enable = !intangible/);
assert.match(phase4Runtime, /if \(!active\) return/);
assert.match(phase4Runtime, /\.forEach\(\(wall\) => this\.setFalseWallIntangible\(wall, true\)\)/);
assert.match(phase4Runtime, /tile\.alpha = intangible \? 0 : 1/);
assert.doesNotMatch(
  phase4Runtime,
  /setFalseWallIntangible\(wall, false\)/,
  "fase4: parede resolvida pelo scan não pode recuperar colisão durante a tentativa",
);
assert.match(phase4Runtime, /BACKGROUND_TOWER_GID/);
assert.match(phase4Runtime, /FLOATING_TERMINAL_GID/);
assert.match(phase4Runtime, /putTileAt\(DOOR_FIRST_GID, doorCol, bottomTileRow - 1\)/);
assert.match(phase4Runtime, /bottomTile\.visible = false/);
assert.match(phase4Runtime, /\.setVisible\(true\)/);
const phase5Runtime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase5Runtime.ts"), "utf8");
assert.match(phase5Runtime, /disabledDoors !== 0/);
assert.match(phase5Runtime, /gateObjects\[0\]\?\.x \?\? endObject\?\.x/);
const playerSource = fs.readFileSync(path.join(projectDirectory, "src/entities/Player.ts"), "utf8");
assert.match(playerSource, /this\.sprite\.setDepth\(10\)/);
assert.match(playerSource, /this\.sprite\.setDepth\(this\.depthBeforeCheckpoint\)/);
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.checkpointAnimationKey, true\)/);
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.attackAnimationKey, true\)/);
assert.match(playerSource, /delay <= PHYSICS\.attack\.activeMs/);
assert.match(playerSource, /this\.emitAttackPulse\(false\)/);
assert.doesNotMatch(playerSource, /showAttackFeedback/, "ataque deve usar o spritesheet, não o arco provisório");
const checkpointMethod = playerSource.slice(
  playerSource.indexOf("beginCheckpointInteraction"),
  playerSource.indexOf("endCheckpointInteraction"),
);
assert.doesNotMatch(checkpointMethod, /ALEX_SLIDE_FRAME/, "checkpoint não pode reutilizar a pose de slide");
const alexSpriteSource = fs.readFileSync(path.join(projectDirectory, "src/utils/AlexSprite.ts"), "utf8");
assert.match(alexSpriteSource, /CHECKPOINT_PLAY_RIGHT = \{ row: 33, frames: 2 \}/);
assert.match(alexSpriteSource, /ATTACK_RIGHT = \{ row: 15, frames: 6 \}/);
assert.match(alexSpriteSource, /frameRate: 16/);
const enemyRuntime = fs.readFileSync(path.join(projectDirectory, "src/objects/EnemyRuntime.ts"), "utf8");
assert.match(enemyRuntime, /bandido: 1\.45/);
assert.match(enemyRuntime, /drone: 1\.8/);
assert.doesNotMatch(enemyRuntime, /setAlpha\(0\.35\)/, "inimigos não podem permanecer opacos");
assert.match(enemyRuntime, /PHYSICS\.attack\.range/);
const hudSource = fs.readFileSync(path.join(projectDirectory, "src/systems/HUD.ts"), "utf8");
assert.match(hudSource, /setFillStyle\(0x21d7ff, 1\)/, "dash pronto deve usar azul elétrico");
assert.match(hudSource, /batteryBack,[\s\S]*this\.dashBatteryFill,[\s\S]*frame,/,
  "preenchimento da bateria precisa ficar sobre o fundo e sob a moldura");
assert.match(gameScene, /beginCheckpointInteraction\(x - 24, y\)/);
assert.match(gameScene, /const alreadyActive = this\.data\$\.checkpointX > 0/);
assert.match(gameScene, /if \(alreadyActive\) return false/);
assert.match(gameScene, /checkpointX: 0/);
assert.match(gameScene, /checkpointY: 0/);
const pausedBranch = gameScene.slice(gameScene.indexOf("if (this.isPaused)"), gameScene.indexOf("this.player.update(delta)"));
assert.match(pausedBranch, /return;/, "pausa deve retornar antes de atualizar Player e cooldowns");
assert.match(gameScene, /S \/ ↓ para voltar ao menu principal/);
assert.match(
  pausedBranch,
  /if \(this\.input\$\.isMenuDownJustDown\(\)\)/,
  "retorno ao menu durante a pausa deve funcionar também na campanha",
);
assert.doesNotMatch(
  pausedBranch,
  /this\.data\$\.testMode\s*&&\s*this\.input\$\.isMenuDownJustDown/,
  "retorno ao menu não pode ficar restrito ao seletor de fases",
);
const checkpointMarker = fs.readFileSync(path.join(projectDirectory, "src/objects/CheckpointMarker.ts"), "utf8");
assert.match(checkpointMarker, /activate\(withFeedback = true\)/);
assert.match(checkpointMarker, /if \(!withFeedback\) return/);
for (const runtime of [
  "TiledLevelRuntime.ts",
  "TiledPhase2Runtime.ts",
  "TiledPhase3Runtime.ts",
  "TiledPhase4Runtime.ts",
  "TiledPhase5Runtime.ts",
]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.match(source, /activate\(withFeedback\)/, `${runtime}: respawn deve restaurar TV sem feedback`);
}

console.log("Gameplay flow: movimentos, barreiras por scan e estrutura das cinco fases validados.");

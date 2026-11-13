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
assert.equal(config.GAMEPLAY_TIMING.checkpointInteractionMs, 1500);
assert.ok(
  config.GAMEPLAY_TIMING.checkpointSitMs + config.GAMEPLAY_TIMING.checkpointStandMs
    < config.GAMEPLAY_TIMING.checkpointInteractionMs,
  "checkpoint deve reservar tempo para a sincronização entre sentar e levantar",
);
assert.ok(config.GAMEPLAY_TIMING.checkpointPlayerOffsetX >= 48,
  "Alex deve permanecer ao lado da TV, sem atravessar o gabinete");

const credits = new CreditsSystem(30, ["old-phase-credit"]);
credits.collect("current-phase-credit", 10);
assert.equal(credits.getPhaseDisplayValue(0), 10);
assert.equal(credits.getTotal(), 30, "crédito só entra na carteira ao consolidar");
credits.consolidate();
assert.equal(credits.getTotal(), 40);
assert.equal(credits.getPhaseDisplayValue(10), 10, "HUD preserva consolidado da fase após respawn");
assert.deepEqual([...credits.getConsolidatedIds()].sort(), ["current-phase-credit", "old-phase-credit"]);

const restartCredits = new CreditsSystem(130, ["previous-phase-credit", "phase-a", "phase-b"]);
restartCredits.collect("phase-c", 10);
restartCredits.resetPhase([
  { id: "phase-a", value: 10 },
  { id: "phase-b", value: 20 },
  { id: "phase-c", value: 10 },
]);
assert.equal(restartCredits.getTotal(), 100,
  "reinício manual deve devolver a carteira ao valor de entrada da fase");
assert.deepEqual([...restartCredits.getConsolidatedIds()], ["previous-phase-credit"],
  "reinício manual deve preservar somente créditos de fases anteriores");
assert.equal(restartCredits.getPhaseDisplayValue(0), 0,
  "créditos ainda não consolidados também devem ser apagados no reinício");

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
assert.deepEqual(
  phase2Objects
    .filter((object) => object.type === "hazard" && objectProperty(object, "kind") === "press" && object.x < 6500)
    .map((object) => object.name),
  ["press_01", "press_03"],
  "fase2: o conjunto inicial deve manter somente as prensas das extremidades",
);
const phase2Hazards = phase2.layers.find((layer) => layer.name === "hazards");
for (const row of [10, 11]) {
  assert.equal(phase2Hazards.data[row * phase2.width + 185], 0,
    `fase2: bloco residual da prensa central deve ser removido na linha ${row}`);
}
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
const firstScanFloor = phase5Objects.find((object) => object.name === "false_floor_01");
const firstHiddenHazards = phase5Objects.find((object) => object.name === "hidden_hazards_01");
assert.equal(firstScanFloor.x + firstScanFloor.width, firstHiddenHazards.x,
  "fase5: áreas iniciais de scan devem ser adjacentes, sem sobrepor o laser oculto");
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
assert.match(phase5RuntimeSource, /TILED_PHASE5_ROTATING_BARRIER_TEXTURE_KEY/,
  "fase5: barreira rotativa deve usar o sprite final");
assert.doesNotMatch(phase5RuntimeSource, /\.rectangle\(centerX, centerY, length/,
  "fase5: barreira rotativa não pode voltar ao retângulo provisório");
assert.ok(fs.existsSync(path.join(
  projectDirectory,
  "src/assets/props/hazards/rotating-energy-barrier.png",
)));
assert.match(phase5RuntimeSource, /TILED_PHASE5_BARRICADE_TEXTURE_KEY/);
assert.match(phase5RuntimeSource, /this\.spawnBarricadeFragments\(target\.visual\)/,
  "barricadas da Fase 5 devem executar a animação antes de desaparecer");
assert.match(phase5RuntimeSource, /const columns = 3;[\s\S]*?const rows = 2;/,
  "animação da Fase 5 deve dividir a barricada em seis fragmentos");
assert.match(phase5RuntimeSource, /onComplete: \(\) => \{[\s\S]*?alpha: 0,[\s\S]*?fragment\.destroy\(\)/,
  "fragmentos devem subir no impacto, cair e desaparecer");
assert.match(phase5RuntimeSource, /groundY \+ ASSET_BASELINE_PADDING/);
assert.match(phase5RuntimeSource, /TILED_PHASE5_GATE_TEXTURE_KEY/);
assert.match(phase5RuntimeSource, /bottomY \+ ASSET_BASELINE_PADDING/);
assert.match(phase5RuntimeSource, /hideAfterX\(worldX: number\)/,
  "recorte Flesh do Topo deve remover conteúdo posterior à porta ReForge");
assert.match(phase5RuntimeSource, /const groundExtension = layer === this\.groundLayer \? 128 : 0/,
  "a soleira do Topo deve sustentar toda a largura da porta ReForge");

const gameScene = fs.readFileSync(path.join(projectDirectory, "src/scenes/GameScene.ts"), "utf8");
const mainSource = fs.readFileSync(path.join(projectDirectory, "src/main.ts"), "utf8");
assert.match(mainSource, /mode: Phaser\.Scale\.EXPAND/,
  "canvas deve preencher todo o viewport sem barras laterais");
assert.match(gameScene, /const viewportWidth = this\.cameras\.main\.width/,
  "câmera deve considerar a largura expandida do viewport");
assert.match(gameScene, /this\.scale\.width \/ 2, this\.scale\.height \/ 2/,
  "overlays devem permanecer centralizados no viewport expandido");
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
assert.match(phase2Runtime, /excludeObstaclesThroughX/,
  "recorte industrial deve poder excluir ameaças sobrepostas ao spawn");
assert.match(phase2Runtime, /excludedLowCeilings\.forEach\(\(object\) => this\.hideObjectTiles\(this\.lowCeilingsLayer, object, true\)\)/,
  "teto baixo excluído da D4 não pode permanecer visível no spawn");
assert.match(phase2Runtime, /const startRow = allRowsInColumns \? 0/,
  "offset visual do teto baixo exige limpar todas as linhas das colunas excluídas");
assert.match(phase2Runtime, /lowCeilingObjects\.filter\(\(object\) => !this\.isExcludedStartObstacle\(object\)\)/,
  "teto baixo excluído da D4 não pode manter a zona letal");
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
  assert.match(source, /new ScanBarrierVisual\(/,
    `${runtime}: porta de scan deve montar uma única barreira contínua`);
  assert.match(source, /door\.visual\.setEnabled\(!disabled\)/);
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
assert.match(phase4Runtime, /firstDoorTileRow \?\?= row/);
assert.match(phase4Runtime, /tile\.visible = false/);
assert.match(phase4Runtime, /\.setVisible\(true\)/);
const phase5Runtime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase5Runtime.ts"), "utf8");
assert.match(phase5Runtime, /disabledDoors !== 0/);
assert.match(phase5Runtime, /gateObjects\[0\]\?\.x \?\? endObject\?\.x/);
const playerSource = fs.readFileSync(path.join(projectDirectory, "src/entities/Player.ts"), "utf8");
assert.match(playerSource, /this\.sprite\.setDepth\(10\)/);
assert.match(playerSource, /this\.sprite\.setDepth\(this\.depthBeforeCheckpoint\)/);
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.checkpointSitAnimationKey, true\)/);
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.checkpointInteractAnimationKey, true\)/);
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.checkpointStandAnimationKey, true\)/);
assert.match(playerSource, /GAMEPLAY_TIMING\.checkpointStandMs[\s\S]*?this\.state = "running"/,
  "corrida só pode voltar depois que Alex terminar de levantar");
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.attackAnimationKey, true\)/);
assert.match(playerSource, /delay <= PHYSICS\.attack\.activeMs/);
assert.match(playerSource, /this\.emitAttackPulse\(false\)/);
assert.match(playerSource, /const attackSequence = \+\+this\.attackSequence/);
assert.match(playerSource, /this\.attackSequence === attackSequence/);
assert.doesNotMatch(playerSource, /showAttackFeedback/, "ataque deve usar o spritesheet, não o arco provisório");
assert.doesNotMatch(playerSource, /spawnAttackFx/,
  "ataque não deve recriar o arco visual removido no polimento");
const jumpMethod = playerSource.slice(playerSource.indexOf("private handleJump"), playerSource.indexOf("private handleSlide"));
assert.match(jumpMethod, /this\.transitionState\("jumping", true\)/,
  "ataque → pulo deve invalidar o golpe e restaurar a pose");
const dashMethod = playerSource.slice(playerSource.indexOf("private handleDash"), playerSource.indexOf("destroy(): void"));
assert.match(dashMethod, /this\.transitionState\("dashing", true\)/,
  "ataque → dash deve invalidar o golpe e restaurar a pose");
assert.match(playerSource, /kill\(\): void \{[\s\S]*?this\.transitionState\("dead"\)/,
  "ataque → morte deve invalidar callbacks pendentes");
assert.match(playerSource, /respawn\([\s\S]*?this\.attackSequence \+= 1;[\s\S]*?this\.applyRunningPose\(\)/,
  "respawn deve invalidar ataques anteriores e restaurar a corrida");
const checkpointMethod = playerSource.slice(
  playerSource.indexOf("beginCheckpointInteraction"),
  playerSource.indexOf("endCheckpointInteraction"),
);
assert.doesNotMatch(checkpointMethod, /ALEX_SLIDE_FRAME/, "checkpoint não pode reutilizar a pose de slide");
const alexSpriteSource = fs.readFileSync(path.join(projectDirectory, "src/utils/AlexSprite.ts"), "utf8");
assert.match(alexSpriteSource, /alexCheckpointTextureKey\(textureKey\)/);
assert.match(alexSpriteSource, /generateFrameNumbers\(checkpointTextureKey, \{ start: 0, end: 2 \}\)/);
assert.match(alexSpriteSource, /generateFrameNumbers\(checkpointTextureKey, \{ start: 2, end: 3 \}\)/);
assert.match(alexSpriteSource, /generateFrameNumbers\(checkpointTextureKey, \{ start: 3, end: 4 \}\)/);
assert.match(alexSpriteSource, /ATTACK_RIGHT = \{ row: 15, frames: 6 \}/);
assert.match(alexSpriteSource, /frameRate: 16/);
const enemyRuntime = fs.readFileSync(path.join(projectDirectory, "src/objects/EnemyRuntime.ts"), "utf8");
assert.match(enemyRuntime, /bandido: 1\.45/);
assert.match(enemyRuntime, /drone: 1\.8/);
assert.doesNotMatch(enemyRuntime, /setAlpha\(0\.35\)/, "inimigos não podem permanecer opacos");
assert.match(enemyRuntime, /PHYSICS\.attack\.range/);
const phase3Runtime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledPhase3Runtime.ts"), "utf8");
assert.match(phase3Runtime, /excludeEnemiesThroughX/,
  "recorte urbano deve poder excluir inimigos sobrepostos ao spawn");
assert.match(phase4Runtime, /hideBeforeX\(worldX: number, flatGroundWidthPx = 0\)/,
  "recorte corporativo deve ocultar o segmento anterior ao spawn");
assert.match(phase4Runtime, /this\.groundLayer\.putTileAt\(template\.index, col, template\.row\)/,
  "recorte corporativo deve reconstruir um piso plano à esquerda do spawn");
assert.match(phase4Runtime, /moveFatherAdToDescentStart\(startX: number\)/,
  "propaganda do pai deve poder marcar o início do caminho de volta");
const hudSource = fs.readFileSync(path.join(projectDirectory, "src/systems/HUD.ts"), "utf8");
assert.match(hudSource, /setFillStyle\(0x21d7ff, 1\)/, "dash pronto deve usar azul elétrico");
assert.match(hudSource, /batteryBack,[\s\S]*this\.dashBatteryFill,[\s\S]*frame,/,
  "preenchimento da bateria precisa ficar sobre o fundo e sob a moldura");
assert.match(gameScene, /beginCheckpointInteraction\(x - GAMEPLAY_TIMING\.checkpointPlayerOffsetX, y\)/);
assert.match(gameScene, /checkpointInteractionMs - GAMEPLAY_TIMING\.checkpointStandMs/);
const manualRestartMethod = gameScene.slice(
  gameScene.indexOf("private restartFromPhaseStart"),
  gameScene.indexOf("private handleScanPulse"),
);
assert.match(manualRestartMethod, /this\.credits\.resetPhase\(this\.phaseCredits\(\)\)/,
  "reinício manual deve zerar créditos da fase nas cinco implementações");
assert.match(manualRestartMethod, /checkpointX: 0/);
assert.match(manualRestartMethod, /checkpointY: 0/);
assert.match(gameScene, /showFeedback = true[\s\S]*?if \(showFeedback\) this\.hud\.flashPrompt\("ATAQUE", 300\)/,
  "somente o primeiro pulso do golpe deve atualizar o HUD");
assert.match(gameScene, /const alreadyActive = this\.data\$\.checkpointX > 0/);
assert.match(gameScene, /if \(alreadyActive\) return false/);
assert.match(gameScene, /checkpointX: 0/);
assert.match(gameScene, /checkpointY: 0/);
assert.match(gameScene, /runtime\.hideBeforeX\(descentRoute\.startX, this\.scale\.width\)/,
  "o piso de aproximação do Corporativo deve cobrir uma tela inteira");
assert.match(gameScene, /runtime\.moveFatherAdToDescentStart\(descentRoute\.startX\)/,
  "a descida Corporativa deve começar pela propaganda do pai");
assert.match(gameScene, /excludeObstaclesThroughX:[\s\S]*?descentRoute\.startX \+ descentRoute\.spawnSafeStartPx/,
  "D4 deve aplicar a janela segura aos hazards e tetos baixos");
assert.match(gameScene, /excludeEnemiesThroughX:[\s\S]*?descentRoute\.startX \+ descentRoute\.spawnSafeStartPx/,
  "D3 deve aplicar a mesma janela segura aos inimigos");
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
assert.match(checkpointMarker, /0x36e2ff/, "sincronização da TV deve pulsar em ciano");
assert.match(checkpointMarker, /0x68ff9c/, "sincronização da TV deve pulsar em verde");
assert.match(checkpointMarker, /targets: scanLine/, "TV deve executar uma varredura luminosa");
const tiledLevelRuntime = fs.readFileSync(path.join(projectDirectory, "src/objects/TiledLevelRuntime.ts"), "utf8");
assert.match(tiledLevelRuntime, /prepareDescentEpilogue\(startX: number, endX: number\)/,
  "epílogo deve preparar um corredor próprio no mapa do Esgoto");
assert.match(tiledLevelRuntime, /this\.groundLayer\.removeTileAt\(col, row\)/);
assert.match(tiledLevelRuntime, /this\.groundLayer\.putTileAt\(template\.pattern\[patternIndex\], col, template\.row\)/,
  "corredor final deve preencher todos os vãos com chão do próprio mapa");
assert.match(tiledLevelRuntime, /hazard\.zone\.setActive\(false\)/,
  "epílogo sem implantes não pode reutilizar hazards da subida");
assert.match(gameScene, /runtime\.prepareDescentEpilogue\(descentRoute\.startX, descentRoute\.endX\)/,
  "GameScene deve ativar o corredor seguro somente no epílogo");
for (const runtime of [
  "TiledLevelRuntime.ts",
  "TiledPhase2Runtime.ts",
  "TiledPhase3Runtime.ts",
  "TiledPhase4Runtime.ts",
  "TiledPhase5Runtime.ts",
]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.match(source, /activate\(withFeedback\)/, `${runtime}: respawn deve restaurar TV sem feedback`);
  assert.match(source, /onCheckpoint\([\s\S]*?\.x \+ [a-z]+\.width \/ 2/,
    `${runtime}: interação deve usar o centro visual da TV`);
}

const audioManagerSource = fs.readFileSync(path.join(projectDirectory, "src/systems/AudioManager.ts"), "utf8");
for (const key of ["phase1", "phase2", "phase3", "phase4", "phase5", "clinic", "gate", "menu"]) {
  assert.match(audioManagerSource, new RegExp(`${key}: "bgm-`), `AudioManager: BGM ${key}`);
}
assert.match(audioManagerSource, /this\.activeMusic\?\.stop\(\);[\s\S]*?this\.activeMusic\?\.destroy\(\);/,
  "troca de BGM precisa encerrar a faixa anterior");
for (const filename of [
  "attack", "barrier-disable", "breakable-destroy", "checkpoint", "conveyor-belt", "credit",
  "dash", "death", "drone-hum", "electric-gate", "electric-wire", "enemy-hit", "footstep",
  "gate-opening", "glitch", "hazard-water", "hurt", "hydraulic-press", "implant", "jump",
  "land", "mechanical-arm", "phase-clear", "scan", "scan-reveal", "security-door-unlock",
  "slide", "steam-burst", "ui-confirm", "ui-select", "warning-beep",
]) {
  assert.match(audioManagerSource, new RegExp(`sfx-${filename}\\.mp3`),
    `AudioManager: master ausente para ${filename}`);
  assert.ok(fs.existsSync(path.join(projectDirectory, `src/assets/audio/sfx/sfx-${filename}.mp3`)),
    `arquivo SFX ausente: ${filename}`);
}
for (const [phase, filename] of [
  ["phase1", "amb-sewer"],
  ["phase2", "amb-industrial"],
  ["phase3", "amb-urban"],
  ["phase4", "amb-corporate"],
]) {
  assert.match(audioManagerSource, new RegExp(`\\[BGM\\.${phase}\\]: new URL\\("\\.\\.\/assets\/audio\/ambience\/${filename}\\.mp3"`),
    `AudioManager: ambiente ausente para ${phase}`);
  assert.ok(fs.existsSync(path.join(projectDirectory, `src/assets/audio/ambience/${filename}.mp3`)),
    `arquivo de ambiente ausente: ${filename}`);
}
assert.match(audioManagerSource, /\[SFX\.effort\]: new URL\("\.\.\/assets\/audio\/sfx\/sfx-jump\.mp3"/,
  "salto duplo deve reutilizar o master de pulo enquanto não houver esforço dedicado");
assert.match(audioManagerSource, /activeLoops = new Map/);
assert.match(audioManagerSource, /static startLoop\([\s\S]*?loop: true/);
assert.match(audioManagerSource, /static stopLoop\([\s\S]*?sound\?\.destroy\(\)/);
assert.match(audioManagerSource, /pauseBgm\(\)[\s\S]*?activeLoops[\s\S]*?sound\.pause\(\)/,
  "pausa do jogo também deve suspender loops de ação");
assert.match(audioManagerSource, /if \(!scene\.cache\?\.audio\?\.exists\(key\)\) \{[\s\S]*?this\.stopBgm\(\)/,
  "cena sem master registrado não pode manter a BGM anterior");
for (const sfx of ["jump", "land", "slide", "attack", "dash", "scan", "death", "enemyHit", "uiConfirm"]) {
  assert.match(audioManagerSource, new RegExp(`${sfx}: "sfx-`), `AudioManager: SFX ${sfx}`);
}
assert.match(playerSource, /AudioManager\.startLoop\(this\.scene, SFX\.footstep/);
assert.match(playerSource, /AudioManager\.startLoop\(this\.scene, SFX\.slide/);
assert.match(playerSource, /AudioManager\.startLoop\(this\.scene, SFX\.scan/);
assert.match(playerSource, /AudioManager\.playSfx\(this\.scene, SFX\.hurt/);
assert.match(playerSource, /private stopContinuousSfx\(\): void/);
assert.match(playerSource, /grounded && !this\.wasGrounded && this\.landingSoundArmed/,
  "aterrissagem não deve tocar no spawn da fase");
assert.match(gameScene, /AudioManager\.playBgm\(this, bgmForPhase\(this\.data\$\.phaseId\)/);
assert.match(gameScene, /AudioManager\.pauseBgm\(\)/);
assert.match(gameScene, /AudioManager\.resumeBgm\(\)/);
assert.match(gameScene, /AudioManager\.startLoop\(this, SFX\.checkpoint/);
assert.match(gameScene, /AudioManager\.stopLoop\(SFX\.checkpoint\)/);
assert.match(tiledLevelRuntime, /AudioManager\.startLoop\(this\.scene, SFX\.electricWire/,
  "fio elétrico deve tocar somente por proximidade");
assert.match(tiledLevelRuntime, /const electricWireAudible = visibleKind\("electric_wire"\)/,
  "fio elétrico deve silenciar assim que seu visual sair da câmera");
assert.match(tiledLevelRuntime, /AudioManager\.startLoop\(this\.scene, SFX\.hazardWater/,
  "água tóxica deve tocar somente por proximidade");
assert.match(phase2Runtime, /AudioManager\.startLoop\(this\.scene, SFX\.conveyorBelt/,
  "esteira deve tocar somente durante contato");
assert.match(phase2Runtime, /state === "warning"[\s\S]*?SFX\.warningBeep/,
  "janela de aviso industrial deve emitir o bip dedicado");
assert.match(phase2Runtime, /state === "warning" && hazard\.kind === "press"/,
  "alarme industrial deve ficar restrito às prensas");
for (const sfx of ["hydraulicPress", "steamBurst", "mechanicalArm"]) {
  assert.match(phase2Runtime, new RegExp(`SFX\\.${sfx}`),
    `hazard industrial sem efeito dedicado: ${sfx}`);
}
assert.match(playerSource, /this\.sprite\.anims\.play\(this\.slideAnimationKey, true\)/,
  "slide deve usar animação dedicada");
assert.doesNotMatch(playerSource, /setFrame\(ALEX_SLIDE_FRAME\)/,
  "slide não pode voltar ao frame estático provisório");
assert.match(playerSource, /this\.slideTimer <= 0 && holdingSlide[\s\S]*?this\.slideTimer = PHYSICS\.slide\.durationMs/,
  "segurar slide deve renovar a janela sem reiniciar animação ou SFX");
assert.match(alexSpriteSource, /alexSlideTextureKey\(textureKey\), \{ start: 0, end: 3 \}/,
  "slide deve utilizar os quatro frames da folha dedicada");
assert.match(alexSpriteSource, /frameRate: 10,[\s\S]*?repeat: 0/,
  "entrada do slide deve tocar uma vez e manter o quarto frame");
assert.match(alexSpriteSource, /SLIDE_FRAME_X_OFFSETS = \[0, 10, 8, 6\]/,
  "quadros do slide devem compensar o recuo do desenho dentro da célula");
assert.match(alexSpriteSource, /\.setTrim\(PLAYER_FRAME, PLAYER_FRAME, offsetX, 0, PLAYER_FRAME, PLAYER_FRAME\)/,
  "alinhamento do slide deve mover somente o desenho, sem deslocar a hitbox");
for (const stage of ["flesh", "legs", "arms", "eyes", "dash"]) {
  assert.match(gameScene, new RegExp(`alex-slide-${stage}\\.png`), `GameScene: slide ${stage}`);
  assert.ok(
    fs.existsSync(path.join(projectDirectory, `src/assets/player/alex-slide/alex-slide-${stage}.png`)),
    `asset de slide ausente: ${stage}`,
  );
}
for (const stage of ["flesh", "legs", "arms", "eyes", "dash"]) {
  assert.match(gameScene, new RegExp(`alex-checkpoint-${stage}\\.png`), `GameScene: checkpoint ${stage}`);
  assert.ok(
    fs.existsSync(path.join(projectDirectory, `src/assets/player/alex-checkpoint/alex-checkpoint-${stage}.png`)),
    `asset de checkpoint ausente: ${stage}`,
  );
}
const bootSceneSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/BootScene.ts"), "utf8");
const placeholderTextureSource = fs.readFileSync(
  path.join(projectDirectory, "src/utils/PlaceholderTextures.ts"),
  "utf8",
);
assert.match(bootSceneSource, /credit-cyberpunk\.png/,
  "BootScene deve carregar o spritesheet final do crédito");
assert.match(placeholderTextureSource, /CREDIT_ANIMATION_KEY = "credit-cyberpunk-spin"/);
assert.match(placeholderTextureSource, /generateFrameNumbers\(TEX\.credit, \{ start: 0, end: 3 \}\)/);
assert.doesNotMatch(placeholderTextureSource, /circle\(scene, TEX\.credit/,
  "crédito não pode voltar ao círculo provisório");
for (const runtime of [
  "LevelRuntime.ts",
  "TiledLevelRuntime.ts",
  "TiledPhase2Runtime.ts",
  "TiledPhase3Runtime.ts",
  "TiledPhase4Runtime.ts",
  "TiledPhase5Runtime.ts",
]) {
  const source = fs.readFileSync(path.join(projectDirectory, "src/objects", runtime), "utf8");
  assert.match(source, /sprite\.anims\.play\(CREDIT_ANIMATION_KEY\)/,
    `${runtime}: crédito deve executar os quatro frames finais`);
}
for (const sfx of ["jump", "land", "slide", "attack", "dash", "scan", "death", "footstep"]) {
  assert.match(playerSource, new RegExp(`SFX\\.${sfx}`), `Player: feedback ${sfx}`);
}
assert.match(enemyRuntime, /spawnDefeatFx/);
assert.match(enemyRuntime, /SFX\.enemyHit/);
assert.match(enemyRuntime, /AudioManager\.startLoop\(this\.scene, SFX\.droneHum/);
assert.match(enemyRuntime, /AudioManager\.stopLoop\(SFX\.droneHum\)/,
  "hum do drone deve parar quando ele sai da câmera ou o runtime é destruído");
assert.match(phase3Runtime, /SFX\.breakableDestroy/);
assert.match(phase3Runtime, /AudioManager\.startLoop\(this\.scene, SFX\.electricGate/);
assert.match(phase3Runtime, /AudioManager\.stopLoop\(SFX\.electricGate\)/,
  "portão elétrico deve ficar restrito à área visível");
for (const source of [phase4Runtime, phase5Runtime]) {
  assert.match(source, /SFX\.scanReveal/);
  assert.match(source, /SFX\.securityDoorUnlock/);
}
assert.match(phase5Runtime, /SFX\.breakableDestroy/);
const descentRouteRuntime = fs.readFileSync(
  path.join(projectDirectory, "src/objects/DescentRouteRuntime.ts"),
  "utf8",
);
assert.match(descentRouteRuntime, /SFX\.barrierDisable/);
assert.match(descentRouteRuntime, /SFX\.gateOpening/);
const gateSceneSource = fs.readFileSync(path.join(projectDirectory, "src/scenes/GateScene.ts"), "utf8");
assert.match(gateSceneSource, /SFX\.gateOpening/);
const descentGlitchRuntime = fs.readFileSync(
  path.join(projectDirectory, "src/objects/DescentGlitchRuntime.ts"),
  "utf8",
);
assert.match(descentGlitchRuntime, /AudioManager\.playSfx\(this\.scene, SFX\.glitch/,
  "fragmentos de memória devem ter feedback sonoro próprio");

assert.match(hudSource, /fillRoundedRect\(14, 12, 360, 70, 8\)/,
  "painel principal do HUD deve conter apenas os créditos");
assert.match(hudSource, /\.text\(22, 91,[\s\S]*?backgroundColor: "#050a12cc"/,
  "implantes devem ocupar uma faixa separada do painel de créditos");
// Fundo com parallax (image layers do Tiled) e clima das Fases 1-5.
const backdrop = loadTypeScriptModule("src/levels/BackdropLayers.ts");
const backdropPhases = [
  { map: maps[0], offsetY: 224, ambient: "drips" },
  { map: maps[1], offsetY: 176, ambient: "embers" },
  { map: maps[2], offsetY: 0, ambient: "rain" },
  { map: maps[3], offsetY: 176, ambient: undefined }, // corporativo: limpo, sem clima
  { map: maps[4], offsetY: 176, ambient: "motes" },
  // corrida multiplayer: mesma arte e configuração do Topo (Fase 5)
  { map: "src/assets/maps/multiplayer/multiplayer-race.json", offsetY: 176, ambient: "motes" },
];
for (const { map: relativePath, offsetY, ambient } of backdropPhases) {
  const map = JSON.parse(fs.readFileSync(path.join(projectDirectory, relativePath), "utf8"));
  const layers = backdrop.readBackdropLayers(map, offsetY);
  assert.ok(layers.length >= 3, `${relativePath}: fundo precisa de camadas de parallax`);
  for (const layer of layers) {
    assert.ok(layer.repeatX, `${relativePath}: ${layer.name} deve repetir na horizontal`);
    assert.ok(layer.parallaxX >= 0 && layer.parallaxX < 1, `${relativePath}: ${layer.name} deve andar mais devagar que o mapa`);
    assert.ok(layer.y >= 0 && layer.y < config.SCREEN_HEIGHT, `${relativePath}: ${layer.name} fora da tela (y=${layer.y})`);
  }
  assert.equal(layers[0].y, 0, `${relativePath}: a camada mais ao fundo cobre a tela desde o topo`);
  assert.equal(backdrop.readAmbient(map)?.kind, ambient, `${relativePath}: clima`);
}
const sampleMap = {
  layers: [
    { type: "tilelayer", name: "ground" },
    { type: "imagelayer", name: "a", image: "../../backdrops/x/a.png", offsety: -10, parallaxx: 0.5, repeatx: true },
    { type: "imagelayer", name: "oculta", image: "b.png", visible: false },
    { type: "imagelayer", name: "padrao", image: "c.png", properties: [{ name: "drift_x", value: -4 }] },
  ],
  properties: [{ name: "ambient", value: "neve" }],
};
const sampleLayers = backdrop.readBackdropLayers(sampleMap, 100);
// Array.from: o módulo roda em outro contexto do vm (outro Array.prototype).
assert.deepEqual(Array.from(sampleLayers, (layer) => layer.imageName), ["a.png", "c.png"], "camada oculta no Tiled não aparece");
assert.equal(sampleLayers[0].y, 90, "offsety do Tiled + deslocamento da fase");
assert.equal(sampleLayers[1].parallaxX, 1, "parallax padrão do Tiled é 1");
assert.equal(sampleLayers[1].driftX, -4);
assert.equal(backdrop.readAmbient(sampleMap), undefined, "clima desconhecido é ignorado");
assert.equal(backdrop.repeatedLayerScroll(1000, { parallaxX: 0.5, offsetX: 0 }, 0, 640), 500);
assert.equal(backdrop.repeatedLayerScroll(0, { parallaxX: 0.5, offsetX: 10 }, 0, 640), 630, "deslocamento negativo dá a volta");
assert.equal(backdrop.repeatedLayerScroll(333, { parallaxX: 0.3, offsetX: 0 }, 0.4, 1280) % 1, 0, "posição inteira (pixelArt)");
assert.equal(backdrop.wrapScreenX(-5, 0, 1, 1280), 1275);
assert.equal(sampleLayers[0].appearX, undefined, "sem appear_x a camada é sempre visível");
assert.equal(backdrop.appearAlpha(0, undefined), 1);
assert.deepEqual([28000, 28800, 29280, 40000].map((x) => backdrop.appearAlpha(x, 28800)), [0, 0, 0.5, 1], "appear_x: fade-in depois do X");
const fase5Final = backdrop.readBackdropLayers(JSON.parse(fs.readFileSync(path.join(projectDirectory, maps[4]), "utf8")), 176).filter((layer) => layer.appearX !== undefined);
assert.equal(fase5Final.length, 2, "Fase 5: aurora e cidade alta só no trecho contemplativo");
assert.ok(fase5Final.every((layer) => layer.appearX === 28800), "Fase 5: fundo final surge no início do trecho contemplativo");
console.log("Gameplay flow: movimentos, barreiras por scan e estrutura das cinco fases validados.");
console.log("Fundo: camadas de parallax e clima das Fases 1-5 e da corrida multiplayer validados.");

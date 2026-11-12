import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { inflateSync } from "node:zlib";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const phases = [
  {
    id: "fase1",
    map: "src/assets/maps/esgoto/fase-1",
    tile: 16,
    layers: ["background", "deco-back", "ground", "hazards", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "clinic", "phase_end"],
    hazards: ["toxic_water", "electric_wire", "broken_pipe"],
    implant: "legs",
  },
  {
    id: "fase2-intro",
    map: "src/assets/maps/industrial/fase-2",
    tile: 32,
    layers: ["background", "deco-back", "ground", "hazards", "deco-low-ceilings", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "conveyor", "low_ceiling", "tutorial", "clinic", "memory_glitch", "phase_end"],
    hazards: ["press", "steam", "mech_arm"],
    implant: "arms",
  },
  {
    id: "fase3",
    map: "src/assets/maps/meio-urbano/fase-3",
    tile: 16,
    layers: ["background", "deco-back", "ground", "hazards", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "breakable", "enemy", "tutorial", "clinic", "memory_glitch", "phase_end"],
    hazards: ["electric_gate"],
    implant: "eyes",
  },
  {
    id: "fase4",
    map: "src/assets/maps/corporativo/fase-4",
    tile: 32,
    layers: ["background", "deco-back", "ground", "scan-visuals", "hazards", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "scan_reveal", "automatic_door", "tutorial", "clinic", "memory_glitch", "phase_end"],
    hazards: ["laser", "hidden_spikes"],
    implant: "thrusters",
  },
  {
    id: "fase5",
    map: "src/assets/maps/topo/fase-5",
    tile: 32,
    layers: ["background", "deco-back", "ground", "scan-visuals", "hazards", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "automatic_door", "breakable", "tutorial", "memory_glitch", "phase_end"],
    hazards: ["laser_grid", "rotating_barrier", "hidden_spikes"],
  },
  {
    id: "multiplayer",
    map: "src/assets/maps/multiplayer/multiplayer-race",
    tile: 32,
    layers: ["background", "deco-back", "ground", "scan-visuals", "hazards", "deco", "objects"],
    objects: ["spawn", "checkpoint", "credit", "hazard", "automatic_door", "breakable", "tutorial", "phase_end"],
    hazards: ["laser_grid", "rotating_barrier", "hidden_spikes"],
    expectedCredits: 20,
    expectedCheckpoints: 1,
    expectedCheckpointX: 19200,
    expectedEndX: 38272,
    expectedWidth: 1200,
    forbiddenObjects: ["zone", "gate", "ending_choice", "clinic"],
  },
];

const runtimeImages = [
  "src/assets/player/alex-flesh/alex-flesh.png",
  "src/assets/player/alex-legs/alex-legs.png",
  "src/assets/player/alex-arms/alex-arms.png",
  "src/assets/player/alex-eyes/alex-eyes.png",
  "src/assets/player/alex-dash/alex-dash.png",
  "src/assets/player/alex-dialogue/alex-complete-dialogue.png",
  "src/assets/tiles/esgoto/tiles/tilesetSewer.png",
  "src/assets/tiles/esgoto/crystal-cave-tiles.png",
  "src/assets/tiles/industrial/tiles/1_Industrial_Tileset_1.png",
  "src/assets/tiles/industrial/tiles/1_Industrial_Tileset_1B.png",
  "src/assets/tiles/industrial/tiles/1_Industrial_Tileset_1C.png",
  "src/assets/tiles/meio-urbano/ENVIRONMENT/tileset.png",
  "src/assets/tiles/corporativo/foozle-scifi-lab/tiles/level_tileset.png",
  "src/assets/tiles/topo/cyber-purp/tileset.png",
  "src/assets/props/obstacles/barricade.png",
  "src/assets/props/obstacles/phase5-barricade.png",
  "src/assets/props/obstacles/reforge-security-seal.png",
  "src/assets/props/hazards/urban-electric-floor.png",
  "src/assets/props/checkpoint/tv-checkpoint.png",
  "src/assets/npcs/enemies/bandido/bandido.png",
  "src/assets/npcs/enemies/drone/drone.png",
  "src/assets/narrative/prologue/familia.png",
  "src/assets/narrative/prologue/jornal-pai.png",
  "src/assets/narrative/father/pai-antes.png",
  "src/assets/narrative/father/pai-portrait.png",
  "src/assets/narrative/father/propaganda-pai.png",
  "src/assets/narrative/family/avo-portrait.png",
  "src/assets/narrative/family/tio-portrait.png",
  "src/assets/narrative/recycling/holograma-pai.png",
  "src/assets/narrative/recycling/holograma-ciborgue.png",
  "src/assets/narrative/reforge-door/reforge-door-closed.png",
  "src/assets/narrative/reforge-door/reforge-door-open.png",
  "src/assets/narrative/gate/portao.png",
  "src/assets/npcs/george/george/george.png",
  "src/assets/npcs/george/george-nervous/george-nervous.png",
  "src/assets/npcs/george/george-proud/george-proud.png",
  "src/assets/npcs/george/george-proud/george-proud-clinic.png",
  "src/assets/npcs/george/george-clinic/george-clinic-01.png",
  "src/assets/npcs/george/george-clinic/george-clinic-02.png",
  "src/assets/npcs/george/george-clinic/george-clinic-03.png",
  "src/assets/npcs/george/george-angry/george-angry.png",
  "src/assets/scenes/clinic/clinic-bg.png",
  "src/assets/player/alex-chrome/alex-chrome.png",
  "src/assets/player/alex-flesh-happy/alex-flesh-happy.png",
  "src/assets/player/alex-hollow/alex-hollow.png",
  "src/assets/narrative/fragments/fragmento-topo.png",
  "src/assets/narrative/fragments/fragmento-corporativo.png",
  "src/assets/narrative/fragments/fragmento-urbano.png",
  "src/assets/narrative/fragments/fragmento-industrial.png",
  "src/assets/narrative/recycling/unidade-reciclagem.png",
  "src/assets/narrative/recycling/holograma-frame.png",
  "src/assets/audio/music/bgm-clinic.wav",
  "src/assets/audio/music/bgm-portao.wav",
  "src/assets/audio/sfx/sfx-implant.wav",
];

const runtimeImageContracts = new Map([
  ["src/assets/scenes/clinic/clinic-bg.png", [960, 320]],
  ["src/assets/npcs/enemies/bandido/bandido.png", [192, 48]],
  ["src/assets/npcs/enemies/drone/drone.png", [64, 32]],
  ["src/assets/props/obstacles/phase5-barricade.png", [96, 44]],
  ["src/assets/props/obstacles/reforge-security-seal.png", [971, 1619]],
  ["src/assets/props/hazards/urban-electric-floor.png", [640, 68]],
  ["src/assets/narrative/prologue/familia.png", [256, 160]],
  ["src/assets/narrative/prologue/jornal-pai.png", [240, 128]],
  ["src/assets/narrative/father/pai-antes.png", [96, 96]],
  ["src/assets/narrative/father/pai-portrait.png", [96, 96]],
  ["src/assets/narrative/father/propaganda-pai.png", [160, 96]],
  ["src/assets/narrative/family/avo-portrait.png", [96, 96]],
  ["src/assets/narrative/family/tio-portrait.png", [96, 96]],
  ["src/assets/narrative/recycling/holograma-pai.png", [80, 96]],
  ["src/assets/narrative/reforge-door/reforge-door-closed.png", [1122, 1402]],
  ["src/assets/narrative/reforge-door/reforge-door-open.png", [1122, 1402]],
  ["src/assets/narrative/gate/portao.png", [192, 224]],
  ["src/assets/npcs/george/george-proud/george-proud-clinic.png", [64, 64]],
  ["src/assets/npcs/george/george-clinic/george-clinic-01.png", [96, 96]],
  ["src/assets/npcs/george/george-clinic/george-clinic-02.png", [96, 96]],
  ["src/assets/npcs/george/george-clinic/george-clinic-03.png", [96, 96]],
]);

const readJson = (filename) => JSON.parse(fs.readFileSync(filename, "utf8"));
const property = (object, name) => object.properties?.find((item) => item.name === name)?.value;
const fail = (message) => errors.push(message);

function normalizeEditableMap(map, mapDir) {
  delete map.editorsettings;
  map.layers = map.layers.map((layer) => {
    if (layer.type !== "tilelayer" || typeof layer.data !== "string") return layer;
    const bytes = layer.compression === "zlib"
      ? inflateSync(Buffer.from(layer.data, "base64"))
      : Buffer.from(layer.data, "base64");
    const data = Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readUInt32LE(index * 4));
    const { compression: _compression, encoding: _encoding, ...plainLayer } = layer;
    return { ...plainLayer, data };
  });
  map.tilesets = map.tilesets.map((entry) => {
    if (!entry.source) return entry;
    const { source, ...reference } = entry;
    return { ...reference, ...readJson(path.resolve(mapDir, source)) };
  });
  return map;
}

function stripTilesetEditorMetadata(map) {
  map.tilesets = map.tilesets.map((tileset) => {
    const {
      properties: _properties,
      tiledversion: _tiledversion,
      type: _type,
      version: _version,
      ...runtimeTileset
    } = tileset;
    return runtimeTileset;
  });
  return map;
}

// Imagens de fundo registradas para o Parcel (nome do arquivo -> caminho).
const registeredBackdrops = new Map();
{
  const source = fs.readFileSync(path.join(projectRoot, "src/levels/BackdropAssets.ts"), "utf8");
  for (const match of source.matchAll(/"([^"]+\.png)":\s*new URL\("\.\.\/([^"]+)", import\.meta\.url\)/g)) {
    const [, name, relative] = match;
    registeredBackdrops.set(name, relative);
    if (path.basename(relative) !== name) fail(`BackdropAssets.ts: chave ${name} aponta para ${relative}`);
    if (!fs.existsSync(path.join(projectRoot, "src", relative))) fail(`BackdropAssets.ts: imagem ausente: src/${relative}`);
  }
  if (registeredBackdrops.size === 0) fail("BackdropAssets.ts: nenhuma imagem de fundo encontrada (formato do registro mudou?)");
}

for (const image of runtimeImages) {
  const imagePath = path.join(projectRoot, image);
  if (!fs.existsSync(imagePath)) {
    fail(`asset de runtime ausente: ${image}`);
    continue;
  }
  const expectedSize = runtimeImageContracts.get(image);
  if (expectedSize) {
    const png = fs.readFileSync(imagePath);
    const actualSize = [png.readUInt32BE(16), png.readUInt32BE(20)];
    if (!isDeepStrictEqual(actualSize, expectedSize)) {
      fail(`${image}: dimensão deve ser ${expectedSize[0]}x${expectedSize[1]}, recebido ${actualSize[0]}x${actualSize[1]}`);
    }
  }
}

for (const phase of phases) {
  const jsonPath = path.join(projectRoot, `${phase.map}.json`);
  const tmjPath = path.join(projectRoot, `${phase.map}.tmj`);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(tmjPath)) {
    fail(`${phase.id}: par .tmj/.json ausente`);
    continue;
  }

  const map = stripTilesetEditorMetadata(readJson(jsonPath));
  const editableMap = stripTilesetEditorMetadata(
    normalizeEditableMap(readJson(tmjPath), path.dirname(tmjPath)),
  );
  if (!isDeepStrictEqual(editableMap, map)) fail(`${phase.id}: .tmj e .json de runtime estão dessincronizados`);
  if (map.tilewidth !== phase.tile || map.tileheight !== phase.tile) fail(`${phase.id}: grade deve ser ${phase.tile}x${phase.tile}`);

  const layersByName = new Map(map.layers.map((layer) => [layer.name, layer]));
  for (const layer of phase.layers) {
    if (!layersByName.has(layer)) fail(`${phase.id}: layer obrigatória ausente: ${layer}`);
  }
  const ground = layersByName.get("ground");
  if (!ground || ground.type !== "tilelayer" || !ground.data?.some((gid) => gid !== 0)) {
    fail(`${phase.id}: layer ground ausente ou vazia`);
  }

  const objectLayer = layersByName.get("objects");
  const objects = objectLayer?.type === "objectgroup" ? objectLayer.objects : [];
  for (const type of phase.objects) {
    if (!objects.some((object) => object.type === type)) fail(`${phase.id}: objeto obrigatório ausente: ${type}`);
  }
  if (phase.expectedCredits !== undefined && objects.filter((object) => object.type === "credit").length !== phase.expectedCredits) {
    fail(`${phase.id}: deve possuir exatamente ${phase.expectedCredits} créditos`);
  }
  if (phase.expectedCheckpoints !== undefined && objects.filter((object) => object.type === "checkpoint").length !== phase.expectedCheckpoints) {
    fail(`${phase.id}: deve possuir exatamente ${phase.expectedCheckpoints} checkpoint`);
  }
  if (phase.expectedCheckpointX !== undefined && objects.find((object) => object.type === "checkpoint")?.x !== phase.expectedCheckpointX) {
    fail(`${phase.id}: checkpoint deve estar em x=${phase.expectedCheckpointX}`);
  }
  if (phase.expectedEndX !== undefined && objects.find((object) => object.type === "phase_end")?.x !== phase.expectedEndX) {
    fail(`${phase.id}: chegada deve estar em x=${phase.expectedEndX}`);
  }
  if (phase.expectedWidth !== undefined && map.width !== phase.expectedWidth) {
    fail(`${phase.id}: largura deve ser ${phase.expectedWidth} tiles`);
  }
  for (const type of phase.forbiddenObjects ?? []) {
    if (objects.some((object) => object.type === type)) fail(`${phase.id}: objeto proibido presente: ${type}`);
  }

  const objectIds = new Set();
  const semanticIds = new Set();
  for (const object of objects) {
    if (objectIds.has(object.id)) fail(`${phase.id}: ID Tiled duplicado: ${object.id}`);
    objectIds.add(object.id);
    const semanticId = property(object, "id");
    if (typeof semanticId === "string") {
      if (semanticIds.has(semanticId)) fail(`${phase.id}: propriedade id duplicada: ${semanticId}`);
      semanticIds.add(semanticId);
    }
  }

  for (const hazard of objects.filter((object) => object.type === "hazard")) {
    const kind = property(hazard, "kind");
    if (!phase.hazards.includes(kind)) fail(`${phase.id}: hazard kind inválido em ${hazard.name || hazard.id}: ${String(kind)}`);
  }

  for (const conveyor of objects.filter((object) => object.type === "conveyor")) {
    const direction = property(conveyor, "direction");
    const speed = property(conveyor, "speed");
    if (!["left", "right"].includes(direction)) fail(`${phase.id}: esteira ${conveyor.name} sem direction válido`);
    if (typeof speed !== "number" || speed <= 0) fail(`${phase.id}: esteira ${conveyor.name} sem speed positivo`);
  }

  for (const door of objects.filter((object) => object.type === "automatic_door")) {
    if (typeof property(door, "id") !== "string") fail(`${phase.id}: porta ${door.name} sem id`);
    const cycle = property(door, "cycle_ms");
    const open = property(door, "open_ms");
    if (cycle !== undefined || open !== undefined) {
      if (typeof cycle !== "number" || cycle <= 0 || typeof open !== "number" || open < 0 || open > cycle) {
        fail(`${phase.id}: propriedades legadas de ciclo inválidas na porta ${door.name}`);
      }
    }
  }

  for (const reveal of objects.filter((object) => object.type === "scan_reveal")) {
    if (typeof property(reveal, "group") !== "string") fail(`${phase.id}: scan_reveal ${reveal.name} sem group`);
  }

  if (phase.implant) {
    const clinic = objects.find((object) => object.type === "clinic");
    if (property(clinic ?? {}, "implant") !== phase.implant) fail(`${phase.id}: clínica deve liberar ${phase.implant}`);
  }

  const mapDir = path.dirname(jsonPath);
  let maxGid = 0;
  for (const entry of map.tilesets) {
    const sourcePath = entry.source ? path.resolve(mapDir, entry.source) : undefined;
    if (sourcePath && !fs.existsSync(sourcePath)) {
      fail(`${phase.id}: tileset externo ausente: ${entry.source}`);
      continue;
    }
    const tileset = sourcePath ? readJson(sourcePath) : entry;
    const imagePath = path.resolve(sourcePath ? path.dirname(sourcePath) : mapDir, tileset.image);
    if (!fs.existsSync(imagePath)) fail(`${phase.id}: imagem de tileset ausente: ${tileset.image}`);
    maxGid = Math.max(maxGid, entry.firstgid + tileset.tilecount - 1);
  }
  for (const filename of fs.readdirSync(mapDir).filter((name) => name.endsWith(".tsj"))) {
    const tilesetPath = path.join(mapDir, filename);
    const tileset = readJson(tilesetPath);
    if (!tileset.name || !Number.isInteger(tileset.tilecount) || tileset.tilecount <= 0) {
      fail(`${phase.id}: definição de tileset inválida: ${filename}`);
      continue;
    }
    if (!tileset.image || !fs.existsSync(path.resolve(mapDir, tileset.image))) {
      fail(`${phase.id}: imagem ausente no tileset ${filename}: ${String(tileset.image)}`);
    }
  }
  for (const layer of map.layers.filter((item) => item.type === "tilelayer")) {
    if (!Array.isArray(layer.data) || layer.data.length !== map.width * map.height) {
      fail(`${phase.id}: tamanho inválido dos dados da layer ${layer.name}`);
      continue;
    }
    const invalid = layer.data.find((rawGid) => (rawGid & 0x1fffffff) > maxGid);
    if (invalid !== undefined) fail(`${phase.id}: GID fora dos tilesets na layer ${layer.name}: ${invalid}`);
  }
  // Fundo com parallax (contrato §3.1): toda image layer precisa apontar para
  // um PNG existente, com o tamanho declarado, e registrado em
  // BACKDROP_IMAGE_URLS (senão o Parcel não empacota e o jogo ignora a camada).
  const imageLayers = map.layers.filter((item) => item.type === "imagelayer");
  for (const layer of imageLayers) {
    const imagePath = layer.image ? path.resolve(mapDir, layer.image) : "";
    if (!layer.image || !fs.existsSync(imagePath)) {
      fail(`${phase.id}: imagem ausente na image layer ${layer.name}: ${String(layer.image)}`);
      continue;
    }
    const png = fs.readFileSync(imagePath);
    const size = [png.readUInt32BE(16), png.readUInt32BE(20)];
    if (!isDeepStrictEqual(size, [layer.imagewidth, layer.imageheight])) {
      fail(`${phase.id}: image layer ${layer.name}: o mapa declara ${layer.imagewidth}x${layer.imageheight}, o PNG tem ${size[0]}x${size[1]} (recarregue a imagem no Tiled)`);
    }
    const imageName = path.basename(layer.image);
    if (!registeredBackdrops.has(imageName)) {
      fail(`${phase.id}: image layer ${layer.name} usa ${imageName}, que não está registrada em src/levels/BackdropAssets.ts`);
    }
  }
  const ambient = property(map, "ambient");
  if (ambient !== undefined && !["drips", "embers", "rain", "motes"].includes(ambient)) {
    fail(`${phase.id}: propriedade de mapa ambient inválida: ${ambient}`);
  }

  console.log(`${phase.id}: OK (${map.width}x${map.height}, ${objects.length} objetos, ${map.tilesets.length} tilesets${imageLayers.length ? `, ${imageLayers.length} camadas de parallax` : ""})`);
}

if (errors.length > 0) {
  console.error(`\nFalha na validação (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("\nTodos os mapas, contratos de objetos, tilesets e assets de runtime estão válidos.");
}

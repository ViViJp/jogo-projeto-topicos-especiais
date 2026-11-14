import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "src/assets/maps/topo/fase-5.tmj");
const outputDirectory = path.join(projectRoot, "src/assets/maps/multiplayer");
const editablePath = path.join(outputDirectory, "multiplayer-race.tmj");
const runtimePath = path.join(outputDirectory, "multiplayer-race.json");

const sourceMap = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const map = structuredClone(sourceMap);
const sourceDirectory = path.dirname(sourcePath);
const extensionStartColumn = 900;
const extensionSourceColumn = 600;
const extensionColumns = 300;
const extensionOffsetX = (extensionStartColumn - extensionSourceColumn) * map.tilewidth;

for (const layer of map.layers.filter((item) => item.type === "tilelayer")) {
  const sourceData = sourceMap.layers.find((item) => item.id === layer.id)?.data;
  if (!Array.isArray(sourceData) || !Array.isArray(layer.data)) {
    throw new Error(`Layer ${layer.name} precisa usar dados CSV editáveis.`);
  }
  for (let row = 0; row < map.height; row += 1) {
    for (let offset = 0; offset < extensionColumns; offset += 1) {
      const destinationColumn = extensionStartColumn + offset;
      const sourceColumn = extensionSourceColumn + offset;
      layer.data[row * map.width + destinationColumn] = sourceData[row * map.width + sourceColumn];
    }
  }
}

const objectLayer = map.layers.find((layer) => layer.type === "objectgroup" && layer.name === "objects");
const sourceObjectLayer = sourceMap.layers.find((layer) => layer.type === "objectgroup" && layer.name === "objects");
if (!objectLayer || !sourceObjectLayer) throw new Error('Layer de objetos "objects" ausente na Fase 5.');

const propertyValue = (object, name) => object.properties?.find((item) => item.name === name)?.value;
const setProperty = (object, name, type, value) => {
  object.properties ??= [];
  const property = object.properties.find((item) => item.name === name);
  if (property) Object.assign(property, { type, value });
  else object.properties.push({ name, type, value });
};

function multiplayerObject(source, { repeat = false, offsetX = 0 } = {}) {
  const object = structuredClone(source);
  object.x = (object.x ?? 0) + offsetX;
  object.name = `${object.name || object.type || "object"}${repeat ? "_repeat" : ""}`;
  object.properties = (object.properties ?? []).map((property) => {
    // A arte do laser repetido está na coluna copiada, não na original.
    if (property.name === "visual_source_x") return { ...property, value: property.value + offsetX };
    if (typeof property.value !== "string") return property;
    let value = property.value.replace(/^f5-/, "mp-");
    if (repeat && value.startsWith("mp-")) value = `${value}-repeat`;
    return { ...property, value };
  });
  return object;
}

const narrativeTypes = new Set([
  "checkpoint", "credit", "zone", "gate", "ending_choice", "phase_end", "tutorial", "memory_glitch",
]);
const retainedObjects = sourceObjectLayer.objects
  .filter((object) => (object.x ?? 0) < 28_800 && !narrativeTypes.has(object.type))
  .map((object) => multiplayerObject(object));

const repeatableTypes = new Set(["hazard", "automatic_door", "scan_reveal", "breakable"]);
const repeatedObjects = sourceObjectLayer.objects
  .filter((object) => {
    const x = object.x ?? 0;
    return x >= 19_200 && x < 28_800 && repeatableTypes.has(object.type);
  })
  .map((object) => multiplayerObject(object, { repeat: true, offsetX: extensionOffsetX }));

// O trecho final reaproveita o chão de 19200–28800; só os objetos variam para
// a reta de chegada não ser uma cópia exata do trecho anterior.
const groundData = map.layers.find((layer) => layer.name === "ground").data;
const hasGround = (column, row) => groundData[row * map.width + column] !== 0;
function moveRepeatedLaser(name, newX) {
  const laser = repeatedObjects.find((object) => object.name === name);
  if (!laser) throw new Error(`Laser repetido ausente: ${name}.`);
  const column = newX / map.tilewidth;
  const floorRow = (laser.y + laser.height) / map.tileheight;
  if (!Number.isInteger(column) || !hasGround(column, floorRow) || hasGround(column, floorRow - 1)) {
    throw new Error(`${name}: x=${newX} não é chão plano na altura do laser.`);
  }
  if (propertyValue(laser, "visual_source_x") === undefined) {
    setProperty(laser, "visual_source_x", "int", laser.x);
  }
  laser.x = newX;
}
moveRepeatedLaser("laser_grid_04_repeat", 33_472);
moveRepeatedLaser("laser_grid_06_repeat", 35_360);
const repeatedDoor = repeatedObjects.find((object) => object.name === "automatic_door_04_repeat");
if (!repeatedDoor) throw new Error("Porta repetida ausente: automatic_door_04_repeat.");
setProperty(repeatedDoor, "phase_ms", "int", 1_300);

const sourceCredits = sourceObjectLayer.objects.filter((object) => object.type === "credit");
const creditPlan = [
  { x: 640 },
  { x: 1_664 },
  { x: 3_968 },
  { x: 6_784 },
  { x: 7_680 },
  { x: 9_152 },
  { x: 11_008 },
  { x: 12_288 },
  { x: 14_400 },
  { x: 16_128 },
  { x: 17_600 },
  { x: 18_560 },
  { x: 20_096 },
  { x: 21_952 },
  { x: 24_640 },
  { x: 27_840 },
  { sourceX: 20_800, x: 30_400 },
  { sourceX: 23_328, x: 32_928 },
  { sourceX: 25_088, x: 34_688 },
  { sourceX: 27_840, x: 37_440 },
];

const credits = creditPlan.map((plan, index) => {
  const sourceX = plan.sourceX ?? plan.x;
  const source = sourceCredits.find((object) => object.x === sourceX);
  if (!source) throw new Error(`Crédito-base ausente em x=${sourceX}.`);
  const object = structuredClone(source);
  object.x = plan.x;
  object.name = `credit_${String(index + 1).padStart(2, "0")}`;
  setProperty(object, "id", "string", `mp-credit-${String(index + 1).padStart(2, "0")}`);
  setProperty(object, "route", "string", propertyValue(source, "route") === "risk" ? "risk" : "normal");
  return object;
});

const checkpoints = [10_624, 19_200, 28_800].map((x, index) => ({
  height: 96,
  name: `checkpoint_${String(index + 1).padStart(2, "0")}`,
  properties: [{ name: "id", type: "string", value: `mp-cp${index + 1}` }],
  rotation: 0,
  type: "checkpoint",
  visible: true,
  width: 64,
  x,
  y: 288,
}));

const finish = {
  height: 128,
  name: "finish_line",
  properties: [
    { name: "id", type: "string", value: "mp-finish" },
    { name: "mode", type: "string", value: "multiplayer" },
  ],
  rotation: 0,
  type: "phase_end",
  visible: true,
  width: 64,
  x: 38_272,
  y: 256,
};

objectLayer.objects = [...retainedObjects, ...repeatedObjects, ...checkpoints, ...credits, finish]
  .sort((left, right) => (left.x ?? 0) - (right.x ?? 0));
objectLayer.objects.forEach((object, index) => {
  object.id = index + 1;
});
map.nextobjectid = objectLayer.objects.length + 1;
// O fundo final (aurora e cidade alta, com `appear_x`) pertence ao trecho
// contemplativo da campanha; a corrida mantém o céu do Topo do início ao fim.
map.layers = map.layers.filter(
  (layer) => !(layer.type === "imagelayer" && propertyValue(layer, "appear_x") !== undefined),
);
map.properties = [
  ...(sourceMap.properties ?? []).filter((property) => property.name.startsWith("ambient")),
  { name: "mode", type: "string", value: "multiplayer" },
  { name: "target_duration_seconds", type: "int", value: 120 },
  { name: "credit_count", type: "int", value: 20 },
  { name: "source", type: "string", value: "fase-5-topo" },
];
map.tilesets = map.tilesets.map((reference) => ({
  ...reference,
  source: path.relative(outputDirectory, path.resolve(sourceDirectory, reference.source)).replaceAll(path.sep, "/"),
}));

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(editablePath, `${JSON.stringify(map, null, 2)}\n`);

const runtimeMap = structuredClone(map);
delete runtimeMap.editorsettings;
runtimeMap.tilesets = runtimeMap.tilesets.map((reference) => {
  const tilesetPath = path.resolve(outputDirectory, reference.source);
  const tileset = JSON.parse(fs.readFileSync(tilesetPath, "utf8"));
  const {
    properties: _properties,
    tiledversion: _tiledversion,
    type: _type,
    version: _version,
    ...runtimeTileset
  } = tileset;
  const { source: _source, ...entry } = reference;
  return { ...entry, ...runtimeTileset };
});
fs.writeFileSync(runtimePath, `${JSON.stringify(runtimeMap, null, 2)}\n`);

const counts = objectLayer.objects.reduce((result, object) => {
  const type = object.type || "untyped";
  result[type] ??= [];
  result[type].push(object);
  return result;
}, {});
console.log(`Mapa multiplayer gerado: ${map.width * map.tilewidth}px, ${objectLayer.objects.length} objetos.`);
console.log(`Créditos: ${counts.credit?.length ?? 0}; checkpoints: ${counts.checkpoint?.length ?? 0}; chegada: ${counts.phase_end?.length ?? 0}.`);

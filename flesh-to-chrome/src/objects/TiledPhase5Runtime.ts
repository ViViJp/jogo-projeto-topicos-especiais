import Phaser from "phaser";
import { GAMEPLAY_TIMING, PHYSICS } from "../config/GameConfig";
import { Player } from "../entities/Player";
import {
  TILED_FASE5_MAP_KEY,
  TILED_FASE5_OFFSET_Y,
  TILED_FASE5_TILESETS,
} from "../levels/TiledFase5";
import { TEX } from "../utils/PlaceholderTextures";
import { CheckpointMarker } from "./CheckpointMarker";
import { nearestScanObstacleIndex, rotatingBarrierPoints } from "./HazardMotion";

interface Phase5Credit {
  id: string;
  x: number;
  y: number;
  value: number;
  route: "normal" | "risk";
}

interface Phase5Checkpoint {
  id: string;
  x: number;
  y: number;
  width: number;
}

type RevealKind = "hidden_route" | "false_wall" | "hidden_hazard" | "false_floor";

interface RevealRegion {
  kind: RevealKind;
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outline: Phaser.GameObjects.Rectangle;
}

interface HiddenVisualRegion {
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AutomaticDoor {
  id: string;
  x: number;
  width: number;
  zone: Phaser.GameObjects.Zone;
  col: number;
  prompt: Phaser.GameObjects.Text;
  disabled: boolean;
}

interface RotatingBarrier {
  centerX: number;
  centerY: number;
  length: number;
  collisionSpan: number;
  cycleMs: number;
  phaseMs: number;
  arm: Phaser.GameObjects.Rectangle;
  hub: Phaser.GameObjects.Arc;
  collisionNodes: Phaser.GameObjects.Zone[];
}

interface RuntimeBreakable {
  id: string;
  body: Phaser.GameObjects.Rectangle;
  visual: Phaser.GameObjects.Image;
  collider?: Phaser.Physics.Arcade.Collider;
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

interface RuntimeBreakableDefinition extends Omit<RuntimeBreakable, "body" | "visual"> {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TiledPhase5RuntimeOptions {
  mapKey?: string;
  tilesets?: ReadonlyArray<{ name: string; key: string }>;
  offsetY?: number;
  creditValue?: number;
  contextLabel?: string;
  timeSource?: () => number;
  endLabel?: string;
}

const TOP_HAZARD_KINDS = new Set(["laser_grid", "rotating_barrier", "hidden_spikes"]);
const REVEAL_KINDS = new Set<RevealKind>(["hidden_route", "false_wall", "hidden_hazard", "false_floor"]);
const SCAN_RANGE = 900;
const DOOR_FIRST_GID = 521;
const BARRICADE_VISUAL_HEIGHT = 44;
const ASSET_BASELINE_PADDING = 2;
export const TILED_PHASE5_BARRICADE_TEXTURE_KEY = "phase5-barricade";
export const TILED_PHASE5_GATE_TEXTURE_KEY = "narrative-gate";

/** Runtime de playtest do blockout Tiled da Fase 5. */
export class TiledPhase5Runtime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly credits: Phase5Credit[] = [];

  private readonly scanVisualsLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly fallDeathY: number;
  private readonly checkpoints: Phase5Checkpoint[] = [];
  private readonly checkpointTriggered = new Set<string>();
  private readonly checkpointMarkers = new Map<string, CheckpointMarker>();
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly hazardZones: Phaser.GameObjects.Zone[] = [];
  private readonly rotatingBarriers: RotatingBarrier[] = [];
  private readonly revealRegions: RevealRegion[] = [];
  private readonly hiddenVisualRegions: HiddenVisualRegion[] = [];
  private readonly revealedGroups = new Set<string>();
  private readonly doors: AutomaticDoor[] = [];
  private readonly breakables: RuntimeBreakable[] = [];
  private readonly breakableDefinitions: RuntimeBreakableDefinition[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly endMarkerObjects: Array<{ destroy(): void }> = [];
  private readonly offsetY: number;
  private readonly creditValue: number;
  private readonly contextLabel: string;
  private readonly timeSource: () => number;
  private readonly usesInternalTime: boolean;
  private elapsedMs = 0;
  private endGateTriggered = false;
  private playerRef?: Player;
  private pressedAttackListener: (breakable: Phaser.GameObjects.GameObject | null) => void = () => undefined;
  private normalAttackListener: (x: number, y: number) => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => boolean | void;
      onEndGate: () => void;
    },
    options: TiledPhase5RuntimeOptions = {},
  ) {
    this.offsetY = options.offsetY ?? TILED_FASE5_OFFSET_Y;
    this.creditValue = options.creditValue ?? 10;
    this.contextLabel = options.contextLabel ?? "Fase 5";
    this.usesInternalTime = options.timeSource === undefined;
    this.timeSource = options.timeSource ?? (() => this.elapsedMs);
    this.map = scene.make.tilemap({ key: options.mapKey ?? TILED_FASE5_MAP_KEY });
    const tilesets = (options.tilesets ?? TILED_FASE5_TILESETS).map(({ name, key }) => {
      const tileset = this.map.addTilesetImage(name, key);
      if (!tileset) throw new Error(`Tileset "${name}" não encontrado em ${this.contextLabel}`);
      return tileset;
    });

    this.createVisualLayer("background", tilesets, -20);
    this.createVisualLayer("deco-back", tilesets, -10);

    const ground = this.map.createLayer("ground", tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error(`${this.contextLabel} (Tiled): camada "ground" ausente`);
    ground.setPosition(ground.x, ground.y + this.offsetY);
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.scanVisualsLayer = this.createVisualLayer("scan-visuals", tilesets, 1);
    this.hazardsLayer = this.createVisualLayer("hazards", tilesets, 2);
    this.createVisualLayer("deco", tilesets, 3);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = this.offsetY + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawnObject = byType("spawn")[0];
    this.spawn = spawnObject
      ? { x: spawnObject.x ?? 80, y: (spawnObject.y ?? 384) + this.offsetY }
      : { x: 80, y: 560 };

    const endObject = byType("phase_end")[0];
    const gateObjects = byType("gate");
    this.endGateX = gateObjects[0]?.x ?? endObject?.x ?? this.lengthPx - 100;

    this.readCredits(byType("credit"));
    this.readCheckpoints(byType("checkpoint"));
    this.buildRevealRegions(byType("scan_reveal"));
    this.buildHazards(byType("hazard"));
    this.buildAutomaticDoors(byType("automatic_door"));
    this.buildBreakables(byType("breakable"));
    this.buildTutorials(byType("tutorial"));
    this.buildMilestoneLabels(byType("zone"), gateObjects);
    if (endObject && options.endLabel) this.buildEndMarker(endObject, options.endLabel);
    this.buildCredits();
    this.buildCheckpoints();
  }

  private createVisualLayer(
    name: string,
    tilesets: Phaser.Tilemaps.Tileset[],
    depth: number,
  ): Phaser.Tilemaps.TilemapLayer | undefined {
    const layer = this.map.createLayer(name, tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!layer) return undefined;
    layer.setPosition(layer.x, layer.y + this.offsetY);
    layer.setDepth(depth);
    return layer;
  }

  private readString(
    object: Phaser.Types.Tilemaps.TiledObject | undefined,
    name: string,
  ): string | undefined {
    if (!object) return undefined;
    const properties = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = properties.find((property) => property.name === name)?.value;
    return typeof value === "string" ? value : undefined;
  }

  private readNumber(object: Phaser.Types.Tilemaps.TiledObject, name: string): number | undefined {
    const properties = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = properties.find((property) => property.name === name)?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readCredits(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
      this.credits.push({
        id,
        x: object.x ?? 0,
        y: (object.y ?? 0) + this.offsetY,
        value: this.creditValue,
        route: this.readString(object, "route") === "risk" ? "risk" : "normal",
      });
    }
  }

  private readCheckpoints(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `checkpoint-${object.id}`;
      const x = object.x ?? 0;
      this.checkpoints.push({ id, x, y: this.groundSurfaceYAt(x), width: object.width ?? 32 });
    }
  }

  private groundSurfaceYAt(worldX: number): number {
    const col = Phaser.Math.Clamp(Math.floor(worldX / this.map.tileWidth), 0, this.map.width - 1);
    for (let row = 0; row < this.map.height; row += 1) {
      const tile = this.groundLayer.getTileAt(col, row);
      if (tile && tile.index !== -1) return this.offsetY + row * this.map.tileHeight;
    }
    return this.spawn?.y ?? 560;
  }

  private buildCredits(): void {
    for (const credit of this.credits) {
      if (this.consolidatedThisPhase.has(credit.id)) continue;
      const sprite = this.scene.physics.add.sprite(credit.x, credit.y, TEX.credit);
      sprite.body!.setAllowGravity(false);
      sprite.setData("creditValue", credit.value);
      sprite.setDepth(6);
      this.scene.tweens.add({
        targets: sprite,
        y: credit.y - 8,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.creditSprites.set(credit.id, sprite);
    }
  }

  private buildCheckpoints(): void {
    for (const checkpoint of this.checkpoints) {
      this.checkpointMarkers.set(
        checkpoint.id,
        new CheckpointMarker(this.scene, checkpoint.x + checkpoint.width / 2, checkpoint.y, 5),
      );
    }
  }

  private buildRevealRegions(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      const group = this.readString(object, "group");
      if (!kind || !REVEAL_KINDS.has(kind as RevealKind) || !group) {
        console.warn(`${this.contextLabel}: scan_reveal "${object.name ?? object.id}" inválido.`);
        continue;
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const outline = this.scene.add
        .rectangle(
          x + width / 2,
          y + this.offsetY + height / 2,
          width,
          height,
          0x36e2ff,
          0.04,
        )
        .setStrokeStyle(2, 0x36e2ff, 0.72)
        .setDepth(5)
        .setVisible(false);
      this.revealRegions.push({ kind: kind as RevealKind, group, x, y, width, height, outline });
    }
  }

  private buildHazards(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    objects.forEach((object, index) => {
      const kind = this.readString(object, "kind");
      if (!kind || !TOP_HAZARD_KINDS.has(kind)) {
        console.warn(`${this.contextLabel}: hazard "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}"; tratado como letal.`);
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      if (kind === "rotating_barrier") {
        this.buildRotatingBarrier(object, index, x, y, width, height);
        return;
      }
      const zone = this.scene.add.zone(
        x + width / 2,
        y + this.offsetY + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      this.hazardZones.push(zone);

      if (kind === "hidden_spikes") {
        const group = this.readString(object, "reveal_group");
        if (group) {
          const hidden = { group, x, y, width, height };
          this.hiddenVisualRegions.push(hidden);
          this.setHiddenVisual(hidden, false);
        }
      }
    });
    this.updateRotatingBarriers(this.timeSource());
  }

  private buildRotatingBarrier(
    object: Phaser.Types.Tilemaps.TiledObject,
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const centerX = x + width / 2;
    // Cria janelas reais quando o braço passa pela horizontal. O dash reduz
    // a exposição, mas continua sem invencibilidade, conforme o GDD.
    const centerY = y + this.offsetY + height / 2 - 16;
    const length = Math.max(width, height);
    const nodeCount = GAMEPLAY_TIMING.rotatingBarrier.collisionNodes;
    const nodeSize = Math.max(
      GAMEPLAY_TIMING.rotatingBarrier.nodeSize,
      length / Math.max(1, nodeCount - 1) + 2,
    );
    const arm = this.scene.add
      .rectangle(centerX, centerY, length, GAMEPLAY_TIMING.rotatingBarrier.nodeSize, 0xff4fe1, 0.88)
      .setStrokeStyle(2, 0xffd8fa, 0.95)
      .setDepth(6);
    const hub = this.scene.add
      .circle(centerX, centerY, 10, 0x2b1740, 1)
      .setStrokeStyle(3, 0x7cfcea, 0.95)
      .setDepth(7);
    const collisionNodes = Array.from({ length: nodeCount }, () => {
      const node = this.scene.add.zone(centerX, centerY, nodeSize, nodeSize);
      this.scene.physics.add.existing(node, true);
      return node;
    });
    this.rotatingBarriers.push({
      centerX,
      centerY,
      length,
      collisionSpan: Math.max(0, length - nodeSize),
      cycleMs: Math.max(1, this.readNumber(object, "cycle_ms") ?? GAMEPLAY_TIMING.rotatingBarrier.cycleMs),
      phaseMs: this.readNumber(object, "phase_ms") ?? index * 271,
      arm,
      hub,
      collisionNodes,
    });

    // O tile original funciona como suporte; o braço animado passa a ser o
    // único visual dominante e acompanha exatamente os corpos físicos.
    const startCol = Math.floor(x / this.map.tileWidth);
    const endCol = Math.ceil((x + width) / this.map.tileWidth);
    const startRow = Math.floor(y / this.map.tileHeight);
    const endRow = Math.ceil((y + height) / this.map.tileHeight);
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const tile = this.hazardsLayer?.getTileAt(col, row);
        if (tile && tile.index !== -1) tile.alpha = 0.18;
      }
    }
  }

  private updateRotatingBarriers(now: number): void {
    for (const barrier of this.rotatingBarriers) {
      const position = ((now + barrier.phaseMs) % barrier.cycleMs + barrier.cycleMs) % barrier.cycleMs;
      const angle = position / barrier.cycleMs * Math.PI * 2;
      barrier.arm.setRotation(angle);
      const points = rotatingBarrierPoints(
        barrier.centerX,
        barrier.centerY,
        barrier.collisionSpan,
        barrier.collisionNodes.length,
        angle,
      );
      barrier.collisionNodes.forEach((node, index) => {
        const point = points[index];
        node.setPosition(point.x, point.y);
        (node.body as Phaser.Physics.Arcade.StaticBody).reset(point.x, point.y);
      });
    }
  }

  private buildAutomaticDoors(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const width = object.width ?? 32;
      const height = object.height ?? 256;
      const x = object.x ?? 0;
      const y = object.y ?? 128;
      const doorCol = Math.floor(x / this.map.tileWidth);
      let firstDoorTileRow: number | undefined;
      for (let row = 0; row < this.map.height; row += 1) {
        if (this.hazardsLayer?.getTileAt(doorCol, row)?.index === DOOR_FIRST_GID) {
          firstDoorTileRow = row;
          break;
        }
      }
      const collisionTop = (firstDoorTileRow ?? Math.floor(y / this.map.tileHeight))
        * this.map.tileHeight + this.offsetY;
      const collisionBottom = this.groundSurfaceYAt(x);
      const collisionHeight = Math.max(this.map.tileHeight, collisionBottom - collisionTop);
      const zone = this.scene.add.zone(
        x + width / 2,
        collisionTop + collisionHeight / 2,
        width,
        collisionHeight,
      );
      this.scene.physics.add.existing(zone, true);
      const bottomTileRow = Math.ceil((y + height) / this.map.tileHeight) - 1;
      const bottomTile = this.hazardsLayer?.getTileAt(doorCol, bottomTileRow);
      if (bottomTile?.index === DOOR_FIRST_GID) {
        this.hazardsLayer?.putTileAt(DOOR_FIRST_GID, doorCol, bottomTileRow - 1);
        bottomTile.visible = false;
      }
      this.doors.push({
        id: this.readString(object, "id") ?? object.name ?? `door-${object.id}`,
        x,
        width,
        zone,
        col: doorCol,
        prompt: this.scene.add
          .text(x + width / 2, collisionTop - 8, "SCAN", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: "#7cfcea",
            backgroundColor: "#071b25dd",
            padding: { x: 5, y: 3 },
          })
          .setOrigin(0.5, 1)
          .setDepth(7),
        disabled: false,
      });
    }
  }

  private buildBreakables(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const width = object.width ?? 96;
      const height = object.height ?? 64;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const definition: RuntimeBreakableDefinition = {
        id: this.readString(object, "id") ?? object.name ?? String(object.id),
        x,
        y,
        width,
        height,
        startCol: Math.floor(x / this.map.tileWidth),
        endCol: Math.ceil((x + width) / this.map.tileWidth),
        startRow: Math.floor(y / this.map.tileHeight),
        endRow: Math.ceil((y + height) / this.map.tileHeight),
      };
      this.breakableDefinitions.push(definition);
      this.createBreakable(definition);
    }
  }

  private createBreakable(definition: RuntimeBreakableDefinition): void {
    if (this.breakables.some((breakable) => breakable.id === definition.id)) return;
    this.setBreakableTilesVisible(definition, false);
    const groundedHeight = Math.min(definition.height, BARRICADE_VISUAL_HEIGHT);
    const groundY = definition.y + this.offsetY + definition.height;
    const visual = this.scene.add
      .image(
        definition.x + definition.width / 2,
        groundY + ASSET_BASELINE_PADDING,
        TILED_PHASE5_BARRICADE_TEXTURE_KEY,
      )
      .setOrigin(0.5, 1)
      .setDisplaySize(definition.width, groundedHeight)
      .setDepth(4);
    const body = this.scene.add
      .rectangle(
        definition.x + definition.width / 2,
        groundY - groundedHeight / 2,
        definition.width,
        groundedHeight,
        0x000000,
        0.001,
      )
      .setDepth(4);
    this.scene.physics.add.existing(body, true);
    body.setData("breakableId", definition.id);
    const breakable: RuntimeBreakable = { ...definition, body, visual };
    this.breakables.push(breakable);
    if (this.playerRef) this.registerBreakableCollider(breakable, this.playerRef);
  }

  private registerBreakableCollider(breakable: RuntimeBreakable, player: Player): void {
    breakable.collider?.destroy();
    breakable.collider = this.scene.physics.add.collider(player.sprite, breakable.body, () => {
      if (player.getState() === "attacking") this.destroyBreakable(breakable);
      else player.enterPressedState(breakable.body);
    });
  }

  private setBreakableTilesVisible(
    breakable: Pick<RuntimeBreakable, "startCol" | "endCol" | "startRow" | "endRow">,
    visible: boolean,
  ): void {
    for (let row = breakable.startRow; row < breakable.endRow; row += 1) {
      for (let col = breakable.startCol; col < breakable.endCol; col += 1) {
        const tile = this.hazardsLayer?.getTileAt(col, row);
        if (tile && tile.index !== -1) tile.alpha = visible ? 1 : 0;
      }
    }
  }

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "dash") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + this.offsetY - 20,
          "DASH: K / SHIFT / RB (CONTROLE)\nuse no chão ou no ar; não concede invencibilidade",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "15px",
            color: "#d9f5ff",
            align: "center",
            backgroundColor: "#0b1b2bdd",
            padding: { x: 8, y: 5 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(7);
      this.labels.push(label);
    }
  }

  private buildMilestoneLabels(
    zones: Phaser.Types.Tilemaps.TiledObject[],
    gates: Phaser.Types.Tilemaps.TiledObject[],
  ): void {
    for (const object of zones) {
      if (this.readString(object, "kind") !== "contemplative") continue;
      this.labels.push(
        this.scene.add
          .text(
            (object.x ?? 0) + 360,
            (object.y ?? 0) + this.offsetY - 40,
            "FIM DOS OBSTÁCULOS\nTRECHO CONTEMPLATIVO",
            {
              fontFamily: "Courier New, monospace",
              fontSize: "20px",
              color: "#b8d8ef",
              align: "center",
              backgroundColor: "#0b1724cc",
              padding: { x: 14, y: 8 },
            },
          )
          .setOrigin(0.5, 1)
          .setDepth(7),
      );
    }
    for (const object of gates) {
      const width = object.width ?? 192;
      const height = object.height ?? 224;
      const centerX = (object.x ?? 0) + width / 2;
      const bottomY = (object.y ?? 0) + this.offsetY + height;
      const gate = this.scene.add
        .image(centerX, bottomY + ASSET_BASELINE_PADDING, TILED_PHASE5_GATE_TEXTURE_KEY)
        .setOrigin(0.5, 1)
        .setDisplaySize(width, height)
        .setDepth(4);
      this.endMarkerObjects.push(gate);
      this.labels.push(
        this.scene.add
          .text(
            centerX,
            (object.y ?? 0) + this.offsetY - 24,
            "PORTÃO\nCHROME  ←   |   →  FLESH",
            {
              fontFamily: "Courier New, monospace",
              fontSize: "22px",
              color: "#f1e5ff",
              align: "center",
              backgroundColor: "#17102bdd",
              padding: { x: 16, y: 10 },
            },
          )
          .setOrigin(0.5, 1)
          .setDepth(7),
      );
    }
  }

  private buildEndMarker(object: Phaser.Types.Tilemaps.TiledObject, label: string): void {
    const x = (object.x ?? this.lengthPx - 128) + (object.width ?? 0) / 2;
    const groundY = this.groundSurfaceYAt(x);
    const marker = this.scene.add
      .rectangle(x, groundY - 96, 10, 192, 0x7cfcea, 0.72)
      .setStrokeStyle(2, 0xe8ecff, 0.9)
      .setDepth(5);
    const text = this.scene.add
      .text(x, groundY - 215, label, {
        fontFamily: "Courier New, monospace",
        fontSize: "20px",
        color: "#7CFCEA",
        backgroundColor: "#08121ddd",
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5, 1)
      .setDepth(7);
    this.endMarkerObjects.push(marker, text);
  }

  registerPhysics(player: Player): void {
    this.playerRef = player;
    this.scene.physics.add.collider(player.sprite, this.groundLayer);
    for (const hazard of this.hazardZones) {
      this.scene.physics.add.overlap(player.sprite, hazard, () => player.kill());
    }
    for (const barrier of this.rotatingBarriers) {
      for (const node of barrier.collisionNodes) {
        this.scene.physics.add.overlap(player.sprite, node, () => player.kill());
      }
    }
    for (const door of this.doors) {
      this.scene.physics.add.overlap(player.sprite, door.zone, () => player.kill());
    }
    for (const breakable of this.breakables) {
      this.registerBreakableCollider(breakable, player);
    }

    this.pressedAttackListener = (object) => {
      const target = this.breakables.find((breakable) => breakable.body === object);
      if (target) this.destroyBreakable(target);
    };
    this.normalAttackListener = (x, y) => this.destroyBreakableInAttackRange(x, y);
    this.scene.events.on("player-attack-attempt", this.pressedAttackListener);
    this.scene.events.on("player-attack", this.normalAttackListener);
  }

  private destroyBreakable(target: RuntimeBreakable): void {
    const index = this.breakables.indexOf(target);
    if (index === -1) return;
    this.breakables.splice(index, 1);
    const physicsBody = target.body.body as Phaser.Physics.Arcade.StaticBody | null;
    if (physicsBody) physicsBody.enable = false;
    target.collider?.destroy();
    target.collider = undefined;
    this.setBreakableTilesVisible(target, false);
    target.visual.destroy();
    target.body.destroy();
    this.playerRef?.resolvePressedSuccess();
  }

  private destroyBreakableInAttackRange(attackX: number, attackY: number): void {
    const target = this.breakables.find((breakable) => {
      const leftEdge = breakable.body.x - breakable.body.displayWidth / 2;
      return breakable.body.active
        && leftEdge >= attackX - 8
        && leftEdge <= attackX + PHYSICS.attack.range
        && Math.abs(breakable.body.y - attackY) <= PHYSICS.attack.verticalRange;
    });
    if (target) this.destroyBreakable(target);
  }

  private setDoorDisabled(door: AutomaticDoor, disabled: boolean): void {
    if (door.disabled === disabled) return;
    door.disabled = disabled;
    const physicsBody = door.zone.body as Phaser.Physics.Arcade.StaticBody | null;
    if (physicsBody) physicsBody.enable = !disabled;
    door.prompt
      .setText("SCAN")
      .setColor("#7cfcea")
      .setVisible(!disabled);
    for (let row = 0; row < this.map.height; row += 1) {
      const tile = this.hazardsLayer?.getTileAt(door.col, row);
      if (tile?.index !== DOOR_FIRST_GID) continue;
      tile.alpha = disabled ? 0 : 1;
      tile.tint = 0xffffff;
    }
  }

  private disableNearestDoor(playerX: number): void {
    const index = nearestScanObstacleIndex(playerX, SCAN_RANGE, this.doors);
    if (index >= 0) this.setDoorDisabled(this.doors[index], true);
  }

  private distanceToRegion(playerX: number, region: RevealRegion): number {
    if (playerX < region.x) return region.x - playerX;
    if (playerX > region.x + region.width) return playerX - (region.x + region.width);
    return 0;
  }

  private setRegionTiles(region: RevealRegion, revealed: boolean): void {
    if (!this.scanVisualsLayer) return;
    const startCol = Math.floor(region.x / this.map.tileWidth);
    const endCol = Math.ceil((region.x + region.width) / this.map.tileWidth);
    const startRow = Math.floor(region.y / this.map.tileHeight);
    const endRow = Math.ceil((region.y + region.height) / this.map.tileHeight);
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const tile = this.scanVisualsLayer.getTileAt(col, row);
        if (!tile || tile.index === -1) continue;
        tile.tint = revealed ? 0x36e2ff : 0xffffff;
        if (region.kind === "false_wall" || region.kind === "false_floor") {
          tile.alpha = revealed ? 0.42 : 1;
        }
      }
    }
  }

  private setHiddenVisual(hidden: HiddenVisualRegion, revealed: boolean): void {
    if (!this.scanVisualsLayer) return;
    const startCol = Math.floor(hidden.x / this.map.tileWidth);
    const endCol = Math.ceil((hidden.x + hidden.width) / this.map.tileWidth);
    const startRow = Math.floor(hidden.y / this.map.tileHeight);
    const endRow = Math.ceil((hidden.y + hidden.height) / this.map.tileHeight);
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const tile = this.scanVisualsLayer.getTileAt(col, row);
        if (!tile || tile.index === -1) continue;
        tile.alpha = revealed ? 1 : 0;
        tile.tint = revealed ? 0x36e2ff : 0xffffff;
      }
    }
  }

  private revealGroup(group: string): void {
    if (this.revealedGroups.has(group)) return;
    this.revealedGroups.add(group);
    for (const region of this.revealRegions.filter((item) => item.group === group)) {
      region.outline.setVisible(true);
      this.setRegionTiles(region, true);
    }
    for (const hidden of this.hiddenVisualRegions.filter((item) => item.group === group)) {
      this.setHiddenVisual(hidden, true);
    }
  }

  private clearPassedRevealGroups(playerX: number): void {
    for (const group of [...this.revealedGroups]) {
      const regions = this.revealRegions.filter((region) => region.group === group);
      const maxRight = Math.max(...regions.map((region) => region.x + region.width));
      if (playerX <= maxRight + 384) continue;
      this.revealedGroups.delete(group);
      for (const region of regions) {
        region.outline.setVisible(false);
        this.setRegionTiles(region, false);
      }
      for (const hidden of this.hiddenVisualRegions.filter((item) => item.group === group)) {
        this.setHiddenVisual(hidden, false);
      }
    }
  }

  setScanActive(active: boolean): void {
    if (!active || !this.playerRef) return;
    const playerX = this.playerRef.sprite.x;
    this.disableNearestDoor(playerX);
    const groups = new Set(
      this.revealRegions
        .filter((region) => this.distanceToRegion(playerX, region) <= SCAN_RANGE)
        .map((region) => region.group),
    );
    groups.forEach((group) => this.revealGroup(group));
  }

  /** Restaura o trecho após uma morte sem recriar créditos, checkpoint ou cronômetro. */
  resetMutableObstacles(): void {
    const activeBreakableIds = new Set(this.breakables.map((breakable) => breakable.id));
    for (const definition of this.breakableDefinitions) {
      if (!activeBreakableIds.has(definition.id)) this.createBreakable(definition);
    }

    for (const region of this.revealRegions) {
      region.outline.setVisible(false);
      this.setRegionTiles(region, false);
    }
    for (const hidden of this.hiddenVisualRegions) this.setHiddenVisual(hidden, false);
    this.revealedGroups.clear();

    // Portas reutilizam os mesmos corpos: o respawn apenas religa colisão e
    // visual, sem criar zonas ou overlaps duplicados.
    for (const door of this.doors) this.setDoorDisabled(door, false);

    const restored = this.mutableObstacleState();
    if (
      restored.breakables !== restored.breakableDefinitions ||
      restored.activeBreakableColliders !== restored.breakableDefinitions ||
      restored.disabledDoors !== 0 ||
      restored.revealedGroups !== 0
    ) {
      throw new Error(`${this.contextLabel}: restauração de obstáculos ficou inconsistente.`);
    }
  }

  /** Estado pequeno usado por playtests para detectar duplicações após respawns. */
  mutableObstacleState(): {
    breakables: number;
    breakableDefinitions: number;
    activeBreakableColliders: number;
    doors: number;
    disabledDoors: number;
    revealedGroups: number;
  } {
    return {
      breakables: this.breakables.length,
      breakableDefinitions: this.breakableDefinitions.length,
      activeBreakableColliders: this.breakables.filter((breakable) => breakable.collider?.active).length,
      doors: this.doors.length,
      disabledDoors: this.doors.filter((door) => door.disabled).length,
      revealedGroups: this.revealedGroups.size,
    };
  }

  update(player: Player, deltaMs = 0): void {
    if (this.usesInternalTime) this.elapsedMs += Math.max(0, deltaMs);
    const now = this.timeSource();
    this.updateRotatingBarriers(now);
    this.clearPassedRevealGroups(player.sprite.x);

    this.creditSprites.forEach((sprite, id) => {
      if (!sprite.active) return;
      if (Math.abs(sprite.x - player.sprite.x) < 28 && Math.abs(sprite.y - player.sprite.y + 24) < 40) {
        sprite.setActive(false).setVisible(false);
        if (sprite.body) sprite.body.enable = false;
        this.callbacks.onCreditCollected(id, sprite.getData("creditValue"));
      }
    });

    for (const checkpoint of this.checkpoints) {
      if (this.checkpointTriggered.has(checkpoint.id)) continue;
      if (Math.abs(player.sprite.x - checkpoint.x) < 28) {
        this.checkpointTriggered.add(checkpoint.id);
        const withFeedback = this.callbacks.onCheckpoint(checkpoint.id, checkpoint.x, checkpoint.y) !== false;
        this.checkpointMarkers.get(checkpoint.id)?.activate(withFeedback);
      }
    }

    if (player.sprite.y > this.fallDeathY && player.getState() !== "dead") {
      player.kill();
      return;
    }
    if (!this.endGateTriggered && player.sprite.x >= this.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate();
    }
  }

  destroy(): void {
    this.scene.events.off("player-attack-attempt", this.pressedAttackListener);
    this.scene.events.off("player-attack", this.normalAttackListener);
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.checkpointMarkers.forEach((marker) => marker.destroy());
    this.hazardZones.forEach((zone) => zone.destroy());
    this.rotatingBarriers.forEach((barrier) => {
      barrier.arm.destroy();
      barrier.hub.destroy();
      barrier.collisionNodes.forEach((node) => node.destroy());
    });
    this.doors.forEach((door) => {
      door.zone.destroy();
      door.prompt.destroy();
    });
    this.breakables.forEach((breakable) => {
      breakable.collider?.destroy();
      breakable.visual.destroy();
      breakable.body.destroy();
    });
    this.revealRegions.forEach((region) => region.outline.destroy());
    this.labels.forEach((label) => label.destroy());
    this.endMarkerObjects.forEach((object) => object.destroy());
  }
}

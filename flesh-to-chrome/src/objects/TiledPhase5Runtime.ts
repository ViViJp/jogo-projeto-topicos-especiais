import Phaser from "phaser";
import { Player } from "../entities/Player";
import {
  TILED_FASE5_MAP_KEY,
  TILED_FASE5_OFFSET_Y,
  TILED_FASE5_TILESETS,
} from "../levels/TiledFase5";
import { TEX } from "../utils/PlaceholderTextures";
import { TILED_CHECKPOINT_TEXTURE_KEY } from "./TiledLevelRuntime";

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
  zone: Phaser.GameObjects.Zone;
  col: number;
  cycleMs: number;
  openMs: number;
  phaseMs: number;
  open?: boolean;
}

interface RuntimeBreakable {
  body: Phaser.GameObjects.Rectangle;
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
}

const TOP_HAZARD_KINDS = new Set(["laser_grid", "rotating_barrier", "hidden_spikes"]);
const REVEAL_KINDS = new Set<RevealKind>(["hidden_route", "false_wall", "hidden_hazard", "false_floor"]);
const SCAN_RANGE = 900;
const DOOR_FIRST_GID = 521;

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
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly hazardZones: Phaser.GameObjects.Zone[] = [];
  private readonly revealRegions: RevealRegion[] = [];
  private readonly hiddenVisualRegions: HiddenVisualRegion[] = [];
  private readonly revealedGroups = new Set<string>();
  private readonly doors: AutomaticDoor[] = [];
  private readonly breakables: RuntimeBreakable[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private endGateTriggered = false;
  private playerRef?: Player;
  private pressedAttackListener: (breakable: Phaser.GameObjects.GameObject | null) => void = () => undefined;
  private normalAttackListener: (x: number, y: number) => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: () => void;
    },
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE5_MAP_KEY });
    const tilesets = TILED_FASE5_TILESETS.map(({ name, key }) => {
      const tileset = this.map.addTilesetImage(name, key);
      if (!tileset) throw new Error(`Tileset "${name}" não encontrado na Fase 5`);
      return tileset;
    });

    this.createVisualLayer("background", tilesets, -20);
    this.createVisualLayer("deco-back", tilesets, -10);

    const ground = this.map.createLayer("ground", tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 5 (Tiled): camada "ground" ausente');
    ground.setPosition(ground.x, ground.y + TILED_FASE5_OFFSET_Y);
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.scanVisualsLayer = this.createVisualLayer("scan-visuals", tilesets, 1);
    this.hazardsLayer = this.createVisualLayer("hazards", tilesets, 2);
    this.createVisualLayer("deco", tilesets, 3);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = TILED_FASE5_OFFSET_Y + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawnObject = byType("spawn")[0];
    this.spawn = spawnObject
      ? { x: spawnObject.x ?? 80, y: (spawnObject.y ?? 384) + TILED_FASE5_OFFSET_Y }
      : { x: 80, y: 560 };

    const endObject = byType("phase_end")[0];
    this.endGateX = endObject?.x ?? this.lengthPx - 100;

    this.readCredits(byType("credit"));
    this.readCheckpoints(byType("checkpoint"));
    this.buildRevealRegions(byType("scan_reveal"));
    this.buildHazards(byType("hazard"));
    this.buildAutomaticDoors(byType("automatic_door"));
    this.buildBreakables(byType("breakable"));
    this.buildTutorials(byType("tutorial"));
    this.buildMilestoneLabels(byType("zone"), byType("gate"));
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
    layer.setPosition(layer.x, layer.y + TILED_FASE5_OFFSET_Y);
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
      if (this.consolidatedThisPhase.has(id)) continue;
      this.credits.push({
        id,
        x: object.x ?? 0,
        y: (object.y ?? 0) + TILED_FASE5_OFFSET_Y,
        value: 10,
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
      if (tile && tile.index !== -1) return TILED_FASE5_OFFSET_Y + row * this.map.tileHeight;
    }
    return this.spawn?.y ?? 560;
  }

  private buildCredits(): void {
    for (const credit of this.credits) {
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
      this.scene.add
        .image(checkpoint.x + checkpoint.width / 2, checkpoint.y, TILED_CHECKPOINT_TEXTURE_KEY)
        .setOrigin(0.5, 1)
        .setDisplaySize(72, 61)
        .setDepth(5);
    }
  }

  private buildRevealRegions(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      const group = this.readString(object, "group");
      if (!kind || !REVEAL_KINDS.has(kind as RevealKind) || !group) {
        console.warn(`Fase 5: scan_reveal "${object.name ?? object.id}" inválido.`);
        continue;
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const outline = this.scene.add
        .rectangle(
          x + width / 2,
          y + TILED_FASE5_OFFSET_Y + height / 2,
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
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      if (!kind || !TOP_HAZARD_KINDS.has(kind)) {
        console.warn(`Fase 5: hazard "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}"; tratado como letal.`);
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const zone = this.scene.add.zone(
        x + width / 2,
        y + TILED_FASE5_OFFSET_Y + height / 2,
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
    }
  }

  private buildAutomaticDoors(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const width = object.width ?? 32;
      const height = object.height ?? 256;
      const x = object.x ?? 0;
      const y = object.y ?? 128;
      const zone = this.scene.add.zone(
        x + width / 2,
        y + TILED_FASE5_OFFSET_Y + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      this.doors.push({
        zone,
        col: Math.floor(x / this.map.tileWidth),
        cycleMs: Math.max(1, this.readNumber(object, "cycle_ms") ?? 1800),
        openMs: Math.max(0, this.readNumber(object, "open_ms") ?? 760),
        phaseMs: this.readNumber(object, "phase_ms") ?? 0,
      });
    }
  }

  private buildBreakables(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const width = object.width ?? 96;
      const height = object.height ?? 64;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const body = this.scene.add
        .rectangle(
          x + width / 2,
          y + TILED_FASE5_OFFSET_Y + height / 2,
          width,
          height,
          0x000000,
          0.001,
        )
        .setDepth(4);
      this.scene.physics.add.existing(body, true);
      body.setData("breakableId", this.readString(object, "id") ?? object.name ?? String(object.id));
      this.breakables.push({
        body,
        startCol: Math.floor(x / this.map.tileWidth),
        endCol: Math.ceil((x + width) / this.map.tileWidth),
        startRow: Math.floor(y / this.map.tileHeight),
        endRow: Math.ceil((y + height) / this.map.tileHeight),
      });
    }
  }

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "dash") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + TILED_FASE5_OFFSET_Y - 20,
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
            (object.y ?? 0) + TILED_FASE5_OFFSET_Y - 40,
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
      this.labels.push(
        this.scene.add
          .text(
            (object.x ?? 0) + (object.width ?? 0) / 2,
            (object.y ?? 0) + TILED_FASE5_OFFSET_Y - 24,
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

  registerPhysics(player: Player): void {
    this.playerRef = player;
    this.scene.physics.add.collider(player.sprite, this.groundLayer);
    for (const hazard of this.hazardZones) {
      this.scene.physics.add.overlap(player.sprite, hazard, () => player.kill());
    }
    for (const door of this.doors) {
      this.scene.physics.add.overlap(player.sprite, door.zone, () => player.kill());
    }
    for (const breakable of this.breakables) {
      this.scene.physics.add.collider(player.sprite, breakable.body, () => {
        if (player.getState() === "attacking") this.destroyBreakable(breakable);
        else player.enterPressedState(breakable.body);
      });
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
    for (let row = target.startRow; row < target.endRow; row += 1) {
      for (let col = target.startCol; col < target.endCol; col += 1) {
        const tile = this.hazardsLayer?.getTileAt(col, row);
        if (tile && tile.index !== -1) tile.alpha = 0;
      }
    }
    target.body.destroy();
    this.playerRef?.resolvePressedSuccess();
  }

  private destroyBreakableInAttackRange(attackX: number, attackY: number): void {
    const target = this.breakables.find((breakable) => {
      const leftEdge = breakable.body.x - breakable.body.displayWidth / 2;
      return breakable.body.active
        && leftEdge >= attackX - 8
        && leftEdge <= attackX + 62
        && Math.abs(breakable.body.y - attackY) <= 58;
    });
    if (target) this.destroyBreakable(target);
  }

  private updateDoors(now: number): void {
    for (const door of this.doors) {
      const open = (now + door.phaseMs) % door.cycleMs < Math.min(door.openMs, door.cycleMs);
      if (door.open === open) continue;
      door.open = open;
      const physicsBody = door.zone.body as Phaser.Physics.Arcade.StaticBody | null;
      if (physicsBody) physicsBody.enable = !open;
      for (let row = 0; row < this.map.height; row += 1) {
        const tile = this.hazardsLayer?.getTileAt(door.col, row);
        if (tile?.index === DOOR_FIRST_GID) tile.alpha = open ? 0.12 : 1;
      }
    }
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
    const groups = new Set(
      this.revealRegions
        .filter((region) => this.distanceToRegion(playerX, region) <= SCAN_RANGE)
        .map((region) => region.group),
    );
    groups.forEach((group) => this.revealGroup(group));
  }

  update(player: Player): void {
    this.updateDoors(this.scene.time.now);
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
        this.callbacks.onCheckpoint(checkpoint.id, checkpoint.x, checkpoint.y);
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
    this.hazardZones.forEach((zone) => zone.destroy());
    this.doors.forEach((door) => door.zone.destroy());
    this.breakables.forEach((breakable) => breakable.body.destroy());
    this.revealRegions.forEach((region) => region.outline.destroy());
    this.labels.forEach((label) => label.destroy());
  }
}

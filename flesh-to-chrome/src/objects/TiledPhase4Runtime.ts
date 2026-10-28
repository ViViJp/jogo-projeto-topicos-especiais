import Phaser from "phaser";
import { Player } from "../entities/Player";
import {
  TILED_FASE4_MAP_KEY,
  TILED_FASE4_OFFSET_Y,
  TILED_FASE4_TILESETS,
} from "../levels/TiledFase4";
import { AbilityState } from "../systems/AbilityState";
import { TEX } from "../utils/PlaceholderTextures";
import { TILED_CHECKPOINT_TEXTURE_KEY } from "./TiledLevelRuntime";

interface Phase4Credit {
  id: string;
  x: number;
  y: number;
  value: number;
  route: "normal" | "risk";
}

interface Phase4Checkpoint {
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

interface HiddenHazardVisual {
  group: string;
  col: number;
  row: number;
}

interface AutomaticDoor {
  zone: Phaser.GameObjects.Zone;
  col: number;
  cycleMs: number;
  openMs: number;
  phaseMs: number;
  open?: boolean;
}

const CORPORATE_HAZARD_KINDS = new Set(["laser", "hidden_spikes"]);
const REVEAL_KINDS = new Set<RevealKind>(["hidden_route", "false_wall", "hidden_hazard", "false_floor"]);
const SCAN_RANGE = 900;
const SPIKES_FIRST_GID = 99;
const DOOR_FIRST_GID = 109;

/** Runtime jogável do blockout corporativo da Fase 4. */
export class TiledPhase4Runtime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly clinicDestination: string;
  readonly clinicImplant?: keyof AbilityState;
  readonly credits: Phase4Credit[] = [];

  private readonly scanVisualsLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly fallDeathY: number;
  private readonly checkpoints: Phase4Checkpoint[] = [];
  private readonly checkpointTriggered = new Set<string>();
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly hazardZones: Phaser.GameObjects.Zone[] = [];
  private readonly hiddenHazardVisuals: HiddenHazardVisual[] = [];
  private readonly revealRegions: RevealRegion[] = [];
  private readonly revealedGroups = new Set<string>();
  private readonly doors: AutomaticDoor[] = [];
  private readonly tutorialLabels: Phaser.GameObjects.Text[] = [];
  private readonly narrativeLabels: Phaser.GameObjects.Text[] = [];
  private endGateTriggered = false;
  private playerRef?: Player;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: (destination: string, implant?: keyof AbilityState) => void;
    },
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE4_MAP_KEY });
    const tilesets = TILED_FASE4_TILESETS.map(({ name, key }) => {
      const tileset = this.map.addTilesetImage(name, key);
      if (!tileset) throw new Error(`Tileset "${name}" não encontrado na Fase 4`);
      return tileset;
    });

    this.createVisualLayer("background", tilesets, -20);
    this.createVisualLayer("deco-back", tilesets, -10);

    const ground = this.map.createLayer("ground", tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 4 (Tiled): camada "ground" ausente');
    ground.setPosition(ground.x, ground.y + TILED_FASE4_OFFSET_Y);
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.scanVisualsLayer = this.createVisualLayer("scan-visuals", tilesets, 1);
    this.hazardsLayer = this.createVisualLayer("hazards", tilesets, 2);
    this.createVisualLayer("deco", tilesets, 3);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = TILED_FASE4_OFFSET_Y + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawnObject = byType("spawn")[0];
    this.spawn = spawnObject
      ? { x: spawnObject.x ?? 80, y: (spawnObject.y ?? 384) + TILED_FASE4_OFFSET_Y }
      : { x: 80, y: 560 };

    const endObject = byType("phase_end")[0];
    this.endGateX = endObject?.x ?? this.lengthPx - 100;

    const clinicObject = byType("clinic")[0];
    this.clinicDestination = this.readString(clinicObject, "next") ?? "ClinicScene";
    const implant = this.readString(clinicObject, "implant");
    this.clinicImplant = implant && ["legs", "arms", "eyes", "thrusters"].includes(implant)
      ? implant as keyof AbilityState
      : undefined;

    this.readCredits(byType("credit"));
    this.readCheckpoints(byType("checkpoint"));
    this.buildRevealRegions(byType("scan_reveal"));
    this.buildHazards(byType("hazard"));
    this.buildAutomaticDoors(byType("automatic_door"));
    this.buildTutorials(byType("tutorial"));
    this.buildNarrative(byType("narrative"));
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
    layer.setPosition(layer.x, layer.y + TILED_FASE4_OFFSET_Y);
    layer.setDepth(depth);
    return layer;
  }

  private readString(
    object: Phaser.Types.Tilemaps.TiledObject | undefined,
    name: string,
  ): string | undefined {
    if (!object) return undefined;
    const props = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = props.find((property) => property.name === name)?.value;
    return typeof value === "string" ? value : undefined;
  }

  private readNumber(object: Phaser.Types.Tilemaps.TiledObject, name: string): number | undefined {
    const props = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = props.find((property) => property.name === name)?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readCredits(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
      if (this.consolidatedThisPhase.has(id)) continue;
      this.credits.push({
        id,
        x: object.x ?? 0,
        y: (object.y ?? 0) + TILED_FASE4_OFFSET_Y,
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
      if (tile && tile.index !== -1) return TILED_FASE4_OFFSET_Y + row * this.map.tileHeight;
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
        console.warn(`Fase 4: scan_reveal "${object.name ?? object.id}" inválido.`);
        continue;
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const outline = this.scene.add
        .rectangle(
          x + width / 2,
          y + TILED_FASE4_OFFSET_Y + height / 2,
          width,
          height,
          0x36e2ff,
          0.04,
        )
        .setStrokeStyle(2, 0x36e2ff, 0.72)
        .setDepth(4)
        .setVisible(false);
      this.revealRegions.push({ kind: kind as RevealKind, group, x, y, width, height, outline });
    }
  }

  private buildHazards(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      if (!kind || !CORPORATE_HAZARD_KINDS.has(kind)) {
        console.warn(`Fase 4: hazard "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}"; tratado como letal.`);
      }
      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const zone = this.scene.add.zone(
        x + width / 2,
        y + TILED_FASE4_OFFSET_Y + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      this.hazardZones.push(zone);

      if (kind === "hidden_spikes") {
        const group = this.readString(object, "reveal_group");
        if (group) {
          const col = Math.floor(x / this.map.tileWidth);
          const row = Math.floor(y / this.map.tileHeight);
          this.hiddenHazardVisuals.push({ group, col, row });
          const tile = this.scanVisualsLayer?.getTileAt(col, row);
          if (tile?.index === SPIKES_FIRST_GID) tile.alpha = 0;
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
        y + TILED_FASE4_OFFSET_Y + height / 2,
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

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "scan") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + TILED_FASE4_OFFSET_Y - 20,
          "SCAN: E / L / Y ou SELECT (CONTROLE)\nrevela rotas, pisos e armadilhas ocultas",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "15px",
            color: "#bff8ff",
            align: "center",
            backgroundColor: "#071b25dd",
            padding: { x: 8, y: 5 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(7);
      this.tutorialLabels.push(label);
    }
  }

  private buildNarrative(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "kind") !== "father_ad") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + TILED_FASE4_OFFSET_Y + 24,
          "REFORGE INDUSTRIES\n\"O futuro exige que você deixe algo para trás.\"\n— campanha com o rosto do pai de Alex",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#f2e5ff",
            align: "center",
            backgroundColor: "#240d35e6",
            padding: { x: 14, y: 9 },
          },
        )
        .setOrigin(0.5, 0)
        .setDepth(7)
        .setVisible(false);
      label.setData("triggerX", object.x ?? 0);
      label.setData("triggerWidth", object.width ?? 0);
      this.narrativeLabels.push(label);
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
  }

  private updateDoors(now: number): void {
    for (const door of this.doors) {
      const open = (now + door.phaseMs) % door.cycleMs < Math.min(door.openMs, door.cycleMs);
      if (door.open === open) continue;
      door.open = open;
      const body = door.zone.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = !open;
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

  private revealGroup(group: string): void {
    if (this.revealedGroups.has(group)) return;
    this.revealedGroups.add(group);
    for (const region of this.revealRegions.filter((item) => item.group === group)) {
      region.outline.setVisible(true);
      this.setRegionTiles(region, true);
    }
    for (const hidden of this.hiddenHazardVisuals.filter((item) => item.group === group)) {
      const tile = this.scanVisualsLayer?.getTileAt(hidden.col, hidden.row);
      if (tile?.index === SPIKES_FIRST_GID) {
        tile.alpha = 1;
        tile.tint = 0x36e2ff;
      }
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
      for (const hidden of this.hiddenHazardVisuals.filter((item) => item.group === group)) {
        const tile = this.scanVisualsLayer?.getTileAt(hidden.col, hidden.row);
        if (tile?.index === SPIKES_FIRST_GID) tile.alpha = 0;
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

    for (const label of this.narrativeLabels) {
      const start = label.getData("triggerX") as number;
      const width = label.getData("triggerWidth") as number;
      label.setVisible(player.sprite.x >= start - 400 && player.sprite.x <= start + width + 200);
    }

    if (player.sprite.y > this.fallDeathY && player.getState() !== "dead") {
      player.kill();
      return;
    }
    if (!this.endGateTriggered && player.sprite.x >= this.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate(this.clinicDestination, this.clinicImplant);
    }
  }

  destroy(): void {
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.hazardZones.forEach((zone) => zone.destroy());
    this.doors.forEach((door) => door.zone.destroy());
    this.revealRegions.forEach((region) => region.outline.destroy());
    this.tutorialLabels.forEach((label) => label.destroy());
    this.narrativeLabels.forEach((label) => label.destroy());
  }
}

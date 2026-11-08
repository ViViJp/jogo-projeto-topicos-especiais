import Phaser from "phaser";
import { Player } from "../entities/Player";
import {
  TILED_FASE4_MAP_KEY,
  TILED_FASE4_OFFSET_Y,
  TILED_FASE4_TILESETS,
} from "../levels/TiledFase4";
import { AbilityState } from "../systems/AbilityState";
import { TEX } from "../utils/PlaceholderTextures";
import { CheckpointMarker } from "./CheckpointMarker";
import { nearestScanObstacleIndex } from "./HazardMotion";

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

interface FalseWall {
  region: RevealRegion;
  zone: Phaser.GameObjects.Zone;
  intangible: boolean;
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

const CORPORATE_HAZARD_KINDS = new Set(["laser", "hidden_spikes"]);
const REVEAL_KINDS = new Set<RevealKind>(["hidden_route", "false_wall", "hidden_hazard", "false_floor"]);
const SCAN_RANGE = 900;
const SPIKES_FIRST_GID = 99;
const DOOR_FIRST_GID = 109;
const BACKGROUND_TOWER_GID = 30;
const FLOATING_TERMINAL_GID = 86;
export const TILED_FATHER_AD_TEXTURE_KEY = "phase4-father-ad";

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
  private readonly decoBackLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly decoLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly fallDeathY: number;
  private readonly checkpoints: Phase4Checkpoint[] = [];
  private readonly checkpointTriggered = new Set<string>();
  private readonly checkpointMarkers = new Map<string, CheckpointMarker>();
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly hazardZones: Phaser.GameObjects.Zone[] = [];
  private readonly hiddenHazardVisuals: HiddenHazardVisual[] = [];
  private readonly revealRegions: RevealRegion[] = [];
  private readonly falseWalls: FalseWall[] = [];
  private readonly revealedGroups = new Set<string>();
  private readonly doors: AutomaticDoor[] = [];
  private readonly tutorialLabels: Phaser.GameObjects.Text[] = [];
  private readonly narrativeLabels: Phaser.GameObjects.Text[] = [];
  private readonly narrativeVisuals: Phaser.GameObjects.Image[] = [];
  private endGateTriggered = false;
  private playerRef?: Player;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => boolean | void;
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
    this.decoBackLayer = this.createVisualLayer("deco-back", tilesets, -10);

    const ground = this.map.createLayer("ground", tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 4 (Tiled): camada "ground" ausente');
    ground.setPosition(ground.x, ground.y + TILED_FASE4_OFFSET_Y);
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.scanVisualsLayer = this.createVisualLayer("scan-visuals", tilesets, 1);
    this.hazardsLayer = this.createVisualLayer("hazards", tilesets, 2);
    this.decoLayer = this.createVisualLayer("deco", tilesets, 3);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = TILED_FASE4_OFFSET_Y + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    this.removeObsoleteDecorations(byType("checkpoint"), byType("narrative"));

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

  private readCredits(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
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
      const region = { kind: kind as RevealKind, group, x, y, width, height, outline };
      this.revealRegions.push(region);
      if (region.kind === "false_wall") {
        const zone = this.scene.add.zone(
          x + width / 2,
          y + TILED_FASE4_OFFSET_Y + height / 2,
          width,
          height,
        );
        this.scene.physics.add.existing(zone, true);
        this.falseWalls.push({ region, zone, intangible: false });
      }
    }
  }

  /**
   * Remove os blockouts que competiam com elementos de gameplay: as torres
   * atrás da TV e da propaganda e os terminais que flutuavam ao redor do
   * texto narrativo. As posições continuam derivadas dos objetos Tiled.
   */
  private removeObsoleteDecorations(
    checkpoints: Phaser.Types.Tilemaps.TiledObject[],
    narratives: Phaser.Types.Tilemaps.TiledObject[],
  ): void {
    for (const checkpoint of checkpoints) {
      this.hideGidsInObjectBounds(this.decoBackLayer, checkpoint, new Set([BACKGROUND_TOWER_GID]), 0);
    }
    for (const narrative of narratives) {
      this.hideGidsInObjectBounds(this.decoBackLayer, narrative, new Set([BACKGROUND_TOWER_GID]), 0);
      this.hideGidsInObjectBounds(this.decoLayer, narrative, new Set([FLOATING_TERMINAL_GID]));
    }
  }

  private hideGidsInObjectBounds(
    layer: Phaser.Tilemaps.TilemapLayer | undefined,
    object: Phaser.Types.Tilemaps.TiledObject,
    gids: ReadonlySet<number>,
    startY = object.y ?? 0,
  ): void {
    if (!layer) return;
    const startCol = Math.floor((object.x ?? 0) / this.map.tileWidth);
    const endCol = Math.ceil(((object.x ?? 0) + (object.width ?? 0)) / this.map.tileWidth);
    const startRow = Math.floor(startY / this.map.tileHeight);
    const endRow = Math.ceil(((object.y ?? 0) + (object.height ?? 0)) / this.map.tileHeight);
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const tile = layer.getTileAt(col, row);
        if (tile && gids.has(tile.index)) tile.visible = false;
      }
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
      const doorCol = Math.floor(x / this.map.tileWidth);
      let firstDoorTileRow: number | undefined;
      for (let row = 0; row < this.map.height; row += 1) {
        if (this.hazardsLayer?.getTileAt(doorCol, row)?.index === DOOR_FIRST_GID) {
          firstDoorTileRow = row;
          break;
        }
      }
      const collisionTop = (firstDoorTileRow ?? Math.floor(y / this.map.tileHeight))
        * this.map.tileHeight + TILED_FASE4_OFFSET_Y;
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

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "scan") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + TILED_FASE4_OFFSET_Y - 20,
          "SCAN: E / L / Y ou SELECT (CONTROLE)\nrevela segredos e desativa a próxima barreira",
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
      const x = object.x ?? 0;
      const y = (object.y ?? 0) + TILED_FASE4_OFFSET_Y;
      const width = object.width ?? 1024;
      const height = object.height ?? 224;
      const propaganda = this.scene.add
        .image(x + 210, y + height / 2, TILED_FATHER_AD_TEXTURE_KEY)
        .setDisplaySize(320, 192)
        .setDepth(6);
      this.narrativeVisuals.push(propaganda);
      const label = this.scene.add
        .text(
          x + 430,
          y + height / 2,
          "REFORGE INDUSTRIES\n\"O FUTURO EXIGE QUE VOCÊ DEIXE ALGO PARA TRÁS.\"\n\nO rosto da campanha é familiar.\nAlex reconhece o homem que veio procurar.",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "17px",
            color: "#f2e5ff",
            align: "left",
            backgroundColor: "#240d35e6",
            padding: { x: 14, y: 9 },
            wordWrap: { width: Math.max(420, width - 460) },
          },
        )
        .setOrigin(0, 0.5)
        .setDepth(7)
        .setVisible(true);
      label.setData("triggerX", x);
      label.setData("triggerWidth", width);
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
    for (const wall of this.falseWalls) {
      this.scene.physics.add.collider(player.sprite, wall.zone);
    }
  }

  private setFalseWallIntangible(wall: FalseWall, intangible: boolean): void {
    if (wall.intangible === intangible) return;
    wall.intangible = intangible;
    const body = wall.zone.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = !intangible;

    const region = wall.region;
    const startCol = Math.floor(region.x / this.map.tileWidth);
    const endCol = Math.ceil((region.x + region.width) / this.map.tileWidth);
    const startRow = Math.floor(region.y / this.map.tileHeight);
    const endRow = Math.ceil((region.y + region.height) / this.map.tileHeight);
    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const tile = this.scanVisualsLayer?.getTileAt(col, row);
        if (!tile || tile.index === -1) continue;
        tile.alpha = intangible ? 0 : 1;
        tile.tint = intangible ? 0x36e2ff : 0xffffff;
      }
    }
    region.outline.setVisible(false);
  }

  private setDoorDisabled(door: AutomaticDoor, disabled: boolean): void {
    if (door.disabled === disabled) return;
    door.disabled = disabled;
    const body = door.zone.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = !disabled;
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
    if (region.kind === "false_wall") return;
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
        if (region.kind === "false_floor") {
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
    // Paredes falsas resolvidas permanecem invisíveis e intangíveis durante
    // toda a tentativa. O callback `false` apenas encerra o efeito visual
    // global do visor; a cena recria as paredes ao morrer/reiniciar a fase.
    if (!active) return;
    if (!this.playerRef) return;
    const playerX = this.playerRef.sprite.x;
    this.disableNearestDoor(playerX);
    const groups = new Set(
      this.revealRegions
        .filter((region) => this.distanceToRegion(playerX, region) <= SCAN_RANGE)
        .map((region) => region.group),
    );
    groups.forEach((group) => this.revealGroup(group));
    this.falseWalls
      .filter((wall) => groups.has(wall.region.group))
      .forEach((wall) => this.setFalseWallIntangible(wall, true));
  }

  update(player: Player, _deltaMs = 0): void {
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
      this.callbacks.onEndGate(this.clinicDestination, this.clinicImplant);
    }
  }

  destroy(): void {
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.checkpointMarkers.forEach((marker) => marker.destroy());
    this.hazardZones.forEach((zone) => zone.destroy());
    this.doors.forEach((door) => {
      door.zone.destroy();
      door.prompt.destroy();
    });
    this.revealRegions.forEach((region) => region.outline.destroy());
    this.falseWalls.forEach((wall) => wall.zone.destroy());
    this.tutorialLabels.forEach((label) => label.destroy());
    this.narrativeLabels.forEach((label) => label.destroy());
    this.narrativeVisuals.forEach((visual) => visual.destroy());
  }
}

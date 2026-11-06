import Phaser from "phaser";
import { BASE_RUN_SPEED, GAMEPLAY_TIMING } from "../config/GameConfig";
import { Player } from "../entities/Player";
import {
  TILED_FASE2_MAP_KEY,
  TILED_FASE2_OFFSET_Y,
  TILED_FASE2_TILESETS,
} from "../levels/TiledFase2";
import { AbilityState } from "../systems/AbilityState";
import { TEX } from "../utils/PlaceholderTextures";
import { CheckpointMarker } from "./CheckpointMarker";
import { HazardCycleState, HazardCycleTiming, hazardCycleState } from "./HazardMotion";

interface Phase2Credit {
  id: string;
  x: number;
  y: number;
  value: number;
  route: "normal" | "risk";
}

interface Phase2Checkpoint {
  id: string;
  x: number;
  y: number;
  width: number;
}

interface Conveyor {
  x: number;
  y: number;
  width: number;
  speed: number;
}

type IndustrialHazardKind = keyof typeof GAMEPLAY_TIMING.industrialHazards;

interface IndustrialHazard {
  kind: IndustrialHazardKind;
  zone: Phaser.GameObjects.Zone;
  indicator: Phaser.GameObjects.Rectangle;
  timing: HazardCycleTiming;
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  state?: HazardCycleState;
}

const INDUSTRIAL_HAZARD_KINDS = new Set<IndustrialHazardKind>(["press", "steam", "mech_arm", "crusher"]);

/**
 * Runtime do blockout Tiled da Fase 2.
 *
 * Os quatro hazards industriais compartilham um ciclo determinístico de
 * inativo → aviso → ativo. O mesmo estado controla tint, indicador e corpo
 * físico, evitando que a máquina pareça segura enquanto ainda é letal.
 */
export class TiledPhase2Runtime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly clinicDestination: string;
  readonly clinicImplant?: keyof AbilityState;
  readonly credits: Phase2Credit[] = [];

  private readonly fallDeathY: number;
  private readonly hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
  private readonly checkpointTriggered = new Set<string>();
  private readonly checkpointMarkers = new Map<string, CheckpointMarker>();
  private readonly checkpoints: Phase2Checkpoint[] = [];
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly industrialHazards: IndustrialHazard[] = [];
  private readonly lowCeilingZones: Phaser.GameObjects.Zone[] = [];
  private readonly conveyors: Conveyor[] = [];
  private readonly tutorialLabels: Phaser.GameObjects.Text[] = [];
  private endGateTriggered = false;
  private elapsedMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: (destination: string, implant?: keyof AbilityState) => void;
    },
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE2_MAP_KEY });

    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const definition of TILED_FASE2_TILESETS) {
      const tileset = this.map.addTilesetImage(definition.name, definition.key);
      if (!tileset) {
        throw new Error(`Tileset "${definition.name}" não encontrado no mapa da Fase 2`);
      }
      tilesets.push(tileset);
    }

    const offsetY = TILED_FASE2_OFFSET_Y;
    this.createVisualLayer("background", tilesets, -20, offsetY);
    this.createVisualLayer("deco-back", tilesets, -10, offsetY);

    const ground = this.map.createLayer("ground", tilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 2 (Tiled): camada "ground" ausente');
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.hazardsLayer = this.createVisualLayer("hazards", tilesets, 1, offsetY);
    this.createVisualLayer("deco-low-ceilings", tilesets, 1, offsetY);
    this.createVisualLayer("deco", tilesets, 2, offsetY);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = offsetY + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawnObject = byType("spawn")[0];
    this.spawn = spawnObject
      ? { x: spawnObject.x ?? 80, y: (spawnObject.y ?? 384) + offsetY }
      : { x: 80, y: 560 };

    const endObject = byType("phase_end")[0];
    this.endGateX = endObject?.x ?? this.lengthPx - 100;

    const clinicObject = byType("clinic")[0];
    this.clinicDestination = this.readString(clinicObject, "next") ?? "ClinicScene";
    const implant = this.readString(clinicObject, "implant");
    this.clinicImplant = implant && ["legs", "arms", "eyes", "thrusters"].includes(implant)
      ? implant as keyof AbilityState
      : undefined;

    this.readCredits(byType("credit"), offsetY);
    this.readCheckpoints(byType("checkpoint"), offsetY);
    this.buildHazards(byType("hazard"), offsetY);
    this.buildLowCeilings(byType("low_ceiling"), offsetY);
    this.readConveyors(byType("conveyor"), offsetY);
    this.buildTutorials(byType("tutorial"), offsetY);
    this.buildCredits();
    this.buildCheckpoints();
  }

  private createVisualLayer(
    name: string,
    tilesets: Phaser.Tilemaps.Tileset[],
    depth: number,
    worldOffsetY: number,
  ): Phaser.Tilemaps.TilemapLayer | undefined {
    // Sem x/y explícitos, o Phaser preserva offsetx/offsety autorados no
    // Tiled. Depois somamos somente o deslocamento global do mapa na tela.
    const layer = this.map.createLayer(name, tilesets) as Phaser.Tilemaps.TilemapLayer | null;
    if (!layer) return undefined;
    layer.setPosition(layer.x, layer.y + worldOffsetY);
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

  private readNumber(
    object: Phaser.Types.Tilemaps.TiledObject,
    name: string,
  ): number | undefined {
    const props = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = props.find((property) => property.name === name)?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private readCredits(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
      if (this.consolidatedThisPhase.has(id)) continue;
      this.credits.push({
        id,
        x: object.x ?? 0,
        y: (object.y ?? 0) + offsetY,
        value: 10,
        route: this.readString(object, "route") === "risk" ? "risk" : "normal",
      });
    }
  }

  private readCheckpoints(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `checkpoint-${object.id}`;
      const x = object.x ?? 0;
      this.checkpoints.push({
        id,
        x,
        y: this.groundSurfaceYAt(x, offsetY),
        width: object.width ?? 32,
      });
    }
  }

  private buildHazards(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    objects.forEach((object, index) => {
      const kind = this.readString(object, "kind");
      if (!kind || !INDUSTRIAL_HAZARD_KINDS.has(kind as IndustrialHazardKind)) {
        console.warn(`Fase 2: hazard "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}"; tratado como letal.`);
      }

      const resolvedKind = INDUSTRIAL_HAZARD_KINDS.has(kind as IndustrialHazardKind)
        ? kind as IndustrialHazardKind
        : "crusher";
      const defaults = GAMEPLAY_TIMING.industrialHazards[resolvedKind];

      const width = object.width ?? 32;
      const height = object.height ?? 32;
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const zone = this.scene.add.zone(
        x + width / 2,
        y + offsetY + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.enable = false;
      const indicator = this.scene.add
        .rectangle(zone.x, zone.y, width, height, 0x36e2ff, 0.05)
        .setStrokeStyle(2, 0x7cfcea, 0.42)
        .setDepth(4);
      this.industrialHazards.push({
        kind: resolvedKind,
        zone,
        indicator,
        timing: {
          cycleMs: Math.max(1, this.readNumber(object, "cycle_ms") ?? defaults.cycleMs),
          activeMs: Math.max(0, this.readNumber(object, "active_ms") ?? defaults.activeMs),
          warningMs: Math.max(0, this.readNumber(object, "warning_ms") ?? defaults.warningMs),
          phaseMs: this.readNumber(object, "phase_ms") ?? index * 317,
        },
        startCol: Math.floor(x / this.map.tileWidth),
        endCol: Math.ceil((x + width) / this.map.tileWidth),
        startRow: Math.floor(y / this.map.tileHeight),
        endRow: Math.ceil((y + height) / this.map.tileHeight),
      });
    });
    this.updateHazards(this.elapsedMs);
  }

  private updateHazards(now: number): void {
    for (const hazard of this.industrialHazards) {
      const state = hazardCycleState(now, hazard.timing);
      if (state === hazard.state) continue;
      hazard.state = state;
      const active = state === "active";
      const body = hazard.zone.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = active;

      const color = active ? 0xff506f : state === "warning" ? 0xffcf5a : 0x36e2ff;
      const alpha = active ? 0.28 : state === "warning" ? 0.16 : 0.04;
      hazard.indicator
        .setFillStyle(color, alpha)
        .setStrokeStyle(active ? 3 : 2, color, active ? 0.95 : 0.55);
      for (let row = hazard.startRow; row < hazard.endRow; row += 1) {
        for (let col = hazard.startCol; col < hazard.endCol; col += 1) {
          const tile = this.hazardsLayer?.getTileAt(col, row);
          if (!tile || tile.index === -1) continue;
          tile.tint = color;
          tile.alpha = active ? 1 : state === "warning" ? 0.72 : 0.35;
        }
      }
    }
  }

  /**
   * Volume lógico colocado logo abaixo dos canos baixos. O visual foi
   * elevado no mapa para caber a silhueta real do frame de slide, mas este
   * volume mantém a regra de gameplay: atravessar em pé é fatal e deslizar
   * permite a passagem.
   */
  private buildLowCeilings(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const object of objects) {
      const width = object.width ?? 32;
      const height = object.height ?? 24;
      const zone = this.scene.add.zone(
        (object.x ?? 0) + width / 2,
        (object.y ?? 0) + offsetY + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      this.lowCeilingZones.push(zone);
    }
  }

  private readConveyors(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const object of objects) {
      const direction = this.readString(object, "direction");
      const authoredSpeed = Math.abs(this.readNumber(object, "speed") ?? 0);
      const signedSpeed = direction === "left" ? -authoredSpeed : authoredSpeed;
      this.conveyors.push({
        x: object.x ?? 0,
        y: (object.y ?? 0) + offsetY,
        width: object.width ?? 32,
        speed: signedSpeed,
      });
    }
  }

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "double_jump") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) + offsetY - 20,
          "SALTO DUPLO\npressione PULO novamente no ar",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "15px",
            color: "#e8ecff",
            align: "center",
            backgroundColor: "#101522cc",
            padding: { x: 8, y: 5 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(5);
      this.tutorialLabels.push(label);
    }
  }

  private groundSurfaceYAt(worldX: number, offsetY: number): number {
    const col = Phaser.Math.Clamp(Math.floor(worldX / this.map.tileWidth), 0, this.map.width - 1);
    for (let row = 0; row < this.map.height; row++) {
      const tile = this.groundLayer.getTileAt(col, row);
      if (tile && tile.index !== -1) return offsetY + row * this.map.tileHeight;
    }
    return this.spawn?.y ?? 560;
  }

  private buildCredits(): void {
    for (const credit of this.credits) {
      const sprite = this.scene.physics.add.sprite(credit.x, credit.y, TEX.credit);
      sprite.body!.setAllowGravity(false);
      sprite.setData("creditId", credit.id);
      sprite.setData("creditValue", credit.value);
      sprite.setDepth(4);
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
        new CheckpointMarker(this.scene, checkpoint.x + checkpoint.width / 2, checkpoint.y, 3),
      );
    }
  }

  registerPhysics(player: Player): void {
    // `ground` é somente geometria sólida. Não mata no contato lateral:
    // ao errar um salto e raspar na borda de uma plataforma, Alex deve
    // perder apoio, cair pelo vão e morrer apenas ao ultrapassar
    // `fallDeathY`. A versão inicial copiava a regra antiga da Fase 1 e
    // chamava `kill()` em `blocked.left/right/up`, causando a morte
    // instantânea mostrada no primeiro gap da Fase 2.
    this.scene.physics.add.collider(player.sprite, this.groundLayer);

    for (const hazard of this.industrialHazards) {
      this.scene.physics.add.overlap(player.sprite, hazard.zone, () => player.kill());
    }
    for (const ceiling of this.lowCeilingZones) {
      this.scene.physics.add.overlap(player.sprite, ceiling, () => {
        if (player.getState() !== "sliding") player.kill();
      });
    }
  }

  private conveyorSpeedFor(player: Player): number {
    const body = player.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !player.isGrounded() || body.velocity.y < 0) return 0;

    for (const conveyor of this.conveyors) {
      const overlapsX = body.right > conveyor.x && body.left < conveyor.x + conveyor.width;
      const isOnSurface = Math.abs(body.bottom - conveyor.y) <= 4;
      if (overlapsX && isOnSurface) return conveyor.speed;
    }
    return 0;
  }

  update(player: Player, deltaMs = 0): void {
    this.elapsedMs += Math.max(0, deltaMs);
    this.updateHazards(this.elapsedMs);
    const state = player.getState();
    if (state !== "dead" && state !== "dashing" && state !== "pressed" && state !== "checkpoint") {
      player.sprite.setVelocityX(BASE_RUN_SPEED + this.conveyorSpeedFor(player));
    }

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
        this.checkpointMarkers.get(checkpoint.id)?.activate();
        this.callbacks.onCheckpoint(checkpoint.id, checkpoint.x, checkpoint.y);
      }
    }

    if (player.sprite.y > this.fallDeathY && state !== "dead") {
      player.kill();
      return;
    }

    if (!this.endGateTriggered && player.sprite.x >= this.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate(this.clinicDestination, this.clinicImplant);
    }
  }

  setScanActive(_active: boolean): void {
    // A Fase 2 ainda não possui objetos reveláveis por scan.
  }

  destroy(): void {
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.checkpointMarkers.forEach((marker) => marker.destroy());
    this.industrialHazards.forEach((hazard) => {
      hazard.zone.destroy();
      hazard.indicator.destroy();
    });
    this.lowCeilingZones.forEach((zone) => zone.destroy());
    this.tutorialLabels.forEach((label) => label.destroy());
  }
}

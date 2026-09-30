import Phaser from "phaser";
import { Player } from "../entities/Player";
import { EnemyRuntime } from "./EnemyRuntime";
import {
  TILED_FASE3_MAP_KEY,
  TILED_FASE3_TILESET_KEY,
  TILED_FASE3_TILESET_NAME,
} from "../levels/TiledFase3";

interface CreditObj { id: string; x: number; y: number; value: number; }
interface CheckpointObj { id: string; x: number; y: number; }

/** Runtime da Fase 3: ataque, quebráveis, bandidos e drones. */
export class TiledPhase3Runtime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly credits: CreditObj[] = [];
  readonly checkpointTriggered = new Set<string>();
  readonly creditSprites = new Map<string, Phaser.GameObjects.Rectangle>();

  private readonly breakables: Phaser.GameObjects.Rectangle[] = [];
  private readonly hazards: Phaser.GameObjects.Zone[] = [];
  private endGateTriggered = false;
  private pressedAttackListener: (breakable: Phaser.GameObjects.GameObject | null) => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: () => void;
      onFatalCollision: () => void;
    },
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE3_MAP_KEY });
    const tileset = this.map.addTilesetImage(TILED_FASE3_TILESET_NAME, TILED_FASE3_TILESET_KEY);
    if (!tileset) throw new Error(`Tileset "${TILED_FASE3_TILESET_NAME}" não encontrado na Fase 3`);

    const ground = this.map.createLayer("ground", tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 3: camada "ground" ausente');
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    const deco = this.map.createLayer("deco", tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null;
    deco?.setDepth(-5);
    const hazardsLayer = this.map.createLayer("hazards", tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer | null;
    hazardsLayer?.setDepth(1);

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawn = byType("spawn")[0];
    this.spawn = spawn
      ? { x: (spawn.x ?? 64) + (spawn.width ?? 0) / 2, y: (spawn.y ?? 320) + (spawn.height ?? 0) }
      : { x: 64, y: 352 };

    const phaseEnd = byType("phase_end")[0];
    this.endGateX = phaseEnd?.x ?? this.map.widthInPixels - 96;
    this.lengthPx = this.map.widthInPixels;

    for (const object of byType("credit")) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
      if (this.consolidatedThisPhase.has(id)) continue;
      this.credits.push({ id, x: object.x ?? 0, y: object.y ?? 0, value: 10 });
    }
    this.buildCredits();

    for (const object of byType("checkpoint")) {
      const id = this.readString(object, "id") ?? object.name ?? `checkpoint-${object.id}`;
      const x = object.x ?? 0;
      const y = this.findGroundSurfaceY(x);
      this.scene.add.rectangle(x + 16, y - 40, 30, 80, 0x36e2ff, 0.22).setStrokeStyle(2, 0x36e2ff).setDepth(3);
      this.checkpoints.push({ id, x, y });
    }

    this.buildHazards(byType("hazard"));
    this.buildBreakables(byType("breakable"));

  }

  private checkpoints: CheckpointObj[] = [];
  private playerRef?: Player;
  private runtimeEnemy?: EnemyRuntime;

  private readString(object: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
    const props = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const value = props.find((prop) => prop.name === name)?.value;
    return typeof value === "string" ? value : undefined;
  }

  private findGroundSurfaceY(worldX: number): number {
    const col = Phaser.Math.Clamp(Math.floor(worldX / this.map.tileWidth), 0, this.map.width - 1);
    for (let row = 0; row < this.map.height; row++) {
      const tile = this.groundLayer.getTileAt(col, row);
      if (tile && tile.index !== -1) return row * this.map.tileHeight;
    }
    return this.spawn.y;
  }

  private buildCredits(): void {
    for (const credit of this.credits) {
      const sprite = this.scene.add.rectangle(credit.x, credit.y, 20, 20, 0xffd37c).setDepth(4);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      this.creditSprites.set(credit.id, sprite);
      this.scene.tweens.add({ targets: sprite, y: credit.y - 8, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private buildHazards(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const zone = this.scene.add.zone(
        (object.x ?? 0) + (object.width ?? 16) / 2,
        (object.y ?? 0) + (object.height ?? 16) / 2,
        object.width ?? 16,
        object.height ?? 16,
      );
      this.scene.physics.add.existing(zone, true);
      this.hazards.push(zone);
    }
  }

  private buildBreakables(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const width = object.width ?? 64;
      const height = object.height ?? 32;
      const rect = this.scene.add.rectangle(
        (object.x ?? 0) + width / 2,
        (object.y ?? 0) + height / 2,
        width,
        height,
        0xb64cff,
        0.75,
      ).setStrokeStyle(2, 0xe0a8ff).setDepth(3);
      this.scene.physics.add.existing(rect, true);
      rect.setData("breakableId", this.readString(object, "id") ?? object.name ?? String(object.id));
      this.breakables.push(rect);
    }
  }

  registerPhysics(player: Player): void {
    this.playerRef = player;

    this.scene.physics.add.collider(player.sprite, this.groundLayer, () => {
      this.killOnSolidSideCollision(player);
    });

    for (const hazard of this.hazards) {
      this.scene.physics.add.overlap(player.sprite, hazard, () => this.callbacks.onFatalCollision());
    }

    for (const breakable of this.breakables) {
      this.scene.physics.add.collider(player.sprite, breakable, () => {
        player.enterPressedState(breakable);
      });
    }

    this.runtimeEnemy = new EnemyRuntime(this.scene, player, this.getEnemyObjects());
    this.runtimeEnemy.registerPlayerCollision(() => this.callbacks.onFatalCollision());

    this.pressedAttackListener = (breakable) => {
      if (!breakable) return;
      const object = breakable as Phaser.GameObjects.Rectangle;
      if (!this.breakables.includes(object)) return;
      this.destroyBreakable(object);
    };
    this.scene.events.on("player-attack-attempt", this.pressedAttackListener);
  }

  private getEnemyObjects(): Phaser.Types.Tilemaps.TiledObject[] {
    return this.map.getObjectLayer("objects")?.objects.filter((object) => object.type === "enemy") ?? [];
  }

  private killOnSolidSideCollision(player: Player): void {
    const body = player.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (!body) return;
    // O topo do tile é a plataforma normal. Colisão lateral ou contra teto
    // representa uma parede/elemento sólido e é fatal, conforme o GDD.
    if (body.blocked.left || body.blocked.right || body.blocked.up) {
      this.callbacks.onFatalCollision();
    }
  }

  private destroyBreakable(breakable: Phaser.GameObjects.Rectangle): void {
    const index = this.breakables.indexOf(breakable);
    if (index === -1) return;
    this.breakables.splice(index, 1);
    (breakable.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.scene.tweens.add({
      targets: breakable,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 0.85,
      duration: 120,
      onComplete: () => breakable.destroy(),
    });
    this.playerRef?.resolvePressedSuccess();
  }

  update(player: Player): void {
    if (this.runtimeEnemy) this.runtimeEnemy.update();

    this.creditSprites.forEach((sprite, id) => {
      if (!sprite.active) return;
      if (Math.abs(sprite.x - player.sprite.x) < 28 && Math.abs(sprite.y - player.sprite.y) < 40) {
        sprite.setActive(false).setVisible(false);
        const body = sprite.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody;
        body.enable = false;
        this.callbacks.onCreditCollected(id, 10);
      }
    });

    for (const checkpoint of this.checkpoints) {
      if (this.checkpointTriggered.has(checkpoint.id)) continue;
      if (Math.abs(player.sprite.x - checkpoint.x) < 28) {
        this.checkpointTriggered.add(checkpoint.id);
        this.callbacks.onCheckpoint(checkpoint.id, checkpoint.x, checkpoint.y);
      }
    }

    if (player.sprite.y > this.map.heightInPixels + 180 && player.getState() !== "dead") {
      this.callbacks.onFatalCollision();
      return;
    }

    if (!this.endGateTriggered && player.sprite.x >= this.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate();
    }
  }

  setScanActive(active: boolean): void {
    if (active) this.runtimeEnemy?.scan(this.playerRef?.sprite.x ?? 0);
    else this.runtimeEnemy?.stopScan();
  }

  destroy(): void {
    this.scene.events.off("player-attack-attempt", this.pressedAttackListener);
    this.runtimeEnemy?.destroy();
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.breakables.forEach((breakable) => breakable.destroy());
    this.hazards.forEach((hazard) => hazard.destroy());
  }
}

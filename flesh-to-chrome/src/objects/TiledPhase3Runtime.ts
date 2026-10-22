import Phaser from "phaser";
import { Player } from "../entities/Player";
import {
  TILED_FASE3_MAP_KEY,
  TILED_FASE3_TILESET_KEY,
  TILED_FASE3_TILESET_NAME,
} from "../levels/TiledFase3";
import { AbilityState } from "../systems/AbilityState";
import { TEX } from "../utils/PlaceholderTextures";
import { EnemyRuntime } from "./EnemyRuntime";
import { TILED_CHECKPOINT_TEXTURE_KEY } from "./TiledLevelRuntime";

interface Phase3Credit {
  id: string;
  x: number;
  y: number;
  value: number;
  route: "normal" | "risk";
}

interface Phase3Checkpoint {
  id: string;
  x: number;
  y: number;
  width: number;
}

const URBAN_HAZARD_KINDS = new Set(["electric_gate"]);
const URBAN_BREAKABLE_KINDS = new Set(["barricade"]);

/** Runtime do blockout da Fase 3: ataque, quebráveis, bandidos e drones. */
export class TiledPhase3Runtime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly clinicDestination: string;
  readonly clinicImplant?: keyof AbilityState;
  readonly credits: Phase3Credit[] = [];

  private readonly fallDeathY: number;
  private readonly checkpoints: Phase3Checkpoint[] = [];
  private readonly checkpointTriggered = new Set<string>();
  private readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  private readonly breakables: Phaser.GameObjects.Rectangle[] = [];
  private readonly hazardZones: Phaser.GameObjects.Zone[] = [];
  private readonly tutorialLabels: Phaser.GameObjects.Text[] = [];
  private endGateTriggered = false;
  private playerRef?: Player;
  private runtimeEnemy?: EnemyRuntime;
  private pressedAttackListener: (breakable: Phaser.GameObjects.GameObject | null) => void = () => undefined;
  private normalAttackListener: (x: number, y: number) => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly consolidatedThisPhase: Set<string>,
    private readonly callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: (destination: string, implant?: keyof AbilityState) => void;
    },
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE3_MAP_KEY });
    const tileset = this.map.addTilesetImage(TILED_FASE3_TILESET_NAME, TILED_FASE3_TILESET_KEY);
    if (!tileset) throw new Error(`Tileset "${TILED_FASE3_TILESET_NAME}" não encontrado na Fase 3`);

    this.createVisualLayer("background", tileset, -20);
    this.createVisualLayer("deco-back", tileset, -10);

    const ground = this.map.createLayer("ground", tileset) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 3 (Tiled): camada "ground" ausente');
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    this.createVisualLayer("hazards", tileset, 1);
    this.createVisualLayer("deco", tileset, 2);

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (type: string) => objects.filter((object) => object.type === type);

    const spawnObject = byType("spawn")[0];
    this.spawn = spawnObject
      ? { x: spawnObject.x ?? 80, y: spawnObject.y ?? 560 }
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
    this.buildHazards(byType("hazard"));
    this.buildBreakables(byType("breakable"));
    this.buildTutorials(byType("tutorial"));
    this.buildCredits();
    this.buildCheckpoints();
  }

  private createVisualLayer(name: string, tileset: Phaser.Tilemaps.Tileset, depth: number): void {
    const layer = this.map.createLayer(name, tileset) as Phaser.Tilemaps.TilemapLayer | null;
    layer?.setDepth(depth);
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

  private readCredits(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `credit-${object.id}`;
      if (this.consolidatedThisPhase.has(id)) continue;
      this.credits.push({
        id,
        x: object.x ?? 0,
        y: object.y ?? 0,
        value: 10,
        route: this.readString(object, "route") === "risk" ? "risk" : "normal",
      });
    }
  }

  private readCheckpoints(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const id = this.readString(object, "id") ?? object.name ?? `checkpoint-${object.id}`;
      const x = object.x ?? 0;
      this.checkpoints.push({
        id,
        x,
        y: this.groundSurfaceYAt(x),
        width: object.width ?? 32,
      });
    }
  }

  private groundSurfaceYAt(worldX: number): number {
    const col = Phaser.Math.Clamp(Math.floor(worldX / this.map.tileWidth), 0, this.map.width - 1);
    for (let row = 0; row < this.map.height; row++) {
      const tile = this.groundLayer.getTileAt(col, row);
      if (tile && tile.index !== -1) return row * this.map.tileHeight;
    }
    return this.spawn?.y ?? 560;
  }

  private buildCredits(): void {
    for (const credit of this.credits) {
      const sprite = this.scene.physics.add.sprite(credit.x, credit.y, TEX.credit);
      sprite.body!.setAllowGravity(false);
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
      this.scene.add
        .image(checkpoint.x + checkpoint.width / 2, checkpoint.y, TILED_CHECKPOINT_TEXTURE_KEY)
        .setOrigin(0.5, 1)
        .setDisplaySize(72, 61)
        .setDepth(3);
    }
  }

  private buildHazards(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      if (!kind || !URBAN_HAZARD_KINDS.has(kind)) {
        console.warn(`Fase 3: hazard "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}"; tratado como letal.`);
      }
      const width = object.width ?? 16;
      const height = object.height ?? 16;
      const zone = this.scene.add.zone(
        (object.x ?? 0) + width / 2,
        (object.y ?? 0) + height / 2,
        width,
        height,
      );
      this.scene.physics.add.existing(zone, true);
      this.hazardZones.push(zone);
    }
  }

  private buildBreakables(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      const kind = this.readString(object, "kind");
      if (!kind || !URBAN_BREAKABLE_KINDS.has(kind)) {
        console.warn(`Fase 3: quebrável "${object.name ?? object.id}" usa kind desconhecido "${kind ?? "ausente"}".`);
      }
      const width = object.width ?? 64;
      const height = object.height ?? 64;
      // Placeholder visual até existir arte dedicada de barricada.
      const rectangle = this.scene.add.rectangle(
        (object.x ?? 0) + width / 2,
        (object.y ?? 0) + height / 2,
        width,
        height,
        0xb64cff,
        0.75,
      ).setStrokeStyle(2, 0xe0a8ff).setDepth(3);
      this.scene.physics.add.existing(rectangle, true);
      rectangle.setData("breakableId", this.readString(object, "id") ?? object.name ?? String(object.id));
      this.breakables.push(rectangle);
    }
  }

  private buildTutorials(objects: Phaser.Types.Tilemaps.TiledObject[]): void {
    for (const object of objects) {
      if (this.readString(object, "skill") !== "attack") continue;
      const label = this.scene.add
        .text(
          (object.x ?? 0) + (object.width ?? 0) / 2,
          (object.y ?? 0) - 20,
          "ATAQUE: J / CLIQUE ESQUERDO / X (CONTROLE)\ndestrói barricadas e bandidos",
          {
            fontFamily: "Courier New, monospace",
            fontSize: "15px",
            color: "#f0d8ff",
            align: "center",
            backgroundColor: "#1d1025cc",
            padding: { x: 8, y: 5 },
          },
        )
        .setOrigin(0.5, 1)
        .setDepth(5);
      this.tutorialLabels.push(label);
    }
  }

  registerPhysics(player: Player): void {
    this.playerRef = player;
    // O terreno só bloqueia. Errar um salto mata ao cair no vazio, não ao
    // raspar na lateral de uma plataforma.
    this.scene.physics.add.collider(player.sprite, this.groundLayer);
    for (const hazard of this.hazardZones) {
      this.scene.physics.add.overlap(player.sprite, hazard, () => player.kill());
    }
    for (const breakable of this.breakables) {
      this.scene.physics.add.collider(player.sprite, breakable, () => {
        // O golpe pode ter começado poucos frames antes do contato. Nesse
        // caso Alex ainda está em `attacking` e a barricada deve quebrar,
        // em vez de trocar imediatamente para o estado `pressed`.
        if (player.getState() === "attacking") {
          this.destroyBreakable(breakable);
        } else {
          player.enterPressedState(breakable);
        }
      });
    }

    this.runtimeEnemy = new EnemyRuntime(this.scene, player, this.getEnemyObjects());
    this.runtimeEnemy.registerPlayerCollision(() => player.kill());

    this.pressedAttackListener = (breakable) => {
      if (!breakable) return;
      const rectangle = breakable as Phaser.GameObjects.Rectangle;
      if (!this.breakables.includes(rectangle)) return;
      this.destroyBreakable(rectangle);
    };
    this.scene.events.on("player-attack-attempt", this.pressedAttackListener);

    // Ataques normais também atingem barricadas à frente. Antes desta
    // correção, somente `player-attack-attempt` (emitido depois de Alex já
    // estar prensado) era aceito; portanto um golpe antecipado, como o da
    // gravação de playtest, era consumido sem destruir o obstáculo.
    this.normalAttackListener = (x, y) => this.destroyBreakableInAttackRange(x, y);
    this.scene.events.on("player-attack", this.normalAttackListener);
  }

  private getEnemyObjects(): Phaser.Types.Tilemaps.TiledObject[] {
    return this.map.getObjectLayer("objects")?.objects.filter((object) => object.type === "enemy") ?? [];
  }

  private destroyBreakable(breakable: Phaser.GameObjects.Rectangle): void {
    const index = this.breakables.indexOf(breakable);
    if (index === -1) return;
    this.breakables.splice(index, 1);
    const body = breakable.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
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

  private destroyBreakableInAttackRange(attackX: number, attackY: number): void {
    const attackRange = 62;
    const verticalRange = 58;
    const target = this.breakables.find((breakable) => {
      if (!breakable.active) return false;
      const leftEdge = breakable.x - breakable.displayWidth / 2;
      return leftEdge >= attackX - 8
        && leftEdge <= attackX + attackRange
        && Math.abs(breakable.y - attackY) <= verticalRange;
    });
    if (target) this.destroyBreakable(target);
  }

  update(player: Player): void {
    this.runtimeEnemy?.update();

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
      this.callbacks.onEndGate(this.clinicDestination, this.clinicImplant);
    }
  }

  setScanActive(active: boolean): void {
    if (active) this.runtimeEnemy?.scan(this.playerRef?.sprite.x ?? 0);
    else this.runtimeEnemy?.stopScan();
  }

  destroy(): void {
    this.scene.events.off("player-attack-attempt", this.pressedAttackListener);
    this.scene.events.off("player-attack", this.normalAttackListener);
    this.runtimeEnemy?.destroy();
    this.creditSprites.forEach((sprite) => sprite.destroy());
    this.breakables.forEach((breakable) => breakable.destroy());
    this.hazardZones.forEach((hazard) => hazard.destroy());
    this.tutorialLabels.forEach((label) => label.destroy());
  }
}

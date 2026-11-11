import Phaser from "phaser";
import { PHYSICS } from "../config/GameConfig";
import { Player } from "../entities/Player";
import { AudioManager, SFX } from "../systems/AudioManager";

export type EnemyKind = "bandido" | "drone";

interface EnemyEntry {
  id: string;
  kind: EnemyKind;
  sprite: Phaser.Physics.Arcade.Sprite;
  revealed: boolean;
  homeX: number;
  patrolDistance: number;
  patrolSpeed: number;
  patrolDirection: 1 | -1;
}

const ENEMY_KEYS = {
  bandido: "enemy-bandido",
  drone: "enemy-drone",
} as const;

const ENEMY_SCALE: Record<EnemyKind, number> = {
  bandido: 1.45,
  drone: 1.8,
};

/**
 * Runtime dos inimigos definidos no Tiled como objetos `enemy`.
 *
 * Regras do GDD:
 * - bandido: 1 HP, morre com um golpe;
 * - drone: blindado, não pode ser destruído;
 * - contato com qualquer um mata Alex;
 * - o ataque funciona também no ar;
 * - o scan revela inimigos próximos e a revelação persiste até Alex sair
 *   daquele trecho.
 */
export class EnemyRuntime {
  private readonly enemies: EnemyEntry[] = [];
  private readonly group: Phaser.Physics.Arcade.Group;
  private attackListener: (x: number, y: number) => void;
  private scanActive = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    objects: Phaser.Types.Tilemaps.TiledObject[],
    offsetY = 0,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.ensureAnimations();

    for (const object of objects) {
      const kind = this.readString(object, "kind");
      if (kind !== "bandido" && kind !== "drone") continue;

      const x = (object.x ?? 0) + (object.width ?? 0) / 2;
      const y = (object.y ?? 0) + offsetY + (object.height ?? 0);
      const sprite = scene.physics.add.sprite(x, y, ENEMY_KEYS[kind]);
      sprite.setOrigin(0.5, 1);
      sprite.setScale(ENEMY_SCALE[kind]);
      sprite.setImmovable(true);
      sprite.body!.setAllowGravity(false);
      sprite.body!.setSize(kind === "bandido" ? 28 : 22, kind === "bandido" ? 38 : 22);
      sprite.body!.setOffset(kind === "bandido" ? 10 : 5, kind === "bandido" ? 6 : 5);
      sprite.setDepth(4);
      // A silhueta precisa permanecer totalmente legível no runner. O scan
      // ainda aplica o destaque ciano, mas não controla mais a opacidade.
      sprite.setAlpha(1);
      sprite.setData("enemyId", object.name || `enemy-${object.id}`);
      sprite.setData("enemyKind", kind);

      sprite.anims.play(kind === "bandido" ? "enemy-bandido-idle" : "enemy-drone-idle", true);
      this.group.add(sprite);

      this.enemies.push({
        id: String(object.name || object.id),
        kind,
        sprite,
        revealed: false,
        homeX: x,
        patrolDistance: kind === "drone" ? 96 : 0,
        patrolSpeed: kind === "drone" ? 70 : 0,
        patrolDirection: 1,
      });
    }

    this.attackListener = (x: number, y: number) => this.handleAttack(x, y);
    scene.events.on("player-attack", this.attackListener);
  }

  private ensureAnimations(): void {
    if (!this.scene.anims.exists("enemy-bandido-idle")) {
      this.scene.anims.create({
        key: "enemy-bandido-idle",
        frames: this.scene.anims.generateFrameNumbers(ENEMY_KEYS.bandido, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.scene.anims.exists("enemy-drone-idle")) {
      this.scene.anims.create({
        key: "enemy-drone-idle",
        frames: this.scene.anims.generateFrameNumbers(ENEMY_KEYS.drone, { start: 0, end: 1 }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  private readString(object: Phaser.Types.Tilemaps.TiledObject, name: string): string | undefined {
    const properties = (object.properties ?? []) as Array<{ name: string; value: unknown }>;
    const property = properties.find((item) => item.name === name);
    return typeof property?.value === "string" ? property.value : undefined;
  }

  private handleAttack(x: number, y: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.kind !== "bandido" || enemy.sprite.getData("hp") === 0) continue;

      const closeEnough = enemy.sprite.x >= x - 8
        && enemy.sprite.x <= x + PHYSICS.attack.range
        && Math.abs(enemy.sprite.y - y) <= PHYSICS.attack.verticalRange;
      if (!closeEnough) continue;

      enemy.sprite.setData("hp", 0);
      enemy.sprite.body!.enable = false;
      enemy.sprite.setTint(0xffffff);
      AudioManager.playSfx(this.scene, SFX.enemyHit, { volume: 0.62 });
      this.spawnDefeatFx(enemy.sprite.x, enemy.sprite.y - enemy.sprite.displayHeight / 2);
      this.scene.tweens.add({
        targets: enemy.sprite,
        alpha: 0,
        scaleX: enemy.sprite.scaleX * 1.18,
        scaleY: enemy.sprite.scaleY * 0.72,
        angle: 18,
        duration: 220,
        onComplete: () => enemy.sprite.setActive(false).setVisible(false),
      });
      this.scene.events.emit("enemy-defeated", enemy.id);
    }
  }

  private spawnDefeatFx(x: number, y: number): void {
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7;
      const fragment = this.scene.add.rectangle(x, y, 5, 3, index % 2 ? 0xff71ce : 0x7cfcea, 0.95)
        .setDepth(8)
        .setRotation(angle);
      this.scene.tweens.add({
        targets: fragment,
        x: x + Math.cos(angle) * 46,
        y: y + Math.sin(angle) * 34 + 18,
        rotation: angle + 2.2,
        alpha: 0,
        duration: 360,
        ease: "Cubic.easeOut",
        onComplete: () => fragment.destroy(),
      });
    }
    this.scene.cameras.main.flash(80, 124, 252, 234, false);
  }

  /** Ativa o pulso do visor e revela inimigos próximos. */
  scan(playerX: number): void {
    this.scanActive = true;
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      if (Math.abs(enemy.sprite.x - playerX) <= 800) {
        enemy.revealed = true;
        enemy.sprite.setTint(0x36e2ff);
        enemy.sprite.setAlpha(1);
      }
    }
  }

  /** Desliga o pulso; inimigos já descobertos continuam marcados no trecho. */
  stopScan(): void {
    this.scanActive = false;
  }

  update(): void {
    const playerX = this.player.sprite.x;

    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;

      if (enemy.kind === "drone") {
        const distance = enemy.sprite.x - enemy.homeX;
        if (Math.abs(distance) >= enemy.patrolDistance) {
          enemy.patrolDirection = distance >= 0 ? -1 : 1;
        }
        enemy.sprite.setVelocityX(enemy.patrolSpeed * enemy.patrolDirection);
      } else {
        enemy.sprite.setVelocityX(0);
      }

      // A revelação dura até Alex sair do trecho; 960px é uma janela de
      // segurança maior que o pulso do scan e evita esconder o mesmo inimigo
      // imediatamente depois de ele ter sido revelado.
      if (enemy.revealed && Math.abs(enemy.sprite.x - playerX) > 960) {
        enemy.revealed = false;
        enemy.sprite.clearTint();
        enemy.sprite.setAlpha(1);
      }

      if (!enemy.revealed && this.scanActive && Math.abs(enemy.sprite.x - playerX) <= 800) {
        enemy.revealed = true;
        enemy.sprite.setTint(0x36e2ff);
        enemy.sprite.setAlpha(1);
      }
    }
  }

  registerPlayerCollision(onFatalCollision: () => void): void {
    this.scene.physics.add.overlap(this.player.sprite, this.group, () => {
      if (this.player.getState() !== "dead") onFatalCollision();
    });
  }

  destroy(): void {
    this.scene.events.off("player-attack", this.attackListener);
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies.length = 0;
    this.group.destroy(true);
  }
}

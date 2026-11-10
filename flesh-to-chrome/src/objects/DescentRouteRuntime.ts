import Phaser from "phaser";
import { PHYSICS } from "../config/GameConfig";
import type { Player } from "../entities/Player";
import type { DescentRoute } from "../systems/DescentProgression";

/** Obstáculos e saída exclusivos do recorte de descida, sem duplicar mapas. */
export class DescentRouteRuntime {
  private readonly gameObjects: Phaser.GameObjects.GameObject[] = [];
  private player?: Player;
  private barrier?: Phaser.GameObjects.Rectangle;
  private readonly barrierDecorations: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = [];
  private finished = false;
  private pressedAttackListener?: (target?: Phaser.GameObjects.GameObject) => void;
  private normalAttackListener?: (x: number, y: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly route: DescentRoute,
    private readonly onComplete: () => void,
  ) {
    if (route.doubleJumpHazard) this.createDoubleJumpHazard();
    if (route.attackBarrierX !== undefined) this.createAttackBarrier();
    this.createExitMarker();
  }

  registerPlayer(player: Player): void {
    this.player = player;
    if (this.barrier) {
      this.scene.physics.add.collider(player.sprite, this.barrier, () => {
        if (!this.barrier?.active) return;
        if (player.getState() === "attacking") this.destroyBarrier();
        else player.enterPressedState(this.barrier);
      });
      this.pressedAttackListener = (target) => {
        if (target === this.barrier) this.destroyBarrier();
      };
      this.normalAttackListener = (x, y) => {
        if (!this.barrier?.active) return;
        const leftEdge = this.barrier.x - this.barrier.displayWidth / 2;
        if (
          leftEdge >= x - 8
          && leftEdge <= x + PHYSICS.attack.range
          && Math.abs(this.barrier.y - y) <= PHYSICS.attack.verticalRange
        ) this.destroyBarrier();
      };
      this.scene.events.on("player-attack-attempt", this.pressedAttackListener);
      this.scene.events.on("player-attack", this.normalAttackListener);
    }

    const hazard = this.route.doubleJumpHazard;
    if (hazard) {
      const zone = this.scene.add.zone(
        hazard.x + hazard.width / 2,
        this.route.startY - 8,
        hazard.width,
        18,
      );
      this.scene.physics.add.existing(zone, true);
      this.scene.physics.add.overlap(player.sprite, zone, () => player.kill());
      this.gameObjects.push(zone);
    }
  }

  update(player: Player): void {
    if (this.finished || player.getState() === "dead" || player.sprite.x < this.route.endX) return;
    this.finished = true;
    this.onComplete();
  }

  destroy(): void {
    if (this.pressedAttackListener) {
      this.scene.events.off("player-attack-attempt", this.pressedAttackListener);
    }
    if (this.normalAttackListener) {
      this.scene.events.off("player-attack", this.normalAttackListener);
    }
    this.gameObjects.forEach((object) => object.destroy());
    this.gameObjects.length = 0;
  }

  private createAttackBarrier(): void {
    const x = this.route.attackBarrierX!;
    const barrier = this.scene.add.rectangle(x, this.route.startY, 64, 112, 0x35182e, 1)
      .setOrigin(0.5, 1)
      .setStrokeStyle(4, 0xff718f, 1)
      .setDepth(5);
    this.scene.physics.add.existing(barrier, true);
    const body = barrier.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
    this.barrier = barrier;
    this.gameObjects.push(barrier);

    const core = this.scene.add.rectangle(x, this.route.startY - 56, 18, 78, 0x7cfcea, 0.8)
      .setDepth(6);
    const label = this.scene.add.text(x, this.route.startY - 126, "LACRE REFORGE", {
      fontFamily: "Courier New, monospace",
      fontSize: "12px",
      color: "#ff718f",
      backgroundColor: "#08050ccc",
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(6);
    this.barrierDecorations.push(core, label);
    this.gameObjects.push(core, label);
  }

  private destroyBarrier(): void {
    if (!this.barrier?.active) return;
    const x = this.barrier.x;
    const y = this.barrier.y - this.barrier.displayHeight / 2;
    const body = this.barrier.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    this.barrier.setActive(false).setVisible(false);
    this.barrierDecorations.forEach((object) => object.setVisible(false));
    this.player?.resolvePressedSuccess();
    const flash = this.scene.add.circle(x, y, 20, 0x7cfcea, 0.9).setDepth(8);
    this.scene.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 260,
      onComplete: () => flash.destroy(),
    });
  }

  private createDoubleJumpHazard(): void {
    const hazard = this.route.doubleJumpHazard!;
    const visual = this.scene.add.rectangle(
      hazard.x + hazard.width / 2,
      this.route.startY - 5,
      hazard.width,
      10,
      0xff315f,
      0.8,
    ).setDepth(4);
    const glow = this.scene.add.rectangle(
      hazard.x + hazard.width / 2,
      this.route.startY - 5,
      hazard.width,
      30,
      0xff315f,
      0.16,
    ).setDepth(3);
    this.scene.tweens.add({ targets: glow, alpha: 0.04, yoyo: true, repeat: -1, duration: 360 });
    this.gameObjects.push(visual, glow);
  }

  private createExitMarker(): void {
    const x = this.route.endX;
    const beam = this.scene.add.rectangle(x, this.route.startY - 80, 8, 160, 0x7cfcea, 0.42)
      .setDepth(4);
    const label = this.scene.add.text(
      x - 18,
      this.route.startY - 168,
      this.route.epilogue ? "CASA" : "REFORGE",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#7CFCEA",
        backgroundColor: "#08050ccc",
        padding: { x: 6, y: 4 },
      },
    ).setOrigin(1, 0.5).setDepth(5);
    this.scene.tweens.add({ targets: beam, alpha: 0.12, yoyo: true, repeat: -1, duration: 600 });
    this.gameObjects.push(beam, label);
  }
}

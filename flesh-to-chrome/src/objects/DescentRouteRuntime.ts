import Phaser from "phaser";
import { PHYSICS } from "../config/GameConfig";
import type { Player } from "../entities/Player";
import { AudioManager, SFX } from "../systems/AudioManager";
import type { DescentRoute } from "../systems/DescentProgression";

export const DESCENT_REFORGE_DOOR_CLOSED_KEY = "descent-reforge-door-closed";
export const DESCENT_REFORGE_DOOR_OPEN_KEY = "descent-reforge-door-open";
export const DESCENT_ATTACK_BARRIER_TEXTURE_KEY = "descent-reforge-security-seal";
export const DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY = "descent-urban-electric-floor";

/** Obstáculos e saída exclusivos do recorte de descida, sem duplicar mapas. */
export class DescentRouteRuntime {
  private readonly gameObjects: Phaser.GameObjects.GameObject[] = [];
  private player?: Player;
  private barrier?: Phaser.GameObjects.Image;
  private readonly barrierDecorations: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = [];
  private doorClosed?: Phaser.GameObjects.Image;
  private doorOpen?: Phaser.GameObjects.Image;
  private doorStatus?: Phaser.GameObjects.Text;
  private memoryRecovered: boolean;
  private finished = false;
  private pressedAttackListener?: (target?: Phaser.GameObjects.GameObject) => void;
  private normalAttackListener?: (x: number, y: number) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly route: DescentRoute,
    private readonly onComplete: () => void,
    memoryRecovered = false,
  ) {
    this.memoryRecovered = memoryRecovered;
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

  setMemoryRecovered(recovered: boolean): void {
    if (this.route.epilogue || this.memoryRecovered === recovered) return;
    this.memoryRecovered = recovered;
    this.renderDoorState(true);
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
    const barrier = this.scene.add.image(x, this.route.startY + 2, DESCENT_ATTACK_BARRIER_TEXTURE_KEY)
      .setOrigin(0.5, 1)
      .setDisplaySize(78, 130)
      .setDepth(5);
    this.scene.physics.add.existing(barrier, true);
    const body = barrier.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
    this.barrier = barrier;
    this.gameObjects.push(barrier);

    const label = this.scene.add.text(x, this.route.startY - 150, "LACRE REFORGE", {
      fontFamily: "Courier New, monospace",
      fontSize: "12px",
      color: "#ff718f",
      backgroundColor: "#08050ccc",
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(6);
    this.barrierDecorations.push(label);
    this.gameObjects.push(label);
  }

  private destroyBarrier(): void {
    if (!this.barrier?.active) return;
    AudioManager.playSfx(this.scene, SFX.barrierDisable, { volume: 0.6 });
    const x = this.barrier.x;
    const y = this.barrier.y - this.barrier.displayHeight / 2;
    const body = this.barrier.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    this.spawnBarrierFragments(this.barrier);
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

  private spawnBarrierFragments(barrier: Phaser.GameObjects.Image): void {
    const columns = 2;
    const rows = 3;
    const source = barrier.texture.getSourceImage();
    const sourceWidth = source.width / columns;
    const sourceHeight = source.height / rows;
    const displayWidth = barrier.displayWidth / columns;
    const displayHeight = barrier.displayHeight / rows;
    const visualLeft = barrier.x - barrier.displayWidth / 2;
    const visualTop = barrier.y - barrier.displayHeight;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const direction = col === 0 ? -1 : 1;
        const fragment = this.scene.add.image(
          visualLeft + (col + 0.5) * displayWidth,
          visualTop + (row + 0.5) * displayHeight,
          DESCENT_ATTACK_BARRIER_TEXTURE_KEY,
        )
          .setCrop(
            Math.floor(col * sourceWidth),
            Math.floor(row * sourceHeight),
            Math.ceil(sourceWidth),
            Math.ceil(sourceHeight),
          )
          .setDisplaySize(displayWidth, displayHeight)
          .setDepth(8);
        this.scene.tweens.add({
          targets: fragment,
          x: fragment.x + direction * Phaser.Math.Between(20, 38),
          y: fragment.y - Phaser.Math.Between(18, 42),
          angle: direction * Phaser.Math.Between(24, 70),
          duration: Phaser.Math.Between(120, 175),
          ease: "Quad.easeOut",
          onComplete: () => {
            this.scene.tweens.add({
              targets: fragment,
              x: fragment.x + direction * Phaser.Math.Between(12, 28),
              y: fragment.y + Phaser.Math.Between(48, 82),
              angle: fragment.angle + direction * Phaser.Math.Between(40, 90),
              alpha: 0,
              duration: Phaser.Math.Between(180, 260),
              ease: "Quad.easeIn",
              onComplete: () => fragment.destroy(),
            });
          },
        });
      }
    }
  }

  private createDoubleJumpHazard(): void {
    const hazard = this.route.doubleJumpHazard!;
    if (this.route.phaseId === "fase3") {
      const visual = this.scene.add
        .image(
          hazard.x + hazard.width / 2,
          this.route.startY + 2,
          DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY,
        )
        .setOrigin(0.5, 1)
        .setDisplaySize(hazard.width, 34)
        .setDepth(4);
      visual.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const glow = this.scene.add
        .rectangle(
          hazard.x + hazard.width / 2,
          this.route.startY - 13,
          hazard.width,
          26,
          0x21d7ff,
          0.12,
        )
        .setDepth(3)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: visual,
        alpha: { from: 0.76, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 240,
        ease: "Sine.easeInOut",
      });
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.05, to: 0.18 },
        yoyo: true,
        repeat: -1,
        duration: 360,
        ease: "Sine.easeInOut",
      });
      this.gameObjects.push(visual, glow);
      return;
    }

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
    if (!this.route.epilogue) {
      this.doorClosed = this.scene.add
        .image(x, this.route.startY + 2, DESCENT_REFORGE_DOOR_CLOSED_KEY)
        .setOrigin(0.5, 1)
        .setDisplaySize(180, 225)
        .setDepth(-1);
      this.doorOpen = this.scene.add
        .image(x, this.route.startY + 2, DESCENT_REFORGE_DOOR_OPEN_KEY)
        .setOrigin(0.5, 1)
        .setDisplaySize(180, 225)
        .setDepth(-1);
      this.doorStatus = this.scene.add.text(x, this.route.startY - 245, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#ff9a4d",
        align: "center",
        backgroundColor: "#071015dd",
        padding: { x: 7, y: 4 },
      }).setOrigin(0.5).setDepth(6);
      this.gameObjects.push(this.doorClosed, this.doorOpen, this.doorStatus);
      this.renderDoorState(false);
      return;
    }

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

  private renderDoorState(animate: boolean): void {
    if (!this.doorClosed || !this.doorOpen || !this.doorStatus) return;
    this.doorClosed.setVisible(!this.memoryRecovered);
    this.doorOpen.setVisible(this.memoryRecovered);
    this.doorStatus
      .setText(this.memoryRecovered
        ? "REFORGE // MEMÓRIA VALIDADA // ACESSO ABERTO"
        : "MEMÓRIA AUSENTE — AVANÇAR COMPROMETE A DESCIDA")
      .setColor(this.memoryRecovered ? "#7CFCEA" : "#ff9a4d");
    if (!animate || !this.memoryRecovered) return;
    AudioManager.playSfx(this.scene, SFX.gateOpening, { volume: 0.5 });
    const targetScaleX = this.doorOpen.scaleX;
    const targetScaleY = this.doorOpen.scaleY;
    this.doorOpen
      .setAlpha(0)
      .setScale(targetScaleX * 0.96, targetScaleY * 0.96);
    this.scene.tweens.add({
      targets: this.doorOpen,
      alpha: 1,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: 260,
      ease: "Quad.easeOut",
    });
  }
}

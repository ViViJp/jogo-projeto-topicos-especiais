import Phaser from "phaser";
import { GAMEPLAY_TIMING } from "../config/GameConfig";

export const TILED_CHECKPOINT_TEXTURE_KEY = "checkpoint-tv";

/** Visual diegético compartilhado pelos checkpoints das cinco fases Tiled. */
export class CheckpointMarker {
  readonly image: Phaser.GameObjects.Image;
  private readonly idleTween: Phaser.Tweens.Tween;
  private activated = false;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    groundY: number,
    depth: number,
  ) {
    this.image = scene.add
      .image(x, groundY, TILED_CHECKPOINT_TEXTURE_KEY)
      .setOrigin(0.5, 1)
      .setDisplaySize(72, 61)
      .setDepth(depth);
    this.idleTween = scene.tweens.add({
      targets: this.image,
      alpha: { from: 0.78, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  activate(): void {
    if (this.activated) return;
    this.activated = true;
    this.idleTween.stop();
    this.image.setAlpha(1).setTint(0x7cfcea);

    const glow = this.scene.add
      .circle(this.image.x, this.image.y - 31, 28, 0x36e2ff, 0.18)
      .setStrokeStyle(3, 0x7cfcea, 0.9)
      .setDepth(this.image.depth - 1);
    const label = this.scene.add
      .text(this.image.x, this.image.y - 82, "SINCRONIZANDO CHECKPOINT...", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#7CFCEA",
        backgroundColor: "#05050add",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(this.image.depth + 1);

    this.scene.tweens.add({
      targets: this.image,
      scaleX: { from: 0.5, to: 0.56 },
      scaleY: { from: 0.5, to: 0.56 },
      duration: 130,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => this.image.setDisplaySize(72, 61),
    });
    this.scene.tweens.add({
      targets: glow,
      radius: 96,
      alpha: 0,
      duration: GAMEPLAY_TIMING.checkpointInteractionMs,
      ease: "Cubic.easeOut",
      onComplete: () => glow.destroy(),
    });
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      delay: GAMEPLAY_TIMING.checkpointInteractionMs - 250,
      duration: 250,
      onComplete: () => label.destroy(),
    });
  }

  destroy(): void {
    this.idleTween.stop();
    this.image.destroy();
  }
}

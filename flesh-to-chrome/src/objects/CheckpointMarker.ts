import Phaser from "phaser";
import { GAMEPLAY_TIMING } from "../config/GameConfig";

export const TILED_CHECKPOINT_TEXTURE_KEY = "checkpoint-tv";

/** Visual diegético compartilhado pelos checkpoints das cinco fases Tiled. */
export class CheckpointMarker {
  readonly image: Phaser.GameObjects.Image;
  private readonly idleTween: Phaser.Tweens.Tween;
  private activated = false;
  private syncVisuals: Phaser.GameObjects.GameObject[] = [];

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

  activate(withFeedback = true): void {
    if (this.activated) return;
    this.activated = true;
    this.idleTween.stop();
    this.image.setAlpha(1).setTint(0x7cfcea);

    // No respawn, o checkpoint já está salvo. Mantém a TV no estado ativo,
    // mas não repete texto, pulso, som nem a interação do personagem.
    if (!withFeedback) return;

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

    // O gabinete continua sendo o asset dedicado; estas camadas ficam apenas
    // sobre a tela e criam a leitura de sincronização ciano/verde.
    const screenY = this.image.y - 32;
    const cyanScreen = this.scene.add
      .rectangle(this.image.x, screenY, 28, 20, 0x36e2ff, 0.16)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.image.depth + 1);
    const greenScreen = this.scene.add
      .rectangle(this.image.x, screenY, 24, 16, 0x68ff9c, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.image.depth + 2);
    const scanLine = this.scene.add
      .rectangle(this.image.x, screenY - 8, 24, 2, 0x9affbc, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.image.depth + 3);
    this.syncVisuals.push(glow, label, cyanScreen, greenScreen, scanLine);

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
      onComplete: () => this.destroySyncVisual(glow),
    });
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      delay: GAMEPLAY_TIMING.checkpointInteractionMs - 250,
      duration: 250,
      onComplete: () => this.destroySyncVisual(label),
    });
    this.scene.tweens.add({
      targets: cyanScreen,
      alpha: { from: 0.12, to: 0.5 },
      duration: 145,
      yoyo: true,
      repeat: 4,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: greenScreen,
      alpha: { from: 0, to: 0.52 },
      delay: 110,
      duration: 180,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: scanLine,
      y: screenY + 8,
      alpha: { from: 0.95, to: 0.25 },
      duration: 230,
      yoyo: true,
      repeat: 4,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.destroySyncVisual(cyanScreen);
        this.destroySyncVisual(greenScreen);
        this.destroySyncVisual(scanLine);
      },
    });
  }

  private destroySyncVisual(visual: Phaser.GameObjects.GameObject): void {
    const index = this.syncVisuals.indexOf(visual);
    if (index >= 0) this.syncVisuals.splice(index, 1);
    visual.destroy();
  }

  destroy(): void {
    this.idleTween.stop();
    this.scene.tweens.killTweensOf(this.syncVisuals);
    this.syncVisuals.forEach((visual) => visual.destroy());
    this.syncVisuals = [];
    this.image.destroy();
  }
}

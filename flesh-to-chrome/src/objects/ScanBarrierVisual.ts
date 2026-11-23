import Phaser from "phaser";

/**
 * Reaproveita apenas os emissores do spritesheet Foozle e estende os feixes
 * entre eles. Repetir o frame completo a cada tile criava várias portas
 * empilhadas em vez de uma única barreira alta.
 */
export class ScanBarrierVisual {
  private readonly topEmitter: Phaser.GameObjects.Image;
  private readonly bottomEmitter: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Rectangle;
  private readonly beams: Phaser.GameObjects.Rectangle[];
  private readonly pulse: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    centerX: number,
    topY: number,
    height: number,
  ) {
    const emitterHeight = 14;
    const beamTop = topY + emitterHeight - 2;
    const beamBottom = topY + height - emitterHeight + 2;
    const beamHeight = Math.max(12, beamBottom - beamTop);
    const beamCenterY = beamTop + beamHeight / 2;
    const texture = scene.textures.get(textureKey);
    const topFrame = `${textureKey}-scan-barrier-top`;
    const bottomFrame = `${textureKey}-scan-barrier-bottom`;
    if (!texture.has(topFrame)) texture.add(topFrame, 0, 0, 0, 32, emitterHeight);
    if (!texture.has(bottomFrame)) texture.add(bottomFrame, 0, 0, 50, 32, emitterHeight);

    this.glow = scene.add
      .rectangle(centerX, beamCenterY, 24, beamHeight, 0xff183f, 0.13)
      .setDepth(5);
    this.beams = [-7, 0, 7].map((offset) => scene.add
      .rectangle(centerX + offset, beamCenterY, 2, beamHeight, 0xff244f, 0.95)
      .setStrokeStyle(1, 0xff9eb2, 0.72)
      .setDepth(6));

    this.topEmitter = scene.add
      .image(centerX, topY, textureKey, topFrame)
      .setOrigin(0.5, 0)
      .setDisplaySize(32, emitterHeight)
      .setDepth(7);
    this.bottomEmitter = scene.add
      .image(centerX, topY + height, textureKey, bottomFrame)
      .setOrigin(0.5, 1)
      .setDisplaySize(32, emitterHeight)
      .setDepth(7);

    this.pulse = scene.tweens.add({
      targets: [this.glow, ...this.beams],
      alpha: 0.58,
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  setEnabled(enabled: boolean): void {
    this.topEmitter.setVisible(enabled);
    this.bottomEmitter.setVisible(enabled);
    this.glow.setVisible(enabled);
    this.beams.forEach((beam) => beam.setVisible(enabled));
  }

  destroy(): void {
    this.pulse.stop();
    this.topEmitter.destroy();
    this.bottomEmitter.destroy();
    this.glow.destroy();
    this.beams.forEach((beam) => beam.destroy());
  }
}

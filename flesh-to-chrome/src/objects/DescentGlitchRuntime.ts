import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { DescentStep } from "../systems/DescentProgression";

export const DESCENT_GLITCH_TEXTURE_PREFIX = "descent-glitch";

/**
 * Overlay narrativo dos mapas reutilizados. A posicao vem de um objeto
 * `memory_glitch` no object layer do Tiled; portanto o mapa-base continua
 * unico para subida e descida.
 */
export class DescentGlitchRuntime {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly halo: Phaser.GameObjects.Arc;
  private collected = false;

  constructor(
    private readonly scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    offsetY: number,
    step: DescentStep,
    alreadyRecovered: boolean,
    onRecovered: (fragmentId: string) => void,
  ) {
    const object = (map.getObjectLayer("objects")?.objects ?? [])
      .find((candidate) => candidate.type === "memory_glitch");
    if (!object) throw new Error(`Mapa ${step.phaseId}: objeto memory_glitch ausente`);
    const x = object.x ?? map.widthInPixels - 900;
    const y = (object.y ?? 320) + offsetY;
    this.collected = alreadyRecovered;

    this.halo = scene.add.circle(x, y, 42, 0x7cfcea, 0.15)
      .setStrokeStyle(2, 0xff71ce, 0.75)
      .setDepth(7)
      .setVisible(!alreadyRecovered);
    this.sprite = scene.physics.add.sprite(
      x,
      y,
      `${DESCENT_GLITCH_TEXTURE_PREFIX}-${step.fragmentAsset}`,
    ).setScale(0.72).setDepth(8).setVisible(!alreadyRecovered);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = !alreadyRecovered;
    scene.tweens.add({
      targets: [this.sprite, this.halo],
      y: y - 10,
      alpha: { from: 0.55, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 720,
    });
    // O collider real e registrado depois que o Player ja existe.
    this.onRecovered = () => {
      if (this.collected) return;
      this.collected = true;
      body.enable = false;
      this.sprite.setVisible(false);
      this.halo.setVisible(false);
      onRecovered(step.fragmentId);
    };
  }

  private readonly onRecovered: () => void;

  registerPlayer(player: Player): void {
    this.scene.physics.add.overlap(player.sprite, this.sprite, this.onRecovered);
  }

  destroy(): void {
    this.sprite.destroy();
    this.halo.destroy();
  }
}

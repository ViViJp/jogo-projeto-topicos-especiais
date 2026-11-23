import Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { DescentStep } from "../systems/DescentProgression";
import { AudioManager, SFX } from "../systems/AudioManager";

export const DESCENT_MEMORY_FRAGMENT_TEXTURE_KEY = "memory-fragment";

/**
 * Overlay narrativo dos mapas reutilizados. A posicao vem de um objeto
 * `memory_glitch` no object layer do Tiled; portanto o mapa-base continua
 * unico para subida e descida.
 */
export class DescentGlitchRuntime {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly halo: Phaser.GameObjects.Arc;
  private readonly particles: Phaser.GameObjects.Rectangle[] = [];
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
      DESCENT_MEMORY_FRAGMENT_TEXTURE_KEY,
    ).setDepth(8).setVisible(!alreadyRecovered);
    const particleColors = [0x7cfcea, 0x36e2ff, 0xff71ce];
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const radius = 30 + (index % 2) * 8;
      const particle = scene.add.rectangle(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        index % 3 === 0 ? 5 : 3,
        2,
        particleColors[index % particleColors.length],
        0.75,
      ).setDepth(7).setVisible(!alreadyRecovered);
      this.particles.push(particle);
      scene.tweens.add({
        targets: particle,
        alpha: { from: 0.2, to: 0.9 },
        scaleX: { from: 0.55, to: 1.2 },
        duration: 420 + index * 45,
        yoyo: true,
        repeat: -1,
        delay: index * 55,
      });
    }
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
      AudioManager.playSfx(this.scene, SFX.glitch, { volume: 0.58 });
      onRecovered(step.fragmentId);
      const visualTargets = [this.sprite, this.halo, ...this.particles];
      this.scene.tweens.killTweensOf(visualTargets);
      this.scene.tweens.add({
        targets: visualTargets,
        alpha: 0,
        scaleX: 1.45,
        scaleY: 1.45,
        duration: 210,
        ease: "Cubic.easeOut",
        onComplete: () => visualTargets.forEach((target) => target.setVisible(false)),
      });
      this.particles.forEach((particle, index) => {
        const angle = (Math.PI * 2 * index) / this.particles.length;
        this.scene.tweens.add({
          targets: particle,
          x: particle.x + Math.cos(angle) * 28,
          y: particle.y + Math.sin(angle) * 28,
          duration: 210,
          ease: "Cubic.easeOut",
        });
      });
    };
  }

  private readonly onRecovered: () => void;

  registerPlayer(player: Player): void {
    this.scene.physics.add.overlap(player.sprite, this.sprite, this.onRecovered);
  }

  destroy(): void {
    this.sprite.destroy();
    this.halo.destroy();
    this.particles.forEach((particle) => particle.destroy());
  }
}

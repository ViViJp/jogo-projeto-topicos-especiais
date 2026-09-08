import Phaser from "phaser";

/**
 * HUD - GDD seção 14.4:
 *   "Créditos da fase: X/Y"
 *   "Total: Z"
 */
export class HUD {
  private scene: Phaser.Scene;
  private phaseText: Phaser.GameObjects.Text;
  private totalText: Phaser.GameObjects.Text;
  private abilityIcons: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#7CFCEA",
      stroke: "#02040a",
      strokeThickness: 4,
    };

    this.phaseText = scene.add
      .text(24, 20, "Créditos da fase: 0/0", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.totalText = scene.add
      .text(24, 48, "Total: 0", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.abilityIcons = scene.add
      .text(24, 76, "", { ...style, fontSize: "16px", color: "#B8C1FF" })
      .setScrollFactor(0)
      .setDepth(1000);

    this.promptText = scene.add
      .text(scene.scale.width / 2, 40, "", {
        ...style,
        fontSize: "18px",
        color: "#FFD37C",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0);
  }

  setCredits(phaseValue: number, phaseTotal: number, total: number): void {
    this.phaseText.setText(`Créditos da fase: ${phaseValue}/${phaseTotal}`);
    this.totalText.setText(`Total: ${total}`);
  }

  setAbilities(labels: string[]): void {
    this.abilityIcons.setText(labels.join("   "));
  }

  flashPrompt(message: string, durationMs = 1400): void {
    this.promptText.setText(message);
    this.promptText.setAlpha(1);
    this.scene.tweens.add({
      targets: this.promptText,
      alpha: 0,
      delay: durationMs,
      duration: 300,
    });
  }

  destroy(): void {
    this.phaseText.destroy();
    this.totalText.destroy();
    this.abilityIcons.destroy();
    this.promptText.destroy();
  }
}

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
  private dashBattery: Phaser.GameObjects.Container;
  private dashBatteryFill: Phaser.GameObjects.Rectangle;
  private dashBatteryGlow: Phaser.GameObjects.Rectangle;
  private dashBatteryStatus: Phaser.GameObjects.Text;
  private dashRechargeTween?: Phaser.Tweens.Tween;
  private dashReady = true;

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

    this.dashBatteryGlow = scene.add
      .rectangle(66, 31, 144, 38, 0x49f5ff, 0)
      .setOrigin(0.5);
    this.dashBatteryFill = scene.add
      .rectangle(5, 31, 122, 16, 0x21d7ff, 1)
      .setOrigin(0, 0.5);

    const batteryBack = scene.add.graphics();
    batteryBack.fillStyle(0x07141d, 0.96);
    batteryBack.fillRoundedRect(0, 18, 132, 26, 4);

    const frame = scene.add.graphics();
    frame.lineStyle(2, 0x8cf7ff, 1);
    frame.strokeRoundedRect(0, 18, 132, 26, 4);
    frame.fillStyle(0x8cf7ff, 1);
    frame.fillRect(132, 25, 6, 12);
    frame.lineStyle(1, 0x07141d, 0.75);
    for (const x of [29, 53, 77, 101]) frame.lineBetween(x, 22, x, 40);

    const label = scene.add.text(0, 0, "PROPULSORES // DASH", {
      fontFamily: "Courier New, monospace",
      fontSize: "11px",
      color: "#b8faff",
      stroke: "#02040a",
      strokeThickness: 3,
    });
    this.dashBatteryStatus = scene.add.text(69, 49, "DASH PRONTO", {
      fontFamily: "Courier New, monospace",
      fontSize: "11px",
      color: "#7cfcea",
      stroke: "#02040a",
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    this.dashBattery = scene.add
      .container(scene.scale.width - 170, 20, [
        this.dashBatteryGlow,
        batteryBack,
        this.dashBatteryFill,
        frame,
        label,
        this.dashBatteryStatus,
      ])
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);
  }

  setCredits(phaseValue: number, phaseTotal: number, total: number): void {
    this.phaseText.setText(`Créditos da fase: ${phaseValue}/${phaseTotal}`);
    this.totalText.setText(`Total: ${total}`);
  }

  setAbilities(labels: string[]): void {
    this.abilityIcons.setText(labels.join("   "));
  }

  setDashUnlocked(unlocked: boolean): void {
    this.dashBattery.setVisible(unlocked);
    if (!unlocked) {
      this.dashRechargeTween?.stop();
      this.dashRechargeTween = undefined;
      return;
    }
    this.setDashReady(false);
  }

  beginDashCooldown(durationMs: number): void {
    if (!this.dashBattery.visible) return;
    this.dashRechargeTween?.stop();
    this.scene.tweens.killTweensOf(this.dashBatteryGlow);
    this.scene.tweens.killTweensOf(this.dashBatteryFill);
    this.dashReady = false;
    this.dashBatteryGlow.setAlpha(0).setScale(1);
    this.dashBatteryFill.setFillStyle(0x176b86, 0.9).setAlpha(0.9).setScale(0, 1);
    this.dashBatteryStatus.setColor("#7896a8").setText(`RECARREGANDO ${(durationMs / 1000).toFixed(1)}s`);

    this.dashRechargeTween = this.scene.tweens.add({
      targets: this.dashBatteryFill,
      scaleX: 1,
      duration: durationMs,
      ease: "Linear",
      onUpdate: (tween) => {
        const seconds = Math.max(0, durationMs * (1 - tween.progress) / 1000);
        this.dashBatteryStatus.setText(`RECARREGANDO ${seconds.toFixed(1)}s`);
      },
      onComplete: () => this.setDashReady(true),
    });
  }

  setDashReady(pulse = true): void {
    if (!this.dashBattery.visible) return;
    if (this.dashReady && pulse) return;
    this.dashReady = true;
    this.dashRechargeTween?.stop();
    this.dashRechargeTween = undefined;
    this.dashBatteryFill.setFillStyle(0x21d7ff, 1).setScale(1, 1).setAlpha(1);
    this.dashBatteryStatus.setColor("#8cf7ff").setText("DASH PRONTO");
    if (!pulse) {
      this.dashBatteryGlow.setAlpha(0.2).setScale(1);
      return;
    }

    this.dashBatteryGlow.setAlpha(0.72).setScale(1);
    this.scene.tweens.add({
      targets: this.dashBatteryGlow,
      alpha: 0.2,
      scaleX: 1.14,
      scaleY: 1.3,
      duration: 420,
      ease: "Cubic.easeOut",
    });
    this.scene.tweens.add({
      targets: this.dashBatteryFill,
      alpha: 0.72,
      duration: 110,
      yoyo: true,
      repeat: 0,
    });
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
    this.dashRechargeTween?.stop();
    this.phaseText.destroy();
    this.totalText.destroy();
    this.abilityIcons.destroy();
    this.promptText.destroy();
    this.dashBattery.destroy(true);
  }
}

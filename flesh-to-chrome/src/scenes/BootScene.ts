import Phaser from "phaser";
import { generatePlaceholderTextures, TEX } from "../utils/PlaceholderTextures";
import { AudioManager } from "../systems/AudioManager";
import { startLoadingTransition } from "../systems/SceneTransition";

export class BootScene extends Phaser.Scene {
  private inviteProgressFill?: Phaser.GameObjects.Graphics;
  private inviteProgressX = 0;
  private inviteProgressY = 0;
  private inviteProgressWidth = 0;

  constructor() {
    super("BootScene");
  }

  preload(): void {
    if (this.hasMultiplayerInvite()) this.createInviteLoadingView();
    AudioManager.preload(this);
    if (!this.textures.exists(TEX.credit)) {
      this.load.spritesheet(
        TEX.credit,
        new URL("../assets/props/collectibles/credit-cyberpunk.png", import.meta.url).href,
        { frameWidth: 32, frameHeight: 32 },
      );
    }
  }

  create(): void {
    this.load.off(Phaser.Loader.Events.PROGRESS, this.handleInviteLoadProgress);
    generatePlaceholderTextures(this);
    if (this.hasMultiplayerInvite()) {
      startLoadingTransition(this, "MultiplayerScene", undefined, "CIRCUITO MULTIPLAYER");
      return;
    }
    this.scene.start("MenuScene");
  }

  private hasMultiplayerInvite(): boolean {
    return new URL(window.location.href).searchParams.has("room");
  }

  /** Feedback imediato enquanto até os assets básicos do Boot ainda carregam. */
  private createInviteLoadingView(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    this.cameras.main.setBackgroundColor(0x03050a);
    this.add.rectangle(centerX, centerY, width, height, 0x03050a, 1);
    this.add.text(centerX, centerY - 76, "FLESH TO CHROME", {
      fontFamily: "Courier New, monospace",
      fontSize: "32px",
      color: "#7CFCEA",
      letterSpacing: 4,
    }).setOrigin(0.5).setShadow(0, 0, "#36e2ff", 8, true, true);
    this.add.text(centerX, centerY - 24, "CONECTANDO AO CIRCUITO...", {
      fontFamily: "Courier New, monospace",
      fontSize: "17px",
      color: "#E8ECFF",
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.inviteProgressWidth = Math.min(520, width - 120);
    this.inviteProgressX = centerX - this.inviteProgressWidth / 2;
    this.inviteProgressY = centerY + 42;
    this.add.rectangle(centerX, this.inviteProgressY, this.inviteProgressWidth, 18, 0x101725, 1)
      .setStrokeStyle(2, 0x36536c, 1);
    this.inviteProgressFill = this.add.graphics();
    this.handleInviteLoadProgress(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, this.handleInviteLoadProgress);
  }

  private readonly handleInviteLoadProgress = (progress: number): void => {
    if (!this.inviteProgressFill) return;
    this.inviteProgressFill.clear();
    this.inviteProgressFill.fillStyle(0x36e2ff, 0.9);
    this.inviteProgressFill.fillRect(
      this.inviteProgressX,
      this.inviteProgressY - 9,
      this.inviteProgressWidth * Phaser.Math.Clamp(progress, 0, 1),
      18,
    );
  };
}

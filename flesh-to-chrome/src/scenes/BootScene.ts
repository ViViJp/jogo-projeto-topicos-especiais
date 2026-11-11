import Phaser from "phaser";
import { generatePlaceholderTextures, TEX } from "../utils/PlaceholderTextures";
import { AudioManager } from "../systems/AudioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
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
    generatePlaceholderTextures(this);
    const hasMultiplayerInvite = new URL(window.location.href).searchParams.has("room");
    this.scene.start(hasMultiplayerInvite ? "MultiplayerScene" : "MenuScene");
  }
}

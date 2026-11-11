import Phaser from "phaser";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";
import { AudioManager } from "../systems/AudioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    AudioManager.preload(this);
  }

  create(): void {
    generatePlaceholderTextures(this);
    const hasMultiplayerInvite = new URL(window.location.href).searchParams.has("room");
    this.scene.start(hasMultiplayerInvite ? "MultiplayerScene" : "MenuScene");
  }
}

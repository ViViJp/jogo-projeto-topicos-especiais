import Phaser from "phaser";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    generatePlaceholderTextures(this);
    const hasMultiplayerInvite = new URL(window.location.href).searchParams.has("room");
    this.scene.start(hasMultiplayerInvite ? "MultiplayerScene" : "MenuScene");
  }
}

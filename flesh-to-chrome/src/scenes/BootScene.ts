import Phaser from "phaser";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    generatePlaceholderTextures(this);
    this.scene.start("MenuScene");
  }
}

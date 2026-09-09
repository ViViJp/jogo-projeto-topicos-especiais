import Phaser from "phaser";
import { generatePlaceholderTextures, TEX } from "../utils/PlaceholderTextures";
import { createAlexAnims, preloadAlex, ALEX } from "../utils/AlexSprites";
import { AudioManager } from "../systems/AudioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.add
      .text(640, 360, "carregando…", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#7CFCEA",
      })
      .setOrigin(0.5);
    preloadAlex(this);
    AudioManager.preload(this);
  }

  create(): void {
    generatePlaceholderTextures(this);
    createAlexAnims(this);
    // Player usa o sheet real; placeholders ficam para chão/hazards/etc.
    this.registry.set("playerStandKey", ALEX.sheet);
    this.registry.set("texFallbackStand", TEX.player);
    this.registry.set("texFallbackSlide", TEX.playerSlide);
    this.scene.start("MenuScene");
  }
}

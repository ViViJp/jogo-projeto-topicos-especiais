import Phaser from "phaser";
import { generatePlaceholderTextures, TEX } from "../utils/PlaceholderTextures";
import { createAlexAnims, preloadAlex, ALEX } from "../utils/AlexSprites";
import { AudioManager } from "../systems/AudioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    const label = this.add
      .text(640, 360, "carregando assets…", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#7CFCEA",
      })
      .setOrigin(0.5);

    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.error("[boot] falha ao carregar:", file.key, file.url);
      label.setText(`erro: ${file.key}`);
      label.setColor("#ff6b6b");
    });

    preloadAlex(this);
    AudioManager.preload(this);
  }

  create(): void {
    generatePlaceholderTextures(this);
    const alexOk = createAlexAnims(this);
    this.registry.set("alexReady", alexOk);
    this.registry.set("playerStandKey", alexOk ? ALEX.sheet : TEX.player);
    this.registry.set("texFallbackStand", TEX.player);
    this.registry.set("texFallbackSlide", TEX.playerSlide);

    // Desbloqueia áudio no primeiro gesto (política do browser)
    const unlock = () => {
      try {
        this.sound.unlock();
      } catch {
        /* ignore */
      }
      const ctx = (this.sound as unknown as { context?: AudioContext }).context;
      if (ctx?.state === "suspended") void ctx.resume();
    };
    this.input.once("pointerdown", unlock);
    this.input.keyboard?.once("keydown", unlock);

    this.scene.start("MenuScene");
  }
}

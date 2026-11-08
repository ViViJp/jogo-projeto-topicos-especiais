import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { abilityStateToBodyStage } from "../systems/AbilityState";
import {
  ALEX_ARMS_TEXTURE_KEY,
  ALEX_DASH_TEXTURE_KEY,
  ALEX_EYES_TEXTURE_KEY,
  ALEX_LEGS_TEXTURE_KEY,
  ALEX_SHEET_CONFIG,
  alexTextureForAbilities,
} from "../utils/AlexSprite";

interface EpilogueData { ending: "flesh" | "hollow" }

export class EpilogueScene extends Phaser.Scene {
  private data$!: EpilogueData;
  private input$!: InputManager;
  private leaving = false;

  constructor() { super("EpilogueScene"); }

  init(data: EpilogueData): void { this.data$ = data; }

  preload(): void {
    if (!this.textures.exists("epilogue-alex-flesh")) {
      this.load.spritesheet(
        "epilogue-alex-flesh",
        new URL("../assets/player/alex-flesh-happy/alex-flesh-happy.png", import.meta.url).href,
        ALEX_SHEET_CONFIG,
      );
    }
    const hollowStages = [
      { key: ALEX_LEGS_TEXTURE_KEY, url: new URL("../assets/player/alex-legs/alex-legs.png", import.meta.url) },
      { key: ALEX_ARMS_TEXTURE_KEY, url: new URL("../assets/player/alex-arms/alex-arms.png", import.meta.url) },
      { key: ALEX_EYES_TEXTURE_KEY, url: new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url) },
      { key: ALEX_DASH_TEXTURE_KEY, url: new URL("../assets/player/alex-dash/alex-dash.png", import.meta.url) },
    ];
    for (const stage of hollowStages) {
      if (!this.textures.exists(stage.key)) this.load.spritesheet(stage.key, stage.url.href, ALEX_SHEET_CONFIG);
    }
  }

  create(): void {
    this.input$ = new InputManager(this);
    this.leaving = false;
    const data = SaveState.load().get();
    const flesh = this.data$.ending === "flesh";
    const texture = flesh ? "epilogue-alex-flesh" : alexTextureForAbilities(data.abilities);
    this.cameras.main.setBackgroundColor(flesh ? 0x142119 : 0x111019);
    this.add.rectangle(0, 520, SCREEN_WIDTH, 200, 0x24352c).setOrigin(0, 0);
    this.add.circle(1040, 125, 72, flesh ? 0xffd37c : 0x8e789d, 0.82);
    this.add.rectangle(1040, 440, 230, 180, 0x1d1716).setStrokeStyle(5, 0x6d4f42);
    const alex = this.add.sprite(130, 510, texture, 26).setScale(2.2);
    this.tweens.add({ targets: alex, x: 900, duration: 5200, ease: "Linear" });
    this.add.text(SCREEN_WIDTH / 2, 65, "EPILOGO — ESGOTO", {
      fontFamily: "Courier New, monospace", fontSize: "32px", color: flesh ? "#FFD37C" : "#b7a7c4",
    }).setOrigin(0.5);
    const bodyStage = abilityStateToBodyStage(data.abilities);
    this.add.text(SCREEN_WIDTH / 2, 145, flesh
      ? "Sem habilidades especiais, com cicatrizes do bioprinting,\nAlex percorre o ultimo trecho ate a luz de casa."
      : `Ainda carregando ${bodyStage} implante(s), Alex chega a porta.\nA distancia que resta nao pode ser atravessada correndo.`, {
      fontFamily: "Courier New, monospace", fontSize: "21px", color: "#e8ecff", align: "center", lineSpacing: 9,
    }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 48, "ENTER / A para concluir", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#8d96ad",
    }).setOrigin(0.5);
  }

  update(): void {
    if (!this.leaving && this.input$.isConfirmJustDown()) {
      this.leaving = true;
      this.scene.start("EndingScene", { ending: this.data$.ending });
    }
    this.input$.postUpdate();
  }
}

import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { descentStepAt } from "../systems/DescentProgression";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

const REFORGE_BG = "reforge-bg";
const REFORGE_FRAME = "reforge-frame";

const IMPLANT_NAMES = {
  legs: "PERNAS MECANICAS",
  arms: "BRACOS MECANICOS",
  eyes: "OLHOS MECANICOS",
  thrusters: "PROPULSORES",
} as const;

export class ReForgeScene extends Phaser.Scene {
  private input$!: InputManager;
  private page = 0;
  private finished = false;
  private advancePage?: () => void;

  constructor() {
    super("ReForgeScene");
  }

  preload(): void {
    if (!this.textures.exists(REFORGE_BG)) {
      this.load.image(REFORGE_BG, new URL("../assets/narrative/recycling/unidade-reciclagem.png", import.meta.url).href);
      this.load.image(REFORGE_FRAME, new URL("../assets/narrative/recycling/holograma-frame.png", import.meta.url).href);
    }
  }

  create(): void {
    this.input$ = new InputManager(this);
    this.page = 0;
    this.finished = false;
    this.advancePage = undefined;
    const save = SaveState.load().get();
    const step = descentStepAt(save.descentState.currentStep);
    if (!step || save.descentState.pendingRemoval !== step.implant) {
      this.scene.start("MenuScene");
      return;
    }
    this.cameras.main.setBackgroundColor(0x071015);
    this.add.image(SCREEN_WIDTH / 2, 260, REFORGE_BG).setDisplaySize(720, 405);
    this.add.image(SCREEN_WIDTH / 2, 248, REFORGE_FRAME).setDisplaySize(280, 190).setAlpha(0.72);
    this.add.text(SCREEN_WIDTH / 2, 45, "REFORGE INDUSTRIES", {
      fontFamily: "Courier New, monospace", fontSize: "34px", color: "#7CFCEA", letterSpacing: 5,
    }).setOrigin(0.5);
    const implant = IMPLANT_NAMES[step.implant];
    const pages = [
      `${step.memoryTitle}\n${step.memory}`,
      `CROMO IDENTIFICADO: ${implant}\nValor recuperavel confirmado. Iniciando extracao.`,
      `BIOPRINTING EM CURSO\nSubstituto organico imperfeito reconstruido.`,
      `${implant} REMOVIDO\nA habilidade correspondente nao esta mais disponivel.`,
    ];
    const body = this.add.text(SCREEN_WIDTH / 2, 525, pages[0], {
      fontFamily: "Courier New, monospace", fontSize: "21px", color: "#e8ecff", align: "center",
      lineSpacing: 9, wordWrap: { width: 920 },
    }).setOrigin(0.5);
    const counter = this.add.text(SCREEN_WIDTH - 90, SCREEN_HEIGHT - 48, "1/4", {
      fontFamily: "Courier New, monospace", fontSize: "15px", color: "#77809d",
    }).setOrigin(0.5);
    const advance = () => {
      if (this.finished) return;
      if (this.page < pages.length - 1) {
        this.page += 1;
        body.setText(pages[this.page]);
        counter.setText(`${this.page + 1}/${pages.length}`);
        return;
      }
      this.finished = true;
      const result = SaveState.load().completeBioprinting();
      if (!result) {
        this.scene.start("MenuScene");
        return;
      }
      const data = SaveState.load().get();
      if (result.finished) {
        this.scene.start("EpilogueScene", { ending: "flesh" });
      } else {
        this.scene.start("GameScene", {
          phaseId: result.nextPhaseId,
          checkpointX: 0,
          checkpointY: 0,
          consolidatedCreditIds: [],
          wallet: 0,
          abilities: data.abilities,
          descent: true,
        });
      }
    };
    this.advancePage = advance;
    this.input.on("pointerdown", advance);
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 48, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#77809d",
    }).setOrigin(0.5);
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) this.advancePage?.();
    this.input$.postUpdate();
  }
}

import Phaser from "phaser";
import { descentStepAt } from "../systems/DescentProgression";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { DescentPreviewSession } from "../systems/DescentPreviewSession";
import type { GameSceneData } from "./GameScene";

const REFORGE_BG = "reforge-bg";
const REFORGE_FATHER = "reforge-father";
const REFORGE_CYBORG = "reforge-cyborg";

interface ReForgeSceneData {
  testMode?: boolean;
  descentPreview?: DescentPreviewSession;
}

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
  private testMode = false;
  private descentPreview?: DescentPreviewSession;

  constructor() {
    super("ReForgeScene");
  }

  init(data: ReForgeSceneData): void {
    this.testMode = data.testMode ?? false;
    this.descentPreview = data.descentPreview;
  }

  preload(): void {
    if (!this.textures.exists(REFORGE_BG)) {
      this.load.image(REFORGE_BG, new URL("../assets/narrative/recycling/unidade-reciclagem.png", import.meta.url).href);
    }
    if (!this.textures.exists(REFORGE_FATHER)) {
      this.load.image(REFORGE_FATHER, new URL("../assets/narrative/recycling/holograma-pai.png", import.meta.url).href);
    }
    if (!this.textures.exists(REFORGE_CYBORG)) {
      this.load.image(REFORGE_CYBORG, new URL("../assets/narrative/recycling/holograma-ciborgue.png", import.meta.url).href);
    }
  }

  create(): void {
    this.input$ = new InputManager(this);
    AudioManager.playBgm(this, BGM.clinic, 0.26);
    this.page = 0;
    this.finished = false;
    this.advancePage = undefined;
    if (this.testMode && !this.descentPreview) {
      this.scene.start("MenuScene");
      return;
    }
    const progression = this.descentPreview ?? SaveState.load();
    const descentData = progression.get();
    const step = descentStepAt(descentData.descentState.currentStep);
    if (!step || descentData.descentState.pendingRemoval !== step.implant) {
      this.scene.start("MenuScene");
      return;
    }
    const width = this.scale.width;
    const height = this.scale.height;
    // O pai aparece uma única vez: na retirada final das pernas, quando Alex
    // perde o salto duplo. As três vendas anteriores usam o operador genérico.
    const usesFatherAvatar = step.implant === "legs";
    this.cameras.main.setBackgroundColor(0x071015);
    this.add.image(width / 2, 270, REFORGE_BG).setDisplaySize(300, 400);
    const avatarHologram = this.add.image(
      width / 2,
      255,
      usesFatherAvatar ? REFORGE_FATHER : REFORGE_CYBORG,
    )
      .setDisplaySize(180, 216)
      .setVisible(false);
    avatarHologram.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const avatarCaption = this.add.text(
      width / 2,
      385,
      usesFatherAvatar ? "AVATAR REFORGE // PAI DE ALEX" : "AVATAR REFORGE // OPERADOR CIBORGUE",
      {
        fontFamily: "Courier New, monospace", fontSize: "13px", color: "#7CFCEA",
        backgroundColor: "#071015dd", padding: { x: 7, y: 4 },
      },
    ).setOrigin(0.5).setVisible(false);
    this.add.text(width / 2, 45, "REFORGE INDUSTRIES", {
      fontFamily: "Courier New, monospace", fontSize: "34px", color: "#7CFCEA", letterSpacing: 5,
    }).setOrigin(0.5);
    const implant = IMPLANT_NAMES[step.implant];
    const pages = [
      `${step.memoryTitle}\n${step.memory}`,
      `CROMO IDENTIFICADO: ${implant}\nAVATAR REFORGE: peça avaliada. O cromo conserva valor; a carne será substituída.`,
      `BIOPRINTING EM CURSO\nSubstituto organico imperfeito reconstruido.`,
      `${implant} REMOVIDO\nA habilidade correspondente nao esta mais disponivel.`,
    ];
    const body = this.add.text(width / 2, height - 195, pages[0], {
      fontFamily: "Courier New, monospace", fontSize: "21px", color: "#e8ecff", align: "center",
      lineSpacing: 9, wordWrap: { width: 920 },
    }).setOrigin(0.5);
    const counter = this.add.text(width - 90, height - 48, "1/4", {
      fontFamily: "Courier New, monospace", fontSize: "15px", color: "#77809d",
    }).setOrigin(0.5);
    const advance = () => {
      if (this.finished) return;
      if (this.page < pages.length - 1) {
        AudioManager.playSfx(this, this.page >= 1 ? SFX.clinicTools : SFX.uiConfirm, { volume: 0.42 });
        this.page += 1;
        if (this.page === 2) AudioManager.startLoop(this, SFX.implant, { volume: 0.62 });
        body.setText(pages[this.page]);
        counter.setText(`${this.page + 1}/${pages.length}`);
        avatarHologram.setVisible(this.page >= 1);
        avatarCaption.setVisible(this.page >= 1);
        return;
      }
      this.finished = true;
      AudioManager.stopLoop(SFX.implant);
      const result = progression.completeBioprinting();
      if (!result) {
        this.scene.start("MenuScene");
        return;
      }
      const data = progression.get();
      const previewData = this.descentPreview
        ? { testMode: true, descentPreview: this.descentPreview }
        : {};
      if (result.finished) {
        this.scene.start("GameScene", {
          phaseId: "fase1",
          checkpointX: 0,
          checkpointY: 0,
          consolidatedCreditIds: [],
          wallet: 0,
          abilities: data.abilities,
          descent: true,
          ...previewData,
        } as GameSceneData);
      } else {
        this.scene.start("GameScene", {
          phaseId: result.nextPhaseId,
          checkpointX: 0,
          checkpointY: 0,
          consolidatedCreditIds: [],
          wallet: 0,
          abilities: data.abilities,
          descent: true,
          ...previewData,
        } as GameSceneData);
      }
    };
    this.advancePage = advance;
    this.input.on("pointerdown", advance);
    this.add.text(width / 2, height - 48, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#77809d",
    }).setOrigin(0.5);
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) this.advancePage?.();
    this.input$.postUpdate();
  }
}

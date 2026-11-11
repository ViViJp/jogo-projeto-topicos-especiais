import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";

const GATE_TEXTURE_KEY = "narrative-gate";

type GateChoice = "chrome" | "flesh";

interface GateSceneData {
  /** Acesso pelo seletor de fases; não cria snapshot nem altera o save. */
  testMode?: boolean;
}

export class GateScene extends Phaser.Scene {
  private input$!: InputManager;
  private selected: GateChoice = "chrome";
  private choiceTexts = new Map<GateChoice, Phaser.GameObjects.Text>();
  private choosing = false;
  private testMode = false;
  private previewNotice!: Phaser.GameObjects.Text;

  constructor() {
    super("GateScene");
  }

  init(data: GateSceneData): void {
    this.testMode = data.testMode ?? false;
  }

  preload(): void {
    if (!this.textures.exists(GATE_TEXTURE_KEY)) {
      this.load.image(
        GATE_TEXTURE_KEY,
        new URL("../assets/narrative/gate/portao.png", import.meta.url).href,
      );
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const gateY = 318;
    const gateHeight = 336;
    const choiceOffsetX = Math.min(220, width * 0.24);

    this.cameras.main.setBackgroundColor(0x100718);
    AudioManager.playBgm(this, BGM.gate, 0.35);
    this.input$ = new InputManager(this);
    this.selected = "chrome";
    this.choosing = false;
    this.choiceTexts.clear();

    const save = SaveState.load();
    if (!this.testMode && !save.hasPreGateSave()) save.createPreGateSave();

    this.add.rectangle(centerX, height / 2, width, height, 0x100718, 1);
    this.add.image(centerX, gateY, GATE_TEXTURE_KEY).setDisplaySize(288, gateHeight);
    this.add.text(centerX, 52, "O PORTÃO", {
      fontFamily: "Courier New, monospace",
      fontSize: "38px",
      color: "#7CFCEA",
      letterSpacing: 7,
    }).setOrigin(0.5);
    this.add.text(
      centerX,
      112,
      "A conversão final está pronta. O que ainda resta de Alex atravessará?",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "17px",
        color: "#c8cfe8",
        align: "center",
        wordWrap: { width: Math.min(width - 80, 820) },
      },
    ).setOrigin(0.5);

    this.createChoice("chrome", centerX - choiceOffsetX, "CHROME", "Aceitar a conversão completa");
    this.createChoice("flesh", centerX + choiceOffsetX, "FLESH", "Recusar e iniciar a descida");
    this.previewNotice = this.add.text(centerX, height - 92, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#ff9a4d",
      align: "center",
      wordWrap: { width: Math.min(width - 80, 900) },
    }).setOrigin(0.5);
    const controlsHelp = this.testMode
      ? "← → / DIRECIONAL escolher   ENTER / A confirmar   ESC / B voltar ao seletor"
      : "← → / DIRECIONAL escolher   ENTER / A confirmar";
    this.add.text(centerX, height - 42, controlsHelp, {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#565f80",
    }).setOrigin(0.5);
    this.updateSelection();

  }

  update(): void {
    if (this.testMode && this.input$.isCancelJustDown()) {
      this.scene.start("MenuScene");
      this.input$.postUpdate();
      return;
    }
    if (this.input$.isMenuLeftJustDown()) {
      this.selected = "chrome";
      this.updateSelection();
    } else if (this.input$.isMenuRightJustDown()) {
      this.selected = "flesh";
      this.updateSelection();
    } else if (this.input$.isMenuUpJustDown() || this.input$.isMenuDownJustDown()) {
      this.selected = this.selected === "chrome" ? "flesh" : "chrome";
      this.updateSelection();
    } else if (this.input$.isConfirmJustDown()) {
      this.confirmChoice();
    }
    this.input$.postUpdate();
  }

  private createChoice(choice: GateChoice, x: number, title: string, subtitle: string): void {
    const text = this.add.text(x, 545, `${title}\n${subtitle}`, {
      fontFamily: "Courier New, monospace",
      fontSize: "22px",
      color: "#e8ecff",
      align: "center",
      backgroundColor: "#0a0a14dd",
      padding: { x: 20, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    text.on("pointerover", () => {
      if (this.choosing) return;
      this.selected = choice;
      this.updateSelection();
    });
    text.on("pointerdown", () => {
      if (this.choosing) return;
      this.selected = choice;
      this.updateSelection();
      this.confirmChoice();
    });
    this.choiceTexts.set(choice, text);
  }

  private updateSelection(): void {
    this.choiceTexts.forEach((text, choice) => {
      const selected = choice === this.selected;
      text.setColor(selected ? "#FFD37C" : "#e8ecff");
      text.setScale(selected ? 1.06 : 1);
      text.setStroke(selected ? "#7CFCEA" : "#000000", selected ? 1 : 0);
    });
  }

  private confirmChoice(): void {
    if (this.choosing) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.42 });
    if (this.selected === "flesh") {
      if (this.testMode) {
        this.previewNotice.setText(
          "A descida Flesh altera a campanha. Inicie este caminho pelo Portão do seu save.",
        );
        this.cameras.main.shake(120, 0.002);
        return;
      }
      this.choosing = true;
      const save = SaveState.load();
      save.beginDescent();
      const data = save.get();
      if (!data.descentState.active) return;
      this.scene.start("GeorgeRefusalScene");
      return;
    }

    this.choosing = true;
    this.cameras.main.fadeOut(450, 0, 0, 0, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start("EndingScene", { ending: "chrome", testMode: this.testMode });
      }
    });
  }
}

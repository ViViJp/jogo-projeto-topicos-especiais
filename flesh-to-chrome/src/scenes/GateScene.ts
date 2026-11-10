import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

const GATE_TEXTURE_KEY = "narrative-gate";
const GATE_MUSIC_KEY = "bgm-gate";

type GateChoice = "chrome" | "flesh";

interface GateSceneData {
  /** Acesso pelo seletor de fases; não cria snapshot nem altera o save. */
  testMode?: boolean;
}

export class GateScene extends Phaser.Scene {
  private input$!: InputManager;
  private selected: GateChoice = "chrome";
  private choiceTexts = new Map<GateChoice, Phaser.GameObjects.Text>();
  private developmentNotice?: Phaser.GameObjects.Container;
  private choosing = false;
  private music?: Phaser.Sound.BaseSound;
  private testMode = false;

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
    if (!this.cache.audio.exists(GATE_MUSIC_KEY)) {
      this.load.audio(
        GATE_MUSIC_KEY,
        new URL("../assets/audio/music/bgm-portao.wav", import.meta.url).href,
      );
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);
    this.selected = "chrome";
    this.choosing = false;
    this.choiceTexts.clear();

    const save = SaveState.load();
    if (!this.testMode && !save.hasPreGateSave()) save.createPreGateSave();

    this.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x100718, 1);
    this.add.image(SCREEN_WIDTH / 2, 265, GATE_TEXTURE_KEY).setDisplaySize(320, 373);
    this.add.text(SCREEN_WIDTH / 2, 52, "O PORTÃO", {
      fontFamily: "Courier New, monospace",
      fontSize: "38px",
      color: "#7CFCEA",
      letterSpacing: 7,
    }).setOrigin(0.5);
    this.add.text(
      SCREEN_WIDTH / 2,
      105,
      "A conversão final está pronta. O que ainda resta de Alex atravessará?",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "17px",
        color: "#c8cfe8",
        align: "center",
      },
    ).setOrigin(0.5);

    this.createChoice("chrome", SCREEN_WIDTH / 2 - 220, "CHROME", "Aceitar a conversão completa");
    this.createChoice("flesh", SCREEN_WIDTH / 2 + 220, "FLESH", "Recusar e iniciar a descida");
    const controlsHelp = this.testMode
      ? "← → / DIRECIONAL escolher   ENTER / A confirmar   ESC / B voltar ao seletor"
      : "← → / DIRECIONAL escolher   ENTER / A confirmar";
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 42, controlsHelp, {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#565f80",
    }).setOrigin(0.5);
    this.updateSelection();

    this.music = this.sound.add(GATE_MUSIC_KEY, { loop: true, volume: 0.35 });
    this.music.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music?.stop());
  }

  update(): void {
    if (this.developmentNotice) {
      if (this.input$.isConfirmJustDown() || this.input$.isCancelJustDown()) {
        this.closeDevelopmentNotice();
      }
      this.input$.postUpdate();
      return;
    }
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
      if (this.developmentNotice || this.choosing) return;
      this.selected = choice;
      this.updateSelection();
    });
    text.on("pointerdown", () => {
      if (this.developmentNotice || this.choosing) return;
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
    if (this.choosing || this.developmentNotice) return;
    if (this.selected === "flesh") {
      const panel = this.add.rectangle(0, 0, 680, 330, 0x170b20, 0.97)
        .setStrokeStyle(2, 0x7cfcea, 0.75)
        // Captura cliques fora do botão e impede que alcancem Chrome/Flesh.
        .setInteractive();
      const message = this.add.text(
        0,
        -58,
        "CAMINHO FLESH\n\nConteúdo em desenvolvimento.\nA descida será implementada na próxima branch.",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "21px",
          color: "#e8ecff",
          align: "center",
        },
      ).setOrigin(0.5);
      const backButton = this.add.text(0, 102, "VOLTAR À ESCOLHA", {
        fontFamily: "Courier New, monospace",
        fontSize: "19px",
        color: "#071017",
        backgroundColor: "#7CFCEA",
        padding: { x: 18, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      backButton.on("pointerover", () => backButton.setBackgroundColor("#FFD37C"));
      backButton.on("pointerout", () => backButton.setBackgroundColor("#7CFCEA"));
      backButton.on("pointerdown", () => this.closeDevelopmentNotice());
      const controls = this.add.text(0, 148, "ENTER / A ou ESC / B também retornam", {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#8892b0",
      }).setOrigin(0.5);
      this.developmentNotice = this.add.container(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT / 2,
        [panel, message, backButton, controls],
      ).setDepth(20);
      return;
    }

    this.choosing = true;
    this.music?.stop();
    this.cameras.main.fadeOut(450, 0, 0, 0, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start("EndingScene", { ending: "chrome", testMode: this.testMode });
      }
    });
  }

  private closeDevelopmentNotice(): void {
    this.developmentNotice?.destroy();
    this.developmentNotice = undefined;
  }
}

import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { descentStepAt } from "../systems/DescentProgression";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";

export class DescentRetryScene extends Phaser.Scene {
  private input$!: InputManager;
  private retrySelected = true;
  private retryText!: Phaser.GameObjects.Text;
  private abandonText!: Phaser.GameObjects.Text;

  constructor() {
    super("DescentRetryScene");
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const choiceOffsetX = Math.min(210, width * 0.2);
    const step = descentStepAt(SaveState.load().get().descentState.currentStep);
    const lostMemory = step?.memoryTitle ?? "FRAGMENTO DESCONHECIDO";
    this.input$ = new InputManager(this);
    AudioManager.playBgm(this, BGM.gate, 0.24);
    this.retrySelected = true;
    this.cameras.main.setBackgroundColor(0x08050d);
    this.add.text(centerX, height * 0.215, `MEMORIA PERDIDA // ${lostMemory}`, {
      fontFamily: "Courier New, monospace", fontSize: "38px", color: "#ff71ce",
      align: "center", wordWrap: { width: Math.min(width - 80, 1_000) },
    }).setOrigin(0.5);
    this.add.text(
      centerX,
      height * 0.36,
      "Alex sente que esqueceu um dos motivos de estar descendo.\nEsta e a unica segunda oportunidade para recuperar o glitch.",
      {
        fontFamily: "Courier New, monospace", fontSize: "21px", color: "#e8ecff",
        align: "center", lineSpacing: 10, wordWrap: { width: Math.min(width - 100, 960) },
      },
    ).setOrigin(0.5);
    this.retryText = this.choice(centerX - choiceOffsetX, height * 0.63, "REPETIR SETOR\nCadeia ativa", true);
    this.abandonText = this.choice(centerX + choiceOffsetX, height * 0.63, "CONTINUAR\nAceitar Hollow", false);
    this.add.text(centerX, height - 55, "← → escolher   ENTER / A confirmar", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#77809d",
    }).setOrigin(0.5);
    this.renderChoice();
  }

  update(): void {
    if (this.input$.isMenuLeftJustDown()) {
      this.selectChoice(true);
    } else if (this.input$.isMenuRightJustDown()) {
      this.selectChoice(false);
    } else if (this.input$.isConfirmJustDown()) {
      this.confirmChoice();
    }
    this.input$.postUpdate();
  }

  private choice(x: number, y: number, label: string, retrySelected: boolean): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: "Courier New, monospace", fontSize: "22px", color: "#e8ecff", align: "center",
      backgroundColor: "#12101ddd", padding: { x: 24, y: 18 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    text.on("pointerover", () => this.selectChoice(retrySelected));
    text.on("pointerdown", () => {
      this.selectChoice(retrySelected);
      this.confirmChoice();
    });
    return text;
  }

  private selectChoice(retrySelected: boolean): void {
    this.retrySelected = retrySelected;
    this.renderChoice();
  }

  private confirmChoice(): void {
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.4 });
    const save = SaveState.load();
    if (this.retrySelected) {
      const data = save.get();
      this.scene.start("GameScene", {
        phaseId: data.currentPhaseId,
        checkpointX: 0,
        checkpointY: 0,
        consolidatedCreditIds: [],
        wallet: 0,
        abilities: data.abilities,
        descent: true,
      });
    } else {
      save.declineDescentRetry();
      this.scene.start("EpilogueScene", { ending: "hollow" });
    }
  }

  private renderChoice(): void {
    this.retryText.setColor(this.retrySelected ? "#FFD37C" : "#e8ecff").setScale(this.retrySelected ? 1.06 : 1);
    this.abandonText.setColor(!this.retrySelected ? "#FFD37C" : "#e8ecff").setScale(!this.retrySelected ? 1.06 : 1);
  }
}

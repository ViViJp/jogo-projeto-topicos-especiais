import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

export class DescentRetryScene extends Phaser.Scene {
  private input$!: InputManager;
  private retrySelected = true;
  private retryText!: Phaser.GameObjects.Text;
  private abandonText!: Phaser.GameObjects.Text;

  constructor() {
    super("DescentRetryScene");
  }

  create(): void {
    this.input$ = new InputManager(this);
    this.retrySelected = true;
    this.cameras.main.setBackgroundColor(0x08050d);
    this.add.text(SCREEN_WIDTH / 2, 155, "MEMORIA PERDIDA", {
      fontFamily: "Courier New, monospace", fontSize: "38px", color: "#ff71ce",
    }).setOrigin(0.5);
    this.add.text(
      SCREEN_WIDTH / 2,
      260,
      "Alex sente que esqueceu um dos motivos de estar descendo.\nEsta e a unica segunda oportunidade para recuperar o glitch.",
      { fontFamily: "Courier New, monospace", fontSize: "21px", color: "#e8ecff", align: "center", lineSpacing: 10 },
    ).setOrigin(0.5);
    this.retryText = this.choice(SCREEN_WIDTH / 2 - 210, "REPETIR SETOR\nCadeia ativa", true);
    this.abandonText = this.choice(SCREEN_WIDTH / 2 + 210, "CONTINUAR\nAceitar Hollow", false);
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 55, "← → escolher   ENTER / A confirmar", {
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

  private choice(x: number, label: string, retrySelected: boolean): Phaser.GameObjects.Text {
    const text = this.add.text(x, 455, label, {
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

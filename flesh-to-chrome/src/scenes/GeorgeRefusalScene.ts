import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { SaveState } from "../systems/SaveState";
import { DescentPreviewSession } from "../systems/DescentPreviewSession";
import type { GameSceneData } from "./GameScene";

const BACKGROUND_KEY = "george-refusal-background";
const GEORGE_ANGRY_KEY = "george-angry";
const ALEX_COMPLETE_KEY = "george-refusal-alex";

interface GeorgeRefusalSceneData {
  testMode?: boolean;
  descentPreview?: DescentPreviewSession;
}

const DIALOGUE = [
  {
    speaker: "GEORGE",
    text: "Você voltou do Portão sem atravessá-lo. Diga que foi uma falha do sistema.",
  },
  {
    speaker: "ALEX",
    text: "Eu recusei. Quando pediram o que ainda restava de mim, percebi que já não sabia por quem eu tinha subido.",
  },
  {
    speaker: "GEORGE",
    text: "Você chegou ao topo por causa deste corpo. Pernas, braços, olhos, propulsores — tudo funciona.",
  },
  {
    speaker: "ALEX",
    text: "Funciona para correr. Não para lembrar. Minha família, minha rua e meus amigos viraram ruído atrás do cromo.",
  },
  {
    speaker: "ALEX",
    text: "Eu subi para mudar a vida deles. Se preciso apagá-los para chegar ao topo, então o topo não vale o que tirei de mim.",
  },
  {
    speaker: "GEORGE",
    text: "Não vou desmontar minha maior obra por uma crise de consciência. Meu nome está em cada peça que coloquei em você.",
  },
  {
    speaker: "ALEX",
    text: "Eu não sou sua obra, George. Vou descer e recuperar cada motivo que deixei para trás.",
  },
  {
    speaker: "GEORGE",
    text: "A carne é fraca. Quando se arrepender, não haverá nada de mim para salvá-lo.",
  },
  {
    speaker: "ALEX",
    text: "É justamente isso que eu preciso.",
  },
] as const;

export class GeorgeRefusalScene extends Phaser.Scene {
  private input$!: InputManager;
  private pageIndex = 0;
  private finished = false;
  private speakerText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private george!: Phaser.GameObjects.Image;
  private alex!: Phaser.GameObjects.Image;
  private testMode = false;
  private descentPreview?: DescentPreviewSession;

  constructor() {
    super("GeorgeRefusalScene");
  }

  init(data: GeorgeRefusalSceneData): void {
    this.testMode = data.testMode ?? false;
    this.descentPreview = data.descentPreview;
  }

  preload(): void {
    if (!this.textures.exists(BACKGROUND_KEY)) {
      this.load.image(
        BACKGROUND_KEY,
        new URL("../assets/scenes/clinic/clinic-bg.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(GEORGE_ANGRY_KEY)) {
      this.load.image(
        GEORGE_ANGRY_KEY,
        new URL("../assets/npcs/george/george-angry/george-angry.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(ALEX_COMPLETE_KEY)) {
      this.load.image(
        ALEX_COMPLETE_KEY,
        new URL("../assets/player/alex-dialogue/alex-complete-dialogue.png", import.meta.url).href,
      );
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.finished = false;
    this.cameras.main.setBackgroundColor(0x08050c);
    AudioManager.playBgm(this, BGM.clinic, 0.28);

    this.add.image(width / 2, 235, BACKGROUND_KEY).setDisplaySize(width, 470);
    this.add.rectangle(width / 2, height - 145, width, 300, 0x08050c, 0.96);
    this.add.rectangle(width / 2, 65, 920, 105, 0x08050c, 0.88).setStrokeStyle(2, 0xd64f6f, 0.75);
    this.add.text(width / 2, 43, "A OBRA NÃO VOLTA ATRÁS", {
      fontFamily: "Courier New, monospace",
      fontSize: "31px",
      color: "#ff718f",
      letterSpacing: 4,
    }).setOrigin(0.5);
    this.add.text(width / 2, 86, "CLÍNICA DE GEORGE // APÓS O PORTÃO", {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#FFD37C",
      letterSpacing: 2,
    }).setOrigin(0.5);

    const portraitCenterY = 290;
    const portraitHeight = 280;
    this.george = this.add.image(width * 0.27, portraitCenterY, GEORGE_ANGRY_KEY)
      .setDisplaySize(280, portraitHeight);
    this.george.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.alex = this.add.image(width * 0.73, portraitCenterY, ALEX_COMPLETE_KEY)
      .setDisplaySize(187, portraitHeight);
    this.alex.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.speakerText = this.add.text(190, height - 245, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#7CFCEA",
    });
    this.dialogueText = this.add.text(190, height - 207, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "21px",
      color: "#e8ecff",
      wordWrap: { width: width - 380 },
      lineSpacing: 9,
    });
    this.counterText = this.add.text(width - 90, height - 45, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    const prompt = this.add.text(width / 2, height - 45, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.input.on("pointerdown", () => this.advance());
    this.renderPage();
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) this.advance();
    this.input$.postUpdate();
  }

  private renderPage(): void {
    const page = DIALOGUE[this.pageIndex];
    const georgeSpeaking = page.speaker === "GEORGE";
    this.speakerText.setText(page.speaker).setColor(georgeSpeaking ? "#ff718f" : "#7CFCEA");
    this.dialogueText.setText(page.text);
    this.counterText.setText(`${this.pageIndex + 1}/${DIALOGUE.length}`);
    this.george.setAlpha(georgeSpeaking ? 1 : 0.62);
    this.alex.setAlpha(georgeSpeaking ? 0.62 : 1);
  }

  private advance(): void {
    if (this.finished) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.34 });
    if (this.pageIndex < DIALOGUE.length - 1) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.finished = true;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data = this.testMode && this.descentPreview
        ? this.descentPreview.get()
        : SaveState.load().get();
      this.scene.start("GameScene", {
        phaseId: "fase5",
        testMode: this.testMode,
        checkpointX: 0,
        checkpointY: 0,
        consolidatedCreditIds: [],
        wallet: 0,
        abilities: data.abilities,
        descent: true,
        descentPreview: this.descentPreview,
      } as GameSceneData);
    });
    this.cameras.main.fadeOut(350, 0, 0, 0);
  }
}

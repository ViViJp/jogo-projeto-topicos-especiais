import Phaser from "phaser";
import { AbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import type { GameSceneData } from "./GameScene";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";

interface ClinicSceneData {
  completedPhaseId: string;
  nextPhaseId: string | null;
  wallet: number;
  abilities: AbilityState;
  implant?: keyof AbilityState;
  /** Prévia aberta ao concluir uma fase pelo seletor; nunca altera o save. */
  testMode?: boolean;
}

interface ClinicBeat {
  georgeAsset: "humble" | "rising" | "ambitious" | "proud";
  stageLabel: string;
  implant: keyof AbilityState;
  implantLabel: string;
  abilityLabel: string;
  pages: Array<{ speaker: string; text: string }>;
}

const CLINIC_BACKGROUND_KEY = "clinic-background";
const CLINIC_GEORGE_KEY = "clinic-george";

const BEATS: Record<string, ClinicBeat> = {
  fase1: {
    georgeAsset: "humble",
    stageLabel: "PRIMEIRO PROCEDIMENTO",
    implant: "legs",
    implantLabel: "pernas mecânicas",
    abilityLabel: "salto duplo",
    pages: [
      { speaker: "GEORGE", text: "Eu ainda não testei este encaixe em movimento contínuo. Há riscos, Alex." },
      { speaker: "ALEX", text: "Clínicas do topo não atendem gente daqui. Você é a opção que eu tenho." },
      { speaker: "GEORGE", text: "Então começamos pelas pernas. Se funcionar, nós dois subimos um degrau." },
    ],
  },
  "fase2-intro": {
    georgeAsset: "rising",
    stageLabel: "RESULTADOS VISÍVEIS",
    implant: "arms",
    implantLabel: "braços mecânicos",
    abilityLabel: "ataque e quebra",
    pages: [
      { speaker: "GEORGE", text: "As pernas resistiram melhor do que meus cálculos. Já perguntaram quem fez o procedimento." },
      { speaker: "ALEX", text: "Preciso atravessar as barricadas do próximo setor." },
      { speaker: "GEORGE", text: "Braços novos. Mais força para você, mais provas de que meu trabalho funciona." },
    ],
  },
  fase3: {
    georgeAsset: "ambitious",
    stageLabel: "UM NOME EM ASCENSÃO",
    implant: "eyes",
    implantLabel: "olhos mecânicos",
    abilityLabel: "scan e revelação",
    pages: [
      { speaker: "GEORGE", text: "Meu nome já circula no Distrito Corporativo. Seu corpo abriu portas que nunca se abririam para mim." },
      { speaker: "ALEX", text: "Eu não vim construir sua reputação. Vim encontrar meu pai." },
      { speaker: "GEORGE", text: "E estes olhos vão encontrá-lo. Imagine o que verão quando olharem para a minha obra." },
    ],
  },
  fase4: {
    georgeAsset: "proud",
    stageLabel: "A OBRA DE GEORGE VEKTOR",
    implant: "thrusters",
    implantLabel: "propulsores",
    abilityLabel: "dash",
    pages: [
      { speaker: "GEORGE", text: "Olhe para você. Cada setor superado leva a minha assinatura mais alto." },
      { speaker: "ALEX", text: "Falta apenas o topo." },
      { speaker: "GEORGE", text: "Não. Falta o acabamento da minha maior obra. Com estes propulsores, ninguém poderá ignorar o que criei." },
    ],
  },
};

export class ClinicScene extends Phaser.Scene {
  private data$!: ClinicSceneData;
  private input$!: InputManager;
  private beat!: ClinicBeat;
  private pageIndex = 0;
  private finished = false;
  private speakerText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private pageText!: Phaser.GameObjects.Text;

  constructor() {
    super("ClinicScene");
  }

  init(data: ClinicSceneData): void {
    this.data$ = data;
    const fallbackKey = data.implant ?? "legs";
    this.beat = BEATS[data.completedPhaseId] ?? {
      ...BEATS.fase1,
      implant: fallbackKey,
    };
  }

  preload(): void {
    if (!this.textures.exists(CLINIC_BACKGROUND_KEY)) {
      this.load.image(
        CLINIC_BACKGROUND_KEY,
        new URL("../assets/scenes/clinic/clinic-bg.png", import.meta.url).href,
      );
    }
    const georgeUrls: Record<ClinicBeat["georgeAsset"], URL> = {
      humble: new URL("../assets/npcs/george/george-clinic/george-clinic-01.png", import.meta.url),
      rising: new URL("../assets/npcs/george/george-clinic/george-clinic-02.png", import.meta.url),
      ambitious: new URL("../assets/npcs/george/george-clinic/george-clinic-03.png", import.meta.url),
      proud: new URL("../assets/npcs/george/george-proud/george-proud-clinic.png", import.meta.url),
    };
    if (this.textures.exists(CLINIC_GEORGE_KEY)) this.textures.remove(CLINIC_GEORGE_KEY);
    this.load.image(CLINIC_GEORGE_KEY, georgeUrls[this.beat.georgeAsset].href);
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    this.cameras.main.setBackgroundColor(0x120a1a);
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.finished = false;

    AudioManager.playBgm(this, BGM.clinic, 0.3);
    this.add.image(centerX, 250, CLINIC_BACKGROUND_KEY).setDisplaySize(width, 427);
    this.add.rectangle(centerX, height - 165, width, 330, 0x08050c, 0.94);
    this.add.rectangle(centerX, 65, Math.min(920, width - 80), 112, 0x08050c, 0.82).setDepth(3);
    this.add.image(centerX - Math.min(390, width * 0.31), 390, CLINIC_GEORGE_KEY).setDisplaySize(210, 210).setDepth(3);

    this.add.text(centerX, 45, "CLÍNICA DE GEORGE VEKTOR", {
      fontFamily: "Courier New, monospace",
      fontSize: "31px",
      color: "#e0a8ff",
    }).setOrigin(0.5).setDepth(4).setShadow(0, 2, "#000000", 6, true, true);
    this.add.text(centerX, 92, this.beat.stageLabel, {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#FFD37C",
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(4);

    const dialogueX = centerX - Math.min(220, width * 0.17);
    this.speakerText = this.add.text(dialogueX, 455, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#7CFCEA",
    });
    this.dialogueText = this.add.text(dialogueX, 490, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#e8ecff",
      wordWrap: { width: Math.min(740, width * 0.58) },
      lineSpacing: 8,
    });
    this.pageText = this.add.text(width - 95, height - 70, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    this.add.text(110, height - 70, `CARTEIRA ${this.data$.wallet} CR`, {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#FFD37C",
    }).setOrigin(0.5).setDepth(4);
    const prompt = this.add.text(centerX, height - 55, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.renderPage();
    this.input.on("pointerdown", () => this.advance());
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) this.advance();
    this.input$.postUpdate();
  }

  private renderPage(): void {
    const dialoguePages = this.beat.pages.length;
    if (this.pageIndex < dialoguePages) {
      const page = this.beat.pages[this.pageIndex];
      this.speakerText.setText(page.speaker);
      this.dialogueText.setText(page.text);
    } else {
      this.speakerText.setText("PROCEDIMENTO CONCLUÍDO");
      this.dialogueText.setText(
        `${this.beat.implantLabel.toUpperCase()} integrados com sucesso.\nHabilidade liberada: ${this.beat.abilityLabel}.`,
      );
      AudioManager.playSfx(this, SFX.implant, { volume: 0.6 });
    }
    this.pageText.setText(`${this.pageIndex + 1}/${dialoguePages + 1}`);
  }

  private advance(): void {
    if (this.finished) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.32 });
    if (this.pageIndex < this.beat.pages.length) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.finished = true;
    if (this.data$.testMode) {
      this.scene.start("MenuScene");
      return;
    }
    const save = SaveState.load();
    save.unlockAbility(this.beat.implant);
    const newAbilities: AbilityState = { ...this.data$.abilities, [this.beat.implant]: true };
    if (!this.data$.nextPhaseId) {
      this.scene.start("GateScene", { testMode: false });
      return;
    }
    save.setPhase(this.data$.nextPhaseId);
    this.scene.start("GameScene", {
      phaseId: this.data$.nextPhaseId,
      checkpointX: 0,
      checkpointY: 0,
      consolidatedCreditIds: [],
      wallet: this.data$.wallet,
      abilities: newAbilities,
    } as GameSceneData);
  }
}

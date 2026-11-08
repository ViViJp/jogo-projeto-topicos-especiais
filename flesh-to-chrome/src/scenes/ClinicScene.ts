import Phaser from "phaser";
import { SCREEN_WIDTH } from "../config/GameConfig";
import { AbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import type { GameSceneData } from "./GameScene";

interface ClinicSceneData {
  completedPhaseId: string;
  nextPhaseId: string | null;
  wallet: number;
  abilities: AbilityState;
  implant?: keyof AbilityState;
}

interface ClinicBeat {
  georgeAsset: "nervous" | "regular" | "proud";
  stageLabel: string;
  implant: keyof AbilityState;
  implantLabel: string;
  abilityLabel: string;
  pages: Array<{ speaker: string; text: string }>;
}

const CLINIC_BACKGROUND_KEY = "clinic-background";
const CLINIC_GEORGE_KEY = "clinic-george";
const CLINIC_MUSIC_KEY = "bgm-clinic-narrative";
const CLINIC_IMPLANT_SFX_KEY = "sfx-clinic-implant";

const BEATS: Record<string, ClinicBeat> = {
  fase1: {
    georgeAsset: "nervous",
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
    georgeAsset: "regular",
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
    georgeAsset: "regular",
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
  private music?: Phaser.Sound.BaseSound;

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
    const georgeUrl = this.beat.georgeAsset === "nervous"
      ? new URL("../assets/npcs/george/george-nervous/george-nervous.png", import.meta.url)
      : this.beat.georgeAsset === "proud"
        ? new URL("../assets/npcs/george/george-proud/george-proud-clinic.png", import.meta.url)
        : new URL("../assets/npcs/george/george/george.png", import.meta.url);
    if (this.textures.exists(CLINIC_GEORGE_KEY)) this.textures.remove(CLINIC_GEORGE_KEY);
    this.load.spritesheet(CLINIC_GEORGE_KEY, georgeUrl.href, {
      frameWidth: 64,
      frameHeight: 64,
    });
    if (!this.cache.audio.exists(CLINIC_MUSIC_KEY)) {
      this.load.audio(
        CLINIC_MUSIC_KEY,
        new URL("../assets/audio/music/bgm-clinic.wav", import.meta.url).href,
      );
    }
    if (!this.cache.audio.exists(CLINIC_IMPLANT_SFX_KEY)) {
      this.load.audio(
        CLINIC_IMPLANT_SFX_KEY,
        new URL("../assets/audio/sfx/sfx-implant.wav", import.meta.url).href,
      );
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x120a1a);
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.finished = false;

    this.add.image(SCREEN_WIDTH / 2, 215, CLINIC_BACKGROUND_KEY).setDisplaySize(1280, 427);
    this.add.rectangle(SCREEN_WIDTH / 2, 555, SCREEN_WIDTH, 330, 0x08050c, 0.94);
    const georgeFrame = this.beat.georgeAsset === "proud" ? 0 : 26;
    this.add.sprite(250, 390, CLINIC_GEORGE_KEY, georgeFrame).setScale(2.35).setDepth(3);

    this.add.text(SCREEN_WIDTH / 2, 45, "CLÍNICA DE GEORGE VEKTOR", {
      fontFamily: "Courier New, monospace",
      fontSize: "31px",
      color: "#e0a8ff",
    }).setOrigin(0.5).setDepth(4);
    this.add.text(SCREEN_WIDTH / 2, 92, this.beat.stageLabel, {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#FFD37C",
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(4);

    this.speakerText = this.add.text(420, 455, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#7CFCEA",
    });
    this.dialogueText = this.add.text(420, 490, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#e8ecff",
      wordWrap: { width: 740 },
      lineSpacing: 8,
    });
    this.pageText = this.add.text(SCREEN_WIDTH - 95, 650, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    this.add.text(110, 650, `CARTEIRA ${this.data$.wallet} CR`, {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#FFD37C",
    }).setOrigin(0.5).setDepth(4);
    const prompt = this.add.text(SCREEN_WIDTH / 2, 665, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.music = this.sound.add(CLINIC_MUSIC_KEY, { loop: true, volume: 0.3 });
    this.music.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music?.stop());
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
      this.sound.play(CLINIC_IMPLANT_SFX_KEY, { volume: 0.55 });
    }
    this.pageText.setText(`${this.pageIndex + 1}/${dialoguePages + 1}`);
  }

  private advance(): void {
    if (this.finished) return;
    if (this.pageIndex < this.beat.pages.length) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.finished = true;
    const save = SaveState.load();
    save.unlockAbility(this.beat.implant);
    const newAbilities: AbilityState = { ...this.data$.abilities, [this.beat.implant]: true };
    if (!this.data$.nextPhaseId) {
      this.scene.start("GateScene");
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

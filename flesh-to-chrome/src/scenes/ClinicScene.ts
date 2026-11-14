import Phaser from "phaser";
import {
  GAMEPAD_BINDING_LABELS,
  keyboardBindingLabel,
  type GameplayControlAction,
} from "../config/Controls";
import { drawTechPanel } from "../objects/MenuBackdrop";
import { AbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import {
  ALEX_ARMS_TEXTURE_KEY,
  ALEX_DASH_TEXTURE_KEY,
  ALEX_EYES_TEXTURE_KEY,
  ALEX_LEGS_TEXTURE_KEY,
  ALEX_SHEET_CONFIG,
  alexAttackAnimationKey,
  alexRunAnimationKey,
  alexTextureForAbilities,
  ensureAlexCoreAnimations,
} from "../utils/AlexSprite";
import type { GameSceneData } from "./GameScene";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { startLoadingTransition } from "../systems/SceneTransition";

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

interface ImplantTutorial {
  implantName: string;
  abilityName: string;
  description: string;
  action: Extract<GameplayControlAction, "jump" | "attack" | "scan" | "dash">;
}

const IMPLANT_TUTORIALS: Record<keyof AbilityState, ImplantTutorial> = {
  legs: {
    implantName: "PERNAS MECÂNICAS",
    abilityName: "SALTO DUPLO",
    description: "Salte novamente enquanto estiver no ar para alcançar plataformas mais altas.",
    action: "jump",
  },
  arms: {
    implantName: "BRAÇOS MECÂNICOS",
    abilityName: "ATAQUE",
    description: "Utilize seus braços para destruir obstáculos e derrotar inimigos.",
    action: "attack",
  },
  eyes: {
    implantName: "OLHOS MECÂNICOS",
    abilityName: "SCAN",
    description: "Emita um pulso para revelar perigos, passagens e estruturas ocultas.",
    action: "scan",
  },
  thrusters: {
    implantName: "PROPULSORES",
    abilityName: "DASH",
    description: "Avance em alta velocidade para atravessar janelas curtas de perigo.",
    action: "dash",
  },
};

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
  private promptText!: Phaser.GameObjects.Text;
  private tutorialSprite?: Phaser.GameObjects.Sprite;

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
    AudioManager.preloadBgm(this, BGM.clinic);
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

    const tutorialTextureKey = this.tutorialTextureKey();
    const alexUrls: Record<string, URL> = {
      [ALEX_LEGS_TEXTURE_KEY]: new URL("../assets/player/alex-legs/alex-legs.png", import.meta.url),
      [ALEX_ARMS_TEXTURE_KEY]: new URL("../assets/player/alex-arms/alex-arms.png", import.meta.url),
      [ALEX_EYES_TEXTURE_KEY]: new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url),
      [ALEX_DASH_TEXTURE_KEY]: new URL("../assets/player/alex-dash/alex-dash.png", import.meta.url),
    };
    if (!this.textures.exists(tutorialTextureKey)) {
      this.load.spritesheet(tutorialTextureKey, alexUrls[tutorialTextureKey].href, ALEX_SHEET_CONFIG);
    }
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
    this.promptText = this.add.text(centerX, height - 55, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: this.promptText, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.renderPage();
    this.input.on("pointerdown", () => {
      // Na página de tutorial, o clique precisa atingir explicitamente o
      // botão Continuar para evitar que a instrução seja pulada por engano.
      if (this.pageIndex < this.beat.pages.length) this.advance();
    });
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
      this.showImplantTutorial();
      AudioManager.startLoop(this, SFX.implant, { volume: 0.6 });
    }
    this.pageText.setText(`${this.pageIndex + 1}/${dialoguePages + 1}`);
  }

  private tutorialTextureKey(): string {
    const acquiredAbilities: AbilityState = {
      ...this.data$.abilities,
      [this.beat.implant]: true,
    };
    return alexTextureForAbilities(acquiredAbilities);
  }

  private showImplantTutorial(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const tutorial = IMPLANT_TUTORIALS[this.beat.implant];
    const panelWidth = Math.min(940, width - 64);
    const panelHeight = Math.min(520, height - 170);
    const panelX = centerX - panelWidth / 2;
    const panelY = 132;

    this.speakerText.setVisible(false);
    this.dialogueText.setVisible(false);
    this.promptText.setVisible(false);
    drawTechPanel(this, panelX, panelY, panelWidth, panelHeight, 6, 0x36e2ff);

    this.add.text(centerX, panelY + 34, "NOVO IMPLANTE INSTALADO", {
      fontFamily: "Courier New, monospace",
      fontSize: "27px",
      color: "#7CFCEA",
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(7).setShadow(0, 0, "#36e2ff", 8, true, true);
    this.add.text(centerX, panelY + 76, tutorial.implantName, {
      fontFamily: "Courier New, monospace",
      fontSize: "21px",
      color: "#FFD37C",
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(7);

    const textureKey = this.tutorialTextureKey();
    ensureAlexCoreAnimations(this, textureKey);
    const spriteBaseline = panelY + 218;
    this.tutorialSprite = this.add.sprite(centerX, spriteBaseline, textureKey)
      .setOrigin(0.5, 1)
      .setScale(1.85)
      .setDepth(8);
    this.tutorialSprite.play(alexRunAnimationKey(textureKey));
    this.startTutorialAnimation(tutorial.action, centerX, spriteBaseline, textureKey);

    this.add.text(centerX, panelY + 250, `HABILIDADE: ${tutorial.abilityName}`, {
      fontFamily: "Courier New, monospace",
      fontSize: "19px",
      color: "#e8ecff",
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(7);
    this.add.text(centerX, panelY + 290, tutorial.description, {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#c8cfe8",
      align: "center",
      wordWrap: { width: panelWidth - 150 },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setDepth(7);

    const commandY = panelY + 360;
    const commandWidth = Math.min(350, (panelWidth - 72) / 2);
    this.createCommandPanel(centerX - commandWidth - 12, commandY, commandWidth, "TECLADO", keyboardBindingLabel(tutorial.action));
    this.createCommandPanel(centerX + 12, commandY, commandWidth, "CONTROLE", GAMEPAD_BINDING_LABELS[tutorial.action]);

    drawTechPanel(this, centerX - 138, panelY + 440, 276, 52, 7, 0xffd37c);
    this.add.text(centerX, panelY + 466, "CONTINUAR ▶", {
      fontFamily: "Courier New, monospace",
      fontSize: "17px",
      color: "#FFD37C",
      padding: { x: 58, y: 14 },
    }).setOrigin(0.5).setDepth(8).setInteractive({ useHandCursor: true })
      .on("pointerover", function (this: Phaser.GameObjects.Text) { this.setColor("#ffffff"); })
      .on("pointerout", function (this: Phaser.GameObjects.Text) { this.setColor("#FFD37C"); })
      .on("pointerdown", () => this.advance());
  }

  private createCommandPanel(
    x: number,
    y: number,
    width: number,
    label: string,
    command: string,
  ): void {
    drawTechPanel(this, x, y, width, 58, 7, 0x5b7894);
    this.add.text(x + 18, y + 29, `${label}:`, {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#7CFCEA",
    }).setOrigin(0, 0.5).setDepth(8);
    this.add.text(x + width - 18, y + 29, command, {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#ffffff",
    }).setOrigin(1, 0.5).setDepth(8);
  }

  private startTutorialAnimation(
    action: ImplantTutorial["action"],
    centerX: number,
    baseline: number,
    textureKey: string,
  ): void {
    const sprite = this.tutorialSprite!;
    if (action === "attack") {
      const demonstrate = () => sprite.play(alexAttackAnimationKey(textureKey), true);
      demonstrate();
      this.time.addEvent({ delay: 1_100, loop: true, callback: demonstrate });
      return;
    }
    if (action === "jump") {
      const demonstrate = () => {
        sprite.setPosition(centerX, baseline);
        this.tweens.add({
          targets: sprite,
          y: baseline - 42,
          duration: 210,
          yoyo: true,
          ease: "Sine.easeOut",
          onComplete: () => this.tweens.add({
            targets: sprite,
            y: baseline - 62,
            duration: 190,
            yoyo: true,
            ease: "Sine.easeOut",
          }),
        });
      };
      demonstrate();
      this.time.addEvent({ delay: 1_650, loop: true, callback: demonstrate });
      return;
    }
    if (action === "scan") {
      const demonstrate = () => {
        const ring = this.add.circle(centerX, baseline - 52, 16, 0x36e2ff, 0.08)
          .setStrokeStyle(3, 0x36e2ff, 0.95)
          .setDepth(7);
        sprite.setTint(0x9ffcff);
        this.tweens.add({
          targets: ring,
          radius: 105,
          alpha: 0,
          duration: 750,
          ease: "Cubic.easeOut",
          onComplete: () => {
            ring.destroy();
            sprite.clearTint();
          },
        });
      };
      demonstrate();
      this.time.addEvent({ delay: 1_300, loop: true, callback: demonstrate });
      return;
    }

    const demonstrate = () => {
      sprite.setPosition(centerX - 55, baseline);
      for (let index = 0; index < 4; index += 1) {
        const trail = this.add.rectangle(centerX - 68 - index * 13, baseline - 42, 18, 5, 0x36e2ff, 0.7)
          .setDepth(7);
        this.tweens.add({
          targets: trail,
          x: trail.x - 30,
          alpha: 0,
          duration: 300,
          delay: index * 35,
          onComplete: () => trail.destroy(),
        });
      }
      this.tweens.add({
        targets: sprite,
        x: centerX + 70,
        duration: 230,
        ease: "Cubic.easeOut",
      });
    };
    demonstrate();
    this.time.addEvent({ delay: 1_250, loop: true, callback: demonstrate });
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
    AudioManager.stopLoop(SFX.implant);
    if (this.data$.testMode) {
      this.scene.start("MenuScene");
      return;
    }
    const save = SaveState.load();
    save.unlockAbility(this.beat.implant);
    const newAbilities: AbilityState = { ...this.data$.abilities, [this.beat.implant]: true };
    if (!this.data$.nextPhaseId) {
      startLoadingTransition(this, "GateScene", { testMode: false });
      return;
    }
    save.setPhase(this.data$.nextPhaseId);
    startLoadingTransition(this, "GameScene", {
      phaseId: this.data$.nextPhaseId,
      checkpointX: 0,
      checkpointY: 0,
      consolidatedCreditIds: [],
      wallet: this.data$.wallet,
      abilities: newAbilities,
    } as GameSceneData);
  }
}

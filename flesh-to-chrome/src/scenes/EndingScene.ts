import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import {
  AbilityState,
  abilityStateToBodyStage,
  createInitialAbilityState,
} from "../systems/AbilityState";
import {
  ALEX_ARMS_TEXTURE_KEY,
  ALEX_DASH_TEXTURE_KEY,
  ALEX_EYES_TEXTURE_KEY,
  ALEX_LEGS_TEXTURE_KEY,
  ALEX_SHEET_CONFIG,
  ALEX_TEXTURE_KEY,
  alexTextureForAbilities,
} from "../utils/AlexSprite";

const FAMILY_PORTRAIT_KEY = "ending-family";
const CHROME_EPILOGUE_KEY = "ending-chrome-father-son";
const ALEX_FLESH_KEY = "ending-alex-flesh";

interface EndingPage {
  title: string;
  body: string;
  portraitVisible: boolean;
  alexVisible: boolean;
}

interface EndingSceneData {
  ending?: EndingKind;
  /** Prévia iniciada pelo seletor; nunca registra o final no save. */
  testMode?: boolean;
  /** Estado corporal transitório usado especialmente pelo Final Hollow. */
  abilities?: AbilityState;
}

const CHROME_PAGES: EndingPage[] = [
  {
    title: "CONVERSÃO COMPLETA",
    body: "O Portão substitui o que ainda restava.\nMemórias, reflexos e identidade são comprimidos em um corpo cromado perfeito.",
    portraitVisible: false,
    alexVisible: true,
  },
  {
    title: "NO TOPO DE GLITCH CITY",
    body: "Entre as figuras que celebram a nova máquina, um homem para.\nEle reconhece o cabelo, o nome e o filho que deixou nos níveis inferiores.",
    portraitVisible: true,
    alexVisible: true,
  },
  {
    title: "— ALEX? FILHO?",
    body: "O pai chama seu nome.\nAlex procura a voz nos registros disponíveis. Nenhuma correspondência é encontrada.",
    portraitVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL CHROME",
    body: "Alex continua andando.\nChegou ao lugar que perseguiu — incapaz de reconhecer aquilo que o fez começar.",
    portraitVisible: false,
    alexVisible: true,
  },
];

const FLESH_PAGES: EndingPage[] = [
  {
    title: "DE VOLTA A CARNE",
    body: "As partes bioprintadas doem e carregam cicatrizes.\nPela primeira vez, a dor pertence novamente a Alex.",
    portraitVisible: false,
    alexVisible: true,
  },
  {
    title: "A LUZ DE CASA",
    body: "A porta se abre. Sua familia nao encontra o homem que partiu,\nmas reconhece a voz que decidiu voltar.",
    portraitVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL FLESH",
    body: "Alex nao recuperou o corpo original. Recuperou a possibilidade de estar presente.\nImperfeito, humano e em casa.",
    portraitVisible: true,
    alexVisible: true,
  },
];

const HOLLOW_PAGES: EndingPage[] = [
  {
    title: "A CADEIA QUEBRADA",
    body: "Uma memoria ficou para tras. Sem ela, os glitches seguintes silenciaram\ne o cromo restante se tornou impossivel de abandonar.",
    portraitVisible: false,
    alexVisible: true,
  },
  {
    title: "DO OUTRO LADO DA PORTA",
    body: "Alex ouve sua familia. Tenta responder, mas nenhuma palavra atravessa\na distancia entre a lembranca e aquilo que ele se tornou.",
    portraitVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL HOLLOW",
    body: "Ele voltou, parcialmente mecanizado, sem conseguir se reconectar.\nA casa esta diante dele. O caminho terminou antes da chegada.",
    portraitVisible: true,
    alexVisible: true,
  },
];

type EndingKind = "chrome" | "flesh" | "hollow";

export class EndingScene extends Phaser.Scene {
  private input$!: InputManager;
  private pageIndex = 0;
  private returning = false;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private portraitCaption!: Phaser.GameObjects.Text;
  private chromeIllustration!: Phaser.GameObjects.Image;
  private alex?: Phaser.GameObjects.Sprite;
  private alexCaption!: Phaser.GameObjects.Text;
  private ending: EndingKind = "chrome";
  private pages: EndingPage[] = CHROME_PAGES;
  private testMode = false;
  private previewAbilities?: AbilityState;

  constructor() {
    super("EndingScene");
  }

  init(data: EndingSceneData): void {
    this.ending = data.ending ?? "chrome";
    this.pages = this.ending === "flesh" ? FLESH_PAGES : this.ending === "hollow" ? HOLLOW_PAGES : CHROME_PAGES;
    this.testMode = data.testMode ?? false;
    this.previewAbilities = data.abilities;
  }

  preload(): void {
    if (!this.textures.exists(CHROME_EPILOGUE_KEY)) {
      this.load.image(
        CHROME_EPILOGUE_KEY,
        new URL("../assets/narrative/endings/chrome-father-son.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(FAMILY_PORTRAIT_KEY)) {
      this.load.image(
        FAMILY_PORTRAIT_KEY,
        new URL("../assets/narrative/prologue/familia.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(ALEX_FLESH_KEY)) {
      this.load.spritesheet(
        ALEX_FLESH_KEY,
        new URL("../assets/player/alex-flesh-happy/alex-flesh-happy.png", import.meta.url).href,
        { frameWidth: 64, frameHeight: 64 },
      );
    }
    const hollowStages = [
      { key: ALEX_TEXTURE_KEY, url: new URL("../assets/player/alex-flesh/alex-flesh.png", import.meta.url) },
      { key: ALEX_LEGS_TEXTURE_KEY, url: new URL("../assets/player/alex-legs/alex-legs.png", import.meta.url) },
      { key: ALEX_ARMS_TEXTURE_KEY, url: new URL("../assets/player/alex-arms/alex-arms.png", import.meta.url) },
      { key: ALEX_EYES_TEXTURE_KEY, url: new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url) },
      { key: ALEX_DASH_TEXTURE_KEY, url: new URL("../assets/player/alex-dash/alex-dash.png", import.meta.url) },
    ];
    for (const stage of hollowStages) {
      if (!this.textures.exists(stage.key)) {
        this.load.spritesheet(stage.key, stage.url.href, ALEX_SHEET_CONFIG);
      }
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const panelHeight = Math.min(610, height - 110);
    const panelTop = (height - panelHeight) / 2;
    const visualY = panelTop + 195;
    this.cameras.main.setBackgroundColor(0x05050a);
    AudioManager.playBgm(this, BGM.gate, 0.28);
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.returning = false;

    this.add.rectangle(centerX, height / 2, Math.min(1120, width - 80), panelHeight, 0x0c0d18, 1)
      .setStrokeStyle(2, 0xffd37c, 0.42);
    this.add.text(centerX, panelTop + 24, "EPÍLOGO", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#565f80",
      letterSpacing: 5,
    }).setOrigin(0.5);

    this.chromeIllustration = this.add.image(centerX, visualY, CHROME_EPILOGUE_KEY)
      .setDisplaySize(480, 270)
      .setVisible(this.ending === "chrome");
    this.chromeIllustration.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    this.portrait = this.add.image(centerX - 170, visualY, FAMILY_PORTRAIT_KEY);
    this.portrait.setDisplaySize(307, 192);
    this.portrait.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.portraitCaption = this.add.text(
      centerX - 170,
      visualY + 110,
      "FAMÍLIA DE ALEX // CASA",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#FFD37C",
        backgroundColor: "#080812dd",
        padding: { x: 7, y: 4 },
      },
    ).setOrigin(0.5);
    const abilities = this.testMode
      ? this.previewAbilities ?? createInitialAbilityState()
      : SaveState.load().get().abilities;
    const remainingImplants = abilityStateToBodyStage(abilities);
    if (this.ending !== "chrome") {
      const alexTexture = this.ending === "flesh"
        ? ALEX_FLESH_KEY
        : alexTextureForAbilities(abilities);
      this.alex = this.add.sprite(centerX + 140, visualY + 36, alexTexture, 26)
        .setScale(3.2);
      if (this.ending === "hollow") this.alex.setTint(0xc7b8d0);
    }
    this.alexCaption = this.add.text(
      centerX + 140,
      visualY + 120,
      this.ending === "hollow"
        ? `CROMO REMANESCENTE // ${remainingImplants} IMPLANTE${remainingImplants === 1 ? "" : "S"}`
        : "",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#b7a7c4",
        backgroundColor: "#080812dd",
        padding: { x: 7, y: 4 },
      },
    ).setOrigin(0.5).setVisible(this.ending === "hollow");
    this.title = this.add.text(centerX, panelTop + 355, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "30px",
      color: "#7CFCEA",
      align: "center",
    }).setOrigin(0.5);
    this.body = this.add.text(centerX, panelTop + 450, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#e8ecff",
      align: "center",
      lineSpacing: 9,
      wordWrap: { width: Math.min(width - 160, 960) },
    }).setOrigin(0.5);
    this.counter = this.add.text(width - 100, height - 45, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    const prompt = this.add.text(centerX, height - 45, "ENTER / A para continuar", {
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
    const page = this.pages[this.pageIndex];
    const isChrome = this.ending === "chrome";
    this.title.setText(page.title);
    this.body.setText(page.body);
    this.chromeIllustration.setVisible(isChrome && page.alexVisible);
    this.portrait.setVisible(!isChrome && page.portraitVisible);
    this.portraitCaption.setVisible(!isChrome && page.portraitVisible);
    this.alex?.setVisible(!isChrome && page.alexVisible);
    this.alexCaption.setVisible(this.ending === "hollow" && page.alexVisible);
    this.counter.setText(`${this.pageIndex + 1}/${this.pages.length}`);
  }

  private advance(): void {
    if (this.returning) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.34 });
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.returning = true;
    // A escolha só se torna um final concluído depois que o jogador viu e
    // confirmou o último quadro. Fechar o jogo antes disso mantém o Portão
    // disponível e a prévia do seletor nunca escreve no save.
    if (!this.testMode) SaveState.load().markEndingReached(this.ending);
    this.scene.start("MenuScene");
  }
}

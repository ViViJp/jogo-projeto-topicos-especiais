import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

const FATHER_PORTRAIT_KEY = "ending-father";
const ALEX_CHROME_KEY = "ending-alex-chrome";
const ALEX_FLESH_KEY = "ending-alex-flesh";
const ALEX_HOLLOW_KEY = "ending-alex-hollow";
const ENDING_MUSIC_KEY = "bgm-ending-chrome";

interface EndingPage {
  title: string;
  body: string;
  fatherVisible: boolean;
  alexVisible: boolean;
}

interface EndingSceneData {
  ending?: EndingKind;
  /** Prévia iniciada pelo seletor; nunca registra o final no save. */
  testMode?: boolean;
}

const CHROME_PAGES: EndingPage[] = [
  {
    title: "CONVERSÃO COMPLETA",
    body: "O Portão substitui o que ainda restava.\nMemórias, reflexos e identidade são comprimidos em um corpo cromado perfeito.",
    fatherVisible: false,
    alexVisible: true,
  },
  {
    title: "NO TOPO DE GLITCH CITY",
    body: "Entre as figuras que celebram a nova máquina, um homem para.\nEle reconhece o cabelo, o nome e o filho que deixou nos níveis inferiores.",
    fatherVisible: true,
    alexVisible: true,
  },
  {
    title: "— ALEX? FILHO?",
    body: "O pai chama seu nome.\nAlex procura a voz nos registros disponíveis. Nenhuma correspondência é encontrada.",
    fatherVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL CHROME",
    body: "Alex continua andando.\nChegou ao lugar que perseguiu — incapaz de reconhecer aquilo que o fez começar.",
    fatherVisible: false,
    alexVisible: true,
  },
];

const FLESH_PAGES: EndingPage[] = [
  {
    title: "DE VOLTA A CARNE",
    body: "As partes bioprintadas doem e carregam cicatrizes.\nPela primeira vez, a dor pertence novamente a Alex.",
    fatherVisible: false,
    alexVisible: true,
  },
  {
    title: "A LUZ DE CASA",
    body: "A porta se abre. Sua familia nao encontra o homem que partiu,\nmas reconhece a voz que decidiu voltar.",
    fatherVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL FLESH",
    body: "Alex nao recuperou o corpo original. Recuperou a possibilidade de estar presente.\nImperfeito, humano e em casa.",
    fatherVisible: true,
    alexVisible: true,
  },
];

const HOLLOW_PAGES: EndingPage[] = [
  {
    title: "A CADEIA QUEBRADA",
    body: "Uma memoria ficou para tras. Sem ela, os glitches seguintes silenciaram\ne o cromo restante se tornou impossivel de abandonar.",
    fatherVisible: false,
    alexVisible: true,
  },
  {
    title: "DO OUTRO LADO DA PORTA",
    body: "Alex ouve sua familia. Tenta responder, mas nenhuma palavra atravessa\na distancia entre a lembranca e aquilo que ele se tornou.",
    fatherVisible: true,
    alexVisible: true,
  },
  {
    title: "FINAL HOLLOW",
    body: "Ele voltou, parcialmente mecanizado, sem conseguir se reconectar.\nA casa esta diante dele. O caminho terminou antes da chegada.",
    fatherVisible: true,
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
  private father!: Phaser.GameObjects.Image;
  private fatherCaption!: Phaser.GameObjects.Text;
  private alex!: Phaser.GameObjects.Sprite;
  private music?: Phaser.Sound.BaseSound;
  private ending: EndingKind = "chrome";
  private pages: EndingPage[] = CHROME_PAGES;
  private testMode = false;

  constructor() {
    super("EndingScene");
  }

  init(data: EndingSceneData): void {
    this.ending = data.ending ?? "chrome";
    this.pages = this.ending === "flesh" ? FLESH_PAGES : this.ending === "hollow" ? HOLLOW_PAGES : CHROME_PAGES;
    this.testMode = data.testMode ?? false;
  }

  preload(): void {
    if (!this.textures.exists(FATHER_PORTRAIT_KEY)) {
      this.load.image(
        FATHER_PORTRAIT_KEY,
        new URL("../assets/narrative/father/pai-portrait.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(ALEX_CHROME_KEY)) {
      this.load.spritesheet(
        ALEX_CHROME_KEY,
        new URL("../assets/player/alex-chrome/alex-chrome.png", import.meta.url).href,
        { frameWidth: 64, frameHeight: 64 },
      );
    }
    if (!this.textures.exists(ALEX_FLESH_KEY)) {
      this.load.spritesheet(
        ALEX_FLESH_KEY,
        new URL("../assets/player/alex-flesh-happy/alex-flesh-happy.png", import.meta.url).href,
        { frameWidth: 64, frameHeight: 64 },
      );
    }
    if (!this.textures.exists(ALEX_HOLLOW_KEY)) {
      this.load.spritesheet(
        ALEX_HOLLOW_KEY,
        new URL("../assets/player/alex-hollow/alex-hollow.png", import.meta.url).href,
        { frameWidth: 64, frameHeight: 64 },
      );
    }
    if (!this.cache.audio.exists(ENDING_MUSIC_KEY)) {
      this.load.audio(
        ENDING_MUSIC_KEY,
        new URL("../assets/audio/music/bgm-portao.wav", import.meta.url).href,
      );
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.returning = false;

    this.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 1120, 610, 0x0c0d18, 1)
      .setStrokeStyle(2, 0xffd37c, 0.42);
    this.add.text(SCREEN_WIDTH / 2, 52, "EPÍLOGO", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#565f80",
      letterSpacing: 5,
    }).setOrigin(0.5);

    this.father = this.add.image(SCREEN_WIDTH / 2 - 170, 250, FATHER_PORTRAIT_KEY)
      .setDisplaySize(192, 192);
    this.father.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.fatherCaption = this.add.text(
      SCREEN_WIDTH / 2 - 170,
      360,
      this.ending === "chrome" ? "PAI DE ALEX // CONVERSÃO CORPORATIVA" : "FAMÍLIA DE ALEX // CASA",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#FFD37C",
        backgroundColor: "#080812dd",
        padding: { x: 7, y: 4 },
      },
    ).setOrigin(0.5);
    const alexTexture = this.ending === "flesh" ? ALEX_FLESH_KEY : this.ending === "hollow" ? ALEX_HOLLOW_KEY : ALEX_CHROME_KEY;
    this.alex = this.add.sprite(SCREEN_WIDTH / 2 + 140, 286, alexTexture, 26)
      .setScale(3.2);
    this.title = this.add.text(SCREEN_WIDTH / 2, 410, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "30px",
      color: "#7CFCEA",
      align: "center",
    }).setOrigin(0.5);
    this.body = this.add.text(SCREEN_WIDTH / 2, 505, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#e8ecff",
      align: "center",
      lineSpacing: 9,
      wordWrap: { width: 960 },
    }).setOrigin(0.5);
    this.counter = this.add.text(SCREEN_WIDTH - 100, SCREEN_HEIGHT - 45, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    const prompt = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 45, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.music = this.sound.add(ENDING_MUSIC_KEY, { loop: true, volume: 0.28 });
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
    const page = this.pages[this.pageIndex];
    this.title.setText(page.title);
    this.body.setText(page.body);
    this.father.setVisible(page.fatherVisible);
    this.fatherCaption.setVisible(page.fatherVisible);
    this.alex.setVisible(page.alexVisible);
    this.counter.setText(`${this.pageIndex + 1}/${this.pages.length}`);
    if (this.pageIndex === this.pages.length - 1 && this.ending === "chrome") {
      this.tweens.add({ targets: this.alex, x: SCREEN_WIDTH + 150, duration: 3000, ease: "Sine.easeIn" });
    }
  }

  private advance(): void {
    if (this.returning) return;
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

import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

const FATHER_PORTRAIT_KEY = "ending-father";
const ALEX_CHROME_KEY = "ending-alex-chrome";
const ENDING_MUSIC_KEY = "bgm-ending-chrome";

interface EndingPage {
  title: string;
  body: string;
  fatherVisible: boolean;
  alexVisible: boolean;
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

export class EndingScene extends Phaser.Scene {
  private input$!: InputManager;
  private pageIndex = 0;
  private returning = false;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private counter!: Phaser.GameObjects.Text;
  private father!: Phaser.GameObjects.Image;
  private alex!: Phaser.GameObjects.Sprite;
  private music?: Phaser.Sound.BaseSound;

  constructor() {
    super("EndingScene");
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
    SaveState.load().markEndingReached("chrome");

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
    this.alex = this.add.sprite(SCREEN_WIDTH / 2 + 140, 286, ALEX_CHROME_KEY, 26)
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
    const page = CHROME_PAGES[this.pageIndex];
    this.title.setText(page.title);
    this.body.setText(page.body);
    this.father.setVisible(page.fatherVisible);
    this.alex.setVisible(page.alexVisible);
    this.counter.setText(`${this.pageIndex + 1}/${CHROME_PAGES.length}`);
    if (this.pageIndex === CHROME_PAGES.length - 1) {
      this.tweens.add({ targets: this.alex, x: SCREEN_WIDTH + 150, duration: 3000, ease: "Sine.easeIn" });
    }
  }

  private advance(): void {
    if (this.returning) return;
    if (this.pageIndex < CHROME_PAGES.length - 1) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.returning = true;
    this.scene.start("MenuScene");
  }
}

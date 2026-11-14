import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { AudioManager, SFX, bgmForEnding } from "../systems/AudioManager";
import { startLoadingTransition } from "../systems/SceneTransition";

const CHROME_EPILOGUE_KEY = "ending-chrome-father-son";
const FLESH_EPILOGUE_KEYS = [
  "ending-flesh-renuncia",
  "ending-flesh-retorno",
  "ending-flesh-abraco",
] as const;
const HOLLOW_EPILOGUE_KEYS = [
  "ending-hollow-ecos",
  "ending-hollow-casa-fechada",
  "ending-hollow-partida",
] as const;

interface EndingPage {
  title: string;
  body: string;
}

interface EndingSceneData {
  ending?: EndingKind;
}

const CHROME_PAGES: EndingPage[] = [
  {
    title: "CONVERSÃO COMPLETA",
    body: "O Portão substitui o que ainda restava.\nMemórias, reflexos e identidade são comprimidos em um corpo cromado perfeito.",
  },
  {
    title: "NO TOPO DE GLITCH CITY",
    body: "Entre as figuras que celebram a nova máquina, um homem para.\nEle reconhece o cabelo, o nome e o filho que deixou nos níveis inferiores.",
  },
  {
    title: "— ALEX? FILHO?",
    body: "O pai chama seu nome.\nAlex procura a voz nos registros disponíveis. Nenhuma correspondência é encontrada.",
  },
  {
    title: "FINAL CHROME",
    body: "Alex continua andando.\nChegou ao lugar que perseguiu — incapaz de reconhecer aquilo que o fez começar.",
  },
];

const FLESH_PAGES: EndingPage[] = [
  {
    title: "DE VOLTA A CARNE",
    body: "As partes bioprintadas doem e carregam cicatrizes.\nPela primeira vez, a dor pertence novamente a Alex.",
  },
  {
    title: "A LUZ DE CASA",
    body: "A porta se abre. Sua familia nao encontra o homem que partiu,\nmas reconhece a voz que decidiu voltar.",
  },
  {
    title: "FINAL FLESH",
    body: "Alex nao recuperou o corpo original. Recuperou a possibilidade de estar presente.\nImperfeito, humano e em casa.",
  },
];

const HOLLOW_PAGES: EndingPage[] = [
  {
    title: "A CADEIA QUEBRADA",
    body: "Uma memoria ficou para tras. Sem ela, os glitches seguintes silenciaram\ne o cromo restante se tornou impossivel de abandonar.",
  },
  {
    title: "DO OUTRO LADO DA PORTA",
    body: "Alex ouve sua familia. Tenta responder, mas nenhuma palavra atravessa\na distancia entre a lembranca e aquilo que ele se tornou.",
  },
  {
    title: "FINAL HOLLOW",
    body: "Ele voltou, parcialmente mecanizado, sem conseguir se reconectar.\nA casa esta diante dele. O caminho terminou antes da chegada.",
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
  private chromeIllustration!: Phaser.GameObjects.Image;
  private endingIllustration!: Phaser.GameObjects.Image;
  private ending: EndingKind = "chrome";
  private pages: EndingPage[] = CHROME_PAGES;

  constructor() {
    super("EndingScene");
  }

  init(data: EndingSceneData): void {
    this.ending = data.ending ?? "chrome";
    this.pages = this.ending === "flesh" ? FLESH_PAGES : this.ending === "hollow" ? HOLLOW_PAGES : CHROME_PAGES;
  }

  preload(): void {
    AudioManager.preloadBgm(this, bgmForEnding(this.ending));
    if (!this.textures.exists(CHROME_EPILOGUE_KEY)) {
      this.load.image(
        CHROME_EPILOGUE_KEY,
        new URL("../assets/narrative/endings/chrome-father-son.png", import.meta.url).href,
      );
    }
    const endingIllustrations = [
      [FLESH_EPILOGUE_KEYS[0], new URL("../assets/narrative/endings/flesh/ending-flesh-01-renuncia.png", import.meta.url).href],
      [FLESH_EPILOGUE_KEYS[1], new URL("../assets/narrative/endings/flesh/ending-flesh-02-retorno.png", import.meta.url).href],
      [FLESH_EPILOGUE_KEYS[2], new URL("../assets/narrative/endings/flesh/ending-flesh-03-abraco.png", import.meta.url).href],
      [HOLLOW_EPILOGUE_KEYS[0], new URL("../assets/narrative/endings/hollow/ending-hollow-01-ecos.png", import.meta.url).href],
      [HOLLOW_EPILOGUE_KEYS[1], new URL("../assets/narrative/endings/hollow/ending-hollow-02-casa-fechada.png", import.meta.url).href],
      [HOLLOW_EPILOGUE_KEYS[2], new URL("../assets/narrative/endings/hollow/ending-hollow-03-partida.png", import.meta.url).href],
    ] as const;
    for (const [key, url] of endingIllustrations) {
      if (!this.textures.exists(key)) this.load.image(key, url);
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
    AudioManager.playBgm(this, bgmForEnding(this.ending), 0.28);
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
    const firstEndingKey = this.ending === "flesh"
      ? FLESH_EPILOGUE_KEYS[0]
      : HOLLOW_EPILOGUE_KEYS[0];
    this.endingIllustration = this.add.image(centerX, visualY, firstEndingKey)
      .setDisplaySize(480, 270)
      .setVisible(this.ending !== "chrome");
    this.endingIllustration.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
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
    this.chromeIllustration.setVisible(isChrome);
    this.endingIllustration.setVisible(!isChrome);
    if (!isChrome) {
      const keys = this.ending === "flesh" ? FLESH_EPILOGUE_KEYS : HOLLOW_EPILOGUE_KEYS;
      this.endingIllustration.setTexture(keys[this.pageIndex]);
    }
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
    // disponível.
    SaveState.load().markEndingReached(this.ending);
    startLoadingTransition(this, "FeedbackScene", {
      ending: this.ending,
    });
  }
}

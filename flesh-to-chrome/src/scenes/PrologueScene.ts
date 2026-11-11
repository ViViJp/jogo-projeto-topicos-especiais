import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import type { GameSceneData } from "./GameScene";

const PROLOGUE_FAMILY_KEY = "prologue-family";
const PROLOGUE_FATHER_BEFORE_KEY = "prologue-father-before";
const PROLOGUE_NEWSPAPER_KEY = "prologue-newspaper";

interface ProloguePage {
  image: string;
  imageCaption: string;
  title: string;
  body: string;
}

const PAGES: ProloguePage[] = [
  {
    image: PROLOGUE_FAMILY_KEY,
    imageCaption: "AVÔ E TIO DE ALEX",
    title: "O NÍVEL MAIS BAIXO DE GLITCH CITY",
    body: "Alex cresceu com os avós e o tio paterno.\nA casa era pequena; trabalho e créditos nunca bastavam.\nDo pai, restaram oito anos de silêncio e histórias contadas pelo avô.",
  },
  {
    image: PROLOGUE_FATHER_BEFORE_KEY,
    imageCaption: "PAI DE ALEX — ANTES DA ASCENSÃO",
    title: "O PAI QUE PARTIU",
    body: "Antes de subir, ele ainda era um homem do nível de baixo.\nO mesmo rosto de Alex, os dois olhos, nenhuma placa.\nFoi esse homem que a família deixou de ver.",
  },
  {
    image: PROLOGUE_NEWSPAPER_KEY,
    imageCaption: "PAI DE ALEX — APÓS A CONVERSÃO",
    title: "UM ROSTO NO JORNAL",
    body: "Uma reportagem anuncia um ciborgue celebrado no topo da cidade.\nAlex reconhece o homem que abandonou a família.\nEle não desapareceu: apenas subiu sem olhar para trás.",
  },
  {
    image: PROLOGUE_FAMILY_KEY,
    imageCaption: "A FAMÍLIA QUE FICOU",
    title: "A PRIMEIRA SUBIDA",
    body: "Se o pai atravessou as camadas de Glitch City, Alex também poderia.\nTalvez no topo encontrasse respostas. Talvez pudesse mudar a vida da família.\nNa manhã seguinte, ele parte em direção à clínica de George Vektor.",
  },
];

export class PrologueScene extends Phaser.Scene {
  private input$!: InputManager;
  private pageIndex = 0;
  private image!: Phaser.GameObjects.Image;
  private imageCaption!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private pageCounter!: Phaser.GameObjects.Text;
  private finished = false;

  constructor() {
    super("PrologueScene");
  }

  preload(): void {
    if (!this.textures.exists(PROLOGUE_FAMILY_KEY)) {
      this.load.image(
        PROLOGUE_FAMILY_KEY,
        new URL("../assets/narrative/prologue/familia.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(PROLOGUE_FATHER_BEFORE_KEY)) {
      this.load.image(
        PROLOGUE_FATHER_BEFORE_KEY,
        new URL("../assets/narrative/father/pai-antes.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(PROLOGUE_NEWSPAPER_KEY)) {
      this.load.image(
        PROLOGUE_NEWSPAPER_KEY,
        new URL("../assets/narrative/prologue/jornal-pai.png", import.meta.url).href,
      );
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const panelWidth = Math.min(1120, width - 80);
    const panelHeight = Math.min(610, height - 90);
    const panelTop = (height - panelHeight) / 2;
    const footerY = panelTop + panelHeight - 24;
    this.cameras.main.setBackgroundColor(0x05050a);
    AudioManager.playBgm(this, BGM.menu, 0.22);
    this.input$ = new InputManager(this);
    this.pageIndex = 0;
    this.finished = false;

    this.add.rectangle(centerX, height / 2, panelWidth, panelHeight, 0x10101b, 1)
      .setStrokeStyle(2, 0x7cfcea, 0.45);
    this.add.text(centerX, panelTop + 25, "PRÓLOGO", {
      fontFamily: "Courier New, monospace",
      fontSize: "24px",
      color: "#7CFCEA",
      letterSpacing: 5,
    }).setOrigin(0.5);

    this.image = this.add.image(centerX, panelTop + 190, PROLOGUE_FAMILY_KEY);
    this.imageCaption = this.add.text(centerX, panelTop + 335, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#7CFCEA",
      backgroundColor: "#080812dd",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.title = this.add.text(centerX, panelTop + 385, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "24px",
      color: "#FFD37C",
      align: "center",
    }).setOrigin(0.5);
    this.body = this.add.text(centerX, panelTop + 480, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#e8ecff",
      align: "center",
      lineSpacing: 8,
      wordWrap: { width: Math.min(980, width - 160) },
    }).setOrigin(0.5);
    this.pageCounter = this.add.text(centerX + panelWidth / 2 - 48, footerY, "", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#565f80",
    }).setOrigin(0.5);
    const prompt = this.add.text(centerX, footerY, "ENTER / A para continuar", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#8892b0",
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });

    this.renderPage();
    this.input.on("pointerdown", () => this.advance());
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) this.advance();
    this.input$.postUpdate();
  }

  private renderPage(): void {
    const page = PAGES[this.pageIndex];
    this.image.setTexture(page.image);
    const texture = this.image.texture;
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage() as HTMLImageElement;
    const scale = Math.min(620 / source.width, 260 / source.height);
    this.image.setScale(scale);
    this.imageCaption.setText(page.imageCaption);
    this.title.setText(page.title);
    this.body.setText(page.body);
    this.pageCounter.setText(`${this.pageIndex + 1}/${PAGES.length}`);
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  private advance(): void {
    if (this.finished) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.35 });
    if (this.pageIndex < PAGES.length - 1) {
      this.pageIndex += 1;
      this.renderPage();
      return;
    }
    this.finished = true;
    this.cameras.main.fadeOut(350, 0, 0, 0, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress < 1) return;
      this.scene.start("GameScene", { phaseId: "fase1" } as GameSceneData);
    });
  }
}

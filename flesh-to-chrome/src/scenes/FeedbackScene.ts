import Phaser from "phaser";
import { MenuBackdrop, drawTechPanel, preloadMenuBackdrop } from "../objects/MenuBackdrop";
import { AudioManager, SFX, bgmForEnding } from "../systems/AudioManager";
import { InputManager } from "../systems/InputManager";

type EndingKind = "chrome" | "flesh" | "hollow";

interface FeedbackSceneData {
  ending?: EndingKind;
}

interface FeedbackOption {
  label: string;
  action: () => void;
}

interface EndingTheme {
  accent: number;
  color: string;
  label: string;
}

const QR_TEXTURE_KEY = "feedback-qr-code";

export const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeeleFRJ3PbTeX9nmxFtfqF_3VMD6bBGixNGFODEtqjbHGK9A/viewform?entry.52413313=FleshtoChrome";

const ENDING_THEMES: Record<EndingKind, EndingTheme> = {
  chrome: { accent: 0x36e2ff, color: "#7CFCEA", label: "FINAL CHROME // AVALIAÇÃO" },
  flesh: { accent: 0xffd37c, color: "#FFD37C", label: "FINAL FLESH // AVALIAÇÃO" },
  hollow: { accent: 0xb786ff, color: "#B786FF", label: "FINAL HOLLOW // AVALIAÇÃO" },
};

/** Tela opcional exibida depois da conclusão narrativa de qualquer final. */
export class FeedbackScene extends Phaser.Scene {
  private input$!: InputManager;
  private backdrop!: MenuBackdrop;
  private ending: EndingKind = "chrome";
  private selectedIndex = 0;
  private options: FeedbackOption[] = [];
  private optionPanels: Phaser.GameObjects.Graphics[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("FeedbackScene");
  }

  init(data: FeedbackSceneData): void {
    this.ending = data.ending ?? "chrome";
  }

  preload(): void {
    preloadMenuBackdrop(this);
    AudioManager.preloadBgm(this, bgmForEnding(this.ending));
    if (!this.textures.exists(QR_TEXTURE_KEY)) {
      this.load.image(
        QR_TEXTURE_KEY,
        new URL("../assets/ui/qr-avaliacao-flesh-to-chrome.png", import.meta.url).href,
      );
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const panelWidth = Math.min(1_152, width - 64);
    const panelHeight = Math.min(620, height - 48);
    const panelX = centerX - panelWidth / 2;
    const panelY = (height - panelHeight) / 2;
    const theme = ENDING_THEMES[this.ending];

    this.cameras.main.setBackgroundColor(0x05050a);
    this.backdrop = new MenuBackdrop(this);
    // AudioManager preserva a instância quando a mesma faixa já está tocando.
    AudioManager.playBgm(this, bgmForEnding(this.ending), 0.28);
    this.input$ = new InputManager(this);
    this.selectedIndex = 0;
    this.optionPanels = [];
    this.optionTexts = [];

    const frame = drawTechPanel(this, panelX, panelY, panelWidth, panelHeight, 5, theme.accent);
    this.tweens.add({
      targets: frame,
      alpha: { from: 0.76, to: 1 },
      duration: 1_300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    const title = this.add.text(panelX + 34, panelY + 28, "MISSÃO CONCLUÍDA // FLESH TO CHROME", {
      fontFamily: "Courier New, monospace",
      fontSize: "26px",
      color: "#7CFCEA",
      letterSpacing: 2,
    }).setDepth(7).setAlpha(0).setShadow(0, 0, "#36e2ff", 7, true, true);
    const endingLabel = this.add.text(panelX + 36, panelY + 72, theme.label, {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: theme.color,
      letterSpacing: 1,
    }).setDepth(7).setAlpha(0);
    this.add.rectangle(centerX, panelY + 112, panelWidth - 56, 2, theme.accent, 0.62)
      .setDepth(7);

    const contentTop = panelY + 140;
    const contentBottom = panelY + panelHeight - 54;
    const leftX = panelX + 38;
    const leftWidth = Math.min(390, panelWidth * 0.36);
    const columnGap = 36;
    const rightX = leftX + leftWidth + columnGap;
    const rightWidth = panelX + panelWidth - 38 - rightX;
    const qrSize = Math.min(305, leftWidth - 54, contentBottom - contentTop - 72);
    const qrCardHeight = qrSize + 72;
    const qrCardY = contentTop + Math.max(0, (contentBottom - contentTop - qrCardHeight) / 2);

    drawTechPanel(this, leftX, qrCardY, leftWidth, qrCardHeight, 6, 0x36e2ff);
    const qrCenterX = leftX + leftWidth / 2;
    const qrCenterY = qrCardY + 20 + qrSize / 2;
    this.add.rectangle(qrCenterX, qrCenterY, qrSize + 18, qrSize + 18, 0xffffff, 1).setDepth(7);
    const qrCode = this.add.image(qrCenterX, qrCenterY, QR_TEXTURE_KEY)
      .setDisplaySize(qrSize, qrSize)
      .setDepth(8);
    qrCode.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.text(qrCenterX, qrCardY + qrCardHeight - 26, "APONTE A CÂMERA DO CELULAR", {
      fontFamily: "Courier New, monospace",
      fontSize: "13px",
      color: "#7CFCEA",
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(8);

    const opinionTitle = this.add.text(rightX, contentTop + 4, "SUA OPINIÃO PODE", {
      fontFamily: "Courier New, monospace",
      fontSize: "25px",
      color: "#E8ECFF",
      fontStyle: "bold",
    }).setDepth(7).setAlpha(0);
    const cityTitle = this.add.text(rightX, contentTop + 42, "MUDAR GLITCH CITY", {
      fontFamily: "Courier New, monospace",
      fontSize: "25px",
      color: "#7CFCEA",
      fontStyle: "bold",
    }).setDepth(7).setAlpha(0);
    const message = this.add.text(
      rightX,
      contentTop + 102,
      [
        "Obrigado por acompanhar a jornada de Alex até o fim!",
        "",
        "Queremos saber o que você achou da história, das fases,",
        "dos controles e da experiência geral.",
        "",
        "Escaneie o QR Code ou abra o formulário para compartilhar",
        "sua avaliação.",
      ].join("\n"),
      {
        fontFamily: "Courier New, monospace",
        fontSize: "15px",
        color: "#D8DEEF",
        lineSpacing: 5,
        wordWrap: { width: rightWidth },
      },
    ).setDepth(7).setAlpha(0);
    const voluntary = this.add.text(
      rightX,
      contentTop + 278,
      "Sua participação é voluntária e nos ajuda a melhorar Flesh to Chrome.",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#FFD37C",
        wordWrap: { width: rightWidth },
      },
    ).setDepth(7).setAlpha(0);

    this.options = [
      { label: "ABRIR FORMULÁRIO", action: () => this.openForm() },
      { label: "VOLTAR AO MENU", action: () => this.returnToMenu() },
    ];
    const buttonY = contentTop + 330;
    this.options.forEach((option, index) => {
      const y = buttonY + index * 58;
      const panel = drawTechPanel(this, rightX, y, rightWidth, 48, 6, 0x36e2ff);
      const text = this.add.text(rightX + rightWidth / 2, y + 24, option.label, {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#E8ECFF",
      }).setOrigin(0.5).setDepth(8);
      this.add.rectangle(rightX, y, rightWidth, 48, 0xffffff, 0.001)
        .setOrigin(0, 0)
        .setDepth(9)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.select(index))
        .on("pointerdown", () => {
          this.select(index);
          this.confirmSelection();
        });
      this.optionPanels.push(panel);
      this.optionTexts.push(text);
    });
    this.select(0, false);

    this.add.text(
      rightX,
      panelY + panelHeight - 30,
      "ENTER / A confirmar   ·   ESC / B voltar",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#8D96AD",
      },
    ).setDepth(7);

    [title, endingLabel, opinionTitle, cityTitle, message, voluntary].forEach((object, index) => {
      this.tweens.add({
        targets: object,
        alpha: 1,
        duration: 360,
        delay: 70 * index,
        ease: "Sine.Out",
      });
    });
  }

  update(_time: number, delta: number): void {
    this.backdrop.update(delta);
    if (this.input$.isCancelJustDown()) {
      this.returnToMenu();
    } else if (this.input$.isMenuUpJustDown() || this.input$.isMenuLeftJustDown()) {
      this.select((this.selectedIndex - 1 + this.options.length) % this.options.length);
    } else if (this.input$.isMenuDownJustDown() || this.input$.isMenuRightJustDown()) {
      this.select((this.selectedIndex + 1) % this.options.length);
    } else if (this.input$.isConfirmJustDown()) {
      this.confirmSelection();
    }
    this.input$.postUpdate();
  }

  private select(index: number, withSound = true): void {
    if (withSound && index !== this.selectedIndex) {
      AudioManager.playSfx(this, SFX.uiSelect, { volume: 0.28 });
    }
    this.selectedIndex = index;
    this.optionTexts.forEach((text, optionIndex) => {
      const selected = optionIndex === index;
      text.setText(`${selected ? "▶ " : "  "}${this.options[optionIndex].label}`);
      text.setColor(selected ? "#FFD37C" : "#E8ECFF");
      text.setScale(selected ? 1.03 : 1);
      this.optionPanels[optionIndex].setAlpha(selected ? 1 : 0.48);
    });
  }

  private confirmSelection(): void {
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.4 });
    this.options[this.selectedIndex]?.action();
  }

  private openForm(): void {
    window.open(FEEDBACK_FORM_URL, "_blank", "noopener,noreferrer");
  }

  private returnToMenu(): void {
    this.scene.start("MenuScene");
  }
}

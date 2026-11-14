import Phaser from "phaser";
import {
  GAMEPAD_BINDING_LABELS,
  GAMEPLAY_CONTROL_ACTIONS,
  keyboardBindingLabel,
  type GameplayControlAction,
} from "../config/Controls";
import { MenuBackdrop, drawTechPanel, preloadMenuBackdrop } from "../objects/MenuBackdrop";
import { queuePrologueAssets } from "../objects/PrologueAssets";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";

interface ControlsSceneData {
  /** Só o fluxo confirmado de Novo Jogo pode substituir o save atual. */
  campaignSetup?: boolean;
}

interface ControlsOption {
  label: string;
  action: () => void;
}

const ACTION_LABELS: Record<GameplayControlAction, string> = {
  jump: "PULAR",
  slide: "SLIDE",
  attack: "ATAQUE",
  scan: "SCAN",
  dash: "DASH",
  pause: "PAUSA",
};

const IMPLANTS = [
  ["PERNAS", "Salto duplo"],
  ["BRAÇOS", "Ataque e quebra"],
  ["OLHOS", "Scan e revelação"],
  ["PROPULSORES", "Dash aéreo"],
] as const;

export class ControlsScene extends Phaser.Scene {
  private input$!: InputManager;
  private backdrop!: MenuBackdrop;
  private campaignSetup = false;
  private options: ControlsOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private campaignAssetsReady = false;
  private campaignStartPending = false;
  private campaignStatusText?: Phaser.GameObjects.Text;

  constructor() {
    super("ControlsScene");
  }

  init(data: ControlsSceneData): void {
    this.campaignSetup = data.campaignSetup ?? false;
  }

  preload(): void {
    AudioManager.preloadBgm(this, BGM.menu);
    preloadMenuBackdrop(this);
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const panelWidth = Math.min(1180, width - 64);
    const panelHeight = Math.min(660, height - 36);
    const panelX = centerX - panelWidth / 2;
    const panelY = (height - panelHeight) / 2;
    const innerX = panelX + 30;
    const innerWidth = panelWidth - 60;
    const gap = 24;
    const cardWidth = (innerWidth - gap) / 2;
    const cardY = panelY + 116;
    const cardHeight = 250;

    this.cameras.main.setBackgroundColor(0x05050a);
    this.backdrop = new MenuBackdrop(this);
    AudioManager.playBgm(this, BGM.menu, 0.26);
    this.input$ = new InputManager(this);
    this.selectedIndex = 0;
    this.optionTexts = [];
    this.campaignAssetsReady = false;
    this.campaignStartPending = false;
    this.campaignStatusText = undefined;

    drawTechPanel(this, panelX, panelY, panelWidth, panelHeight, 5, 0x7cfcea);
    this.add.text(centerX, panelY + 30, "CONTROLES // PROTOCOLO DE SOBREVIVÊNCIA", {
      fontFamily: "Courier New, monospace",
      fontSize: "28px",
      color: "#7CFCEA",
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(7).setShadow(0, 0, "#36e2ff", 8, true, true);
    this.add.text(centerX, panelY + 76, "Alex corre automaticamente. Escolha quando agir.", {
      fontFamily: "Courier New, monospace",
      fontSize: "17px",
      color: "#c8cfe8",
    }).setOrigin(0.5).setDepth(7);

    this.createControlCard(innerX, cardY, cardWidth, cardHeight, "TECLADO E MOUSE", false);
    this.createControlCard(innerX + cardWidth + gap, cardY, cardWidth, cardHeight, "CONTROLE", true);

    this.add.text(innerX, panelY + 390, "HABILIDADES DESBLOQUEÁVEIS", {
      fontFamily: "Courier New, monospace",
      fontSize: "17px",
      color: "#FFD37C",
      letterSpacing: 2,
    }).setDepth(7);
    const implantGap = 12;
    const implantWidth = (innerWidth - implantGap * 3) / 4;
    IMPLANTS.forEach(([name, ability], index) => {
      const x = innerX + index * (implantWidth + implantGap);
      drawTechPanel(this, x, panelY + 420, implantWidth, 64, 6, 0x5b7894);
      this.add.text(x + implantWidth / 2, panelY + 438, `[${name}]`, {
        fontFamily: "Courier New, monospace", fontSize: "14px", color: "#7CFCEA",
      }).setOrigin(0.5).setDepth(7);
      this.add.text(x + implantWidth / 2, panelY + 463, ability, {
        fontFamily: "Courier New, monospace", fontSize: "12px", color: "#c8cfe8",
      }).setOrigin(0.5).setDepth(7);
    });

    this.options = this.campaignSetup
      ? [
          { label: "INICIAR CAMPANHA", action: () => this.startCampaign() },
          { label: "VOLTAR", action: () => this.returnToMenu() },
        ]
      : [{ label: "VOLTAR", action: () => this.returnToMenu() }];
    this.createOptions(centerX, panelY + panelHeight - 70);
    if (this.campaignSetup) {
      this.campaignStatusText = this.add.text(centerX, panelY + panelHeight - 118, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#7CFCEA",
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(7).setVisible(false);
      this.warmPrologueAssets();
    }
    this.add.text(centerX, panelY + panelHeight - 22, "← → / DIRECIONAL escolher   ENTER / A confirmar   ESC / B voltar", {
      fontFamily: "Courier New, monospace", fontSize: "13px", color: "#8d96ad",
    }).setOrigin(0.5).setDepth(7);
  }

  update(_time: number, delta: number): void {
    this.backdrop.update(delta);
    if (this.input$.isCancelJustDown()) {
      this.returnToMenu();
    } else if (this.input$.isMenuLeftJustDown() || this.input$.isMenuUpJustDown()) {
      this.select((this.selectedIndex - 1 + this.options.length) % this.options.length);
    } else if (this.input$.isMenuRightJustDown() || this.input$.isMenuDownJustDown()) {
      this.select((this.selectedIndex + 1) % this.options.length);
    } else if (this.input$.isConfirmJustDown()) {
      AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.4 });
      this.options[this.selectedIndex]?.action();
    }
    this.input$.postUpdate();
  }

  private createControlCard(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    gamepad: boolean,
  ): void {
    drawTechPanel(this, x, y, width, height, 6, 0x36e2ff);
    this.add.text(x + width / 2, y + 28, title, {
      fontFamily: "Courier New, monospace", fontSize: "18px", color: "#7CFCEA",
    }).setOrigin(0.5).setDepth(7);
    GAMEPLAY_CONTROL_ACTIONS.forEach((action, index) => {
      const rowY = y + 66 + index * 29;
      const binding = gamepad ? GAMEPAD_BINDING_LABELS[action] : keyboardBindingLabel(action);
      this.add.text(x + 24, rowY, ACTION_LABELS[action], {
        fontFamily: "Courier New, monospace", fontSize: "15px", color: "#e8ecff",
      }).setDepth(7);
      this.add.text(x + width - 24, rowY, binding, {
        fontFamily: "Courier New, monospace", fontSize: "15px", color: "#FFD37C",
      }).setOrigin(1, 0).setDepth(7);
    });
  }

  private createOptions(centerX: number, y: number): void {
    const spacing = 300;
    this.options.forEach((option, index) => {
      const x = centerX + (index - (this.options.length - 1) / 2) * spacing;
      drawTechPanel(this, x - 132, y - 25, 264, 50, 6, 0x36e2ff);
      const text = this.add.text(x, y, option.label, {
        fontFamily: "Courier New, monospace", fontSize: "16px", color: "#e8ecff",
      }).setOrigin(0.5).setDepth(7).setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.select(index))
        .on("pointerdown", () => {
          this.select(index);
          AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.4 });
          option.action();
        });
      this.optionTexts.push(text);
    });
    this.select(0, false);
  }

  private select(index: number, withSound = true): void {
    if (withSound && index !== this.selectedIndex) {
      AudioManager.playSfx(this, SFX.uiSelect, { volume: 0.28 });
    }
    this.selectedIndex = index;
    this.optionTexts.forEach((text, optionIndex) => {
      text.setText(`${optionIndex === index ? "▶ " : "  "}${this.options[optionIndex].label}`);
      text.setColor(optionIndex === index ? "#FFD37C" : "#e8ecff");
    });
  }

  private startCampaign(): void {
    if (!this.campaignSetup || this.campaignStartPending) return;
    if (!this.campaignAssetsReady) {
      this.campaignStartPending = true;
      this.campaignStatusText?.setText("PREPARANDO PRÓLOGO // AGUARDE...").setVisible(true);
      return;
    }
    this.finishCampaignStart();
  }

  private warmPrologueAssets(): void {
    const queuedAssets = queuePrologueAssets(this);
    if (queuedAssets === 0) {
      this.campaignAssetsReady = true;
      return;
    }

    this.campaignStatusText?.setText("PREPARANDO PRÓLOGO // 0%").setVisible(true);
    this.load.on("progress", (progress: number) => {
      const percent = Math.round(progress * 100);
      this.campaignStatusText?.setText(`PREPARANDO PRÓLOGO // ${percent}%`);
    });
    this.load.once("complete", () => {
      this.campaignAssetsReady = true;
      this.campaignStatusText?.setText("PRÓLOGO PRONTO");
      if (this.campaignStartPending) this.finishCampaignStart();
    });
    // O loader normal da cena já terminou antes de create(). Reiniciá-lo aqui
    // mantém o painel renderizado enquanto as imagens chegam em segundo plano.
    this.load.start();
  }

  private finishCampaignStart(): void {
    SaveState.newGame();
    this.scene.start("PrologueScene");
  }

  private returnToMenu(): void {
    this.scene.start("MenuScene");
  }
}

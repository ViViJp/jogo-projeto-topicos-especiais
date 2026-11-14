import Phaser from "phaser";
import { MenuBackdrop, drawTechPanel, preloadMenuBackdrop } from "../objects/MenuBackdrop";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { GameSceneData } from "./GameScene";
import { startLoadingTransition } from "../systems/SceneTransition";

interface MenuOption {
  label: string;
  action: () => void;
}

export class MenuScene extends Phaser.Scene {
  private input$!: InputManager;
  private backdrop!: MenuBackdrop;
  private options: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private confirmVisible = false;
  private confirmText?: Phaser.GameObjects.Text;
  private confirmPanel?: Phaser.GameObjects.Graphics;
  private menuHint?: Phaser.GameObjects.Text;
  private hasSave = false;
  private panelX = 48;
  private panelY = 196;
  private panelWidth = 500;
  private panelHeight = 462;

  constructor() {
    super("MenuScene");
  }

  preload(): void {
    AudioManager.preloadBgm(this, BGM.menu);
    preloadMenuBackdrop(this);
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.panelX = Math.max(48, (width - 1_440) / 2 + 48);
    this.panelY = Math.max(196, height * 0.27);
    this.panelWidth = Math.min(500, width - this.panelX - 48);
    this.panelHeight = height - this.panelY - 62;

    this.optionTexts = [];
    this.selectedIndex = 0;
    this.confirmVisible = false;
    this.confirmText = undefined;
    this.confirmPanel = undefined;

    this.cameras.main.setBackgroundColor(0x05050a);
    this.backdrop = new MenuBackdrop(this);
    AudioManager.playBgm(this, BGM.menu, 0.28);
    this.input$ = new InputManager(this);

    this.add.text(this.panelX, 58, "FLESH TO CHROME", {
      fontFamily: "Courier New, monospace",
      fontSize: "58px",
      color: "#7CFCEA",
      letterSpacing: 3,
    }).setDepth(6).setShadow(0, 0, "#36e2ff", 10, true, true);

    this.add.text(this.panelX + 3, 128, "GLITCH CITY // SISTEMA DE ASCENSÃO", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#a8b5ce",
      letterSpacing: 2,
    }).setDepth(6);

    drawTechPanel(this, this.panelX, this.panelY, this.panelWidth, this.panelHeight, 5, 0x36e2ff);

    this.hasSave = SaveState.hasExistingSave();
    this.menuHint = this.add.text(this.panelX + 28, this.panelY + 24, "MENU PRINCIPAL", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#7CFCEA",
      letterSpacing: 2,
    }).setDepth(6);

    this.showMainMenu();

    this.add.text(
      this.panelX + this.panelWidth / 2,
      height - 28,
      "↑↓ / W S navegar   ENTER / A confirmar   ESC / B voltar",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#8d96ad",
      },
    ).setOrigin(0.5).setDepth(6);
  }

  update(_time: number, delta: number): void {
    this.backdrop.update(delta);
    if (this.confirmVisible) {
      if (this.input$.isCancelJustDown()) {
        this.hideConfirm();
      } else if (this.input$.isConfirmJustDown()) {
        this.confirmNewGame();
      }
      this.input$.postUpdate();
      return;
    }

    if (this.input$.isMenuUpJustDown() || this.input$.isMenuLeftJustDown()) {
      this.setSelected((this.selectedIndex - 1 + this.options.length) % this.options.length);
    } else if (this.input$.isMenuDownJustDown() || this.input$.isMenuRightJustDown()) {
      this.setSelected((this.selectedIndex + 1) % this.options.length);
    } else if (this.input$.isConfirmJustDown()) {
      this.confirmSelection();
    }

    this.input$.postUpdate();
  }

  private renderOptions(): void {
    this.optionTexts.forEach((text) => text.destroy());
    this.optionTexts = [];
    this.selectedIndex = 0;

    const startY = this.panelY + 74;
    const spacing = 52;
    this.options.forEach((option, index) => {
      const text = this.add.text(this.panelX + 28, startY + index * spacing, option.label, {
        fontFamily: "Courier New, monospace",
        fontSize: "23px",
        color: "#e8ecff",
      }).setOrigin(0, 0.5).setDepth(6).setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.setSelected(index))
        .on("pointerdown", () => {
          this.setSelected(index);
          this.confirmSelection();
        });
      this.optionTexts.push(text);
    });

    if (this.options.length > 0) this.setSelected(0);
  }

  private showMainMenu(): void {
    this.menuHint?.setText("MENU PRINCIPAL");
    this.options = [];
    const saveData = SaveState.load().get();
    if (this.hasSave && saveData.endingReached === null) {
      this.options.push({ label: "Continuar", action: () => this.continueGame() });
    }
    if (saveData.preGateSave) {
      this.options.push({ label: "Continuar do Portão", action: () => this.continueFromGate() });
    }
    this.options.push({ label: "Novo Jogo", action: () => this.newGame(this.hasSave) });
    this.options.push({ label: "Controles", action: () => this.openControls(false) });
    this.options.push({ label: "Multiplayer", action: () => this.openMultiplayer() });
    this.renderOptions();
  }

  private setSelected(index: number): void {
    if (index !== this.selectedIndex && this.optionTexts.length > 0) {
      AudioManager.playSfx(this, SFX.uiSelect, { volume: 0.28 });
    }
    this.selectedIndex = index;
    this.optionTexts.forEach((text, optionIndex) => {
      text.setText(`${optionIndex === index ? "▶ " : "  "}${this.options[optionIndex].label.toUpperCase()}`);
      text.setColor(optionIndex === index ? "#FFD37C" : "#e8ecff");
      text.setScale(optionIndex === index ? 1.03 : 1);
    });
  }

  private confirmSelection(): void {
    if (this.confirmVisible) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.42 });
    this.options[this.selectedIndex]?.action();
  }

  private openMultiplayer(): void {
    startLoadingTransition(this, "MultiplayerScene");
  }

  private openControls(campaignSetup: boolean): void {
    startLoadingTransition(this, "ControlsScene", { campaignSetup });
  }

  private continueGame(): void {
    const save = SaveState.load();
    const data = save.get();
    if (data.descentState.pendingRemoval) {
      startLoadingTransition(this, "ReForgeScene");
      return;
    }
    if (data.descentState.epiloguePending) {
      startLoadingTransition(this, "GameScene", {
        phaseId: data.currentPhaseId,
        checkpointX: data.checkpoint.x,
        checkpointY: data.checkpoint.y,
        consolidatedCreditIds: [],
        wallet: 0,
        abilities: data.abilities,
        descent: true,
      } as GameSceneData);
      return;
    }
    if (data.descentState.brokenChain) {
      startLoadingTransition(this, "EpilogueScene", { ending: "hollow" });
      return;
    }
    if (!data.descentState.active && data.descentState.currentStep >= 4 && data.endingReached === null) {
      startLoadingTransition(this, "EpilogueScene", { ending: "flesh" });
      return;
    }
    startLoadingTransition(this, "GameScene", {
      phaseId: data.currentPhaseId,
      checkpointX: data.checkpoint.x,
      checkpointY: data.checkpoint.y,
      consolidatedCreditIds: data.checkpoint.consolidatedCreditIds,
      wallet: data.wallet,
      abilities: data.abilities,
      descent: data.descentState.active,
    } as GameSceneData);
  }

  private continueFromGate(): void {
    const restored = SaveState.load().restorePreGateSave();
    if (!restored) return;
    startLoadingTransition(this, "GateScene");
  }

  private newGame(hasSave: boolean): void {
    if (hasSave && !this.confirmVisible) {
      this.showConfirm();
      return;
    }
    this.openControls(true);
  }

  private showConfirm(): void {
    this.confirmVisible = true;
    const x = this.panelX + 16;
    const y = this.panelY + this.panelHeight - 104;
    this.confirmPanel = drawTechPanel(this, x, y, this.panelWidth - 32, 84, 8, 0xff718f);
    this.confirmText = this.add.text(
      this.panelX + this.panelWidth / 2,
      y + 42,
      "SUBSTITUIR O SAVE ATUAL?\nENTER / A confirma   ESC / B cancela",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "15px",
        color: "#ff8a8a",
        align: "center",
      },
    ).setOrigin(0.5).setDepth(9).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.confirmNewGame());
  }

  private confirmNewGame(): void {
    this.hideConfirm();
    this.openControls(true);
  }

  private hideConfirm(): void {
    this.confirmVisible = false;
    this.confirmText?.destroy();
    this.confirmPanel?.destroy();
    this.confirmText = undefined;
    this.confirmPanel = undefined;
  }
}

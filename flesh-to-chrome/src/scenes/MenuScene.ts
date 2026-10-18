import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { SaveState } from "../systems/SaveState";
import { GameSceneData } from "./GameScene";

interface MenuOption {
  label: string;
  action: () => void;
}

const TEST_PHASES = [
  { id: "fase1", label: "Fase 1 — Esgoto / Periferia" },
  { id: "fase2-intro", label: "Fase 2 — Distrito Industrial" },
  { id: "fase3", label: "Fase 3 — Meio Urbano" },
  { id: "fase4", label: "Fase 4 — Distrito Corporativo" },
  { id: "fase5", label: "Fase 5 — Topo da Cidade" },
] as const;

export class MenuScene extends Phaser.Scene {
  private input$!: InputManager;
  private options: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private confirmVisible = false;
  private confirmText?: Phaser.GameObjects.Text;
  private menuHint?: Phaser.GameObjects.Text;
  private hasSave = false;
  private mode: "main" | "phase-select" = "main";

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);
    this.optionTexts = [];

    this.add
      .text(SCREEN_WIDTH / 2, 150, "FLESH TO CHROME", {
        fontFamily: "Courier New, monospace",
        fontSize: "56px",
        color: "#7CFCEA",
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN_WIDTH / 2, 210, "protótipo técnico — Glitch City", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#8892b0",
      })
      .setOrigin(0.5);

    this.hasSave = SaveState.hasExistingSave();
    this.menuHint = this.add
      .text(SCREEN_WIDTH / 2, 270, "MENU PRINCIPAL", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#565f80",
      })
      .setOrigin(0.5);

    this.showMainMenu();

    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, "↑↓ / W S ou DIRECIONAL navegar   ENTER / A confirmar   ESC / B voltar", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#565f80",
      })
      .setOrigin(0.5);
  }

  private renderOptions(): void {
    this.optionTexts.forEach((text) => text.destroy());
    this.optionTexts = [];

    const startY = this.mode === "phase-select" ? 320 : 340;
    const spacing = this.mode === "phase-select" ? 48 : 56;
    this.options.forEach((opt, i) => {
      const text = this.add
        .text(SCREEN_WIDTH / 2, startY + i * spacing, opt.label, {
          fontFamily: "Courier New, monospace",
          fontSize: this.mode === "phase-select" ? "23px" : "28px",
          color: "#e8ecff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.setSelected(i))
        .on("pointerdown", () => {
          this.setSelected(i);
          this.confirmSelection();
        });
      this.optionTexts.push(text);
    });

    this.setSelected(0);
  }

  private showMainMenu(): void {
    this.mode = "main";
    this.menuHint?.setText("MENU PRINCIPAL");
    this.options = [];
    if (this.hasSave) {
      this.options.push({ label: "Continuar", action: () => this.continueGame() });
    }
    this.options.push({ label: "Novo Jogo", action: () => this.newGame(this.hasSave) });
    this.options.push({ label: "Selecionar Fase (teste)", action: () => this.showPhaseSelect() });
    this.options.push({ label: "Multiplayer (pós-MVP — não implementado)", action: () => {} });
    this.renderOptions();
  }

  private showPhaseSelect(): void {
    this.mode = "phase-select";
    this.menuHint?.setText("SELEÇÃO TEMPORÁRIA — NÃO ALTERA O SAVE");
    this.options = TEST_PHASES.map((phase) => ({
      label: phase.label,
      action: () => this.startTestPhase(phase.id),
    }));
    this.options.push({ label: "← Voltar", action: () => this.showMainMenu() });
    this.renderOptions();
  }

  private startTestPhase(phaseId: string): void {
    this.scene.start("GameScene", {
      phaseId,
      checkpointX: 0,
      checkpointY: 0,
      consolidatedCreditIds: [],
      wallet: 0,
      testMode: true,
    } as GameSceneData);
  }

  update(): void {
    if (this.confirmVisible) {
      if (this.input$.isCancelJustDown()) {
        this.hideConfirm();
      } else if (this.input$.isConfirmJustDown()) {
        this.confirmNewGame();
      }
      this.input$.postUpdate();
      return;
    }

    if (this.mode === "phase-select" && this.input$.isCancelJustDown()) {
      this.showMainMenu();
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

  private setSelected(index: number): void {
    this.selectedIndex = index;
    this.optionTexts.forEach((t, i) => {
      t.setColor(i === index ? "#FFD37C" : "#e8ecff");
      t.setScale(i === index ? 1.06 : 1);
    });
  }

  private confirmSelection(): void {
    if (this.confirmVisible) return;
    this.options[this.selectedIndex]?.action();
  }

  private continueGame(): void {
    const save = SaveState.load();
    const data = save.get();
    this.scene.start("GameScene", {
      phaseId: data.currentPhaseId,
      checkpointX: data.checkpoint.x,
      checkpointY: data.checkpoint.y,
      consolidatedCreditIds: data.checkpoint.consolidatedCreditIds,
      wallet: data.wallet,
      abilities: data.abilities,
    } as GameSceneData);
  }

  private newGame(hasSave: boolean): void {
    if (hasSave && !this.confirmVisible) {
      this.showConfirm();
      return;
    }
    SaveState.newGame();
    this.scene.start("GameScene", { phaseId: "fase1" } as GameSceneData);
  }

  private showConfirm(): void {
    this.confirmVisible = true;
    this.confirmText = this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 110,
        "Isso vai apagar o save atual. ENTER/A confirma, ESC/B/SELECT cancela.",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "18px",
          color: "#ff8a8a",
          backgroundColor: "#1a0a0aee",
          padding: { x: 14, y: 10 },
        }
      )
      .setOrigin(0.5);

  }

  private confirmNewGame(): void {
    this.hideConfirm();
    SaveState.newGame();
    this.scene.start("GameScene", { phaseId: "fase1" } as GameSceneData);
  }

  private hideConfirm(): void {
    this.confirmVisible = false;
    this.confirmText?.destroy();
    this.confirmText = undefined;
  }
}

import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { SaveState } from "../systems/SaveState";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { GameSceneData } from "./GameScene";

interface MenuOption {
  label: string;
  action: () => void;
}

export class MenuScene extends Phaser.Scene {
  private options: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private confirmVisible = false;
  private confirmText?: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    const audio = new AudioManager(this);
    audio.unlock();
    // BGM só depois do primeiro clique/tecla (autoplay policy)
    const startMusic = () => {
      audio.unlock();
      audio.playBgm(BGM.menu);
    };
    this.input.once("pointerdown", startMusic);
    this.input.keyboard?.once("keydown", startMusic);

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

    const hasSave = SaveState.hasExistingSave();
    this.options = [];

    if (hasSave) {
      this.options.push({ label: "Continuar", action: () => this.continueGame() });
    }
    this.options.push({ label: "Novo Jogo", action: () => this.newGame(hasSave) });
    this.options.push({ label: "Multiplayer (pós-MVP — não implementado)", action: () => {} });

    this.options.forEach((opt, i) => {
      const text = this.add
        .text(SCREEN_WIDTH / 2, 340 + i * 56, opt.label, {
          fontFamily: "Courier New, monospace",
          fontSize: "28px",
          color: "#e8ecff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          this.setSelected(i);
          audio.sfx(SFX.uiSelect);
        })
        .on("pointerdown", () => this.confirmSelection());
      this.optionTexts.push(text);
    });

    this.setSelected(0);

    this.input.keyboard?.on("keydown-UP", () => {
      this.setSelected((this.selectedIndex - 1 + this.options.length) % this.options.length);
      audio.sfx(SFX.uiSelect);
    });
    this.input.keyboard?.on("keydown-DOWN", () => {
      this.setSelected((this.selectedIndex + 1) % this.options.length);
      audio.sfx(SFX.uiSelect);
    });
    this.input.keyboard?.on("keydown-W", () => {
      this.setSelected((this.selectedIndex - 1 + this.options.length) % this.options.length);
      audio.sfx(SFX.uiSelect);
    });
    this.input.keyboard?.on("keydown-S", () => {
      this.setSelected((this.selectedIndex + 1) % this.options.length);
      audio.sfx(SFX.uiSelect);
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      audio.sfx(SFX.uiConfirm);
      this.confirmSelection();
    });

    this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, "↑↓ / W S navegar   ENTER confirmar", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#565f80",
      })
      .setOrigin(0.5);
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
        "Isso vai apagar o save atual. ENTER para confirmar, ESC para cancelar.",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "18px",
          color: "#ff8a8a",
          backgroundColor: "#1a0a0aee",
          padding: { x: 14, y: 10 },
        }
      )
      .setOrigin(0.5);

    const onConfirm = () => {
      cleanup();
      SaveState.newGame();
      this.scene.start("GameScene", { phaseId: "fase1" } as GameSceneData);
    };
    const onCancel = () => {
      cleanup();
    };
    const cleanup = () => {
      this.confirmVisible = false;
      this.confirmText?.destroy();
      this.input.keyboard?.off("keydown-ENTER", onConfirm);
      this.input.keyboard?.off("keydown-ESC", onCancel);
    };

    this.input.keyboard?.once("keydown-ENTER", onConfirm);
    this.input.keyboard?.once("keydown-ESC", onCancel);
  }
}

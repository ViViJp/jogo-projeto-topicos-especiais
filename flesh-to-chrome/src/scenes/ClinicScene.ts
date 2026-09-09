import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { AbilityState } from "../systems/AbilityState";
import { SaveState } from "../systems/SaveState";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { GameSceneData } from "./GameScene";

interface ClinicSceneData {
  completedPhaseId: string;
  nextPhaseId: string | null;
  wallet: number;
  abilities: AbilityState;
}

/**
 * Clínica de George Vektor - GDD seção 15.3/15.4.
 * Cutscene mínima (texto + implante instalado) representando o beat
 * narrativo entre fases. Cinemáticas completas ficam para o Marco 4.
 */
export class ClinicScene extends Phaser.Scene {
  private data$!: ClinicSceneData;

  constructor() {
    super("ClinicScene");
  }

  init(data: ClinicSceneData): void {
    this.data$ = data;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x120a1a);
    const audio = new AudioManager(this);
    audio.playBgm(BGM.clinic);
    audio.sfx(SFX.clinicTools);

    const implantKey: keyof AbilityState = "legs"; // apenas Fase 1 chega aqui neste protótipo
    const implantLabel = "pernas mecânicas";
    const abilityLabel = "salto duplo";

    const save = SaveState.load();
    const newAbilities: AbilityState = { ...this.data$.abilities, [implantKey]: true };
    save.unlockAbility(implantKey);
    this.time.delayedCall(400, () => audio.sfx(SFX.implant));

    this.add
      .text(SCREEN_WIDTH / 2, 160, "CLÍNICA DE GEORGE VEKTOR", {
        fontFamily: "Courier New, monospace",
        fontSize: "34px",
        color: "#e0a8ff",
      })
      .setOrigin(0.5);

    this.add
      .text(
        SCREEN_WIDTH / 2,
        260,
        `George instala ${implantLabel} em Alex.\n\nHabilidade liberada: ${abilityLabel}.`,
        {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#e8ecff",
          align: "center",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(SCREEN_WIDTH / 2, 420, `Carteira: ${this.data$.wallet} créditos`, {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#FFD37C",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100, "ENTER para continuar", {
        fontFamily: "Courier New, monospace",
        fontSize: "20px",
        color: "#8892b0",
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    const proceed = () => {
      if (!this.data$.nextPhaseId) {
        this.scene.start("EndingScene", { ...this.data$, abilities: newAbilities });
        return;
      }
      save.setPhase(this.data$.nextPhaseId);
      this.scene.start("GameScene", {
        phaseId: this.data$.nextPhaseId,
        checkpointX: 0,
        consolidatedCreditIds: [],
        wallet: this.data$.wallet,
        abilities: newAbilities,
      } as GameSceneData);
    };

    this.input.keyboard?.once("keydown-ENTER", proceed);
    this.input.once("pointerdown", proceed);
  }
}

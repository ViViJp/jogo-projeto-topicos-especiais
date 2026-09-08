import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, CAMERA, GRAVITY_Y } from "../config/GameConfig";
import { AbilityState, createInitialAbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { CreditsSystem } from "../systems/CreditsSystem";
import { HUD } from "../systems/HUD";
import { SaveState } from "../systems/SaveState";
import { Player } from "../entities/Player";
import { LevelRuntime } from "../objects/LevelRuntime";
import { LEVELS, getNextPhaseId } from "../levels";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";

export interface GameSceneData {
  phaseId: string;
  checkpointX?: number;
  consolidatedCreditIds?: string[];
  wallet?: number;
  abilities?: AbilityState;
}

const PHASE_BACKGROUND: Record<string, number> = {
  fase1: 0x0a1410,
  "fase2-intro": 0x140f0a,
};

export class GameScene extends Phaser.Scene {
  private input$!: InputManager;
  private player!: Player;
  private runtime!: LevelRuntime;
  private credits!: CreditsSystem;
  private hud!: HUD;
  private save!: SaveState;
  private data$!: Required<GameSceneData>;
  private isPaused = false;
  private pauseText?: Phaser.GameObjects.Text;
  private scanOverlay?: Phaser.GameObjects.Rectangle;
  private restarting = false;

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    this.data$ = {
      phaseId: data.phaseId,
      checkpointX: data.checkpointX ?? 0,
      consolidatedCreditIds: data.consolidatedCreditIds ?? [],
      wallet: data.wallet ?? 0,
      abilities: data.abilities ?? createInitialAbilityState(),
    };
    this.restarting = false;
  }

  create(): void {
    generatePlaceholderTextures(this);

    const level = LEVELS[this.data$.phaseId];
    this.physics.world.gravity.y = GRAVITY_Y;
    this.physics.world.setBounds(0, 0, level.length + SCREEN_WIDTH, SCREEN_HEIGHT);
    this.cameras.main.setBackgroundColor(PHASE_BACKGROUND[level.id] ?? 0x0a0a10);

    this.save = SaveState.load();
    this.input$ = new InputManager(this);
    this.credits = new CreditsSystem(this.data$.wallet, this.data$.consolidatedCreditIds);
    this.hud = new HUD(this);

    const spawnX = this.data$.checkpointX > 0 ? this.data$.checkpointX : level.playerSpawnX;
    this.player = new Player(this, spawnX, level.groundY, this.data$.abilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    this.runtime = new LevelRuntime(
      this,
      level,
      new Set(this.data$.consolidatedCreditIds),
      {
        onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
        onCheckpoint: (_id, x) => this.handleCheckpoint(x),
        onEndGate: () => this.handleEndGate(),
      }
    );
    this.physics.add.collider(this.player.sprite, this.runtime.groundGroup);
    // Cano/fios (seção 14.8): colisão real (não um truque de posição em X),
    // então pular não adianta e só quem está deslizando (hitbox baixa)
    // passa por baixo sem sobrepor o obstáculo.
    this.physics.add.overlap(this.player.sprite, this.runtime.overheadGroup, () => {
      if (this.player.getState() !== "sliding") {
        this.player.kill();
      }
    });

    this.updateHud();
    this.hud.flashPrompt(level.name, 1800);

    this.cameras.main.setBounds(0, 0, level.length + SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  private phaseConsolidatedValue(): number {
    // valor consolidado desta fase = créditos da fase cujos ids já estão consolidados
    const level = LEVELS[this.data$.phaseId];
    const ids = new Set(this.credits.getConsolidatedIds());
    return level.credits.filter((c) => ids.has(c.id)).reduce((sum, c) => sum + c.value, 0);
  }

  private updateHud(): void {
    const level = LEVELS[this.data$.phaseId];
    const phaseTotalValue = level.credits.reduce((s, c) => s + c.value, 0);
    const phaseValue = this.credits.getPhaseDisplayValue(this.phaseConsolidatedValue());
    this.hud.setCredits(phaseValue, phaseTotalValue, this.credits.getTotal());

    const labels: string[] = [];
    if (this.data$.abilities.legs) labels.push("[Pernas: Salto Duplo]");
    if (this.data$.abilities.arms) labels.push("[Braços: Ataque]");
    if (this.data$.abilities.eyes) labels.push("[Olhos: Scan]");
    if (this.data$.abilities.thrusters) labels.push("[Propulsores: Dash]");
    this.hud.setAbilities(labels);
  }

  private handleCreditCollected(id: string, value: number): void {
    this.credits.collect(id, value);
    this.updateHud();
  }

  private handleCheckpoint(x: number): void {
    this.credits.consolidate();
    this.save.updateCheckpoint(x, this.credits.getConsolidatedIds(), this.credits.getTotal());
    this.data$.checkpointX = x;
    this.updateHud();
    this.hud.flashPrompt("Checkpoint alcançado — créditos consolidados");
  }

  private handleEndGate(): void {
    this.credits.consolidate();
    this.save.updateCheckpoint(this.player.sprite.x, this.credits.getConsolidatedIds(), this.credits.getTotal());
    this.updateHud();

    const nextPhaseId = getNextPhaseId(this.data$.phaseId);
    // A clínica de George instala um novo implante ao final de cada uma das
    // quatro primeiras fases (seção 11.1). Este protótipo implementa apenas
    // a Fase 1 completa + o início da Fase 2 (Marco 2 - Vertical Slice), então
    // só a Fase 1 leva à clínica; o fim da Fase 2 (ainda incompleta) encerra
    // no roteiro/roadmap em vez de instalar os braços prematuramente.
    const destination = this.data$.phaseId === "fase1" ? "ClinicScene" : "EndingScene";

    this.time.delayedCall(300, () => {
      this.scene.start(destination, {
        completedPhaseId: this.data$.phaseId,
        nextPhaseId,
        wallet: this.credits.getTotal(),
        abilities: this.data$.abilities,
      });
    });
  }

  private handlePlayerDeath(): void {
    if (this.restarting) return;
    this.restarting = true;
    this.credits.discardUncollected();
    this.cameras.main.shake(150, 0.01);
    this.hud.flashPrompt("Alex não resistiu — reiniciando do checkpoint", 900);

    this.time.delayedCall(700, () => {
      this.scene.restart({
        phaseId: this.data$.phaseId,
        checkpointX: this.data$.checkpointX,
        consolidatedCreditIds: this.credits.getConsolidatedIds(),
        wallet: this.credits.getTotal(),
        abilities: this.data$.abilities,
      } as GameSceneData);
    });
  }

  private handleScanPulse(active: boolean): void {
    if (active) {
      if (!this.scanOverlay) {
        this.scanOverlay = this.add
          .rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x36e2ff, 0.08)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(900);
      }
      this.scanOverlay.setVisible(true);
    } else if (this.scanOverlay) {
      this.scanOverlay.setVisible(false);
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.pauseText = this.add
        .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "PAUSADO\nESC para voltar | ENTER para reiniciar a fase", {
          fontFamily: "Courier New, monospace",
          fontSize: "26px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "#000000aa",
          padding: { x: 20, y: 16 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2000);
    } else {
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.pauseText?.destroy();
      this.pauseText = undefined;
    }
  }

  update(_time: number, delta: number): void {
    if (this.restarting) return;

    if (this.input$.isPauseJustDown()) {
      this.togglePause();
    }

    if (this.isPaused) {
      if (this.isPaused && this.input$.isConfirmJustDown()) {
        this.togglePause();
        this.scene.restart({
          phaseId: this.data$.phaseId,
          checkpointX: this.data$.checkpointX,
          consolidatedCreditIds: this.credits.getConsolidatedIds(),
          wallet: this.credits.getTotal(),
          abilities: this.data$.abilities,
        } as GameSceneData);
      }
      this.input$.postUpdate();
      return;
    }

    this.player.update(delta);
    this.runtime.update(this.player);

    const level = LEVELS[this.data$.phaseId];
    const targetScrollX = Phaser.Math.Clamp(
      this.player.sprite.x - SCREEN_WIDTH * CAMERA.playerScreenRatioX,
      0,
      Math.max(0, level.length - SCREEN_WIDTH)
    );
    this.cameras.main.scrollX = targetScrollX;

    this.input$.postUpdate();
  }
}

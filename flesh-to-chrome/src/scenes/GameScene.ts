import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, CAMERA, GRAVITY_Y } from "../config/GameConfig";
import { AbilityState, createInitialAbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { CreditsSystem } from "../systems/CreditsSystem";
import { HUD } from "../systems/HUD";
import { SaveState } from "../systems/SaveState";
import { Player } from "../entities/Player";
import { LevelRuntime } from "../objects/LevelRuntime";
import { TiledLevelRuntime } from "../objects/TiledLevelRuntime";
import { LEVELS, getNextPhaseId } from "../levels";
import {
  TILED_FASE1_MAP_KEY,
  TILED_FASE1_TILESET_KEY,
  TILED_FASE1_MAP_DATA,
  TILED_FASE1_BACKGROUND,
  TILED_FASE1_NAME,
} from "../levels/TiledFase1";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";
import { ALEX_TEXTURE_KEY, ALEX_SHEET_CONFIG } from "../utils/AlexSprite";

export interface GameSceneData {
  phaseId: string;
  checkpointX?: number;
  consolidatedCreditIds?: string[];
  wallet?: number;
  abilities?: AbilityState;
}

/**
 * Fundo por fase. Ajustado em v0.2.1 (feedback de playtest: "o personagem
 * continua como se tivesse uma sombra"). A causa não era um bug de
 * renderização - a arte LPC de Alex não tem nenhuma camada de sombra
 * própria (checado pixel a pixel: alpha só 0 ou 255 no PNG). O problema é
 * de contraste: os tons de sombreado da própria arte (cabelo cobrindo um
 * olho, calça) incluem um tom quase idêntico ao fundo antigo da Fase 1
 * (a calça tem #101414, o fundo era #0a1410 - distância de cor ~7, quase
 * imperceptível), então esses pedaços do personagem "sumiam" visualmente
 * no fundo e davam a impressão de uma sombra grudada nele. As cores abaixo
 * mantêm o mesmo nível de escuridão/clima (não é um fundo claro), só
 * deslocadas o suficiente (medido contra os tons mais escuros do
 * spritesheet) para nenhum tom da arte coincidir com o fundo.
 *
 * `fase1` usa o mesmo valor de `TILED_FASE1_BACKGROUND` (v0.3.0, mapa Tiled
 * real) - mantido aqui também para o caso (não usado hoje) de a Fase 1
 * cair de volta no formato desenhado à mão.
 */
const PHASE_BACKGROUND: Record<string, number> = {
  fase1: TILED_FASE1_BACKGROUND,
  "fase2-intro": 0x100802,
};

/**
 * v0.3.0 - a Fase 1 volta a usar o mapa Tiled real
 * (`src/assets/maps/esgoto/fase-1.json`), desta vez seguindo o contrato
 * `TILED_PHASER_CONTRACT1.md` entregue pelo level designer (ver
 * `TiledLevelRuntime.ts`/`TiledFase1.ts`). A física NÃO foi recalibrada
 * (continua 320px/s / gravidade 1600, os valores "bons" da v0.2.1) - só o
 * chão/objetos passam a vir do mapa real; a Fase 2 em diante continua no
 * formato desenhado à mão até terem seu próprio contrato.
 */
function isTiledPhase(phaseId: string): boolean {
  return phaseId === "fase1";
}

export class GameScene extends Phaser.Scene {
  private input$!: InputManager;
  private player!: Player;
  private legacyRuntime?: LevelRuntime;
  private tiledRuntime?: TiledLevelRuntime;
  private credits!: CreditsSystem;
  private hud!: HUD;
  private save!: SaveState;
  private data$!: Required<GameSceneData>;
  private isPaused = false;
  private pauseText?: Phaser.GameObjects.Text;
  private scanOverlay?: Phaser.GameObjects.Rectangle;
  private restarting = false;
  private levelLengthPx = 0;

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

  preload(): void {
    // Alex usa o spritesheet LPC real (v0.2.0) em ambos os formatos de
    // nível (Tiled ou desenhado à mão - v0.2.1 revert não mexeu nisso).
    if (!this.textures.exists(ALEX_TEXTURE_KEY)) {
      this.load.spritesheet(ALEX_TEXTURE_KEY, this.alexUrl().href, ALEX_SHEET_CONFIG);
    }

    if (isTiledPhase(this.data$.phaseId)) {
      if (!this.textures.exists(TILED_FASE1_TILESET_KEY)) {
        this.load.image(TILED_FASE1_TILESET_KEY, this.tilesetSewerUrl().href);
      }
      // O JSON do mapa já foi importado estaticamente (ver TiledFase1.ts) -
      // vai direto pro cache de tilemap do Phaser, sem passar pelo loader
      // de rede (que exigiria uma URL servindo JSON puro - o pipeline de
      // JSON do Parcel sempre empacota `.json` como módulo JS, não como
      // asset copiável cru).
      if (!this.cache.tilemap.exists(TILED_FASE1_MAP_KEY)) {
        this.cache.tilemap.add(TILED_FASE1_MAP_KEY, {
          format: Phaser.Tilemaps.Formats.TILED_JSON,
          data: TILED_FASE1_MAP_DATA,
        });
      }
    }
  }

  private alexUrl(): URL {
    return new URL("../assets/player/alex-flesh/alex-flesh.png", import.meta.url);
  }

  private tilesetSewerUrl(): URL {
    return new URL("../assets/tiles/esgoto/tiles/tilesetSewer.png", import.meta.url);
  }

  create(): void {
    generatePlaceholderTextures(this);

    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor(PHASE_BACKGROUND[this.data$.phaseId] ?? 0x0a0a10);

    this.save = SaveState.load();
    this.input$ = new InputManager(this);
    this.credits = new CreditsSystem(this.data$.wallet, this.data$.consolidatedCreditIds);
    this.hud = new HUD(this);

    if (isTiledPhase(this.data$.phaseId)) {
      this.createTiled();
    } else {
      this.createLegacy();
    }

    this.updateHud();

    this.physics.world.setBounds(0, 0, this.levelLengthPx + SCREEN_WIDTH, SCREEN_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.levelLengthPx + SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  private createTiled(): void {
    const runtime = new TiledLevelRuntime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (_id, x) => this.handleCheckpoint(x),
      onEndGate: (destination) => this.handleEndGate(destination),
    });
    this.tiledRuntime = runtime;
    this.levelLengthPx = runtime.lengthPx;

    const spawnX = this.data$.checkpointX > 0 ? this.data$.checkpointX : runtime.spawn.x;
    this.player = new Player(this, spawnX, runtime.spawn.y, this.data$.abilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);

    this.hud.flashPrompt(TILED_FASE1_NAME, 1800);
  }

  private createLegacy(): void {
    const level = LEVELS[this.data$.phaseId];
    this.levelLengthPx = level.length;

    const spawnX = this.data$.checkpointX > 0 ? this.data$.checkpointX : level.playerSpawnX;
    this.player = new Player(this, spawnX, level.groundY, this.data$.abilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    const runtime = new LevelRuntime(this, level, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (_id, x) => this.handleCheckpoint(x),
      onEndGate: () => this.handleEndGate(),
    });
    this.legacyRuntime = runtime;

    this.physics.add.collider(this.player.sprite, runtime.groundGroup);
    // Cano/fios (seção 14.8): colisão real (não um truque de posição em X),
    // então pular não adianta e só quem está deslizando (hitbox baixa)
    // passa por baixo sem sobrepor o obstáculo.
    this.physics.add.overlap(this.player.sprite, runtime.overheadGroup, () => {
      if (this.player.getState() !== "sliding") {
        this.player.kill();
      }
    });

    this.hud.flashPrompt(level.name, 1800);
  }

  /** Créditos da fase atual, num formato comum aos dois formatos de nível (Tiled/desenhado à mão). */
  private phaseCredits(): Array<{ id: string; value: number }> {
    if (this.tiledRuntime) return this.tiledRuntime.credits;
    return LEVELS[this.data$.phaseId].credits;
  }

  private phaseConsolidatedValue(): number {
    // valor consolidado desta fase = créditos da fase cujos ids já estão consolidados
    const ids = new Set(this.credits.getConsolidatedIds());
    return this.phaseCredits()
      .filter((c) => ids.has(c.id))
      .reduce((sum, c) => sum + c.value, 0);
  }

  private updateHud(): void {
    const phaseTotalValue = this.phaseCredits().reduce((s, c) => s + c.value, 0);
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

  /**
   * `destinationOverride` vem do objeto `clinic` do mapa Tiled (propriedade
   * `next`, ainda não formalizada no contrato - ver `TiledLevelRuntime.ts`);
   * o nível desenhado à mão não tem esse objeto, então usa a mesma regra
   * fixa de antes.
   */
  private handleEndGate(destinationOverride?: string): void {
    this.credits.consolidate();
    this.save.updateCheckpoint(this.player.sprite.x, this.credits.getConsolidatedIds(), this.credits.getTotal());
    this.updateHud();

    const nextPhaseId = getNextPhaseId(this.data$.phaseId);
    // A clínica de George instala um novo implante ao final de cada uma das
    // quatro primeiras fases (seção 11.1). Este protótipo implementa apenas
    // a Fase 1 completa + o início da Fase 2 (Marco 2 - Vertical Slice), então
    // só a Fase 1 leva à clínica; o fim da Fase 2 (ainda incompleta) encerra
    // no roteiro/roadmap em vez de instalar os braços prematuramente.
    const destination = destinationOverride ?? (this.data$.phaseId === "fase1" ? "ClinicScene" : "EndingScene");

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
    if (this.tiledRuntime) {
      this.tiledRuntime.update(this.player);
    } else {
      this.legacyRuntime!.update(this.player);
    }

    // Câmera: valores inteiros (Math.floor) para não somar jitter de
    // sub-pixel ao scroll - correção do "tremor de tela" (v0.2.0), mantida
    // independente do formato do nível: não tem relação com o mapa, é
    // sobre a câmera + pixelArt.
    const targetScrollX = Math.floor(
      Phaser.Math.Clamp(
        this.player.sprite.x - SCREEN_WIDTH * CAMERA.playerScreenRatioX,
        0,
        Math.max(0, this.levelLengthPx - SCREEN_WIDTH)
      )
    );
    this.cameras.main.scrollX = targetScrollX;

    this.input$.postUpdate();
  }
}

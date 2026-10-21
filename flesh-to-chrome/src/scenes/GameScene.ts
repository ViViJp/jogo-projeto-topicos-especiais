import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT, CAMERA, GRAVITY_Y } from "../config/GameConfig";
import { AbilityState, createInitialAbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { CreditsSystem } from "../systems/CreditsSystem";
import { HUD } from "../systems/HUD";
import { SaveState } from "../systems/SaveState";
import { Player } from "../entities/Player";
import { LevelRuntime } from "../objects/LevelRuntime";
import { TILED_CHECKPOINT_TEXTURE_KEY, TiledLevelRuntime } from "../objects/TiledLevelRuntime";
import { LEVELS, getNextPhaseId } from "../levels";
import {
  TILED_FASE1_MAP_KEY,
  TILED_FASE1_TILESET_KEY,
  TILED_FASE1_TILESET2_KEY,
  TILED_FASE1_MAP_DATA,
  TILED_FASE1_BACKGROUND,
  TILED_FASE1_NAME,
} from "../levels/TiledFase1";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";
import { ALEX_TEXTURE_KEY, ALEX_SHEET_CONFIG } from "../utils/AlexSprite";

export interface GameSceneData {
  phaseId: string;
  checkpointX?: number;
  /**
   * v0.4.0 bugfix: o mapa novo da Fase 1 tem duas elevações de chão
   * (a "profunda" do spawn e a "principal" depois do degrau). Antes só o X
   * do checkpoint era guardado, e o respawn sempre usava o Y do spawn
   * inicial (calibrado pra elevação profunda) - se o checkpoint ficasse na
   * elevação principal (mais alto na tela, como o único checkpoint real do
   * mapa fica), o personagem reaparecia ~80px abaixo do chão de verdade,
   * direto num vão sem fundo, e entrava num loop de queda/morte/respawn no
   * mesmo lugar quebrado (parecia "cair infinitamente"). Ver
   * `TiledLevelRuntime.ts` e `handleCheckpoint`/`handlePlayerDeath` abaixo.
   */
  checkpointY?: number;
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
 * v0.4.2 bugfix: `fase2-intro` tinha o próprio valor fixo (`0x100802`,
 * luminância ~9,7 - quase preto) NUNCA recalibrado nas rodadas anteriores
 * de ajuste de sombra (v0.4.1 só mexeu em `TILED_FASE1_BACKGROUND`) - e o
 * vídeo de gameplay usado pra validar o pedido "sombra desagradável" era
 * justamente da Fase 2. Resultado: pra quem jogou a Fase 2, o fundo
 * realmente não mudava nada entre versões, batendo com o relato "a única
 * coisa que alterou foi a cor do mapa". Corrigido reaproveitando a mesma
 * constante calibrada por luminância de `TILED_FASE1_BACKGROUND` (mesma
 * arte de Alex nas duas fases, então o mesmo valor vale) - e o fallback
 * (linha abaixo, `?? 0x0a0a10`) também foi trocado por segurança, mesmo
 * sem nenhuma fase caindo nele hoje.
 */
const PHASE_BACKGROUND: Record<string, number> = {
  fase1: TILED_FASE1_BACKGROUND,
  "fase2-intro": TILED_FASE1_BACKGROUND,
  fase3: TILED_FASE1_BACKGROUND,
  fase4: TILED_FASE1_BACKGROUND,
  fase5: TILED_FASE1_BACKGROUND,
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
  private activeAbilities!: AbilityState;
  private restarting = false;
  private levelLengthPx = 0;

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    this.data$ = {
      phaseId: data.phaseId,
      checkpointX: data.checkpointX ?? 0,
      checkpointY: data.checkpointY ?? 0,
      consolidatedCreditIds: data.consolidatedCreditIds ?? [],
      wallet: data.wallet ?? 0,
      abilities: data.abilities ?? createInitialAbilityState(),
    };
    this.restarting = false;
    // Cada prévia ativa apenas as mecânicas já apresentadas na campanha.
    // Isso também corrige saves antigos que tenham sido gravados com
    // implantes adiantados ou sem os braços ao entrar na Fase 3.
    const savedAbilities = data.abilities ?? createInitialAbilityState();
    if (data.phaseId === "fase1") {
      this.activeAbilities = { legs: false, arms: false, eyes: false, thrusters: false };
    } else if (data.phaseId === "fase2-intro") {
      this.activeAbilities = { legs: true, arms: false, eyes: false, thrusters: false };
    } else if (data.phaseId === "fase3") {
      this.activeAbilities = { legs: true, arms: true, eyes: false, thrusters: false };
    } else if (data.phaseId === "fase4") {
      this.activeAbilities = { legs: true, arms: true, eyes: true, thrusters: false };
    } else if (data.phaseId === "fase5") {
      this.activeAbilities = { legs: true, arms: true, eyes: true, thrusters: true };
    } else {
      this.activeAbilities = savedAbilities;
    }
  }

  preload(): void {
    // Alex usa o spritesheet LPC real (v0.2.0) em ambos os formatos de
    // nível (Tiled ou desenhado à mão - v0.2.1 revert não mexeu nisso).
    if (!this.textures.exists(ALEX_TEXTURE_KEY)) {
      this.load.spritesheet(ALEX_TEXTURE_KEY, this.alexUrl().href, ALEX_SHEET_CONFIG);
    }
    if (!this.textures.exists("alex-eyes")) {
      this.load.spritesheet("alex-eyes", this.alexEyesUrl().href, ALEX_SHEET_CONFIG);
    }

    if (this.data$.phaseId === "fase1") {
      if (!this.textures.exists(TILED_FASE1_TILESET_KEY)) {
        this.load.image(TILED_FASE1_TILESET_KEY, this.tilesetSewerUrl().href);
      }
      if (!this.textures.exists(TILED_FASE1_TILESET2_KEY)) {
        this.load.image(TILED_FASE1_TILESET2_KEY, this.tilesetCrystalCaveUrl().href);
      }
      if (!this.textures.exists("enemy-bandido")) {
        this.load.spritesheet("enemy-bandido", this.enemyBandidoUrl().href, { frameWidth: 48, frameHeight: 48 });
      }
      if (!this.textures.exists("enemy-drone")) {
        this.load.spritesheet("enemy-drone", this.enemyDroneUrl().href, { frameWidth: 32, frameHeight: 32 });
      }
      if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
        this.load.image(TILED_CHECKPOINT_TEXTURE_KEY, this.checkpointTvUrl().href);
      }
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

  private alexEyesUrl(): URL {
    return new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url);
  }

  private tilesetSewerUrl(): URL {
    return new URL("../assets/tiles/esgoto/tiles/tilesetSewer.png", import.meta.url);
  }

  private tilesetCrystalCaveUrl(): URL {
    return new URL("../assets/tiles/esgoto/crystal-cave-tiles.png", import.meta.url);
  }

  private enemyBandidoUrl(): URL {
    return new URL("../assets/npcs/enemies/bandido/bandido.png", import.meta.url);
  }

  private enemyDroneUrl(): URL {
    return new URL("../assets/npcs/enemies/drone/drone.png", import.meta.url);
  }

  private checkpointTvUrl(): URL {
    return new URL("../assets/props/checkpoint/tv-checkpoint.png", import.meta.url);
  }


  create(): void {
    generatePlaceholderTextures(this);

    this.physics.world.gravity.y = GRAVITY_Y;
    this.cameras.main.setBackgroundColor(PHASE_BACKGROUND[this.data$.phaseId] ?? TILED_FASE1_BACKGROUND);

    this.save = SaveState.load();
    this.input$ = new InputManager(this);
    this.credits = new CreditsSystem(this.data$.wallet, this.data$.consolidatedCreditIds);
    this.hud = new HUD(this);
    this.events.on("player-attack", () => this.hud.flashPrompt("ATAQUE", 220));
    this.events.on("player-dash-start", () => this.hud.flashPrompt("DASH", 220));

    if (this.data$.phaseId === "fase1") {
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
      onCheckpoint: (_id, x, y) => this.handleCheckpoint(x, y),
      onEndGate: (destination) => this.handleEndGate(destination),
    });
    this.tiledRuntime = runtime;
    this.levelLengthPx = runtime.lengthPx;

    const spawnX = this.data$.checkpointX > 0 ? this.data$.checkpointX : runtime.spawn.x;
    const spawnY = this.data$.checkpointX > 0 ? this.data$.checkpointY : runtime.spawn.y;
    this.player = new Player(this, spawnX, spawnY, this.activeAbilities, this.input$, {
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
    // Nível desenhado à mão tem uma elevação só - checkpointY (quando vem de
    // um checkpoint de verdade) sempre bate com level.groundY de qualquer
    // forma, mas usa a mesma lógica do path Tiled por consistência.
    const spawnY = this.data$.checkpointX > 0 ? this.data$.checkpointY : level.groundY;
    this.player = new Player(this, spawnX, spawnY, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    const runtime = new LevelRuntime(this, level, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (_id, x, y) => this.handleCheckpoint(x, y),
      onEndGate: () => this.handleEndGate(),
    });
    this.legacyRuntime = runtime;
    runtime.registerBreakablePhysics(this.player);
    runtime.registerAbilityGatePhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());

    this.physics.add.collider(this.player.sprite, runtime.groundGroup, () => {
      const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (!body) return;
      // `blocked.left/right` pode vir da barricada no mesmo passo de física
      // em que este callback do chão é executado. Se Alex está apoiado no
      // piso (`blocked.down`), isso não é uma colisão lateral com o terreno.
      if (!body.blocked.down && (body.blocked.left || body.blocked.right || body.blocked.up)) {
        this.player.kill();
      }
    });
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
    if (this.activeAbilities.legs) labels.push("[Pernas: Salto Duplo]");
    if (this.activeAbilities.arms) labels.push("[Braços: Ataque]");
    if (this.activeAbilities.eyes) labels.push("[Olhos: Scan]");
    if (this.activeAbilities.thrusters) labels.push("[Propulsores: Dash]");
    this.hud.setAbilities(labels);
  }

  private handleCreditCollected(id: string, value: number): void {
    this.credits.collect(id, value);
    this.updateHud();
  }

  private handleCheckpoint(x: number, y: number): void {
    this.credits.consolidate();
    this.save.updateCheckpoint(x, y, this.credits.getConsolidatedIds(), this.credits.getTotal());
    this.data$.checkpointX = x;
    this.data$.checkpointY = y;
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
    this.save.updateCheckpoint(
      this.player.sprite.x,
      this.player.sprite.y,
      this.credits.getConsolidatedIds(),
      this.credits.getTotal()
    );
    this.updateHud();

    const nextPhaseId = getNextPhaseId(this.data$.phaseId);
    // A clínica de George instala um novo implante ao final de cada uma das
    // fases implementadas (seção 11.1). No fim da prévia da Fase 2, a clínica
    // libera os braços e continua para a prévia da Fase 3 registrada em
    // `PHASE_ORDER`.
    const phasesWithClinic = new Set(["fase1", "fase2-intro", "fase3", "fase4"]);
    const destination = destinationOverride ??
      (phasesWithClinic.has(this.data$.phaseId) ? "ClinicScene" : "EndingScene");

    this.time.delayedCall(300, () => {
      this.scene.start(destination, {
        completedPhaseId: this.data$.phaseId,
        nextPhaseId,
        wallet: this.credits.getTotal(),
        abilities: this.activeAbilities,
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
        checkpointY: this.data$.checkpointY,
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
      this.scanOverlay.setAlpha(0.16);
      this.hud.flashPrompt("VISOR ATIVO — rotas e armadilhas detectadas", 750);
      this.tiledRuntime?.setScanActive(true);
      this.legacyRuntime?.setScanActive(true, this.player.sprite.x);
    } else {
      this.scanOverlay?.setVisible(false);
      this.tiledRuntime?.setScanActive(false);
      this.legacyRuntime?.setScanActive(false, this.player.sprite.x);
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.pauseText = this.add
        .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "PAUSADO\nESC / START para voltar | ENTER / A para reiniciar a fase", {
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
          checkpointY: this.data$.checkpointY,
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

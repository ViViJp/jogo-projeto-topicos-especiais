import Phaser from "phaser";
import { CAMERA, GRAVITY_Y, GAMEPLAY_TIMING } from "../config/GameConfig";
import { AbilityState, createInitialAbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { CreditsSystem } from "../systems/CreditsSystem";
import { HUD } from "../systems/HUD";
import { SaveState } from "../systems/SaveState";
import { descentRouteForPhase, descentStepForPhase } from "../systems/DescentProgression";
import { DescentGlitchRuntime, DESCENT_GLITCH_TEXTURE_PREFIX } from "../objects/DescentGlitchRuntime";
import {
  DESCENT_ATTACK_BARRIER_TEXTURE_KEY,
  DESCENT_REFORGE_DOOR_CLOSED_KEY,
  DESCENT_REFORGE_DOOR_OPEN_KEY,
  DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY,
  DescentRouteRuntime,
} from "../objects/DescentRouteRuntime";
import { Player } from "../entities/Player";
import { LevelRuntime } from "../objects/LevelRuntime";
import {
  TILED_CHECKPOINT_TEXTURE_KEY,
  TILED_ELECTRIC_WIRE_TEXTURE_KEY,
  TiledLevelRuntime,
} from "../objects/TiledLevelRuntime";
import {
  TILED_PHASE2_PRESS_TEXTURE_KEY,
  TILED_PHASE2_STEAM_TEXTURE_KEY,
  TiledPhase2Runtime,
} from "../objects/TiledPhase2Runtime";
import { TiledPhase3Runtime } from "../objects/TiledPhase3Runtime";
import { ParallaxBackdrop, preloadBackdrop } from "../objects/ParallaxBackdrop";
import { TILED_FATHER_AD_TEXTURE_KEY, TiledPhase4Runtime } from "../objects/TiledPhase4Runtime";
import {
  TILED_PHASE5_BARRICADE_TEXTURE_KEY,
  TILED_PHASE5_GATE_TEXTURE_KEY,
  TiledPhase5Runtime,
} from "../objects/TiledPhase5Runtime";
import { LEVELS, getNextPhaseId } from "../levels";
import {
  TILED_FASE1_MAP_KEY,
  TILED_FASE1_TILESET_KEY,
  TILED_FASE1_TILESET2_KEY,
  TILED_FASE1_MAP_DATA,
  TILED_FASE1_BACKGROUND,
  TILED_FASE1_NAME,
  TILED_FASE1_OFFSET_Y,
} from "../levels/TiledFase1";
import {
  TILED_FASE2_MAP_DATA,
  TILED_FASE2_MAP_KEY,
  TILED_FASE2_NAME,
  TILED_FASE2_TILESETS,
  TILED_FASE2_OFFSET_Y,
} from "../levels/TiledFase2";
import {
  TILED_FASE3_MAP_DATA,
  TILED_FASE3_MAP_KEY,
  TILED_FASE3_NAME,
  TILED_FASE3_BARRICADE_TEXTURE_KEY,
  TILED_FASE3_TILESET_KEY,
} from "../levels/TiledFase3";
import {
  TILED_FASE4_MAP_DATA,
  TILED_FASE4_MAP_KEY,
  TILED_FASE4_NAME,
  TILED_FASE4_TILESETS,
  TILED_FASE4_OFFSET_Y,
} from "../levels/TiledFase4";
import {
  TILED_FASE5_BACKGROUND,
  TILED_FASE5_MAP_DATA,
  TILED_FASE5_MAP_KEY,
  TILED_FASE5_NAME,
  TILED_FASE5_TILESETS,
  TILED_FASE5_OFFSET_Y,
} from "../levels/TiledFase5";
import { generatePlaceholderTextures } from "../utils/PlaceholderTextures";
import {
  ALEX_ARMS_TEXTURE_KEY,
  ALEX_DASH_TEXTURE_KEY,
  ALEX_EYES_TEXTURE_KEY,
  ALEX_LEGS_TEXTURE_KEY,
  ALEX_SHEET_CONFIG,
  ALEX_TEXTURE_KEY,
} from "../utils/AlexSprite";

export interface GameSceneData {
  phaseId: string;
  /** Execução iniciada pelo seletor temporário; não altera o save da campanha. */
  testMode?: boolean;
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
  /** Reutiliza o mesmo mapa no caminho inverso narrativo Flesh/Hollow. */
  descent?: boolean;
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
  fase5: TILED_FASE5_BACKGROUND,
};

const CHECKPOINT_SFX_KEY = "sfx-checkpoint";
const PHASES_WITH_CLINIC = new Set(["fase1", "fase2-intro", "fase3", "fase4"]);

interface TestClinicChoiceData {
  completedPhaseId: string;
  nextPhaseId: string | null;
  wallet: number;
  abilities: AbilityState;
  implant?: keyof AbilityState;
}

/**
 * v0.3.0 - a Fase 1 volta a usar o mapa Tiled real
 * (`src/assets/maps/esgoto/fase-1.json`), desta vez seguindo o contrato
 * `docs/TILED_PHASER_CONTRACT.md` entregue pelo level designer (ver
 * `TiledLevelRuntime.ts`/`TiledFase1.ts`). A física NÃO foi recalibrada
 * (continua 320px/s / gravidade 1600, os valores "bons" da v0.2.1) - só o
 * chão/objetos passam a vir do mapa real. As Fases 2, 3, 4 e 5 também usam
 * agora seus blockouts Tiled.
 */
export class GameScene extends Phaser.Scene {
  private input$!: InputManager;
  private player!: Player;
  private legacyRuntime?: LevelRuntime;
  private tiledRuntime?: TiledLevelRuntime;
  private tiledPhase2Runtime?: TiledPhase2Runtime;
  private tiledPhase3Runtime?: TiledPhase3Runtime;
  private tiledPhase4Runtime?: TiledPhase4Runtime;
  private tiledPhase5Runtime?: TiledPhase5Runtime;
  private descentRuntime?: DescentGlitchRuntime;
  private descentRouteRuntime?: DescentRouteRuntime;
  private backdrop?: ParallaxBackdrop;
  private credits!: CreditsSystem;
  private hud!: HUD;
  private save!: SaveState;
  private data$!: Required<GameSceneData>;
  private isPaused = false;
  private pauseText?: Phaser.GameObjects.Text;
  private scanOverlay?: Phaser.GameObjects.Rectangle;
  private activeAbilities!: AbilityState;
  private restarting = false;
  private awaitingTestClinicChoice = false;
  private testClinicWatchSelected = true;
  private testClinicPrompt?: Phaser.GameObjects.Container;
  private testClinicYesText?: Phaser.GameObjects.Text;
  private testClinicNoText?: Phaser.GameObjects.Text;
  private pendingTestClinicData?: TestClinicChoiceData;
  private levelLengthPx = 0;
  private checkpointInteraction?: Phaser.Time.TimerEvent;

  constructor() {
    super("GameScene");
  }

  init(data: GameSceneData): void {
    // A instância da Scene é reutilizada pelo Phaser entre fases. Limpa as
    // referências do runtime anterior para a seleção abaixo não continuar
    // atualizando/consultando uma fase que já sofreu shutdown.
    this.legacyRuntime = undefined;
    this.tiledRuntime = undefined;
    this.tiledPhase2Runtime = undefined;
    this.tiledPhase3Runtime = undefined;
    this.tiledPhase4Runtime = undefined;
    this.tiledPhase5Runtime = undefined;
    this.descentRuntime = undefined;
    this.descentRouteRuntime = undefined;
    this.backdrop = undefined;
    this.isPaused = false;
    this.pauseText = undefined;
    this.scanOverlay = undefined;
    this.checkpointInteraction = undefined;
    this.awaitingTestClinicChoice = false;
    this.testClinicWatchSelected = true;
    this.testClinicPrompt = undefined;
    this.testClinicYesText = undefined;
    this.testClinicNoText = undefined;
    this.pendingTestClinicData = undefined;
    this.data$ = {
      phaseId: data.phaseId,
      testMode: data.testMode ?? false,
      checkpointX: data.checkpointX ?? 0,
      checkpointY: data.checkpointY ?? 0,
      consolidatedCreditIds: data.consolidatedCreditIds ?? [],
      wallet: data.wallet ?? 0,
      abilities: data.abilities ?? createInitialAbilityState(),
      descent: data.descent ?? false,
    };
    this.restarting = false;
    // Cada prévia ativa apenas as mecânicas já apresentadas na campanha.
    // Isso também corrige saves antigos que tenham sido gravados com
    // implantes adiantados ou sem os braços ao entrar na Fase 3.
    const savedAbilities = data.abilities ?? createInitialAbilityState();
    if (!this.data$.testMode || this.data$.descent) {
      // Campanha sempre respeita o estado persistido. Isto impede que uma
      // habilidade removida pela ReForge reapareca por causa da fase.
      this.activeAbilities = { ...savedAbilities };
    } else if (data.phaseId === "fase1") {
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
    const alexStages: Array<{ key: string; url: URL }> = [
      { key: ALEX_TEXTURE_KEY, url: new URL("../assets/player/alex-flesh/alex-flesh.png", import.meta.url) },
      { key: ALEX_LEGS_TEXTURE_KEY, url: new URL("../assets/player/alex-legs/alex-legs.png", import.meta.url) },
      { key: ALEX_ARMS_TEXTURE_KEY, url: new URL("../assets/player/alex-arms/alex-arms.png", import.meta.url) },
      { key: ALEX_EYES_TEXTURE_KEY, url: new URL("../assets/player/alex-eyes/alex-eyes.png", import.meta.url) },
      { key: ALEX_DASH_TEXTURE_KEY, url: new URL("../assets/player/alex-dash/alex-dash.png", import.meta.url) },
    ];
    for (const stage of alexStages) {
      if (!this.textures.exists(stage.key)) {
        this.load.spritesheet(stage.key, stage.url.href, ALEX_SHEET_CONFIG);
      }
    }
    if (this.data$.descent) {
      if (!this.textures.exists(DESCENT_ATTACK_BARRIER_TEXTURE_KEY)) {
        this.load.image(
          DESCENT_ATTACK_BARRIER_TEXTURE_KEY,
          new URL("../assets/props/obstacles/reforge-security-seal.png", import.meta.url).href,
        );
      }
      if (!this.textures.exists(DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY)) {
        this.load.image(
          DESCENT_URBAN_ELECTRIC_FLOOR_TEXTURE_KEY,
          new URL("../assets/props/hazards/urban-electric-floor.png", import.meta.url).href,
        );
      }
      if (!this.textures.exists(DESCENT_REFORGE_DOOR_CLOSED_KEY)) {
        this.load.image(
          DESCENT_REFORGE_DOOR_CLOSED_KEY,
          new URL("../assets/narrative/reforge-door/reforge-door-closed.png", import.meta.url).href,
        );
      }
      if (!this.textures.exists(DESCENT_REFORGE_DOOR_OPEN_KEY)) {
        this.load.image(
          DESCENT_REFORGE_DOOR_OPEN_KEY,
          new URL("../assets/narrative/reforge-door/reforge-door-open.png", import.meta.url).href,
        );
      }
      const fragmentAssets = [
        { id: "topo", url: new URL("../assets/narrative/fragments/fragmento-topo.png", import.meta.url) },
        { id: "corporativo", url: new URL("../assets/narrative/fragments/fragmento-corporativo.png", import.meta.url) },
        { id: "urbano", url: new URL("../assets/narrative/fragments/fragmento-urbano.png", import.meta.url) },
        { id: "industrial", url: new URL("../assets/narrative/fragments/fragmento-industrial.png", import.meta.url) },
      ] as const;
      for (const fragment of fragmentAssets) {
        const key = `${DESCENT_GLITCH_TEXTURE_PREFIX}-${fragment.id}`;
        if (!this.textures.exists(key)) {
          this.load.image(key, fragment.url.href);
        }
      }
    }
    if (!this.cache.audio.exists(CHECKPOINT_SFX_KEY)) {
      this.load.audio(
        CHECKPOINT_SFX_KEY,
        new URL("../assets/audio/sfx/sfx-checkpoint.wav", import.meta.url).href,
      );
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
      if (!this.textures.exists(TILED_ELECTRIC_WIRE_TEXTURE_KEY)) {
        this.load.image(
          TILED_ELECTRIC_WIRE_TEXTURE_KEY,
          new URL("../assets/props/hazards/electric-wire-loose.png", import.meta.url).href,
        );
      }
      if (!this.cache.tilemap.exists(TILED_FASE1_MAP_KEY)) {
        this.cache.tilemap.add(TILED_FASE1_MAP_KEY, {
          format: Phaser.Tilemaps.Formats.TILED_JSON,
          data: TILED_FASE1_MAP_DATA,
        });
      }
    } else if (this.data$.phaseId === "fase2-intro") {
      this.preloadPhase2Map();
    } else if (this.data$.phaseId === "fase3") {
      this.preloadPhase3Map();
    } else if (this.data$.phaseId === "fase4") {
      this.preloadPhase4Map();
    } else if (this.data$.phaseId === "fase5") {
      this.preloadPhase5Map();
    }

    const backdropSource = this.backdropSource();
    if (backdropSource) preloadBackdrop(this, backdropSource.mapData);
  }

  /**
   * Mapa Tiled + deslocamento vertical usados pelo fundo com parallax
   * (image layers do mapa). Para ligar outra fase basta incluí-la aqui e
   * criar as image layers no `.tmj` dela.
   */
  private backdropSource(): { mapData: unknown; offsetY: number } | undefined {
    switch (this.data$.phaseId) {
      case "fase1":
        return { mapData: TILED_FASE1_MAP_DATA, offsetY: TILED_FASE1_OFFSET_Y };
      case "fase2-intro":
        return { mapData: TILED_FASE2_MAP_DATA, offsetY: TILED_FASE2_OFFSET_Y };
      case "fase3":
        return { mapData: TILED_FASE3_MAP_DATA, offsetY: 0 };
      case "fase4":
        return { mapData: TILED_FASE4_MAP_DATA, offsetY: TILED_FASE4_OFFSET_Y };
      case "fase5":
        return { mapData: TILED_FASE5_MAP_DATA, offsetY: TILED_FASE5_OFFSET_Y };
      default:
        return undefined;
    }
  }

  private preloadPhase2Map(): void {
    const assets: Array<{ key: string; url: URL }> = [
      { key: TILED_FASE2_TILESETS[0].key, url: new URL("../assets/tiles/industrial/tiles/1_Industrial_Tileset_1.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[1].key, url: new URL("../assets/tiles/industrial/tiles/1_Industrial_Tileset_1B.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[2].key, url: new URL("../assets/tiles/industrial/tiles/1_Industrial_Tileset_1C.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[3].key, url: new URL("../assets/tiles/industrial/backgrounds/2_Industrial_Tileset_1_Background.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[4].key, url: new URL("../assets/tiles/industrial/backgrounds/2_Industrial_Tileset_1B_Background.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[5].key, url: new URL("../assets/tiles/industrial/backgrounds/2_Industrial_Tileset_1C_Background_Violet.png", import.meta.url) },
      { key: TILED_FASE2_TILESETS[6].key, url: new URL("../assets/tiles/industrial/backgrounds/3_Far_Background_Tile.png", import.meta.url) },
    ];

    for (const asset of assets) {
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url.href);
    }
    if (!this.textures.exists(TILED_PHASE2_STEAM_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE2_STEAM_TEXTURE_KEY,
        new URL("../assets/props/hazards/steam-jet.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_PHASE2_PRESS_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE2_PRESS_TEXTURE_KEY,
        new URL("../assets/props/hazards/hydraulic-press.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
      this.load.image(TILED_CHECKPOINT_TEXTURE_KEY, this.checkpointTvUrl().href);
    }
    if (!this.cache.tilemap.exists(TILED_FASE2_MAP_KEY)) {
      this.cache.tilemap.add(TILED_FASE2_MAP_KEY, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: TILED_FASE2_MAP_DATA,
      });
    }
  }

  private preloadPhase3Map(): void {
    if (!this.textures.exists(TILED_FASE3_TILESET_KEY)) {
      this.load.image(
        TILED_FASE3_TILESET_KEY,
        new URL("../assets/tiles/meio-urbano/ENVIRONMENT/tileset.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists("enemy-bandido")) {
      this.load.spritesheet("enemy-bandido", this.enemyBandidoUrl().href, { frameWidth: 48, frameHeight: 48 });
    }
    if (!this.textures.exists("enemy-drone")) {
      this.load.spritesheet("enemy-drone", this.enemyDroneUrl().href, { frameWidth: 32, frameHeight: 32 });
    }
    if (!this.textures.exists(TILED_FASE3_BARRICADE_TEXTURE_KEY)) {
      this.load.image(
        TILED_FASE3_BARRICADE_TEXTURE_KEY,
        new URL("../assets/props/obstacles/barricade.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
      this.load.image(TILED_CHECKPOINT_TEXTURE_KEY, this.checkpointTvUrl().href);
    }
    if (!this.cache.tilemap.exists(TILED_FASE3_MAP_KEY)) {
      this.cache.tilemap.add(TILED_FASE3_MAP_KEY, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: TILED_FASE3_MAP_DATA,
      });
    }
  }

  private preloadPhase4Map(): void {
    const assets: Array<{ key: string; url: URL }> = [
      {
        key: TILED_FASE4_TILESETS[0].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/tiles/level_tileset.png", import.meta.url),
      },
      {
        key: TILED_FASE4_TILESETS[1].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/decor/full-decor-tiles.png", import.meta.url),
      },
      {
        key: TILED_FASE4_TILESETS[2].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/traps/laser_idle.png", import.meta.url),
      },
      {
        key: TILED_FASE4_TILESETS[3].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/traps/laser_spikes_idle.png", import.meta.url),
      },
      {
        key: TILED_FASE4_TILESETS[4].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/interactive/barrier_idle.png", import.meta.url),
      },
    ];
    for (const asset of assets) {
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url.href);
    }
    if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
      this.load.image(TILED_CHECKPOINT_TEXTURE_KEY, this.checkpointTvUrl().href);
    }
    if (!this.textures.exists(TILED_FATHER_AD_TEXTURE_KEY)) {
      this.load.image(
        TILED_FATHER_AD_TEXTURE_KEY,
        new URL("../assets/narrative/father/propaganda-pai.png", import.meta.url).href,
      );
    }
    if (!this.cache.tilemap.exists(TILED_FASE4_MAP_KEY)) {
      this.cache.tilemap.add(TILED_FASE4_MAP_KEY, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: TILED_FASE4_MAP_DATA,
      });
    }
  }

  private preloadPhase5Map(): void {
    const assets: Array<{ key: string; url: URL }> = [
      {
        key: TILED_FASE5_TILESETS[0].key,
        url: new URL("../assets/tiles/topo/cyber-purp/tileset.png", import.meta.url),
      },
      {
        key: TILED_FASE5_TILESETS[1].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/traps/laser_idle.png", import.meta.url),
      },
      {
        key: TILED_FASE5_TILESETS[2].key,
        url: new URL("../assets/tiles/corporativo/foozle-scifi-lab/interactive/barrier_idle.png", import.meta.url),
      },
    ];
    for (const asset of assets) {
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url.href);
    }
    if (!this.textures.exists(TILED_PHASE5_BARRICADE_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE5_BARRICADE_TEXTURE_KEY,
        new URL("../assets/props/obstacles/phase5-barricade.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_PHASE5_GATE_TEXTURE_KEY)) {
      this.load.image(
        TILED_PHASE5_GATE_TEXTURE_KEY,
        new URL("../assets/narrative/gate/portao.png", import.meta.url).href,
      );
    }
    if (!this.textures.exists(TILED_CHECKPOINT_TEXTURE_KEY)) {
      this.load.image(TILED_CHECKPOINT_TEXTURE_KEY, this.checkpointTvUrl().href);
    }
    if (!this.cache.tilemap.exists(TILED_FASE5_MAP_KEY)) {
      this.cache.tilemap.add(TILED_FASE5_MAP_KEY, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: TILED_FASE5_MAP_DATA,
      });
    }
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
    this.hud.setDashUnlocked(this.activeAbilities.thrusters);
    this.events.on("player-attack", (_x: number, _y: number, showFeedback = true) => {
      if (showFeedback) this.hud.flashPrompt("ATAQUE", 300);
    });
    this.events.on("player-dash-start", (_x: number, _y: number, cooldownMs: number) => {
      this.hud.flashPrompt("DASH", 220);
      this.hud.beginDashCooldown(cooldownMs);
    });
    this.events.on("player-dash-ready", () => this.hud.setDashReady(true));

    if (this.data$.phaseId === "fase1") {
      this.createTiled();
    } else if (this.data$.phaseId === "fase2-intro") {
      this.createTiledPhase2();
    } else if (this.data$.phaseId === "fase3") {
      this.createTiledPhase3();
    } else if (this.data$.phaseId === "fase4") {
      this.createTiledPhase4();
    } else if (this.data$.phaseId === "fase5") {
      this.createTiledPhase5();
    } else {
      this.createLegacy();
    }

    if (this.data$.descent) this.createDescentOverlay();
    const backdropSource = this.backdropSource();
    if (backdropSource) {
      const backdrop = new ParallaxBackdrop(this, backdropSource.mapData, backdropSource.offsetY);
      this.backdrop = backdrop;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => backdrop.destroy());
    }

    this.updateHud();

    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;
    this.physics.world.setBounds(0, 0, this.levelLengthPx + viewportWidth, viewportHeight);
    this.cameras.main.setBounds(0, 0, this.levelLengthPx + viewportWidth, viewportHeight);
    const route = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    if (route) {
      this.cameras.main.scrollX = Math.floor(Phaser.Math.Clamp(
        route.startX - viewportWidth * CAMERA.playerScreenRatioX,
        0,
        Math.max(0, this.levelLengthPx - viewportWidth),
      ));
    }
  }

  private createDescentOverlay(): void {
    const route = descentRouteForPhase(this.data$.phaseId);
    if (!route) throw new Error(`Recorte de descida ausente para ${this.data$.phaseId}`);
    const step = descentStepForPhase(this.data$.phaseId);
    const recovered = step
      ? this.save.get().descentState.recoveredFragmentIds.includes(step.fragmentId)
      : false;
    this.descentRouteRuntime = new DescentRouteRuntime(
      this,
      route,
      () => this.handleEndGate(),
      recovered,
    );
    this.descentRouteRuntime.registerPlayer(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.descentRouteRuntime?.destroy());

    this.tiledRuntime?.hideCredits();
    this.tiledPhase2Runtime?.hideCredits();
    this.tiledPhase3Runtime?.hideCredits();
    this.tiledPhase4Runtime?.hideCredits();
    this.tiledPhase5Runtime?.hideCredits();

    if (!step) {
      this.hud.flashPrompt(route.title, 2200);
      return;
    }
    const map = this.tiledPhase5Runtime?.map
      ?? this.tiledPhase4Runtime?.map
      ?? this.tiledPhase3Runtime?.map
      ?? this.tiledPhase2Runtime?.map;
    if (!map) throw new Error(`Descida sem mapa Tiled para ${this.data$.phaseId}`);
    const offsetY = this.data$.phaseId === "fase3"
      ? 0
      : this.data$.phaseId === "fase2-intro"
        ? TILED_FASE2_OFFSET_Y
        : this.data$.phaseId === "fase4"
          ? TILED_FASE4_OFFSET_Y
          : TILED_FASE5_OFFSET_Y;
    this.descentRuntime = new DescentGlitchRuntime(
      this,
      map,
      offsetY,
      step,
      recovered,
      (fragmentId) => {
        if (!this.save.recoverDescentFragment(fragmentId)) return;
        this.descentRouteRuntime?.setMemoryRecovered(true);
        this.cameras.main.flash(320, 124, 252, 234);
        this.hud.flashPrompt(`MEMORIA RECUPERADA — ${step.memoryTitle}`, 1800);
      },
    );
    this.descentRuntime.registerPlayer(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.descentRuntime?.destroy());
    this.hud.flashPrompt(`${route.title} — encontre o glitch`, 2200);
  }

  private phaseSpawn(defaultX: number, defaultY: number): { x: number; y: number } {
    if (this.data$.checkpointX > 0) {
      return { x: this.data$.checkpointX, y: this.data$.checkpointY };
    }
    const route = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    return route ? { x: route.startX, y: route.startY } : { x: defaultX, y: defaultY };
  }

  private createTiled(): void {
    const descentRoute = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    const runtime = new TiledLevelRuntime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
      onEndGate: (destination, implant) => this.handleEndGate(destination, implant),
    });
    this.tiledRuntime = runtime;
    this.levelLengthPx = runtime.lengthPx;
    if (descentRoute?.epilogue) {
      runtime.prepareDescentEpilogue(descentRoute.startX, descentRoute.endX);
    }

    const spawn = this.phaseSpawn(runtime.spawn.x, runtime.spawn.y);
    this.player = new Player(this, spawn.x, spawn.y, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());

    this.hud.flashPrompt(TILED_FASE1_NAME, 1800);
  }

  private createTiledPhase2(): void {
    const descentRoute = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    const runtime = new TiledPhase2Runtime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
      onEndGate: (destination, implant) => this.handleEndGate(destination, implant),
    }, {
      excludeObstaclesThroughX: descentRoute?.spawnSafeStartPx === undefined
        ? undefined
        : descentRoute.startX + descentRoute.spawnSafeStartPx,
    });
    this.tiledPhase2Runtime = runtime;
    this.levelLengthPx = runtime.lengthPx;

    const spawn = this.phaseSpawn(runtime.spawn.x, runtime.spawn.y);
    this.player = new Player(this, spawn.x, spawn.y, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());
    this.hud.flashPrompt(TILED_FASE2_NAME, 1800);
  }

  private createTiledPhase3(): void {
    const descentRoute = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    const runtime = new TiledPhase3Runtime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
      onEndGate: (destination, implant) => this.handleEndGate(destination, implant),
    }, {
      excludeEnemiesThroughX: descentRoute?.spawnSafeStartPx === undefined
        ? undefined
        : descentRoute.startX + descentRoute.spawnSafeStartPx,
    });
    this.tiledPhase3Runtime = runtime;
    this.levelLengthPx = runtime.lengthPx;

    const spawn = this.phaseSpawn(runtime.spawn.x, runtime.spawn.y);
    this.player = new Player(this, spawn.x, spawn.y, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());
    this.hud.flashPrompt(TILED_FASE3_NAME, 1800);
  }

  private createTiledPhase4(): void {
    const runtime = new TiledPhase4Runtime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
      onEndGate: (destination, implant) => this.handleEndGate(destination, implant),
    });
    this.tiledPhase4Runtime = runtime;
    this.levelLengthPx = runtime.lengthPx;
    const descentRoute = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    if (descentRoute?.hidePreviousMapContent) {
      runtime.hideBeforeX(descentRoute.startX, this.scale.width);
      runtime.moveFatherAdToDescentStart(descentRoute.startX);
    }

    const spawn = this.phaseSpawn(runtime.spawn.x, runtime.spawn.y);
    this.player = new Player(this, spawn.x, spawn.y, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());
    this.hud.flashPrompt(TILED_FASE4_NAME, 1800);
  }

  private createTiledPhase5(): void {
    const runtime = new TiledPhase5Runtime(this, new Set(this.data$.consolidatedCreditIds), {
      onCreditCollected: (id, value) => this.handleCreditCollected(id, value),
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
      onEndGate: () => this.handleEndGate(),
    });
    this.tiledPhase5Runtime = runtime;
    this.levelLengthPx = runtime.lengthPx;
    const descentRoute = this.data$.descent ? descentRouteForPhase(this.data$.phaseId) : undefined;
    if (descentRoute && !descentRoute.epilogue) runtime.hideAfterX(descentRoute.endX);

    const spawn = this.phaseSpawn(runtime.spawn.x, runtime.spawn.y);
    this.player = new Player(this, spawn.x, spawn.y, this.activeAbilities, this.input$, {
      onDeath: () => this.handlePlayerDeath(),
      onScanPulse: (active) => this.handleScanPulse(active),
    });

    runtime.registerPhysics(this.player);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => runtime.destroy());
    this.hud.flashPrompt(TILED_FASE5_NAME, 1800);
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
      onCheckpoint: (id, x, y) => this.handleCheckpoint(id, x, y),
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
    if (this.tiledPhase2Runtime) return this.tiledPhase2Runtime.credits;
    if (this.tiledPhase3Runtime) return this.tiledPhase3Runtime.credits;
    if (this.tiledPhase4Runtime) return this.tiledPhase4Runtime.credits;
    if (this.tiledPhase5Runtime) return this.tiledPhase5Runtime.credits;
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
    if (this.data$.descent) {
      this.hud.setCredits(0, 0, 0);
    } else {
      const phaseTotalValue = this.phaseCredits().reduce((s, c) => s + c.value, 0);
      const phaseValue = this.credits.getPhaseDisplayValue(this.phaseConsolidatedValue());
      this.hud.setCredits(phaseValue, phaseTotalValue, this.credits.getTotal());
    }

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

  private handleCheckpoint(id: string, x: number, y: number): boolean {
    const alreadyActive = this.data$.checkpointX > 0
      && Math.abs(this.data$.checkpointX - x) < 1
      && Math.abs(this.data$.checkpointY - y) < 1;
    if (alreadyActive) return false;

    if (!this.data$.descent) this.credits.consolidate();
    if (!this.data$.testMode) {
      this.save.updateCheckpoint(
        x,
        y,
        this.data$.descent ? [] : this.credits.getConsolidatedIds(),
        this.data$.descent ? 0 : this.credits.getTotal(),
      );
    }
    this.data$.checkpointX = x;
    this.data$.checkpointY = y;
    this.updateHud();
    // A TV fica à direita do objeto de checkpoint. A pose sentada se projeta
    // para a direita, então Alex é deslocado para que rosto e mãos fiquem
    // diante da tela, sem o corpo atravessar o gabinete.
    this.player.beginCheckpointInteraction(x - 24, y);
    this.sound.play(CHECKPOINT_SFX_KEY, { volume: 0.55 });
    this.hud.flashPrompt(this.data$.descent
      ? `Checkpoint ${id} sincronizado — memoria preservada`
      : `Checkpoint ${id} sincronizado — créditos consolidados`);
    this.checkpointInteraction?.destroy();
    this.checkpointInteraction = this.time.delayedCall(
      GAMEPLAY_TIMING.checkpointInteractionMs,
      () => {
        this.player.endCheckpointInteraction();
        this.checkpointInteraction = undefined;
      },
    );
    return true;
  }

  /**
   * `destinationOverride` vem do objeto `clinic` do mapa Tiled (propriedade
   * `next` e `implant`); o nível desenhado à mão não tem esse objeto, então
   * usa a mesma regra fixa de antes.
   */
  private handleEndGate(destinationOverride?: string, implantOverride?: keyof AbilityState): void {
    if (this.data$.descent) {
      if (this.restarting) return;
      this.restarting = true;
      this.player.sprite.setVelocity(0, 0);
      if (descentRouteForPhase(this.data$.phaseId)?.epilogue) {
        this.save.completeDescentEpilogue();
        this.time.delayedCall(250, () => this.scene.start("EpilogueScene", { ending: "flesh" }));
        return;
      }
      const result = this.save.completeDescentPhase();
      const destination = result === "reforge"
        ? "ReForgeScene"
        : result === "retry"
          ? "DescentRetryScene"
          : "EpilogueScene";
      this.time.delayedCall(250, () => this.scene.start(destination, result === "hollow" ? { ending: "hollow" } : undefined));
      return;
    }
    this.credits.consolidate();
    if (!this.data$.testMode) {
      this.save.updateCheckpoint(
        this.player.sprite.x,
        this.player.sprite.y,
        this.credits.getConsolidatedIds(),
        this.credits.getTotal()
      );
    }
    this.updateHud();

    const nextPhaseId = getNextPhaseId(this.data$.phaseId);

    if (this.data$.testMode) {
      if (PHASES_WITH_CLINIC.has(this.data$.phaseId)) {
        this.showTestClinicChoice({
          completedPhaseId: this.data$.phaseId,
          nextPhaseId,
          wallet: this.credits.getTotal(),
          abilities: this.activeAbilities,
          implant: implantOverride,
        });
        return;
      }
      this.hud.flashPrompt("Teste concluído — retornando ao seletor", 900);
      this.time.delayedCall(700, () => this.scene.start("MenuScene"));
      return;
    }

    // A clínica de George instala um novo implante ao final de cada uma das
    // quatro primeiras fases (seção 11.1) e continua para o próximo blockout
    // Tiled registrado em `PHASE_ORDER`.
    const destination = destinationOverride ?? (
      PHASES_WITH_CLINIC.has(this.data$.phaseId)
        ? "ClinicScene"
        : this.data$.phaseId === "fase5"
          ? "GateScene"
          : "EndingScene"
    );

    this.time.delayedCall(300, () => {
      this.scene.start(destination, {
        completedPhaseId: this.data$.phaseId,
        nextPhaseId,
        wallet: this.credits.getTotal(),
        abilities: this.activeAbilities,
        implant: implantOverride,
        testMode: false,
      });
    });
  }

  /**
   * O seletor de fases não avança nem grava a campanha, mas agora oferece a
   * cena narrativa correspondente em vez de descartá-la silenciosamente.
   */
  private showTestClinicChoice(data: TestClinicChoiceData): void {
    this.restarting = true;
    this.awaitingTestClinicChoice = true;
    this.testClinicWatchSelected = true;
    this.pendingTestClinicData = data;
    this.player.sprite.setVelocity(0, 0);
    this.physics.world.pause();

    const panel = this.add.rectangle(0, 0, 720, 270, 0x070b13, 0.97)
      .setStrokeStyle(2, 0x7cfcea, 0.9);
    const title = this.add.text(0, -88, "FASE CONCLUÍDA", {
      fontFamily: "Courier New, monospace",
      fontSize: "29px",
      color: "#7CFCEA",
    }).setOrigin(0.5);
    const question = this.add.text(0, -32, "Deseja assistir à cutscene da clínica de George?", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      color: "#e8ecff",
      align: "center",
      wordWrap: { width: 640 },
    }).setOrigin(0.5);
    this.testClinicYesText = this.add.text(-145, 45, "SIM — ASSISTIR", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.testClinicNoText = this.add.text(145, 45, "NÃO — SELETOR", {
      fontFamily: "Courier New, monospace",
      fontSize: "20px",
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const help = this.add.text(0, 102, "← / → para escolher   •   ENTER / A para confirmar", {
      fontFamily: "Courier New, monospace",
      fontSize: "14px",
      color: "#8892b0",
    }).setOrigin(0.5);

    this.testClinicYesText.on("pointerover", () => this.setTestClinicSelection(true));
    this.testClinicNoText.on("pointerover", () => this.setTestClinicSelection(false));
    this.testClinicYesText.on("pointerdown", () => {
      this.setTestClinicSelection(true);
      this.confirmTestClinicChoice();
    });
    this.testClinicNoText.on("pointerdown", () => {
      this.setTestClinicSelection(false);
      this.confirmTestClinicChoice();
    });

    this.testClinicPrompt = this.add
      .container(this.scale.width / 2, this.scale.height / 2, [
        panel,
        title,
        question,
        this.testClinicYesText,
        this.testClinicNoText,
        help,
      ])
      .setScrollFactor(0)
      .setDepth(2200);
    this.renderTestClinicSelection();
  }

  private setTestClinicSelection(watch: boolean): void {
    this.testClinicWatchSelected = watch;
    this.renderTestClinicSelection();
  }

  private renderTestClinicSelection(): void {
    this.testClinicYesText
      ?.setColor(this.testClinicWatchSelected ? "#071017" : "#8892b0")
      .setBackgroundColor(this.testClinicWatchSelected ? "#7CFCEA" : "#151a27");
    this.testClinicNoText
      ?.setColor(!this.testClinicWatchSelected ? "#071017" : "#8892b0")
      .setBackgroundColor(!this.testClinicWatchSelected ? "#7CFCEA" : "#151a27");
  }

  private updateTestClinicChoice(): void {
    if (
      this.input$.isMenuLeftJustDown()
      || this.input$.isMenuUpJustDown()
    ) this.setTestClinicSelection(true);
    if (
      this.input$.isMenuRightJustDown()
      || this.input$.isMenuDownJustDown()
    ) this.setTestClinicSelection(false);
    if (this.input$.isCancelJustDown()) {
      this.setTestClinicSelection(false);
      this.confirmTestClinicChoice();
      return;
    }
    if (this.input$.isConfirmJustDown()) this.confirmTestClinicChoice();
  }

  private confirmTestClinicChoice(): void {
    if (!this.awaitingTestClinicChoice) return;
    const watchClinic = this.testClinicWatchSelected;
    const clinicData = this.pendingTestClinicData;
    this.awaitingTestClinicChoice = false;
    this.testClinicPrompt?.destroy();
    this.testClinicPrompt = undefined;
    this.physics.world.resume();

    if (watchClinic && clinicData) {
      this.scene.start("ClinicScene", { ...clinicData, testMode: true });
    } else {
      this.scene.start("MenuScene");
    }
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
        testMode: this.data$.testMode,
        checkpointX: this.data$.checkpointX,
        checkpointY: this.data$.checkpointY,
        consolidatedCreditIds: this.credits.getConsolidatedIds(),
        wallet: this.credits.getTotal(),
        abilities: this.data$.abilities,
        descent: this.data$.descent,
      } as GameSceneData);
    });
  }

  /** Reinício manual sempre volta ao spawn, mas preserva créditos já consolidados. */
  private restartFromPhaseStart(): void {
    if (this.restarting) return;
    this.restarting = true;
    this.credits.discardUncollected();
    const consolidatedIds = this.credits.getConsolidatedIds();
    const wallet = this.credits.getTotal();
    if (!this.data$.testMode) {
      this.save.updateCheckpoint(0, 0, consolidatedIds, wallet);
    }
    if (this.isPaused) this.togglePause();
    this.scene.restart({
      phaseId: this.data$.phaseId,
      testMode: this.data$.testMode,
      checkpointX: 0,
      checkpointY: 0,
      consolidatedCreditIds: consolidatedIds,
      wallet,
      abilities: this.data$.abilities,
      descent: this.data$.descent,
    } as GameSceneData);
  }

  private handleScanPulse(active: boolean): void {
    if (active) {
      if (!this.scanOverlay) {
        this.scanOverlay = this.add
          .rectangle(0, 0, this.scale.width, this.scale.height, 0x36e2ff, 0.08)
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(900);
      }
      this.scanOverlay.setVisible(true);
      this.scanOverlay.setAlpha(0.16);
      this.hud.flashPrompt("VISOR ATIVO — segredos detectados e barreira analisada", 750);
      this.tiledRuntime?.setScanActive(true);
      this.tiledPhase2Runtime?.setScanActive(true);
      this.tiledPhase3Runtime?.setScanActive(true);
      this.tiledPhase4Runtime?.setScanActive(true);
      this.tiledPhase5Runtime?.setScanActive(true);
      this.legacyRuntime?.setScanActive(true, this.player.sprite.x);
    } else {
      this.scanOverlay?.setVisible(false);
      this.tiledRuntime?.setScanActive(false);
      this.tiledPhase2Runtime?.setScanActive(false);
      this.tiledPhase3Runtime?.setScanActive(false);
      this.tiledPhase4Runtime?.setScanActive(false);
      this.tiledPhase5Runtime?.setScanActive(false);
      this.legacyRuntime?.setScanActive(false, this.player.sprite.x);
    }
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      this.anims.pauseAll();
      const menuHelp = this.data$.testMode
        ? "\nS / ↓ para voltar ao seletor de fases"
        : "\nS / ↓ para voltar ao menu principal";
      this.pauseText = this.add
        .text(this.scale.width / 2, this.scale.height / 2, `PAUSADO\nESC / START para voltar | ENTER / A para reiniciar a fase${menuHelp}`, {
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
      this.time.paused = false;
      this.anims.resumeAll();
      this.pauseText?.destroy();
      this.pauseText = undefined;
    }
  }

  update(_time: number, delta: number): void {
    if (this.awaitingTestClinicChoice) {
      this.updateTestClinicChoice();
      this.input$.postUpdate();
      return;
    }
    if (this.restarting) return;

    if (this.input$.isPauseJustDown()) {
      this.togglePause();
    }

    if (this.isPaused) {
      if (this.input$.isMenuDownJustDown()) {
        this.togglePause();
        this.scene.start("MenuScene");
        this.input$.postUpdate();
        return;
      }
      if (this.isPaused && this.input$.isConfirmJustDown()) {
        this.restartFromPhaseStart();
      }
      this.input$.postUpdate();
      return;
    }

    this.player.update(delta);
    if (this.tiledRuntime) {
      this.tiledRuntime.update(this.player);
    } else if (this.tiledPhase2Runtime) {
      this.tiledPhase2Runtime.update(this.player, delta);
    } else if (this.tiledPhase3Runtime) {
      this.tiledPhase3Runtime.update(this.player);
    } else if (this.tiledPhase4Runtime) {
      this.tiledPhase4Runtime.update(this.player, delta);
    } else if (this.tiledPhase5Runtime) {
      this.tiledPhase5Runtime.update(this.player, delta);
    } else {
      this.legacyRuntime!.update(this.player);
    }
    this.descentRouteRuntime?.update(this.player);

    // Câmera: valores inteiros (Math.floor) para não somar jitter de
    // sub-pixel ao scroll - correção do "tremor de tela" (v0.2.0), mantida
    // independente do formato do nível: não tem relação com o mapa, é
    // sobre a câmera + pixelArt.
    const viewportWidth = this.cameras.main.width;
    const targetScrollX = Math.floor(
      Phaser.Math.Clamp(
        this.player.sprite.x - viewportWidth * CAMERA.playerScreenRatioX,
        0,
        Math.max(0, this.levelLengthPx - viewportWidth)
      )
    );
    this.cameras.main.scrollX = targetScrollX;
    this.backdrop?.update(targetScrollX, delta);

    this.input$.postUpdate();
  }
}

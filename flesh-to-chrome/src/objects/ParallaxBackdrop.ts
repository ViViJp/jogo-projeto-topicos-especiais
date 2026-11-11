import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { BACKDROP_IMAGE_URLS, backdropTextureKey } from "../levels/BackdropAssets";
import {
  readAmbient,
  readBackdropLayers,
  repeatedLayerScroll,
  wrapScreenX,
  type AmbientKind,
  type AmbientSpec,
  type BackdropLayerSpec,
  type TiledMapLike,
} from "../levels/BackdropLayers";

/**
 * Fundo com parallax + clima de ambiente das fases Tiled.
 *
 * Tudo vem do próprio mapa: cada Image Layer vira uma camada (fator de
 * parallax, repetição, opacidade, offset e `drift_x` editáveis no Tiled) e a
 * propriedade de mapa `ambient` liga gotas/fagulhas/chuva. Regras completas
 * em `src/levels/BackdropLayers.ts` e no contrato Tiled↔Phaser (§3.1).
 *
 * Profundidades: camadas de fundo em -100.. (atrás da tile layer
 * `background`, que fica em -20); gotas e fagulhas em -30 (entre o fundo e
 * o mapa); chuva em 5 (na frente do mapa e do jogador, abaixo do HUD).
 */
const BACKDROP_BASE_DEPTH = -100;
const AMBIENT_BACK_DEPTH = -30;
const AMBIENT_FRONT_DEPTH = 5;
/**
 * Sobra horizontal das camadas repetidas: a morte da Alex dispara
 * `cameras.main.shake(150, 0.01)` (até ~13 px), que deslocaria a camada e
 * mostraria uma faixa da cor de fundo na borda da tela.
 */
const SHAKE_MARGIN = 16;

/** Carrega as imagens das image layers do mapa (chamar no `preload`). */
export function preloadBackdrop(scene: Phaser.Scene, mapData: unknown): void {
  for (const spec of readBackdropLayers(mapData as TiledMapLike, 0)) {
    const key = backdropTextureKey(spec.imageName);
    const url = BACKDROP_IMAGE_URLS[spec.imageName];
    if (!url) {
      console.warn(
        `[ParallaxBackdrop] imagem "${spec.imageName}" (camada "${spec.name}") não registrada em BACKDROP_IMAGE_URLS; camada ignorada`,
      );
      continue;
    }
    if (!scene.textures.exists(key)) scene.load.image(key, url.href);
  }
}

interface BackdropLayerObject {
  spec: BackdropLayerSpec;
  /**
   * Camada repetida = cópias da imagem lado a lado, fixas na tela e
   * reposicionadas a cada frame em pixels inteiros (mesmo custo de uma
   * TileSprite, sem depender da repetição de textura no shader).
   * Camada sem repetição = uma única imagem com scrollFactor.
   */
  images: Phaser.GameObjects.Image[];
  textureWidth: number;
  driftPx: number;
}

/**
 * Modo econômico automático. As camadas somam ~2 telas de pixels
 * translúcidos por quadro: irrelevante em qualquer GPU, mas pesado quando o
 * navegador cai em renderização por software (VM, driver bloqueado pelo
 * Chrome) - medido no SwiftShader: Fase 1 a ~57 fps sem fundo, ~37 só com a
 * camada mais distante e ~16 com todas.
 *
 * Se o FPS ficar abaixo do limite por alguns segundos seguidos, o fundo
 * desce um nível: 0 = todas as camadas, 1 = só a mais distante, 2 = nenhuma
 * (fica a cor de fundo calibrada da câmera). O nível vale para o jogo todo:
 * respawn e próximas fases já começam no nível atingido (a máquina não fica
 * mais rápida ao morrer), e ele nunca volta a subir, para o cenário não piscar.
 */
/**
 * Abaixo de 30 de propósito: modo de economia de bateria pode travar o
 * navegador em 30 fps mesmo com GPU boa, e isso não deve apagar o cenário.
 */
const LOW_FPS_THRESHOLD = 27;
/** ignora o primeiro segundo da cena (carregamento/criação distorce o FPS) */
const LOW_FPS_WARMUP_MS = 1000;
const LOW_FPS_SAMPLE_MS = 1000;
const LOW_FPS_SAMPLES_TO_DEGRADE = 3;
const MAX_ECONOMY_LEVEL = 2;

interface EconomyState {
  level: number;
  lowSamples: number;
}
const economyByGame = new WeakMap<Phaser.Game, EconomyState>();

export class ParallaxBackdrop {
  private readonly layers: BackdropLayerObject[] = [];
  private readonly ambient?: AmbientParticles;
  private readonly economy: EconomyState;
  private readonly createdAt = performance.now();
  private sampleStart = 0;
  private sampleFrames = 0;

  constructor(scene: Phaser.Scene, mapData: unknown, mapOffsetY: number) {
    let economy = economyByGame.get(scene.game);
    if (!economy) {
      economy = { level: 0, lowSamples: 0 };
      economyByGame.set(scene.game, economy);
    }
    this.economy = economy;

    readBackdropLayers(mapData as TiledMapLike, mapOffsetY).forEach((spec, index) => {
      const key = backdropTextureKey(spec.imageName);
      if (!scene.textures.exists(key)) return;
      const textureWidth = scene.textures.getFrame(key).width;
      const depth = BACKDROP_BASE_DEPTH + index;
      const makeImage = (x: number) =>
        scene.add.image(x, spec.y, key).setOrigin(0, 0).setDepth(depth).setAlpha(spec.alpha);
      if (spec.repeatX) {
        // uma cópia extra antes da tela (margem do shake) e cobertura até a borda direita
        const copies = Math.ceil((SCREEN_WIDTH + SHAKE_MARGIN) / textureWidth) + 2;
        const images = Array.from({ length: copies }, () => makeImage(0).setScrollFactor(0));
        this.layers.push({ spec, images, textureWidth, driftPx: 0 });
      } else {
        this.layers.push({ spec, images: [makeImage(spec.offsetX).setScrollFactor(spec.parallaxX, 0)], textureWidth, driftPx: 0 });
      }
    });

    const ambient = readAmbient(mapData as TiledMapLike);
    if (ambient) this.ambient = new AmbientParticles(scene, ambient);

    this.applyEconomyLevel();
    this.update(scene.cameras.main.scrollX, 0);
  }

  /** Chamar a cada frame, depois de posicionar a câmera. */
  update(cameraScrollX: number, deltaMs: number): void {
    this.watchFrameRate();
    for (const layer of this.layers) {
      if (!layer.spec.repeatX || !layer.images[0]?.visible) continue;
      if (layer.spec.driftX !== 0) {
        layer.driftPx = (layer.driftPx + (layer.spec.driftX * deltaMs) / 1000) % layer.textureWidth;
      }
      // ponto da imagem que cai no x=0 da tela, em pixels inteiros
      const scroll = repeatedLayerScroll(cameraScrollX, layer.spec, layer.driftPx, layer.textureWidth);
      const firstX = -scroll - layer.textureWidth;
      layer.images.forEach((image, k) => {
        image.x = firstX + k * layer.textureWidth;
      });
    }
    this.ambient?.update(cameraScrollX, deltaMs);
  }

  private watchFrameRate(): void {
    if (this.economy.level >= MAX_ECONOMY_LEVEL || this.layers.length === 0) return;
    // FPS medido aqui, em tempo real (quadros por janela de 1 s): o
    // `loop.actualFps` e o `delta` do Phaser são suavizados e levavam ~15 s
    // para refletir a queda.
    const now = performance.now();
    if (now - this.createdAt < LOW_FPS_WARMUP_MS) return;
    if (this.sampleStart === 0) this.sampleStart = now;
    this.sampleFrames += 1;
    const windowMs = now - this.sampleStart;
    if (windowMs < LOW_FPS_SAMPLE_MS) return;
    const fps = (this.sampleFrames * 1000) / windowMs;
    this.sampleFrames = 0;
    this.sampleStart = now;
    // janela longa demais = jogo pausado ou aba em segundo plano: não é lentidão
    if (windowMs > LOW_FPS_SAMPLE_MS * 2) return;
    this.economy.lowSamples = fps < LOW_FPS_THRESHOLD ? this.economy.lowSamples + 1 : 0;
    if (this.economy.lowSamples < LOW_FPS_SAMPLES_TO_DEGRADE) return;
    this.economy.lowSamples = 0;
    this.economy.level += 1;
    this.applyEconomyLevel();
    console.info(
      `[ParallaxBackdrop] FPS baixo (${fps.toFixed(0)}): fundo em modo econômico ${this.economy.level} ` +
        (this.economy.level === 1 ? "(só a camada mais distante)" : "(sem camadas)"),
    );
  }

  private applyEconomyLevel(): void {
    const level = this.economy.level;
    this.layers.forEach((layer, index) => {
      const visible = level === 0 || (level === 1 && index === 0);
      layer.images.forEach((image) => image.setVisible(visible));
    });
  }

  destroy(): void {
    this.layers.forEach((layer) => layer.images.forEach((image) => image.destroy()));
    this.layers.length = 0;
    this.ambient?.destroy();
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  length: number;
  alpha: number;
  color: number;
  phase: number;
}

interface AmbientPreset {
  count: number;
  /** quão "presas ao cenário" as partículas ficam ao rolar a câmera */
  parallaxX: number;
  depth: number;
  spawn: (particle: Particle, initial: boolean) => void;
  /** true quando a partícula saiu da área visível e deve renascer */
  done: (particle: Particle) => boolean;
}

/**
 * Partículas leves desenhadas num único Graphics fixo na tela (sem física,
 * sem textura), redesenhado a cada frame. Quantidades pequenas de propósito:
 * é clima, não pode competir com hazards pela atenção do jogador.
 */
class AmbientParticles {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly particles: Particle[] = [];
  private readonly preset: AmbientPreset;
  private readonly kind: AmbientKind;

  constructor(scene: Phaser.Scene, spec: AmbientSpec) {
    this.kind = spec.kind;
    this.preset = AMBIENT_PRESETS[spec.kind];
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(this.preset.depth);
    const count = Math.round(this.preset.count * spec.density);
    for (let i = 0; i < count; i++) {
      const particle: Particle = { x: 0, y: 0, vx: 0, vy: 0, size: 2, length: 2, alpha: 1, color: 0xffffff, phase: 0 };
      this.preset.spawn(particle, true);
      this.particles.push(particle);
    }
  }

  update(cameraScrollX: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const g = this.graphics;
    g.clear();
    for (const p of this.particles) {
      p.phase += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (this.kind === "embers" || this.kind === "motes") p.x += Math.sin(p.phase * 2.3) * 12 * dt;
      if (this.preset.done(p)) this.preset.spawn(p, false);

      const sx = Math.round(wrapScreenX(p.x, cameraScrollX, this.preset.parallaxX, SCREEN_WIDTH));
      const sy = Math.round(p.y);
      if (this.kind === "rain") {
        // traço inclinado: 3 segmentos em escada, legível em pixel art
        g.fillStyle(p.color, p.alpha);
        const step = Math.round(p.length / 3);
        for (let s = 0; s < 3; s++) g.fillRect(sx - s, sy + s * step, 1, step);
      } else if (this.kind === "embers" || this.kind === "motes") {
        const speed = this.kind === "embers" ? 9 : 2.5;
        const flicker = 0.65 + 0.35 * Math.sin(p.phase * speed + p.x);
        g.fillStyle(p.color, p.alpha * flicker);
        g.fillRect(sx, sy, p.size, p.size);
      } else {
        g.fillStyle(p.color, p.alpha);
        g.fillRect(sx, sy, p.size, p.length);
      }
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.particles.length = 0;
  }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const AMBIENT_PRESETS: Record<AmbientKind, AmbientPreset> = {
  // Gotas caindo dos canos do teto até o canal de água (Fase 1).
  drips: {
    count: 26,
    parallaxX: 0.3,
    depth: AMBIENT_BACK_DEPTH,
    spawn: (p, initial) => {
      p.x = rand(0, SCREEN_WIDTH);
      p.y = initial ? rand(80, 640) : rand(70, 140);
      p.vx = 0;
      p.vy = rand(320, 460);
      p.size = 2;
      p.length = Math.round(rand(4, 8));
      p.alpha = rand(0.45, 0.75);
      p.color = Math.random() < 0.7 ? 0xc3d2d4 : 0x9cc7ad;
    },
    done: (p) => p.y > 650,
  },
  // Partículas de luz flutuando devagar, clima contemplativo do topo (Fase 5).
  motes: {
    count: 28,
    parallaxX: 0.5,
    depth: AMBIENT_BACK_DEPTH,
    spawn: (p, initial) => {
      p.x = rand(0, SCREEN_WIDTH);
      p.y = initial ? rand(80, SCREEN_HEIGHT) : rand(SCREEN_HEIGHT - 40, SCREEN_HEIGHT + 20);
      p.vx = rand(-8, 8);
      p.vy = -rand(10, 26);
      p.size = Math.random() < 0.3 ? 3 : 2;
      p.alpha = rand(0.4, 0.8);
      p.color = Math.random() < 0.55 ? 0xf0d28a : 0x9fe6ff;
      p.phase = rand(0, 10);
    },
    done: (p) => p.y < 60,
  },
  // Fagulhas subindo dos fornos e prensas (Fase 2).
  embers: {
    count: 34,
    parallaxX: 0.6,
    depth: AMBIENT_BACK_DEPTH,
    spawn: (p, initial) => {
      p.x = rand(0, SCREEN_WIDTH);
      p.y = initial ? rand(140, SCREEN_HEIGHT) : rand(SCREEN_HEIGHT - 60, SCREEN_HEIGHT + 20);
      p.vx = rand(6, 26);
      p.vy = -rand(28, 70);
      p.size = Math.random() < 0.25 ? 3 : 2;
      p.alpha = rand(0.55, 0.95);
      p.color = Math.random() < 0.6 ? 0xf0a35c : 0xffd38a;
      p.phase = rand(0, 10);
    },
    done: (p) => p.y < 120,
  },
  // Chuva fina na frente da cena (Fase 3). Translúcida para não esconder
  // hazards nem a Alex.
  rain: {
    count: 90,
    parallaxX: 1.1,
    depth: AMBIENT_FRONT_DEPTH,
    spawn: (p, initial) => {
      p.x = rand(0, SCREEN_WIDTH);
      p.y = initial ? rand(-20, SCREEN_HEIGHT) : rand(-40, -10);
      p.vx = -70;
      p.vy = rand(760, 980);
      p.length = Math.round(rand(12, 21));
      p.alpha = rand(0.18, 0.32);
      p.color = 0xc9d6ea;
    },
    done: (p) => p.y > SCREEN_HEIGHT,
  },
};

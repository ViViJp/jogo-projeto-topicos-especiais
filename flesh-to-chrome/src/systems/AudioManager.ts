/**
 * AudioManager — BGM global único + SFX por cena.
 * Issue 7: uma só BGM ativa entre Menu → Fase → Clínica → restart.
 */
import Phaser from "phaser";
import { ALL_BGM_KEYS, BGM_URLS, SFX_URLS } from "../assets/AssetUrls";

export const SFX = {
  jump: "sfx-jump",
  land: "sfx-land",
  slide: "sfx-slide",
  effort: "sfx-effort",
  footstep: "sfx-footstep",
  hurt: "sfx-hurt",
  death: "sfx-death",
  credit: "sfx-credit",
  checkpoint: "sfx-checkpoint",
  attack: "sfx-attack",
  dash: "sfx-dash",
  scan: "sfx-scan",
  uiSelect: "sfx-ui-select",
  uiConfirm: "sfx-ui-confirm",
  water: "sfx-hazard-water",
  laser: "sfx-hazard-laser",
  enemyHit: "sfx-enemy-hit",
  glitch: "sfx-glitch",
  phaseClear: "sfx-phase-clear",
  implant: "sfx-implant",
  clinicTools: "sfx-clinic-tools",
} as const;

export const BGM = {
  menu: "bgm-menu",
  fase1: "bgm-fase-1-esgoto",
  fase2: "bgm-fase-2-industrial",
  fase3: "bgm-fase-3-meio-urbano",
  fase4: "bgm-fase-4-corporativo",
  fase5: "bgm-fase-5-topo",
  clinic: "bgm-clinic",
  portao: "bgm-portao",
} as const;

const PHASE_BGM: Record<string, string> = {
  fase1: BGM.fase1,
  "fase2-intro": BGM.fase2,
  fase2: BGM.fase2,
  fase3: BGM.fase3,
  fase4: BGM.fase4,
  fase5: BGM.fase5,
};

const REGISTRY_KEY = "ftc:audio";

export class AudioManager {
  /** Estado de BGM compartilhado entre todas as cenas / restarts. */
  private static currentBgmKey: string | null = null;

  private scene: Phaser.Scene;
  muted = false;
  sfxVolume = 0.55;
  bgmVolume = 0.32;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Uma fachada por game; reutiliza o mesmo estado de BGM. */
  static forScene(scene: Phaser.Scene): AudioManager {
    let am = scene.game.registry.get(REGISTRY_KEY) as AudioManager | undefined;
    if (!am) {
      am = new AudioManager(scene);
      scene.game.registry.set(REGISTRY_KEY, am);
    } else {
      am.scene = scene;
    }
    return am;
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, url] of SFX_URLS) scene.load.audio(key, url);
    for (const [key, url] of BGM_URLS) scene.load.audio(key, url);
  }

  /** Browsers bloqueiam áudio até gesto do usuário. */
  unlock(): void {
    try {
      this.scene.sound.unlock();
    } catch {
      /* Phaser 4 / browser */
    }
    const ctx = (this.scene.sound as unknown as { context?: AudioContext }).context;
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  sfx(key: string, config: { volume?: number; rate?: number } = {}): void {
    if (this.muted) return;
    this.unlock();
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`[audio] SFX missing: ${key}`);
      return;
    }
    try {
      this.scene.sound.play(key, {
        volume: this.sfxVolume * (config.volume ?? 1),
        rate: config.rate ?? 1,
      });
    } catch (e) {
      console.warn(`[audio] play failed: ${key}`, e);
    }
  }

  playBgm(key: string, opts: { loop?: boolean } = {}): void {
    const loop = opts.loop ?? true;
    if (!key || this.muted) return;
    this.unlock();
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`[audio] BGM missing: ${key}`);
      return;
    }

    // Já tocando a mesma faixa — não cria segunda instância.
    if (AudioManager.currentBgmKey === key) {
      const playing = this.scene.sound.getAllPlaying().some((s) => s.key === key);
      if (playing) return;
    }

    this.stopAllBgmImmediate();
    AudioManager.currentBgmKey = key;
    const track = this.scene.sound.add(key, { loop, volume: this.bgmVolume });
    track.play();
  }

  playPhaseBgm(phaseId: string): void {
    this.playBgm(PHASE_BGM[phaseId] ?? BGM.fase1);
  }

  /** Para a BGM atual (fade curto). Preferir nas saídas de cena. */
  stopBgm(fadeMs = 200): void {
    const key = AudioManager.currentBgmKey;
    AudioManager.currentBgmKey = null;
    if (!key) {
      this.stopAllBgmImmediate();
      return;
    }
    const tracks = this.scene.sound.getAll(key);
    if (tracks.length === 0 || fadeMs <= 0) {
      this.stopAllBgmImmediate();
      return;
    }
    for (const track of tracks) {
      this.scene.tweens.add({
        targets: track,
        volume: 0,
        duration: fadeMs,
        onComplete: () => {
          track.stop();
          track.destroy();
        },
      });
    }
  }

  /** Para TODAS as BGMs conhecidas — evita acumulação após restart. */
  stopAllBgmImmediate(): void {
    for (const key of ALL_BGM_KEYS) {
      for (const track of this.scene.sound.getAll(key)) {
        track.stop();
        track.destroy();
      }
    }
    AudioManager.currentBgmKey = null;
  }
}

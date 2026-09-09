/// <reference path="./parcel-url.d.ts" />
/**
 * AudioManager — SFX/BGM via URLs do Parcel (issues #11–#14)
 */
import Phaser from "phaser";
import { BGM_URLS, SFX_URLS } from "../assets/AssetUrls";

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

export class AudioManager {
  private scene: Phaser.Scene;
  private currentBgmKey: string | null = null;
  muted = false;
  sfxVolume = 0.55;
  bgmVolume = 0.32;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, url] of SFX_URLS) scene.load.audio(key, url);
    for (const [key, url] of BGM_URLS) scene.load.audio(key, url);
  }

  /** Browsers block audio until a user gesture — call on first click/key. */
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

  playBgm(key: string, opts: { loop?: boolean; fadeMs?: number } = {}): void {
    const loop = opts.loop ?? true;
    const fadeMs = opts.fadeMs ?? 400;
    if (!key || this.muted) return;
    this.unlock();
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`[audio] BGM missing: ${key}`);
      return;
    }
    if (this.currentBgmKey === key) return;

    const prev = this.currentBgmKey ? this.scene.sound.get(this.currentBgmKey) : null;
    if (prev?.isPlaying) {
      this.scene.tweens.add({
        targets: prev,
        volume: 0,
        duration: fadeMs,
        onComplete: () => prev.stop(),
      });
    }

    this.currentBgmKey = key;
    const track = this.scene.sound.add(key, { loop, volume: 0 });
    track.play();
    this.scene.tweens.add({ targets: track, volume: this.bgmVolume, duration: fadeMs });
  }

  playPhaseBgm(phaseId: string): void {
    this.playBgm(PHASE_BGM[phaseId] ?? BGM.fase1);
  }

  stopBgm(fadeMs = 300): void {
    if (!this.currentBgmKey) return;
    const track = this.scene.sound.get(this.currentBgmKey);
    this.currentBgmKey = null;
    if (!track) return;
    this.scene.tweens.add({
      targets: track,
      volume: 0,
      duration: fadeMs,
      onComplete: () => track.stop(),
    });
  }
}

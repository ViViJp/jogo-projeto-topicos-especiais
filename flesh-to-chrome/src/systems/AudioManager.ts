import Phaser from "phaser";

export const BGM = {
  menu: "bgm-menu",
  phase1: "bgm-phase-1",
  phase2: "bgm-phase-2",
  phase3: "bgm-phase-3",
  phase4: "bgm-phase-4",
  phase5: "bgm-phase-5",
  clinic: "bgm-clinic",
  gate: "bgm-gate",
} as const;

export const SFX = {
  attack: "sfx-attack",
  checkpoint: "sfx-checkpoint",
  clinicTools: "sfx-clinic-tools",
  credit: "sfx-credit",
  dash: "sfx-dash",
  death: "sfx-death",
  effort: "sfx-effort",
  enemyHit: "sfx-enemy-hit",
  footstep: "sfx-footstep",
  glitch: "sfx-glitch",
  hazardLaser: "sfx-hazard-laser",
  hazardWater: "sfx-hazard-water",
  hurt: "sfx-hurt",
  implant: "sfx-implant",
  jump: "sfx-jump",
  land: "sfx-land",
  phaseClear: "sfx-phase-clear",
  scan: "sfx-scan",
  slide: "sfx-slide",
  uiConfirm: "sfx-ui-confirm",
  uiSelect: "sfx-ui-select",
} as const;

export type BgmKey = typeof BGM[keyof typeof BGM];
export type SfxKey = typeof SFX[keyof typeof SFX];

export interface AudioSources {
  music?: Partial<Record<BgmKey, string>>;
  sfx?: Partial<Record<SfxKey, string>>;
}

/**
 * Catálogo intencionalmente vazio até a seleção dos masters definitivos.
 * As chaves, volumes e pontos de disparo permanecem prontos. Quando os
 * arquivos forem escolhidos, registre suas URLs antes do preload do Boot.
 */
export const AUDIO_SOURCES: Required<AudioSources> = { music: {}, sfx: {} };

/**
 * Barramento audiovisual global. Toda troca de BGM interrompe a faixa anterior
 * antes de iniciar a próxima, impedindo sobreposição entre cenas reutilizadas.
 */
export class AudioManager {
  private static activeMusic?: Phaser.Sound.BaseSound;
  private static activeKey?: BgmKey;

  static configure(sources: AudioSources): void {
    Object.assign(AUDIO_SOURCES.music, sources.music);
    Object.assign(AUDIO_SOURCES.sfx, sources.sfx);
  }

  static preload(scene: Phaser.Scene): void {
    for (const [key, url] of Object.entries(AUDIO_SOURCES.music)) {
      if (url && !scene.cache.audio.exists(key)) scene.load.audio(key, url);
    }
    for (const [key, url] of Object.entries(AUDIO_SOURCES.sfx)) {
      if (url && !scene.cache.audio.exists(key)) scene.load.audio(key, url);
    }
  }

  static playBgm(scene: Phaser.Scene, key: BgmKey, volume = 0.3): void {
    if (!scene.cache?.audio?.exists(key)) {
      this.stopBgm();
      return;
    }
    if (this.activeKey === key && this.activeMusic?.isPlaying) {
      return;
    }
    this.activeMusic?.stop();
    this.activeMusic?.destroy();
    this.activeKey = key;
    this.activeMusic = scene.sound.add(key, { loop: true, volume });
    this.activeMusic.play();
  }

  static playSfx(
    scene: Phaser.Scene,
    key: SfxKey,
    config: Phaser.Types.Sound.SoundConfig = {},
  ): void {
    if (!scene.cache?.audio?.exists(key)) return;
    scene.sound.play(key, { volume: 0.55, ...config });
  }

  static pauseBgm(): void {
    if (this.activeMusic?.isPlaying) this.activeMusic.pause();
  }

  static resumeBgm(): void {
    if (this.activeMusic?.isPaused) this.activeMusic.resume();
  }

  static stopBgm(): void {
    this.activeMusic?.stop();
    this.activeMusic?.destroy();
    this.activeMusic = undefined;
    this.activeKey = undefined;
  }
}

export function bgmForPhase(phaseId: string): BgmKey {
  if (phaseId === "fase1") return BGM.phase1;
  if (phaseId === "fase2-intro") return BGM.phase2;
  if (phaseId === "fase3") return BGM.phase3;
  if (phaseId === "fase4") return BGM.phase4;
  return BGM.phase5;
}

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

/** Masters aprovados pela equipe. As chaves sem arquivo continuam como no-op. */
export const AUDIO_SOURCES: Required<AudioSources> = {
  music: {},
  sfx: {
    [SFX.attack]: new URL("../assets/audio/sfx/sfx-attack.mp3", import.meta.url).href,
    [SFX.checkpoint]: new URL("../assets/audio/sfx/sfx-checkpoint.mp3", import.meta.url).href,
    [SFX.credit]: new URL("../assets/audio/sfx/sfx-credit.mp3", import.meta.url).href,
    [SFX.dash]: new URL("../assets/audio/sfx/sfx-dash.mp3", import.meta.url).href,
    [SFX.death]: new URL("../assets/audio/sfx/sfx-death.mp3", import.meta.url).href,
    [SFX.effort]: new URL("../assets/audio/sfx/sfx-jump.mp3", import.meta.url).href,
    [SFX.enemyHit]: new URL("../assets/audio/sfx/sfx-enemy-hit.mp3", import.meta.url).href,
    [SFX.footstep]: new URL("../assets/audio/sfx/sfx-footstep.mp3", import.meta.url).href,
    [SFX.glitch]: new URL("../assets/audio/sfx/sfx-glitch.mp3", import.meta.url).href,
    [SFX.hurt]: new URL("../assets/audio/sfx/sfx-hurt.mp3", import.meta.url).href,
    [SFX.implant]: new URL("../assets/audio/sfx/sfx-implant.mp3", import.meta.url).href,
    [SFX.jump]: new URL("../assets/audio/sfx/sfx-jump.mp3", import.meta.url).href,
    [SFX.land]: new URL("../assets/audio/sfx/sfx-land.mp3", import.meta.url).href,
    [SFX.phaseClear]: new URL("../assets/audio/sfx/sfx-phase-clear.mp3", import.meta.url).href,
    [SFX.scan]: new URL("../assets/audio/sfx/sfx-scan.mp3", import.meta.url).href,
    [SFX.slide]: new URL("../assets/audio/sfx/sfx-slide.mp3", import.meta.url).href,
    [SFX.uiConfirm]: new URL("../assets/audio/sfx/sfx-ui-confirm.mp3", import.meta.url).href,
    [SFX.uiSelect]: new URL("../assets/audio/sfx/sfx-ui-select.mp3", import.meta.url).href,
  },
};

/**
 * Barramento audiovisual global. Toda troca de BGM interrompe a faixa anterior
 * antes de iniciar a próxima, impedindo sobreposição entre cenas reutilizadas.
 */
export class AudioManager {
  private static activeMusic?: Phaser.Sound.BaseSound;
  private static activeKey?: BgmKey;
  private static activeLoops = new Map<SfxKey, Phaser.Sound.BaseSound>();

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

  /** Sons longos ligados a um estado (corrida, slide e scan), sem sobreposição. */
  static startLoop(
    scene: Phaser.Scene,
    key: SfxKey,
    config: Phaser.Types.Sound.SoundConfig = {},
  ): void {
    if (!scene.cache?.audio?.exists(key)) return;
    const current = this.activeLoops.get(key);
    if (current?.isPlaying || current?.isPaused) return;
    current?.destroy();
    const sound = scene.sound.add(key, { volume: 0.55, loop: true, ...config });
    this.activeLoops.set(key, sound);
    sound.play();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.activeLoops.get(key) === sound) this.stopLoop(key);
    });
  }

  static stopLoop(key: SfxKey): void {
    const sound = this.activeLoops.get(key);
    sound?.stop();
    sound?.destroy();
    this.activeLoops.delete(key);
  }

  static pauseBgm(): void {
    if (this.activeMusic?.isPlaying) this.activeMusic.pause();
    this.activeLoops.forEach((sound) => {
      if (sound.isPlaying) sound.pause();
    });
  }

  static resumeBgm(): void {
    if (this.activeMusic?.isPaused) this.activeMusic.resume();
    this.activeLoops.forEach((sound) => {
      if (sound.isPaused) sound.resume();
    });
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

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
  barrierDisable: "sfx-barrier-disable",
  breakableDestroy: "sfx-breakable-destroy",
  checkpoint: "sfx-checkpoint",
  clinicTools: "sfx-clinic-tools",
  conveyorBelt: "sfx-conveyor-belt",
  credit: "sfx-credit",
  dash: "sfx-dash",
  death: "sfx-death",
  droneHum: "sfx-drone-hum",
  effort: "sfx-effort",
  enemyHit: "sfx-enemy-hit",
  footstep: "sfx-footstep",
  glitch: "sfx-glitch",
  hydraulicPress: "sfx-hydraulic-press",
  hazardLaser: "sfx-hazard-laser",
  hazardWater: "sfx-hazard-water",
  electricWire: "sfx-electric-wire",
  electricGate: "sfx-electric-gate",
  gateOpening: "sfx-gate-opening",
  hurt: "sfx-hurt",
  implant: "sfx-implant",
  jump: "sfx-jump",
  land: "sfx-land",
  mechanicalArm: "sfx-mechanical-arm",
  phaseClear: "sfx-phase-clear",
  scan: "sfx-scan",
  scanReveal: "sfx-scan-reveal",
  securityDoorUnlock: "sfx-security-door-unlock",
  slide: "sfx-slide",
  steamBurst: "sfx-steam-burst",
  uiConfirm: "sfx-ui-confirm",
  uiSelect: "sfx-ui-select",
  warningBeep: "sfx-warning-beep",
} as const;

export type BgmKey = typeof BGM[keyof typeof BGM];
export type SfxKey = typeof SFX[keyof typeof SFX];

export interface AudioSources {
  music?: Partial<Record<BgmKey, string>>;
  sfx?: Partial<Record<SfxKey, string>>;
}

/** Masters aprovados pela equipe. As chaves sem arquivo continuam como no-op. */
export const AUDIO_SOURCES: Required<AudioSources> = {
  music: {
    [BGM.phase1]: new URL("../assets/audio/music/bgm-phase-1.ogg", import.meta.url).href,
    [BGM.phase2]: new URL("../assets/audio/music/bgm-phase-2.ogg", import.meta.url).href,
    [BGM.phase3]: new URL("../assets/audio/music/bgm-phase-3.ogg", import.meta.url).href,
    [BGM.phase4]: new URL("../assets/audio/music/bgm-phase-4.ogg", import.meta.url).href,
    [BGM.phase5]: new URL("../assets/audio/music/bgm-phase-5.ogg", import.meta.url).href,
  },
  sfx: {
    [SFX.attack]: new URL("../assets/audio/sfx/sfx-attack.mp3", import.meta.url).href,
    [SFX.barrierDisable]: new URL("../assets/audio/sfx/sfx-barrier-disable.mp3", import.meta.url).href,
    [SFX.breakableDestroy]: new URL("../assets/audio/sfx/sfx-breakable-destroy.mp3", import.meta.url).href,
    [SFX.checkpoint]: new URL("../assets/audio/sfx/sfx-checkpoint.mp3", import.meta.url).href,
    [SFX.conveyorBelt]: new URL("../assets/audio/sfx/sfx-conveyor-belt.mp3", import.meta.url).href,
    [SFX.credit]: new URL("../assets/audio/sfx/sfx-credit.mp3", import.meta.url).href,
    [SFX.dash]: new URL("../assets/audio/sfx/sfx-dash.mp3", import.meta.url).href,
    [SFX.death]: new URL("../assets/audio/sfx/sfx-death.mp3", import.meta.url).href,
    [SFX.droneHum]: new URL("../assets/audio/sfx/sfx-drone-hum.mp3", import.meta.url).href,
    [SFX.effort]: new URL("../assets/audio/sfx/sfx-jump.mp3", import.meta.url).href,
    [SFX.enemyHit]: new URL("../assets/audio/sfx/sfx-enemy-hit.mp3", import.meta.url).href,
    [SFX.footstep]: new URL("../assets/audio/sfx/sfx-footstep.mp3", import.meta.url).href,
    [SFX.glitch]: new URL("../assets/audio/sfx/sfx-glitch.mp3", import.meta.url).href,
    [SFX.hydraulicPress]: new URL("../assets/audio/sfx/sfx-hydraulic-press.mp3", import.meta.url).href,
    [SFX.hazardWater]: new URL("../assets/audio/sfx/sfx-hazard-water.mp3", import.meta.url).href,
    [SFX.electricWire]: new URL("../assets/audio/sfx/sfx-electric-wire.mp3", import.meta.url).href,
    [SFX.electricGate]: new URL("../assets/audio/sfx/sfx-electric-gate.mp3", import.meta.url).href,
    [SFX.gateOpening]: new URL("../assets/audio/sfx/sfx-gate-opening.mp3", import.meta.url).href,
    [SFX.hurt]: new URL("../assets/audio/sfx/sfx-hurt.mp3", import.meta.url).href,
    [SFX.implant]: new URL("../assets/audio/sfx/sfx-implant.mp3", import.meta.url).href,
    [SFX.jump]: new URL("../assets/audio/sfx/sfx-jump.mp3", import.meta.url).href,
    [SFX.land]: new URL("../assets/audio/sfx/sfx-land.mp3", import.meta.url).href,
    [SFX.mechanicalArm]: new URL("../assets/audio/sfx/sfx-mechanical-arm.mp3", import.meta.url).href,
    [SFX.phaseClear]: new URL("../assets/audio/sfx/sfx-phase-clear.mp3", import.meta.url).href,
    [SFX.scan]: new URL("../assets/audio/sfx/sfx-scan.mp3", import.meta.url).href,
    [SFX.scanReveal]: new URL("../assets/audio/sfx/sfx-scan-reveal.mp3", import.meta.url).href,
    [SFX.securityDoorUnlock]: new URL("../assets/audio/sfx/sfx-security-door-unlock.mp3", import.meta.url).href,
    [SFX.slide]: new URL("../assets/audio/sfx/sfx-slide.mp3", import.meta.url).href,
    [SFX.steamBurst]: new URL("../assets/audio/sfx/sfx-steam-burst.mp3", import.meta.url).href,
    [SFX.uiConfirm]: new URL("../assets/audio/sfx/sfx-ui-confirm.mp3", import.meta.url).href,
    [SFX.uiSelect]: new URL("../assets/audio/sfx/sfx-ui-select.mp3", import.meta.url).href,
    [SFX.warningBeep]: new URL("../assets/audio/sfx/sfx-warning-beep.mp3", import.meta.url).href,
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

  /**
   * Efeitos pequenos compartilhados entre cenas. As BGMs completas não são
   * carregadas aqui para o Boot não baixar as cinco faixas antes do menu.
   */
  static preload(scene: Phaser.Scene): void {
    for (const [key, url] of Object.entries(AUDIO_SOURCES.sfx)) {
      if (url && !scene.cache.audio.exists(key)) scene.load.audio(key, url);
    }
  }

  /** Carrega somente a música exigida pela cena que está entrando. */
  static preloadBgm(scene: Phaser.Scene, key: BgmKey): void {
    const url = AUDIO_SOURCES.music[key];
    if (url && !scene.cache.audio.exists(key)) scene.load.audio(key, url);
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

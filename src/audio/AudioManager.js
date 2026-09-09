/**
 * AudioManager — carrega e toca SFX/BGM do pack em public/assets/audio/
 * Issues #11–#14
 */
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
};

export const BGM = {
  menu: "bgm-menu",
  fase1: "bgm-fase-1-esgoto",
  fase2: "bgm-fase-2-industrial",
  fase3: "bgm-fase-3-meio-urbano",
  fase4: "bgm-fase-4-corporativo",
  fase5: "bgm-fase-5-topo",
  clinic: "bgm-clinic",
  portao: "bgm-portao",
};

const PHASE_BGM = {
  fase1: BGM.fase1,
  "fase2-intro": BGM.fase2,
  fase2: BGM.fase2,
  fase3: BGM.fase3,
  fase4: BGM.fase4,
  fase5: BGM.fase5,
};

const SFX_FILES = [
  ["sfx-jump", "assets/audio/sfx/sfx-jump.wav"],
  ["sfx-land", "assets/audio/sfx/sfx-land.wav"],
  ["sfx-slide", "assets/audio/sfx/sfx-slide.wav"],
  ["sfx-effort", "assets/audio/sfx/sfx-effort.wav"],
  ["sfx-footstep", "assets/audio/sfx/sfx-footstep.wav"],
  ["sfx-hurt", "assets/audio/sfx/sfx-hurt.wav"],
  ["sfx-death", "assets/audio/sfx/sfx-death.wav"],
  ["sfx-credit", "assets/audio/sfx/sfx-credit.wav"],
  ["sfx-checkpoint", "assets/audio/sfx/sfx-checkpoint.wav"],
  ["sfx-attack", "assets/audio/sfx/sfx-attack.wav"],
  ["sfx-dash", "assets/audio/sfx/sfx-dash.wav"],
  ["sfx-scan", "assets/audio/sfx/sfx-scan.wav"],
  ["sfx-ui-select", "assets/audio/sfx/sfx-ui-select.wav"],
  ["sfx-ui-confirm", "assets/audio/sfx/sfx-ui-confirm.wav"],
  ["sfx-hazard-water", "assets/audio/sfx/sfx-hazard-water.wav"],
  ["sfx-hazard-laser", "assets/audio/sfx/sfx-hazard-laser.wav"],
  ["sfx-enemy-hit", "assets/audio/sfx/sfx-enemy-hit.wav"],
  ["sfx-glitch", "assets/audio/sfx/sfx-glitch.wav"],
  ["sfx-phase-clear", "assets/audio/sfx/sfx-phase-clear.wav"],
  ["sfx-implant", "assets/audio/sfx/sfx-implant.wav"],
  ["sfx-clinic-tools", "assets/audio/sfx/sfx-clinic-tools.wav"],
];

const BGM_FILES = [
  ["bgm-menu", "assets/audio/music/bgm-menu.wav"],
  ["bgm-fase-1-esgoto", "assets/audio/music/bgm-fase-1-esgoto.wav"],
  ["bgm-fase-2-industrial", "assets/audio/music/bgm-fase-2-industrial.wav"],
  ["bgm-fase-3-meio-urbano", "assets/audio/music/bgm-fase-3-meio-urbano.wav"],
  ["bgm-fase-4-corporativo", "assets/audio/music/bgm-fase-4-corporativo.wav"],
  ["bgm-fase-5-topo", "assets/audio/music/bgm-fase-5-topo.wav"],
  ["bgm-clinic", "assets/audio/music/bgm-clinic.wav"],
  ["bgm-portao", "assets/audio/music/bgm-portao.wav"],
];

export class AudioManager {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.currentBgmKey = null;
    this.muted = false;
    this.sfxVolume = 0.55;
    this.bgmVolume = 0.28;
  }

  /** Preload em Boot/PreloadScene */
  static preload(scene) {
    for (const [key, path] of SFX_FILES) {
      scene.load.audio(key, path);
    }
    for (const [key, path] of BGM_FILES) {
      scene.load.audio(key, path);
    }
  }

  sfx(key, config = {}) {
    if (this.muted || !this.scene.cache.audio.exists(key)) return;
    try {
      this.scene.sound.play(key, {
        volume: this.sfxVolume * (config.volume ?? 1),
        rate: config.rate ?? 1,
      });
    } catch {
      /* ignore missing decode */
    }
  }

  playBgm(key, { loop = true, fadeMs = 400 } = {}) {
    if (!key || this.muted) return;
    if (!this.scene.cache.audio.exists(key)) return;
    if (this.currentBgmKey === key) return;

    const prev = this.currentBgmKey
      ? this.scene.sound.get(this.currentBgmKey)
      : null;
    if (prev && prev.isPlaying) {
      this.scene.tweens.add({
        targets: prev,
        volume: 0,
        duration: fadeMs,
        onComplete: () => prev.stop(),
      });
    }

    this.currentBgmKey = key;
    const track = this.scene.sound.add(key, {
      loop,
      volume: 0,
    });
    track.play();
    this.scene.tweens.add({
      targets: track,
      volume: this.bgmVolume,
      duration: fadeMs,
    });
  }

  playPhaseBgm(phaseId) {
    this.playBgm(PHASE_BGM[phaseId] ?? BGM.fase1);
  }

  stopBgm(fadeMs = 300) {
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

  setMuted(muted) {
    this.muted = muted;
    this.scene.sound.mute = muted;
  }
}

/**
 * URLs resolvidas pelo Parcel (`url:`) — garante que Alex/SFX/BGM
 * existam no bundle mesmo se /public falhar.
 */
import alexFleshUrl from "url:../../public/assets/player/alex-flesh/alex-flesh.png";

import sfxJump from "url:../../public/assets/audio/sfx/sfx-jump.wav";
import sfxLand from "url:../../public/assets/audio/sfx/sfx-land.wav";
import sfxSlide from "url:../../public/assets/audio/sfx/sfx-slide.wav";
import sfxEffort from "url:../../public/assets/audio/sfx/sfx-effort.wav";
import sfxFootstep from "url:../../public/assets/audio/sfx/sfx-footstep.wav";
import sfxHurt from "url:../../public/assets/audio/sfx/sfx-hurt.wav";
import sfxDeath from "url:../../public/assets/audio/sfx/sfx-death.wav";
import sfxCredit from "url:../../public/assets/audio/sfx/sfx-credit.wav";
import sfxCheckpoint from "url:../../public/assets/audio/sfx/sfx-checkpoint.wav";
import sfxAttack from "url:../../public/assets/audio/sfx/sfx-attack.wav";
import sfxDash from "url:../../public/assets/audio/sfx/sfx-dash.wav";
import sfxScan from "url:../../public/assets/audio/sfx/sfx-scan.wav";
import sfxUiSelect from "url:../../public/assets/audio/sfx/sfx-ui-select.wav";
import sfxUiConfirm from "url:../../public/assets/audio/sfx/sfx-ui-confirm.wav";
import sfxWater from "url:../../public/assets/audio/sfx/sfx-hazard-water.wav";
import sfxLaser from "url:../../public/assets/audio/sfx/sfx-hazard-laser.wav";
import sfxEnemyHit from "url:../../public/assets/audio/sfx/sfx-enemy-hit.wav";
import sfxGlitch from "url:../../public/assets/audio/sfx/sfx-glitch.wav";
import sfxPhaseClear from "url:../../public/assets/audio/sfx/sfx-phase-clear.wav";
import sfxImplant from "url:../../public/assets/audio/sfx/sfx-implant.wav";
import sfxClinicTools from "url:../../public/assets/audio/sfx/sfx-clinic-tools.wav";

import bgmMenu from "url:../../public/assets/audio/music/bgm-menu.wav";
import bgmFase1 from "url:../../public/assets/audio/music/bgm-fase-1-esgoto.wav";
import bgmFase2 from "url:../../public/assets/audio/music/bgm-fase-2-industrial.wav";
import bgmFase3 from "url:../../public/assets/audio/music/bgm-fase-3-meio-urbano.wav";
import bgmFase4 from "url:../../public/assets/audio/music/bgm-fase-4-corporativo.wav";
import bgmFase5 from "url:../../public/assets/audio/music/bgm-fase-5-topo.wav";
import bgmClinic from "url:../../public/assets/audio/music/bgm-clinic.wav";
import bgmPortao from "url:../../public/assets/audio/music/bgm-portao.wav";

export const ALEX_SHEET_URL = alexFleshUrl as string;

export const SFX_URLS: [string, string][] = [
  ["sfx-jump", sfxJump as string],
  ["sfx-land", sfxLand as string],
  ["sfx-slide", sfxSlide as string],
  ["sfx-effort", sfxEffort as string],
  ["sfx-footstep", sfxFootstep as string],
  ["sfx-hurt", sfxHurt as string],
  ["sfx-death", sfxDeath as string],
  ["sfx-credit", sfxCredit as string],
  ["sfx-checkpoint", sfxCheckpoint as string],
  ["sfx-attack", sfxAttack as string],
  ["sfx-dash", sfxDash as string],
  ["sfx-scan", sfxScan as string],
  ["sfx-ui-select", sfxUiSelect as string],
  ["sfx-ui-confirm", sfxUiConfirm as string],
  ["sfx-hazard-water", sfxWater as string],
  ["sfx-hazard-laser", sfxLaser as string],
  ["sfx-enemy-hit", sfxEnemyHit as string],
  ["sfx-glitch", sfxGlitch as string],
  ["sfx-phase-clear", sfxPhaseClear as string],
  ["sfx-implant", sfxImplant as string],
  ["sfx-clinic-tools", sfxClinicTools as string],
];

export const BGM_URLS: [string, string][] = [
  ["bgm-menu", bgmMenu as string],
  ["bgm-fase-1-esgoto", bgmFase1 as string],
  ["bgm-fase-2-industrial", bgmFase2 as string],
  ["bgm-fase-3-meio-urbano", bgmFase3 as string],
  ["bgm-fase-4-corporativo", bgmFase4 as string],
  ["bgm-fase-5-topo", bgmFase5 as string],
  ["bgm-clinic", bgmClinic as string],
  ["bgm-portao", bgmPortao as string],
];

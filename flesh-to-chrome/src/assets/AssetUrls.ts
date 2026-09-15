/**
 * URLs de runtime (Parcel + import.meta.url).
 * Fonte editável: ../../../../public/assets/ — sincronizar com
 * `npm run sync-assets` (raiz) antes de editar só a cópia em src/assets.
 */
const audio = (rel: string) => new URL(`./audio/${rel}`, import.meta.url).href;

export const SFX_URLS: [string, string][] = [
  ["sfx-jump", audio("sfx/sfx-jump.wav")],
  ["sfx-land", audio("sfx/sfx-land.wav")],
  ["sfx-slide", audio("sfx/sfx-slide.wav")],
  ["sfx-effort", audio("sfx/sfx-effort.wav")],
  ["sfx-footstep", audio("sfx/sfx-footstep.wav")],
  ["sfx-hurt", audio("sfx/sfx-hurt.wav")],
  ["sfx-death", audio("sfx/sfx-death.wav")],
  ["sfx-credit", audio("sfx/sfx-credit.wav")],
  ["sfx-checkpoint", audio("sfx/sfx-checkpoint.wav")],
  ["sfx-attack", audio("sfx/sfx-attack.wav")],
  ["sfx-dash", audio("sfx/sfx-dash.wav")],
  ["sfx-scan", audio("sfx/sfx-scan.wav")],
  ["sfx-ui-select", audio("sfx/sfx-ui-select.wav")],
  ["sfx-ui-confirm", audio("sfx/sfx-ui-confirm.wav")],
  ["sfx-hazard-water", audio("sfx/sfx-hazard-water.wav")],
  ["sfx-hazard-laser", audio("sfx/sfx-hazard-laser.wav")],
  ["sfx-enemy-hit", audio("sfx/sfx-enemy-hit.wav")],
  ["sfx-glitch", audio("sfx/sfx-glitch.wav")],
  ["sfx-phase-clear", audio("sfx/sfx-phase-clear.wav")],
  ["sfx-implant", audio("sfx/sfx-implant.wav")],
  ["sfx-clinic-tools", audio("sfx/sfx-clinic-tools.wav")],
];

export const BGM_URLS: [string, string][] = [
  ["bgm-menu", audio("music/bgm-menu.wav")],
  ["bgm-fase-1-esgoto", audio("music/bgm-fase-1-esgoto.wav")],
  ["bgm-fase-2-industrial", audio("music/bgm-fase-2-industrial.wav")],
  ["bgm-fase-3-meio-urbano", audio("music/bgm-fase-3-meio-urbano.wav")],
  ["bgm-fase-4-corporativo", audio("music/bgm-fase-4-corporativo.wav")],
  ["bgm-fase-5-topo", audio("music/bgm-fase-5-topo.wav")],
  ["bgm-clinic", audio("music/bgm-clinic.wav")],
  ["bgm-portao", audio("music/bgm-portao.wav")],
];

export const ALL_BGM_KEYS = BGM_URLS.map(([key]) => key);

import fase5Map from "../assets/maps/topo/fase-5.json";

export const TILED_FASE5_MAP_KEY = "map-fase5";

export const TILED_FASE5_TILESETS = [
  { name: "cyber-purp", key: "tiles-fase5-cyber-purp" },
  { name: "foozle-laser", key: "tiles-fase5-laser" },
  { name: "foozle-automatic-door", key: "tiles-fase5-automatic-door" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TILED_FASE5_MAP_DATA: any = fase5Map;
export const TILED_FASE5_NAME = "Fase 5 — Topo da Cidade";
export const TILED_FASE5_BACKGROUND = 0x16283a;

/** Superfície principal na linha 12: 384 + 176 = Y 560 no viewport. */
export const TILED_FASE5_OFFSET_Y = 560 - 12 * 32;

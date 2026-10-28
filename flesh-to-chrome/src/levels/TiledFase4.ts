import fase4Map from "../assets/maps/corporativo/fase-4.json";

export const TILED_FASE4_MAP_KEY = "map-fase4";

export const TILED_FASE4_TILESETS = [
  { name: "foozle-scifi-lab", key: "tiles-fase4-scifi-lab" },
  { name: "foozle-scifi-lab-decor", key: "tiles-fase4-scifi-lab-decor" },
  { name: "foozle-laser", key: "tiles-fase4-laser" },
  { name: "foozle-laser-spikes", key: "tiles-fase4-laser-spikes" },
  { name: "foozle-automatic-door", key: "tiles-fase4-automatic-door" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TILED_FASE4_MAP_DATA: any = fase4Map;
export const TILED_FASE4_NAME = "Fase 4 — Distrito Corporativo";

/**
 * O piso principal está na linha 12 (Y=384). Como nas fases 1 e 2, o
 * deslocamento coloca a superfície em Y=560 dentro do viewport de 720 px.
 */
export const TILED_FASE4_OFFSET_Y = 560 - 12 * 32; // = 176

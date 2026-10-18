import fase2Map from "../assets/maps/industrial/fase-2.json";

export const TILED_FASE2_MAP_KEY = "map-fase2";

export const TILED_FASE2_TILESETS = [
  { name: "industrial", key: "tiles-fase2-industrial" },
  { name: "industrial-machinery", key: "tiles-fase2-industrial-machinery" },
  { name: "industrial-details", key: "tiles-fase2-industrial-details" },
  { name: "industrial-background", key: "tiles-fase2-industrial-background" },
  { name: "industrial-machinery-background", key: "tiles-fase2-industrial-machinery-background" },
  { name: "industrial-details-background", key: "tiles-fase2-industrial-details-background" },
  { name: "industrial-far-background", key: "tiles-fase2-industrial-far-background" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TILED_FASE2_MAP_DATA: any = fase2Map;
export const TILED_FASE2_NAME = "Fase 2 — Distrito Industrial";

/**
 * O chão principal do mapa está na linha 12 (Y=384 no Tiled). O offset
 * coloca essa superfície em Y=560 na tela, igual às demais fases, e mantém
 * as 16 linhas do mapa completamente dentro do viewport de 720 px.
 */
export const TILED_FASE2_OFFSET_Y = 560 - 12 * 32; // = 176

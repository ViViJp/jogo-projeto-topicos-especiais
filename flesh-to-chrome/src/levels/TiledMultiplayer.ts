import multiplayerMap from "../assets/maps/multiplayer/multiplayer-race.json";
import { TILED_FASE5_OFFSET_Y, TILED_FASE5_TILESETS } from "./TiledFase5";

export const TILED_MULTIPLAYER_MAP_KEY = "map-multiplayer-race";
export const TILED_MULTIPLAYER_TILESETS = TILED_FASE5_TILESETS;
export const TILED_MULTIPLAYER_OFFSET_Y = TILED_FASE5_OFFSET_Y;
export const TILED_MULTIPLAYER_CREDIT_COUNT = 20;
export const TILED_MULTIPLAYER_NAME = "Circuito Competitivo — Topo de Glitch City";
export const TILED_MULTIPLAYER_BACKGROUND = 0x16283a;
export const TILED_MULTIPLAYER_LENGTH = 38_400;
export const TILED_MULTIPLAYER_END_X = 38_272;
export const TILED_MULTIPLAYER_SPAWN = { x: 80, y: 560 } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TILED_MULTIPLAYER_MAP_DATA: any = multiplayerMap;

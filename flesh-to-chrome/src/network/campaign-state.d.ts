import type { SaveData } from "../systems/SaveState";

export function toApiState(save: SaveData): Record<string, unknown>;
export function fromApiState(state: { progress?: SaveData; stageId?: string; credits?: { total?: number; consolidatedIds?: string[] }; implants?: string[]; ending?: SaveData["endingReached"] }): SaveData;
export function sameProgress(left: SaveData, right: SaveData): boolean;

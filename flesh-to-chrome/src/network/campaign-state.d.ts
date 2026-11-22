import type { SaveData } from "../systems/SaveState";

export interface ApiCampaignState {
  phase?: "ascent" | "descent" | "epilogue" | "ending";
  stageId?: string;
  checkpointId?: string | null;
  resumePoint?: { kind?: string; x?: number; y?: number };
  credits?: { total?: number; consolidatedIds?: string[] };
  implants?: string[];
  descent?: {
    step?: string | null;
    chainStatus?: string;
    memories?: string[];
    pendingMemory?: string | null;
    removals?: string[];
    retryUsedByStage?: Record<string, boolean>;
  };
  ending?: SaveData["endingReached"];
  preGateSnapshot?: ApiCampaignState | null;
  [key: string]: unknown;
}

export function toApiState(save: SaveData): ApiCampaignState;
export function fromApiState(state: ApiCampaignState): SaveData;
export function sameProgress(left: SaveData, right: SaveData): boolean;

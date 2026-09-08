import { LevelData } from "./LevelTypes";
import { PHASE_1 } from "./phase1";
import { PHASE_2_INTRO } from "./phase2Intro";

export const LEVELS: Record<string, LevelData> = {
  [PHASE_1.id]: PHASE_1,
  [PHASE_2_INTRO.id]: PHASE_2_INTRO,
};

export const PHASE_ORDER = [PHASE_1.id, PHASE_2_INTRO.id];

export function getNextPhaseId(currentId: string): string | null {
  const idx = PHASE_ORDER.indexOf(currentId);
  if (idx === -1 || idx === PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export { PHASE_1, PHASE_2_INTRO };
export * from "./LevelTypes";

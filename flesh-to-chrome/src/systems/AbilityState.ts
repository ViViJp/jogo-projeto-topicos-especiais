/**
 * Estado dos implantes de Alex (seção 15/16 do GDD).
 * Cada implante libera uma mecânica nova e é adquirido na clínica de
 * George ao final das quatro primeiras fases.
 */
export interface AbilityState {
  /** Pernas mecânicas -> libera salto duplo (pós Fase 1) */
  legs: boolean;
  /** Braços mecânicos -> libera ataque/quebra (pós Fase 2) */
  arms: boolean;
  /** Olhos mecânicos -> libera scan (pós Fase 3) */
  eyes: boolean;
  /** Propulsores -> libera dash (pós Fase 4) */
  thrusters: boolean;
}

export function createInitialAbilityState(): AbilityState {
  return {
    legs: false,
    arms: false,
    eyes: false,
    thrusters: false,
  };
}

export function abilityStateToBodyStage(state: AbilityState): number {
  // 0 = humano original ... 4 = robô completo (seção 23.1)
  let stage = 0;
  if (state.legs) stage++;
  if (state.arms) stage++;
  if (state.eyes) stage++;
  if (state.thrusters) stage++;
  return stage;
}

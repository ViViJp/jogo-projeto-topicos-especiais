export type HazardCycleState = "inactive" | "warning" | "active";

export interface HazardCycleTiming {
  cycleMs: number;
  activeMs: number;
  warningMs: number;
  phaseMs: number;
}

export interface HazardCycleSample {
  state: HazardCycleState;
  /** Progresso normalizado dentro do estado atual, entre 0 e 1. */
  progress: number;
}

export interface ScanControlledObstacle {
  x: number;
  width: number;
  disabled: boolean;
}

/** Estado e progresso contínuo usados para manter movimento e colisão juntos. */
export function hazardCycleSample(nowMs: number, timing: HazardCycleTiming): HazardCycleSample {
  const cycleMs = Math.max(1, timing.cycleMs);
  const activeMs = Math.min(Math.max(0, timing.activeMs), cycleMs);
  const warningMs = Math.min(Math.max(0, timing.warningMs), cycleMs - activeMs);
  const inactiveMs = Math.max(0, cycleMs - activeMs - warningMs);
  const position = ((nowMs + timing.phaseMs) % cycleMs + cycleMs) % cycleMs;

  if (position < activeMs) {
    return { state: "active", progress: activeMs > 0 ? position / activeMs : 1 };
  }
  if (position >= cycleMs - warningMs) {
    return {
      state: "warning",
      progress: warningMs > 0 ? (position - (cycleMs - warningMs)) / warningMs : 1,
    };
  }
  return {
    state: "inactive",
    progress: inactiveMs > 0 ? (position - activeMs) / inactiveMs : 1,
  };
}

/** Função pura para manter visual, colisão e testes na mesma linha do tempo. */
export function hazardCycleState(nowMs: number, timing: HazardCycleTiming): HazardCycleState {
  return hazardCycleSample(nowMs, timing).state;
}

/**
 * Escolhe somente o primeiro bloqueio alcançável pelo pulso à frente de Alex.
 * A seleção espacial transforma a passagem em uma ação reproduzível, sem
 * depender do instante arbitrário em que o auto-runner alcança um ciclo.
 */
export function nearestScanObstacleIndex(
  playerX: number,
  range: number,
  obstacles: ReadonlyArray<ScanControlledObstacle>,
): number {
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  obstacles.forEach((obstacle, index) => {
    if (obstacle.disabled) return;
    const distance = obstacle.x - playerX;
    if (distance < -obstacle.width || distance > range) return;
    const comparableDistance = Math.max(0, distance);
    if (comparableDistance >= nearestDistance) return;
    nearestDistance = comparableDistance;
    nearestIndex = index;
  });

  return nearestIndex;
}

export interface Point {
  x: number;
  y: number;
}

/** Centros dos pequenos corpos físicos que formam o braço rotativo. */
export function rotatingBarrierPoints(
  centerX: number,
  centerY: number,
  length: number,
  nodeCount: number,
  angle: number,
): Point[] {
  const count = Math.max(1, Math.floor(nodeCount));
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 0 : index / (count - 1) - 0.5;
    return {
      x: centerX + cosine * length * fraction,
      y: centerY + sine * length * fraction,
    };
  });
}

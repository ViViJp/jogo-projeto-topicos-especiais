export type HazardCycleState = "inactive" | "warning" | "active";

export interface HazardCycleTiming {
  cycleMs: number;
  activeMs: number;
  warningMs: number;
  phaseMs: number;
}

/** Função pura para manter visual, colisão e testes na mesma linha do tempo. */
export function hazardCycleState(nowMs: number, timing: HazardCycleTiming): HazardCycleState {
  const cycleMs = Math.max(1, timing.cycleMs);
  const activeMs = Math.min(Math.max(0, timing.activeMs), cycleMs);
  const warningMs = Math.min(Math.max(0, timing.warningMs), cycleMs - activeMs);
  const position = ((nowMs + timing.phaseMs) % cycleMs + cycleMs) % cycleMs;
  if (position < activeMs) return "active";
  if (position >= cycleMs - warningMs) return "warning";
  return "inactive";
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

import { LevelData } from "./LevelTypes";
import { LevelBuilder } from "./LevelBuilder";

/** Prévia curta da Fase 4, dedicada ao scan e às passagens ocultas. */
const GROUND_Y = 560;

function build(): LevelData {
  const b = new LevelBuilder(GROUND_Y);

  b.ground(660);
  b.abilityGateAt("scan", -120, 56, 96, "VISOR: E / L / Y");
  b.creditAt(-48, GROUND_Y - 58, 10, false);

  b.ground(520);
  b.abilityGateAt("scan", -140, 64, 104);
  b.creditAt(-54, GROUND_Y - 58, 10, false);

  // Combina a leitura pelo visor com o salto duplo já aprendido.
  b.gap(180, "scan + salto duplo");
  b.ground(520);
  b.abilityGateAt("scan", -150, 64, 112);
  b.creditAt(-58, GROUND_Y - 62, 10, false);

  const endGateX = b.position + 100;
  b.ground(260);

  return {
    id: "fase4",
    name: "Fase 4 — Corporativo (prévia de visor)",
    length: b.position + 200,
    groundY: GROUND_Y,
    groundSegments: b.groundSegments,
    surfaceHazards: b.surfaceHazards,
    overheadObstacles: b.overheadObstacles,
    credits: b.credits,
    checkpoints: b.checkpoints,
    breakables: b.breakables,
    abilityGates: b.abilityGates,
    endGateX,
    playerSpawnX: 80,
  };
}

export const PHASE_4_INTRO: LevelData = build();

import { LevelData } from "./LevelTypes";
import { LevelBuilder } from "./LevelBuilder";

/** Prévia curta da Fase 3, dedicada a ensinar ataque e quebra. */
const GROUND_Y = 560;

function build(): LevelData {
  const b = new LevelBuilder(GROUND_Y);

  // Leitura segura antes do primeiro uso obrigatório do ataque.
  b.ground(720);
  b.breakableAt(-96, 48, 64, "ATAQUE: J / CLIQUE / X");

  // Espaço para recuperar a cadência e repetir o comando.
  b.ground(360);
  b.breakableAt(-96, 48, 64);

  // Relembra o salto duplo e pede ataque logo após o pouso.
  b.gap(180, "salto antes do ataque");
  b.ground(420);
  b.breakableAt(-120, 56, 72);
  b.creditAt(-42, GROUND_Y - 58, 15, false);

  // Última repetição, com tempo amplo de leitura antes do final.
  b.ground(420);
  b.breakableAt(-140, 64, 72);
  b.creditAt(-54, GROUND_Y - 58, 15, false);

  const endGateX = b.position + 100;
  b.ground(260);

  return {
    id: "fase3",
    name: "Fase 3 — Meio Urbano (prévia de ataque)",
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

export const PHASE_3_INTRO: LevelData = build();

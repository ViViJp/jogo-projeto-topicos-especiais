import { LevelData } from "./LevelTypes";
import { LevelBuilder } from "./LevelBuilder";

/** Prévia curta da Fase 5, dedicada ao dash e ao domínio do kit. */
const GROUND_Y = 560;

function build(): LevelData {
  const b = new LevelBuilder(GROUND_Y);

  // O GDD pede que a Fase 5 comece com um checkpoint.
  b.ground(240);
  b.checkpointHere();

  // Primeiro uso seguro: o dash abre a barreira cinética no chão.
  b.ground(480);
  b.abilityGateAt("dash", -100, 56, 88, "DASH: K / SHIFT / RB");
  b.creditAt(-38, GROUND_Y - 58, 10, false);

  // 900 px dão mais de 2 s para o cooldown terminar antes do vão.
  b.ground(900);
  b.creditAt(-300, GROUND_Y - 100, 10, true);
  b.creditAt(-220, GROUND_Y - 130, 10, true);
  b.creditAt(-140, GROUND_Y - 100, 10, true);

  // 440 px: maior que o alcance útil do salto duplo (~410 px), mas
  // alcançável ao somar os ~88 px extras produzidos pelo dash aéreo.
  b.gap(440, "salto duplo + dash obrigatório");
  b.ground(700);

  // Repetição final depois de uma área ampla de recuperação.
  b.abilityGateAt("dash", -120, 64, 96);
  b.creditAt(-48, GROUND_Y - 62, 15, false);

  const endGateX = b.position + 100;
  b.ground(260);

  return {
    id: "fase5",
    name: "Fase 5 — Topo (prévia de dash)",
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

export const PHASE_5_INTRO: LevelData = build();

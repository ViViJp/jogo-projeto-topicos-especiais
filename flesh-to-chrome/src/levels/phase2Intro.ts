import { LevelData } from "./LevelTypes";
import { LevelBuilder } from "./LevelBuilder";

/**
 * Fase 2 (trecho inicial) - Industrial.
 *
 * O GDD (seção 24.2, Marco 2 - Vertical Slice) pede apenas o "início da
 * Fase 2" nesta etapa do projeto: o gap impossível de salto simples, o
 * teste seguro de salto duplo e a primeira bifurcação de rota de créditos.
 * O restante da Fase 2 (prensas, esteiras, jatos de vapor, braços
 * industriais, trituradoras, checkpoint e combinação final - seção 16.2)
 * fica para o Marco 3 e está descrito no README como próximo passo.
 */

const GROUND_Y = 560;

/** maior gap presente na Fase 1, que é sempre transponível com salto simples. */
const MAX_SINGLE_JUMP_GAP = 220;

function build(): LevelData {
  const b = new LevelBuilder(GROUND_Y);

  b.ground(500);

  // GAP IMPOSSÍVEL COM SALTO SIMPLES - deixa claro que a habilidade antiga não basta
  b.gap(MAX_SINGLE_JUMP_GAP + 140, "gap impossível com salto simples");
  b.ground(260);

  // TESTE SEGURO - segundo salto sem grande punição por erro (gap pequeno, chão largo depois)
  b.gap(180, "teste seguro do salto duplo");
  b.ground(320);

  // GAPS VARIADOS - rota normal vs rota de risco (+créditos)
  b.creditAt(40, GROUND_Y - 30, 10, false);
  b.ground(160);
  b.creditAt(30, GROUND_Y - 160, 15, true);
  b.creditAt(80, GROUND_Y - 190, 15, true);
  b.gap(230, "gaps variados - rota de risco");
  b.ground(300);

  // SALTO DUPLO + SLIDE - combinação já introduzindo o próximo tipo de leitura
  b.overhead("pipe", 110, "salto duplo + slide");
  b.ground(140);

  const endGateX = b.position + 100;
  b.ground(260);

  return {
    id: "fase2-intro",
    name: "Fase 2 — Industrial (trecho inicial / vertical slice)",
    length: b.position + 200,
    groundY: GROUND_Y,
    groundSegments: b.groundSegments,
    surfaceHazards: b.surfaceHazards,
    overheadObstacles: b.overheadObstacles,
    credits: b.credits,
    checkpoints: b.checkpoints,
    endGateX,
    playerSpawnX: 80,
  };
}

export const PHASE_2_INTRO: LevelData = build();

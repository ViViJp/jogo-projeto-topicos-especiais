import { LevelBuilder } from "./LevelBuilder";
import { LevelData } from "./LevelTypes";

const GROUND_Y = 560;
const CREDIT_COUNT = 20;

/** Pista exclusiva do multiplayer, com os quatro implantes desde a largada. */
function build(): LevelData {
  const builder = new LevelBuilder(GROUND_Y);

  for (let sector = 0; sector < CREDIT_COUNT; sector += 1) {
    // Um credito por setor: 20 no total, como definido no GDD 21.4.
    const creditY = sector % 3 === 0 ? GROUND_Y - 120 : GROUND_Y - 54;
    builder.creditAt(380, creditY, 1, creditY < GROUND_Y - 60);
    builder.ground(900);

    switch (sector % 6) {
      case 0:
        builder.gap(180, "pulo simples competitivo", sector % 12 === 0 ? "water" : null);
        builder.ground(520);
        break;
      case 1:
        builder.gap(300, "salto duplo competitivo");
        builder.ground(540);
        break;
      case 2:
        builder.overhead(sector % 2 === 0 ? "pipe" : "wire", 110, "leitura de slide");
        builder.ground(110);
        builder.ground(500);
        break;
      case 3:
        builder.ground(600);
        builder.breakableAt(-140, 56, 72, sector === 3 ? "ATAQUE" : undefined);
        break;
      case 4:
        builder.ground(620);
        builder.abilityGateAt("scan", -150, 60, 104, sector === 4 ? "SCAN" : undefined);
        break;
      case 5:
        builder.ground(900);
        builder.abilityGateAt("dash", -140, 60, 96, sector === 5 ? "DASH" : undefined);
        builder.gap(360, "salto duplo + dash");
        builder.ground(500);
        break;
    }

    // Único checkpoint, aproximadamente no centro da pista.
    if (sector === CREDIT_COUNT / 2 - 1) builder.checkpointHere();
  }

  const endGateX = builder.position + 120;
  builder.ground(360);

  return {
    id: "multiplayer-race",
    name: "Circuito Competitivo — Glitch City",
    length: builder.position + 200,
    groundY: GROUND_Y,
    groundSegments: builder.groundSegments,
    surfaceHazards: builder.surfaceHazards,
    overheadObstacles: builder.overheadObstacles,
    credits: builder.credits,
    checkpoints: builder.checkpoints,
    breakables: builder.breakables,
    abilityGates: builder.abilityGates,
    endGateX,
    playerSpawnX: 80,
  };
}

export const MULTIPLAYER_RACE: LevelData = build();
export const MULTIPLAYER_CREDIT_COUNT = CREDIT_COUNT;

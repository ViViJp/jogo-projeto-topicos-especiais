import { LevelData } from "./LevelTypes";
import { LevelBuilder } from "./LevelBuilder";

/**
 * Fase 1 - Esgoto / Periferia.
 * Segue, nó a nó, o fluxograma descrito em `levelDesign.md`:
 * trecho seguro -> primeiro pulo -> gaps -> cano baixo (slide) ->
 * pulo+slide -> água tóxica -> rota de créditos (normal/risco) ->
 * tubulação rompida -> checkpoint -> fios energizados próximos à água ->
 * sequência de domínio -> final da fase (clínica de George).
 *
 * As distâncias entre obstáculos são um ponto de partida para prototipagem
 * (ver seção 26 do GDD - "Validações Pendentes de Playtest") e devem ser
 * recalibradas pela equipe de design a partir de playtest real.
 */

const GROUND_Y = 560;

function build(): LevelData {
  const b = new LevelBuilder(GROUND_Y);

  // 1) TRECHO INICIAL SEGURO - corrida automática / leitura
  b.ground(700);

  // 2) PRIMEIRO PULO - obstáculo simples (acerto -> continua / queda -> morte)
  b.gap(150, "primeiro pulo");
  b.ground(260);

  // 3) GAPS - uso repetido de pulo
  b.gap(150, "gaps - 1");
  b.ground(140);
  b.gap(170, "gaps - 2");
  b.ground(140);
  b.gap(190, "gaps - 3");
  b.ground(320);

  // 4) CANO BAIXO - ensina slide (acerto/slide -> continua / colisão -> morte)
  b.overhead("pipe", 110, "cano baixo - ensina slide");
  b.ground(110);
  b.ground(320);

  // 5) PULO + SLIDE (combinação) - gap seguido de perto por outro cano
  b.gap(140, "pulo + slide - gap");
  b.ground(320);
  b.overhead("pipe", 100, "pulo + slide - cano");
  b.ground(100);
  b.ground(260);

  // 6) ÁGUA TÓXICA - hazard de 1 hit
  b.gap(220, "água tóxica", "water");
  b.ground(220);

  // 7) PRIMEIRA ROTA DE CRÉDITOS - normal vs risco
  b.creditAt(40, GROUND_Y - 30, 10, false);
  b.creditAt(110, GROUND_Y - 30, 10, false);
  b.ground(200);
  // rota de risco: créditos flutuantes sobre um gap adicional
  b.creditAt(40, GROUND_Y - 140, 15, true);
  b.creditAt(90, GROUND_Y - 170, 15, true);
  b.creditAt(140, GROUND_Y - 140, 15, true);
  b.gap(170, "rota de risco", null);
  b.ground(300);

  // 8) TUBULAÇÃO ROMPIDA
  b.overhead("pipe", 120, "tubulação rompida");
  b.ground(160);
  b.ground(200);

  // 9) CHECKPOINT - videogame + TV de tubo (consolida os créditos)
  b.checkpointHere();
  b.ground(260);

  // 10) FIOS ENERGIZADOS PRÓXIMOS À ÁGUA - leitura combinada
  //
  // O buffer de chão entre o fim do gap e o começo do obstáculo aéreo
  // precisa ser grande o bastante para SEMPRE caber o pior caso de pouso
  // de pulo (jogador pula bem no limite do gap) + uma margem de reação
  // para começar a deslizar antes de tocar o cano/fio - ver a fórmula
  // documentada no cabeçalho de `LevelBuilder`/`level_check` usada para
  // validar toda a fase (distância de pulo ≈272px, margem de reação
  // ≈150px). Buffers de 90px (valor original) deixavam esse trecho
  // matematicamente impossível de passar dependendo de quando o jogador
  // pulava - era o "muro amarelo" reportado em playtest.
  b.gap(180, "fios próximos à água", "water");
  b.ground(300);
  b.overhead("wire", 110, "fios energizados");
  b.ground(440);

  // 11) SEQUÊNCIA DE DOMÍNIO - pulo + slide + água tóxica + tubulações + fios
  // Mesma correção de espaçamento do item 10 aplicada a toda a sequência:
  // cada trecho gap->obstáculo aéreo tem buffer suficiente para qualquer
  // timing de pulo, e cada trecho obstáculo->gap dá espaço para levantar
  // do slide e ainda encontrar a janela válida de pulo.
  b.gap(140, "domínio - pulo");
  b.ground(320);
  b.overhead("pipe", 100, "domínio - slide 1");
  b.ground(370);
  b.gap(190, "domínio - água tóxica", "water");
  b.ground(270);
  b.overhead("wire", 100, "domínio - fios");
  b.ground(300);
  b.overhead("pipe", 100, "domínio - slide 2");
  b.ground(420);
  b.gap(150, "domínio - pulo final");
  b.ground(300);

  // 12) FINAL DA FASE -> Clínica de George
  const endGateX = b.position + 120;
  b.ground(260);

  return {
    id: "fase1",
    name: "Fase 1 — Esgoto / Periferia",
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

export const PHASE_1: LevelData = build();

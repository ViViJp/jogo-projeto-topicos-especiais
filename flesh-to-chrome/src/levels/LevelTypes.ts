/**
 * Formato de nível "placeholder" usado pelo protótipo.
 *
 * O GDD (seção 7.1 / 22.1) define Tiled/JSON como ferramenta de level
 * design. Como nenhum arquivo .tmj foi fornecido ainda pela equipe de
 * design, este protótipo usa um formato JSON próprio e mais simples,
 * pensado para ser directamente substituível por um LevelLoader baseado em
 * Tiled no futuro: basta escrever um `TiledLevelAdapter` que traduza o
 * mapa exportado do Tiled para este mesmo `LevelData`, sem tocar no resto
 * do jogo (Player, sistemas, cenas).
 */

export type HazardKind = "water" | "spikes" | "industrial";
export type OverheadKind = "pipe" | "wire";

export interface GroundSegment {
  /** início e fim (em px) do trecho de chão sólido. Entre segmentos = poço (queda = morte). */
  x0: number;
  x1: number;
}

export interface SurfaceHazard {
  id: string;
  kind: HazardKind;
  x: number;
  width: number;
  /** nota de design, referência ao nó do fluxograma (levelDesign.md) */
  note?: string;
}

export interface OverheadObstacle {
  id: string;
  kind: OverheadKind;
  x: number;
  width: number;
  note?: string;
}

export interface CreditEntry {
  id: string;
  x: number;
  y: number;
  value: number;
  /** créditos em "rota de risco" ficam mais altos / perto de hazards */
  risky?: boolean;
}

export interface CheckpointEntry {
  id: string;
  x: number;
}

export interface LevelData {
  id: string;
  name: string;
  /** comprimento total do nível em px */
  length: number;
  groundY: number;
  groundSegments: GroundSegment[];
  surfaceHazards: SurfaceHazard[];
  overheadObstacles: OverheadObstacle[];
  credits: CreditEntry[];
  checkpoints: CheckpointEntry[];
  /** x a partir do qual a fase é considerada concluída (ex.: entrada da clínica) */
  endGateX: number;
  playerSpawnX: number;
}

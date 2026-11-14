import type Phaser from "phaser";

export interface LoadingTransitionData {
  nextScene: string;
  nextData?: object;
  destinationLabel?: string;
}

const SCENE_LABELS: Readonly<Record<string, string>> = {
  ClinicScene: "CLÍNICA DE GEORGE",
  GateScene: "O PORTÃO",
  GeorgeRefusalScene: "CLÍNICA // RUPTURA",
  ReForgeScene: "UNIDADE REFORGE",
  DescentRetryScene: "MEMÓRIA PERDIDA",
  EpilogueScene: "CAMINHO DE CASA",
  EndingScene: "EPÍLOGO",
  FeedbackScene: "AVALIAÇÃO DE EXPERIÊNCIA",
  PrologueScene: "PRÓLOGO",
  ControlsScene: "CONTROLES",
  MultiplayerScene: "CONEXÃO MULTIPLAYER",
};

const PHASE_LABELS: Readonly<Record<string, string>> = {
  fase1: "FASE 1 // ESGOTO E PERIFERIA",
  "fase2-intro": "FASE 2 // DISTRITO INDUSTRIAL",
  fase3: "FASE 3 // MEIO URBANO",
  fase4: "FASE 4 // DISTRITO CORPORATIVO",
  fase5: "FASE 5 // TOPO DA CIDADE",
};

export function loadingDestinationLabel(nextScene: string, nextData?: object): string {
  if (nextScene === "GameScene") {
    const phaseId = (nextData as { phaseId?: string } | undefined)?.phaseId;
    return phaseId ? PHASE_LABELS[phaseId] ?? phaseId.toUpperCase() : "NOVO SETOR";
  }
  return SCENE_LABELS[nextScene] ?? nextScene.replace(/Scene$/, "").toUpperCase();
}

/** Único ponto de entrada para trocas de campanha que podem carregar assets. */
export function startLoadingTransition(
  scene: Phaser.Scene,
  nextScene: string,
  nextData?: object,
  destinationLabel = loadingDestinationLabel(nextScene, nextData),
): void {
  scene.scene.start("LoadingScene", { nextScene, nextData, destinationLabel });
}

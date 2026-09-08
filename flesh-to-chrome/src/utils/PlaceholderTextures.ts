import Phaser from "phaser";
import { PLAYER_SIZE, PLAYER_SLIDE_SIZE } from "../config/GameConfig";

/**
 * Marco 1 (Protótipo técnico) exige apenas "placeholders" como arte.
 * Este módulo gera texturas simples (retângulos/círculos coloridos) via
 * Phaser.GameObjects.Graphics -> generateTexture, para que nenhum asset
 * externo seja necessário para rodar o protótipo. Quando a arte real
 * (seção 23.1) estiver pronta, basta trocar as chamadas `scene.add.sprite`
 * pelos spritesheets finais - o resto do código (física, colisão, estado)
 * não muda.
 */

export const TEX = {
  player: "tex_player",
  playerSlide: "tex_player_slide",
  ground: "tex_ground",
  hazard: "tex_hazard",
  pipe: "tex_pipe",
  wire: "tex_wire",
  credit: "tex_credit",
  checkpoint: "tex_checkpoint",
  breakable: "tex_breakable",
  bandido: "tex_bandido",
  drone: "tex_drone",
  gate: "tex_gate",
  scanReveal: "tex_scan_reveal",
} as const;

function rect(scene: Phaser.Scene, key: string, w: number, h: number, color: number, alpha = 1, border?: number) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(color, alpha);
  g.fillRect(0, 0, w, h);
  if (border) {
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeRect(1, 1, w - 2, h - 2);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

function circle(scene: Phaser.Scene, key: string, r: number, color: number) {
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(color, 1);
  g.fillCircle(r, r, r);
  g.lineStyle(2, 0xffffff, 0.6);
  g.strokeCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.player)) return; // já geradas nesta sessão do jogo

  // Alex: retângulo com um "visor" para dar leitura de direção.
  rect(scene, TEX.player, PLAYER_SIZE.width, PLAYER_SIZE.height, 0x9be7ff, 1, 1);
  // Pose de slide: textura própria (mais baixa) em vez de re-escalar a
  // textura em pé - evita descasar o corpo físico do sprite visual.
  rect(scene, TEX.playerSlide, PLAYER_SLIDE_SIZE.width, PLAYER_SLIDE_SIZE.height, 0x6fd3ff, 1, 1);

  rect(scene, TEX.ground, 64, 64, 0x2a2f45, 1, 1);
  rect(scene, TEX.hazard, 64, 48, 0x00e08a, 0.55); // água tóxica
  rect(scene, TEX.pipe, 90, 40, 0x54607a, 1, 1); // cano baixo
  rect(scene, TEX.wire, 96, 16, 0xffd400, 0.8);
  rect(scene, TEX.breakable, 48, 48, 0xff8a3d, 1, 1);
  rect(scene, TEX.bandido, 40, 56, 0xff4d6d, 1, 1);
  rect(scene, TEX.drone, 56, 32, 0x6f8bff, 1, 1);
  rect(scene, TEX.gate, 24, 220, 0xd3d3ff, 1, 1);
  rect(scene, TEX.scanReveal, 48, 48, 0xffffff, 0.25);

  circle(scene, TEX.credit, 12, 0xffe066);
  circle(scene, TEX.checkpoint, 22, 0x36e2ff);
}

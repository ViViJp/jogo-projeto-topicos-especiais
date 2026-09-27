import Phaser from "phaser";

/**
 * v0.2.0: Alex e os mapas já usam arte real (ver `AlexSprite.ts` e
 * `LevelRuntime.ts`). Este módulo agora só cobre o que ainda não tem arte
 * dedicada nesta passagem (crédito coletável, checkpoint e os elementos de
 * fases futuras ainda não implementados) - texturas simples geradas via
 * Phaser.GameObjects.Graphics -> generateTexture, sem depender de nenhum
 * arquivo externo.
 */

export const TEX = {
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
  if (scene.textures.exists(TEX.ground)) return; // já geradas nesta sessão do jogo

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

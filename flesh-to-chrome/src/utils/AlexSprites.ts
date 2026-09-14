import Phaser from "phaser";
import { PLAYER_SIZE, PLAYER_SLIDE_SIZE } from "../config/GameConfig";
import { ALEX_SHEET_URL } from "../assets/AssetUrls";

/** LPC Universal — 64×64, 13 colunas. */
export const LPC = {
  FRAME: 64,
  COLS: 13,
  WALK_RIGHT: { row: 11, frames: 9 },
  HURT: { row: 20, frames: 6 },
} as const;

export const ALEX = {
  sheet: "alex-flesh",
  run: "alex-run",
  hurt: "alex-hurt",
} as const;

export function lpcFrameRange(row: number, count: number): number[] {
  const start = row * LPC.COLS;
  return Phaser.Utils.Array.NumberArray(start, start + count - 1) as number[];
}

export function preloadAlex(scene: Phaser.Scene): void {
  scene.load.spritesheet(ALEX.sheet, ALEX_SHEET_URL, {
    frameWidth: LPC.FRAME,
    frameHeight: LPC.FRAME,
  });
}

export function createAlexAnims(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(ALEX.sheet)) {
    console.error("[alex] spritesheet não carregou — usando placeholder");
    return false;
  }
  if (scene.anims.exists(ALEX.run)) return true;

  scene.anims.create({
    key: ALEX.run,
    frames: scene.anims.generateFrameNumbers(ALEX.sheet, {
      frames: lpcFrameRange(LPC.WALK_RIGHT.row, LPC.WALK_RIGHT.frames),
    }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: ALEX.hurt,
    frames: scene.anims.generateFrameNumbers(ALEX.sheet, {
      frames: lpcFrameRange(LPC.HURT.row, LPC.HURT.frames),
    }),
    frameRate: 8,
    repeat: 0,
  });
  return true;
}

/**
 * Corpo em pé: hitbox ancorada na base do frame (origem dos pés = 0.5, 1).
 * Não usa setDisplaySize — isso descasa body × sprite e afunda no chão.
 */
export function applyStandBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setScale(1);
  sprite.setCrop(); // limpa crop do slide
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(PLAYER_SIZE.width, PLAYER_SIZE.height);
  const ox = (LPC.FRAME - PLAYER_SIZE.width) / 2;
  const oy = LPC.FRAME - PLAYER_SIZE.height;
  body.setOffset(ox, oy);
}

/**
 * Slide/agachar: mantém o frame 64×64 e a origem nos pés; só reduz o
 * corpo físico ancorado embaixo. Visual: crop do topo (parece agachado)
 * sem mover Y no mundo.
 */
export function applySlideBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setScale(1);
  const cropTop = LPC.FRAME - PLAYER_SLIDE_SIZE.height;
  sprite.setCrop(0, cropTop, LPC.FRAME, PLAYER_SLIDE_SIZE.height);

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(PLAYER_SLIDE_SIZE.width, PLAYER_SLIDE_SIZE.height);
  const ox = (LPC.FRAME - PLAYER_SLIDE_SIZE.width) / 2;
  const oy = LPC.FRAME - PLAYER_SLIDE_SIZE.height;
  body.setOffset(ox, oy);
}

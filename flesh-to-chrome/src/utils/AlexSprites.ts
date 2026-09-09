import Phaser from "phaser";
import { PLAYER_SIZE, PLAYER_SLIDE_SIZE } from "../config/GameConfig";

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
  return Phaser.Utils.Array.NumberArray(start, start + count - 1);
}

export function preloadAlex(scene: Phaser.Scene): void {
  scene.load.spritesheet(ALEX.sheet, "assets/player/alex-flesh/alex-flesh.png", {
    frameWidth: LPC.FRAME,
    frameHeight: LPC.FRAME,
  });
}

export function createAlexAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists(ALEX.run)) return;

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
}

export function applyStandBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setScale(1);
  sprite.setDisplaySize(LPC.FRAME, LPC.FRAME);
  sprite.setSize(PLAYER_SIZE.width, PLAYER_SIZE.height);
  const ox = (LPC.FRAME - PLAYER_SIZE.width) / 2;
  const oy = LPC.FRAME - PLAYER_SIZE.height;
  sprite.body!.setOffset(ox, oy);
}

/** Slide/agachar: visual mais baixo + hitbox PLAYER_SLIDE_SIZE (canos). */
export function applySlideBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setScale(1);
  sprite.setDisplaySize(PLAYER_SLIDE_SIZE.width + 8, PLAYER_SLIDE_SIZE.height + 4);
  sprite.setSize(PLAYER_SLIDE_SIZE.width, PLAYER_SLIDE_SIZE.height);
  // com origin (0.5, 1), offset em coords da textura exibida
  sprite.body!.setOffset(
    (sprite.displayWidth - PLAYER_SLIDE_SIZE.width) / 2 / sprite.scaleX,
    (sprite.displayHeight - PLAYER_SLIDE_SIZE.height) / sprite.scaleY
  );
}

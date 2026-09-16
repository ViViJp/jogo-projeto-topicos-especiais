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

/**
 * O sheet LPC NÃO tem crouch/crawl de platformer — só walk/sit/jump/etc.
 * Sit parece “cadeira invisível”. Até existir arte de agachar, usamos
 * scaleY a partir dos pés (origem 0.5,1) + animação de walk.
 */
export const SLIDE_VISUAL_SCALE_Y = PLAYER_SLIDE_SIZE.height / PLAYER_SIZE.height;

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
 */
export function applyStandBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setScale(1);
  sprite.setCrop();
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setSize(PLAYER_SIZE.width, PLAYER_SIZE.height);
  const ox = (LPC.FRAME - PLAYER_SIZE.width) / 2;
  const oy = LPC.FRAME - PLAYER_SIZE.height;
  body.setOffset(ox, oy);
}

/**
 * Agachar provisório: comprime o sprite a partir dos pés (scaleY) e reduz
 * a hitbox. Continua o frame/anim de walk — sem sit e sem crop de cabeça.
 * Body size é compensado porque o Arcade multiplica size × scale.
 */
export function applySlideBody(sprite: Phaser.Physics.Arcade.Sprite): void {
  sprite.setCrop();
  const sy = SLIDE_VISUAL_SCALE_Y;
  sprite.setScale(1, sy);

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  const bodyH = Math.round(PLAYER_SLIDE_SIZE.height / sy);
  const bodyW = PLAYER_SLIDE_SIZE.width;
  body.setSize(bodyW, bodyH);
  const ox = (LPC.FRAME - bodyW) / 2;
  const oy = LPC.FRAME - bodyH;
  body.setOffset(ox, oy);
}

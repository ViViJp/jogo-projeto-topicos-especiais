import Phaser from 'phaser';

/** LPC standard: 64x64 frames, 13 columns per row. */
export const LPC = {
  FRAME: 64,
  COLS: 13,
  /** Walk cycle facing right (auto-runner L→R). */
  WALK_RIGHT: { row: 11, frames: 9 },
  /** Hurt / knocked down. */
  HURT: { row: 20, frames: 6 },
};

export function lpcFrameRange(row, count) {
  const start = row * LPC.COLS;
  return Phaser.Utils.Array.NumberArray(start, start + count - 1);
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.spritesheet('alex-flesh', 'assets/player/alex-flesh/alex-flesh.png', {
      frameWidth: LPC.FRAME,
      frameHeight: LPC.FRAME,
    });
  }

  create() {
    this.anims.create({
      key: 'alex-run',
      frames: this.anims.generateFrameNumbers('alex-flesh', {
        frames: lpcFrameRange(LPC.WALK_RIGHT.row, LPC.WALK_RIGHT.frames),
      }),
      frameRate: 12,
      repeat: -1,
    });

    this.anims.create({
      key: 'alex-hurt',
      frames: this.anims.generateFrameNumbers('alex-flesh', {
        frames: lpcFrameRange(LPC.HURT.row, LPC.HURT.frames),
      }),
      frameRate: 8,
      repeat: 0,
    });

    this.scene.start('GameScene');
  }
}

import Phaser from 'phaser';
import { LPC } from './PreloadScene.js';
import { AudioManager, SFX, BGM } from '../audio/AudioManager.js';

const RUN_SPEED = 180;
const JUMP_VELOCITY = -420;
const GROUND_Y = 400;
const SLIDE_MS = 450;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width } = this.scale;
    this.audio = new AudioManager(this);
    this.audio.playBgm(BGM.fase1);
    this.wasOnFloor = true;
    this.sliding = false;
    this.slideUntil = 0;

    this.add
      .rectangle(width / 2, GROUND_Y + 25, width * 4, 50, 0x2a2a35)
      .setScrollFactor(0.2);

    this.ground = this.add.rectangle(width * 2, GROUND_Y + 25, width * 8, 50, 0x3d3d4a);
    this.physics.add.existing(this.ground, true);

    // cano baixo — precisa agachar (S / ↓)
    this.pipe = this.add.rectangle(520, GROUND_Y - 50, 90, 40, 0x54607a);
    this.physics.add.existing(this.pipe, true);

    const idleFrame = LPC.WALK_RIGHT.row * LPC.COLS;
    this.player = this.physics.add.sprite(120, GROUND_Y - 40, 'alex-flesh', idleFrame);
    this.player.setCollideWorldBounds(false);
    this.setStandHitbox();
    this.player.play('alex-run');

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.pipe, () => {
      if (!this.sliding) {
        this.audio.sfx(SFX.hurt);
        this.player.setVelocityY(-200);
        this.player.x = Math.max(80, this.player.x - 40);
      }
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(80, 40);

    this.hint = this.add
      .text(12, 12, 'Espaço/W/↑ pular  ·  S/↓ agachar (slide)  ·  cano em ~520px', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#c8c8d0',
      })
      .setScrollFactor(0)
      .setDepth(10);
  }

  setStandHitbox() {
    this.player.body.setSize(28, 48);
    this.player.body.setOffset(18, 14);
    this.player.setDisplaySize(64, 64);
  }

  setSlideHitbox() {
    this.player.body.setSize(36, 24);
    this.player.body.setOffset(14, 40);
    this.player.setDisplaySize(64, 36);
  }

  update(time) {
    this.player.setVelocityX(RUN_SPEED);

    const onFloor = this.player.body.blocked.down || this.player.body.touching.down;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const slideHeld =
      this.keyS.isDown || this.cursors.down.isDown;

    if (this.sliding && time >= this.slideUntil && !slideHeld) {
      this.sliding = false;
      this.setStandHitbox();
      if (onFloor) this.player.play('alex-run', true);
    }

    if (!this.sliding && slideHeld && onFloor) {
      this.sliding = true;
      this.slideUntil = time + SLIDE_MS;
      this.setSlideHitbox();
      this.player.anims.pause();
      this.audio.sfx(SFX.slide);
      this.audio.sfx(SFX.effort, { volume: 0.5, rate: 0.92 });
    }

    if (jumpPressed && onFloor && !this.sliding) {
      this.player.setVelocityY(JUMP_VELOCITY);
      this.audio.sfx(SFX.jump);
      this.audio.sfx(SFX.effort, { volume: 0.7 });
    }

    if (onFloor && !this.wasOnFloor) {
      this.audio.sfx(SFX.land);
    }
    this.wasOnFloor = onFloor;

    if (onFloor && !this.sliding) {
      if (this.player.anims.currentAnim?.key !== 'alex-run') {
        this.player.play('alex-run', true);
      }
    } else if (!this.sliding && this.player.anims.isPlaying) {
      this.player.anims.pause();
    }
  }
}

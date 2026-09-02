import Phaser from 'phaser';
import { LPC } from './PreloadScene.js';

const RUN_SPEED = 180;
const JUMP_VELOCITY = -420;
const GROUND_Y = 400;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width } = this.scale;

    this.add
      .rectangle(width / 2, GROUND_Y + 25, width * 4, 50, 0x2a2a35)
      .setScrollFactor(0.2);

    this.ground = this.add.rectangle(width * 2, GROUND_Y + 25, width * 8, 50, 0x3d3d4a);
    this.physics.add.existing(this.ground, true);

    const idleFrame = LPC.WALK_RIGHT.row * LPC.COLS;
    this.player = this.physics.add.sprite(120, GROUND_Y - 40, 'alex-flesh', idleFrame);
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(28, 48);
    this.player.body.setOffset(18, 14);
    this.player.play('alex-run');

    this.physics.add.collider(this.player, this.ground);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(80, 40);

    this.add
      .text(12, 12, 'Flesh to Chrome — Espaço / W / ↑ para pular', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#c8c8d0',
      })
      .setScrollFactor(0)
      .setDepth(10);
  }

  update() {
    this.player.setVelocityX(RUN_SPEED);

    const onFloor = this.player.body.blocked.down || this.player.body.touching.down;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    if (jumpPressed && onFloor) {
      this.player.setVelocityY(JUMP_VELOCITY);
    }

    if (onFloor) {
      if (this.player.anims.currentAnim?.key !== 'alex-run') {
        this.player.play('alex-run', true);
      }
    } else if (this.player.anims.isPlaying) {
      this.player.anims.pause();
    }
  }
}

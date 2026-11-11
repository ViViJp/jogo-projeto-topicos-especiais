import Phaser from "phaser";
import { PLAYER_FRAME } from "../config/GameConfig";
import type { AbilityState } from "../systems/AbilityState";

/**
 * Integração da arte real de Alex (LPC - Universal LPC Spritesheet,
 * `alex-flesh.png`) v0.2.0. Convenção LPC: frames de 64×64, 13 colunas por
 * linha; cada bloco de animação usa 4 linhas (CIMA, ESQUERDA, BAIXO,
 * DIREITA) em sequência.
 *
 * A referência de protótipo entregue pela equipe (`PreloadScene.js`) só
 * define a corrida (linha 11, 9 frames) e o "hurt" (linha 20, 6 frames).
 * Slide e checkpoint usam folhas dedicadas, separadas do LPC: quatro frames
 * para o slide e cinco frames para a interação completa com a TV.
 */
const LPC_COLS = 13;

function frameIndex(row: number, col: number): number {
  return row * LPC_COLS + col;
}

export const ALEX_TEXTURE_KEY = "alex-flesh";
export const ALEX_LEGS_TEXTURE_KEY = "alex-legs";
export const ALEX_ARMS_TEXTURE_KEY = "alex-arms";
export const ALEX_EYES_TEXTURE_KEY = "alex-eyes";
export const ALEX_DASH_TEXTURE_KEY = "alex-dash";
export const ALEX_RUN_ANIM = "alex-run";
export const ALEX_HURT_ANIM = "alex-hurt";
export const ALEX_ATTACK_ANIM = "alex-attack";
export const ALEX_CHECKPOINT_SIT_ANIM = "alex-checkpoint-sit";
export const ALEX_CHECKPOINT_INTERACT_ANIM = "alex-checkpoint-interact";
export const ALEX_CHECKPOINT_STAND_ANIM = "alex-checkpoint-stand";
export const ALEX_SLIDE_ANIM = "alex-slide";
export const ALEX_SLIDE_TEXTURE_KEY = "alex-slide-flesh";
export const ALEX_SLIDE_LEGS_TEXTURE_KEY = "alex-slide-legs";
export const ALEX_SLIDE_ARMS_TEXTURE_KEY = "alex-slide-arms";
export const ALEX_SLIDE_EYES_TEXTURE_KEY = "alex-slide-eyes";
export const ALEX_SLIDE_DASH_TEXTURE_KEY = "alex-slide-dash";
export const ALEX_CHECKPOINT_TEXTURE_KEY = "alex-checkpoint-flesh";
export const ALEX_CHECKPOINT_LEGS_TEXTURE_KEY = "alex-checkpoint-legs";
export const ALEX_CHECKPOINT_ARMS_TEXTURE_KEY = "alex-checkpoint-arms";
export const ALEX_CHECKPOINT_EYES_TEXTURE_KEY = "alex-checkpoint-eyes";
export const ALEX_CHECKPOINT_DASH_TEXTURE_KEY = "alex-checkpoint-dash";

const WALK_RIGHT = { row: 11, frames: 9 };
const HURT = { row: 20, frames: 6 };
// Bloco LPC de soco voltado para a DIREITA. Os seis frames já existem em
// todas as variantes de Alex; antes o jogo ignorava essa animação e exibia
// somente um arco gráfico provisório.
const ATTACK_RIGHT = { row: 15, frames: 6 };

export function alexTextureForAbilities(abilities: AbilityState): string {
  if (abilities.thrusters) return ALEX_DASH_TEXTURE_KEY;
  if (abilities.eyes) return ALEX_EYES_TEXTURE_KEY;
  if (abilities.arms) return ALEX_ARMS_TEXTURE_KEY;
  if (abilities.legs) return ALEX_LEGS_TEXTURE_KEY;
  return ALEX_TEXTURE_KEY;
}

export function alexRunAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_RUN_ANIM : `${textureKey}-run`;
}

export function alexCheckpointSitAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY
    ? ALEX_CHECKPOINT_SIT_ANIM
    : `${textureKey}-checkpoint-sit`;
}

export function alexCheckpointInteractAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY
    ? ALEX_CHECKPOINT_INTERACT_ANIM
    : `${textureKey}-checkpoint-interact`;
}

export function alexCheckpointStandAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY
    ? ALEX_CHECKPOINT_STAND_ANIM
    : `${textureKey}-checkpoint-stand`;
}

export function alexAttackAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_ATTACK_ANIM : `${textureKey}-attack`;
}

export function alexSlideAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_SLIDE_ANIM : `${textureKey}-slide`;
}

export function alexSlideTextureKey(textureKey: string): string {
  if (textureKey === ALEX_DASH_TEXTURE_KEY) return ALEX_SLIDE_DASH_TEXTURE_KEY;
  if (textureKey === ALEX_EYES_TEXTURE_KEY) return ALEX_SLIDE_EYES_TEXTURE_KEY;
  if (textureKey === ALEX_ARMS_TEXTURE_KEY) return ALEX_SLIDE_ARMS_TEXTURE_KEY;
  if (textureKey === ALEX_LEGS_TEXTURE_KEY) return ALEX_SLIDE_LEGS_TEXTURE_KEY;
  return ALEX_SLIDE_TEXTURE_KEY;
}

export function alexCheckpointTextureKey(textureKey: string): string {
  if (textureKey === ALEX_DASH_TEXTURE_KEY) return ALEX_CHECKPOINT_DASH_TEXTURE_KEY;
  if (textureKey === ALEX_EYES_TEXTURE_KEY) return ALEX_CHECKPOINT_EYES_TEXTURE_KEY;
  if (textureKey === ALEX_ARMS_TEXTURE_KEY) return ALEX_CHECKPOINT_ARMS_TEXTURE_KEY;
  if (textureKey === ALEX_LEGS_TEXTURE_KEY) return ALEX_CHECKPOINT_LEGS_TEXTURE_KEY;
  return ALEX_CHECKPOINT_TEXTURE_KEY;
}

export function alexHurtAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_HURT_ANIM : `${textureKey}-hurt`;
}

export function ensureAlexAnimations(scene: Phaser.Scene, textureKey = ALEX_TEXTURE_KEY): void {
  const runAnimationKey = alexRunAnimationKey(textureKey);
  if (!scene.anims.exists(runAnimationKey)) {
    scene.anims.create({
      key: runAnimationKey,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: frameIndex(WALK_RIGHT.row, 0),
        end: frameIndex(WALK_RIGHT.row, WALK_RIGHT.frames - 1),
      }),
      frameRate: 12,
      repeat: -1,
    });
  }

  const hurtAnimationKey = alexHurtAnimationKey(textureKey);
  if (!scene.anims.exists(hurtAnimationKey)) {
    scene.anims.create({
      key: hurtAnimationKey,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: frameIndex(HURT.row, 0),
        end: frameIndex(HURT.row, HURT.frames - 1),
      }),
      frameRate: 8,
      repeat: 0,
    });
  }

  const slideAnimationKey = alexSlideAnimationKey(textureKey);
  if (!scene.anims.exists(slideAnimationKey)) {
    scene.anims.create({
      key: slideAnimationKey,
      frames: scene.anims.generateFrameNumbers(alexSlideTextureKey(textureKey), { start: 0, end: 3 }),
      // A entrada ocorre uma única vez. Ao prolongar o slide, Phaser mantém o
      // quarto frame em vez de reiniciar a queda do personagem.
      frameRate: 10,
      repeat: 0,
    });
  }

  const attackAnimationKey = alexAttackAnimationKey(textureKey);
  if (!scene.anims.exists(attackAnimationKey)) {
    scene.anims.create({
      key: attackAnimationKey,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: frameIndex(ATTACK_RIGHT.row, 0),
        end: frameIndex(ATTACK_RIGHT.row, ATTACK_RIGHT.frames - 1),
      }),
      // O golpe precisa permanecer legível no runner e acompanhar a janela
      // ativa de colisão, em vez de terminar em apenas 250 ms.
      frameRate: 16,
      repeat: 0,
    });
  }

  const checkpointTextureKey = alexCheckpointTextureKey(textureKey);
  const checkpointSitAnimationKey = alexCheckpointSitAnimationKey(textureKey);
  if (!scene.anims.exists(checkpointSitAnimationKey)) {
    scene.anims.create({
      key: checkpointSitAnimationKey,
      frames: scene.anims.generateFrameNumbers(checkpointTextureKey, { start: 0, end: 2 }),
      frameRate: 10,
      repeat: 0,
    });
  }

  const checkpointInteractAnimationKey = alexCheckpointInteractAnimationKey(textureKey);
  if (!scene.anims.exists(checkpointInteractAnimationKey)) {
    scene.anims.create({
      key: checkpointInteractAnimationKey,
      frames: scene.anims.generateFrameNumbers(checkpointTextureKey, { start: 2, end: 3 }),
      frameRate: 9,
      repeat: -1,
      yoyo: true,
    });
  }

  const checkpointStandAnimationKey = alexCheckpointStandAnimationKey(textureKey);
  if (!scene.anims.exists(checkpointStandAnimationKey)) {
    scene.anims.create({
      key: checkpointStandAnimationKey,
      frames: scene.anims.generateFrameNumbers(checkpointTextureKey, { start: 3, end: 4 }),
      frameRate: 10,
      repeat: 0,
    });
  }
}

export const ALEX_SHEET_CONFIG = { frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME };
export const ALEX_SLIDE_SHEET_CONFIG = { frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME };
export const ALEX_CHECKPOINT_SHEET_CONFIG = { frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME };

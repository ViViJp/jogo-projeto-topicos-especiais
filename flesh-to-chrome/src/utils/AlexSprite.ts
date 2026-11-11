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
 * O spritesheet LPC não tem uma pose de "deslizar" - usamos o frame 2 da
 * linha 33 ("sentado", de perfil) como a pose estática mais próxima
 * disponível (medida via bounding-box alfa, ver `GameConfig.ts`).
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
export const ALEX_CHECKPOINT_ANIM = "alex-checkpoint-play";
export const ALEX_SLIDE_ANIM = "alex-slide";
export const ALEX_SLIDE_FRAME = frameIndex(33, 2);

const WALK_RIGHT = { row: 11, frames: 9 };
const HURT = { row: 20, frames: 6 };
// Bloco LPC de soco voltado para a DIREITA. Os seis frames já existem em
// todas as variantes de Alex; antes o jogo ignorava essa animação e exibia
// somente um arco gráfico provisório.
const ATTACK_RIGHT = { row: 15, frames: 6 };
// Bloco LPC de personagem sentado, voltado para a DIREITA: Alex fica de
// perfil para a TV. A linha 35 usada anteriormente é uma pose em pé; os dois
// frames sentados corretos estão na linha 33.
const CHECKPOINT_PLAY_RIGHT = { row: 33, frames: 2 };
const SLIDE_RIGHT = { row: 33, start: 1, end: 2 };

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

export function alexCheckpointAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY
    ? ALEX_CHECKPOINT_ANIM
    : `${textureKey}-checkpoint-play`;
}

export function alexAttackAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_ATTACK_ANIM : `${textureKey}-attack`;
}

export function alexSlideAnimationKey(textureKey: string): string {
  return textureKey === ALEX_TEXTURE_KEY ? ALEX_SLIDE_ANIM : `${textureKey}-slide`;
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
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: frameIndex(SLIDE_RIGHT.row, SLIDE_RIGHT.start),
        end: frameIndex(SLIDE_RIGHT.row, SLIDE_RIGHT.end),
      }),
      // Um slide comum termina antes de a sequência recomeçar. Se a duração
      // da mecânica for ampliada no futuro, a pose só volta a ciclar depois
      // desta pausa, evitando a alternância frenética dos dois frames.
      frameRate: 3,
      repeat: -1,
      repeatDelay: 450,
      yoyo: true,
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

  const checkpointAnimationKey = alexCheckpointAnimationKey(textureKey);
  if (!scene.anims.exists(checkpointAnimationKey)) {
    scene.anims.create({
      key: checkpointAnimationKey,
      frames: scene.anims.generateFrameNumbers(textureKey, {
        start: frameIndex(CHECKPOINT_PLAY_RIGHT.row, 0),
        end: frameIndex(CHECKPOINT_PLAY_RIGHT.row, CHECKPOINT_PLAY_RIGHT.frames - 1),
      }),
      frameRate: 4,
      repeat: -1,
    });
  }
}

export const ALEX_SHEET_CONFIG = { frameWidth: PLAYER_FRAME, frameHeight: PLAYER_FRAME };

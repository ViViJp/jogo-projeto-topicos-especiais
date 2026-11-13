import Phaser from "phaser";
import {
  BASE_RUN_SPEED,
  GAMEPLAY_TIMING,
  PHYSICS,
  PLAYER_SIZE,
  PLAYER_BODY_OFFSET,
  PLAYER_SLIDE_SIZE,
  PLAYER_SLIDE_BODY_OFFSET,
} from "../config/GameConfig";
import { AbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import {
  alexAttackAnimationKey,
  alexCheckpointInteractAnimationKey,
  alexCheckpointSitAnimationKey,
  alexCheckpointStandAnimationKey,
  alexHurtAnimationKey,
  alexRunAnimationKey,
  alexSlideAnimationKey,
  alexTextureForAbilities,
  ensureAlexAnimations,
} from "../utils/AlexSprite";
import { AudioManager, SFX } from "../systems/AudioManager";

export type PlayerState =
  | "running"
  | "jumping"
  | "sliding"
  | "attacking"
  | "scanning"
  | "dashing"
  | "checkpoint"
  | "pressed" // preso contra um quebrável (seção 14.7)
  | "dead";

/**
 * Controlador de Alex Murphy.
 *
 * Implementa a matriz de compatibilidade de ações da seção 14.11 do GDD e
 * os valores de referência da seção 14 (durações, cooldowns). Ataque, scan
 * e dash estão ligados aos implantes liberados pelas clínicas das Fases 2–4
 * e são exercitados nos runtimes Tiled das Fases 3–5.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private input: InputManager;
  private abilities: AbilityState;
  private readonly runAnimationKey: string;
  private readonly attackAnimationKey: string;
  private readonly checkpointSitAnimationKey: string;
  private readonly checkpointInteractAnimationKey: string;
  private readonly checkpointStandAnimationKey: string;
  private readonly slideAnimationKey: string;
  private readonly hurtAnimationKey: string;

  private state: PlayerState = "running";
  private doubleJumpUsed = false;
  private slideTimer = 0;
  private slideElapsed = 0;
  private attackRecoveryTimer = 0;
  /** Invalida callbacks de um golpe que foi interrompido por outra ação. */
  private attackSequence = 0;
  /** Invalida etapas atrasadas de uma interação cancelada/reiniciada. */
  private checkpointSequence = 0;
  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private pressedTimer = 0;
  private scanTimer = 0;
  private depthBeforeCheckpoint = 0;
  private wasGrounded = false;
  private landingSoundArmed = false;
  private slideFxTimer = 0;

  private onDeath: () => void;
  private onScanPulse: (active: boolean) => void;
  private currentBreakable: Phaser.GameObjects.GameObject | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    abilities: AbilityState,
    input: InputManager,
    callbacks: { onDeath: () => void; onScanPulse: (active: boolean) => void }
  ) {
    this.scene = scene;
    this.abilities = abilities;
    this.input = input;
    this.onDeath = callbacks.onDeath;
    this.onScanPulse = callbacks.onScanPulse;

    const textureKey = alexTextureForAbilities(abilities);
    ensureAlexAnimations(scene, textureKey);
    this.runAnimationKey = alexRunAnimationKey(textureKey);
    this.attackAnimationKey = alexAttackAnimationKey(textureKey);
    this.checkpointSitAnimationKey = alexCheckpointSitAnimationKey(textureKey);
    this.checkpointInteractAnimationKey = alexCheckpointInteractAnimationKey(textureKey);
    this.checkpointStandAnimationKey = alexCheckpointStandAnimationKey(textureKey);
    this.slideAnimationKey = alexSlideAnimationKey(textureKey);
    this.hurtAnimationKey = alexHurtAnimationKey(textureKey);
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setCollideWorldBounds(false);
    this.applyRunningPose();

    this.sprite.setVelocityX(BASE_RUN_SPEED);
  }

  getState(): PlayerState {
    return this.state;
  }

  isGrounded(): boolean {
    return this.sprite.body!.blocked.down || this.sprite.body!.touching.down;
  }

  /** seção 14.7 - o jogador tocou um quebrável sem atacar. */
  enterPressedState(breakable: Phaser.GameObjects.GameObject): void {
    if (this.state === "dead" || this.state === "pressed") return;
    this.state = "pressed";
    this.currentBreakable = breakable;
    this.pressedTimer = PHYSICS.breakable.reactionWindowMs;
    this.sprite.setVelocityX(0);
    AudioManager.stopLoop(SFX.footstep);
    AudioManager.playSfx(this.scene, SFX.hurt, { volume: 0.5 });
  }

  /** Chamado pelo sistema de colisão quando o quebrável é destruído a tempo. */
  resolvePressedSuccess(): void {
    if (this.state !== "pressed") return;
    this.state = "running";
    this.currentBreakable = null;
    this.sprite.setVelocityX(BASE_RUN_SPEED);
  }

  /** Parada diegética do GDD: Alex se senta diante da TV do checkpoint. */
  beginCheckpointInteraction(x = this.sprite.x, y = this.sprite.y): void {
    if (this.state === "dead" || this.state === "checkpoint") return;
    if (this.scanTimer > 0) this.onScanPulse(false);
    this.stopContinuousSfx();
    this.scanTimer = 0;
    this.dashTimer = 0;
    this.currentBreakable = null;
    this.transitionState("checkpoint");
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.reset(x, y);
    this.sprite.setVelocity(0, 0);
    const sequence = ++this.checkpointSequence;
    this.sprite.anims.play(this.checkpointSitAnimationKey, true);
    this.scene.time.delayedCall(GAMEPLAY_TIMING.checkpointSitMs, () => {
      if (this.state !== "checkpoint" || sequence !== this.checkpointSequence) return;
      this.sprite.anims.play(this.checkpointInteractAnimationKey, true);
    });
    this.depthBeforeCheckpoint = this.sprite.depth;
    // A TV é um objeto de primeiro plano (depth 2–3 conforme a fase).
    // Durante a pose de interação Alex precisa aparecer sentado diante dela.
    this.sprite.setDepth(10);
  }

  endCheckpointInteraction(onComplete?: () => void): void {
    if (this.state !== "checkpoint") return;
    const sequence = ++this.checkpointSequence;
    this.sprite.anims.play(this.checkpointStandAnimationKey, true);
    this.scene.time.delayedCall(GAMEPLAY_TIMING.checkpointStandMs, () => {
      if (this.state !== "checkpoint" || sequence !== this.checkpointSequence) return;
      this.state = "running";
      this.sprite.setDepth(this.depthBeforeCheckpoint);
      (this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
      this.applyRunningPose();
      this.sprite.setVelocityX(BASE_RUN_SPEED);
      onComplete?.();
    });
  }

  kill(): void {
    if (this.state === "dead") return;
    this.transitionState("dead");
    this.stopContinuousSfx();
    this.sprite.setVelocity(0, 0);
    this.sprite.body!.enable = false;
    this.sprite.anims.play(this.hurtAnimationKey, true);
    this.sprite.setTint(0xff8299);
    AudioManager.playSfx(this.scene, SFX.death, { volume: 0.72 });
    this.scene.tweens.add({
      targets: this.sprite,
      angle: -18,
      alpha: 0.35,
      y: this.sprite.y - 14,
      duration: 620,
      ease: "Cubic.easeOut",
    });
    this.onDeath();
  }

  /** Reativa a mesma instancia sem reiniciar a cena ou o cronometro da corrida. */
  respawn(x: number, y: number): void {
    this.attackSequence += 1;
    this.checkpointSequence += 1;
    this.state = "running";
    this.doubleJumpUsed = false;
    this.slideTimer = 0;
    this.slideElapsed = 0;
    this.attackRecoveryTimer = 0;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.pressedTimer = 0;
    this.scanTimer = 0;
    this.slideFxTimer = 0;
    this.wasGrounded = false;
    this.landingSoundArmed = false;
    this.stopContinuousSfx();
    this.currentBreakable = null;
    this.sprite.setVisible(true).setActive(true).setAlpha(1).setAngle(0).clearTint();
    const body = this.sprite.body!;
    body.enable = true;
    (body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
    body.reset(x, y);
    this.applyRunningPose();
    this.sprite.setVelocityX(BASE_RUN_SPEED);
  }

  update(deltaMs: number): void {
    if (this.state === "dead" || this.state === "checkpoint") return;

    this.updateTimers(deltaMs);

    if (this.state === "pressed") {
      if (this.input.isAttackJustDown() && this.abilities.arms) {
        this.attackRecoveryTimer = PHYSICS.attack.recoveryMs;
        this.sprite.anims.play(this.attackAnimationKey, true);
        // a colisão com o quebrável (GameScene) é responsável por chamar resolvePressedSuccess()
        this.scene.events.emit("player-attack-attempt", this.currentBreakable);
        this.scene.time.delayedCall(PHYSICS.attack.animDurationMs, () => {
          if (this.state === "running" || this.state === "jumping") this.applyRunningPose();
        });
      }
      if (this.pressedTimer <= 0) {
        this.kill();
      }
      return;
    }

    const grounded = this.isGrounded();
    if (grounded && !this.wasGrounded && this.landingSoundArmed) {
      AudioManager.playSfx(this.scene, SFX.land, { volume: 0.32 });
      this.spawnLandingFx();
    }
    if (!grounded) this.landingSoundArmed = true;
    else this.landingSoundArmed = false;
    this.wasGrounded = grounded;
    if (grounded) {
      this.doubleJumpUsed = false;
      if (this.state === "jumping") {
        this.state = "running";
      }
    } else if (this.state === "running") {
      this.state = "jumping";
    }

    this.handleJump(grounded);
    this.handleSlide(grounded);
    this.handleAttack();
    this.handleScan();
    this.handleDash();

    // fora dos estados especiais, garante velocidade base constante
    if (this.state === "running" || this.state === "jumping") {
      if (this.dashTimer <= 0) {
        this.sprite.setVelocityX(BASE_RUN_SPEED);
      }
    }
    if (grounded && this.state === "running") {
      AudioManager.startLoop(this.scene, SFX.footstep, { volume: 0.14 });
    } else {
      AudioManager.stopLoop(SFX.footstep);
    }
    if (this.state === "sliding") {
      this.slideFxTimer -= deltaMs;
      if (this.slideFxTimer <= 0) {
        this.spawnSlideFx();
        this.slideFxTimer = 90;
      }
    }
  }

  private updateTimers(deltaMs: number): void {
    if (this.slideTimer > 0) this.slideTimer -= deltaMs;
    if (this.attackRecoveryTimer > 0) this.attackRecoveryTimer -= deltaMs;
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - deltaMs);
      if (this.dashCooldownTimer === 0) {
        this.scene.events.emit("player-dash-ready");
      }
    }
    if (this.pressedTimer > 0) this.pressedTimer -= deltaMs;

    if (this.dashTimer > 0) {
      this.dashTimer -= deltaMs;
      if (this.dashTimer <= 0) {
        this.sprite.setVelocityX(BASE_RUN_SPEED);
      }
    }

    if (this.scanTimer > 0) {
      this.scanTimer -= deltaMs;
      if (this.scanTimer <= 0) {
        AudioManager.stopLoop(SFX.scan);
        this.onScanPulse(false);
        if (this.state === "scanning") this.state = "running";
      }
    }

    if (this.state === "sliding") {
      this.slideElapsed += deltaMs;
      const pastMinimum = this.slideElapsed >= PHYSICS.slide.minDurationMs;
      const holdingSlide = this.input.isSlideDown();
      // Segurar renova a janela sem sair e entrar novamente no estado. Isso
      // preserva uma única animação/som contínuos; a repetição visual lenta
      // só acontece se o jogador realmente prolongar o slide.
      if (this.slideTimer <= 0 && holdingSlide) {
        this.slideTimer = PHYSICS.slide.durationMs;
      } else if (this.slideTimer <= 0 || (pastMinimum && !holdingSlide)) {
        this.endSlide();
      }
    }
  }

  // ---- Pulo / Salto duplo (seção 14.2 / 14.5) ----
  private handleJump(grounded: boolean): void {
    if (!this.input.isJumpJustDown()) return;
    // Matriz 14.11: pular indisponível em slide e em dash.
    if (this.state === "sliding" || this.state === "dashing") return;

    if (grounded) {
      AudioManager.playSfx(this.scene, SFX.jump, { volume: 0.5 });
      this.sprite.setVelocityY(PHYSICS.jump.velocityY);
      this.transitionState("jumping", true);
    } else if (this.abilities.legs && !this.doubleJumpUsed) {
      AudioManager.playSfx(this.scene, SFX.effort, { volume: 0.55 });
      this.sprite.setVelocityY(PHYSICS.doubleJump.velocityY);
      this.doubleJumpUsed = true;
      this.transitionState("jumping", true);
    }
  }

  // ---- Slide (seção 14.3) ----
  private handleSlide(grounded: boolean): void {
    if (this.state === "sliding") return;
    if (!grounded) return; // slide só no chão (implícito: precisa estar correndo)
    if (this.state !== "running") return;
    if (!this.input.isSlideDown()) return;

    this.state = "sliding";
    this.slideTimer = PHYSICS.slide.durationMs;
    this.slideElapsed = 0;
    this.slideFxTimer = 0;
    AudioManager.startLoop(this.scene, SFX.slide, { volume: 0.3 });
    this.applySlidingPose();
  }

  private endSlide(): void {
    AudioManager.stopLoop(SFX.slide);
    this.state = "running";
    this.applyRunningPose();
  }

  /**
   * Corpo físico medido no bounding-box alfa dos frames reais do
   * spritesheet LPC (ver `GameConfig.ts` / `AlexSprite.ts`) - o mesmo
   * princípio "hitbox honesta com o desenho" da v0.1 (era a causa do bug
   * "slide atravessa o chão"), agora com os números certos para a arte
   * final em vez do retângulo placeholder.
   */
  private applyRunningPose(): void {
    this.sprite.anims.play(this.runAnimationKey, true);
    this.sprite.body!.setSize(PLAYER_SIZE.width, PLAYER_SIZE.height);
    this.sprite.body!.setOffset(PLAYER_BODY_OFFSET.x, PLAYER_BODY_OFFSET.y);
  }

  private applySlidingPose(): void {
    this.sprite.anims.play(this.slideAnimationKey, true);
    this.sprite.body!.setSize(PLAYER_SLIDE_SIZE.width, PLAYER_SLIDE_SIZE.height);
    this.sprite.body!.setOffset(PLAYER_SLIDE_BODY_OFFSET.x, PLAYER_SLIDE_BODY_OFFSET.y);
  }

  // ---- Ataque / quebra (seção 14.6) ----
  private handleAttack(): void {
    if (!this.abilities.arms) return;
    if (this.state === "sliding" || this.state === "dashing") return; // matriz 14.11
    if (this.attackRecoveryTimer > 0) return;
    if (!this.input.isAttackJustDown()) return;

    const previous = this.state;
    this.state = "attacking";
    const attackSequence = ++this.attackSequence;
    this.attackRecoveryTimer = PHYSICS.attack.recoveryMs;
    this.sprite.anims.play(this.attackAnimationKey, true);
    AudioManager.playSfx(this.scene, SFX.attack, { volume: 0.58 });
    this.emitAttackPulse(true);
    for (
      let delay = PHYSICS.attack.pulseIntervalMs;
      delay <= PHYSICS.attack.activeMs;
      delay += PHYSICS.attack.pulseIntervalMs
    ) {
      this.scene.time.delayedCall(delay, () => {
        if (this.state === "attacking" && this.attackSequence === attackSequence) {
          this.emitAttackPulse(false);
        }
      });
    }

    this.scene.time.delayedCall(PHYSICS.attack.animDurationMs, () => {
      if (this.state === "attacking" && this.attackSequence === attackSequence) {
        this.state = previous === "jumping" && !this.isGrounded() ? "jumping" : "running";
        this.applyRunningPose();
      }
    });
  }

  /**
   * Mantém a hitbox ativa durante a parte ofensiva da animação. O primeiro
   * pulso exibe o feedback do HUD; os seguintes apenas atualizam a colisão
   * na posição atual de Alex, evitando repetir texto e som a cada 60 ms.
   */
  private emitAttackPulse(showFeedback: boolean): void {
    this.scene.events.emit("player-attack", this.sprite.x, this.sprite.y, showFeedback);
  }

  /**
   * Centraliza saídas antecipadas do golpe. Pulo e dash precisam restaurar
   * imediatamente a pose padrão; morte e checkpoint substituem a animação
   * logo em seguida e apenas invalidam os timers pendentes.
   */
  private transitionState(nextState: PlayerState, restorePoseAfterAttack = false): void {
    const interruptedAttack = this.state === "attacking" && nextState !== "attacking";
    if (interruptedAttack) this.attackSequence += 1;
    this.state = nextState;
    if (interruptedAttack && restorePoseAfterAttack) this.applyRunningPose();
  }

  // ---- Scan (seção 14.9) ----
  private handleScan(): void {
    if (!this.abilities.eyes) return;
    if (this.state === "sliding" || this.state === "dashing") return; // matriz 14.11
    if (this.scanTimer > 0) return; // anti-spam: pulso ativo bloqueia novo scan
    if (!this.input.isScanJustDown()) return;

    this.scanTimer = PHYSICS.scan.durationMs;
    AudioManager.startLoop(this.scene, SFX.scan, { volume: 0.48 });
    this.onScanPulse(true);
    this.showScanFeedback();
    if (this.state === "running") this.state = "scanning";
  }

  private showScanFeedback(): void {
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y - 30, 18, 0x36e2ff, 0.08);
    ring.setStrokeStyle(3, 0x36e2ff, 0.95);
    ring.setDepth(this.sprite.depth + 1);
    this.scene.tweens.add({
      targets: ring,
      radius: 220,
      alpha: 0,
      duration: PHYSICS.scan.durationMs,
      ease: "Cubic.easeOut",
      onUpdate: () => ring.setPosition(this.sprite.x, this.sprite.y - 30),
      onComplete: () => ring.destroy(),
    });
  }

  // ---- Dash (seção 14.10) ----
  private handleDash(): void {
    if (!this.abilities.thrusters) return;
    if (this.state === "sliding") return; // matriz 14.11
    if (this.dashCooldownTimer > 0) return;
    if (!this.input.isDashJustDown()) return;

    this.transitionState("dashing", true);
    this.dashTimer = PHYSICS.dash.durationMs;
    this.dashCooldownTimer = PHYSICS.dash.cooldownMs;
    this.sprite.setVelocityX(PHYSICS.dash.speed);
    AudioManager.playSfx(this.scene, SFX.dash, { volume: 0.62 });
    this.scene.events.emit(
      "player-dash-start",
      this.sprite.x,
      this.sprite.y,
      PHYSICS.dash.cooldownMs,
    );
    this.scene.time.delayedCall(PHYSICS.dash.durationMs, () => {
      if (this.state === "dashing") {
        this.state = this.isGrounded() ? "running" : "jumping";
      }
    });
  }

  destroy(): void {
    this.stopContinuousSfx();
    this.sprite.destroy();
  }

  private stopContinuousSfx(): void {
    AudioManager.stopLoop(SFX.footstep);
    AudioManager.stopLoop(SFX.slide);
    AudioManager.stopLoop(SFX.scan);
  }

  private spawnSlideFx(): void {
    const dust = this.scene.add.circle(this.sprite.x - 18, this.sprite.y - 4, 5, 0x9ad7df, 0.38)
      .setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: dust,
      x: dust.x - 28,
      y: dust.y - 8,
      alpha: 0,
      scale: 1.7,
      duration: 280,
      onComplete: () => dust.destroy(),
    });
  }

  private spawnLandingFx(): void {
    for (const offset of [-9, 9]) {
      const spark = this.scene.add.rectangle(this.sprite.x + offset, this.sprite.y - 2, 8, 2, 0x7cfcea, 0.65)
        .setDepth(this.sprite.depth - 1);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + offset * 1.8,
        alpha: 0,
        duration: 220,
        onComplete: () => spark.destroy(),
      });
    }
  }
}

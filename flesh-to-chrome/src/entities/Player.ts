import Phaser from "phaser";
import { BASE_RUN_SPEED, PHYSICS } from "../config/GameConfig";
import { AbilityState } from "../systems/AbilityState";
import { InputManager } from "../systems/InputManager";
import { TEX } from "../utils/PlaceholderTextures";

export type PlayerState =
  | "running"
  | "jumping"
  | "sliding"
  | "attacking"
  | "scanning"
  | "dashing"
  | "pressed" // preso contra um quebrável (seção 14.7)
  | "dead";

/**
 * Controlador de Alex Murphy.
 *
 * Implementa a matriz de compatibilidade de ações da seção 14.11 do GDD e
 * os valores de referência da seção 14 (durações, cooldowns). Ataque, scan
 * e dash já existem na máquina de estados para que a equipe só precise
 * ligar `abilities.arms/eyes/thrusters = true` quando as fases 2-4 forem
 * implementadas - a lógica de execução das habilidades não muda.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private input: InputManager;
  private abilities: AbilityState;

  private state: PlayerState = "running";
  private doubleJumpUsed = false;
  private slideTimer = 0;
  private slideElapsed = 0;
  private attackRecoveryTimer = 0;
  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private pressedTimer = 0;
  private scanTimer = 0;

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

    this.sprite = scene.physics.add.sprite(x, y, TEX.player);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setCollideWorldBounds(false);

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
  }

  /** Chamado pelo sistema de colisão quando o quebrável é destruído a tempo. */
  resolvePressedSuccess(): void {
    if (this.state !== "pressed") return;
    this.state = "running";
    this.currentBreakable = null;
    this.sprite.setVelocityX(BASE_RUN_SPEED);
  }

  kill(): void {
    if (this.state === "dead") return;
    this.state = "dead";
    this.sprite.setVelocity(0, 0);
    this.sprite.body!.enable = false;
    this.onDeath();
  }

  update(deltaMs: number): void {
    if (this.state === "dead") return;

    this.updateTimers(deltaMs);

    if (this.state === "pressed") {
      if (this.input.isAttackJustDown() && this.abilities.arms) {
        // a colisão com o quebrável (GameScene) é responsável por chamar resolvePressedSuccess()
        this.scene.events.emit("player-attack-attempt", this.currentBreakable);
      }
      if (this.pressedTimer <= 0) {
        this.kill();
      }
      return;
    }

    const grounded = this.isGrounded();
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
  }

  private updateTimers(deltaMs: number): void {
    if (this.slideTimer > 0) this.slideTimer -= deltaMs;
    if (this.attackRecoveryTimer > 0) this.attackRecoveryTimer -= deltaMs;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaMs;
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
        this.onScanPulse(false);
        if (this.state === "scanning") this.state = "running";
      }
    }

    if (this.state === "sliding") {
      this.slideElapsed += deltaMs;
      const pastMinimum = this.slideElapsed >= PHYSICS.slide.minDurationMs;
      // Teto de segurança (duração máxima) ou, após o mínimo, o jogador
      // soltou o botão: em ambos os casos, levanta. Isso corrige o slide
      // "não voltando" ao soltar o botão (o teto de 550ms fazia Alex ficar
      // agachado bem além do tempo que o jogador segurou o botão).
      if (this.slideTimer <= 0 || (pastMinimum && !this.input.isSlideDown())) {
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
      this.sprite.setVelocityY(PHYSICS.jump.velocityY);
      this.state = "jumping";
    } else if (this.abilities.legs && !this.doubleJumpUsed) {
      this.sprite.setVelocityY(PHYSICS.doubleJump.velocityY);
      this.doubleJumpUsed = true;
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
    this.setPose(TEX.playerSlide);
  }

  private endSlide(): void {
    this.state = "running";
    this.setPose(TEX.player);
  }

  /**
   * Troca a textura do sprite (em pé / deslizando) e recalcula o corpo
   * físico para bater exatamente com o novo frame, mantendo os "pés" no
   * mesmo lugar (origin bottom-center). Evitamos `setDisplaySize` +
   * `body.setSize(..., true)` juntos: misturar escala visual com o
   * parâmetro de centralização do body causava um descompasso entre o
   * corpo físico e o sprite (o personagem "afundava" no chão durante o
   * slide, porque o corpo de colisão não ficava alinhado com os pés).
   */
  private setPose(textureKey: string): void {
    this.sprite.setTexture(textureKey);
    this.sprite.body!.setSize(this.sprite.width, this.sprite.height);
    this.sprite.body!.setOffset(0, 0);
  }

  // ---- Ataque / quebra (seção 14.6) ----
  private handleAttack(): void {
    if (!this.abilities.arms) return;
    if (this.state === "sliding" || this.state === "dashing") return; // matriz 14.11
    if (this.attackRecoveryTimer > 0) return;
    if (!this.input.isAttackJustDown()) return;

    const previous = this.state;
    this.state = "attacking";
    this.attackRecoveryTimer = PHYSICS.attack.recoveryMs;
    this.scene.events.emit("player-attack", this.sprite.x, this.sprite.y);

    this.scene.time.delayedCall(PHYSICS.attack.animDurationMs, () => {
      if (this.state === "attacking") {
        this.state = previous === "jumping" && !this.isGrounded() ? "jumping" : "running";
      }
    });
  }

  // ---- Scan (seção 14.9) ----
  private handleScan(): void {
    if (!this.abilities.eyes) return;
    if (this.state === "sliding" || this.state === "dashing") return; // matriz 14.11
    if (this.scanTimer > 0) return; // anti-spam: pulso ativo bloqueia novo scan
    if (!this.input.isScanJustDown()) return;

    this.scanTimer = PHYSICS.scan.durationMs;
    this.onScanPulse(true);
    if (this.state === "running") this.state = "scanning";
  }

  // ---- Dash (seção 14.10) ----
  private handleDash(): void {
    if (!this.abilities.thrusters) return;
    if (this.state === "sliding") return; // matriz 14.11
    if (this.dashCooldownTimer > 0) return;
    if (!this.input.isDashJustDown()) return;

    this.state = "dashing";
    this.dashTimer = PHYSICS.dash.durationMs;
    this.dashCooldownTimer = PHYSICS.dash.cooldownMs;
    this.sprite.setVelocityX(PHYSICS.dash.speed);
    this.scene.events.emit("player-dash-start");
    this.scene.time.delayedCall(PHYSICS.dash.durationMs, () => {
      if (this.state === "dashing") {
        this.state = this.isGrounded() ? "running" : "jumping";
      }
      this.scene.events.emit("player-dash-ready");
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

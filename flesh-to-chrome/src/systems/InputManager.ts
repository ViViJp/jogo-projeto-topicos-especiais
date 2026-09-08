import Phaser from "phaser";
import { KEY_BINDINGS, GameAction } from "../config/Controls";

/**
 * Traduz teclado (e clique esquerdo para ataque) em ações do jogo,
 * conforme o mapeamento da seção 19.1 do GDD. Mantém "justDown" por ação
 * para que o PlayerController trate inputs discretos (pulo, ataque, scan,
 * dash) de forma consistente, além do estado contínuo (segurando slide).
 */
export class InputManager {
  private keys: Partial<Record<GameAction, Phaser.Input.Keyboard.Key[]>> = {};
  private attackPointerJustDown = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;

    (Object.keys(KEY_BINDINGS) as GameAction[]).forEach((action) => {
      this.keys[action] = KEY_BINDINGS[action].map((code) =>
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code as keyof typeof Phaser.Input.Keyboard.KeyCodes])
      );
    });

    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.attackPointerJustDown = true;
      }
    });
  }

  private anyJustDown(action: GameAction): boolean {
    const keys = this.keys[action];
    if (!keys) return false;
    return keys.some((k) => Phaser.Input.Keyboard.JustDown(k));
  }

  private anyIsDown(action: GameAction): boolean {
    const keys = this.keys[action];
    if (!keys) return false;
    return keys.some((k) => k.isDown);
  }

  isJumpJustDown(): boolean {
    return this.anyJustDown("jump");
  }

  isSlideDown(): boolean {
    return this.anyIsDown("slide");
  }

  isAttackJustDown(): boolean {
    const viaKeyboard = this.anyJustDown("attack");
    const viaMouse = this.attackPointerJustDown;
    return viaKeyboard || viaMouse;
  }

  isScanJustDown(): boolean {
    return this.anyJustDown("scan");
  }

  isDashJustDown(): boolean {
    return this.anyJustDown("dash");
  }

  isPauseJustDown(): boolean {
    return this.anyJustDown("pause");
  }

  isConfirmJustDown(): boolean {
    return this.anyJustDown("confirm");
  }

  /** Deve ser chamado ao final de cada update() da cena para "consumir" eventos de pointer discretos. */
  postUpdate(): void {
    this.attackPointerJustDown = false;
  }
}

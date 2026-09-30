import Phaser from "phaser";
import { KEY_BINDINGS, GameAction, getGamepadBindings } from "../config/Controls";

/**
 * Traduz teclado, mouse e controles conectados em ações do jogo,
 * conforme o mapeamento da seção 19.1 do GDD. Mantém "justDown" por ação
 * para que o PlayerController trate inputs discretos (pulo, ataque, scan,
 * dash) de forma consistente, além do estado contínuo (segurando slide).
 */
export class InputManager {
  private keys: Partial<Record<GameAction, Phaser.Input.Keyboard.Key[]>> = {};
  private gamepads: Phaser.Input.Gamepad.GamepadPlugin | null;
  private previousGamepadState: Partial<Record<GameAction, boolean>> = {};
  private consumedGamepadActions = new Set<GameAction>();
  private attackPointerJustDown = false;

  constructor(scene: Phaser.Scene) {
    this.gamepads = scene.input.gamepad;
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      (Object.keys(KEY_BINDINGS) as GameAction[]).forEach((action) => {
        this.keys[action] = KEY_BINDINGS[action].map((code) =>
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code as keyof typeof Phaser.Input.Keyboard.KeyCodes])
        );
      });
    }

    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.attackPointerJustDown = true;
      }
    });

    // Impede que o botão usado para trocar de cena seja lido novamente na
    // primeira atualização da cena seguinte enquanto ainda estiver segurado.
    this.snapshotGamepadState();
  }

  private anyJustDown(action: GameAction): boolean {
    const eventPressed = this.justPressed[action] === true;
    const keys = this.keys[action];
    const viaKeyboard = keys?.some((key) => Phaser.Input.Keyboard.JustDown(key)) ?? false;
    return viaKeyboard || this.isGamepadJustDown(action);
  }

  private anyIsDown(action: GameAction): boolean {
    const keys = this.keys[action];
    const viaKeyboard = keys?.some((key) => key.isDown) ?? false;
    return viaKeyboard || this.isGamepadActionDown(action);
  }

  private connectedGamepads(): Phaser.Input.Gamepad.Gamepad[] {
    return this.gamepads?.getAll().filter((gamepad) => gamepad.connected) ?? [];
  }

  private isGamepadActionDown(action: GameAction): boolean {
    return this.connectedGamepads().some((gamepad) => {
      const buttons = getGamepadBindings(gamepad.id)[action];
      const buttonDown = buttons.some((index) => gamepad.buttons[index]?.pressed ?? false);
      return buttonDown || this.isDirectionAxisDown(gamepad, action);
    });
  }

  /**
   * Alguns controles USB antigos expõem o direcional como eixos em vez dos
   * botões 12-15. O fallback também torna o analógico esquerdo utilizável.
   */
  private isDirectionAxisDown(gamepad: Phaser.Input.Gamepad.Gamepad, action: GameAction): boolean {
    const horizontal = gamepad.getAxisTotal() > 0 ? gamepad.getAxisValue(0) : 0;
    const vertical = gamepad.getAxisTotal() > 1 ? gamepad.getAxisValue(1) : 0;
    const threshold = 0.5;

    switch (action) {
      case "jump":
      case "menuUp":
        return vertical <= -threshold;
      case "slide":
      case "menuDown":
        return vertical >= threshold;
      case "menuLeft":
        return horizontal <= -threshold;
      case "menuRight":
        return horizontal >= threshold;
      default:
        return false;
    }
  }

  private isGamepadJustDown(action: GameAction): boolean {
    const isDown = this.isGamepadActionDown(action);
    const wasDown = this.previousGamepadState[action] ?? false;
    if (!isDown || wasDown || this.consumedGamepadActions.has(action)) return false;

    this.consumedGamepadActions.add(action);
    return true;
  }

  private snapshotGamepadState(): void {
    (Object.keys(KEY_BINDINGS) as GameAction[]).forEach((action) => {
      this.previousGamepadState[action] = this.isGamepadActionDown(action);
    });
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

  isCancelJustDown(): boolean {
    return this.anyJustDown("cancel");
  }

  isMenuUpJustDown(): boolean {
    return this.anyJustDown("menuUp");
  }

  isMenuDownJustDown(): boolean {
    return this.anyJustDown("menuDown");
  }

  isMenuLeftJustDown(): boolean {
    return this.anyJustDown("menuLeft");
  }

  isMenuRightJustDown(): boolean {
    return this.anyJustDown("menuRight");
  }

  /** Deve ser chamado ao final de cada update() da cena para avançar os inputs discretos. */
  postUpdate(): void {
    this.snapshotGamepadState();
    this.consumedGamepadActions.clear();
    this.attackPointerJustDown = false;
    this.justPressed = {};
  }
}

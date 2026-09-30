/** Mapeamento de teclado - GDD seção 19.1. */
export const KEY_BINDINGS = {
  jump: ["SPACE", "W", "UP"],
  slide: ["S", "DOWN"],
  attack: ["J"], // + clique esquerdo, tratado separadamente via pointerdown
  scan: ["L", "E"],
  dash: ["K", "SHIFT"],
  pause: ["ESC"],
  confirm: ["ENTER"],
  cancel: ["ESC"],
  menuUp: ["UP", "W"],
  menuDown: ["DOWN", "S"],
  menuLeft: ["LEFT", "A"],
  menuRight: ["RIGHT", "D"],
} as const;

export type GameAction = keyof typeof KEY_BINDINGS;

type GamepadBindings = Record<GameAction, readonly number[]>;

/**
 * Índices normalizados pela Web Gamepad API (layout Xbox/controle moderno).
 * O direcional também tem fallback para os eixos 0/1 no InputManager.
 */
const STANDARD_GAMEPAD_BINDINGS: GamepadBindings = {
  jump: [0, 12], // A ou direcional para cima
  slide: [1, 4, 13], // B, L1 ou direcional para baixo
  attack: [2], // X
  scan: [3, 8], // Y ou Select/Back
  dash: [5], // R1/RB
  pause: [9], // Start
  confirm: [0], // A
  cancel: [1, 8], // B ou Select/Back
  menuUp: [12],
  menuDown: [13],
  menuLeft: [14],
  menuRight: [15],
};

/**
 * Controles USB retrô (incluindo Vendor 0079 / Product 0011) mantêm as
 * posições físicas do SNES: B=0, A=1, Y=2 e X=3.
 */
const SNES_USB_GAMEPAD_BINDINGS: GamepadBindings = {
  jump: [1, 12], // A ou direcional para cima
  slide: [0, 4, 13], // B, L1 ou direcional para baixo
  attack: [3], // X
  scan: [2, 8], // Y ou Select
  dash: [5], // R1
  pause: [9], // Start
  confirm: [1], // A
  cancel: [0, 8], // B ou Select
  menuUp: [12],
  menuDown: [13],
  menuLeft: [14],
  menuRight: [15],
};

/** Seleciona automaticamente o perfil do controle pelo identificador USB. */
export function getGamepadBindings(gamepadId: string): GamepadBindings {
  const normalizedId = gamepadId.toLowerCase();
  const isSnesUsb =
    normalizedId.includes("snes") ||
    normalizedId.includes("usb gamepad") ||
    (/0079/.test(normalizedId) && /0011/.test(normalizedId));

  return isSnesUsb ? SNES_USB_GAMEPAD_BINDINGS : STANDARD_GAMEPAD_BINDINGS;
}

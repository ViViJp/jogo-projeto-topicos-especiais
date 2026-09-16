/**
 * Mapeamento de teclas - GDD seção 19.1 (+ movimento manual A/D)
 */
export const KEY_BINDINGS = {
  jump: ["SPACE", "W", "UP"],
  slide: ["S", "DOWN"],
  moveLeft: ["A", "LEFT"],
  moveRight: ["D", "RIGHT"],
  attack: ["J"], // + clique esquerdo, tratado separadamente via pointerdown
  scan: ["L", "E"],
  dash: ["K", "SHIFT"],
  pause: ["ESC"],
  confirm: ["ENTER"],
} as const;

export type GameAction = keyof typeof KEY_BINDINGS;

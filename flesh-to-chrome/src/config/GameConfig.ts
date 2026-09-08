/**
 * Constantes globais de configuração do jogo.
 * Valores numéricos marcados como "provisório" reproduzem os números de
 * referência do GDD (seção 26 - Validações Pendentes de Playtest) e devem
 * ser recalibrados pela equipe de game design durante os playtests.
 */

export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;

/** Seção 14.1 - Corrida automática: velocidade-base fixa em todas as fases. */
export const BASE_RUN_SPEED = 320; // px/s, provisório

export const GRAVITY_Y = 1600;

/**
 * Dimensões dos frames placeholder de Alex (seção "placeholders" do Nível
 * 1). Centralizadas aqui porque tanto `PlaceholderTextures` (geração das
 * texturas) quanto `LevelRuntime` (folga necessária para passar sob um
 * cano/fio deslizando) precisam concordar sobre o tamanho exato do corpo
 * físico em pé e deslizando.
 */
export const PLAYER_SIZE = { width: 40, height: 64 };
export const PLAYER_SLIDE_SIZE = { width: 40, height: 32 };

export const PHYSICS = {
  jump: {
    velocityY: -680, // provisório - seção 26.1
  },
  doubleJump: {
    velocityY: -560, // provisório - seção 26.1
    /** correção limitada de trajetória horizontal permitida no salto duplo */
    airControl: 140,
  },
  slide: {
    /**
     * Duração MÁXIMA (teto de segurança) - seção 14.3 do GDD: "duração
     * fixa" e "não pode ser cancelado por pulo". O GDD não proíbe soltar o
     * botão para levantar antes disso, então tratamos isso como o teto,
     * não como um tempo obrigatório.
     */
    durationMs: 550, // provisório - seção 26.1
    /**
     * Duração MÍNIMA: evita levantar no meio de um único frame (toque
     * acidental) e garante espaço mínimo para caber sob cano/fios. Soltar
     * o botão antes disso só levanta Alex ao atingir este mínimo; soltar
     * depois levanta imediatamente (feedback de playtest: o agachar não
     * respondia ao soltar o botão).
     */
    minDurationMs: 180,
  },
  attack: {
    /** seção 14.6 - recuperação inicial após o golpe */
    recoveryMs: 300,
    animDurationMs: 220,
  },
  breakable: {
    /** seção 14.7 - janela de reação antes da morte */
    reactionWindowMs: 500,
  },
  scan: {
    /** seção 14.9 - duração inicial do pulso */
    durationMs: 750,
  },
  dash: {
    speed: 720, // provisório
    durationMs: 220, // provisório
    cooldownMs: 2000, // seção 14.10 - cooldown de 2 segundos
  },
} as const;

/** Seção 22.4 - Câmera: Alex entre 30% e 40% da tela, mais espaço à frente. */
export const CAMERA = {
  playerScreenRatioX: 0.35,
  deadzoneHeight: 140,
};

export const STORAGE_KEY = "flesh-to-chrome:save:v1";

/** Seção 14.4 - Créditos: valor de referência para virar 1 vida no sistema antigo de referência do documento de ideia; mantido apenas como constante de UI (o MVP não possui vidas). */
export const CREDITS_PER_MILESTONE = 100;

/**
 * Constantes globais de configuração do jogo.
 * Valores numéricos marcados como "provisório" reproduzem os números de
 * referência do GDD (seção 26 - Validações Pendentes de Playtest) e devem
 * ser recalibrados pela equipe de game design durante os playtests.
 */

export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;

/**
 * Seção 14.1 - Corrida automática: velocidade-base fixa em todas as fases.
 * v0.2.0 tinha recalibrado isso para 180px/s para bater com a escala dos
 * mapas Tiled reais - mas em playtest a gameplay resultante (jogador
 * sempre pulando bem alto/lento entre plataformas curtas) ficou pior do
 * que o feeling original, então v0.2.1 volta a estes valores (320/1600),
 * revertendo também o nível para a versão desenhada à mão (`LevelBuilder`)
 * em vez dos mapas Tiled. Ver changelog v0.2.1 no README para o motivo
 * completo e a recomendação de dimensão de mapa para uma reintegração
 * futura.
 */
export const BASE_RUN_SPEED = 320; // px/s, provisório

export const GRAVITY_Y = 1600; // revertido junto da velocidade acima (v0.2.1)

/**
 * Corpo físico de Alex a partir do spritesheet LPC real (64×64 por frame,
 * `alex-flesh.png`). Medido diretamente do bounding-box alfa dos frames
 * usados (ver `docs/` do processo de integração) para o corpo bater com o
 * que é desenhado na tela - a causa do bug "slide atravessa o chão" da v0.1
 * era justamente um corpo físico desalinhado do sprite visível.
 */
export const PLAYER_FRAME = 64;
export const PLAYER_SIZE = { width: 26, height: 50 };
export const PLAYER_BODY_OFFSET = { x: 19, y: 12 };
/**
 * O spritesheet LPC não tem uma pose de "deslizar" propriamente (só um
 * "sentar"); a silhueta real dela mal é mais baixa que a de pé. Reduzimos o
 * corpo físico um pouco além do desenho (prática comum: hitbox um pouco
 * menor que o sprite favorece o jogador) para a mecânica de "só passa
 * deslizando" continuar tendo uma folga vertical real por baixo do
 * cano/fios, sem ficar maior que a pose desenhada.
 */
export const PLAYER_SLIDE_SIZE = { width: 28, height: 30 };
export const PLAYER_SLIDE_BODY_OFFSET = { x: 23, y: 30 };

export const PHYSICS = {
  jump: {
    /**
     * Reduzido de -680 (v0.1.2..v0.3.0) para -640 na v0.3.1 (altura
     * 144,5px→128px, alcance 272px→256px) depois do primeiro feedback de
     * playtest ("muito alto"). Esse corte de -5,9% na velocidade acabou
     * pequeno demais pra se perceber jogando - novo feedback (mesma sessão)
     * disse que o pulo "continua igual".
     *
     * TENTATIVA de reduzir mais ainda na v0.3.2 (testados -600 e -620) -
     * **revertida**. A validação por distância/coluna (script de margem
     * exata) dizia que ambos os valores continuavam sem gap impossível, mas
     * um playthrough real no motor de física (bot via Playwright, não só o
     * script analítico) expôs um problema que a validação por coluna não
     * enxerga: essa metodologia só checa se o PONTO de pouso (x final) cai
     * sobre uma coluna com chão, sem simular a trajetória vertical da
     * parábola do salto. Na sequência de 3 plataformas estreitas (128px,
     * com vãos de 64px) por volta de x=1300-1700 do mapa, um arco mais baixo
     * chega ao início da próxima plataforma DESCENDO RÁPIDO DEMAIS - o
     * personagem "raspa" na parede esquerda do bloco de chão (que tem 64px
     * de espessura, não é uma borda fina) em vez de pousar em cima, fica
     * preso horizontalmente colado nela por vários frames (a colisão trava
     * só o eixo X, `vy` continua subindo em queda livre) e cai pro vazio -
     * morte 100% reproduzível tanto em -600 quanto em -620, exatamente
     * nessa travessia. -640 (validado por playthrough completo em v0.3.1)
     * continua sendo o piso seguro conhecido para essa sequência de
     * plataformas específica - reduzir mais exigiria redesenhar essa parte
     * do mapa (plataformas mais largas/vãos menores), não só ajustar a
     * física global. Mantido em -640 por ora; ver changelog v0.3.2 no
     * README para os números completos dessa investigação.
     */
    velocityY: -640, // provisório - seção 26.1
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

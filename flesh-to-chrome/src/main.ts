import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "./config/GameConfig";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { ClinicScene } from "./scenes/ClinicScene";
import { EndingScene } from "./scenes/EndingScene";
import { MultiplayerScene } from "./scenes/MultiplayerScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: "#05050a",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Correção do "tremor de tela" reportado em playtest (v0.2.0): com
  // Phaser.Scale.FIT a tela do jogo quase nunca escala por um fator
  // inteiro (depende do tamanho da janela do jogador), e por padrão o
  // Phaser usa antialiasing + posições sub-pixel ao desenhar - isso faz
  // as bordas dos tiles (arte em pixel art, com padrões repetidos)
  // tremerem/"shimmerarem" visivelmente durante o scroll da câmera,
  // principalmente em resoluções/zooms não-inteiros (por isso o bug batia
  // em algumas máquinas e não em outras - reproduzido e confirmado via
  // teste headless). `pixelArt: true` desliga antialiasing e arredonda as
  // posições de desenho para pixels inteiros; a Fase 1 anterior (v0.1) só
  // usava retângulos sólidos sem padrão repetido, por isso o problema não
  // aparecia até a arte real (com tiles) entrar em cena.
  pixelArt: true,
  render: {
    antialias: false,
    roundPixels: true,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 }, // definido por fase em GameScene
      debug: false,
      // v0.4.2 - "raspão na parede" (ver o comentário longo em
      // `PHYSICS.jump.velocityY`, GameConfig.ts): em determinadas
      // combinações de arco de pulo + borda de bloco de chão, o corpo do
      // Arcade Physics engancha na quina do tile (comportamento conhecido
      // do motor com `tileBias` padrão de 4, mais perceptível em corpos
      // rápidos como Alex a 320px/s) - o eixo X trava contra a parede por
      // vários frames enquanto o eixo Y continua em queda livre, e ou o
      // personagem cai num vão ao lado sem nunca ter "colidido de verdade"
      // (o antigo bug 100% reproduzível citado em GameConfig.ts, resolvido
      // até agora só recalibrando a altura do pulo pra UMA sequência
      // específica de plataformas) ou fica visivelmente "grudado"/"travado"
      // por um instante antes de resolver - o "jogo não está fluido, está
      // travando" relatado em playtest, reproduzido também em outros pontos
      // do mapa novo da v0.4.0 (não só na sequência x=1300-1700 já
      // conhecida) via bot de teste Playwright. Levantar `tileBias` (valor
      // recomendado pela própria documentação do Phaser para corpos veloz
      // em tilemaps dessa natureza) resolve a causa raiz do engancho em vez
      // de continuar caçando/recalibrando velocidade de pulo por trecho.
      tileBias: 32,
    },
  },
  scene: [BootScene, MenuScene, GameScene, ClinicScene, EndingScene, MultiplayerScene],
};

new Phaser.Game(config);

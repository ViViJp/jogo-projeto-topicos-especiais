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
    },
  },
  scene: [BootScene, MenuScene, GameScene, ClinicScene, EndingScene, MultiplayerScene],
};

new Phaser.Game(config);

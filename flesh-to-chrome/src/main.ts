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

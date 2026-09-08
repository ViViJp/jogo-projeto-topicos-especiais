import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";

/**
 * Stub da `MultiplayerScene` prevista na seção 22.2 do GDD.
 * O modo multiplayer completo (seção 21) é conteúdo do Marco 5 do
 * cronograma (seção 24.5) e depende da campanha estar estável primeiro -
 * portanto fica fora do escopo deste protótipo. A cena existe para que a
 * estrutura de cenas do projeto já corresponda à Seção 22 do GDD.
 */
export class MultiplayerScene extends Phaser.Scene {
  constructor() {
    super("MultiplayerScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT / 2,
        "Multiplayer — Marco 5 (pós-MVP)\nNão implementado neste protótipo.\n\nENTER para voltar",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "22px",
          color: "#8892b0",
          align: "center",
        }
      )
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("MenuScene"));
  }
}

import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";

/** Tela técnica ao fim da ascensão; os finais narrativos ainda são pendência. */
export class EndingScene extends Phaser.Scene {
  private input$!: InputManager;
  private returning = false;
  private back!: () => void;

  constructor() {
    super("EndingScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);
    this.returning = false;

    this.add
      .text(SCREEN_WIDTH / 2, 90, "FIM DO BLOCKOUT — ASCENSÃO", {
        fontFamily: "Courier New, monospace",
        fontSize: "26px",
        color: "#7CFCEA",
        align: "center",
      })
      .setOrigin(0.5);

    const lines = [
      "Implementado nesta build:",
      "  • Cinco fases Tiled jogáveis, do Esgoto ao Topo da Cidade",
      "  • Slide, salto duplo, ataque/quebra, scan e dash",
      "  • Esteiras, inimigos, barricadas, lasers, portas e hazards ocultos",
      "  • Quatro clínicas com progressão dos implantes de Alex",
      "  • Checkpoints, respawn, créditos consolidados e save em localStorage",
      "  • Seletor de fases sem alteração do save e base de Multiplayer MQTT",
      "",
      "Pendências conhecidas (ver README.md e PR_25_VALIDATION.md):",
      "  • Ciclos próprios dos hazards industriais e rotação temporal da barreira",
      "  • Escolha Chrome/Flesh, descida Hollow e finais narrativos",
      "  • Corrida multiplayer, pontuação, DNF e resultados",
      "  • Decoração final, áudio, animações e calibração por playtest",
    ];

    this.add.text(SCREEN_WIDTH / 2, 320, lines.join("\n"), {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#c8cfe8",
      align: "left",
    }).setOrigin(0.5, 0.5);

    const prompt = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, "ENTER / A para voltar ao menu", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#8892b0",
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.3, yoyo: true, repeat: -1, duration: 700 });

    this.back = () => {
      if (this.returning) return;
      this.returning = true;
      this.scene.start("MenuScene");
    };
    this.input.once("pointerdown", this.back);
  }

  update(): void {
    if (this.input$.isConfirmJustDown()) {
      this.back();
    }
    this.input$.postUpdate();
  }
}

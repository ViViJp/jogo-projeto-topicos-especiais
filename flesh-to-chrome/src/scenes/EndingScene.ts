import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";

/**
 * Fim do conteúdo implementado neste protótipo (Marco 2 - Vertical Slice).
 * Não é um dos finais narrativos do jogo completo (Chrome / Flesh / Hollow -
 * seção 18) - é uma tela de "fim de build" com o roadmap restante, para que
 * quem jogar o protótipo entenda exatamente o que falta.
 */
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
      .text(SCREEN_WIDTH / 2, 90, "FIM DO PROTÓTIPO (MARCO 2 — VERTICAL SLICE)", {
        fontFamily: "Courier New, monospace",
        fontSize: "26px",
        color: "#7CFCEA",
        align: "center",
      })
      .setOrigin(0.5);

    const lines = [
      "Implementado nesta build:",
      "  • Fase 1 completa (Esgoto/Periferia): corrida, pulo, slide, água tóxica, canos, créditos, checkpoint",
      "  • Clínica de George e instalação das pernas mecânicas",
      "  • Salto duplo e prévia da Fase 2 (Industrial): gaps e rota de risco",
      "  • Ataque/quebra e prévia da Fase 3 (Meio Urbano): tutorial com barricadas",
      "  • Visor/scan e prévia da Fase 4 (Corporativo): passagens ocultas",
      "  • Dash e prévia da Fase 5 (Topo): barreiras cinéticas e grande vão",
      "  • Save em localStorage, HUD, câmera, sistema de créditos anti-farming",
      "",
      "Próximos marcos (ver README.md e Seção 24 do GDD):",
      "  • Marco 3 — Fases 2-5 completas, inimigos e Portão",
      "  • Marco 4 — Narrativa, descida Flesh/Hollow, ReForge Industries, finais",
      "  • Marco 5 — Multiplayer competitivo",
      "  • Marco 6 — Polimento, loja cosmética opcional",
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

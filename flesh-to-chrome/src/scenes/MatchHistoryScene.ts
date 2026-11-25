import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { CloudSession } from "../network/CloudSession";
import { MatchHistoryItem, MatchService } from "../network/MatchService";

export class MatchHistoryScene extends Phaser.Scene {
  private input$!: InputManager;
  private status?: Phaser.GameObjects.Text;

  constructor() {
    super("MatchHistoryScene");
  }

  create(): void {
    if (!CloudSession.current()) {
      this.scene.start("MenuScene");
      return;
    }
    this.input$ = new InputManager(this);
    this.cameras.main.setBackgroundColor(0x05050a);
    this.add.text(SCREEN_WIDTH / 2, 80, "HISTÓRICO MULTIPLAYER", {
      fontFamily: "Courier New, monospace", fontSize: "38px", color: "#7CFCEA",
    }).setOrigin(0.5);
    this.status = this.add.text(SCREEN_WIDTH / 2, 150, "Consultando partidas...", {
      fontFamily: "Courier New, monospace", fontSize: "18px", color: "#FFD37C",
      align: "center", wordWrap: { width: 1000 },
    }).setOrigin(0.5, 0);
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 45, "ESC / B: voltar", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#8892b0",
    }).setOrigin(0.5);
    void this.loadHistory();
  }

  update(): void {
    if (this.input$.isCancelJustDown()) this.scene.start("MenuScene");
    this.input$.postUpdate();
  }

  private async loadHistory(): Promise<void> {
    const userId = CloudSession.current()?.profile.id;
    const response = await MatchService.history();
    if (!this.status) return;
    if (response.status !== "ok" || !response.value || !userId) {
      this.status.setText("Não foi possível consultar o histórico.").setColor("#ff8a8a");
      return;
    }
    const items = response.value.items;
    if (!items.length) {
      this.status.setText("Nenhuma corrida concluída nos últimos 30 dias.").setColor("#8892b0");
      return;
    }
    this.status.setText(items.map((item) => this.formatItem(item, userId)).join("\n\n")).setColor("#e8ecff");
  }

  private formatItem(item: MatchHistoryItem, userId: string): string {
    const winner = item.result?.winnerUserId;
    const verdict = winner === null ? "EMPATE" : winner === userId ? "VITÓRIA" : "DERROTA";
    const date = new Date(item.at).toLocaleString("pt-BR");
    return `${date}  •  ${verdict}\nPartida ${item.matchId.slice(0, 12)}`;
  }
}

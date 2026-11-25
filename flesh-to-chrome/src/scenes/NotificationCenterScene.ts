import Phaser from "phaser";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import {
  GameNotification,
  NotificationPreferences,
  NotificationService,
} from "../network/NotificationService";
import { CloudSession } from "../network/CloudSession";

export class NotificationCenterScene extends Phaser.Scene {
  private input$!: InputManager;
  private items: GameNotification[] = [];
  private preferences?: NotificationPreferences;
  private selected = 0;
  private ready = false;
  private lines: Phaser.GameObjects.Text[] = [];
  private status?: Phaser.GameObjects.Text;
  private loadGeneration = 0;

  constructor() {
    super("NotificationCenterScene");
  }

  create(): void {
    if (!CloudSession.current()) {
      this.scene.start("MenuScene");
      return;
    }
    this.ready = false;
    this.items = [];
    this.preferences = undefined;
    this.selected = 0;
    this.lines = [];
    const generation = ++this.loadGeneration;
    this.input$ = new InputManager(this);
    this.cameras.main.setBackgroundColor(0x05050a);
    this.add.text(SCREEN_WIDTH / 2, 58, "CENTRAL DE NOTIFICAÇÕES", {
      fontFamily: "Courier New, monospace", fontSize: "36px", color: "#7CFCEA",
    }).setOrigin(0.5);
    this.status = this.add.text(SCREEN_WIDTH / 2, 105, "Carregando...", {
      fontFamily: "Courier New, monospace", fontSize: "16px", color: "#FFD37C",
    }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 35,
      "↑↓ selecionar  •  ENTER / A confirmar  •  ESC / B voltar", {
        fontFamily: "Courier New, monospace", fontSize: "14px", color: "#8892b0",
      }).setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.loadGeneration += 1;
      this.ready = false;
      this.items = [];
    });
    void this.loadCenter(generation);
  }

  update(): void {
    if (this.input$.isCancelJustDown()) {
      this.scene.start("MenuScene");
    } else if (this.ready && (this.input$.isMenuUpJustDown() || this.input$.isMenuLeftJustDown())) {
      this.selected = (this.selected - 1 + this.optionCount()) % this.optionCount();
      this.render();
    } else if (this.ready && (this.input$.isMenuDownJustDown() || this.input$.isMenuRightJustDown())) {
      this.selected = (this.selected + 1) % this.optionCount();
      this.render();
    } else if (this.ready && this.input$.isConfirmJustDown()) {
      if (this.selected === this.items.length) void this.toggleEndingEmail();
      else void this.markSelectedRead();
    }
    this.input$.postUpdate();
  }

  private async loadCenter(generation: number): Promise<void> {
    const [notes, preferences] = await Promise.all([
      NotificationService.list(),
      NotificationService.preferences(),
    ]);
    if (generation !== this.loadGeneration) return;
    if (notes.status !== "ok" || preferences.status !== "ok" || !notes.value || !preferences.value) {
      this.status?.setText("Não foi possível abrir a central.").setColor("#ff8a8a");
      return;
    }
    this.items = notes.value.items.slice(0, 8);
    this.preferences = preferences.value;
    this.ready = true;
    this.status?.setText("Notificações da conta atual").setColor("#8892b0");
    this.render();
  }

  private optionCount(): number {
    return this.items.length + 1;
  }

  private render(): void {
    this.lines.forEach((line) => line.destroy());
    this.lines = [];
    this.items.forEach((item, index) => {
      const marker = index === this.selected ? "▶" : " ";
      const unread = item.read ? " " : "●";
      const label = notificationLabel(item);
      this.lines.push(this.add.text(150, 155 + index * 55, `${marker} ${unread} ${label}`, {
        fontFamily: "Courier New, monospace", fontSize: "18px",
        color: index === this.selected ? "#7CFCEA" : item.read ? "#77809d" : "#e8ecff",
      }));
    });
    const preferenceIndex = this.items.length;
    const enabled = Boolean(this.preferences?.categories.ending && this.preferences?.channels.email);
    this.lines.push(this.add.text(150, 170 + this.items.length * 55,
      `${preferenceIndex === this.selected ? "▶" : " "} E-mail ao concluir finais: ${enabled ? "LIGADO" : "DESLIGADO"}`, {
        fontFamily: "Courier New, monospace", fontSize: "18px",
        color: preferenceIndex === this.selected ? "#7CFCEA" : "#FFD37C",
      }));
  }

  private async markSelectedRead(): Promise<void> {
    const item = this.items[this.selected];
    if (!item || item.read) return;
    const result = await NotificationService.markRead(item.id);
    if (result.status === "ok") {
      item.read = true;
      this.render();
    }
  }

  private async toggleEndingEmail(): Promise<void> {
    if (!this.preferences) return;
    const enabled = Boolean(this.preferences.categories.ending && this.preferences.channels.email);
    const next: NotificationPreferences = {
      ...this.preferences,
      categories: { ...this.preferences.categories, ending: true },
      channels: { ...this.preferences.channels, email: !enabled },
    };
    const result = await NotificationService.updatePreferences(next);
    if (result.status === "ok" && result.value) {
      this.preferences = result.value;
      this.render();
    } else if (result.status === "conflict") {
      this.status?.setText("Preferências mudaram em outra sessão; reabra a central.").setColor("#FFD37C");
    }
  }
}

function notificationLabel(item: GameNotification): string {
  const labels: Record<string, string> = {
    welcome: "Bem-vindo a Flesh to Chrome",
    campaign: "Novo marco consolidado na campanha",
    ending: "Final concluído",
    match: "Partida encerrada — consultar resultado",
  };
  const date = new Date(item.createdAt).toLocaleDateString("pt-BR");
  return `${labels[item.category] || item.category}  •  ${date}`;
}

import Phaser from "phaser";
import { InputManager } from "../systems/InputManager";
import type { LoadingTransitionData } from "../systems/SceneTransition";
import { loadingDestinationLabel } from "../systems/SceneTransition";

/**
 * Loader visual compartilhado. A cena de destino roda atrás dele e só é
 * revelada depois de terminar preload() e create().
 */
export class LoadingScene extends Phaser.Scene {
  private input$!: InputManager;
  private data$!: LoadingTransitionData;
  private progressFill!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private targetScene?: Phaser.Scene;
  private failed = false;
  private transitionFinished = false;
  private failedAsset = "";
  private barX = 0;
  private barY = 0;
  private barWidth = 0;
  private barHeight = 18;

  constructor() {
    super("LoadingScene");
  }

  init(data: LoadingTransitionData): void {
    this.data$ = {
      nextScene: data.nextScene,
      nextData: data.nextData,
      destinationLabel: data.destinationLabel
        ?? loadingDestinationLabel(data.nextScene, data.nextData),
    };
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const panelWidth = Math.min(760, width - 80);
    const panelHeight = 330;
    const panelX = centerX - panelWidth / 2;
    const panelY = centerY - panelHeight / 2;

    this.failed = false;
    this.transitionFinished = false;
    this.failedAsset = "";
    this.input$ = new InputManager(this);
    this.cameras.main.setBackgroundColor(0x03050a);

    this.add.rectangle(centerX, centerY, width, height, 0x03050a, 1);
    const grid = this.add.graphics().setAlpha(0.22);
    grid.lineStyle(1, 0x173447, 0.7);
    for (let x = 0; x <= width; x += 48) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 48) grid.lineBetween(0, y, width, y);

    const panel = this.add.graphics();
    panel.fillStyle(0x070b14, 0.96).lineStyle(2, 0x36e2ff, 0.86);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    panel.lineStyle(3, 0x7cfcea, 0.9);
    panel.lineBetween(panelX + 28, panelY, panelX + 160, panelY);
    panel.lineBetween(panelX + panelWidth - 116, panelY + panelHeight, panelX + panelWidth - 28, panelY + panelHeight);
    this.tweens.add({
      targets: panel,
      alpha: { from: 0.72, to: 1 },
      duration: 1_100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    this.add.text(centerX, panelY + 54, "FLESH TO CHROME", {
      fontFamily: "Courier New, monospace",
      fontSize: "30px",
      color: "#7CFCEA",
      letterSpacing: 4,
    }).setOrigin(0.5).setShadow(0, 0, "#36e2ff", 8, true, true);
    this.add.text(centerX, panelY + 103, "SINCRONIZANDO SETOR...", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#E8ECFF",
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(centerX, panelY + 140, this.data$.destinationLabel ?? "NOVO DESTINO", {
      fontFamily: "Courier New, monospace",
      fontSize: "15px",
      color: "#FFD37C",
      letterSpacing: 1,
    }).setOrigin(0.5);

    const spinner = this.add.container(centerX, panelY + 188);
    const spinnerShape = this.add.graphics();
    spinnerShape.lineStyle(2, 0x7cfcea, 1);
    spinnerShape.strokeTriangle(0, -12, 12, 10, -12, 10);
    spinnerShape.fillStyle(0xff71ce, 0.55);
    spinnerShape.fillCircle(0, 1, 4);
    spinner.add(spinnerShape);
    this.tweens.add({ targets: spinner, angle: 360, duration: 1_100, repeat: -1 });

    this.barWidth = Math.min(560, panelWidth - 100);
    this.barX = centerX - this.barWidth / 2;
    this.barY = panelY + 226;
    this.add.rectangle(centerX, this.barY, this.barWidth, this.barHeight, 0x101725, 1)
      .setStrokeStyle(2, 0x36536c, 1);
    this.progressFill = this.add.graphics();
    this.progressText = this.add.text(centerX, this.barY, "0%", {
      fontFamily: "Courier New, monospace",
      fontSize: "12px",
      color: "#E8ECFF",
    }).setOrigin(0.5);
    this.statusText = this.add.text(centerX, panelY + 278, "PREPARANDO CONEXÃO...", {
      fontFamily: "Courier New, monospace",
      fontSize: "13px",
      color: "#8D96AD",
      align: "center",
      wordWrap: { width: panelWidth - 70 },
    }).setOrigin(0.5);
    this.renderProgress(0);
    this.launchDestination();
  }

  update(): void {
    if (this.failed) {
      if (this.input$.isConfirmJustDown()) this.retry();
      else if (this.input$.isCancelJustDown()) this.returnToMenu();
    }
    this.input$.postUpdate();
  }

  private launchDestination(): void {
    const target = this.scene.get<Phaser.Scene>(this.data$.nextScene);
    this.targetScene = target;
    const onProgress = (progress: number): void => {
      if (!this.failed) this.renderProgress(progress);
    };
    const onLoadError = (file: Phaser.Loader.File): void => {
      this.failed = true;
      this.failedAsset = file?.key ?? "asset desconhecido";
      this.statusText
        .setText(`FALHA AO CARREGAR: ${this.failedAsset}\nENTER / A tentar novamente   ·   ESC / B menu`)
        .setColor("#FF8299");
    };
    const onCreated = (): void => {
      this.scene.pause(this.data$.nextScene);
      if (this.failed) return;
      this.transitionFinished = true;
      target.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
      target.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.renderProgress(1);
      this.statusText.setText("SETOR SINCRONIZADO").setColor("#7CFCEA");
      this.time.delayedCall(180, () => this.revealDestination());
    };

    target.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
    target.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    target.events.once(Phaser.Scenes.Events.CREATE, onCreated);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      target.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
      target.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      target.events.off(Phaser.Scenes.Events.CREATE, onCreated);
    });

    this.scene.launch(this.data$.nextScene, this.data$.nextData);
    this.scene.bringToTop("LoadingScene");
  }

  private renderProgress(progress: number): void {
    const normalized = Phaser.Math.Clamp(progress, 0, 1);
    this.progressFill.clear();
    this.progressFill.fillStyle(0x36e2ff, 0.9);
    this.progressFill.fillRect(
      this.barX,
      this.barY - this.barHeight / 2,
      this.barWidth * normalized,
      this.barHeight,
    );
    this.progressText.setText(`${Math.round(normalized * 100)}%`);
  }

  private revealDestination(): void {
    if (!this.transitionFinished) return;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop("LoadingScene");
      this.scene.resume(this.data$.nextScene);
    });
    this.cameras.main.fadeOut(220, 0, 0, 0);
  }

  private retry(): void {
    this.scene.stop(this.data$.nextScene);
    this.scene.restart(this.data$);
  }

  private returnToMenu(): void {
    if (this.targetScene) this.scene.stop(this.data$.nextScene);
    this.scene.start("MenuScene");
  }
}

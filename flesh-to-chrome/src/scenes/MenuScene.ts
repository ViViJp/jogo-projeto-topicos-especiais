import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { CloudSession } from "../network/CloudSession";
import { SaveState } from "../systems/SaveState";
import { GameSceneData } from "./GameScene";

interface MenuOption {
  label: string;
  action: () => void;
}

const TEST_PHASES = [
  { id: "fase1", label: "Fase 1 — Esgoto / Periferia" },
  { id: "fase2-intro", label: "Fase 2 — Distrito Industrial" },
  { id: "fase3", label: "Fase 3 — Meio Urbano" },
  { id: "fase4", label: "Fase 4 — Distrito Corporativo" },
  { id: "fase5", label: "Fase 5 — Topo da Cidade" },
] as const;

export class MenuScene extends Phaser.Scene {
  private input$!: InputManager;
  private options: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private confirmVisible = false;
  private confirmText?: Phaser.GameObjects.Text;
  private menuHint?: Phaser.GameObjects.Text;
  private hasSave = false;
  private ready = false;
  private statusText?: Phaser.GameObjects.Text;
  private choice: "none" | "import" | "conflict" = "none";
  private mode: "main" | "phase-select" | "choice" = "main";

  constructor() {
    super("MenuScene");
  }

  create(): void {
    // A instancia da cena e reutilizada ao voltar do jogo/multiplayer.
    this.optionTexts = [];
    this.selectedIndex = 0;
    this.confirmVisible = false;
    this.confirmText = undefined;
    this.mode = "main";

    this.cameras.main.setBackgroundColor(0x05050a);
    this.input$ = new InputManager(this);

    this.add
      .text(SCREEN_WIDTH / 2, 150, "FLESH TO CHROME", {
        fontFamily: "Courier New, monospace",
        fontSize: "56px",
        color: "#7CFCEA",
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN_WIDTH / 2, 210, "protótipo técnico — Glitch City", {
        fontFamily: "Courier New, monospace",
        fontSize: "18px",
        color: "#8892b0",
      })
      .setOrigin(0.5);

    this.menuHint = this.add
      .text(SCREEN_WIDTH / 2, 250, "MENU PRINCIPAL", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#565f80",
      })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(SCREEN_WIDTH / 2, 286, "Conectando...", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#8892b0",
        align: "center",
        wordWrap: { width: 900 },
      })
      .setOrigin(0.5);
    void this.prepare();

    this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 40,
        "↑↓ / W S ou DIRECIONAL navegar   ENTER / A confirmar   ESC / B voltar",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "14px",
          color: "#565f80",
        }
      )
      .setOrigin(0.5);
  }

  update(): void {
    if (!this.ready) {
      this.input$.postUpdate();
      return;
    }

    if (this.confirmVisible) {
      if (this.input$.isCancelJustDown()) {
        this.hideConfirm();
      } else if (this.input$.isConfirmJustDown()) {
        this.confirmNewGame();
      }
      this.input$.postUpdate();
      return;
    }

    if (this.mode === "phase-select" && this.input$.isCancelJustDown()) {
      this.showMainMenu();
      this.input$.postUpdate();
      return;
    }

    if (this.input$.isMenuUpJustDown() || this.input$.isMenuLeftJustDown()) {
      this.setSelected((this.selectedIndex - 1 + this.options.length) % this.options.length);
    } else if (this.input$.isMenuDownJustDown() || this.input$.isMenuRightJustDown()) {
      this.setSelected((this.selectedIndex + 1) % this.options.length);
    } else if (this.input$.isConfirmJustDown()) {
      this.confirmSelection();
    }

    this.input$.postUpdate();
  }

  private renderOptions(): void {
    this.optionTexts.forEach((text) => text.destroy());
    this.optionTexts = [];
    this.selectedIndex = 0;

    const startY = this.mode === "main" ? 340 : 330;
    const spacing = this.mode === "phase-select" ? 44 : 46;
    this.options.forEach((option, index) => {
      const text = this.add
        .text(SCREEN_WIDTH / 2, startY + index * spacing, option.label, {
          fontFamily: "Courier New, monospace",
          fontSize: this.mode === "phase-select" ? "23px" : "28px",
          color: "#e8ecff",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => this.setSelected(index))
        .on("pointerdown", () => {
          this.setSelected(index);
          this.confirmSelection();
        });
      this.optionTexts.push(text);
    });

    if (this.options.length > 0) this.setSelected(0);
  }

  private showMainMenu(): void {
    this.mode = "main";
    this.menuHint?.setText("MENU PRINCIPAL");
    this.options = [];
    const saveData = SaveState.load().get();
    if (this.hasSave && saveData.endingReached === null) {
      this.options.push({ label: "Continuar", action: () => this.continueGame() });
    }
    if (saveData.preGateSave) {
      this.options.push({ label: "Continuar do Portão", action: () => this.continueFromGate() });
    }
    this.options.push({ label: "Novo Jogo", action: () => this.newGame(this.hasSave) });
    this.options.push({ label: "Selecionar Fase (teste)", action: () => this.showPhaseSelect() });
    this.options.push({ label: "Multiplayer", action: () => this.openMultiplayer() });
    if (CloudSession.current()) {
      this.options.push({ label: "Sair", action: () => void this.logout() });
    } else {
      this.options.push({ label: "Entrar com Google", action: () => void this.login() });
    }
    this.renderOptions();
  }

  private showPhaseSelect(): void {
    this.mode = "phase-select";
    this.menuHint?.setText("SELEÇÃO TEMPORÁRIA — NÃO ALTERA O SAVE");
    this.options = TEST_PHASES.map((phase) => ({
      label: phase.label,
      action: () => this.startTestPhase(phase.id),
    }));
    this.options.push({
      label: "Portão — escolha final (teste)",
      action: () => this.scene.start("GateScene", { testMode: true }),
    });
    this.options.push({ label: "← Voltar", action: () => this.showMainMenu() });
    this.renderOptions();
  }

  private startTestPhase(phaseId: string): void {
    this.scene.start("GameScene", {
      phaseId,
      checkpointX: 0,
      checkpointY: 0,
      consolidatedCreditIds: [],
      wallet: 0,
      testMode: true,
    } as GameSceneData);
  }

  private setSelected(index: number): void {
    this.selectedIndex = index;
    this.optionTexts.forEach((text, optionIndex) => {
      text.setColor(optionIndex === index ? "#FFD37C" : "#e8ecff");
      text.setScale(optionIndex === index ? 1.06 : 1);
    });
  }

  private confirmSelection(): void {
    if (this.confirmVisible) return;
    this.options[this.selectedIndex]?.action();
  }

  private async prepare(): Promise<void> {
    SaveState.bootGuest();
    await CloudSession.completeLoginIfNeeded();
    await CloudSession.me();
    const session = CloudSession.current();
    if (!session) {
      SaveState.prefer("session");
      this.statusText?.setText("Visitante: fechar a aba apaga o progresso desta sessão.");
      this.finishPrepare();
      return;
    }
    const guest = SaveState.readStored("session", SaveState.sessionKey());
    const account = SaveState.readStored("account", SaveState.accountKey(session.profile.id));
    const remote = await CloudSession.campaign();
    const guestProgress = Boolean(guest && SaveState.hasProgress(guest));
    const accountProgress = Boolean(account && SaveState.hasProgress(account));
    if (guestProgress && (accountProgress || remote === "present")) {
      this.choice = "conflict";
      SaveState.keepSession();
      this.showChoice();
      return;
    }
    if (guestProgress) {
      this.choice = "import";
      SaveState.keepSession();
      this.showChoice();
      return;
    }
    SaveState.keepAccount();
    this.statusText?.setText(`Conta: ${session.profile.name}`);
    this.finishPrepare();
  }

  private finishPrepare(): void {
    this.choice = "none";
    this.mode = "main";
    this.hasSave = SaveState.hasExistingSave();
    this.ready = true;
    this.showMainMenu();
  }

  private showChoice(): void {
    this.ready = true;
    this.mode = "choice";
    const session = CloudSession.current();
    this.menuHint?.setText("ESCOLHA O PROGRESSO");
    this.statusText?.setText(
      this.choice === "conflict"
        ? "Há progresso nesta sessão e um save da conta. Nada foi sobrescrito."
        : "Importar o progresso desta sessão para a conta?"
    );
    this.options =
      this.choice === "conflict"
        ? [
            { label: "Trazer o progresso desta sessão", action: () => this.importProgress() },
            { label: "Manter o save da conta", action: () => this.keepAccountProgress() },
            { label: "Cancelar", action: () => this.keepGuestProgress() },
          ]
        : [
            { label: "Salvar este progresso na conta", action: () => this.importProgress() },
            { label: "Continuar sem salvar na conta", action: () => this.keepGuestProgress() },
          ];
    if (!session) this.options = [{ label: "Voltar", action: () => this.finishPrepare() }];
    this.renderOptions();
  }

  private importProgress(): void {
    const session = CloudSession.current();
    if (!session) return;
    SaveState.importSession(session.profile.id);
    this.statusText?.setText(`Conta: ${session.profile.name}. A nuvem não foi sobrescrita.`);
    this.finishPrepare();
  }

  private keepAccountProgress(): void {
    const session = CloudSession.current();
    SaveState.keepAccount();
    this.statusText?.setText(session ? `Conta: ${session.profile.name}` : "");
    this.finishPrepare();
  }

  private keepGuestProgress(): void {
    SaveState.keepSession();
    const session = CloudSession.current();
    this.statusText?.setText(
      session
        ? `${session.profile.name}: o progresso desta sessão ainda não foi para a conta.`
        : "Visitante: fechar a aba apaga o progresso desta sessão."
    );
    this.finishPrepare();
  }

  private async login(): Promise<void> {
    if (!(await CloudSession.api())) {
      this.statusText?.setText("Login indisponível neste endereço.");
      return;
    }
    await CloudSession.login();
  }

  private async logout(): Promise<void> {
    await CloudSession.logout();
    SaveState.logoutLocal();
    this.statusText?.setText("Visitante: fechar a aba apaga o progresso desta sessão.");
    this.finishPrepare();
  }

  private openMultiplayer(): void {
    if (!CloudSession.current()) {
      this.statusText?.setText("Entre com Google antes do multiplayer.");
      return;
    }
    this.scene.start("MultiplayerScene");
  }

  private continueGame(): void {
    const save = SaveState.load();
    const data = save.get();
    this.scene.start("GameScene", {
      phaseId: data.currentPhaseId,
      checkpointX: data.checkpoint.x,
      checkpointY: data.checkpoint.y,
      consolidatedCreditIds: data.checkpoint.consolidatedCreditIds,
      wallet: data.wallet,
      abilities: data.abilities,
    } as GameSceneData);
  }

  private continueFromGate(): void {
    const restored = SaveState.load().restorePreGateSave();
    if (!restored) return;
    // Phaser preserva os dados anteriores quando uma cena é iniciada sem
    // um novo objeto. Sobrescreve explicitamente a prévia do seletor.
    this.scene.start("GateScene", { testMode: false });
  }

  private newGame(hasSave: boolean): void {
    if (hasSave && !this.confirmVisible) {
      this.showConfirm();
      return;
    }
    SaveState.newGame();
    this.scene.start("PrologueScene");
  }

  private showConfirm(): void {
    this.confirmVisible = true;
    this.confirmText = this.add
      .text(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT - 110,
        "Isso vai apagar o save atual. ENTER/A confirma, ESC/B/SELECT cancela.",
        {
          fontFamily: "Courier New, monospace",
          fontSize: "18px",
          color: "#ff8a8a",
          backgroundColor: "#1a0a0aee",
          padding: { x: 14, y: 10 },
        }
      )
      .setOrigin(0.5);
  }

  private confirmNewGame(): void {
    this.hideConfirm();
    SaveState.newGame();
    this.scene.start("PrologueScene");
  }

  private hideConfirm(): void {
    this.confirmVisible = false;
    this.confirmText?.destroy();
    this.confirmText = undefined;
  }
}

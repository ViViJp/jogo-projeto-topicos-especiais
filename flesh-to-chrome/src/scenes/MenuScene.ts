import Phaser from "phaser";
import { SCREEN_WIDTH, SCREEN_HEIGHT } from "../config/GameConfig";
import { InputManager } from "../systems/InputManager";
import { CampaignSyncState, CloudSession } from "../network/CloudSession";
import { SaveState, SaveData } from "../systems/SaveState";
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
  private remoteSave: SaveData | null = null;
  private remoteRevision = 0;
  private mode: "main" | "phase-select" | "choice" = "main";
  private stopCampaignSync?: () => void;
  private pendingGateContinuation = false;

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
    this.pendingGateContinuation = false;
    this.stopCampaignSync?.();

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
    this.stopCampaignSync = CloudSession.subscribeCampaignSync((state) => this.handleCampaignSync(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopCampaignSync?.();
      this.stopCampaignSync = undefined;
    });
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
    try {
      SaveState.bootGuest();
      await CloudSession.completeLoginIfNeeded();
      await CloudSession.me();
      const session = CloudSession.current();
      if (!session) {
        const remembered = CloudSession.storedOwner();
        if (remembered) {
          SaveState.bindAccount(remembered);
          this.statusText?.setText("A sessão expirou. Entre de novo para sincronizar. O save da conta ficou neste aparelho.");
        } else {
          SaveState.bindSession();
          this.statusText?.setText("Visitante: fechar a aba apaga o progresso desta sessão.");
        }
        this.finishPrepare();
        return;
      }
      const guest = SaveState.readStored("session", SaveState.sessionKey());
      const account = SaveState.readStored("account", SaveState.accountKey(session.profile.id));
      const remote = await CloudSession.loadCampaign();
      const guestProgress = Boolean(guest && SaveState.hasProgress(guest));
      const pendingSync = CloudSession.hasPendingCampaignSync(session.profile.id);
      const syncConflict = CloudSession.hasCampaignConflict(session.profile.id);
      this.remoteRevision = remote.revision;
      this.remoteSave = remote.save;
      if (remote.status === "unavailable") {
        if (guestProgress) SaveState.keepSession();
        else if (account) SaveState.bindAccount(session.profile.id);
        else SaveState.bindSession();
        if (pendingSync && !syncConflict) CloudSession.retryCampaignSync();
        this.statusText?.setText(
          pendingSync
            ? "Save local preservado. A sincronização será retomada quando a conexão voltar."
            : "Não foi possível verificar a campanha na nuvem. As cópias locais foram preservadas."
        );
        this.finishPrepare();
        return;
      }
      const remoteDiffers = Boolean(
        remote.save && account && !CloudSession.same(account, remote.save)
      );
      if (guestProgress || syncConflict) {
        CloudSession.pauseCampaignSync(session.profile.id);
        if (guestProgress) SaveState.keepSession();
        else SaveState.bindAccount(session.profile.id);
        this.showChoice();
        if (syncConflict) {
          this.statusText?.setText("Conflito de save: escolha qual cópia deve continuar.");
        }
        return;
      }
      if (pendingSync) {
        SaveState.bindAccount(session.profile.id);
        CloudSession.resumeCampaignSync(session.profile.id, remote.revision);
        this.statusText?.setText("Há progresso local aguardando sincronização com a nuvem.");
        this.finishPrepare();
        return;
      }
      if (remote.save && (!account || remoteDiffers)) {
        CloudSession.pauseCampaignSync(session.profile.id);
        this.showChoice();
        return;
      }
      if (!remote.save && account && SaveState.hasProgress(account)) {
        const result = await CloudSession.saveCampaign(account, remote.revision, "local-sync");
        if (result.status === "conflict") {
          await this.refreshAfterConflict();
          return;
        }
        if (result.status === "unavailable") {
          CloudSession.pauseCampaignSync(session.profile.id);
          SaveState.bindAccount(session.profile.id);
          this.statusText?.setText("O save da conta ficou neste aparelho e aguarda sincronização.");
          this.finishPrepare();
          return;
        }
        this.remoteRevision = result.revision;
      }
      if (remote.save) this.writeAccount(session.profile.id, remote.save);
      SaveState.bindAccount(session.profile.id);
      CloudSession.resumeCampaignSync(session.profile.id, this.remoteRevision);
      this.statusText?.setText(`Conta: ${session.profile.name}`);
      this.finishPrepare();
    } catch {
      SaveState.bindSession();
      this.statusText?.setText("A nuvem não respondeu. O jogo segue como visitante.");
      this.finishPrepare();
    }
  }

  private finishPrepare(): void {
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
    this.statusText?.setText("Nada foi sobrescrito. Escolha qual cópia continua.");
    const guest = session ? SaveState.readStored("session", SaveState.sessionKey()) : null;
    const account = session
      ? SaveState.readStored("account", SaveState.accountKey(session.profile.id))
      : null;
    const guestProgress = Boolean(guest && SaveState.hasProgress(guest));
    const accountProgress = Boolean(account && SaveState.hasProgress(account));
    this.options = [];
    if (guestProgress) {
      this.options.push({ label: "Trazer o progresso desta sessão", action: () => void this.importProgress() });
    }
    if (accountProgress) {
      this.options.push({ label: "Manter o save da conta", action: () => void this.keepAccountProgress() });
    }
    if (this.remoteSave) {
      this.options.push({ label: "Usar a campanha da nuvem", action: () => this.useRemote() });
    }
    this.options.push({ label: "Cancelar", action: () => this.keepGuestProgress() });
    if (!session) this.options = [{ label: "Voltar", action: () => this.finishPrepare() }];
    this.renderOptions();
  }

  private async importProgress(): Promise<void> {
    const session = CloudSession.current();
    const guest = SaveState.readStored("session", SaveState.sessionKey());
    if (!session || !guest) return;
    const result = await CloudSession.saveCampaign(guest, this.remoteRevision, "guest-import");
    if (result.status === "conflict") {
      await this.refreshAfterConflict();
      return;
    }
    if (result.status === "unavailable") {
      this.statusText?.setText("A importação aguarda confirmação da nuvem. Todas as cópias foram preservadas.");
      return;
    }
    SaveState.importSession(session.profile.id);
    this.remoteRevision = result.revision;
    CloudSession.discardPendingCampaignSync(session.profile.id);
    CloudSession.resumeCampaignSync(session.profile.id, result.revision);
    this.statusText?.setText(this.syncText(session.profile.name, result.status));
    this.finishPrepare();
  }

  private async keepAccountProgress(): Promise<void> {
    const session = CloudSession.current();
    if (!session) return;
    const local = SaveState.readStored("account", SaveState.accountKey(session.profile.id));
    if (!local) {
      this.finishPrepare();
      return;
    }
    const result = await CloudSession.saveCampaign(local, this.remoteRevision, "local-sync");
    if (result.status === "conflict") {
      await this.refreshAfterConflict();
      return;
    }
    if (result.status === "unavailable") {
      this.statusText?.setText("A sincronização não foi confirmada. As cópias local, remota e visitante foram preservadas.");
      return;
    }
    SaveState.keepAccount(session.profile.id);
    this.remoteRevision = result.revision;
    CloudSession.discardPendingCampaignSync(session.profile.id);
    CloudSession.resumeCampaignSync(session.profile.id, result.revision);
    this.statusText?.setText(this.syncText(session.profile.name, result.status));
    this.finishPrepare();
  }

  private useRemote(): void {
    const session = CloudSession.current();
    if (!session || !this.remoteSave) return;
    CloudSession.discardPendingCampaignSync(session.profile.id);
    this.writeAccount(session.profile.id, this.remoteSave);
    SaveState.bindAccount(session.profile.id);
    CloudSession.resumeCampaignSync(session.profile.id, this.remoteRevision);
    this.statusText?.setText(`Conta: ${session.profile.name}. A campanha da nuvem foi carregada.`);
    this.finishPrepare();
  }

  private writeAccount(userId: string, save: SaveData): void {
    localStorage.setItem(SaveState.accountKey(userId), JSON.stringify(save));
    sessionStorage.removeItem(SaveState.sessionKey());
  }

  private syncText(name: string, result: "saved" | "conflict" | "unavailable"): string {
    if (result === "conflict") return "A campanha da nuvem mudou. Nada foi sobrescrito.";
    if (result === "unavailable") return "A cópia local foi mantida. A nuvem não confirmou a gravação.";
    return `Conta: ${name}`;
  }

  private async refreshAfterConflict(): Promise<void> {
    const session = CloudSession.current();
    if (!session) return;
    const latest = await CloudSession.loadCampaign();
    CloudSession.pauseCampaignSync(session.profile.id);
    if (latest.status === "present") {
      this.remoteRevision = latest.revision;
      this.remoteSave = latest.save;
      this.showChoice();
      this.statusText?.setText("A campanha mudou em outro dispositivo. Revise novamente as cópias preservadas.");
      return;
    }
    this.statusText?.setText("O conflito não pôde ser atualizado. Todas as cópias continuam preservadas.");
  }

  private keepGuestProgress(): void {
    SaveState.keepSession();
    const session = CloudSession.current();
    if (session) CloudSession.pauseCampaignSync(session.profile.id);
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
    const save = SaveState.load();
    if (!save.hasPreGateSave()) return;
    if (CloudSession.current()) {
      this.pendingGateContinuation = true;
      if (!CloudSession.queueGateRestore()) {
        this.pendingGateContinuation = false;
        this.statusText?.setText("Não foi possível preparar a restauração do Portão.");
        return;
      }
      this.statusText?.setText("Restaurando o save pré-Portão na nuvem...");
      return;
    }
    const restored = save.restorePreGateSave();
    if (!restored) return;
    // Phaser preserva os dados anteriores quando uma cena é iniciada sem
    // um novo objeto. Sobrescreve explicitamente a prévia do seletor.
    this.scene.start("GateScene", { testMode: false });
  }

  private handleCampaignSync(state: CampaignSyncState): void {
    if (state.completedAction === "restore" && state.restoredSave) {
      const restored = SaveState.load().restorePreGateSave(state.restoredSave);
      if (!restored) return;
      const shouldContinue = this.pendingGateContinuation;
      this.pendingGateContinuation = false;
      if (shouldContinue) {
        this.scene.start("GateScene", { testMode: false });
      } else {
        this.statusText?.setText("Save pré-Portão restaurado e confirmado na nuvem.");
        this.finishPrepare();
      }
      return;
    }
    if (state.status === "conflict") {
      this.pendingGateContinuation = false;
      this.statusText?.setText("Conflito de save. Volte ao menu para escolher qual cópia continuar.");
      if (this.ready && this.mode === "main") void this.refreshAfterConflict();
    } else if (state.status === "pending") {
      this.statusText?.setText("Save local preservado; sincronização com a nuvem pendente.");
    } else if (state.status === "syncing") {
      this.statusText?.setText("Sincronizando campanha com a nuvem...");
    }
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

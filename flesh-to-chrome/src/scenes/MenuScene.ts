import Phaser from "phaser";
import { MenuBackdrop, drawTechPanel, preloadMenuBackdrop } from "../objects/MenuBackdrop";
import { AudioManager, BGM, SFX } from "../systems/AudioManager";
import { InputManager } from "../systems/InputManager";
import { CampaignSyncState, CloudSession } from "../network/CloudSession";
import { SaveState, SaveData } from "../systems/SaveState";
import { GameSceneData } from "./GameScene";
import { startLoadingTransition } from "../systems/SceneTransition";

interface MenuOption {
  label: string;
  action: () => void;
}

export class MenuScene extends Phaser.Scene {
  private input$!: InputManager;
  private backdrop!: MenuBackdrop;
  private options: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private confirmVisible = false;
  private confirmText?: Phaser.GameObjects.Text;
  private confirmPanel?: Phaser.GameObjects.Graphics;
  private menuHint?: Phaser.GameObjects.Text;
  private hasSave = false;
  private ready = false;
  private statusText?: Phaser.GameObjects.Text;
  private remoteSave: SaveData | null = null;
  private remoteRevision = 0;
  private mode: "main" | "choice" = "main";
  private stopCampaignSync?: () => void;
  private pendingGateContinuation = false;
  private preparationGeneration = 0;
  private panelX = 48;
  private panelY = 196;
  private panelWidth = 500;
  private panelHeight = 462;

  constructor() {
    super("MenuScene");
  }

  preload(): void {
    AudioManager.preloadBgm(this, BGM.menu);
    preloadMenuBackdrop(this);
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.panelX = Math.max(48, (width - 1_440) / 2 + 48);
    this.panelY = Math.max(196, height * 0.27);
    this.panelWidth = Math.min(500, width - this.panelX - 48);
    this.panelHeight = height - this.panelY - 62;

    this.optionTexts = [];
    this.options = [];
    this.selectedIndex = 0;
    this.confirmVisible = false;
    this.confirmText = undefined;
    this.confirmPanel = undefined;
    this.mode = "main";
    this.ready = false;
    this.hasSave = false;
    this.remoteSave = null;
    this.remoteRevision = 0;
    this.pendingGateContinuation = false;
    this.stopCampaignSync?.();
    const preparation = ++this.preparationGeneration;

    this.cameras.main.setBackgroundColor(0x05050a);
    this.backdrop = new MenuBackdrop(this);
    AudioManager.playBgm(this, BGM.menu, 0.28);
    this.input$ = new InputManager(this);

    this.add.text(this.panelX, 58, "FLESH TO CHROME", {
      fontFamily: "Courier New, monospace",
      fontSize: "58px",
      color: "#7CFCEA",
      letterSpacing: 3,
    }).setDepth(6).setShadow(0, 0, "#36e2ff", 10, true, true);

    this.add.text(this.panelX + 3, 128, "GLITCH CITY // SISTEMA DE ASCENSÃO", {
      fontFamily: "Courier New, monospace",
      fontSize: "18px",
      color: "#a8b5ce",
      letterSpacing: 2,
    }).setDepth(6);

    drawTechPanel(this, this.panelX, this.panelY, this.panelWidth, this.panelHeight, 5, 0x36e2ff);

    this.menuHint = this.add.text(this.panelX + 28, this.panelY + 24, "MENU PRINCIPAL", {
      fontFamily: "Courier New, monospace",
      fontSize: "16px",
      color: "#7CFCEA",
      letterSpacing: 2,
    }).setDepth(6);
    this.statusText = this.add.text(this.panelX + 28, this.panelY + 53, "Conectando...", {
      fontFamily: "Courier New, monospace",
      fontSize: "13px",
      color: "#a8b5ce",
      wordWrap: { width: this.panelWidth - 56 },
    }).setDepth(6);
    this.stopCampaignSync = CloudSession.subscribeCampaignSync((state) => this.handleCampaignSync(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.preparationGeneration += 1;
      this.ready = false;
      this.options = [];
      this.stopCampaignSync?.();
      this.stopCampaignSync = undefined;
    });
    void this.prepare(preparation);

    this.add.text(
      this.panelX + this.panelWidth / 2,
      height - 28,
      "↑↓ / W S navegar   ENTER / A confirmar   ESC / B voltar",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "13px",
        color: "#8d96ad",
      },
    ).setOrigin(0.5).setDepth(6);
  }

  update(_time: number, delta: number): void {
    this.backdrop.update(delta);
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

    const startY = this.panelY + 104;
    const spacing = this.options.length > 1
      ? Math.min(52, (this.panelHeight - 132) / (this.options.length - 1))
      : 52;
    this.options.forEach((option, index) => {
      const text = this.add.text(this.panelX + 28, startY + index * spacing, option.label, {
        fontFamily: "Courier New, monospace",
        fontSize: "23px",
        color: "#e8ecff",
      }).setOrigin(0, 0.5).setDepth(6).setInteractive({ useHandCursor: true })
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
    this.options.push({ label: "Controles", action: () => this.openControls(false) });
    if (CloudSession.current()) {
      this.options.push({ label: "Multiplayer", action: () => this.openMultiplayer() });
      this.options.push({ label: "Histórico multiplayer", action: () => this.scene.start("MatchHistoryScene") });
      this.options.push({ label: "Notificações", action: () => this.scene.start("NotificationCenterScene") });
      this.options.push({ label: "Sair", action: () => void this.logout() });
    } else {
      if (CloudSession.stored()) {
        this.options.push({ label: "Sair da sessão expirada", action: () => void this.logout() });
      }
      this.options.push({ label: "Entrar com Google", action: () => void this.login() });
    }
    this.renderOptions();
  }

  private setSelected(index: number): void {
    if (index !== this.selectedIndex && this.optionTexts.length > 0) {
      AudioManager.playSfx(this, SFX.uiSelect, { volume: 0.28 });
    }
    this.selectedIndex = index;
    this.optionTexts.forEach((text, optionIndex) => {
      text.setText(`${optionIndex === index ? "▶ " : "  "}${this.options[optionIndex].label.toUpperCase()}`);
      text.setColor(optionIndex === index ? "#FFD37C" : "#e8ecff");
      text.setScale(optionIndex === index ? 1.03 : 1);
    });
  }

  private confirmSelection(): void {
    if (this.confirmVisible) return;
    AudioManager.playSfx(this, SFX.uiConfirm, { volume: 0.42 });
    this.options[this.selectedIndex]?.action();
  }

  private async prepare(preparation: number): Promise<void> {
    try {
      SaveState.bootGuest();
      await CloudSession.completeLoginIfNeeded();
      if (!this.isCurrentPreparation(preparation)) return;
      await CloudSession.me();
      if (!this.isCurrentPreparation(preparation)) return;
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
      if (!this.isCurrentPreparation(preparation) || !this.isSameSession(session)) return;
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
        if (!this.isCurrentPreparation(preparation) || !this.isSameSession(session)) return;
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
      if (!this.isCurrentPreparation(preparation)) return;
      SaveState.bindSession();
      this.statusText?.setText("A nuvem não respondeu. O jogo segue como visitante.");
      this.finishPrepare();
    }
  }

  private isCurrentPreparation(preparation: number): boolean {
    return preparation === this.preparationGeneration;
  }

  private isSameSession(expected: { accessToken: string; profile: { id: string } }): boolean {
    const current = CloudSession.current();
    return Boolean(
      current &&
      current.profile.id === expected.profile.id &&
      current.accessToken === expected.accessToken
    );
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
    const preparation = this.preparationGeneration;
    const session = CloudSession.current();
    const guest = SaveState.readStored("session", SaveState.sessionKey());
    if (!session || !guest) return;
    const result = await CloudSession.saveCampaign(guest, this.remoteRevision, "guest-import");
    if (!this.isCurrentPreparation(preparation) || !this.isSameSession(session)) return;
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
    const preparation = this.preparationGeneration;
    const session = CloudSession.current();
    if (!session) return;
    const local = SaveState.readStored("account", SaveState.accountKey(session.profile.id));
    if (!local) {
      this.finishPrepare();
      return;
    }
    const result = await CloudSession.saveCampaign(local, this.remoteRevision, "local-sync");
    if (!this.isCurrentPreparation(preparation) || !this.isSameSession(session)) return;
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
    const preparation = this.preparationGeneration;
    const session = CloudSession.current();
    if (!session) return;
    const latest = await CloudSession.loadCampaign();
    if (!this.isCurrentPreparation(preparation) || !this.isSameSession(session)) return;
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
    const preparation = this.preparationGeneration;
    if (!(await CloudSession.api())) {
      if (!this.isCurrentPreparation(preparation)) return;
      this.statusText?.setText("Login indisponível neste endereço.");
      return;
    }
    if (!this.isCurrentPreparation(preparation)) return;
    await CloudSession.login();
  }

  private async logout(): Promise<void> {
    const preparation = this.preparationGeneration;
    const result = await CloudSession.logout();
    if (!this.isCurrentPreparation(preparation)) return;
    SaveState.logoutLocal();
    if (result.refreshTokenRevocation === "confirmed") {
      this.statusText?.setText("Saída local concluída e token de renovação revogado.");
    } else if (result.refreshTokenRevocation === "not-requested") {
      this.statusText?.setText("Saída local concluída.");
    } else {
      this.statusText?.setText(
        "Saída local concluída. Não foi possível confirmar a revogação do token; nenhuma sessão foi mantida neste navegador."
      );
    }
    this.finishPrepare();
  }

  private openMultiplayer(): void {
    if (!CloudSession.current()) {
      this.statusText?.setText("Entre com Google antes do multiplayer.");
      return;
    }
    startLoadingTransition(this, "MultiplayerScene");
  }

  private openControls(campaignSetup: boolean): void {
    startLoadingTransition(this, "ControlsScene", { campaignSetup });
  }

  private continueGame(): void {
    const save = SaveState.load();
    const data = save.get();
    if (data.descentState.pendingRemoval) {
      startLoadingTransition(this, "ReForgeScene");
      return;
    }
    if (data.descentState.epiloguePending) {
      startLoadingTransition(this, "GameScene", {
        phaseId: data.currentPhaseId,
        checkpointX: data.checkpoint.x,
        checkpointY: data.checkpoint.y,
        consolidatedCreditIds: [],
        wallet: 0,
        abilities: data.abilities,
        descent: true,
      } as GameSceneData);
      return;
    }
    if (data.descentState.brokenChain) {
      startLoadingTransition(this, "EpilogueScene", { ending: "hollow" });
      return;
    }
    if (!data.descentState.active && data.descentState.currentStep >= 4 && data.endingReached === null) {
      startLoadingTransition(this, "EpilogueScene", { ending: "flesh" });
      return;
    }
    startLoadingTransition(this, "GameScene", {
      phaseId: data.currentPhaseId,
      checkpointX: data.checkpoint.x,
      checkpointY: data.checkpoint.y,
      consolidatedCreditIds: data.checkpoint.consolidatedCreditIds,
      wallet: data.wallet,
      abilities: data.abilities,
      descent: data.descentState.active,
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
    startLoadingTransition(this, "GateScene");
  }

  private handleCampaignSync(state: CampaignSyncState): void {
    if (state.completedAction === "restore" && state.restoredSave) {
      const restored = SaveState.load().restorePreGateSave(state.restoredSave);
      if (!restored) return;
      const shouldContinue = this.pendingGateContinuation;
      this.pendingGateContinuation = false;
      if (shouldContinue) {
        startLoadingTransition(this, "GateScene");
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
    this.openControls(true);
  }

  private showConfirm(): void {
    this.confirmVisible = true;
    const x = this.panelX + 16;
    const y = this.panelY + this.panelHeight - 104;
    this.confirmPanel = drawTechPanel(this, x, y, this.panelWidth - 32, 84, 8, 0xff718f);
    this.confirmText = this.add.text(
      this.panelX + this.panelWidth / 2,
      y + 42,
      "SUBSTITUIR O SAVE ATUAL?\nENTER / A confirma   ESC / B cancela",
      {
        fontFamily: "Courier New, monospace",
        fontSize: "15px",
        color: "#ff8a8a",
        align: "center",
      },
    ).setOrigin(0.5).setDepth(9).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.confirmNewGame());
  }

  private confirmNewGame(): void {
    this.hideConfirm();
    this.openControls(true);
  }

  private hideConfirm(): void {
    this.confirmVisible = false;
    this.confirmText?.destroy();
    this.confirmPanel?.destroy();
    this.confirmText = undefined;
    this.confirmPanel = undefined;
  }
}

import Phaser from "phaser";
import { AbilityGateKind, LevelData } from "../levels/LevelTypes";
import { TEX } from "../utils/PlaceholderTextures";
import { Player } from "../entities/Player";
import { PLAYER_SLIDE_SIZE } from "../config/GameConfig";

/**
 * Instancia os objetos físicos/visuais de uma fase a partir de um
 * `LevelData` (ver `levels/LevelTypes.ts`).
 *
 * Regras de perigo (seção 14.8 / 14.11):
 *  - Poços (gaps) não têm collider: se o jogador não pular, a gravidade o
 *    derruba e a checagem de "queda" (y acima do limite) mata o jogador.
 *    Água tóxica usa o mesmo poço, apenas com um marcador visual diferente.
 *  - Obstáculos aéreos (cano/fios) são um corpo físico real (não um truque
 *    de "faixa em X"): um retângulo alto, do topo da tela até uma folga
 *    exata acima do chão (a altura de Alex deslizando + margem). Assim a
 *    colisão é honesta com o que se vê na tela - pular não adianta (o cano
 *    é alto demais para pular por cima) e só desliza quem realmente cabe
 *    na folga, sem "parede invisível": ver `overheadGroup` e o overlap
 *    ligado pela GameScene.
 */
const OVERHEAD_CLEARANCE = PLAYER_SLIDE_SIZE.height + 6; // folga acima do chão para o slide passar
const OVERHEAD_TOP_Y = -4000; // bem acima de qualquer altura de pulo possível

export class LevelRuntime {
  readonly groundGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly overheadGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly breakableGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly abilityGateGroup: Phaser.Physics.Arcade.StaticGroup;
  readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  readonly checkpointZones: { id: string; x: number; triggered: boolean; zone: Phaser.GameObjects.Zone }[] = [];
  private readonly breakableObjects: Phaser.GameObjects.Rectangle[] = [];
  private readonly abilityGateObjects: Array<{
    ability: AbilityGateKind;
    object: Phaser.GameObjects.Rectangle;
  }> = [];
  private pressedAttackListener: (breakable: Phaser.GameObjects.GameObject | null) => void = () => undefined;
  private attackListener: (x: number, y: number) => void = () => undefined;
  private dashListener: (x: number, y: number) => void = () => undefined;
  private endGateTriggered = false;

  constructor(
    private scene: Phaser.Scene,
    readonly level: LevelData,
    private consolidatedThisPhase: Set<string>,
    private callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: () => void;
    }
  ) {
    this.groundGroup = scene.physics.add.staticGroup();
    this.overheadGroup = scene.physics.add.staticGroup();
    this.breakableGroup = scene.physics.add.staticGroup();
    this.abilityGateGroup = scene.physics.add.staticGroup();
    this.buildGround();
    this.buildOverheadColliders();
    this.buildHazardVisuals();
    this.buildCredits();
    this.buildCheckpoints();
    this.buildBreakables();
    this.buildAbilityGates();
    this.buildEndGate();
  }

  private buildGround(): void {
    for (const seg of this.level.groundSegments) {
      const width = seg.x1 - seg.x0;
      const thickness = 200;
      const cx = seg.x0 + width / 2;
      const cy = this.level.groundY + thickness / 2;
      const rect = this.scene.add.rectangle(cx, cy, width, thickness, 0x2a2f45).setStrokeStyle(2, 0x4a5578);
      this.scene.physics.add.existing(rect, true);
      this.groundGroup.add(rect);
    }
  }

  private buildOverheadColliders(): void {
    const bottomY = this.level.groundY - OVERHEAD_CLEARANCE;
    const height = bottomY - OVERHEAD_TOP_Y;
    for (const ob of this.level.overheadObstacles) {
      const color = ob.kind === "pipe" ? 0x54607a : 0xffd400;
      const cy = OVERHEAD_TOP_Y + height / 2;
      // Só a parte próxima ao chão fica visível em tela; o restante existe
      // apenas para deixar a colisão honesta (ver comentário da classe).
      const visibleHeight = 160;
      this.scene.add
        .rectangle(ob.x, bottomY - visibleHeight / 2, ob.width, visibleHeight, color, ob.kind === "pipe" ? 1 : 0.85)
        .setStrokeStyle(2, 0xffffff, 0.35)
        .setDepth(5);

      const body = this.scene.add.rectangle(ob.x, cy, ob.width, height, color, 0);
      this.scene.physics.add.existing(body, true);
      this.overheadGroup.add(body);
    }
  }

  private buildHazardVisuals(): void {
    for (const hz of this.level.surfaceHazards) {
      const color = hz.kind === "water" ? 0x00e08a : 0xff3355;
      this.scene.add
        .rectangle(hz.x + hz.width / 2, this.level.groundY + 40, hz.width, 80, color, 0.45)
        .setDepth(1);
    }
  }

  private buildCredits(): void {
    for (const c of this.level.credits) {
      if (this.consolidatedThisPhase.has(c.id)) continue; // já consolidado - não reaparece
      const sprite = this.scene.physics.add.sprite(c.x, c.y, TEX.credit);
      sprite.body!.setAllowGravity(false);
      sprite.setData("creditId", c.id);
      sprite.setData("creditValue", c.value);
      this.scene.tweens.add({
        targets: sprite,
        y: c.y - 8,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.creditSprites.set(c.id, sprite);
    }
  }

  private buildCheckpoints(): void {
    for (const cp of this.level.checkpoints) {
      const zone = this.scene.add.zone(cp.x, this.level.groundY - 40, 40, 120);
      this.scene.physics.add.existing(zone, true);
      this.scene.add
        .rectangle(cp.x, this.level.groundY - 40, 30, 100, 0x36e2ff, 0.25)
        .setStrokeStyle(2, 0x36e2ff);
      this.checkpointZones.push({ id: cp.id, x: cp.x, triggered: false, zone });
    }
  }

  private buildBreakables(): void {
    for (const item of this.level.breakables) {
      const rect = this.scene.add
        .rectangle(item.x, this.level.groundY - item.height / 2, item.width, item.height, 0xb64cff, 0.82)
        .setStrokeStyle(2, 0xe0a8ff)
        .setDepth(4);
      rect.setData("breakableId", item.id);
      this.scene.physics.add.existing(rect, true);
      this.breakableGroup.add(rect);
      this.breakableObjects.push(rect);

      if (item.prompt) {
        this.scene.add
          .text(item.x, this.level.groundY - item.height - 34, item.prompt, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: "#e0a8ff",
            backgroundColor: "#101522",
            padding: { x: 6, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(5);
      }
    }
  }

  private buildAbilityGates(): void {
    for (const item of this.level.abilityGates) {
      const isScanGate = item.ability === "scan";
      const color = isScanGate ? 0x36e2ff : 0xff9f43;
      const rect = this.scene.add
        .rectangle(
          item.x,
          this.level.groundY - item.height / 2,
          item.width,
          item.height,
          color,
          isScanGate ? 0.12 : 0.72
        )
        .setStrokeStyle(2, color, isScanGate ? 0.32 : 0.95)
        .setDepth(4);
      rect.setData("abilityGateId", item.id);
      this.scene.physics.add.existing(rect, true);
      this.abilityGateGroup.add(rect);
      this.abilityGateObjects.push({ ability: item.ability, object: rect });

      if (item.prompt) {
        this.scene.add
          .text(item.x, this.level.groundY - item.height - 34, item.prompt, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: isScanGate ? "#36e2ff" : "#ffbd72",
            backgroundColor: "#101522",
            padding: { x: 6, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(5);
      }
    }
  }

  /**
   * Barreiras de habilidade são obstáculos seguros: bloqueiam Alex até o
   * jogador usar a ação ensinada. Scan revela a passagem; dash rompe a
   * barreira cinética.
   */
  registerAbilityGatePhysics(player: Player): void {
    this.scene.physics.add.collider(player.sprite, this.abilityGateGroup);

    this.dashListener = (x) => {
      this.openNearestAbilityGate("dash", x, 220);
    };
    this.scene.events.on("player-dash-start", this.dashListener);
  }

  setScanActive(active: boolean, playerX: number): void {
    if (!active) return;
    this.openNearestAbilityGate("scan", playerX, 720);
  }

  private openNearestAbilityGate(ability: AbilityGateKind, playerX: number, range: number): void {
    const candidates = this.abilityGateObjects
      .filter(({ ability: gateAbility, object }) =>
        gateAbility === ability &&
        object.active &&
        object.x >= playerX - 24 &&
        object.x <= playerX + range
      )
      .sort((a, b) => Math.abs(a.object.x - playerX) - Math.abs(b.object.x - playerX));

    const target = candidates[0];
    if (!target) return;

    const index = this.abilityGateObjects.indexOf(target);
    if (index >= 0) this.abilityGateObjects.splice(index, 1);
    const body = target.object.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    target.object.setActive(false);

    const message = ability === "scan" ? "PASSAGEM REVELADA" : "BARREIRA ROMPIDA";
    const color = ability === "scan" ? "#36e2ff" : "#ffbd72";
    const label = this.scene.add
      .text(target.object.x, this.level.groundY - target.object.displayHeight - 26, message, {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color,
        backgroundColor: "#101522",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.scene.tweens.add({
      targets: [target.object, label],
      alpha: 0,
      scaleX: 1.15,
      duration: 260,
      onComplete: () => {
        target.object.destroy();
        label.destroy();
      },
    });
  }

  /**
   * Liga a regra do GDD para quebráveis: Alex para ao colidir, recebe uma
   * curta janela de reação e destrói o obstáculo ao usar o ataque.
   */
  registerBreakablePhysics(player: Player): void {
    this.scene.physics.add.collider(player.sprite, this.breakableGroup, (_player, obstacle) => {
      const object = obstacle as Phaser.GameObjects.Rectangle;
      if (!object.active) return;
      // Se o arco do golpe ainda está ativo ao tocar a barricada, o impacto
      // já a destrói; caso contrário começa a janela de reação do GDD.
      if (player.getState() === "attacking") {
        this.destroyBreakable(object, player);
      } else {
        player.enterPressedState(object);
      }
    });

    this.pressedAttackListener = (breakable) => {
      if (!breakable) return;
      this.destroyBreakable(breakable as Phaser.GameObjects.Rectangle, player);
    };

    // O golpe também acerta antes do contato. Assim o jogador pode atacar
    // durante a aproximação, em vez de precisar esperar Alex ficar preso.
    this.attackListener = (x, y) => {
      // A distância é medida até a borda mais próxima da barricada, não
      // até seu centro. A janela de 180 px equivale a ~0,56 s de corrida.
      const attackRange = 180;
      const verticalRange = 80;
      const target = this.breakableObjects.find((object) => {
        const nearEdgeX = object.x - object.displayWidth / 2;
        return object.active &&
          nearEdgeX >= x - 8 &&
          nearEdgeX <= x + attackRange &&
          Math.abs(object.y - y) <= verticalRange;
      });
      if (target) this.destroyBreakable(target, player);
    };
    this.scene.events.on("player-attack-attempt", this.pressedAttackListener);
    this.scene.events.on("player-attack", this.attackListener);
  }

  private destroyBreakable(object: Phaser.GameObjects.Rectangle, player: Player): void {
    const index = this.breakableObjects.indexOf(object);
    if (index === -1 || !object.active) return;

    this.breakableObjects.splice(index, 1);
    const body = object.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    object.setActive(false);
    player.resolvePressedSuccess();
    this.scene.tweens.add({
      targets: object,
      alpha: 0,
      scaleX: 1.18,
      scaleY: 0.75,
      duration: 120,
      onComplete: () => object.destroy(),
    });
  }

  /**
   * Torna visível o gatilho de término dos níveis legados. Antes a Fase 2
   * terminava apenas ao cruzar uma coordenada X invisível, sem comunicar ao
   * jogador que aquele trecho era o fim da prévia.
   */
  private buildEndGate(): void {
    const x = this.level.endGateX;
    const y = this.level.groundY - 110;
    const gate = this.scene.add.image(x, y, TEX.gate).setDepth(4);
    gate.setTint(0x36e2ff);

    const label = this.scene.add
      .text(x, this.level.groundY - 244, "FIM DA PRÉVIA", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#36e2ff",
        backgroundColor: "#101522",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.scene.tweens.add({
      targets: [gate, label],
      alpha: 0.45,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Deve ser chamado a cada frame pela GameScene. */
  update(player: Player): void {
    const px = player.sprite.x;
    const py = player.sprite.y;

    // Créditos (overlap manual simples, robusto para sprites tween-animados)
    this.creditSprites.forEach((sprite, id) => {
      if (!sprite.active) return;
      const dx = sprite.x - px;
      const dy = sprite.y - py + 24;
      if (Math.abs(dx) < 26 && Math.abs(dy) < 34) {
        sprite.setActive(false).setVisible(false);
        if (sprite.body) sprite.body.enable = false;
        this.callbacks.onCreditCollected(id, sprite.getData("creditValue"));
      }
    });

    // Checkpoints
    for (const cp of this.checkpointZones) {
      if (cp.triggered) continue;
      if (Math.abs(px - cp.x) < 26) {
        cp.triggered = true;
        // Nível desenhado à mão tem uma elevação de chão só (`level.groundY`),
        // então o Y do checkpoint é sempre o mesmo - mas o callback agora
        // exige Y explícito pra bater com o formato Tiled (v0.4.0 bugfix de
        // respawn na Fase 1 - ver `TiledLevelRuntime.ts`/`GameScene.ts`).
        this.callbacks.onCheckpoint(cp.id, cp.x, this.level.groundY);
      }
    }

    // Obstáculos aéreos (cano/fios): colisão real, ligada pela GameScene via
    // physics.add.overlap(player.sprite, runtime.overheadGroup, ...).

    // Queda em poço / água tóxica
    if (py > this.level.groundY + 140 && player.getState() !== "dead") {
      player.kill();
      return;
    }

    // Fim da fase
    if (!this.endGateTriggered && px >= this.level.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate();
    }
  }

  destroy(): void {
    this.scene.events.off("player-attack-attempt", this.pressedAttackListener);
    this.scene.events.off("player-attack", this.attackListener);
    this.scene.events.off("player-dash-start", this.dashListener);
    this.breakableObjects.forEach((object) => object.destroy());
    this.breakableObjects.length = 0;
    this.abilityGateObjects.forEach(({ object }) => object.destroy());
    this.abilityGateObjects.length = 0;
    this.creditSprites.forEach((s) => s.destroy());
    this.creditSprites.clear();
  }
}

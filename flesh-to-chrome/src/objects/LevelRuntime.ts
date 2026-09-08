import Phaser from "phaser";
import { LevelData } from "../levels/LevelTypes";
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
  readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  readonly checkpointZones: { id: string; x: number; triggered: boolean; zone: Phaser.GameObjects.Zone }[] = [];
  private endGateTriggered = false;

  constructor(
    private scene: Phaser.Scene,
    readonly level: LevelData,
    private consolidatedThisPhase: Set<string>,
    private callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number) => void;
      onEndGate: () => void;
    }
  ) {
    this.groundGroup = scene.physics.add.staticGroup();
    this.overheadGroup = scene.physics.add.staticGroup();
    this.buildGround();
    this.buildOverheadColliders();
    this.buildHazardVisuals();
    this.buildCredits();
    this.buildCheckpoints();
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
        this.callbacks.onCheckpoint(cp.id, cp.x);
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
    this.creditSprites.forEach((s) => s.destroy());
    this.creditSprites.clear();
  }
}

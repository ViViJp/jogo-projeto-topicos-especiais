import Phaser from "phaser";
import { Player } from "../entities/Player";
import { TEX } from "../utils/PlaceholderTextures";
import {
  TILED_FASE1_MAP_KEY,
  TILED_FASE1_TILESET_KEY,
  TILED_FASE1_TILESET_NAME,
  TILED_FASE1_OFFSET_Y,
} from "../levels/TiledFase1";

export interface TiledCreditObj {
  id: string;
  x: number;
  y: number;
  value: number;
  route: "normal" | "risk";
}

export interface TiledCheckpointObj {
  id: string;
  x: number;
}

/**
 * Instancia a Fase 1 a partir do mapa Tiled real, seguindo
 * `TILED_PHASER_CONTRACT1.md`:
 *
 *  - layer `ground`: colisão física com Alex (contrato §3) - toda célula
 *    não-vazia, usando o próprio grid do tilemap do Phaser (honesto
 *    pixel-a-pixel com a arte, inclusive nas duas elevações da fase: chão
 *    baixo "seguro" e a plataforma elevada "arriscada" que corre por cima
 *    dele em parte do percurso).
 *  - layer `hazards`: só o **visual** do perigo (contrato §3 - "a lógica
 *    fica em objects"). O mapa atual, porém, não tem nenhum objeto da
 *    classe `hazard` ainda (só os 4 tipos formalizados no contrato §5
 *    estão realmente em uso: `spawn`, `phase_end`, `credit`, e agora
 *    também `checkpoint`/`clinic`, que aparecem no mapa mas ainda não
 *    foram formalizados no documento - ver README). A água tóxica que de
 *    fato existe na fase (visível na própria layer `hazards`) usa a
 *    propriedade customizada `hazard=true` definida nos tiles do tileset
 *    (`sewer.tsj`) - mecanismo mais antigo, da v0.2.0, que aparentemente
 *    ainda é o que o mapa exportado usa na prática. Para o jogo não ficar
 *    com 98 tiles de água tóxica puramente decorativos (sem matar
 *    ninguém), este runtime lê essa propriedade. Também aceita um futuro
 *    objeto `hazard`/`kind` na layer `objects`, se/quando o mapa passar a
 *    seguir o contrato à risca nesse ponto - ver `buildObjectHazards()`.
 *  - layer `deco`: puramente visual, sem colisão - mesmo um tile marcado
 *    `solid=true` no tileset (aparece 720× nessa layer) não colide aqui:
 *    o contrato é explícito ("sem colisão por padrão" pra `deco`), e esse
 *    flag no tileset parece só reaproveitamento de metadado de outro
 *    contexto, não uma instrução pra esta layer.
 *  - layer `objects`: nesta exportação do Tiled a "Classe" do objeto vem
 *    no campo `type` do JSON, não em `class` (contrato §8 - "Observação
 *    sobre Tiled JSON" já avisa que isso pode variar por versão/exportação;
 *    confirmado inspecionando o JSON real antes de escrever este parser).
 */
export class TiledLevelRuntime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly hazardsLayer: Phaser.Tilemaps.TilemapLayer | null;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly clinicDestination: string;
  readonly fallDeathY: number;
  readonly credits: TiledCreditObj[] = [];
  readonly checkpoints: TiledCheckpointObj[] = [];
  readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  readonly checkpointTriggered = new Set<string>();

  private endGateTriggered = false;

  constructor(
    private scene: Phaser.Scene,
    private consolidatedThisPhase: Set<string>,
    private callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number) => void;
      onEndGate: (destination: string) => void;
    }
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE1_MAP_KEY });
    const tileset = this.map.addTilesetImage(TILED_FASE1_TILESET_NAME, TILED_FASE1_TILESET_KEY);
    if (!tileset) {
      throw new Error(`Tileset "${TILED_FASE1_TILESET_NAME}" não encontrado no mapa da Fase 1`);
    }

    const offsetY = TILED_FASE1_OFFSET_Y;

    const deco = this.map.createLayer("deco", tileset, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    deco?.setDepth(-10);

    const ground = this.map.createLayer("ground", tileset, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 1 (Tiled): camada "ground" ausente no mapa');
    // -1 (não 0) é o índice de "vazio" nos Tiles internos do Phaser 4 - ver
    // README "Correções e decisões de v0.2.0": excluir só [0] deixa passar
    // TODA célula (inclusive o ar vazio) como colidível, o que zera o
    // cálculo de faces do tilemap e desliga a colisão do jogo inteiro sem
    // nenhum erro no console.
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    const hazards = this.map.createLayer("hazards", tileset, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    if (hazards) {
      hazards.setDepth(1);
      this.classifyHazardTiles(hazards, ground);
      hazards.setCollisionByProperty({ hazard: true });
    }
    this.hazardsLayer = hazards;

    this.lengthPx = this.map.widthInPixels;
    this.fallDeathY = offsetY + this.map.heightInPixels + 150;

    const objects = this.map.getObjectLayer("objects")?.objects ?? [];
    const byType = (t: string) => objects.filter((o) => o.type === t);

    const spawnObj = byType("spawn")[0];
    this.spawn = spawnObj ? { x: spawnObj.x ?? 48, y: (spawnObj.y ?? 0) + offsetY } : { x: 48, y: offsetY };

    const endObj = byType("phase_end")[0];
    this.endGateX = endObj?.x ?? this.lengthPx - 100;

    const clinicObj = byType("clinic")[0];
    this.clinicDestination = this.propString(clinicObj, "next") ?? "ClinicScene";

    for (const o of byType("credit")) {
      const id = this.propString(o, "id") ?? o.name ?? `credit-${o.id}`;
      if (this.consolidatedThisPhase.has(id)) continue; // já consolidado - não reaparece
      const route = this.propString(o, "route") === "risk" ? "risk" : "normal";
      this.credits.push({ id, x: o.x ?? 0, y: (o.y ?? 0) + offsetY, value: 10, route });
    }

    for (const o of byType("checkpoint")) {
      const id = this.propString(o, "id") ?? o.name ?? `checkpoint-${o.id}`;
      this.checkpoints.push({ id, x: o.x ?? 0 });
    }

    this.buildCredits();
    this.buildCheckpoints();
  }

  private propString(o: Phaser.Types.Tilemaps.TiledObject | undefined, name: string): string | undefined {
    if (!o) return undefined;
    const props = (o.properties ?? []) as Array<{ name: string; value: unknown }>;
    const p = props.find((pp) => pp.name === name);
    return typeof p?.value === "string" ? p.value : undefined;
  }

  /**
   * Classifica cada tile com `hazard=true` da layer `hazards` como
   * "overhead" (chão sólido na mesma coluna, logo abaixo) ou "floor" (sem
   * chão embaixo - poço/água sem fundo). Mesma técnica usada na v0.2.0:
   * guarda o resultado em `tile.properties` pro overlap-callback ler em
   * tempo real sem recalcular nada.
   */
  private classifyHazardTiles(
    hazardsLayer: Phaser.Tilemaps.TilemapLayer,
    groundLayer: Phaser.Tilemaps.TilemapLayer
  ): void {
    const { width, height } = this.map;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tile = hazardsLayer.getTileAt(col, row);
        if (!tile || tile.index === -1) continue;
        if (tile.properties?.hazard !== true) continue;

        let hasGroundBelow = false;
        for (let r = row + 1; r < height; r++) {
          const gt = groundLayer.getTileAt(col, r);
          if (gt && gt.index !== -1) {
            hasGroundBelow = true;
            break;
          }
        }
        tile.properties.obstacleKind = hasGroundBelow ? "overhead" : "floor";
      }
    }
  }

  private buildCredits(): void {
    for (const c of this.credits) {
      const sprite = this.scene.physics.add.sprite(c.x, c.y, TEX.credit);
      sprite.body!.setAllowGravity(false);
      sprite.setData("creditId", c.id);
      sprite.setData("creditValue", c.value);
      sprite.setDepth(3);
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
    // Mesmo visual usado no nível desenhado à mão (`LevelRuntime.ts`) -
    // `checkpoint` ainda não está formalizado no contrato (§6), mas já
    // aparece no mapa com `id`, então segue a mesma convenção X-threshold.
    const groundSurfaceY = TILED_FASE1_OFFSET_Y + 16 * 16;
    for (const cp of this.checkpoints) {
      this.scene.add
        .rectangle(cp.x, groundSurfaceY - 40, 30, 100, 0x36e2ff, 0.25)
        .setStrokeStyle(2, 0x36e2ff)
        .setDepth(2);
    }
  }

  /** Colisão/overlap do jogador com o chão e os perigos reais do tilemap. */
  registerPhysics(player: Player): void {
    this.scene.physics.add.collider(player.sprite, this.groundLayer);
    if (this.hazardsLayer) {
      this.scene.physics.add.overlap(player.sprite, this.hazardsLayer, (_obj, tileObj) => {
        const tile = tileObj as unknown as Phaser.Tilemaps.Tile;
        // O callback de overlap contra uma tilemap layer é chamado também
        // pra células vazias dentro da área de consulta (tile.index === -1,
        // sem nenhum tile real ali) - observado depurando esta integração.
        // Sem custo funcional (obstacleKind fica undefined, nenhum dos two
        // ramos abaixo dispara), mas vale sair cedo pra não gastar o
        // acesso a `properties` de um tile que não existe de verdade.
        if (tile.index === -1) return;
        const kind = tile.properties?.obstacleKind;
        if (kind === "overhead") {
          if (player.getState() !== "sliding") player.kill();
        } else if (kind === "floor") {
          player.kill();
        }
      });
    }
  }

  /** Deve ser chamado a cada frame pela GameScene. */
  update(player: Player): void {
    const px = player.sprite.x;
    const py = player.sprite.y;

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

    for (const cp of this.checkpoints) {
      if (this.checkpointTriggered.has(cp.id)) continue;
      if (Math.abs(px - cp.x) < 26) {
        this.checkpointTriggered.add(cp.id);
        this.callbacks.onCheckpoint(cp.id, cp.x);
      }
    }

    // Queda fora do chão real (poço sem tile de hazard visual, ou só cair
    // além do fim do nível).
    if (py > this.fallDeathY && player.getState() !== "dead") {
      player.kill();
      return;
    }

    if (!this.endGateTriggered && px >= this.endGateX) {
      this.endGateTriggered = true;
      this.callbacks.onEndGate(this.clinicDestination);
    }
  }

  destroy(): void {
    this.creditSprites.forEach((s) => s.destroy());
    this.creditSprites.clear();
  }
}

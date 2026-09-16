import Phaser from "phaser";
import { Player } from "../entities/Player";
import { TEX } from "../utils/PlaceholderTextures";
import {
  TILED_FASE1_MAP_KEY,
  TILED_FASE1_TILESET_KEY,
  TILED_FASE1_TILESET_NAME,
  TILED_FASE1_TILESET2_KEY,
  TILED_FASE1_TILESET2_NAME,
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
  y: number;
}

/** `hazard.kind` conhecidos (contrato §5.3 + `electric_wire`, novo na v0.4.0 - ver nota em `buildObjectHazards`). */
type HazardBehavior = "floor" | "overhead";
const HAZARD_KIND_BEHAVIOR: Record<string, HazardBehavior> = {
  toxic_water: "floor",
  electric_wire: "overhead",
};

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
 *
 * v0.4.0 - blockout final da Fase 1 (1050×28, dois tilesets - ver
 * `TiledFase1.ts`). Duas mudanças de mecanismo importantes em relação ao
 * mapa provisório usado desde a v0.3.0:
 *
 *  1. **Dois tilesets por mapa.** `ground`/`hazards`/`deco` continuam no
 *     tileset `tileset-sewer` (primeiro plano); a nova layer `background`
 *     usa exclusivamente `crystal-cave-tiles` (pano de fundo distante,
 *     confirmado pelo range de gid de cada layer no JSON antes de
 *     escrever este código). `createLayer` recebe os dois tilesets numa
 *     lista para toda layer, já que não custa nada e evita surpresa se
 *     uma exportação futura misturar tiles dos dois num mesmo layer (a
 *     própria `hazards` já faz isso aqui, puramente pro visual).
 *  2. **Hazards por objeto de verdade**, finalmente batendo com o
 *     contrato §5.3 ("hazards: só o visual; a lógica fica em objects") -
 *     o mapa antigo não tinha nenhum objeto `hazard` real (só um
 *     `hazard=true` no tileset, mecanismo velho da v0.2.0, mantido aqui
 *     como fallback morto - `classifyHazardTiles`/`setCollisionByProperty`
 *     - caso algum mapa futuro ainda dependa dele). Este mapa tem 6
 *     objetos `hazard` reais: `kind=toxic_water` (4×, poço sem fundo -
 *     mesmo comportamento "floor" de sempre) e `kind=electric_wire` (2×,
 *     NOVO, não documentado no contrato ainda). Pela geometria do objeto
 *     (16px de altura, encostado bem em cima da superfície do chão
 *     principal) e pelo levelDesign.md ("fios elétricos" citados junto
 *     com a mecânica de slide na "sequência de domínio"), tratado como
 *     "overhead" (mesma regra de sempre: mata a não ser que Alex esteja
 *     deslizando) - `HAZARD_KIND_BEHAVIOR` acima. Ver `buildObjectHazards()`.
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
  private readonly hazardZones: Array<{ zone: Phaser.GameObjects.Zone; behavior: HazardBehavior; kind: string }> = [];

  private endGateTriggered = false;

  constructor(
    private scene: Phaser.Scene,
    private consolidatedThisPhase: Set<string>,
    private callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => void;
      onEndGate: (destination: string) => void;
    }
  ) {
    this.map = scene.make.tilemap({ key: TILED_FASE1_MAP_KEY });
    const tileset = this.map.addTilesetImage(TILED_FASE1_TILESET_NAME, TILED_FASE1_TILESET_KEY);
    if (!tileset) {
      throw new Error(`Tileset "${TILED_FASE1_TILESET_NAME}" não encontrado no mapa da Fase 1`);
    }
    const tileset2 = this.map.addTilesetImage(TILED_FASE1_TILESET2_NAME, TILED_FASE1_TILESET2_KEY);
    if (!tileset2) {
      throw new Error(`Tileset "${TILED_FASE1_TILESET2_NAME}" não encontrado no mapa da Fase 1`);
    }
    const allTilesets = [tileset, tileset2];

    const offsetY = TILED_FASE1_OFFSET_Y;

    const background = this.map.createLayer("background", allTilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    background?.setDepth(-20);

    const decoBack = this.map.createLayer("deco-back", allTilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    decoBack?.setDepth(-15);

    const ground = this.map.createLayer("ground", allTilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    if (!ground) throw new Error('Fase 1 (Tiled): camada "ground" ausente no mapa');
    // -1 (não 0) é o índice de "vazio" nos Tiles internos do Phaser 4 - ver
    // README "Correções e decisões de v0.2.0": excluir só [0] deixa passar
    // TODA célula (inclusive o ar vazio) como colidível, o que zera o
    // cálculo de faces do tilemap e desliga a colisão do jogo inteiro sem
    // nenhum erro no console.
    ground.setCollisionByExclusion([-1, 0]);
    ground.setDepth(0);
    this.groundLayer = ground;

    const hazards = this.map.createLayer("hazards", allTilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    if (hazards) {
      hazards.setDepth(1);
      // Mecanismo antigo (v0.2.0), mantido como fallback morto - este mapa
      // não tem nenhum tile com a propriedade `hazard`, então isto vira um
      // no-op inofensivo (ver nota da classe acima).
      this.classifyHazardTiles(hazards, ground);
      hazards.setCollisionByProperty({ hazard: true });
    }
    this.hazardsLayer = hazards;

    const deco = this.map.createLayer("deco", allTilesets, 0, offsetY) as Phaser.Tilemaps.TilemapLayer | null;
    deco?.setDepth(2);

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
      // v0.4.0 bugfix: guardar também o Y do objeto (com offsetY aplicado).
      // O mapa v0.4.0 tem duas elevações de chão (a "profunda" do spawn e a
      // "principal" depois do degrau) - o checkpoint real (`checkpoint_01`,
      // x=2864, y=256 no JSON) fica na elevação principal, bem mais alto na
      // tela que o spawn (y=371 no JSON). Antes desta correção, o runtime só
      // guardava o X e o respawn sempre usava `spawn.y` (calibrado pra
      // elevação profunda) - no mapa antigo (uma elevação só) isso nunca dava
      // problema, mas aqui fazia o personagem reaparecer ~80px ABAIXO do chão
      // de verdade da elevação principal, direto num vão sem fundo, e cair
      // até `fallDeathY`/morrer/reaparecer no mesmo lugar quebrado de novo -
      // um loop de queda que parecia infinito. Ver `GameScene.handleCheckpoint`.
      this.checkpoints.push({ id, x: o.x ?? 0, y: (o.y ?? 0) + offsetY });
    }

    this.buildCredits();
    this.buildCheckpoints();
    this.buildObjectHazards(byType("hazard"), offsetY);
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
    //
    // v0.4.0 bugfix: antes, o retângulo do marcador usava uma constante de
    // chão fixa (linha 21, a elevação "profunda" do spawn) pra QUALQUER
    // checkpoint - correto no mapa antigo (uma elevação só), mas errado
    // aqui: o checkpoint real do mapa v0.4.0 fica na elevação "principal"
    // (linha 16, ~80px mais alto na tela). Agora usa `cp.y`, o Y de verdade
    // do objeto do Tiled (já com `offsetY` aplicado) - mesmo valor usado
    // pelo respawn (`GameScene.handleCheckpoint`), então o marcador visual e
    // o ponto de respawn sempre concordam, em qualquer elevação futura.
    for (const cp of this.checkpoints) {
      this.scene.add
        .rectangle(cp.x, cp.y - 40, 30, 100, 0x36e2ff, 0.25)
        .setStrokeStyle(2, 0x36e2ff)
        .setDepth(2);
    }
  }

  /**
   * v0.4.0 - hazards de verdade como objeto (contrato §5.3), no lugar do
   * mecanismo velho por propriedade de tile (`classifyHazardTiles`, morto
   * neste mapa - ver nota da classe). Cada objeto `hazard` da layer
   * `objects` vira uma zona física invisível (`scene.add.zone` + corpo
   * estático) do tamanho exato do retângulo desenhado no Tiled; o overlap
   * com o jogador é registrado em `registerPhysics()`, junto com o resto
   * da física, não aqui (aqui só cria as zonas - a ordem de criação não
   * pode depender de quando o `Player` existe, que só é instanciado depois
   * deste construtor rodar, em `GameScene.createTiled()`).
   */
  private buildObjectHazards(hazardObjs: Phaser.Types.Tilemaps.TiledObject[], offsetY: number): void {
    for (const o of hazardObjs) {
      const kind = this.propString(o, "kind");
      const x = o.x ?? 0;
      const y = (o.y ?? 0) + offsetY;
      const w = o.width ?? 16;
      const h = o.height ?? 16;
      // Tiled dá x/y do CANTO superior-esquerdo do retângulo; a zone usa centro.
      const zone = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
      this.scene.physics.add.existing(zone, true); // true = corpo estático
      // `kind` desconhecido (fora do contrato §5.3 e de `electric_wire`,
      // novo na v0.4.0) cai em "floor" por segurança - morte instantânea é
      // o comportamento mais chamativo/óbvio de testar do que deixar um
      // hazard sem nenhum efeito passar despercebido em playtest.
      const behavior: HazardBehavior = kind ? (HAZARD_KIND_BEHAVIOR[kind] ?? "floor") : "floor";
      this.hazardZones.push({ zone, behavior, kind: kind ?? "?" });
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
    for (const hz of this.hazardZones) {
      this.scene.physics.add.overlap(player.sprite, hz.zone, () => {
        if (hz.behavior === "overhead") {
          if (player.getState() !== "sliding") player.kill();
        } else {
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
        this.callbacks.onCheckpoint(cp.id, cp.x, cp.y);
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

import Phaser from "phaser";
import { CheckpointMarker } from "./CheckpointMarker";
import { Player } from "../entities/Player";
import { EnemyRuntime } from "./EnemyRuntime";
import { AbilityState } from "../systems/AbilityState";
import { AudioManager, SFX } from "../systems/AudioManager";
import { CREDIT_ANIMATION_KEY, TEX } from "../utils/PlaceholderTextures";
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
  width: number;
}

export { TILED_CHECKPOINT_TEXTURE_KEY } from "./CheckpointMarker";

/** Sprite dedicado ao fio desencapado da Fase 1. */
export const TILED_ELECTRIC_WIRE_TEXTURE_KEY = "hazard-electric-wire-loose";

/** `hazard.kind` oficiais do contrato em `docs/TILED_PHASER_CONTRACT.md`. */
type HazardBehavior = "floor" | "overhead";
const HAZARD_KIND_BEHAVIOR: Record<string, HazardBehavior> = {
  toxic_water: "floor",
  electric_wire: "overhead",
  broken_pipe: "overhead",
};

// Os Rectangle Objects dos canos foram autorados 3 px para dentro nas
// laterais. A margem restaura a largura inteira da arte. A zona lógica sobe
// até o teto do mapa (ver `buildObjectHazards`), impedindo que o cano seja
// vencido com um pulo ou usado como plataforma: a única travessia aceita é
// por baixo, enquanto Alex está no estado de slide.
const BROKEN_PIPE_HITBOX_PADDING_X = 3;

// GIDs do fio provisório de 32 x 16 px que ainda está desenhado na layer
// `hazards` do mapa. O runtime o oculta quando instancia o sprite novo nas
// mesmas coordenadas dos objetos `electric_wire`.
const LEGACY_ELECTRIC_WIRE_GIDS = new Set([733, 734]);

/**
 * Instancia a Fase 1 a partir do mapa Tiled real, seguindo
 * `docs/TILED_PHASER_CONTRACT.md`:
 *
 *  - layer `ground`: colisão física com Alex (contrato §3) - toda célula
 *    não-vazia, usando o próprio grid do tilemap do Phaser (honesto
 *    pixel-a-pixel com a arte, inclusive nas duas elevações da fase: chão
 *    baixo "seguro" e a plataforma elevada "arriscada" que corre por cima
 *    dele em parte do percurso).
 *  - layer `hazards`: só o **visual** do perigo (contrato §3 - "a lógica
 *    fica em objects"). O mapa atual usa objetos `hazard` reais para água
 *    tóxica, fios elétricos e cano rompido; `buildObjectHazards()` cria a
 *    zona física de cada um. O mecanismo antigo por propriedade de tile é
 *    mantido apenas como fallback de compatibilidade.
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
 * v0.4.0+ - blockout expandido da Fase 1 (1900×28, dois tilesets - ver
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
 *     `hazard=true` no tileset, mecanismo velho da v0.2.0). A classificação
 *     legada ainda pode separar esses tiles do chão, mas a layer visual nunca
 *     recebe colisão: a lógica letal fica sempre nos Rectangle Objects. O mapa atual usa
 *     objetos `hazard` reais. `toxic_water` usa o comportamento "floor"
 *     (morte em qualquer estado); `electric_wire` e `broken_pipe` usam
 *     "overhead" (matam a não ser que Alex esteja deslizando).
 */
export class TiledLevelRuntime {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly groundLayer: Phaser.Tilemaps.TilemapLayer;
  readonly hazardsLayer: Phaser.Tilemaps.TilemapLayer | null;
  readonly lengthPx: number;
  readonly spawn: { x: number; y: number };
  readonly endGateX: number;
  readonly clinicDestination: string;
  readonly clinicImplant?: keyof AbilityState;
  readonly fallDeathY: number;
  readonly credits: TiledCreditObj[] = [];
  readonly checkpoints: TiledCheckpointObj[] = [];
  readonly creditSprites = new Map<string, Phaser.Physics.Arcade.Sprite>();
  readonly checkpointTriggered = new Set<string>();
  private readonly checkpointMarkers = new Map<string, CheckpointMarker>();
  private readonly hazardZones: Array<{ zone: Phaser.GameObjects.Zone; behavior: HazardBehavior; kind: string }> = [];
  private readonly electricWireVisuals: Phaser.GameObjects.Image[] = [];
  private readonly electricWireTweens: Phaser.Tweens.Tween[] = [];
  private enemyRuntime?: EnemyRuntime;
  private playerRef?: Player;
  private epilogueCorridor = false;
  private electricWireLoopActive = false;
  private hazardWaterLoopActive = false;

  private endGateTriggered = false;

  constructor(
    private scene: Phaser.Scene,
    private consolidatedThisPhase: Set<string>,
    private callbacks: {
      onCreditCollected: (id: string, value: number) => void;
      onCheckpoint: (id: string, x: number, y: number) => boolean | void;
      onEndGate: (destination: string, implant?: keyof AbilityState) => void;
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
    // O parser do Phaser lê o "olho" (visible) do Tiled mas não o aplica à
    // TilemapLayer. Desde o fundo com parallax (image layers, ver
    // ParallaxBackdrop) o antigo pano de fundo da caverna fica oculto no
    // Tiled; respeitar a flag permite religá-lo pelo editor sem tocar no código.
    background?.setVisible(background.layer.visible);

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
      // Esta layer é estritamente visual. Limpar toda colisão impede que os
      // canos virem plataformas onde Alex consegue pousar; a letalidade fica
      // exclusivamente nos Rectangle Objects de `hazard`.
      hazards.setCollisionByExclusion([], false);
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
    const clinicImplant = this.propString(clinicObj, "implant");
    this.clinicImplant = clinicImplant && ["legs", "arms", "eyes", "thrusters"].includes(clinicImplant)
      ? clinicImplant as keyof AbilityState
      : undefined;

    for (const o of byType("credit")) {
      const id = this.propString(o, "id") ?? o.name ?? `credit-${o.id}`;
      const route = this.propString(o, "route") === "risk" ? "risk" : "normal";
      this.credits.push({ id, x: o.x ?? 0, y: (o.y ?? 0) + offsetY, value: 10, route });
    }

    for (const o of byType("checkpoint")) {
      const id = this.propString(o, "id") ?? o.name ?? `checkpoint-${o.id}`;
      const x = o.x ?? 0;
      // v0.4.1 bugfix (2ª rodada): a v0.4.0 corrigiu a queda infinita usando
      // o Y AUTORADO do objeto `checkpoint` no Tiled (`(o.y ?? 0) + offsetY`)
      // - só que esse valor não é confiável: é só onde o level designer
      // clicou pra colocar o marcador, não necessariamente a superfície real
      // do chão. Conferido no mapa real: `checkpoint_01` tem y=256 (linha 16,
      // tela y=480), mas o chão de verdade na coluna x=2864 do próprio
      // objeto está na linha 21 (tela y=560) - 80px mais abaixo. Resultado:
      // o personagem reaparecia flutuando 80px acima do chão e caía até
      // pousar - visualmente "checkpoint flutuante, personagem cai" (bem
      // menor que a queda infinita original, mas ainda um bug real).
      //
      // Corrigido de vez lendo a altura do chão DIRETO da layer `ground`
      // (mesma fonte de verdade que a física usa pra colisão) na coluna X
      // do checkpoint, em vez de confiar em qualquer coordenada Y autorada
      // no editor - `groundSurfaceYAt()` abaixo. Reaproveitado também pelo
      // marcador visual (`buildCheckpoints()`), que tinha o mesmo problema.
      this.checkpoints.push({
        id,
        x,
        y: this.groundSurfaceYAt(x, ground, offsetY),
        width: o.width ?? 32,
      });
    }

    this.buildCredits();
    this.buildCheckpoints();
    const hazardObjects = byType("hazard");
    this.buildObjectHazards(hazardObjects, offsetY);
    this.buildElectricWireVisuals(hazardObjects, offsetY);
  }

  private propString(o: Phaser.Types.Tilemaps.TiledObject | undefined, name: string): string | undefined {
    if (!o) return undefined;
    const props = (o.properties ?? []) as Array<{ name: string; value: unknown }>;
    const p = props.find((pp) => pp.name === name);
    return typeof p?.value === "string" ? p.value : undefined;
  }

  /**
   * Converte um recorte final da Fase 1 em corredor contemplativo. Alex já
   * não possui implantes neste ponto, então o epílogo não pode reutilizar os
   * vãos, plataformas elevadas ou perigos da subida.
   */
  prepareDescentEpilogue(startX: number, endX: number): void {
    this.epilogueCorridor = true;
    const firstCol = Phaser.Math.Clamp(
      Math.floor(startX / this.map.tileWidth),
      0,
      this.map.width - 1,
    );
    const lastCol = Phaser.Math.Clamp(
      Math.ceil((endX + 96) / this.map.tileWidth),
      firstCol,
      this.map.width - 1,
    );
    const patternWidth = 6;
    const patternStartCol = Math.max(0, firstCol - patternWidth);
    const groundRows = Array.from({ length: this.map.height }, (_, row) => {
      const pattern = Array.from({ length: patternWidth }, (_, offset) => (
        this.groundLayer.getTileAt(patternStartCol + offset, row)?.index ?? -1
      ));
      return pattern.every((index) => index > 0) ? { row, pattern } : null;
    }).filter((entry): entry is { row: number; pattern: number[] } => entry !== null);
    const groundRowSet = new Set(groundRows.map((entry) => entry.row));

    for (let col = firstCol; col <= lastCol; col += 1) {
      for (let row = 0; row < this.map.height; row += 1) {
        if (!groundRowSet.has(row)) this.groundLayer.removeTileAt(col, row);
      }
      for (const template of groundRows) {
        const patternIndex = (col - firstCol) % patternWidth;
        this.groundLayer.putTileAt(template.pattern[patternIndex], col, template.row);
      }
    }
    this.groundLayer.setCollisionByExclusion([-1, 0]);

    if (this.hazardsLayer) {
      for (let col = firstCol; col <= lastCol; col += 1) {
        for (let row = 0; row < this.map.height; row += 1) {
          this.hazardsLayer.removeTileAt(col, row);
        }
      }
    }
    for (const hazard of this.hazardZones) {
      const body = hazard.zone.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = false;
      hazard.zone.setActive(false);
    }
    this.electricWireTweens.forEach((tween) => tween.remove());
    this.electricWireVisuals.forEach((visual) => visual.setVisible(false));
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

  /**
   * Y (mundo, já com `offsetY`) da superfície de chão real na coluna do X
   * dado - lê direto da layer `ground` (a mesma fonte usada pra colisão
   * física, `setCollisionByExclusion`), em vez de confiar em qualquer
   * coordenada Y autorada num objeto do Tiled. Motivo: objetos de marcação
   * (como `checkpoint`) podem estar posicionados um pouco acima/abaixo da
   * superfície de verdade no editor - inofensivo pra um marcador puramente
   * visual, mas errado pra decidir onde o personagem deve pisar ao
   * reaparecer (bug corrigido na v0.4.1, 2ª rodada - ver o loop de
   * `checkpoint` acima). Varre de cima pra baixo e para no primeiro tile
   * não-vazio da coluna (mesma técnica de `classifyHazardTiles`).
   */
  private groundSurfaceYAt(worldX: number, groundLayer: Phaser.Tilemaps.TilemapLayer, offsetY: number): number {
    const col = Math.floor(worldX / this.map.tileWidth);
    for (let row = 0; row < this.map.height; row++) {
      const tile = groundLayer.getTileAt(col, row);
      if (tile && tile.index !== -1) {
        return offsetY + row * this.map.tileHeight;
      }
    }
    // Coluna sem nenhum chão (ex.: X cai bem em cima de um vão) - não
    // deveria acontecer com um checkpoint de verdade, mas cai pro Y do
    // spawn em vez de travar/retornar algo indefinido.
    return this.spawn.y;
  }

  private buildCredits(): void {
    for (const c of this.credits) {
      if (this.consolidatedThisPhase.has(c.id)) continue;
      const sprite = this.scene.physics.add.sprite(c.x, c.y, TEX.credit);
      sprite.anims.play(CREDIT_ANIMATION_KEY);
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
    // v0.4.0/v0.4.1 bugfix: o marcador (e o respawn) já passaram por duas
    // rodadas de correção - primeiro usava uma constante de chão fixa
    // (linha 21) pra QUALQUER checkpoint, depois passou a confiar no Y
    // autorado do objeto Tiled (também impreciso, ~80px de erro no
    // checkpoint real do mapa). Agora `cp.y` vem de `groundSurfaceYAt()`,
    // lendo a altura real da layer `ground` - a mesma fonte que a física
    // usa pra colisão, então o marcador visual e o ponto de respawn sempre
    // concordam com o chão de verdade, em qualquer elevação.
    for (const cp of this.checkpoints) {
      this.checkpointMarkers.set(
        cp.id,
        new CheckpointMarker(this.scene, cp.x + cp.width / 2, cp.y, 2),
      );
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
      const isBrokenPipe = kind === "broken_pipe";
      const hitboxX = isBrokenPipe ? x - BROKEN_PIPE_HITBOX_PADDING_X : x;
      const hitboxY = isBrokenPipe ? offsetY : y;
      const hitboxWidth = isBrokenPipe ? w + BROKEN_PIPE_HITBOX_PADDING_X * 2 : w;
      const hitboxHeight = isBrokenPipe ? y + h - offsetY : h;
      // Tiled dá x/y do CANTO superior-esquerdo do retângulo; a zone usa centro.
      const zone = this.scene.add.zone(
        hitboxX + hitboxWidth / 2,
        hitboxY + hitboxHeight / 2,
        hitboxWidth,
        hitboxHeight,
      );
      this.scene.physics.add.existing(zone, true); // true = corpo estático
      // `kind` desconhecido cai em "floor" por segurança - morte instantânea é
      // o comportamento mais chamativo/óbvio de testar do que deixar um
      // hazard sem nenhum efeito passar despercebido em playtest.
      const behavior: HazardBehavior = kind ? (HAZARD_KIND_BEHAVIOR[kind] ?? "floor") : "floor";
      this.hazardZones.push({ zone, behavior, kind: kind ?? "?" });
    }
  }

  /**
   * Substitui o cabo provisório do tileset pelo sprite dedicado, usando os
   * próprios Rectangle Objects do Tiled como fonte de posição. A hitbox
   * continua sendo o retângulo autorado no mapa; o brilho pode ultrapassar
   * levemente essa área, mas a parte física do cabo permanece alinhada com
   * ela e a regra de atravessar deslizando não muda.
   */
  private buildElectricWireVisuals(
    hazardObjs: Phaser.Types.Tilemaps.TiledObject[],
    offsetY: number,
  ): void {
    for (const o of hazardObjs) {
      if (this.propString(o, "kind") !== "electric_wire") continue;

      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const w = o.width ?? 32;
      const h = o.height ?? 16;

      // Remove somente os dois tiles do cabo antigo. Outros hazards que
      // eventualmente compartilhem a mesma região da layer são preservados.
      if (this.hazardsLayer) {
        const firstCol = Math.floor(x / this.map.tileWidth);
        const lastCol = Math.ceil((x + w) / this.map.tileWidth) - 1;
        const firstRow = Math.floor(y / this.map.tileHeight);
        const lastRow = Math.ceil((y + h) / this.map.tileHeight) - 1;
        for (let row = firstRow; row <= lastRow; row++) {
          for (let col = firstCol; col <= lastCol; col++) {
            const tile = this.hazardsLayer.getTileAt(col, row);
            if (tile && LEGACY_ELECTRIC_WIRE_GIDS.has(tile.index)) tile.setAlpha(0);
          }
        }
      }

      const visual = this.scene.add
        .image(x + w / 2, y + offsetY + h, TILED_ELECTRIC_WIRE_TEXTURE_KEY)
        // O arquivo mantém uma margem transparente curta para o halo
        // elétrico. O ponto de apoio em 84% encosta o corpo do cabo no chão.
        .setOrigin(0.5, 0.84)
        .setDisplaySize(Math.max(48, w * 1.5), Math.max(32, h * 2))
        .setDepth(3);
      this.electricWireVisuals.push(visual);

      // Uma oscilação curta deixa a descarga legível sem alterar colisão.
      this.electricWireTweens.push(this.scene.tweens.add({
        targets: visual,
        alpha: { from: 0.86, to: 1 },
        duration: 150 + ((o.id ?? 0) % 4) * 35,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }));
    }
  }

  /** Colisão/overlap do jogador com o chão e os perigos reais do tilemap. */
  registerPhysics(player: Player): void {
    this.playerRef = player;
    // `ground` representa somente terreno e plataformas. Contatos no topo,
    // nas laterais, por baixo ou nos cantos devem resolver a separação física
    // sem causar dano. Perigos letais possuem zonas próprias abaixo; usar os
    // flags `blocked.left/right/up` aqui transformava qualquer plataforma em
    // hazard e matava Alex até em colisões normais de borda.
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
      if (hz.kind === "broken_pipe") {
        // O cano baixo precisa detectar também o contato exato de pouso. Um
        // `overlap` pode não disparar quando o Arcade Physics separa o corpo
        // na mesma atualização e o deixa apenas encostado no topo. A colisão
        // condicional fecha essa brecha: em pé/no ar ela mata imediatamente;
        // durante o slide o process callback devolve false e Alex atravessa
        // o volume sem ganhar apoio sólido.
        this.scene.physics.add.collider(
          player.sprite,
          hz.zone,
          () => player.kill(),
          () => player.getState() !== "sliding",
        );
        continue;
      }

      this.scene.physics.add.overlap(player.sprite, hz.zone, () => {
        if (hz.behavior === "overhead") {
          if (player.getState() !== "sliding") player.kill();
        } else {
          player.kill();
        }
      });
    }

    // Fase 1 também usa o runtime real de inimigos para permitir o teste
    // completo de ataque, scan e colisão fatal dentro do mapa existente.
    this.enemyRuntime = new EnemyRuntime(this.scene, player, this.getEnemyObjects(), TILED_FASE1_OFFSET_Y);
    this.enemyRuntime.registerPlayerCollision(() => player.kill());
  }

  private getEnemyObjects(): Phaser.Types.Tilemaps.TiledObject[] {
    if (this.epilogueCorridor) return [];
    return this.map.getObjectLayer("objects")?.objects.filter((object) => object.type === "enemy") ?? [];
  }

  setScanActive(active: boolean): void {
    if (active) this.enemyRuntime?.scan(this.playerRef?.sprite.x ?? 0);
    else this.enemyRuntime?.stopScan();
  }

  hideCredits(): void {
    this.creditSprites.forEach((sprite) => {
      const body = sprite.body as Phaser.Physics.Arcade.Body | null;
      if (body) body.enable = false;
      sprite.setActive(false).setVisible(false);
    });
  }

  /** Deve ser chamado a cada frame pela GameScene. */
  update(player: Player): void {
    this.enemyRuntime?.update();
    const px = player.sprite.x;
    const py = player.sprite.y;
    this.updateEnvironmentalAudio(player, px);

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
        const withFeedback = this.callbacks.onCheckpoint(cp.id, cp.x + cp.width / 2, cp.y) !== false;
        this.checkpointMarkers.get(cp.id)?.activate(withFeedback);
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
      this.callbacks.onEndGate(this.clinicDestination, this.clinicImplant);
    }
  }

  private updateEnvironmentalAudio(player: Player, playerX: number): void {
    const audibleRange = Math.max(420, this.scene.cameras.main.width * 0.55);
    const canHearHazards = !this.epilogueCorridor && player.getState() !== "dead";
    const nearKind = (kind: string): boolean => canHearHazards && this.hazardZones.some((hazard) => (
      hazard.kind === kind && Math.abs(hazard.zone.x - playerX) <= audibleRange
    ));
    const cameraView = this.scene.cameras.main.worldView;
    const visibleKind = (kind: string): boolean => canHearHazards && this.hazardZones.some((hazard) => {
      if (hazard.kind !== kind) return false;
      const halfWidth = hazard.zone.displayWidth / 2;
      const visualMargin = 32;
      return hazard.zone.x + halfWidth + visualMargin >= cameraView.left
        && hazard.zone.x - halfWidth - visualMargin <= cameraView.right;
    });

    // O estalo acompanha o fio na tela. A regra anterior usava um raio de
    // centenas de pixels em torno de Alex e mantinha o loop mesmo depois de
    // o sprite desaparecer pela esquerda da câmera.
    const electricWireAudible = visibleKind("electric_wire");
    if (electricWireAudible !== this.electricWireLoopActive) {
      this.electricWireLoopActive = electricWireAudible;
      if (electricWireAudible) {
        AudioManager.startLoop(this.scene, SFX.electricWire, { volume: 0.22 });
      } else {
        AudioManager.stopLoop(SFX.electricWire);
      }
    }

    const hazardWaterAudible = nearKind("toxic_water");
    if (hazardWaterAudible !== this.hazardWaterLoopActive) {
      this.hazardWaterLoopActive = hazardWaterAudible;
      if (hazardWaterAudible) {
        AudioManager.startLoop(this.scene, SFX.hazardWater, { volume: 0.2 });
      } else {
        AudioManager.stopLoop(SFX.hazardWater);
      }
    }
  }

  destroy(): void {
    AudioManager.stopLoop(SFX.electricWire);
    AudioManager.stopLoop(SFX.hazardWater);
    this.electricWireLoopActive = false;
    this.hazardWaterLoopActive = false;
    this.enemyRuntime?.destroy();
    this.electricWireTweens.forEach((tween) => tween.remove());
    this.electricWireVisuals.forEach((visual) => visual.destroy());
    this.hazardZones.forEach((hz) => hz.zone.destroy());
    this.creditSprites.forEach((s) => s.destroy());
    this.checkpointMarkers.forEach((marker) => marker.destroy());
    this.creditSprites.clear();
  }
}

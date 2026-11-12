/**
 * Leitura das camadas de fundo (parallax) e do clima de ambiente a partir
 * do JSON exportado pelo Tiled. Sem dependência do Phaser (testável no Node
 * por `scripts/test-gameplay-flow.mjs`); quem desenha é `ParallaxBackdrop`.
 *
 * Contrato (ver docs/TILED_PHASER_CONTRACT.md §3.1):
 *
 * - Toda **Image Layer** do mapa vira uma camada de fundo, desenhada atrás
 *   de todas as tile layers, na mesma ordem do painel do Tiled (a mais
 *   baixa no painel fica mais ao fundo).
 * - `Parallax Factor X` (parallaxx) = velocidade relativa à câmera:
 *   0 = parada no céu, 1 = anda junto com o mapa.
 * - `Repeat X` (repeatx) = repete a imagem na horizontal (o normal para
 *   fundos de fase). Sem repetição, a imagem aparece uma vez em `Offset X`.
 * - `Offset Y` (offsety) é medido no espaço do mapa, como no Tiled; o jogo
 *   soma o deslocamento vertical da fase (ex.: 224 px na Fase 1), então o
 *   que aparece no Tiled é o que aparece no jogo. Valores negativos
 *   cobrem a área acima do mapa.
 * - `Opacity` e `Visible` são respeitados.
 * - Propriedade opcional `drift_x` (float, px/s): deslocamento contínuo
 *   próprio da camada (névoa, fumaça, água correndo). Negativo = para a
 *   esquerda.
 * - Propriedade opcional `appear_x` (float, px do mapa): a camada só surge
 *   (fade-in) depois que a câmera passa desse X. Serve para trocar o fundo
 *   num trecho da fase (ex.: final contemplativo da Fase 5).
 *
 * Clima (propriedades do MAPA, Map > Map Properties):
 * - `ambient` (string): `drips` (gotas), `embers` (fagulhas), `rain` (chuva)
 *   ou `motes` (partículas de luz flutuando).
 * - `ambient_density` (float, opcional, padrão 1): multiplica a quantidade.
 */

export type AmbientKind = "drips" | "embers" | "rain" | "motes";

export interface BackdropLayerSpec {
  name: string;
  /** Nome do arquivo de imagem (sem pastas), chave de BACKDROP_IMAGE_URLS. */
  imageName: string;
  parallaxX: number;
  offsetX: number;
  /** Y na tela (o motor não rola a câmera na vertical). */
  y: number;
  alpha: number;
  repeatX: boolean;
  driftX: number;
  /** X do mapa a partir do qual a camada surge; ausente = sempre visível. */
  appearX?: number;
}

export interface AmbientSpec {
  kind: AmbientKind;
  density: number;
}

interface TiledProperty {
  name: string;
  value: unknown;
}

interface TiledLayerLike {
  type?: string;
  name?: string;
  image?: string;
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  parallaxx?: number;
  repeatx?: boolean;
  visible?: boolean;
  properties?: TiledProperty[];
}

export interface TiledMapLike {
  layers?: TiledLayerLike[];
  properties?: TiledProperty[];
}

const AMBIENT_KINDS: readonly AmbientKind[] = ["drips", "embers", "rain", "motes"];

function propertyValue(properties: TiledProperty[] | undefined, name: string): unknown {
  return properties?.find((property) => property.name === name)?.value;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1];
}

/**
 * Image layers do mapa, de trás para frente, já convertidas para tela.
 * `mapOffsetY` é o deslocamento vertical com que a fase posiciona o mapa.
 */
export function readBackdropLayers(map: TiledMapLike, mapOffsetY: number): BackdropLayerSpec[] {
  const specs: BackdropLayerSpec[] = [];
  for (const layer of map.layers ?? []) {
    if (layer.type !== "imagelayer" || !layer.image || layer.visible === false) continue;
    const appearX = propertyValue(layer.properties, "appear_x");
    specs.push({
      name: layer.name ?? fileName(layer.image),
      imageName: fileName(layer.image),
      parallaxX: finiteOr(layer.parallaxx, 1),
      offsetX: finiteOr(layer.offsetx, 0),
      y: mapOffsetY + finiteOr(layer.offsety, 0),
      alpha: Math.min(1, Math.max(0, finiteOr(layer.opacity, 1))),
      repeatX: layer.repeatx === true,
      driftX: finiteOr(propertyValue(layer.properties, "drift_x"), 0),
      appearX: typeof appearX === "number" && Number.isFinite(appearX) ? appearX : undefined,
    });
  }
  return specs;
}

/** Clima configurado nas propriedades do mapa, ou `undefined` se não houver. */
export function readAmbient(map: TiledMapLike): AmbientSpec | undefined {
  const kind = propertyValue(map.properties, "ambient");
  if (typeof kind !== "string" || !AMBIENT_KINDS.includes(kind as AmbientKind)) return undefined;
  const density = Math.min(3, Math.max(0, finiteOr(propertyValue(map.properties, "ambient_density"), 1)));
  return { kind: kind as AmbientKind, density };
}

/**
 * Deslocamento horizontal da textura de uma camada repetida, em pixels
 * inteiros (o jogo usa `pixelArt`/`roundPixels`; posição fracionária
 * tremeria). Sempre no intervalo [0, textureWidth).
 */
export function repeatedLayerScroll(
  cameraScrollX: number,
  spec: Pick<BackdropLayerSpec, "parallaxX" | "offsetX">,
  driftPx: number,
  textureWidth: number,
): number {
  const raw = Math.round(cameraScrollX * spec.parallaxX - spec.offsetX - driftPx);
  return ((raw % textureWidth) + textureWidth) % textureWidth;
}

/** Distância de câmera (px) que uma camada com `appear_x` leva para surgir por completo: ~3 s de corrida. */
const APPEAR_FADE_PX = 960;

/** Opacidade relativa (0 a 1) de uma camada com `appear_x`; 1 se ela não usa a propriedade. */
export function appearAlpha(cameraScrollX: number, appearX: number | undefined): number {
  if (appearX === undefined) return 1;
  return Math.min(1, Math.max(0, (cameraScrollX - appearX) / APPEAR_FADE_PX));
}

/** Posição X na tela de um ponto do "mundo de parallax" com repetição a cada `width`. */
export function wrapScreenX(worldX: number, cameraScrollX: number, parallaxX: number, width: number): number {
  const x = worldX - cameraScrollX * parallaxX;
  return ((x % width) + width) % width;
}

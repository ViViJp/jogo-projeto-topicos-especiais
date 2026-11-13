import Phaser from "phaser";
import { BACKDROP_IMAGE_URLS, backdropTextureKey } from "../levels/BackdropAssets";

const MENU_BACKDROP_IMAGES = [
  "urbano-ceu.png",
  "urbano-predios-longe.png",
  "urbano-predios-perto.png",
  "urbano-smog.png",
  "urbano-rodape.png",
] as const;

/** Reaproveita as camadas da Fase 3 sem carregar o mapa inteiro no menu. */
export function preloadMenuBackdrop(scene: Phaser.Scene): void {
  for (const imageName of MENU_BACKDROP_IMAGES) {
    const key = backdropTextureKey(imageName);
    if (!scene.textures.exists(key)) scene.load.image(key, BACKDROP_IMAGE_URLS[imageName].href);
  }
}

interface AnimatedLayer {
  object: Phaser.GameObjects.TileSprite;
  speed: number;
}

/** Fundo leve compartilhado pelo menu e pela tela de controles. */
export class MenuBackdrop {
  private readonly layers: AnimatedLayer[] = [];
  private readonly smog: Phaser.GameObjects.TileSprite;
  private readonly lights: Phaser.GameObjects.Rectangle[] = [];
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;
    const layer = (
      imageName: typeof MENU_BACKDROP_IMAGES[number],
      y: number,
      displayHeight: number,
      depth: number,
      speed: number,
      alpha = 1,
    ): Phaser.GameObjects.TileSprite => {
      const object = scene.add
        .tileSprite(0, y, width, displayHeight, backdropTextureKey(imageName))
        .setOrigin(0, 0)
        .setDepth(depth)
        .setAlpha(alpha);
      this.layers.push({ object, speed });
      return object;
    };

    layer("urbano-ceu.png", 0, height, -50, 1.2, 0.92);
    layer("urbano-predios-longe.png", Math.max(0, height - 500), 372, -49, 3.2, 0.8);
    layer("urbano-predios-perto.png", Math.max(0, height - 418), 418, -48, 6.5, 0.9);
    this.smog = layer("urbano-smog.png", Math.max(0, height - 270), 220, -47, 10, 0.4);
    layer("urbano-rodape.png", Math.max(0, height - 144), 144, -46, 8, 0.95);

    // Pequenos letreiros distantes: custo baixo e leitura de cidade viva.
    const lightColors = [0x31f1ff, 0xff71ce, 0xffd37c];
    for (let index = 0; index < 9; index += 1) {
      const light = scene.add
        .rectangle(
          width * 0.45 + (index * width * 0.061) % (width * 0.52),
          height - 350 + (index % 4) * 47,
          index % 3 === 0 ? 16 : 7,
          index % 2 === 0 ? 4 : 10,
          lightColors[index % lightColors.length],
          0.42,
        )
        .setDepth(-45);
      this.lights.push(light);
    }

    // Degradê escuro: mais forte à esquerda, onde ficam título e opções.
    scene.add.graphics()
      .setDepth(-40)
      .fillGradientStyle(0x03050a, 0x03050a, 0x070916, 0x070916, 0.94, 0.24, 0.96, 0.5)
      .fillRect(0, 0, width, height);
    scene.add.rectangle(0, height - 150, width, 150, 0x03050a, 0.42)
      .setOrigin(0, 0)
      .setDepth(-39);
  }

  update(deltaMs: number): void {
    const delta = Math.min(deltaMs, 50) / 1000;
    this.elapsedMs += Math.min(deltaMs, 50);
    for (const layer of this.layers) layer.object.tilePositionX += layer.speed * delta;
    this.smog.setAlpha(0.34 + Math.sin(this.elapsedMs * 0.0007) * 0.08);
    this.lights.forEach((light, index) => {
      const pulse = Math.sin(this.elapsedMs * (0.0017 + index * 0.00009) + index * 1.9);
      light.setAlpha(pulse > 0.58 ? 0.8 : 0.22);
    });
  }
}

/** Painel de oito lados com recortes industriais e detalhes ciano. */
export function drawTechPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  depth = 5,
  accent = 0x36e2ff,
): Phaser.GameObjects.Graphics {
  const cut = 14;
  const graphics = scene.add.graphics().setDepth(depth);
  graphics.fillStyle(0x070b14, 0.9);
  graphics.lineStyle(2, accent, 0.78);
  graphics.beginPath();
  graphics.moveTo(x + cut, y);
  graphics.lineTo(x + width - cut, y);
  graphics.lineTo(x + width, y + cut);
  graphics.lineTo(x + width, y + height - cut);
  graphics.lineTo(x + width - cut, y + height);
  graphics.lineTo(x + cut, y + height);
  graphics.lineTo(x, y + height - cut);
  graphics.lineTo(x, y + cut);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.lineStyle(3, accent, 0.9);
  graphics.lineBetween(x + 24, y, x + Math.min(120, width * 0.32), y);
  graphics.lineBetween(x + width - 74, y + height, x + width - 24, y + height);
  return graphics;
}

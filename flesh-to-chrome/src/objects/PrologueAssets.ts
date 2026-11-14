import Phaser from "phaser";

export const PROLOGUE_FAMILY_KEY = "prologue-family";
export const PROLOGUE_FATHER_BEFORE_KEY = "prologue-father-before";
export const PROLOGUE_NEWSPAPER_KEY = "prologue-newspaper";

const PROLOGUE_ASSETS = [
  {
    key: PROLOGUE_FAMILY_KEY,
    url: new URL("../assets/narrative/prologue/familia.png", import.meta.url),
  },
  {
    key: PROLOGUE_FATHER_BEFORE_KEY,
    url: new URL("../assets/narrative/father/pai-antes.png", import.meta.url),
  },
  {
    key: PROLOGUE_NEWSPAPER_KEY,
    url: new URL("../assets/narrative/prologue/jornal-pai.png", import.meta.url),
  },
] as const;

/**
 * Enfileira somente as imagens narrativas ainda ausentes e retorna quantas
 * precisam ser transferidas. Isso permite aquecer o prólogo enquanto a tela
 * de controles continua visível, sem repetir downloads ao iniciar a cena.
 */
export function queuePrologueAssets(scene: Phaser.Scene): number {
  let queued = 0;
  for (const asset of PROLOGUE_ASSETS) {
    if (scene.textures.exists(asset.key)) continue;
    scene.load.image(asset.key, asset.url.href);
    queued += 1;
  }
  return queued;
}

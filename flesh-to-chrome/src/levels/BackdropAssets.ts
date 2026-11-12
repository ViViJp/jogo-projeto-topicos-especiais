/**
 * Imagens disponíveis para as image layers de fundo (parallax) dos mapas
 * Tiled. A chave é o NOME DO ARQUIVO usado na image layer do `.tmj`; o
 * caminho relativo gravado pelo Tiled não importa para o jogo.
 *
 * O Parcel só empacota arquivos referenciados por `new URL("...",
 * import.meta.url)` com caminho literal, por isso cada imagem nova
 * precisa ser registrada aqui (uma linha). Se uma image layer apontar para
 * um arquivo fora desta lista, o jogo avisa no console e ignora a camada.
 *
 * As imagens ficam em `src/assets/backdrops/<setor>/` e podem ser
 * regeneradas com `python3 scripts/backdrops/gerar_fundos.py` ou trocadas
 * por arte feita à mão mantendo o mesmo nome.
 */
export const BACKDROP_IMAGE_URLS: Readonly<Record<string, URL>> = {
  // Fase 1 — Esgoto / Periferia
  "esgoto-fundo.png": new URL("../assets/backdrops/esgoto/esgoto-fundo.png", import.meta.url),
  "esgoto-tubos.png": new URL("../assets/backdrops/esgoto/esgoto-tubos.png", import.meta.url),
  "esgoto-nevoa.png": new URL("../assets/backdrops/esgoto/esgoto-nevoa.png", import.meta.url),
  "esgoto-agua.png": new URL("../assets/backdrops/esgoto/esgoto-agua.png", import.meta.url),
  "esgoto-cabos.png": new URL("../assets/backdrops/esgoto/esgoto-cabos.png", import.meta.url),
  // Fase 2 — Distrito Industrial
  "industrial-fundo.png": new URL("../assets/backdrops/industrial/industrial-fundo.png", import.meta.url),
  "industrial-fumaca.png": new URL("../assets/backdrops/industrial/industrial-fumaca.png", import.meta.url),
  "industrial-galpao.png": new URL("../assets/backdrops/industrial/industrial-galpao.png", import.meta.url),
  "industrial-correntes.png": new URL("../assets/backdrops/industrial/industrial-correntes.png", import.meta.url),
  "industrial-rodape.png": new URL("../assets/backdrops/industrial/industrial-rodape.png", import.meta.url),
  // Fase 3 — Meio Urbano
  "urbano-ceu.png": new URL("../assets/backdrops/meio-urbano/urbano-ceu.png", import.meta.url),
  "urbano-predios-longe.png": new URL("../assets/backdrops/meio-urbano/urbano-predios-longe.png", import.meta.url),
  "urbano-predios-perto.png": new URL("../assets/backdrops/meio-urbano/urbano-predios-perto.png", import.meta.url),
  "urbano-smog.png": new URL("../assets/backdrops/meio-urbano/urbano-smog.png", import.meta.url),
  "urbano-rodape.png": new URL("../assets/backdrops/meio-urbano/urbano-rodape.png", import.meta.url),
  // Fase 4 — Distrito Corporativo
  "corp-cidade.png": new URL("../assets/backdrops/corporativo/corp-cidade.png", import.meta.url),
  "corp-fachada.png": new URL("../assets/backdrops/corporativo/corp-fachada.png", import.meta.url),
  "corp-telas.png": new URL("../assets/backdrops/corporativo/corp-telas.png", import.meta.url),
  "corp-rodape.png": new URL("../assets/backdrops/corporativo/corp-rodape.png", import.meta.url),
  // Fase 5 — Topo da Cidade
  "topo-ceu.png": new URL("../assets/backdrops/topo/topo-ceu.png", import.meta.url),
  "topo-nuvens.png": new URL("../assets/backdrops/topo/topo-nuvens.png", import.meta.url),
  "topo-torres.png": new URL("../assets/backdrops/topo/topo-torres.png", import.meta.url),
  "topo-nevoa.png": new URL("../assets/backdrops/topo/topo-nevoa.png", import.meta.url),
  // só no trecho contemplativo final (image layers com `appear_x`)
  "topo-final-aurora.png": new URL("../assets/backdrops/topo/topo-final-aurora.png", import.meta.url),
  "topo-final-cidade.png": new URL("../assets/backdrops/topo/topo-final-cidade.png", import.meta.url),
};

/** Nome do arquivo (sem pastas) de um caminho de imagem do Tiled. */
export function backdropImageName(tiledImagePath: string): string {
  const parts = tiledImagePath.split(/[\\/]/);
  return parts[parts.length - 1];
}

export function backdropTextureKey(imageName: string): string {
  return `backdrop:${imageName}`;
}

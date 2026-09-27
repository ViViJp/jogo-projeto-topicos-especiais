import fase1Map from "../assets/maps/esgoto/fase-1.json";

/**
 * Config da Fase 1 sobre o mapa Tiled real
 * (`src/assets/maps/esgoto/fase-1.json`), seguindo o contrato
 * `TILED_PHASER_CONTRACT1.md` (v0.1, 2026-09-12) entregue pelo level
 * designer. Só a Fase 1 está no contrato oficial até agora - os outros
 * mapas entregues (`src/assets/maps/{industrial,meio-urbano,corporativo,
 * topo}`) continuam em 32×32px e sem um contrato formal (grid oficial só
 * definido pra Fase 1 no documento), então ficam de fora desta integração;
 * a Fase 2 em diante continua no formato desenhado à mão
 * (`src/levels/phase2Intro.ts`) até terem seu próprio contrato.
 *
 * v0.4.0 - troca pelo blockout FINAL da Fase 1 entregue pelo level design
 * (branch/export mais recente do Tiled - commit "feat: Finalizando o
 * blockout da fase 1"), bem maior e mais completo que o mapa provisório
 * usado desde a v0.3.0: 1050×28 tiles (era 720×20), duas elevações de chão
 * (uma "profunda" no trecho inicial e a principal depois de um degrau),
 * plataformas opcionais elevadas pra rota de risco, e agora usa DOIS
 * tilesets no mesmo mapa (`sewer` pro chão/primeiro plano, como antes, e
 * `crystal-cave-tiles`, novo, só pro pano de fundo distante - layer
 * `background`). Os hazards também mudaram de mecanismo: o mapa antigo não
 * tinha nenhum objeto real da classe `hazard` (só um `hazard=true` nos
 * tiles da layer `hazards`, mecanismo antigo da v0.2.0); este mapa novo
 * segue o contrato à risca (§5.3) com objetos `hazard`/`kind` de verdade
 * na layer `objects` - `toxic_water` (poços sem fundo, já existia) e
 * `electric_wire` (novo - fios finos exatamente na altura da cabeça de
 * Alex parado/correndo, ~16px acima da superfície do chão principal,
 * pedindo pra deslizar por baixo - ver `TiledLevelRuntime.buildObjectHazards()`).
 *
 * O JSON é importado ESTATICAMENTE (`import ... from "*.json"`), não via
 * `new URL(...) + load.tilemapTiledJSON` - ver "Nota técnica sobre o JSON
 * do mapa e o Parcel" no README: o pipeline padrão de JSON do Parcel
 * sempre transforma `.json` em módulo JS (não copia o arquivo cru), então
 * buscar essa URL pela rede e fazer `JSON.parse` nela (o que o loader de
 * tilemap do Phaser faz) falha silenciosamente. Os dados já parseados vão
 * direto pro cache de tilemap do Phaser em `GameScene.preload()`
 * (`this.cache.tilemap.add`), sem passar pelo loader de rede.
 */
export const TILED_FASE1_MAP_KEY = "map-fase1";
export const TILED_FASE1_TILESET_KEY = "tiles-fase1-sewer";
/**
 * Nome do tileset dentro do próprio JSON (Tiled `tileset.name`) - exigido
 * por `map.addTilesetImage`. Mudou de "sewer" (mapa antigo) para
 * "tileset-sewer" nesta exportação (confirmado lendo o JSON real, não só
 * assumido - mesmo aviso do contrato §8 sobre `type`/`class` variando por
 * exportação vale aqui).
 */
export const TILED_FASE1_TILESET_NAME = "tileset-sewer";
/** segundo tileset do mapa v0.4.0, usado só pela layer `background` (pano de fundo distante da caverna). */
export const TILED_FASE1_TILESET2_KEY = "tiles-fase1-crystal-cave";
export const TILED_FASE1_TILESET2_NAME = "crystal-cave-tiles";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TILED_FASE1_MAP_DATA: any = fase1Map;

/**
 * v0.4.1 - trocado de "quase preto" pra cinza por pedido explícito ("quero
 * um fundo acinzentado, não preto"), depois de confirmar a causa real do
 * problema de contraste assistindo aos vídeos de gameplay enviados (não só
 * a métrica isolada): a calça/bota de Alex já são desenhadas quase pretas
 * na própria arte (`#200c0d`, luminância ~18,1 - ver histórico abaixo), e
 * ~9,7% de todos os pixels do sprite usam esse tom. Contra um fundo
 * também quase preto (`#000010`, v0.3.2, luminância ~1,8), a calça vira
 * uma mancha escura quase sem contorno - dava a impressão de "sombra"
 * mesmo com o gap de luminância já perto do teto teórico pra um fundo
 * ESCURO. Só dá pra abrir mais gap indo mais claro, não mais escuro -
 * exatamente o que foi pedido.
 *
 * Recalibrado com o mesmo método por luminância (ITU-R BT.601,
 * `0,299R+0,587G+0,114B`) contra os 37 tons opacos significativos do
 * spritesheet (>=0,05% dos pixels), mas agora maximizando a MENOR
 * distância em qualquer direção (não só pra baixo) dentro de uma faixa
 * de cinza escuro/médio plausível (luminância 40-160 - fora disso já não
 * lê como "cinza" pro clima do jogo: abaixo de ~40 continua perto demais
 * de preto, acima de ~160 vira um cinza claro/prateado, destoante do tom
 * sombrio do esgoto). Maior "vão" nessa faixa: entre os tons de sombreado
 * mais escuros (que terminam em ~50,5) e o próximo grupo de tons de
 * pele/músculo em sombra (que começa em ~63,6) - ponto médio ~57.
 * `#36393c` (cinza levemente frio, luminância ~56,6) fica bem no meio
 * desse vão: gap de ~6,1 contra o tom mais próximo abaixo e ~7,0 contra o
 * mais próximo acima - bem mais apertado que o gap unidirecional de
 * ~16,3 que dava pra abrir indo pra preto absoluto, mas sem escolha
 * melhor dentro da restrição de ser visivelmente cinza (o próximo vão
 * grande de verdade só aparece em luminância ~126, que já lê como cinza
 * médio/claro, mais aceso do que parece pedido aqui). Confirmado
 * visualmente (screenshot de gameplay real, não só a métrica) - ver
 * "Correções e decisões de v0.4.1".
 *
 * v0.4.2 - feedback do playtest da v0.4.1: "a única coisa que alterou foi a
 * cor do mapa, o ajuste na sombra do personagem que foi solicitado não está
 * sendo ajustado" + prioridade #4 explícita ("deixar o cinza um pouco mais
 * claro"). Duas causas problema, não uma:
 *
 *  1. O vídeo de gameplay usado pra validar a v0.4.1 era da FASE 2 (nível
 *     desenhado à mão, `phase2Intro.ts`), não da Fase 1 - e o fundo da Fase 2
 *     (`PHASE_BACKGROUND["fase2-intro"]` em `GameScene.ts`, `0x100802`,
 *     luminância ~9,7) nunca tinha sido recalibrado, só o valor usado aqui
 *     (`TILED_FASE1_BACKGROUND`). Ou seja: pra quem jogou a Fase 2, o fundo
 *     realmente não mudou nada - dava exatamente a impressão relatada.
 *     Corrigido reaproveitando esta MESMA constante calibrada por luminância
 *     em `PHASE_BACKGROUND` (Fase 1 e Fase 2 usam a mesma arte de Alex, então
 *     o mesmo valor vale pras duas), e também no fallback (`?? 0x0a0a10`,
 *     idem quase-preto, nunca usado hoje mas corrigido por segurança caso
 *     uma fase futura caia nele sem entrada própria no mapa).
 *  2. Pedido explícito de ir mais claro ainda a partir do `#36393c`
 *     (luminância ~56,6, vão de ~57 entre os tons 50,5/63,6 do spritesheet -
 *     ver histórico abaixo). Reaproveitando a mesma varredura por luminância
 *     dos 37 tons opacos significativos (>=0,05% dos pixels) do spritesheet,
 *     o próximo vão realmente folgado acima desse (não os vãos apertados de
 *     ~4-5 logo em seguida, que dariam uma mudança quase imperceptível) fica
 *     entre os tons de pele/músculo iluminado que terminam em ~117,0 e o
 *     tom de pele mais claro que começa em ~134,9 - vão de ~17,9, folga de
 *     ~8,7/~9,2 pra cada lado (bem mais confortável que a folga de ~6,1/~7,0
 *     do valor anterior). `#787f86` (mesmo matiz frio de sempre, luminância
 *     ~125,7) fica no meio desse vão - perceptivelmente mais claro que
 *     `#36393c`, continua lendo como cinza (não é prateado/quase-branco,
 *     esse só apareceria no próximo vão grande, ~163), e ainda assim melhora
 *     a margem de segurança de contraste em vez de piorar.
 *
 * Histórico: v0.2.1 (`#0a1410`) → v0.3.1 (`#000345`, media distância de
 * COR/matiz, métrica errada pra tons escuros) → v0.3.2 (`#000010`, primeira
 * vez calibrando por luminância, mas indo pro extremo escuro) → v0.4.1
 * (`#36393c`, cinza, luminância intermediária, por pedido explícito, mas só
 * aplicado na Fase 1) → v0.4.2 (`#787f86`, mais claro ainda, e aplicado
 * também na Fase 2 + fallback).
 */
export const TILED_FASE1_BACKGROUND = 0x787f86;
/**
 * Reconferido na v0.4.0 pro mapa novo: a layer `background` (tileset
 * `crystal-cave-tiles`) só cobre as linhas 0-11 do grid (pano de fundo
 * distante, acima da cabeça de Alex o tempo todo - ele nunca chega perto
 * das linhas 16-26 onde ela existe), e `deco-back` está vazia neste
 * export. Ou seja: em qualquer ponto onde o personagem realmente passa,
 * é esta cor de câmera (não nenhum tile) que fica atrás dele - a mesma
 * situação do mapa antigo, então o valor calibrado por luminância na
 * v0.3.2 continua válido sem precisar remedir.
 */

/** Mesmo nome de exibição usado pelo nível desenhado à mão (`phase1.ts`). */
export const TILED_FASE1_NAME = "Fase 1 — Esgoto / Periferia";

/**
 * Desloca o mapa inteiro (layers + coordenadas dos objetos) para baixo na
 * tela. O grid do Tiled é 16×16, e este motor **não tem scroll vertical de
 * câmera** (`GameScene.update()` só ajusta `scrollX` - confirmado sem
 * nenhum uso de `scrollY`/`startFollow` no projeto). Sem deslocar, o chão
 * ficaria colado perto do topo da tela com um vão vazio enorme embaixo.
 *
 * Recalculado na v0.4.0 pro mapa novo (1050×28, chão principal agora na
 * linha 21 do grid, y=336 no espaço do mapa - antes era a linha 16/y=256
 * no mapa provisório de 20 linhas). Mesmo critério de sempre: escolhido
 * pra essa linha cair em y=560 na tela (o mesmo `GROUND_Y` do nível
 * desenhado à mão), preservando o enquadramento e a folga vertical
 * conhecidos. Conferido que nada fica cortado com esse deslocamento: o
 * pano de fundo (`background`, linhas 0-11) cai em y=224-400 na tela, e o
 * fundo do mapa (linha 27) cai em y=656 - tudo dentro dos 720px de
 * viewport, sem sobra nem corte.
 */
export const TILED_FASE1_OFFSET_Y = 560 - 21 * 16; // = 224

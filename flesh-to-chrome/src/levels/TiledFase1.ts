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
 * Recalibrado pela TERCEIRA vez na v0.3.2 - v0.3.1 (`#000345`) media
 * "distância de cor" (distância euclidiana em RGB) contra os tons do
 * spritesheet e escolhia a MAIOR distância mínima, mas isso mede
 * principalmente diferença de MATIZ (hue), não diferença de LUMINÂNCIA
 * (brilho percebido) - e contraste visual, sobretudo entre duas cores bem
 * escuras, é dominado por luminância, não por matiz (o olho humano
 * distingue muito pior tons escuros entre si do que tons claros - lei de
 * Weber). `#000345` tinha distância de cor 51 contra a calça (`#101414`),
 * mas as DUAS cores têm luminância baixíssima e quase igual (~9,6 vs
 * ~18,8 - gap de só 8,5 num intervalo de 0-255), por isso continuava
 * "sumindo" apesar da distância de cor parecer alta no papel.
 *
 * Medido de novo (script em `bg_search_v032_final.py`, luminância
 * ITU-R BT.601: 0,299R+0,587G+0,114B) contra TODOS os tons opacos
 * significativos do spritesheet (>=0,05% dos pixels - descarta ruído de
 * poucos pixels, tipo um brilho de pupila). O resultado: os tons de
 * sombreado da própria arte (cabelo, calça, coturno) formam um degradê
 * praticamente contínuo de luminância ~18 a ~50 - não há "brecha" de
 * luminância nesse meio para o fundo ocupar sem ficar perto de algum tom
 * real da arte. A única forma de abrir um gap de luminância bem maior
 * sem abandonar um fundo escuro/atmosférico (o que exigiria subir a
 * luminância pra ~70+, i.e. cinza médio - destoante do clima do jogo) é
 * ir MAIS ESCURO que o tom mais escuro da arte (~18,1), não tentar ficar
 * "ao lado" dele só mudando o matiz. `#000010` (quase preto, com um
 * traço mínimo de azul pra não ficar um preto absoluto/"buraco") dá gap
 * de luminância de ~16,3 contra o pior tom - quase o dobro do `#000345`
 * (8,5), e o mais perto do teto teórico (~18,1, só alcançável com preto
 * puro `#000000`, descartado por colidir exatamente com uns poucos
 * pixels de contorno pretos puros da arte, irrelevantes em área mas
 * ficariam com distância de cor zero).
 */
export const TILED_FASE1_BACKGROUND = 0x000010;
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

#!/usr/bin/env python3
"""Fase 1 Esgoto — mapa Tiled side-view com verticalidade (Mario/Celeste).

Corrige o draft flat: chão em várias alturas, fossos, plataformas flutuantes,
slide sob teto baixo. Perspectiva de perfil (auto-runner GDD).

  python3 scripts/generate_fase1_map.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/maps/esgoto"
TILESET_PNG = ROOT / "public/assets/tiles/esgoto/tiles/tilesetSewer.png"
TILESET_REL = "../../tiles/esgoto/tiles/tilesetSewer.png"

TS = 16
SHEET_COLS = 25
MAP_W = 640
MAP_H = 28  # mais altura jogável (Celeste-like)


def gid(col: int, row: int) -> int:
    return 1 + row * SHEET_COLS + col


# --- Tiles side-view (tilesetSewer.png) ---
# Plataforma girder (faixa inferior do sheet — leitura lateral clara)
PLAT_TOP = gid(4, 15)  # 380
PLAT_BODY = gid(4, 16)  # 405
PLAT_TOP_B = gid(5, 15)
PLAT_BODY_B = gid(5, 16)
# Blocos de parede/sólido (topo do sheet) — preenchimento de terreno
SOLID_A = gid(2, 0)  # 3
SOLID_B = gid(2, 1)  # 28
SOLID_C = gid(2, 2)  # 53
# Painéis teal (água / hazard visual)
WATER = gid(3, 7)  # 179
WATER_B = gid(3, 8)  # 204
# Cano / teto baixo (slide)
PIPE = gid(13, 14)  # 364 — se vazio no sheet, fallback
CEIL_PIPE = gid(11, 0)  # 12
WIRE = gid(10, 10)  # 261
PANEL = gid(4, 7)  # 180
MOSS = gid(14, 0)  # 15 — detalhe topo


def empty() -> list[int]:
    return [0] * (MAP_W * MAP_H)


def set_t(data: list[int], x: int, y: int, tile: int) -> None:
    if 0 <= x < MAP_W and 0 <= y < MAP_H and tile:
        data[y * MAP_W + x] = tile


def plat_tile(x: int, body: bool = False) -> int:
    if body:
        return PLAT_BODY if x % 2 == 0 else PLAT_BODY_B
    return PLAT_TOP if x % 2 == 0 else PLAT_TOP_B


def solid_tile(x: int, y: int) -> int:
    return SOLID_A if (x + y) % 2 == 0 else SOLID_B


def fill_column(ground: list[int], x: int, surface_y: int, to_bottom: bool = True) -> None:
    """Coluna de terreno side-view: topo = plataforma, abaixo = fill sólido."""
    if surface_y < 0 or surface_y >= MAP_H - 1:
        return
    set_t(ground, x, surface_y, plat_tile(x, body=False))
    end = MAP_H if to_bottom else min(MAP_H, surface_y + 4)
    for y in range(surface_y + 1, end):
        set_t(ground, x, y, solid_tile(x, y) if y < surface_y + 3 else SOLID_C)


def floating_platform(ground: list[int], x0: int, x1: int, y: int, thickness: int = 2) -> None:
    for x in range(x0, x1):
        set_t(ground, x, y, plat_tile(x))
        for dy in range(1, thickness):
            set_t(ground, x, y + dy, plat_tile(x, body=True))


def water_pit(hazards: list[int], x0: int, x1: int, water_y: int) -> None:
    for x in range(x0, x1):
        for y in range(water_y, MAP_H):
            set_t(hazards, x, y, WATER if y == water_y else WATER_B)


def low_ceiling(hazards: list[int], x0: int, x1: int, y: int) -> None:
    """Teto baixo — força slide (pipe sobre o chão)."""
    for x in range(x0, x1):
        set_t(hazards, x, y, CEIL_PIPE)
        set_t(hazards, x, y - 1, PIPE if PIPE else CEIL_PIPE)


def wires(hazards: list[int], x0: int, x1: int, y: int) -> None:
    for x in range(x0, x1, 2):
        set_t(hazards, x, y, WIRE)
        set_t(hazards, x, y + 1, WIRE)


def obj(name: str, oid: int, tx: int, ty: int, props: dict) -> dict:
    return {
        "id": oid,
        "name": name,
        "type": str(props.get("type", "")),
        "x": tx * TS,
        "y": ty * TS,
        "width": TS,
        "height": TS,
        "rotation": 0,
        "visible": True,
        "properties": [{"name": k, "type": "string", "value": str(v)} for k, v in props.items()],
    }


def build() -> tuple[list[int], list[int], list[int], list[dict]]:
    ground, hazards, deco = empty(), empty(), empty()
    objects: list[dict] = []
    oid = 1

    def add(name: str, tx: int, ty: int, props: dict) -> None:
        nonlocal oid
        objects.append(obj(name, oid, tx, ty, props))
        oid += 1

    # Heightmap base: superfície do chão principal por coluna (None = gap/vazio)
    # Valores menores = mais alto na tela (Y menor)
    surface: list[int | None] = [None] * MAP_W

    def set_span(x0: int, x1: int, y: int) -> None:
        for x in range(x0, min(x1, MAP_W)):
            surface[x] = y

    # --- levelDesign.md Fase 1 — VERTICALIDADE forte (Celeste) ---
    # Y menor = mais alto. Amplitude ~ Y=6 (topo) … Y=22 (fundo do fosso)

    # 0–36: início seguro no fundo do setor, sobe escada
    set_span(0, 28, 20)
    add("spawn", 5, 18, {"type": "spawn"})
    set_span(28, 32, 18)
    set_span(32, 36, 16)
    set_span(36, 42, 14)  # primeiro platô alto

    # 42–70: primeiro pulo (gap) + aterrissa mais baixo
    # gap 42–48
    set_span(48, 58, 17)
    set_span(58, 64, 13)  # sobe de novo
    # gap 64–68
    set_span(68, 80, 16)

    # 80–130: torre de plataformas (sobe de verdade)
    set_span(80, 88, 18)
    # shaft vazio 88–92
    set_span(92, 100, 12)
    # gap
    set_span(106, 114, 8)  # bem alto
    # gap
    set_span(120, 130, 14)

    # 130–165: slide em corredor elevado (chão alto + teto)
    set_span(130, 165, 11)

    # 165–210: desce em degraus + pulo/slide
    set_span(165, 175, 13)
    set_span(175, 182, 16)
    # gap
    set_span(188, 200, 19)
    set_span(200, 210, 15)

    # 210–270: GRANDE FOSZO de água + ilhas em 3 alturas
    set_span(210, 218, 14)
    # pit 218–262
    set_span(262, 280, 16)

    # 280–350: dual path — rua baixa vs rota risco no teto
    set_span(280, 350, 20)

    # 350–410: tubulação rompida — degraus agressivos
    set_span(350, 358, 17)
    # gap
    set_span(364, 372, 10)
    # gap
    set_span(378, 386, 18)
    # gap
    set_span(392, 410, 12)

    # 410–445: checkpoint no alto
    set_span(410, 445, 9)

    # 445–520: fios + fosso profundo (maior desafio)
    set_span(445, 455, 12)
    # pit 455–500
    set_span(500, 520, 15)

    # 520–590: domínio — sobe ao pico, slide, fosso, desce
    set_span(520, 535, 13)
    set_span(535, 555, 7)  # pico da fase
    # pit 555–570
    set_span(570, 590, 18)

    # 590–640: desce até a clínica
    set_span(590, 610, 15)
    set_span(610, MAP_W, 17)

    # Materializa heightmap
    for x, sy in enumerate(surface):
        if sy is not None:
            fill_column(ground, x, sy)

    # Plataformas flutuantes / escadas Celeste
    floating_platform(ground, 44, 47, 12)  # meio do 1º gap
    floating_platform(ground, 88, 91, 15)  # shaft assist
    floating_platform(ground, 88, 91, 11)
    floating_platform(ground, 101, 105, 10)
    floating_platform(ground, 114, 118, 11)
    floating_platform(ground, 182, 186, 14)

    # Ilhas no 1º fosso (3 alturas)
    floating_platform(ground, 222, 227, 16)
    floating_platform(ground, 230, 236, 12)
    floating_platform(ground, 238, 244, 8)
    floating_platform(ground, 246, 252, 13)
    floating_platform(ground, 254, 260, 17)

    # Rota risco (créditos) bem acima da rua
    floating_platform(ground, 290, 340, 8, thickness=2)
    floating_platform(ground, 300, 308, 5)  # ainda mais alto (opcional)

    # Ilhas no 2º fosso (fios)
    floating_platform(ground, 460, 466, 14)
    floating_platform(ground, 470, 476, 10)
    floating_platform(ground, 480, 486, 7)
    floating_platform(ground, 490, 496, 12)

    # Domínio
    floating_platform(ground, 558, 563, 11)
    floating_platform(ground, 564, 569, 9)

    # Fossos de água (fundo do mapa)
    water_pit(hazards, 218, 262, 23)
    water_pit(hazards, 455, 500, 23)
    water_pit(hazards, 555, 570, 23)

    # Slide: teto baixo sobre chão elevado
    low_ceiling(hazards, 138, 158, 8)  # chão Y=11 → gap ~2–3 tiles
    low_ceiling(hazards, 538, 552, 4)  # no pico

    # Fios pendurados sobre fossos
    wires(hazards, 458, 498, 5)
    wires(hazards, 556, 568, 6)

    # Deco teto / atmosfera
    for x in range(0, MAP_W, 4):
        set_t(deco, x, 1, CEIL_PIPE)
        if x % 12 == 0:
            set_t(deco, x, 2, PANEL)

    for x in range(412, 440):
        set_t(deco, x, 8, MOSS)

    # Objects alinhados às novas alturas
    for i, cx in enumerate(range(295, 335, 8)):
        add(f"credit_risk_{i}", cx, 6, {"type": "credit", "route": "risk", "id": f"f1-r-{i}"})
    for i, cx in enumerate(range(300, 340, 12)):
        add(f"credit_safe_{i}", cx, 18, {"type": "credit", "route": "normal", "id": f"f1-s-{i}"})

    add("checkpoint_1", 425, 7, {"type": "checkpoint", "id": "cp1"})
    for c in range(6):
        set_t(deco, 422 + c, 7, PANEL)

    add("clinic_exit", 622, 15, {"type": "clinic", "next": "ClinicScene"})
    add("phase_end", 632, 15, {"type": "phase_end", "fase": "1"})

    return ground, hazards, deco, objects


def write_tileset() -> None:
    tiles = [
        {"id": PLAT_TOP - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": PLAT_BODY - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": SOLID_A - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": WATER - 1, "properties": [{"name": "hazard", "type": "bool", "value": True}, {"name": "kind", "type": "string", "value": "toxic_water"}]},
        {"id": CEIL_PIPE - 1, "properties": [{"name": "solid", "type": "bool", "value": True}, {"name": "slide", "type": "bool", "value": True}]},
        {"id": WIRE - 1, "properties": [{"name": "hazard", "type": "bool", "value": True}, {"name": "kind", "type": "string", "value": "wire"}]},
    ]
    tsj = {
        "columns": SHEET_COLS,
        "image": TILESET_REL,
        "imageheight": 308,
        "imagewidth": 400,
        "margin": 0,
        "name": "sewer",
        "spacing": 0,
        "tilecount": SHEET_COLS * 19,
        "tiledversion": "1.10.2",
        "tileheight": TS,
        "tilewidth": TS,
        "type": "tileset",
        "version": "1.10",
        "tiles": tiles,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "tileset-sewer.tsj").write_text(json.dumps(tsj, indent=2) + "\n")


def write_map(ground: list[int], hazards: list[int], deco: list[int], objects: list[dict]) -> None:
    def layer(name: str, lid: int, data: list[int]) -> dict:
        return {
            "data": data,
            "height": MAP_H,
            "width": MAP_W,
            "id": lid,
            "name": name,
            "opacity": 1,
            "type": "tilelayer",
            "visible": True,
            "x": 0,
            "y": 0,
        }

    tiled = {
        "compressionlevel": -1,
        "height": MAP_H,
        "width": MAP_W,
        "infinite": False,
        "layers": [
            layer("deco", 1, deco),
            layer("ground", 2, ground),
            layer("hazards", 3, hazards),
            {
                "draworder": "topdown",
                "id": 99,
                "name": "objects",
                "objects": objects,
                "opacity": 1,
                "type": "objectgroup",
                "visible": True,
                "x": 0,
                "y": 0,
            },
        ],
        "nextlayerid": 100,
        "nextobjectid": len(objects) + 1,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "tileheight": TS,
        "tilewidth": TS,
        "tilesets": [{"firstgid": 1, "source": "tileset-sewer.tsj"}],
        "type": "map",
        "version": "1.10",
        "properties": [
            {"name": "fase", "type": "int", "value": 1},
            {"name": "setor", "type": "string", "value": "esgoto"},
            {"name": "perspective", "type": "string", "value": "side-view"},
            {"name": "gdd", "type": "string", "value": "§16.1 + levelDesign.md + issue #3"},
            {"name": "implante", "type": "string", "value": "pernas"},
        ],
    }
    (OUT / "fase-1.json").write_text(json.dumps(tiled, indent=2) + "\n")


def render_preview(ground: list[int], hazards: list[int], deco: list[int]) -> None:
    """PNG side-view para validar sem Tiled."""
    if not TILESET_PNG.is_file():
        return
    sheet = Image.open(TILESET_PNG).convert("RGBA")

    def blit(canvas: Image.Image, data: list[int]) -> None:
        for i, g in enumerate(data):
            if not g:
                continue
            tid = g - 1
            c, r = tid % SHEET_COLS, tid // SHEET_COLS
            tile = sheet.crop((c * TS, r * TS, (c + 1) * TS, (r + 1) * TS))
            x, y = (i % MAP_W) * TS, (i // MAP_W) * TS
            canvas.alpha_composite(tile, (x, y))

    # preview: primeiros 120 tiles de largura (zoom legível) + full mini
    bg = (12, 10, 20, 255)
    full = Image.new("RGBA", (MAP_W * TS, MAP_H * TS), bg)
    blit(full, deco)
    blit(full, ground)
    blit(full, hazards)

    # strip início (0–100) e meio (200–320) e final
    for name, x0, x1 in (("preview-start.png", 0, 100), ("preview-mid.png", 200, 320), ("preview-end.png", 500, 640)):
        crop = full.crop((x0 * TS, 0, x1 * TS, MAP_H * TS))
        crop = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
        crop.save(OUT / name)

    # mini full (1/4)
    mini = full.resize((MAP_W * TS // 4, MAP_H * TS // 4), Image.NEAREST)
    mini.save(OUT / "preview-full-mini.png")
    print(f"  previews em {OUT.relative_to(ROOT)}/preview-*.png")


def write_credits() -> None:
    (OUT / "credits.txt").write_text(
        """Fase 1 — Esgoto (side-view redesenhada, issue #3)

Perspectiva: perfil Mario/Celeste (NÃO top-down)
Layout: levelDesign.md + verticalidade (heightmap + plataformas flutuantes)

Tiles: cammellaro Sewer — plataforma girder (rows 15–16) + sólidos + água teal
Camadas: deco, ground, hazards, objects

Previews: preview-start.png, preview-mid.png, preview-end.png, preview-full-mini.png

Regenerar:
  python3 scripts/generate_fase1_map.py
"""
    )


def main() -> None:
    write_tileset()
    ground, hazards, deco, objects = build()
    write_map(ground, hazards, deco, objects)
    render_preview(ground, hazards, deco)
    write_credits()
    # sanity: unique surface heights
    heights = set()
    for x in range(MAP_W):
        for y in range(MAP_H):
            if ground[y * MAP_W + x] in (PLAT_TOP, PLAT_TOP_B):
                heights.add(y)
                break
    print(f"Wrote {OUT / 'fase-1.json'} ({MAP_W}x{MAP_H} @ {TS}px)")
    print(f"  platform surface heights Y={sorted(heights)}")
    print(f"  objects={len(objects)}")


if __name__ == "__main__":
    main()

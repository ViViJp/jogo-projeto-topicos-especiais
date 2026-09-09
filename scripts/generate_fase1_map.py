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
TILESET_PNG = ROOT / "public/assets/tiles/esgoto/tiles/tileset-sideview.png"
TILESET_REL = "../../tiles/esgoto/tiles/tileset-sideview.png"
BG_FAR = "../../tiles/esgoto/parallax/bg-far.png"
BG_MID = "../../tiles/esgoto/parallax/bg-mid.png"

TS = 16
SHEET_COLS = 16  # Beast sewer 256×352
MAP_W = 640
MAP_H = 28  # mais altura jogável (Celeste-like / montanha)


def gid(col: int, row: int) -> int:
    return 1 + row * SHEET_COLS + col


# --- Tiles side-view (MrBeast sewer OGA CC-BY) ---
PLAT_TOP = gid(0, 0)  # 1 — tijolo topo
PLAT_TOP_B = gid(1, 0)  # 2
PLAT_BODY = gid(0, 2)  # 33 — fill
PLAT_BODY_B = gid(1, 2)  # 34
SOLID_A = gid(0, 3)  # 49
SOLID_B = gid(1, 3)  # 50
SOLID_C = gid(0, 4)  # 65
WATER = gid(0, 11)  # 177 — superfície
WATER_B = gid(1, 11)  # 178
CEIL_PIPE = gid(7, 1)  # 24 — variante sólida / grade
PIPE = gid(8, 1)  # 25
WIRE = gid(9, 5)  # 90
PANEL = gid(2, 0)  # 3
MOSS = gid(3, 0)  # 4
STAIR = gid(6, 0)  # 7


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

    # Heightmap: MONTANHA / ASCENSÃO (GDD — Glitch City vertical)
    # Y menor = mais alto na tela. Tendência: início no fundo → fim no alto.
    # Descidas locais OK, mas o baseline sobe; nunca volta ao nível do spawn por longo.
    surface: list[int | None] = [None] * MAP_W

    def set_span(x0: int, x1: int, y: int) -> None:
        for x in range(x0, min(x1, MAP_W)):
            surface[x] = y

    # Baseline da montanha: Y=24 no spawn → Y=7 na clínica
    START_Y, END_Y = 24, 7

    def mountain_y(x: int) -> int:
        t = x / max(1, MAP_W - 1)
        return int(round(START_Y + (END_Y - START_Y) * t))

    # Preenche baseline contínuo; gaps sobrescrevem com None depois
    for x in range(MAP_W):
        surface[x] = mountain_y(x)

    # --- Variação local SOBRE a montanha (nunca “volta ao zero”) ---
    # 0–40: planície baixa (início seguro) — ligeiramente acima do baseline
    set_span(0, 40, 23)
    add("spawn", 5, 21, {"type": "spawn"})

    # 40–80: primeiro degrau da ascensão + gap
    set_span(40, 52, 21)
    for x in range(52, 58):
        surface[x] = None  # gap
    set_span(58, 80, 19)

    # 80–130: sobe forte (torre) — bem acima do início
    set_span(80, 95, 17)
    for x in range(95, 100):
        surface[x] = None
    set_span(100, 115, 14)
    for x in range(115, 120):
        surface[x] = None
    set_span(120, 140, 12)

    # 140–175: corredor de slide na encosta (ainda mais alto que spawn)
    set_span(140, 175, 11)

    # 175–220: pequena descida LOCAL (ainda Y<<23) + gap
    set_span(175, 190, 13)  # desce um pouco, mas longe do início
    for x in range(190, 196):
        surface[x] = None
    set_span(196, 220, 12)

    # 220–280: fosso de água na encosta + ilhas SUBINDO
    for x in range(220, 270):
        surface[x] = None
    set_span(270, 295, 11)

    # 295–360: dual path — rua na encosta + risco ainda MAIS alto
    set_span(295, 360, 12)

    # 360–420: tubulação / degraus subindo de novo
    set_span(360, 375, 11)
    for x in range(375, 380):
        surface[x] = None
    set_span(380, 395, 9)
    for x in range(395, 400):
        surface[x] = None
    set_span(400, 430, 8)

    # 430–470: checkpoint no alto da encosta
    set_span(430, 470, 8)

    # 470–540: fosso profundo (queda perigosa) — aterrissa ainda alto
    for x in range(470, 520):
        surface[x] = None
    set_span(520, 550, 9)

    # 550–600: pico da fase (domínio) — mais alto do mapa
    set_span(550, 580, 6)
    for x in range(580, 588):
        surface[x] = None
    set_span(588, 610, 7)

    # 610–640: platô final / clínica — topo desta fase
    set_span(610, MAP_W, 7)

    # Materializa
    for x, sy in enumerate(surface):
        if sy is not None:
            fill_column(ground, x, sy)

    # Plataformas flutuantes SEMPRE acima do baseline local (continuar a subida)
    floating_platform(ground, 53, 57, 18)  # meio do 1º gap
    floating_platform(ground, 96, 99, 15)
    floating_platform(ground, 116, 119, 13)

    # Ilhas do fosso 1 — cada uma mais alta (sobe atravessando)
    floating_platform(ground, 225, 231, 16)
    floating_platform(ground, 235, 241, 13)
    floating_platform(ground, 245, 252, 10)
    floating_platform(ground, 256, 263, 12)
    floating_platform(ground, 265, 269, 11)

    # Rota risco: acima da rua da encosta
    floating_platform(ground, 305, 350, 6, thickness=2)

    # Ilhas fosso 2 — subindo em direção ao checkpoint já passado / próximo pico
    floating_platform(ground, 475, 482, 12)
    floating_platform(ground, 488, 495, 9)
    floating_platform(ground, 500, 508, 7)
    floating_platform(ground, 512, 518, 8)

    # Assist domínio
    floating_platform(ground, 582, 586, 8)

    # Água só no FUNDO dos fossos (não no nível do início)
    water_pit(hazards, 220, 270, 25)
    water_pit(hazards, 470, 520, 25)
    water_pit(hazards, 580, 588, 25)

    # Slide sob teto (encosta + pico)
    low_ceiling(hazards, 148, 168, 8)
    low_ceiling(hazards, 555, 575, 3)

    wires(hazards, 475, 518, 4)
    wires(hazards, 580, 587, 3)

    for x in range(0, MAP_W, 4):
        set_t(deco, x, 1, CEIL_PIPE)
        if x % 12 == 0:
            set_t(deco, x, 2, PANEL)
    for x in range(432, 465):
        set_t(deco, x, 7, MOSS)

    for i, cx in enumerate(range(310, 345, 7)):
        add(f"credit_risk_{i}", cx, 4, {"type": "credit", "route": "risk", "id": f"f1-r-{i}"})
    for i, cx in enumerate(range(310, 350, 12)):
        add(f"credit_safe_{i}", cx, 10, {"type": "credit", "route": "normal", "id": f"f1-s-{i}"})

    add("checkpoint_1", 445, 6, {"type": "checkpoint", "id": "cp1"})
    for c in range(6):
        set_t(deco, 442 + c, 6, PANEL)

    add("clinic_exit", 622, 5, {"type": "clinic", "next": "ClinicScene"})
    add("phase_end", 632, 5, {"type": "phase_end", "fase": "1"})

    return ground, hazards, deco, objects


def write_tileset() -> None:
    tiles = [
        {"id": PLAT_TOP - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": PLAT_BODY - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": SOLID_A - 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
        {"id": WATER - 1, "properties": [{"name": "hazard", "type": "bool", "value": True}, {"name": "kind", "type": "string", "value": "toxic_water"}]},
        {"id": CEIL_PIPE - 1, "properties": [{"name": "solid", "type": "bool", "value": True}, {"name": "slide", "type": "bool", "value": True}]},
    ]
    tsj = {
        "columns": SHEET_COLS,
        "image": TILESET_REL,
        "imageheight": 352,
        "imagewidth": 256,
        "margin": 0,
        "name": "sewer-sideview",
        "spacing": 0,
        "tilecount": SHEET_COLS * 22,
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
            {
                "id": 1,
                "image": BG_FAR,
                "name": "bg-far",
                "opacity": 1,
                "type": "imagelayer",
                "visible": True,
                "x": 0,
                "y": 0,
                "repeatx": True,
                "offsetx": 0,
                "offsety": 0,
            },
            {
                "id": 2,
                "image": BG_MID,
                "name": "bg-mid",
                "opacity": 0.85,
                "type": "imagelayer",
                "visible": True,
                "x": 0,
                "y": 40,
                "repeatx": True,
                "offsetx": 0,
                "offsety": 0,
            },
            layer("deco", 3, deco),
            layer("ground", 4, ground),
            layer("hazards", 5, hazards),
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
            {"name": "perspective", "type": "string", "value": "side-view-ascent"},
            {"name": "gdd", "type": "string", "value": "§16.1 montanha + issues #3 #7 #8"},
            {"name": "implante", "type": "string", "value": "pernas"},
            {"name": "tileset", "type": "string", "value": "MrBeast sewer CC-BY"},
        ],
    }
    (OUT / "fase-1.json").write_text(json.dumps(tiled, indent=2) + "\n")


def render_preview(ground: list[int], hazards: list[int], deco: list[int]) -> None:
    """PNG side-view para validar sem Tiled."""
    if not TILESET_PNG.is_file():
        print(f"  skip preview: missing {TILESET_PNG}")
        return
    sheet = Image.open(TILESET_PNG).convert("RGBA")
    bg_far = ROOT / "public/assets/tiles/esgoto/parallax/bg-far.png"
    bg_mid = ROOT / "public/assets/tiles/esgoto/parallax/bg-mid.png"

    def blit(canvas: Image.Image, data: list[int]) -> None:
        for i, g in enumerate(data):
            if not g:
                continue
            tid = g - 1
            c, r = tid % SHEET_COLS, tid // SHEET_COLS
            tile = sheet.crop((c * TS, r * TS, (c + 1) * TS, (r + 1) * TS))
            x, y = (i % MAP_W) * TS, (i // MAP_W) * TS
            canvas.alpha_composite(tile, (x, y))

    full = Image.new("RGBA", (MAP_W * TS, MAP_H * TS), (12, 10, 20, 255))
    if bg_far.is_file():
        far = Image.open(bg_far).convert("RGBA").resize((MAP_W * TS, MAP_H * TS), Image.NEAREST)
        full.alpha_composite(far)
    if bg_mid.is_file():
        mid = Image.open(bg_mid).convert("RGBA")
        mid = mid.resize((MAP_W * TS, MAP_H * TS), Image.NEAREST)
        full.alpha_composite(mid)
    blit(full, deco)
    blit(full, ground)
    blit(full, hazards)

    for name, x0, x1 in (("preview-start.png", 0, 100), ("preview-mid.png", 200, 320), ("preview-end.png", 500, 640)):
        crop = full.crop((x0 * TS, 0, x1 * TS, MAP_H * TS))
        crop = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
        crop.save(OUT / name)

    mini = full.resize((MAP_W * TS // 4, MAP_H * TS // 4), Image.NEAREST)
    mini.save(OUT / "preview-full-mini.png")
    print(f"  previews em {OUT.relative_to(ROOT)}/preview-*.png")


def write_credits() -> None:
    (OUT / "credits.txt").write_text(
        """Fase 1 — Esgoto (side-view + montanha + art upgrade #7 #8)

Tileset: MrBeast sewer (OpenGameArt) CC-BY 3.0 — tileset-sideview.png
Parallax: tiles/esgoto/parallax/bg-far.png, bg-mid.png
Layout: ascensão spawn baixo → clínica alto (GDD cidade vertical)

Previews: preview-start.png, preview-mid.png, preview-end.png

Regenerar:
  python3 scripts/import_art_upgrade.py
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

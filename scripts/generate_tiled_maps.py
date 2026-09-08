#!/usr/bin/env python3
"""Gera mapas Tiled JSON das Fases 1–5 conforme levelDesign.md + GDD §16.

Uso:
  python3 scripts/generate_tiled_maps.py
  python3 scripts/generate_tiled_maps.py --fase 2

Saída em public/assets/maps/<setor>/fase-N.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / "public/assets/maps"


def empty(w: int, h: int) -> list[int]:
    return [0] * (w * h)


def set_t(data: list[int], w: int, h: int, x: int, y: int, tile: int) -> None:
    if 0 <= x < w and 0 <= y < h:
        data[y * w + x] = tile


def fill_floor(data: list[int], w: int, h: int, x0: int, x1: int, gy: int, a: int, b: int) -> None:
    for x in range(x0, min(x1, w)):
        t = a if x % 2 == 0 else b
        set_t(data, w, h, x, gy, t)
        set_t(data, w, h, x, gy + 1, t)
        if gy + 2 < h:
            set_t(data, w, h, x, gy + 2, a)


def gap(data: list[int], w: int, h: int, x0: int, x1: int, gy: int) -> None:
    for x in range(x0, min(x1, w)):
        for y in range(gy, h):
            set_t(data, w, h, x, y, 0)


def platform(data: list[int], w: int, h: int, x0: int, x1: int, y: int, tile: int) -> None:
    for x in range(x0, min(x1, w)):
        set_t(data, w, h, x, y, tile)


def obj(name: str, oid: int, px: int, py: int, tw: int, props: dict, ow: int | None = None, oh: int | None = None) -> dict:
    o: dict = {
        "id": oid,
        "name": name,
        "type": str(props.get("type", "")),
        "x": px,
        "y": py,
        "width": ow if ow is not None else tw,
        "height": oh if oh is not None else tw,
        "rotation": 0,
        "visible": True,
        "properties": [{"name": k, "type": "string", "value": str(v)} for k, v in props.items()],
    }
    return o


def tile_layer(name: str, lid: int, data: list[int], w: int, h: int) -> dict:
    return {
        "data": data,
        "height": h,
        "width": w,
        "id": lid,
        "name": name,
        "opacity": 1,
        "type": "tilelayer",
        "visible": True,
        "x": 0,
        "y": 0,
    }


def write_tileset(path: Path, name: str, image_rel: str, tw: int, th: int, iw: int, ih: int, extras: list[dict] | None = None) -> None:
    cols = iw // tw
    rows = ih // th
    tsj = {
        "columns": cols,
        "image": image_rel,
        "imageheight": ih,
        "imagewidth": iw,
        "margin": 0,
        "name": name,
        "spacing": 0,
        "tilecount": cols * rows,
        "tiledversion": "1.10.2",
        "tileheight": th,
        "tilewidth": tw,
        "type": "tileset",
        "version": "1.10",
        "tiles": extras or [],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(tsj, indent=2) + "\n")


def write_map(
    path: Path,
    *,
    w: int,
    h: int,
    tw: int,
    layers: list[dict],
    tileset_src: str,
    props: list[dict],
    nextoid: int,
) -> None:
    tiled = {
        "compressionlevel": -1,
        "height": h,
        "width": w,
        "infinite": False,
        "layers": layers,
        "nextlayerid": 100,
        "nextobjectid": nextoid,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "tileheight": tw,
        "tilewidth": tw,
        "tilesets": [{"firstgid": 1, "source": tileset_src}],
        "type": "map",
        "version": "1.10",
        "properties": props,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(tiled, indent=2) + "\n")
    print(f"  {path.relative_to(ROOT)} ({w}x{h} @ {tw}px)")


# ---------------------------------------------------------------------------
# Fase 1 — Esgoto 16px
# ---------------------------------------------------------------------------

def generate_fase1() -> None:
    from generate_fase1_map import main as gen1

    gen1()


# ---------------------------------------------------------------------------
# Shared heightmap helpers (side-view Mario/Celeste)
# ---------------------------------------------------------------------------

def materialize_surface(ground, w, h, surface, floor_a, floor_b, fill):
    for x, sy in enumerate(surface):
        if sy is None:
            continue
        set_t(ground, w, h, x, sy, floor_a if x % 2 == 0 else floor_b)
        for y in range(sy + 1, h):
            set_t(ground, w, h, x, y, fill)


def set_span(surface, x0, x1, y, w):
    for x in range(x0, min(x1, w)):
        surface[x] = y


# ---------------------------------------------------------------------------
# Fase 2 — Industrial 32px (vertical)
# ---------------------------------------------------------------------------

def generate_fase2() -> None:
    TW = 32
    W, H = 380, 22
    FLOOR, FLOOR2, FILL, HAZARD, DECO = 1, 2, 3, 4, 5
    out = MAPS / "industrial"
    write_tileset(
        out / "tileset-industrial.tsj",
        "industrial",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1.png",
        TW, TW, 192, 128,
        [
            {"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]},
            {"id": 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
            {"id": 3, "properties": [{"name": "hazard", "type": "bool", "value": True}]},
        ],
    )
    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    surface: list[int | None] = [None] * W
    objects: list[dict] = []
    oid = 1

    def add(name, tx, ty, props, ow=None, oh=None):
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    # Início baixo → gap largo (precisa double jump) → platô alto
    set_span(surface, 0, 20, 16, W)
    add("spawn", 3, 14, {"type": "spawn"})
    # gap 20–30
    set_span(surface, 30, 50, 12, W)
    add("double_jump_hint", 30, 10, {"type": "tutorial", "skill": "double_jump"})

    # Teste seguro em degraus
    set_span(surface, 50, 58, 14, W)
    set_span(surface, 62, 70, 10, W)
    set_span(surface, 74, 85, 15, W)
    set_span(surface, 90, 110, 11, W)

    # Rota risco elevada
    set_span(surface, 110, 150, 16, W)
    platform(ground, W, H, 118, 145, 6, FLOOR)
    for i, cx in enumerate(range(120, 142, 5)):
        add(f"credit_risk_{i}", cx, 4, {"type": "credit", "route": "risk", "id": f"f2-r-{i}"})

    # Slide em corredor alto
    set_span(surface, 150, 175, 9, W)
    for px in range(155, 170):
        set_t(hazards, W, H, px, 6, FILL)

    # Prensas em plataforma média
    set_span(surface, 175, 210, 13, W)
    for i, px in enumerate((180, 192, 204)):
        set_t(hazards, W, H, px, 11, HAZARD)
        set_t(hazards, W, H, px, 12, HAZARD)
        add(f"press_{i}", px, 10, {"type": "hazard", "kind": "press"})

    # Esteiras descendo
    set_span(surface, 210, 240, 15, W)
    for px in range(215, 235):
        set_t(deco, W, H, px, 15, DECO)
    add("conveyor", 215, 15, {"type": "hazard", "kind": "conveyor", "dir": "right"}, ow=20 * TW, oh=TW)

    # Vapor + braços em altura
    set_span(surface, 240, 255, 12, W)
    for i, px in enumerate((245, 250)):
        add(f"steam_{i}", px, 10, {"type": "hazard", "kind": "steam"})
    set_span(surface, 255, 270, 8, W)
    # gap
    set_span(surface, 278, 295, 14, W)
    add("mech_arm_0", 272, 6, {"type": "hazard", "kind": "mech_arm"})
    add("crusher_0", 285, 12, {"type": "hazard", "kind": "crusher"})

    # Checkpoint alto
    set_span(surface, 295, 320, 7, W)
    add("checkpoint_1", 305, 5, {"type": "checkpoint", "id": "f2-cp1"})

    # Combinação final + clínica
    set_span(surface, 320, 340, 11, W)
    for px in range(325, 335):
        set_t(hazards, W, H, px, 8, FILL)
    set_span(surface, 340, 355, 15, W)
    # gap
    set_span(surface, 362, W, 13, W)
    add("clinic_exit", 370, 11, {"type": "clinic", "next": "ClinicScene", "implante": "bracos"})
    add("phase_end", 375, 11, {"type": "phase_end", "fase": "2"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    # floating assists
    platform(ground, W, H, 22, 26, 14, FLOOR)
    platform(ground, W, H, 272, 276, 11, FLOOR)
    platform(ground, W, H, 356, 360, 10, FLOOR)

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-2.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-industrial.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 2},
            {"name": "setor", "type": "string", "value": "industrial"},
            {"name": "perspective", "type": "string", "value": "side-view"},
            {"name": "gdd", "type": "string", "value": "§16.2 + issue #4"},
            {"name": "skill", "type": "string", "value": "double_jump"},
        ], nextoid=oid)
    (out / "credits.txt").write_text("Fase 2 — Industrial side-view vertical\npython3 scripts/generate_tiled_maps.py --fase 2\n")


def generate_fase3() -> None:
    TW = 32
    W, H = 360, 22
    FLOOR, FLOOR2, FILL, BAR = 1, 2, 3, 4
    out = MAPS / "meio-urbano"
    write_tileset(out / "tileset-meio-urbano.tsj", "meio-urbano",
        "../../tiles/meio-urbano/tiles/tileset-interim.png", TW, TW, 96, 96,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]}])
    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    surface: list[int | None] = [None] * W
    objects: list[dict] = []
    oid = 1

    def add(name, tx, ty, props, ow=None, oh=None):
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    set_span(surface, 0, 25, 16, W)
    add("spawn", 3, 14, {"type": "spawn"})
    # Barricada na rua
    set_span(surface, 25, 50, 16, W)
    for px in range(35, 39):
        set_t(hazards, W, H, px, 14, BAR)
        set_t(hazards, W, H, px, 15, BAR)
    add("breakable_tutorial", 35, 14, {"type": "breakable", "id": "f3-bar-0"}, ow=4 * TW, oh=2 * TW)

    # Bandido + rooftop
    set_span(surface, 50, 90, 17, W)
    add("bandido_0", 65, 15, {"type": "enemy", "kind": "bandido"})
    platform(ground, W, H, 70, 88, 8, FLOOR)  # rooftop
    add("credit_bandido", 75, 6, {"type": "credit", "route": "roof", "id": "f3-c0"})

    # Drone no ar + slide embaixo
    set_span(surface, 90, 130, 15, W)
    add("drone_0", 105, 6, {"type": "enemy", "kind": "drone"})
    for px in range(100, 115):
        set_t(hazards, W, H, px, 12, FILL)

    # Área vertical: rua vs rooftops
    set_span(surface, 130, 180, 18, W)
    platform(ground, W, H, 140, 175, 7, FLOOR)
    for i, cx in enumerate(range(145, 170, 6)):
        add(f"credit_roof_{i}", cx, 5, {"type": "credit", "route": "roof", "id": f"f3-roof-{i}"})
    add("bandido_1", 155, 16, {"type": "enemy", "kind": "bandido"})

    # Portão elétrico + checkpoint alto
    set_span(surface, 180, 210, 12, W)
    add("electric_gate", 190, 9, {"type": "hazard", "kind": "electric_gate"}, ow=2 * TW, oh=3 * TW)
    add("checkpoint_1", 200, 10, {"type": "checkpoint", "id": "f3-cp1"})

    # Combate em desnível
    set_span(surface, 210, 250, 14, W)
    add("bandido_2", 220, 12, {"type": "enemy", "kind": "bandido"})
    # gap
    set_span(surface, 256, 280, 10, W)
    add("drone_1", 262, 5, {"type": "enemy", "kind": "drone"})

    # Escolha agressiva (rua) / evasiva (alto)
    set_span(surface, 280, 330, 16, W)
    add("bandido_3", 290, 14, {"type": "enemy", "kind": "bandido"})
    add("bandido_4", 305, 14, {"type": "enemy", "kind": "bandido"})
    platform(ground, W, H, 295, 325, 8, FLOOR)

    set_span(surface, 330, W, 13, W)
    add("clinic_exit", 345, 11, {"type": "clinic", "next": "ClinicScene", "implante": "olhos"})
    add("phase_end", 352, 11, {"type": "phase_end", "fase": "3"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-3.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-meio-urbano.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 3},
            {"name": "setor", "type": "string", "value": "meio-urbano"},
            {"name": "perspective", "type": "string", "value": "side-view"},
            {"name": "skill", "type": "string", "value": "attack"},
        ], nextoid=oid)
    (out / "credits.txt").write_text("Fase 3 — Meio Urbano side-view (rua + rooftops)\n")


def generate_fase4() -> None:
    TW = 32
    W, H = 360, 22
    FLOOR, FLOOR2, FILL, FAKE = 1, 2, 3, 5
    out = MAPS / "corporativo"
    write_tileset(out / "tileset-corporativo.tsj", "corporativo",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1B.png", TW, TW, 192, 128,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]},
         {"id": 4, "properties": [{"name": "fake", "type": "bool", "value": True}]}])
    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    surface: list[int | None] = [None] * W
    objects: list[dict] = []
    oid = 1

    def add(name, tx, ty, props, ow=None, oh=None):
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    set_span(surface, 0, 30, 15, W)
    add("spawn", 3, 13, {"type": "spawn"})
    # Rota escondida alta (scan)
    set_span(surface, 30, 60, 15, W)
    platform(ground, W, H, 40, 55, 7, FLOOR)
    add("scan_tutorial", 38, 12, {"type": "tutorial", "skill": "scan"})
    add("hidden_route", 42, 7, {"type": "scan_reveal", "id": "f4-hidden-0"}, ow=4 * TW, oh=2 * TW)

    # Parede falsa vertical
    set_span(surface, 60, 90, 14, W)
    for px in range(70, 74):
        for dy in range(3):
            set_t(hazards, W, H, px, 11 + dy, FILL)
    add("false_wall", 70, 11, {"type": "scan_reveal", "kind": "false_wall"}, ow=4 * TW, oh=3 * TW)

    # Lasers em shaft
    set_span(surface, 90, 110, 16, W)
    set_span(surface, 110, 130, 9, W)
    for i, px in enumerate((115, 120, 125)):
        add(f"laser_{i}", px, 5, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)

    # Portas + pisos falsos
    set_span(surface, 130, 170, 13, W)
    add("auto_door_0", 140, 10, {"type": "hazard", "kind": "auto_door"}, ow=2 * TW, oh=3 * TW)
    for px in range(150, 158):
        set_t(ground, W, H, px, 13, FAKE)
    add("false_floor", 150, 13, {"type": "scan_reveal", "kind": "false_floor"}, ow=8 * TW, oh=TW)

    # Checkpoint elevado
    set_span(surface, 170, 200, 8, W)
    add("checkpoint_1", 180, 6, {"type": "checkpoint", "id": "f4-cp1"})

    # Combinação + propaganda
    set_span(surface, 200, 250, 12, W)
    add("laser_final", 220, 8, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)
    # gap
    set_span(surface, 258, 300, 15, W)
    add("propaganda_pai", 270, 8, {"type": "narrative", "asset": "narrative/father/propaganda-pai.png"}, ow=4 * TW, oh=3 * TW)
    set_span(surface, 300, W, 14, W)
    add("clinic_exit", 340, 12, {"type": "clinic", "next": "ClinicScene", "implante": "propulsores"})
    add("phase_end", 350, 12, {"type": "phase_end", "fase": "4"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-4.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-corporativo.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 4},
            {"name": "setor", "type": "string", "value": "corporativo"},
            {"name": "perspective", "type": "string", "value": "side-view"},
            {"name": "skill", "type": "string", "value": "scan"},
            {"name": "parallax", "type": "string", "value": "tiles/corporativo/parallax"},
        ], nextoid=oid)
    (out / "credits.txt").write_text("Fase 4 — Corporativo side-view\n")


def generate_fase5() -> None:
    TW = 32
    W, H = 420, 24
    FLOOR, FLOOR2, FILL = 1, 2, 3
    out = MAPS / "topo"
    write_tileset(out / "tileset-topo.tsj", "topo",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1C.png", TW, TW, 96, 96,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]}])
    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    surface: list[int | None] = [None] * W
    objects: list[dict] = []
    oid = 1

    def add(name, tx, ty, props, ow=None, oh=None):
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    set_span(surface, 0, 25, 16, W)
    add("spawn", 3, 14, {"type": "spawn"})
    # Grande vão de dash (alto → alto)
    set_span(surface, 25, 32, 12, W)
    # gap 32–48
    set_span(surface, 48, 70, 10, W)
    add("dash_tutorial", 30, 10, {"type": "tutorial", "skill": "dash"})

    # Dash + salto em escada
    set_span(surface, 70, 85, 14, W)
    # gap
    set_span(surface, 92, 110, 8, W)
    platform(ground, W, H, 86, 90, 11, FLOOR)

    # Laser grid em shaft vertical
    set_span(surface, 110, 140, 15, W)
    for i, px in enumerate(range(118, 136, 4)):
        add(f"laser_grid_{i}", px, 6, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=8 * TW)

    # Barreiras / portas em altura
    set_span(surface, 140, 170, 11, W)
    add("rotating_0", 150, 8, {"type": "hazard", "kind": "rotating_barrier"}, ow=2 * TW, oh=3 * TW)
    add("timed_door_0", 160, 8, {"type": "hazard", "kind": "timed_door"}, ow=2 * TW, oh=3 * TW)

    # Checkpoint no alto
    set_span(surface, 170, 195, 7, W)
    add("checkpoint_1", 180, 5, {"type": "checkpoint", "id": "f5-cp1"})

    # Domínio do kit — sobe e desce
    set_span(surface, 195, 220, 12, W)
    # gap dash
    set_span(surface, 232, 250, 9, W)
    add("breakable_kit", 240, 7, {"type": "breakable", "id": "f5-bar-0"}, ow=3 * TW, oh=2 * TW)
    for px in range(240, 243):
        set_t(hazards, W, H, px, 7, FILL)
        set_t(hazards, W, H, px, 8, FILL)
    set_span(surface, 250, 280, 14, W)
    add("scan_kit", 260, 12, {"type": "scan_reveal", "id": "f5-scan-0"}, ow=3 * TW, oh=2 * TW)
    # gap
    set_span(surface, 288, 320, 10, W)

    # Desafio final
    set_span(surface, 320, 360, 13, W)
    for i, px in enumerate(range(330, 355, 6)):
        add(f"laser_final_{i}", px, 6, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=6 * TW)

    # Contemplativo — platô largo alto
    set_span(surface, 360, 395, 9, W)
    add("contemplative_start", 365, 7, {"type": "zone", "kind": "contemplative"})

    # Portão no topo
    set_span(surface, 395, W, 8, W)
    add("portao", 400, 3, {"type": "gate", "asset": "narrative/gate/portao.png", "choices": "chrome,flesh"}, ow=4 * TW, oh=5 * TW)
    add("choice_chrome", 398, 6, {"type": "ending_choice", "ending": "chrome"})
    add("choice_flesh", 406, 6, {"type": "ending_choice", "ending": "flesh"})
    add("phase_end", 415, 6, {"type": "phase_end", "fase": "5"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    platform(ground, W, H, 35, 40, 14, FLOOR)
    platform(ground, W, H, 222, 228, 11, FLOOR)

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-5.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-topo.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 5},
            {"name": "setor", "type": "string", "value": "topo"},
            {"name": "perspective", "type": "string", "value": "side-view"},
            {"name": "skill", "type": "string", "value": "dash+kit"},
            {"name": "parallax", "type": "string", "value": "tiles/topo/parallax"},
        ], nextoid=oid)
    (out / "credits.txt").write_text("Fase 5 — Topo side-view + Portão elevado\n")


def update_readme() -> None:
    (MAPS / "README.md").write_text(
        """# Mapas Tiled — Flesh to Chrome

Gerados a partir de `levelDesign.md` + GDD §16 (draft jogável; editável no Tiled).

## Arquivos

| Fase | Setor | Mapa | Tile |
| --- | --- | --- | --- |
| 1 | Esgoto | `esgoto/fase-1.json` | 16×16 |
| 2 | Industrial | `industrial/fase-2.json` | 32×32 |
| 3 | Meio Urbano | `meio-urbano/fase-3.json` | 32×32 |
| 4 | Corporativo | `corporativo/fase-4.json` | 32×32 |
| 5 | Topo | `topo/fase-5.json` | 32×32 |

## Camadas (todas as fases)

- `deco` — decoração / teto
- `ground` — colisão, plataformas, gaps
- `hazards` — canos, prensas, barricadas (tiles)
- `objects` — spawn, checkpoint, créditos, inimigos, clínica, Portão

## Regenerar

```bash
python3 scripts/generate_tiled_maps.py          # todas
python3 scripts/generate_tiled_maps.py --fase 3 # uma fase
```

## Abrir no Tiled

1. Instale https://www.mapeditor.org/
2. **File → Open** → `public/assets/maps/<setor>/fase-N.json`
3. Edite e salve

## Phaser (Vitor)

```js
this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json');
this.load.image('sewer', 'assets/tiles/esgoto/tiles/tilesetSewer.png');
const map = this.make.tilemap({ key: 'fase-1' });
```

Object types úteis: `spawn`, `checkpoint`, `credit`, `clinic`, `enemy`,
`hazard`, `breakable`, `scan_reveal`, `gate`, `ending_choice`, `phase_end`.
"""
    )


def update_sectors() -> None:
    path = ROOT / "public/assets/tiles/sectors.json"
    data = json.loads(path.read_text())
    mapas = {
        "esgoto": "maps/esgoto/fase-1.json",
        "industrial": "maps/industrial/fase-2.json",
        "meio-urbano": "maps/meio-urbano/fase-3.json",
        "corporativo": "maps/corporativo/fase-4.json",
        "topo": "maps/topo/fase-5.json",
    }
    for sector in data.get("ascensao", []):
        sid = sector.get("id")
        if sid in mapas:
            sector["mapa"] = mapas[sid]
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("  updated sectors.json")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fase", type=int, choices=[1, 2, 3, 4, 5], help="Só uma fase")
    args = parser.parse_args()

    gens = {1: generate_fase1, 2: generate_fase2, 3: generate_fase3, 4: generate_fase4, 5: generate_fase5}
    print("Gerando mapas Tiled...")
    if args.fase:
        gens[args.fase]()
    else:
        # fase 1 via script dedicado (já existe)
        import importlib.util

        spec = importlib.util.spec_from_file_location("generate_fase1_map", ROOT / "scripts/generate_fase1_map.py")
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.main()
        for f in (2, 3, 4, 5):
            gens[f]()
    update_readme()
    update_sectors()
    print("Concluído.")


if __name__ == "__main__":
    main()

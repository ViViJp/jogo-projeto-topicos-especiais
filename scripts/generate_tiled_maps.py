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
# Fase 2 — Industrial 32px
# ---------------------------------------------------------------------------

def generate_fase2() -> None:
    TW = 32
    W, H = 420, 16
    GY = 12
    # tileset 192×128 → 6×4
    FLOOR, FLOOR2, WALL, HAZARD, DECO = 1, 2, 3, 4, 5
    out = MAPS / "industrial"
    write_tileset(
        out / "tileset-industrial.tsj",
        "industrial",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1.png",
        TW,
        TW,
        192,
        128,
        [
            {"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]},
            {"id": 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
            {"id": 3, "properties": [{"name": "hazard", "type": "bool", "value": True}, {"name": "kind", "type": "string", "value": "press"}]},
        ],
    )

    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    objects: list[dict] = []
    oid = 1

    def add(name: str, tx: int, ty: int, props: dict, ow: int | None = None, oh: int | None = None) -> None:
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    # Início + gap impossível com salto simples (largo)
    fill_floor(ground, W, H, 0, 25, GY, FLOOR, FLOOR2)
    add("spawn", 2, GY - 2, {"type": "spawn"})
    gap(ground, W, H, 25, 34, GY)  # gap largo — precisa salto duplo
    fill_floor(ground, W, H, 34, 55, GY, FLOOR, FLOOR2)
    add("double_jump_hint", 34, GY - 3, {"type": "tutorial", "skill": "double_jump"})

    # Teste seguro (gaps menores)
    x = 55
    for _ in range(3):
        fill_floor(ground, W, H, x, x + 6, GY, FLOOR, FLOOR2)
        gap(ground, W, H, x + 6, x + 10, GY)
        x += 10
    fill_floor(ground, W, H, x, 100, GY, FLOOR, FLOOR2)

    # Gaps variados + rota risco
    fill_floor(ground, W, H, 100, 140, GY, FLOOR, FLOOR2)
    platform(ground, W, H, 110, 135, GY - 4, FLOOR)
    for i, cx in enumerate(range(112, 134, 6)):
        add(f"credit_risk_{i}", cx, GY - 6, {"type": "credit", "route": "risk", "id": f"f2-r-{i}"})

    # Salto duplo + slide
    fill_floor(ground, W, H, 140, 170, GY, FLOOR, FLOOR2)
    for px in range(150, 162):
        set_t(hazards, W, H, px, GY - 2, WALL)  # cano baixo / slide

    # Prensas
    fill_floor(ground, W, H, 170, 200, GY, FLOOR, FLOOR2)
    for i, px in enumerate((175, 185, 195)):
        set_t(hazards, W, H, px, GY - 1, HAZARD)
        set_t(hazards, W, H, px, GY - 2, HAZARD)
        add(f"press_{i}", px, GY - 3, {"type": "hazard", "kind": "press"})

    # Esteiras
    fill_floor(ground, W, H, 200, 230, GY, FLOOR, FLOOR2)
    for px in range(205, 225):
        set_t(deco, W, H, px, GY, DECO)
    add("conveyor", 205, GY, {"type": "hazard", "kind": "conveyor", "dir": "right"}, ow=20 * TW, oh=TW)

    # Jatos de vapor
    fill_floor(ground, W, H, 230, 255, GY, FLOOR, FLOOR2)
    for i, px in enumerate((235, 242, 249)):
        add(f"steam_{i}", px, GY - 2, {"type": "hazard", "kind": "steam"})

    # Braços mecânicos + trituradoras
    fill_floor(ground, W, H, 255, 290, GY, FLOOR, FLOOR2)
    gap(ground, W, H, 265, 270, GY)
    gap(ground, W, H, 278, 283, GY)
    add("mech_arm_0", 268, GY - 4, {"type": "hazard", "kind": "mech_arm"})
    add("crusher_0", 280, GY - 3, {"type": "hazard", "kind": "crusher"})

    # Checkpoint
    fill_floor(ground, W, H, 290, 320, GY, FLOOR, FLOOR2)
    add("checkpoint_1", 300, GY - 2, {"type": "checkpoint", "id": "f2-cp1"})

    # Combinação final
    fill_floor(ground, W, H, 320, 380, GY, FLOOR, FLOOR2)
    for px in range(330, 340):
        set_t(hazards, W, H, px, GY - 2, WALL)
    set_t(hazards, W, H, 350, GY - 1, HAZARD)
    add("steam_final", 360, GY - 2, {"type": "hazard", "kind": "steam"})
    gap(ground, W, H, 368, 374, GY)

    fill_floor(ground, W, H, 380, W, GY, FLOOR, FLOOR2)
    add("clinic_exit", 400, GY - 2, {"type": "clinic", "next": "ClinicScene", "implante": "bracos"})
    add("phase_end", 410, GY - 2, {"type": "phase_end", "fase": "2"})

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
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
    ]
    write_map(
        out / "fase-2.json",
        w=W,
        h=H,
        tw=TW,
        layers=layers,
        tileset_src="tileset-industrial.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 2},
            {"name": "setor", "type": "string", "value": "industrial"},
            {"name": "gdd", "type": "string", "value": "§16.2 + levelDesign.md Fase 2"},
            {"name": "implante", "type": "string", "value": "bracos"},
            {"name": "skill", "type": "string", "value": "double_jump"},
        ],
        nextoid=oid,
    )
    (out / "credits.txt").write_text(
        "Fase 2 — Industrial (Tiled)\n"
        "Layout: levelDesign.md Fase 2 + GDD §16.2\n"
        "Tileset: Atomic Realm Industrial 32×32\n"
        "Regenerar: python3 scripts/generate_tiled_maps.py --fase 2\n"
    )


# ---------------------------------------------------------------------------
# Fase 3 — Meio Urbano (interim 32px / tileset 96×96 → 3×3)
# ---------------------------------------------------------------------------

def generate_fase3() -> None:
    TW = 32
    W, H = 400, 16
    GY = 12
    FLOOR, FLOOR2, WALL, BARRICADE = 1, 2, 3, 4
    out = MAPS / "meio-urbano"
    write_tileset(
        out / "tileset-meio-urbano.tsj",
        "meio-urbano",
        "../../tiles/meio-urbano/tiles/tileset-interim.png",
        TW,
        TW,
        96,
        96,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]}],
    )

    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    objects: list[dict] = []
    oid = 1

    def add(name: str, tx: int, ty: int, props: dict, ow: int | None = None, oh: int | None = None) -> None:
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    fill_floor(ground, W, H, 0, 30, GY, FLOOR, FLOOR2)
    add("spawn", 2, GY - 2, {"type": "spawn"})

    # Barricada + tutorial ataque
    fill_floor(ground, W, H, 30, 50, GY, FLOOR, FLOOR2)
    for px in range(38, 42):
        set_t(hazards, W, H, px, GY - 1, BARRICADE)
        set_t(hazards, W, H, px, GY - 2, BARRICADE)
    add("breakable_tutorial", 38, GY - 2, {"type": "breakable", "id": "f3-bar-0"}, ow=4 * TW, oh=2 * TW)

    # Bandido
    fill_floor(ground, W, H, 50, 90, GY, FLOOR, FLOOR2)
    add("bandido_0", 65, GY - 2, {"type": "enemy", "kind": "bandido"})
    add("credit_bandido", 70, GY - 2, {"type": "credit", "route": "combat", "id": "f3-c0"})
    platform(ground, W, H, 75, 85, GY - 4, FLOOR)  # rota evitar

    # Drone
    fill_floor(ground, W, H, 90, 130, GY, FLOOR, FLOOR2)
    add("drone_0", 105, GY - 6, {"type": "enemy", "kind": "drone"})
    for px in range(110, 120):
        set_t(hazards, W, H, px, GY - 2, WALL)  # slide sob drone
    add("credit_drone", 112, GY - 7, {"type": "credit", "route": "air", "id": "f3-c1"})

    # Barricadas + área vertical (rooftop / rua)
    fill_floor(ground, W, H, 130, 180, GY, FLOOR, FLOOR2)
    for px in range(140, 144):
        set_t(hazards, W, H, px, GY - 1, BARRICADE)
    add("breakable_1", 140, GY - 1, {"type": "breakable", "id": "f3-bar-1"}, ow=4 * TW, oh=TW)
    platform(ground, W, H, 150, 175, GY - 5, FLOOR)  # rooftops
    for i, cx in enumerate(range(155, 172, 5)):
        add(f"credit_roof_{i}", cx, GY - 7, {"type": "credit", "route": "roof", "id": f"f3-roof-{i}"})
    add("bandido_1", 160, GY - 2, {"type": "enemy", "kind": "bandido"})

    # Portão elétrico + checkpoint
    fill_floor(ground, W, H, 180, 220, GY, FLOOR, FLOOR2)
    add("electric_gate", 195, GY - 3, {"type": "hazard", "kind": "electric_gate"}, ow=2 * TW, oh=3 * TW)
    add("checkpoint_1", 210, GY - 2, {"type": "checkpoint", "id": "f3-cp1"})

    # Combate + movimento
    fill_floor(ground, W, H, 220, 280, GY, FLOOR, FLOOR2)
    add("bandido_2", 230, GY - 2, {"type": "enemy", "kind": "bandido"})
    gap(ground, W, H, 240, 245, GY)
    add("drone_1", 250, GY - 5, {"type": "enemy", "kind": "drone"})
    for px in range(255, 260):
        set_t(hazards, W, H, px, GY - 1, BARRICADE)
    for px in range(265, 275):
        set_t(hazards, W, H, px, GY - 2, WALL)

    # Escolha agressiva / evasiva
    fill_floor(ground, W, H, 280, 340, GY, FLOOR, FLOOR2)
    add("bandido_3", 290, GY - 2, {"type": "enemy", "kind": "bandido"})
    add("bandido_4", 300, GY - 2, {"type": "enemy", "kind": "bandido"})
    platform(ground, W, H, 310, 335, GY - 4, FLOOR)
    for i, cx in enumerate(range(292, 305, 4)):
        add(f"credit_agg_{i}", cx, GY - 2, {"type": "credit", "route": "aggressive", "id": f"f3-a-{i}"})

    fill_floor(ground, W, H, 340, W, GY, FLOOR, FLOOR2)
    add("clinic_exit", 380, GY - 2, {"type": "clinic", "next": "ClinicScene", "implante": "olhos"})
    add("phase_end", 390, GY - 2, {"type": "phase_end", "fase": "3"})

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
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
    ]
    write_map(
        out / "fase-3.json",
        w=W,
        h=H,
        tw=TW,
        layers=layers,
        tileset_src="tileset-meio-urbano.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 3},
            {"name": "setor", "type": "string", "value": "meio-urbano"},
            {"name": "gdd", "type": "string", "value": "§16.3 + levelDesign.md Fase 3"},
            {"name": "implante", "type": "string", "value": "olhos"},
            {"name": "skill", "type": "string", "value": "attack"},
        ],
        nextoid=oid,
    )
    (out / "credits.txt").write_text(
        "Fase 3 — Meio Urbano (Tiled)\n"
        "Layout: levelDesign.md Fase 3 + GDD §16.3\n"
        "Tileset interim: Industrial 1C (substituir por Future City 27)\n"
        "Inimigos: objects bandido/drone → npcs/enemies/\n"
        "Regenerar: python3 scripts/generate_tiled_maps.py --fase 3\n"
    )


# ---------------------------------------------------------------------------
# Fase 4 — Corporativo (industrial limpo + objects scan/laser)
# ---------------------------------------------------------------------------

def generate_fase4() -> None:
    TW = 32
    W, H = 400, 16
    GY = 12
    FLOOR, FLOOR2, WALL, FAKE = 1, 2, 3, 5
    out = MAPS / "corporativo"
    write_tileset(
        out / "tileset-corporativo.tsj",
        "corporativo",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1B.png",
        TW,
        TW,
        192,
        128,
        [
            {"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]},
            {"id": 4, "properties": [{"name": "fake", "type": "bool", "value": True}, {"name": "scan", "type": "bool", "value": True}]},
        ],
    )

    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    objects: list[dict] = []
    oid = 1

    def add(name: str, tx: int, ty: int, props: dict, ow: int | None = None, oh: int | None = None) -> None:
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    fill_floor(ground, W, H, 0, 35, GY, FLOOR, FLOOR2)
    add("spawn", 2, GY - 2, {"type": "spawn"})

    # Rota escondida + scan tutorial
    fill_floor(ground, W, H, 35, 70, GY, FLOOR, FLOOR2)
    for px in range(48, 52):
        set_t(deco, W, H, px, GY - 1, FAKE)
        set_t(deco, W, H, px, GY - 2, FAKE)
    add("hidden_route", 48, GY - 2, {"type": "scan_reveal", "id": "f4-hidden-0"}, ow=4 * TW, oh=2 * TW)
    add("scan_tutorial", 45, GY - 3, {"type": "tutorial", "skill": "scan"})
    platform(ground, W, H, 52, 68, GY - 4, FLOOR)  # rota revelada

    # Parede falsa
    fill_floor(ground, W, H, 70, 100, GY, FLOOR, FLOOR2)
    for px in range(80, 84):
        set_t(hazards, W, H, px, GY - 1, WALL)
        set_t(hazards, W, H, px, GY - 2, WALL)
        set_t(hazards, W, H, px, GY - 3, WALL)
    add("false_wall", 80, GY - 3, {"type": "scan_reveal", "kind": "false_wall", "id": "f4-wall-0"}, ow=4 * TW, oh=3 * TW)

    # Armadilha oculta
    fill_floor(ground, W, H, 100, 130, GY, FLOOR, FLOOR2)
    add("trap_hidden", 115, GY, {"type": "scan_reveal", "kind": "trap", "id": "f4-trap-0"}, ow=3 * TW, oh=TW)

    # Scan + salto duplo
    fill_floor(ground, W, H, 130, 160, GY, FLOOR, FLOOR2)
    gap(ground, W, H, 140, 148, GY)
    platform(ground, W, H, 142, 146, GY - 3, FLOOR)
    add("scan_platform", 142, GY - 3, {"type": "scan_reveal", "id": "f4-plat-0"}, ow=4 * TW, oh=TW)

    # Lasers
    fill_floor(ground, W, H, 160, 200, GY, FLOOR, FLOOR2)
    for i, px in enumerate((170, 180, 190)):
        add(f"laser_{i}", px, GY - 4, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)

    # Portas automatizadas
    fill_floor(ground, W, H, 200, 230, GY, FLOOR, FLOOR2)
    add("auto_door_0", 210, GY - 3, {"type": "hazard", "kind": "auto_door"}, ow=2 * TW, oh=3 * TW)
    add("auto_door_1", 220, GY - 3, {"type": "hazard", "kind": "auto_door"}, ow=2 * TW, oh=3 * TW)

    # Pisos falsos
    fill_floor(ground, W, H, 230, 270, GY, FLOOR, FLOOR2)
    for px in range(240, 248):
        set_t(ground, W, H, px, GY, FAKE)  # cai sem scan
    add("false_floor", 240, GY, {"type": "scan_reveal", "kind": "false_floor", "id": "f4-floor-0"}, ow=8 * TW, oh=TW)

    # Checkpoint
    fill_floor(ground, W, H, 270, 300, GY, FLOOR, FLOOR2)
    add("checkpoint_1", 280, GY - 2, {"type": "checkpoint", "id": "f4-cp1"})

    # Combinação final
    fill_floor(ground, W, H, 300, 360, GY, FLOOR, FLOOR2)
    add("hidden_final", 310, GY - 2, {"type": "scan_reveal", "id": "f4-hidden-1"}, ow=3 * TW, oh=2 * TW)
    gap(ground, W, H, 320, 326, GY)
    add("laser_final", 335, GY - 4, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)
    add("auto_door_final", 345, GY - 3, {"type": "hazard", "kind": "auto_door"}, ow=2 * TW, oh=3 * TW)

    # Propaganda do pai
    fill_floor(ground, W, H, 360, W, GY, FLOOR, FLOOR2)
    add("propaganda_pai", 370, GY - 5, {"type": "narrative", "asset": "narrative/father/propaganda-pai.png"}, ow=4 * TW, oh=3 * TW)
    add("clinic_exit", 385, GY - 2, {"type": "clinic", "next": "ClinicScene", "implante": "propulsores"})
    add("phase_end", 392, GY - 2, {"type": "phase_end", "fase": "4"})

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
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
    ]
    write_map(
        out / "fase-4.json",
        w=W,
        h=H,
        tw=TW,
        layers=layers,
        tileset_src="tileset-corporativo.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 4},
            {"name": "setor", "type": "string", "value": "corporativo"},
            {"name": "gdd", "type": "string", "value": "§16.4 + levelDesign.md Fase 4"},
            {"name": "implante", "type": "string", "value": "propulsores"},
            {"name": "skill", "type": "string", "value": "scan"},
            {"name": "parallax", "type": "string", "value": "tiles/corporativo/parallax"},
        ],
        nextoid=oid,
    )
    (out / "credits.txt").write_text(
        "Fase 4 — Corporativo (Tiled)\n"
        "Layout: levelDesign.md Fase 4 + GDD §16.4\n"
        "Tileset: Industrial 1B + parallax bulkhead\n"
        "Objects: scan_reveal, laser, auto_door, propaganda_pai\n"
        "Regenerar: python3 scripts/generate_tiled_maps.py --fase 4\n"
    )


# ---------------------------------------------------------------------------
# Fase 5 — Topo + Portão
# ---------------------------------------------------------------------------

def generate_fase5() -> None:
    TW = 32
    W, H = 480, 16  # ~90s desafio + 30s contemplativo @ ~180-220px/s escala
    GY = 12
    FLOOR, FLOOR2, WALL = 1, 2, 3
    out = MAPS / "topo"
    write_tileset(
        out / "tileset-topo.tsj",
        "topo",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1C.png",
        TW,
        TW,
        96,
        96,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]}],
    )

    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    objects: list[dict] = []
    oid = 1

    def add(name: str, tx: int, ty: int, props: dict, ow: int | None = None, oh: int | None = None) -> None:
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh))
        oid += 1

    fill_floor(ground, W, H, 0, 30, GY, FLOOR, FLOOR2)
    add("spawn", 2, GY - 2, {"type": "spawn"})

    # Grande vão de dash
    gap(ground, W, H, 30, 48, GY)
    fill_floor(ground, W, H, 48, 70, GY, FLOOR, FLOOR2)
    add("dash_tutorial", 28, GY - 3, {"type": "tutorial", "skill": "dash"})

    # Dash + salto
    fill_floor(ground, W, H, 70, 100, GY, FLOOR, FLOOR2)
    gap(ground, W, H, 80, 88, GY)
    platform(ground, W, H, 83, 86, GY - 3, FLOOR)

    # Grades de laser
    fill_floor(ground, W, H, 100, 140, GY, FLOOR, FLOOR2)
    for i, px in enumerate(range(110, 135, 5)):
        add(f"laser_grid_{i}", px, GY - 4, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=4 * TW)

    # Barreiras rotativas
    fill_floor(ground, W, H, 140, 170, GY, FLOOR, FLOOR2)
    for i, px in enumerate((148, 158)):
        add(f"rotating_{i}", px, GY - 3, {"type": "hazard", "kind": "rotating_barrier"}, ow=2 * TW, oh=3 * TW)

    # Portas temporizadas
    fill_floor(ground, W, H, 170, 200, GY, FLOOR, FLOOR2)
    add("timed_door_0", 180, GY - 3, {"type": "hazard", "kind": "timed_door"}, ow=2 * TW, oh=3 * TW)
    add("timed_door_1", 190, GY - 3, {"type": "hazard", "kind": "timed_door"}, ow=2 * TW, oh=3 * TW)

    # Checkpoint
    fill_floor(ground, W, H, 200, 230, GY, FLOOR, FLOOR2)
    add("checkpoint_1", 210, GY - 2, {"type": "checkpoint", "id": "f5-cp1"})

    # Domínio do kit (dash + salto + ataque + scan)
    fill_floor(ground, W, H, 230, 320, GY, FLOOR, FLOOR2)
    gap(ground, W, H, 240, 250, GY)  # dash
    add("breakable_kit", 260, GY - 2, {"type": "breakable", "id": "f5-bar-0"}, ow=3 * TW, oh=2 * TW)
    for px in range(260, 263):
        set_t(hazards, W, H, px, GY - 1, WALL)
        set_t(hazards, W, H, px, GY - 2, WALL)
    add("scan_kit", 275, GY - 2, {"type": "scan_reveal", "id": "f5-scan-0"}, ow=3 * TW, oh=2 * TW)
    add("laser_kit", 290, GY - 4, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)
    gap(ground, W, H, 300, 310, GY)

    # Desafio final
    fill_floor(ground, W, H, 320, 380, GY, FLOOR, FLOOR2)
    for i, px in enumerate(range(330, 370, 8)):
        add(f"laser_final_{i}", px, GY - 4, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=4 * TW)
    gap(ground, W, H, 350, 358, GY)
    add("rotating_final", 365, GY - 3, {"type": "hazard", "kind": "rotating_barrier"}, ow=2 * TW, oh=3 * TW)

    # Trecho contemplativo ~30s (sem desafio)
    fill_floor(ground, W, H, 380, 450, GY, FLOOR, FLOOR2)
    add("contemplative_start", 380, GY - 2, {"type": "zone", "kind": "contemplative"})

    # Portão
    fill_floor(ground, W, H, 450, W, GY, FLOOR, FLOOR2)
    add("portao", 460, GY - 5, {"type": "gate", "asset": "narrative/gate/portao.png", "choices": "chrome,flesh"}, ow=4 * TW, oh=5 * TW)
    add("choice_chrome", 458, GY - 2, {"type": "ending_choice", "ending": "chrome"})
    add("choice_flesh", 466, GY - 2, {"type": "ending_choice", "ending": "flesh"})
    add("phase_end", 475, GY - 2, {"type": "phase_end", "fase": "5"})

    layers = [
        tile_layer("deco", 1, deco, W, H),
        tile_layer("ground", 2, ground, W, H),
        tile_layer("hazards", 3, hazards, W, H),
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
    ]
    write_map(
        out / "fase-5.json",
        w=W,
        h=H,
        tw=TW,
        layers=layers,
        tileset_src="tileset-topo.tsj",
        props=[
            {"name": "fase", "type": "int", "value": 5},
            {"name": "setor", "type": "string", "value": "topo"},
            {"name": "gdd", "type": "string", "value": "§16.5 + levelDesign.md Fase 5"},
            {"name": "skill", "type": "string", "value": "dash+kit"},
            {"name": "parallax", "type": "string", "value": "tiles/topo/parallax"},
        ],
        nextoid=oid,
    )
    (out / "credits.txt").write_text(
        "Fase 5 — Topo (Tiled)\n"
        "Layout: levelDesign.md Fase 5 + GDD §16.5\n"
        "~90s desafio + ~30s contemplativo + Portão (Chrome/Flesh)\n"
        "Regenerar: python3 scripts/generate_tiled_maps.py --fase 5\n"
    )


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

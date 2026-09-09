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
    """Industrial — montanha: começa baixo, termina alto (salto duplo)."""
    TW = 32
    W, H = 380, 24
    FLOOR, FLOOR2, FILL, HAZARD, DECO = 1, 2, 3, 4, 5
    out = MAPS / "industrial"
    write_tileset(
        out / "tileset-industrial.tsj", "industrial",
        "../../tiles/industrial/tiles/1_Industrial_Tileset_1.png", TW, TW, 192, 128,
        [{"id": 0, "properties": [{"name": "solid", "type": "bool", "value": True}]},
         {"id": 1, "properties": [{"name": "solid", "type": "bool", "value": True}]},
         {"id": 3, "properties": [{"name": "hazard", "type": "bool", "value": True}]}])
    ground, hazards, deco = empty(W, H), empty(W, H), empty(W, H)
    surface: list[int | None] = [None] * W
    objects: list[dict] = []
    oid = 1

    def add(name, tx, ty, props, ow=None, oh=None):
        nonlocal oid
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh)); oid += 1

    # Montanha: Y=20 → Y=6
    set_span(surface, 0, 22, 20, W)
    add("spawn", 3, 18, {"type": "spawn"})
    # gap largo (double jump) — aterrissa MAIS ALTO
    for x in range(22, 32):
        surface[x] = None
    set_span(surface, 32, 55, 15, W)
    add("double_jump_hint", 32, 13, {"type": "tutorial", "skill": "double_jump"})
    platform(ground, W, H, 25, 29, 17, FLOOR)

    set_span(surface, 55, 70, 14, W)
    for x in range(70, 74):
        surface[x] = None
    set_span(surface, 74, 95, 12, W)
    for x in range(95, 99):
        surface[x] = None
    set_span(surface, 99, 120, 11, W)

    # Rota risco ainda mais alta
    set_span(surface, 120, 160, 12, W)
    platform(ground, W, H, 128, 155, 5, FLOOR)
    for i, cx in enumerate(range(130, 152, 5)):
        add(f"credit_risk_{i}", cx, 3, {"type": "credit", "route": "risk", "id": f"f2-r-{i}"})

    set_span(surface, 160, 185, 10, W)
    for px in range(165, 180):
        set_t(hazards, W, H, px, 7, FILL)

    set_span(surface, 185, 220, 11, W)
    for i, px in enumerate((190, 200, 210)):
        set_t(hazards, W, H, px, 9, HAZARD)
        add(f"press_{i}", px, 8, {"type": "hazard", "kind": "press"})

    set_span(surface, 220, 250, 10, W)
    for px in range(225, 245):
        set_t(deco, W, H, px, 10, DECO)
    add("conveyor", 225, 10, {"type": "hazard", "kind": "conveyor", "dir": "right"}, ow=20 * TW, oh=TW)

    set_span(surface, 250, 270, 9, W)
    add("steam_0", 255, 7, {"type": "hazard", "kind": "steam"})
    for x in range(270, 278):
        surface[x] = None
    set_span(surface, 278, 300, 8, W)
    add("mech_arm_0", 272, 5, {"type": "hazard", "kind": "mech_arm"})
    add("crusher_0", 285, 6, {"type": "hazard", "kind": "crusher"})

    set_span(surface, 300, 330, 7, W)
    add("checkpoint_1", 310, 5, {"type": "checkpoint", "id": "f2-cp1"})

    set_span(surface, 330, 350, 8, W)
    for px in range(335, 345):
        set_t(hazards, W, H, px, 5, FILL)
    for x in range(350, 356):
        surface[x] = None
    set_span(surface, 356, W, 6, W)
    add("clinic_exit", 368, 4, {"type": "clinic", "next": "ClinicScene", "implante": "bracos"})
    add("phase_end", 375, 4, {"type": "phase_end", "fase": "2"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H), tile_layer("ground", 2, ground, W, H), tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-2.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-industrial.tsj",
        props=[{"name": "fase", "type": "int", "value": 2}, {"name": "setor", "type": "string", "value": "industrial"},
               {"name": "perspective", "type": "string", "value": "side-view-ascent"}, {"name": "skill", "type": "string", "value": "double_jump"}],
        nextoid=oid)
    (out / "credits.txt").write_text("Fase 2 — Industrial ASCENSÃO (montanha). Spawn baixo → clínica alto.\n")


def generate_fase3() -> None:
    TW = 32
    W, H = 360, 24
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
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh)); oid += 1

    set_span(surface, 0, 30, 19, W)
    add("spawn", 3, 17, {"type": "spawn"})
    set_span(surface, 30, 55, 17, W)
    for px in range(40, 44):
        set_t(hazards, W, H, px, 15, BAR); set_t(hazards, W, H, px, 16, BAR)
    add("breakable_tutorial", 40, 15, {"type": "breakable", "id": "f3-bar-0"}, ow=4 * TW, oh=2 * TW)

    set_span(surface, 55, 95, 16, W)
    add("bandido_0", 70, 14, {"type": "enemy", "kind": "bandido"})
    platform(ground, W, H, 75, 92, 8, FLOOR)  # rooftop MAIS ALTO
    add("credit_bandido", 80, 6, {"type": "credit", "route": "roof", "id": "f3-c0"})

    set_span(surface, 95, 135, 14, W)
    add("drone_0", 110, 6, {"type": "enemy", "kind": "drone"})
    for px in range(105, 120):
        set_t(hazards, W, H, px, 11, FILL)

    set_span(surface, 135, 180, 13, W)
    platform(ground, W, H, 145, 175, 6, FLOOR)
    for i, cx in enumerate(range(150, 170, 5)):
        add(f"credit_roof_{i}", cx, 4, {"type": "credit", "route": "roof", "id": f"f3-roof-{i}"})
    add("bandido_1", 160, 11, {"type": "enemy", "kind": "bandido"})

    set_span(surface, 180, 215, 11, W)
    add("electric_gate", 190, 8, {"type": "hazard", "kind": "electric_gate"}, ow=2 * TW, oh=3 * TW)
    add("checkpoint_1", 205, 9, {"type": "checkpoint", "id": "f3-cp1"})

    set_span(surface, 215, 255, 10, W)
    add("bandido_2", 225, 8, {"type": "enemy", "kind": "bandido"})
    for x in range(255, 262):
        surface[x] = None
    set_span(surface, 262, 290, 9, W)
    add("drone_1", 268, 4, {"type": "enemy", "kind": "drone"})

    set_span(surface, 290, 330, 8, W)
    add("bandido_3", 300, 6, {"type": "enemy", "kind": "bandido"})
    platform(ground, W, H, 305, 325, 4, FLOOR)
    set_span(surface, 330, W, 7, W)
    add("clinic_exit", 345, 5, {"type": "clinic", "next": "ClinicScene", "implante": "olhos"})
    add("phase_end", 352, 5, {"type": "phase_end", "fase": "3"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H), tile_layer("ground", 2, ground, W, H), tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-3.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-meio-urbano.tsj",
        props=[{"name": "fase", "type": "int", "value": 3}, {"name": "setor", "type": "string", "value": "meio-urbano"},
               {"name": "perspective", "type": "string", "value": "side-view-ascent"}], nextoid=oid)
    (out / "credits.txt").write_text("Fase 3 — Meio Urbano ASCENSÃO (rua→rooftops→clínica alta).\n")


def generate_fase4() -> None:
    TW = 32
    W, H = 360, 24
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
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh)); oid += 1

    set_span(surface, 0, 35, 18, W)
    add("spawn", 3, 16, {"type": "spawn"})
    set_span(surface, 35, 70, 15, W)
    platform(ground, W, H, 45, 65, 8, FLOOR)
    add("scan_tutorial", 42, 13, {"type": "tutorial", "skill": "scan"})
    add("hidden_route", 48, 8, {"type": "scan_reveal", "id": "f4-hidden-0"}, ow=4 * TW, oh=2 * TW)

    set_span(surface, 70, 100, 13, W)
    for px in range(80, 84):
        for dy in range(3):
            set_t(hazards, W, H, px, 10 + dy, FILL)
    add("false_wall", 80, 10, {"type": "scan_reveal", "kind": "false_wall"}, ow=4 * TW, oh=3 * TW)

    set_span(surface, 100, 130, 11, W)
    for i, px in enumerate((110, 118, 125)):
        add(f"laser_{i}", px, 5, {"type": "hazard", "kind": "laser"}, ow=TW, oh=5 * TW)

    set_span(surface, 130, 175, 10, W)
    add("auto_door_0", 145, 7, {"type": "hazard", "kind": "auto_door"}, ow=2 * TW, oh=3 * TW)
    for px in range(155, 163):
        set_t(ground, W, H, px, 10, FAKE)
    add("false_floor", 155, 10, {"type": "scan_reveal", "kind": "false_floor"}, ow=8 * TW, oh=TW)

    set_span(surface, 175, 210, 8, W)
    add("checkpoint_1", 190, 6, {"type": "checkpoint", "id": "f4-cp1"})

    set_span(surface, 210, 260, 9, W)
    add("laser_final", 230, 5, {"type": "hazard", "kind": "laser"}, ow=TW, oh=4 * TW)
    for x in range(260, 268):
        surface[x] = None
    set_span(surface, 268, 310, 7, W)
    add("propaganda_pai", 280, 3, {"type": "narrative", "asset": "narrative/father/propaganda-pai.png"}, ow=4 * TW, oh=3 * TW)
    set_span(surface, 310, W, 6, W)
    add("clinic_exit", 340, 4, {"type": "clinic", "next": "ClinicScene", "implante": "propulsores"})
    add("phase_end", 350, 4, {"type": "phase_end", "fase": "4"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H), tile_layer("ground", 2, ground, W, H), tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-4.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-corporativo.tsj",
        props=[{"name": "fase", "type": "int", "value": 4}, {"name": "setor", "type": "string", "value": "corporativo"},
               {"name": "perspective", "type": "string", "value": "side-view-ascent"},
               {"name": "parallax", "type": "string", "value": "tiles/corporativo/parallax"}], nextoid=oid)
    (out / "credits.txt").write_text("Fase 4 — Corporativo ASCENSÃO.\n")


def generate_fase5() -> None:
    TW = 32
    W, H = 420, 26
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
        objects.append(obj(name, oid, tx * TW, ty * TW, TW, props, ow, oh)); oid += 1

    # Topo da cidade: ainda sobe até o Portão (Y=18 → Y=4)
    set_span(surface, 0, 28, 18, W)
    add("spawn", 3, 16, {"type": "spawn"})
    set_span(surface, 28, 35, 14, W)
    for x in range(35, 52):
        surface[x] = None  # vão de dash — aterrissa MAIS ALTO
    set_span(surface, 52, 75, 11, W)
    add("dash_tutorial", 33, 12, {"type": "tutorial", "skill": "dash"})
    platform(ground, W, H, 40, 45, 15, FLOOR)

    set_span(surface, 75, 95, 12, W)
    for x in range(95, 102):
        surface[x] = None
    set_span(surface, 102, 125, 9, W)

    set_span(surface, 125, 160, 10, W)
    for i, px in enumerate(range(132, 155, 4)):
        add(f"laser_grid_{i}", px, 4, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=6 * TW)

    set_span(surface, 160, 190, 8, W)
    add("rotating_0", 170, 5, {"type": "hazard", "kind": "rotating_barrier"}, ow=2 * TW, oh=3 * TW)
    add("timed_door_0", 180, 5, {"type": "hazard", "kind": "timed_door"}, ow=2 * TW, oh=3 * TW)

    set_span(surface, 190, 220, 7, W)
    add("checkpoint_1", 200, 5, {"type": "checkpoint", "id": "f5-cp1"})

    set_span(surface, 220, 250, 8, W)
    for x in range(250, 262):
        surface[x] = None
    set_span(surface, 262, 290, 6, W)
    add("breakable_kit", 270, 4, {"type": "breakable", "id": "f5-bar-0"}, ow=3 * TW, oh=2 * TW)
    add("scan_kit", 280, 4, {"type": "scan_reveal", "id": "f5-scan-0"}, ow=3 * TW, oh=2 * TW)

    set_span(surface, 290, 340, 7, W)
    for i, px in enumerate(range(300, 330, 6)):
        add(f"laser_final_{i}", px, 3, {"type": "hazard", "kind": "laser_grid"}, ow=TW, oh=4 * TW)

    # Contemplativo no alto
    set_span(surface, 340, 385, 5, W)
    add("contemplative_start", 350, 3, {"type": "zone", "kind": "contemplative"})

    # Portão — ponto mais alto da campanha
    set_span(surface, 385, W, 4, W)
    add("portao", 395, 0, {"type": "gate", "asset": "narrative/gate/portao.png", "choices": "chrome,flesh"}, ow=4 * TW, oh=4 * TW)
    add("choice_chrome", 393, 2, {"type": "ending_choice", "ending": "chrome"})
    add("choice_flesh", 402, 2, {"type": "ending_choice", "ending": "flesh"})
    add("phase_end", 412, 2, {"type": "phase_end", "fase": "5"})

    materialize_surface(ground, W, H, surface, FLOOR, FLOOR2, FILL)
    layers = [
        tile_layer("deco", 1, deco, W, H), tile_layer("ground", 2, ground, W, H), tile_layer("hazards", 3, hazards, W, H),
        {"draworder": "topdown", "id": 99, "name": "objects", "objects": objects, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
    ]
    write_map(out / "fase-5.json", w=W, h=H, tw=TW, layers=layers, tileset_src="tileset-topo.tsj",
        props=[{"name": "fase", "type": "int", "value": 5}, {"name": "setor", "type": "string", "value": "topo"},
               {"name": "perspective", "type": "string", "value": "side-view-ascent"},
               {"name": "parallax", "type": "string", "value": "tiles/topo/parallax"}], nextoid=oid)
    (out / "credits.txt").write_text("Fase 5 — Topo ASCENSÃO até o Portão (ponto mais alto).\n")


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

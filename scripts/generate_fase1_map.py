#!/usr/bin/env python3
"""Gera mapa Tiled JSON da Fase 1 (Esgoto) conforme levelDesign.md + GDD §16.1.

Saída:
  public/assets/maps/esgoto/tileset-sewer.tsj
  public/assets/maps/esgoto/fase-1.json

Abrir no Tiled: File → Open → fase-1.json
Phaser: this.load.tilemapTiledJSON('fase-1', 'assets/maps/esgoto/fase-1.json')
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/maps/esgoto"
TILESET_IMG = "../../tiles/esgoto/tiles/tilesetSewer.png"

TS = 16
SHEET_COLS = 25  # tilesetSewer.png 400×308
MAP_H = 20  # tiles (320 px)
MAP_W = 720  # tiles (~11520 px ≈ 64 s a 180 px/s; ajustável)

GROUND_Y = 16  # floor top row (tiles from top)


def gid(col: int, row: int) -> int:
    """Tiled GID (firstgid=1)."""
    return 1 + row * SHEET_COLS + col


# Peças úteis do tileset (col, row) — mesma base do compose_clinic_scene
FLOOR = gid(2, 1)
FLOOR_ALT = gid(3, 1)
WALL_TOP = gid(2, 0)
WALL_FILL = gid(0, 2)
WALL_CAP = gid(5, 2)
PIPE_H = gid(13, 14)
PANEL = gid(3, 7)
PANEL_GLOW = gid(4, 7)
WIRE = gid(10, 10)
# Água / hazard visual — painel teal como proxy de “água tóxica” até tile dedicado
WATER = gid(0, 7)
# Cano baixo (slide) — parede/cap
PIPE_LOW = WALL_CAP


def empty(n: int = MAP_W * MAP_H) -> list[int]:
    return [0] * n


def set_tile(data: list[int], x: int, y: int, tile: int) -> None:
    if 0 <= x < MAP_W and 0 <= y < MAP_H:
        data[y * MAP_W + x] = tile


def fill_floor(ground: list[int], x0: int, x1: int, y: int = GROUND_Y) -> None:
    for x in range(x0, x1):
        t = FLOOR if x % 2 == 0 else FLOOR_ALT
        set_tile(ground, x, y, t)
        set_tile(ground, x, y + 1, t)
        set_tile(ground, x, y + 2, WALL_FILL)
        set_tile(ground, x, y + 3, WALL_FILL)


def gap(ground: list[int], x0: int, x1: int) -> None:
    for x in range(x0, x1):
        for y in range(GROUND_Y, MAP_H):
            set_tile(ground, x, y, 0)


def platform(ground: list[int], x0: int, x1: int, y: int) -> None:
    for x in range(x0, x1):
        set_tile(ground, x, y, FLOOR if x % 2 == 0 else FLOOR_ALT)


def ceiling_band(deco: list[int], x0: int, x1: int) -> None:
    for x in range(x0, x1):
        set_tile(deco, x, 0, WALL_TOP)
        set_tile(deco, x, 1, WALL_CAP)
        if x % 4 == 0:
            set_tile(deco, x, 2, PIPE_H)


def low_pipe(hazards: list[int], x0: int, x1: int, y: int = GROUND_Y - 2) -> None:
    """Cano baixo — ensina slide (altura baixa sobre o chão)."""
    for x in range(x0, x1):
        set_tile(hazards, x, y, PIPE_LOW)
        set_tile(hazards, x, y - 1, PIPE_H)


def toxic_water(hazards: list[int], x0: int, x1: int) -> None:
    for x in range(x0, x1):
        set_tile(hazards, x, GROUND_Y, WATER)
        set_tile(hazards, x, GROUND_Y + 1, WATER)


def wires(hazards: list[int], x0: int, x1: int, y: int = GROUND_Y - 3) -> None:
    for x in range(x0, x1, 2):
        set_tile(hazards, x, y, WIRE)
        set_tile(hazards, x, y + 1, WIRE)


def build_layers() -> tuple[list[int], list[int], list[int], list[dict]]:
    ground = empty()
    hazards = empty()
    deco = empty()
    objects: list[dict] = []

    # ---- Seções (tiles X) conforme levelDesign.md Fase 1 ----
    # 0–40: início seguro
    fill_floor(ground, 0, 40)
    ceiling_band(deco, 0, MAP_W)
    objects.append(obj("spawn", 3, GROUND_Y - 2, {"type": "spawn"}))

    # 40–55: primeiro pulo (gap pequeno)
    fill_floor(ground, 40, 48)
    gap(ground, 48, 52)
    fill_floor(ground, 52, 70)

    # 70–120: gaps repetidos
    x = 70
    for _ in range(4):
        fill_floor(ground, x, x + 8)
        gap(ground, x + 8, x + 12)
        x += 12
    fill_floor(ground, x, 130)

    # 130–150: cano baixo (slide)
    fill_floor(ground, 130, 160)
    low_pipe(hazards, 138, 152)

    # 160–200: pulo + slide
    fill_floor(ground, 160, 175)
    gap(ground, 175, 179)
    fill_floor(ground, 179, 200)
    low_pipe(hazards, 185, 195)

    # 200–240: água tóxica (plataforma sobre água + hazard)
    fill_floor(ground, 200, 210)
    gap(ground, 210, 235)
    toxic_water(hazards, 210, 235)
    platform(ground, 214, 218, GROUND_Y - 3)
    platform(ground, 222, 226, GROUND_Y - 4)
    platform(ground, 230, 234, GROUND_Y - 3)
    fill_floor(ground, 235, 260)

    # 260–320: rota de créditos (normal embaixo / risco em cima)
    fill_floor(ground, 260, 320)
    platform(ground, 270, 310, GROUND_Y - 5)  # rota de risco
    for i, cx in enumerate(range(275, 308, 8)):
        objects.append(
            obj(
                f"credit_risk_{i}",
                cx,
                GROUND_Y - 7,
                {"type": "credit", "route": "risk", "id": f"f1-risk-{i}"},
            )
        )
    for i, cx in enumerate(range(280, 310, 12)):
        objects.append(
            obj(
                f"credit_safe_{i}",
                cx,
                GROUND_Y - 2,
                {"type": "credit", "route": "normal", "id": f"f1-safe-{i}"},
            )
        )

    # 320–360: tubulação rompida (gaps + pipes)
    fill_floor(ground, 320, 330)
    for gx in (332, 340, 348):
        gap(ground, gx, gx + 4)
        fill_floor(ground, gx + 4, gx + 8)
        for px in range(gx, gx + 4):
            set_tile(deco, px, GROUND_Y - 4, PIPE_H)
    fill_floor(ground, 356, 390)

    # 390: checkpoint
    for c in range(6):
        set_tile(deco, 392 + c, GROUND_Y - 2, PANEL_GLOW if c in (1, 4) else PANEL)
        set_tile(deco, 392 + c, GROUND_Y - 3, PANEL)
    objects.append(obj("checkpoint_1", 394, GROUND_Y - 2, {"type": "checkpoint", "id": "cp1"}))

    # 410–460: fios energizados próximos à água
    fill_floor(ground, 410, 430)
    gap(ground, 430, 455)
    toxic_water(hazards, 430, 455)
    wires(hazards, 432, 454, GROUND_Y - 4)
    platform(ground, 435, 439, GROUND_Y - 5)
    platform(ground, 444, 448, GROUND_Y - 6)
    platform(ground, 450, 454, GROUND_Y - 5)
    fill_floor(ground, 455, 500)

    # 500–620: sequência de domínio (pulo + slide + água + tubos + fios)
    fill_floor(ground, 500, 520)
    low_pipe(hazards, 510, 520)
    gap(ground, 520, 526)
    fill_floor(ground, 526, 540)
    gap(ground, 540, 560)
    toxic_water(hazards, 540, 560)
    wires(hazards, 542, 558, GROUND_Y - 3)
    platform(ground, 545, 549, GROUND_Y - 4)
    platform(ground, 553, 557, GROUND_Y - 5)
    fill_floor(ground, 560, 580)
    low_pipe(hazards, 568, 578)
    for gx in (582, 592, 602):
        gap(ground, gx, gx + 5)
        fill_floor(ground, gx + 5, gx + 10)
        for px in range(gx, gx + 5):
            set_tile(deco, px, GROUND_Y - 5, PIPE_H)
    fill_floor(ground, 620, 700)

    # 680–720: final → clínica
    for c in range(8):
        set_tile(deco, 690 + c, GROUND_Y - 2, PANEL_GLOW if c in (0, 7) else PANEL)
    objects.append(obj("clinic_exit", 695, GROUND_Y - 2, {"type": "clinic", "next": "ClinicScene"}))
    objects.append(obj("phase_end", 710, GROUND_Y - 2, {"type": "phase_end", "fase": 1}))

    fill_floor(ground, 700, MAP_W)

    return ground, hazards, deco, objects


def obj(name: str, tx: int, ty: int, props: dict) -> dict:
    o: dict = {
        "id": abs(hash(name)) % 100000,
        "name": name,
        "type": props.get("type", ""),
        "x": tx * TS,
        "y": ty * TS,
        "width": TS,
        "height": TS,
        "rotation": 0,
        "visible": True,
    }
    if props:
        o["properties"] = [{"name": k, "type": "string", "value": str(v)} for k, v in props.items()]
    return o


def layer(name: str, data: list[int]) -> dict:
    return {
        "data": data,
        "height": MAP_H,
        "width": MAP_W,
        "id": abs(hash(name)) % 1000,
        "name": name,
        "opacity": 1,
        "type": "tilelayer",
        "visible": True,
        "x": 0,
        "y": 0,
    }


def write_tileset() -> None:
    tiles = []
    # Marca tiles de colisão / hazard via propriedades (opcional no Tiled)
    for name, g, solid, hazard in (
        ("floor", FLOOR, True, False),
        ("floor_alt", FLOOR_ALT, True, False),
        ("wall_fill", WALL_FILL, True, False),
        ("water", WATER, False, True),
        ("wire", WIRE, False, True),
        ("pipe_low", PIPE_LOW, True, False),
    ):
        props = []
        if solid:
            props.append({"name": "solid", "type": "bool", "value": True})
        if hazard:
            props.append({"name": "hazard", "type": "bool", "value": True})
            props.append({"name": "damage", "type": "string", "value": "1hit"})
        tiles.append({"id": g - 1, "properties": props})

    tsj = {
        "columns": SHEET_COLS,
        "image": TILESET_IMG,
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
    # Object IDs must be unique
    for i, o in enumerate(objects, start=1):
        o["id"] = i

    tiled = {
        "compressionlevel": -1,
        "height": MAP_H,
        "width": MAP_W,
        "infinite": False,
        "layers": [
            layer("deco", deco),
            layer("ground", ground),
            layer("hazards", hazards),
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
            {"name": "gdd", "type": "string", "value": "§16.1 + levelDesign.md Fase 1"},
            {"name": "implante", "type": "string", "value": "pernas"},
        ],
    }
    (OUT / "fase-1.json").write_text(json.dumps(tiled, indent=2) + "\n")


def write_credits() -> None:
    (OUT / "credits.txt").write_text(
        """Fase 1 — Esgoto / Periferia (Tiled map)

Fonte de layout: levelDesign.md (Victor Blum) + GDD §16.1
Tileset: cammellaro Sewer — public/assets/tiles/esgoto/tiles/tilesetSewer.png

Arquivos:
  tileset-sewer.tsj  — tileset Tiled (16×16)
  fase-1.json        — mapa (720×20 tiles)

Camadas:
  deco     — teto, tubos decorativos, painéis
  ground   — colisão / plataformas / gaps
  hazards  — água tóxica, cano baixo (slide), fios
  objects  — spawn, créditos, checkpoint, clinic_exit

Regenerar:
  python3 scripts/generate_fase1_map.py

Abrir no Tiled:
  File → Open → public/assets/maps/esgoto/fase-1.json

Nota GDD §8: level design é responsabilidade de Victor Blum.
Este mapa é um draft jogável para desbloquear Marco 2; Victor pode editar no Tiled.
"""
    )


def main() -> None:
    write_tileset()
    ground, hazards, deco, objects = build_layers()
    write_map(ground, hazards, deco, objects)
    write_credits()
    print(f"Wrote {OUT / 'fase-1.json'} ({MAP_W}x{MAP_H} tiles @ {TS}px)")
    print(f"Wrote {OUT / 'tileset-sewer.tsj'}")
    print(f"Objects: {len(objects)} (spawn, credits, checkpoint, clinic)")


if __name__ == "__main__":
    main()

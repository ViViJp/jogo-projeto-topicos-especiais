#!/usr/bin/env python3
"""Compose improvised clinic background from Esgoto sewer tiles (cammellaro)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TILESET = ROOT / "public/assets/tiles/esgoto/tiles/tilesetSewer.png"
PROPS = ROOT / "public/assets/tiles/esgoto/tiles"
OUT = ROOT / "public/assets/scenes/clinic"

TS = 16
COLS = 40
ROWS = 18
W, H = COLS * TS, ROWS * TS

# (col, row) in tilesetSewer.png
T = {
    "wall_top": (2, 0),
    "wall_fill": (0, 2),
    "wall_cap": (5, 2),
    "pipe_h": (13, 14),
    "floor": (2, 1),
    "floor_alt": (3, 1),
    "panel": (3, 7),
    "panel_glow": (4, 7),
    "wire": (10, 10),
}


def load_tile(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * TS, row * TS, (col + 1) * TS, (row + 1) * TS)).copy()


def fill_rect(canvas: Image.Image, x: int, y: int, w: int, h: int, tile: Image.Image) -> None:
    for ty in range(y, y + h, TS):
        for tx in range(x, x + w, TS):
            canvas.alpha_composite(tile, (tx, ty))


def compose_room(sheet: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    tiles = {k: load_tile(sheet, *v) for k, v in T.items()}

    back = Image.new("RGBA", (W, H), (18, 12, 28, 255))
    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    floor_y = (ROWS - 3) * TS

    # Ceiling pipes (sparse)
    for c in range(4, COLS - 4, 3):
        mid.alpha_composite(tiles["pipe_h"], (c * TS, 2 * TS))

    # Top wall band
    for c in range(COLS):
        mid.alpha_composite(tiles["wall_top"], (c * TS, 0))
        mid.alpha_composite(tiles["wall_cap"], (c * TS, TS))

    # Side walls
    for r in range(3, ROWS - 3):
        mid.alpha_composite(tiles["wall_fill"], (0, r * TS))
        mid.alpha_composite(tiles["wall_fill"], ((COLS - 1) * TS, r * TS))

    # Floor
    for c in range(COLS):
        t = tiles["floor"] if c % 2 == 0 else tiles["floor_alt"]
        mid.alpha_composite(t, (c * TS, floor_y))
        mid.alpha_composite(t, (c * TS, floor_y + TS))
        mid.alpha_composite(t, (c * TS, floor_y + 2 * TS))

    # Improvised implant bench (center)
    bench_x = 17 * TS
    bench_y = floor_y - TS * 2
    for c in range(6):
        mid.alpha_composite(tiles["panel_glow"] if c in (1, 4) else tiles["panel"], (bench_x + c * TS, bench_y))
        mid.alpha_composite(tiles["panel"], (bench_x + c * TS, bench_y - TS))

    # Hanging wires / clinic clutter
    for c in range(8, COLS - 8, 4):
        mid.alpha_composite(tiles["wire"], (c * TS, 5 * TS))
        back.alpha_composite(tiles["wire"], (c * TS + 8, 4 * TS))

    # Subtle vignette on back
    vig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = vig.load()
    for y in range(H):
        for x in range(W):
            edge = min(x, y, W - 1 - x, H - 1 - y)
            if edge < 48:
                a = int((48 - edge) * 1.8)
                px[x, y] = (0, 0, 0, min(100, a))
    back = Image.alpha_composite(back, vig)

    return back, mid, front


def paste_prop(canvas: Image.Image, name: str, x: int, y: int, scale: int = 1) -> None:
    path = PROPS / name
    if not path.is_file():
        return
    prop = Image.open(path).convert("RGBA")
    if scale != 1:
        prop = prop.resize((prop.width * scale, prop.height * scale), Image.NEAREST)
    canvas.alpha_composite(prop, (x, y))


def main() -> None:
    if not TILESET.is_file():
        raise SystemExit(f"Missing {TILESET}")

    sheet = Image.open(TILESET).convert("RGBA")
    back, mid, front = compose_room(sheet)

    # Props from sewer pack
    paste_prop(front, "lantern2.png", 8 * TS, 4 * TS)
    paste_prop(front, "pc2.png", 30 * TS, 5 * TS)
    paste_prop(front, "fan2.png", 20 * TS, 2 * TS)
    paste_prop(front, "pc1.png", 2 * TS, 6 * TS)

    full = Image.alpha_composite(back, mid)
    full = Image.alpha_composite(full, front)

    OUT.mkdir(parents=True, exist_ok=True)
    layers = OUT / "layers"
    layers.mkdir(exist_ok=True)

    back.save(layers / "back.png")
    mid.save(layers / "mid.png")
    front.save(layers / "front.png")
    full.save(OUT / "clinic-bg.png")

    credits = """Clinic scene — composed for Flesh to Chrome (ClinicScene)

Tiles: Asset Pack Sewer — cammellaro
https://cammellaro.itch.io/sewer
License: personal and commercial use; no redistribution.

Props: fan, lantern, pc (same pack)
Source: public/assets/tiles/esgoto/tiles/

GDD: clínica improvisada de George Vektor — Fase 1 / Marco 2
Size: 640×288 px (40×18 tiles @ 16px)
Layers: layers/back.png, mid.png, front.png (parallax opcional)
"""
    (OUT / "credits.txt").write_text(credits)
    print(f"Wrote {OUT / 'clinic-bg.png'} ({W}x{H})")


if __name__ == "__main__":
    main()

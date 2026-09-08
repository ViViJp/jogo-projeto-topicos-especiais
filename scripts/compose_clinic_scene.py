#!/usr/bin/env python3
"""Compose clinic background from Esgoto sewer tiles (cammellaro) — no watermark.

Uses tilesetSewer.png + props only. Room GIFs (littleSewer, sewer) have PREVIEW
watermark and must NOT be used as source.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TILESET = ROOT / "public/assets/tiles/esgoto/tiles/tilesetSewer.png"
PROPS = ROOT / "public/assets/tiles/esgoto/tiles"
OUT = ROOT / "public/assets/scenes/clinic"

TS = 16
COLS = 60  # 960 px
ROWS = 20  # 320 px
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


def try_font(size: int = 10):
    p = Path("/System/Library/Fonts/Menlo.ttc")
    return ImageFont.truetype(str(p), size) if p.is_file() else ImageFont.load_default()


def load_tile(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * TS, row * TS, (col + 1) * TS, (row + 1) * TS)).copy()


def compose_room(sheet: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    tiles = {k: load_tile(sheet, *v) for k, v in T.items()}

    back = Image.new("RGBA", (W, H), (18, 12, 28, 255))
    mid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    floor_y = (ROWS - 4) * TS

    for c in range(6, COLS - 6, 3):
        mid.alpha_composite(tiles["pipe_h"], (c * TS, 2 * TS))

    for c in range(COLS):
        mid.alpha_composite(tiles["wall_top"], (c * TS, 0))
        mid.alpha_composite(tiles["wall_cap"], (c * TS, TS))

    for r in range(3, ROWS - 4):
        mid.alpha_composite(tiles["wall_fill"], (0, r * TS))
        mid.alpha_composite(tiles["wall_fill"], ((COLS - 1) * TS, r * TS))

    for c in range(COLS):
        t = tiles["floor"] if c % 2 == 0 else tiles["floor_alt"]
        for dr in range(4):
            mid.alpha_composite(t, (c * TS, floor_y + dr * TS))

    bench_x = 26 * TS
    bench_y = floor_y - TS * 2
    for c in range(8):
        mid.alpha_composite(
            tiles["panel_glow"] if c in (1, 6) else tiles["panel"],
            (bench_x + c * TS, bench_y),
        )
        mid.alpha_composite(tiles["panel"], (bench_x + c * TS, bench_y - TS))

    for c in range(10, COLS - 10, 5):
        mid.alpha_composite(tiles["wire"], (c * TS, 6 * TS))
        back.alpha_composite(tiles["wire"], (c * TS + 8, 5 * TS))

    vig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = vig.load()
    for y in range(H):
        for x in range(W):
            edge = min(x, y, W - 1 - x, H - 1 - y)
            if edge < 64:
                a = int((64 - edge) * 1.5)
                px[x, y] = (0, 0, 0, min(90, a))
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


def add_sign(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((14, 12, 148, 58), fill=(22, 14, 32, 230), outline=(232, 125, 62, 255))
    f = try_font(11)
    draw.text((22, 16), "GEORGE VEKTOR", fill=(220, 215, 200, 255), font=f)
    draw.text((22, 34), "IMPLANTES", fill=(0, 229, 204, 255), font=f)


def main() -> None:
    if not TILESET.is_file():
        raise SystemExit(f"Missing {TILESET}")

    sheet = Image.open(TILESET).convert("RGBA")
    back, mid, front = compose_room(sheet)

    paste_prop(front, "lantern2.png", 10 * TS, 5 * TS)
    paste_prop(front, "lantern1.png", 48 * TS, 5 * TS)
    paste_prop(front, "pc2.png", 44 * TS, 6 * TS)
    paste_prop(front, "fan2.png", 28 * TS, 2 * TS)
    paste_prop(front, "pc1.png", 3 * TS, 7 * TS)

    full = Image.alpha_composite(back, mid)
    full = Image.alpha_composite(full, front)
    add_sign(full)

    OUT.mkdir(parents=True, exist_ok=True)
    layers = OUT / "layers"
    layers.mkdir(exist_ok=True)

    back.save(layers / "back.png")
    mid.save(layers / "mid.png")
    front.save(layers / "front.png")
    full.save(OUT / "clinic-bg.png")

    (OUT / "credits.txt").write_text(
        """Clinic scene — Flesh to Chrome (ClinicScene)

Tiles + props: Asset Pack Sewer — cammellaro
https://cammellaro.itch.io/sewer
License: personal and commercial use; no redistribution.

Source: public/assets/tiles/esgoto/tiles/tilesetSewer.png + fan/, pc/, lantern/
Composed procedurally (no room GIFs — those contain PREVIEW watermark).

Size: 960×320 px (60×20 tiles @ 16px)
Layers: layers/back.png, mid.png, front.png (optional parallax)
"""
    )
    print(f"Wrote {OUT / 'clinic-bg.png'} ({W}x{H})")


if __name__ == "__main__":
    main()

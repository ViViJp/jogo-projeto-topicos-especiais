#!/usr/bin/env python3
"""Procedural enemies for Fase 3 — Meio Urbano (placeholder até importar pack dedicado)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/npcs/enemies"


def sheet(w: int, h: int, frames: list[Image.Image]) -> Image.Image:
    canvas = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        canvas.alpha_composite(frame, (i * w, 0))
    return canvas


def make_drone() -> Image.Image:
    w, h = 32, 32
    frames = []
    for rotor in (0, 1):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rectangle((8, 14, 24, 22), fill=(60, 64, 72, 255), outline=(40, 44, 52, 255))
        d.ellipse((12, 16, 20, 20), fill=(0, 229, 204, 255))
        blade = 10 + rotor * 2
        d.line((16, 8, 16, 14), fill=(180, 190, 200, 255), width=2)
        d.line((16, 22, 16, 28), fill=(180, 190, 200, 255), width=2)
        d.line((8, 18, 14, 18), fill=(180, 190, 200, 255), width=blade)
        d.line((18, 18, 24, 18), fill=(180, 190, 200, 255), width=blade)
        frames.append(img)
    return sheet(w, h, frames)


def make_bandido() -> Image.Image:
    w, h = 48, 48
    colors = [(72, 52, 88), (82, 58, 96), (68, 48, 84), (78, 54, 92)]
    frames = []
    for i, body_x in enumerate((0, 1, 0, -1)):
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        c = colors[i]
        bx = 20 + body_x
        d.rectangle((bx, 18, bx + 8, 34), fill=c)
        d.rectangle((bx - 4, 20, bx, 28), fill=(c[0] - 10, c[1] - 8, c[2] - 6))
        d.rectangle((bx + 8, 20, bx + 12, 28), fill=(c[0] - 10, c[1] - 8, c[2] - 6))
        d.rectangle((bx + 1, 10, bx + 7, 18), fill=(210, 180, 150, 255))
        d.rectangle((bx, 8, bx + 8, 12), fill=(40, 40, 48, 255))
        leg = i % 2
        d.rectangle((bx, 34, bx + 3, 42), fill=(50, 50, 60, 255))
        d.rectangle((bx + 5, 34, bx + 8, 42 - leg * 2), fill=(50, 50, 60, 255))
        frames.append(img)
    return sheet(w, h, frames)


def main() -> None:
    drone_dir = OUT / "drone"
    bandido_dir = OUT / "bandido"
    drone_dir.mkdir(parents=True, exist_ok=True)
    bandido_dir.mkdir(parents=True, exist_ok=True)

    make_drone().save(drone_dir / "drone.png")
    make_bandido().save(bandido_dir / "bandido.png")

    credits_path = OUT / "credits.txt"
    extra = """
Meio Urbano enemies (procedural placeholders — Fase 3):
- npcs/enemies/drone/drone.png (32×32, 2 frames idle)
- npcs/enemies/bandido/bandido.png (48×48, 4 frames walk)

Substituir quando importar pack dedicado (ex. OGA Pixel Art Drone CC0).
"""
    if credits_path.is_file():
        text = credits_path.read_text()
        if "drone/drone.png" not in text:
            credits_path.write_text(text.rstrip() + "\n" + extra)
    else:
        credits_path.write_text(extra.strip() + "\n")

    print(f"Wrote {drone_dir / 'drone.png'}")
    print(f"Wrote {bandido_dir / 'bandido.png'}")


if __name__ == "__main__":
    main()

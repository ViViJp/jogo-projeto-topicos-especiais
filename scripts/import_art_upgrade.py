#!/usr/bin/env python3
"""Importa tilesets side-view melhores + gera parallax por setor (issues #7 #8).

Fontes:
  - sewer_beast.png (MrBeast / OGA, CC-BY 3.0) — esgoto side-view
  - future_city_27_*.png (knekko / OGA, CC0) — meio urbano
  - industrial backgrounds + bulkhead — parallax

Uso:
  # coloque PNGs em public/assets/tiles/_downloads/ (já baixados pelo fluxo)
  python3 scripts/import_art_upgrade.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DL = ROOT / "public/assets/tiles/_downloads"
TILES = ROOT / "public/assets/tiles"
MAPS = ROOT / "public/assets/maps"


def copy_if(src: Path, dst: Path) -> bool:
    if not src.is_file():
        print(f"  missing {src.name}")
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"  {src.name} -> {dst.relative_to(ROOT)}")
    return True


def make_gradient(w: int, h: int, top: tuple, bot: tuple) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b, 255)
    return img


def tile_strip(src: Path, out: Path, tw: int, th: int, opacity: int = 160) -> None:
    """Cria faixa de fundo repetível a partir de um PNG."""
    if not src.is_file():
        # gradient fallback
        make_gradient(tw, th, (20, 16, 28), (8, 6, 14)).save(out)
        return
    im = Image.open(src).convert("RGBA")
    # scale to height
    scale = th / im.height
    nw = max(1, int(im.width * scale))
    im = im.resize((nw, th), Image.NEAREST)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    x = 0
    while x < tw:
        canvas.alpha_composite(im, (x, 0))
        x += nw
    # darken for parallax depth
    overlay = Image.new("RGBA", (tw, th), (0, 0, 0, 255 - opacity))
    canvas = Image.alpha_composite(canvas, overlay)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(f"  parallax {out.relative_to(ROOT)}")


def import_esgoto() -> None:
    print("Esgoto (Beast sewer side-view)...")
    dest = TILES / "esgoto/tiles"
    ok = copy_if(DL / "sewer_beast.png", dest / "tileset-sideview.png")
    # keep old cammellaro as props source
    (dest / "credits-sideview.txt").write_text(
        """Side-view sewer tileset — MrBeast (OpenGameArt)
https://opengameart.org/content/sewer-tileset
License: CC-BY 3.0 (credit: MrBeast / OpenGameArt.org)
File: tileset-sideview.png (16×16)

Usado como tileset principal dos mapas Fase 1 (issue #7).
Pack cammellaro (tilesetSewer.png) permanece para props/fan/pc.
"""
    )
    # parallax
    bg_dir = TILES / "esgoto/parallax"
    bg_dir.mkdir(parents=True, exist_ok=True)
    make_gradient(512, 448, (18, 22, 32), (6, 8, 14)).save(bg_dir / "bg-far.png")
    # mid: dark stone wash from beast sheet top
    if ok:
        beast = Image.open(DL / "sewer_beast.png").convert("RGBA")
        wall = beast.crop((0, 0, 128, 64)).resize((256, 128), Image.NEAREST)
        mid = Image.new("RGBA", (512, 448), (10, 12, 18, 255))
        for y in range(80, 400, 64):
            for x in range(0, 512, 128):
                mid.alpha_composite(wall, (x, y))
        Image.alpha_composite(mid, Image.new("RGBA", mid.size, (0, 0, 0, 100))).save(bg_dir / "bg-mid.png")
    else:
        make_gradient(512, 448, (24, 28, 36), (10, 12, 18)).save(bg_dir / "bg-mid.png")
    print(f"  parallax -> {bg_dir.relative_to(ROOT)}")


def import_meio_urbano() -> None:
    print("Meio Urbano (Future City 27)...")
    dest = TILES / "meio-urbano/tiles"
    copy_if(DL / "future_city_27_gritty.png", dest / "future_city_gritty.png")
    copy_if(DL / "future_city_27_slum.png", dest / "future_city_slum.png")
    copy_if(DL / "alley-tiles.png", dest / "alley-tiles.png")
    (dest / "credits-future-city.txt").write_text(
        """Future City 27 — knekko (OpenGameArt)
https://opengameart.org/content/future-city-27
License: CC0
Files: future_city_gritty.png, future_city_slum.png, alley-tiles.png
"""
    )
    # skyline parallax from city sheet
    bg = TILES / "meio-urbano/parallax"
    bg.mkdir(parents=True, exist_ok=True)
    make_gradient(640, 480, (12, 8, 28), (40, 10, 50)).save(bg / "bg-far.png")
    src = DL / "future_city_27_gritty.png"
    if src.is_file():
        city = Image.open(src).convert("RGBA")
        # take building band and stretch as skyline
        band = city.crop((0, 0, 256, 160)).resize((640, 320), Image.NEAREST)
        canvas = make_gradient(640, 480, (20, 10, 40), (8, 6, 16))
        canvas.alpha_composite(band, (0, 120))
        canvas.save(bg / "bg-mid.png")
    print(f"  parallax -> {bg.relative_to(ROOT)}")
    # update interim credits
    (TILES / "meio-urbano/credits.txt").write_text(
        """Meio Urbano — Flesh to Chrome (Fase 3)

Tileset principal: Future City 27 (knekko, CC0) — future_city_gritty.png
Fallback interim: tileset-interim.png (Industrial 1C)

Parallax: parallax/bg-far.png, bg-mid.png
"""
    )


def import_industrial_parallax() -> None:
    print("Industrial / Corporativo / Topo parallax...")
    ind_bg = TILES / "industrial/backgrounds"
    for sector, top, bot in (
        ("industrial", (28, 20, 18), (10, 8, 12)),
        ("corporativo", (16, 20, 36), (8, 10, 20)),
        ("topo", (40, 30, 60), (12, 10, 24)),
    ):
        out = TILES / sector / "parallax"
        out.mkdir(parents=True, exist_ok=True)
        make_gradient(640, 512, top, bot).save(out / "bg-far.png")
        # prefer existing art
        candidates = [
            ind_bg / "2_Industrial_Tileset_1B_Background.png",
            ind_bg / "2_Industrial_Tileset_1_Background.png",
            TILES / "shared/bulkhead/bulkhead-walls-back.png",
        ]
        if sector == "corporativo":
            candidates = [
                TILES / "corporativo/parallax/bulkhead-walls-back.png",
                TILES / "shared/bulkhead/bulkhead-walls-pipes.png",
            ] + candidates
        if sector == "topo":
            candidates = [
                ind_bg / "2_Industrial_Tileset_1C_Background_Violet.png",
                TILES / "topo/parallax/bulkhead-walls-back.png",
            ] + candidates
        src = next((p for p in candidates if p.is_file()), None)
        tile_strip(src if src else Path("/dev/null"), out / "bg-mid.png", 640, 512, opacity=140)
        (out / "credits-parallax.txt").write_text(
            f"Parallax {sector}: gradient + reuso de backgrounds do pack Atomic Realm / Bulkhead (CC0/OGA).\n"
            "Issue #8 — cidade vertical atrás do runner.\n"
        )


def main() -> None:
    print("Import art upgrade (#7 #8)...")
    import_esgoto()
    import_meio_urbano()
    import_industrial_parallax()
    print("Concluído. Rode: python3 scripts/generate_fase1_map.py")


if __name__ == "__main__":
    main()

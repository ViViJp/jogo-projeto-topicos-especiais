#!/usr/bin/env python3
"""Set up Meio Urbano tileset folder (interim + optional Future City 27 import)."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DL = ROOT / "public/assets/tiles/_downloads"
DEST = ROOT / "public/assets/tiles/meio-urbano"
IND = ROOT / "public/assets/tiles/industrial"


def import_future_city() -> bool:
    """Copy Future City 27 files if user dropped them in _downloads/."""
    names = (
        "future_city_27_gritty.png",
        "future_city_27_slum.png",
        "future_city_27.png",
        "alley-tiles.png",
        "future-city-characters.png",
        "characters.png",
    )
    tiles_dir = DEST / "tiles"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for name in names:
        src = DL / name
        if not src.is_file():
            continue
        target = tiles_dir / name.replace("characters.png", "urban-characters.png")
        shutil.copy2(src, target)
        copied += 1
    if copied:
        print(f"  future city -> meio-urbano/tiles ({copied} files)")
    return copied > 0


def setup_interim() -> None:
    """Industrial cyber variant until dedicated urban pack is imported."""
    tiles = DEST / "tiles"
    bg = DEST / "backgrounds"
    tiles.mkdir(parents=True, exist_ok=True)
    bg.mkdir(parents=True, exist_ok=True)

    mappings = [
        (IND / "tiles/1_Industrial_Tileset_1C.png", tiles / "tileset-interim.png"),
        (IND / "backgrounds/2_Industrial_Tileset_1C_Background_Violet.png", bg / "background-interim.png"),
        (IND / "backgrounds/3_Far_Background_Tile.png", bg / "far-background.png"),
    ]
    for src, dst in mappings:
        if src.is_file():
            shutil.copy2(src, dst)

    (DEST / "credits.txt").write_text(
        """Meio Urbano — Flesh to Chrome (Fase 3)

INTERIM (até importar pack urbano dedicado):
- tileset-interim.png — Industrial 1C cyber (Atomic Realm)
- backgrounds/ — parallax interim

OPCIONAL — Future City 27 (knekko, CC0):
Baixe em https://opengameart.org/content/future-city-27
Coloque em public/assets/tiles/_downloads/:
  future_city_27_gritty.png  (recomendado — slum/cyberpunk)
  alley-tiles.png
  urban-characters.png (renomeie characters.png)
Rode: python3 scripts/setup_meio_urbano.py

OPCIONAL — Kenney RPG Urban Kit (CC0):
https://kenney-assets.itch.io/rpg-urban-kit
Zip em _downloads/kenney_rpgUrbanKit.zip → import_tilesets.py

GDD Fase 3: ataque, bandido, drone, objetos quebráveis
"""
    )
    print(f"  interim -> {DEST.relative_to(ROOT)}")


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    print("Meio Urbano...")
    has_city = import_future_city()
    if not has_city:
        setup_interim()
    else:
        setup_interim()
        print("  (interim mantido como fallback em tiles/tileset-interim.png)")
    print("Concluído.")


if __name__ == "__main__":
    main()

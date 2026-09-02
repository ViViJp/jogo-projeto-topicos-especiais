#!/usr/bin/env python3
"""Importa tilesets baixados manualmente para a estrutura de setores do GDD.

Coloque os zips em public/assets/tiles/_downloads/:
  - sewer.zip              (cammellaro — Fase 1 Esgoto)
  - industrial-tileset.zip (Atomic Realm FREE — Fase 2 Industrial)
  - cavern-set.zip         (Draconimous — props/inimigos Esgoto)
  - bulkhead-walls-files.zip (OpenGameArt — já importado se existir em shared/)

Uso:
  python3 scripts/import_tilesets.py
"""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DL = ROOT / "public" / "assets" / "tiles" / "_downloads"
TILES = ROOT / "public" / "assets" / "tiles"
NPCS = ROOT / "public" / "assets" / "npcs"


def is_zip(path: Path) -> bool:
    return path.is_file() and zipfile.is_zipfile(path)


def extract_zip(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zf:
        zf.extractall(dest)
    print(f"  extracted {src.name} -> {dest.relative_to(ROOT)}")


def flatten_pngs(src_dir: Path, dest_dir: Path) -> int:
    """Copia PNGs de subpastas para dest_dir (ignora __MACOSX)."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for png in sorted(src_dir.rglob("*.png")):
        if "__MACOSX" in png.parts or png.name.startswith("."):
            continue
        target = dest_dir / png.name
        if target.exists() and target.stat().st_size == png.stat().st_size:
            continue
        shutil.copy2(png, target)
        count += 1
    return count


def import_bulkhead() -> None:
    src = DL / "bulkhead-walls-files" / "bulkhead-walls-files"
    if not src.is_dir():
        zip_path = DL / "bulkhead-walls-files.zip"
        if is_zip(zip_path):
            extract_zip(zip_path, DL / "bulkhead-walls-files")
            src = DL / "bulkhead-walls-files" / "bulkhead-walls-files"
    if not src.is_dir():
        print("skip bulkhead (not found)")
        return

    shared = TILES / "shared" / "bulkhead"
    shared.mkdir(parents=True, exist_ok=True)
    for sub in ("", "layers"):
        folder = src / sub if sub else src
        if not folder.is_dir():
            continue
        for png in folder.glob("*.png"):
            shutil.copy2(png, shared / png.name)

    # Fases 4 e 5 reutilizam hangar corporativo.
    for sector in ("corporativo", "topo"):
        dest = TILES / sector / "parallax"
        dest.mkdir(parents=True, exist_ok=True)
        n = flatten_pngs(shared, dest)
        print(f"  bulkhead -> {sector}/parallax ({n} files)")


def import_sewer() -> None:
    zip_path = DL / "sewer.zip"
    if not is_zip(zip_path):
        print("skip sewer.zip (baixe em https://cammellaro.itch.io/sewer)")
        return
    tmp = DL / "_extract" / "sewer"
    if tmp.exists():
        shutil.rmtree(tmp)
    extract_zip(zip_path, tmp)
    dest = TILES / "esgoto"
    n = flatten_pngs(tmp, dest / "tiles")
    print(f"  sewer -> esgoto/tiles ({n} files)")


def import_industrial() -> None:
    zip_path = DL / "industrial-tileset.zip"
    if not is_zip(zip_path):
        print("skip industrial-tileset.zip (baixe FREE em https://atomicrealm.itch.io/industrial-tileset)")
        return
    tmp = DL / "_extract" / "industrial"
    if tmp.exists():
        shutil.rmtree(tmp)
    extract_zip(zip_path, tmp)
    dest = TILES / "industrial"
    n = flatten_pngs(tmp, dest / "tiles")
    print(f"  industrial -> industrial/tiles ({n} files)")


def import_cavern() -> None:
    zip_path = DL / "cavern-set.zip"
    if not is_zip(zip_path):
        print("skip cavern-set.zip (baixe em https://draconimous.itch.io/cavern-set)")
        return
    tmp = DL / "_extract" / "cavern"
    if tmp.exists():
        shutil.rmtree(tmp)
    extract_zip(zip_path, tmp)

    enemies = NPCS / "enemies"
    for name in ("crystal crab .png", "crystal crab.png", "Dark hand.png", "dark hand.png"):
        for found in tmp.rglob(name):
            slug = "crystal-crab" if "crab" in found.name.lower() else "dark-hand"
            dest_dir = enemies / slug
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(found, dest_dir / found.name.strip().replace(" ", "-").lower())
            print(f"  cavern enemy -> npcs/enemies/{slug}/")

    tiles_dest = TILES / "esgoto" / "props"
    n = 0
    for png in tmp.rglob("crystal*cave*.png"):
        tiles_dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(png, tiles_dest / png.name)
        n += 1
    if n:
        print(f"  cavern tiles -> esgoto/props ({n} files)")


def main() -> None:
    DL.mkdir(parents=True, exist_ok=True)
    print("Importando tilesets...")
    import_bulkhead()
    import_sewer()
    import_industrial()
    import_cavern()
    print("Concluído. Veja public/assets/tiles/sectors.json para o mapa GDD -> pastas.")


if __name__ == "__main__":
    main()

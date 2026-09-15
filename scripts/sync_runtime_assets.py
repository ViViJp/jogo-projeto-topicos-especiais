#!/usr/bin/env python3
"""Sincroniza a biblioteca oficial (public/assets) → runtime Parcel (flesh-to-chrome/src/assets).

Fonte editável (João / Victor):  public/assets/
Cópia de runtime (Motoca/Parcel): flesh-to-chrome/src/assets/

Uso:
  python3 scripts/sync_runtime_assets.py
  npm run sync-assets   # na raiz

Não sobrescreve mapas .json/.tmj já ajustados no runtime se --safe-maps
(padrão): só copia maps quando o destino não existe, e sempre copia
fase-1.tmj como referência do Victor.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets"
DST = ROOT / "flesh-to-chrome" / "src" / "assets"

# Pastas espelhadas byte-a-byte (exceto maps — tratados à parte).
SYNC_DIRS = (
    "audio",
    "player",
    "ui",
    "narrative",
    "npcs",
    "scenes",
)


def sync_tree(src: Path, dst: Path) -> int:
    if not src.exists():
        print(f"  skip (ausente): {src.relative_to(ROOT)}")
        return 0
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    count = sum(1 for p in dst.rglob("*") if p.is_file())
    print(f"  synced {src.relative_to(ROOT)} → {dst.relative_to(ROOT)} ({count} files)")
    return count


def sync_maps(safe: bool) -> None:
    src_maps = SRC / "maps"
    dst_maps = DST / "maps"
    if not src_maps.exists():
        print("  skip maps (ausente na raiz)")
        return

    dst_maps.mkdir(parents=True, exist_ok=True)
    for path in src_maps.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(src_maps)
        target = dst_maps / rel
        target.parent.mkdir(parents=True, exist_ok=True)

        # Sempre espelha o .tmj do Victor (referência LD).
        if path.suffix.lower() == ".tmj":
            shutil.copy2(path, target)
            print(f"  map ref: {rel}")
            continue

        if safe and target.exists() and path.suffix.lower() in {".json", ".tsj"}:
            # Mantém cópia Phaser do Motoca se já existir.
            continue

        shutil.copy2(path, target)
        print(f"  map: {rel}")


def sync_tiles_audio_helpers() -> None:
    """Tiles: copia o que falta sem apagar layout Phaser (tiles/ vs sewer/)."""
    src_tiles = SRC / "tiles"
    dst_tiles = DST / "tiles"
    if not src_tiles.exists():
        return
    dst_tiles.mkdir(parents=True, exist_ok=True)

    # sectors.json + credits conhecidos
    for name in ("sectors.json",):
        s = src_tiles / name
        if s.exists():
            shutil.copy2(s, dst_tiles / name)
            print(f"  tiles meta: {name}")

    # Garante tileset sewer acessível no caminho que o Phaser já usa
    sewer_src = src_tiles / "esgoto" / "sewer" / "tilesetSewer.png"
    sewer_dst = dst_tiles / "esgoto" / "tiles" / "tilesetSewer.png"
    if sewer_src.exists():
        sewer_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(sewer_src, sewer_dst)
        print("  tiles: esgoto sewer → tiles/tilesetSewer.png")

    crystal_src = src_tiles / "esgoto" / "crystal cave tiles.png"
    crystal_dst = dst_tiles / "esgoto" / "props" / "crystal-cave-tiles.png"
    if crystal_src.exists():
        crystal_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(crystal_src, crystal_dst)
        print("  tiles: crystal cave → props/crystal-cave-tiles.png")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force-maps",
        action="store_true",
        help="Sobrescreve maps/*.json do runtime com os da raiz (perigoso p/ Phaser).",
    )
    args = parser.parse_args()

    if not SRC.exists():
        print(f"ERRO: biblioteca oficial não encontrada: {SRC}", file=sys.stderr)
        return 1

    DST.mkdir(parents=True, exist_ok=True)
    print(f"sync: {SRC} → {DST}")
    for name in SYNC_DIRS:
        sync_tree(SRC / name, DST / name)
    sync_tiles_audio_helpers()
    sync_maps(safe=not args.force_maps)
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Espelha runtime assets: public/assets → flesh-to-chrome/public/assets.

NÃO toca em maps/ (Victor / Motoca). Só áudio + alex-flesh usados pelo Parcel.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets"
DST = ROOT / "flesh-to-chrome" / "public" / "assets"

# Apenas o que o Parcel carrega via AssetUrls — nunca maps/.
SYNC_PATHS = (
    "audio",
    "player/alex-flesh",
)


def sync_one(rel: str) -> None:
    src = SRC / rel
    dst = DST / rel
    if not src.exists():
        print(f"  skip (ausente): {rel}")
        return
    if dst.exists():
        shutil.rmtree(dst) if dst.is_dir() else dst.unlink()
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst)
        n = sum(1 for p in dst.rglob("*") if p.is_file())
        print(f"  synced {rel}/ ({n} files)")
    else:
        shutil.copy2(src, dst)
        print(f"  synced {rel}")


def main() -> int:
    if not SRC.exists():
        print(f"ERRO: {SRC} não existe", file=sys.stderr)
        return 1
    DST.mkdir(parents=True, exist_ok=True)
    print(f"sync: {SRC} → {DST}")
    print("  (maps/ NÃO são sincronizados)")
    for rel in SYNC_PATHS:
        sync_one(rel)
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

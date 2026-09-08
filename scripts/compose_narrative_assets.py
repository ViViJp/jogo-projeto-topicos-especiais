#!/usr/bin/env python3
"""Narrative assets GDD §20.4 — composed placeholders for Marco 3–4."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/narrative"
BULK = ROOT / "public/assets/tiles/shared/bulkhead"
IND = ROOT / "public/assets/tiles/industrial/tiles/1_Industrial_Tileset_1C.png"


def font(size: int = 10):
    p = Path("/System/Library/Fonts/Menlo.ttc")
    return ImageFont.truetype(str(p), size) if p.is_file() else ImageFont.load_default()


def save(path: Path, img: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    print(f"  {path.relative_to(ROOT)}")


def jornal() -> None:
    img = Image.new("RGBA", (96, 64), (220, 215, 200, 255))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 95, 63), outline=(40, 40, 48, 255), width=2)
    f = font(7)
    d.text((6, 6), "GLITCH CITY", fill=(20, 20, 28, 255), font=f)
    d.text((6, 18), "CHRONICLE", fill=(180, 40, 40, 255), font=f)
    d.line((6, 30, 90, 30), fill=(80, 80, 90, 255))
    d.text((6, 34), "Cyborg rises", fill=(40, 40, 48, 255), font=f)
    d.text((6, 44), "to elite tier", fill=(40, 40, 48, 255), font=f)
    save(OUT / "prologue/jornal.png", img)


def familia() -> None:
    img = Image.new("RGBA", (128, 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for x, h in ((24, 52), (52, 48), (80, 56)):
        d.rectangle((x, 80 - h, x + 14, 78), fill=(90, 70, 110, 200))
        d.ellipse((x + 2, 80 - h - 12, x + 12, 80 - h), fill=(210, 180, 150, 220))
    d.rectangle((8, 72, 120, 78), fill=(50, 45, 60, 255))
    save(OUT / "prologue/familia.png", img)


def pai_portrait() -> None:
    img = Image.new("RGBA", (64, 64), (18, 14, 28, 255))
    d = ImageDraw.Draw(img)
    d.ellipse((18, 10, 46, 38), fill=(200, 170, 140, 255))
    d.rectangle((20, 36, 44, 58), fill=(40, 48, 72, 255))
    d.rectangle((14, 38, 20, 50), fill=(0, 229, 204, 180))
    d.rectangle((44, 38, 50, 50), fill=(0, 229, 204, 180))
    d.ellipse((24, 20, 30, 26), fill=(0, 229, 204, 255))
    d.ellipse((34, 20, 40, 26), fill=(0, 229, 204, 255))
    save(OUT / "father/pai-portrait.png", img)


def propaganda_pai() -> None:
    base = Image.new("RGBA", (160, 96), (12, 10, 22, 255))
    d = ImageDraw.Draw(base)
    d.rectangle((0, 0, 159, 95), outline=(232, 125, 62, 255), width=3)
    portrait = Image.open(OUT / "father/pai-portrait.png").convert("RGBA")
    portrait = portrait.resize((48, 48), Image.NEAREST)
    base.alpha_composite(portrait, (8, 24))
    f = font(9)
    d.text((64, 20), "ASCENDA", fill=(0, 229, 204, 255), font=f)
    d.text((64, 36), "COMO ELE", fill=(220, 215, 200, 255), font=f)
    d.text((64, 52), "GLITCH CORP", fill=(232, 125, 62, 255), font=f)
    save(OUT / "father/propaganda-pai.png", base)


def unidade_reciclagem() -> None:
    img = Image.new("RGBA", (96, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((16, 24, 80, 120), fill=(50, 54, 68, 255), outline=(0, 229, 204, 255))
    d.rectangle((28, 40, 68, 72), fill=(10, 12, 20, 255), outline=(0, 229, 204, 180))
    d.rectangle((36, 80, 60, 100), fill=(232, 125, 62, 255))
    d.text((22, 8), "RECICLA", fill=(0, 229, 204, 255), font=font(8))
    save(OUT / "recycling/unidade-reciclagem.png", img)


def holograma_frame() -> None:
    img = Image.new("RGBA", (80, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle((4, 4, 76, 92), outline=(0, 229, 204, 200), width=2)
    for y in range(8, 90, 4):
        d.line((8, y, 72, y), fill=(0, 229, 204, 40))
    save(OUT / "recycling/holograma-frame.png", img)


def holograma_pai() -> None:
    frame = Image.open(OUT / "recycling/holograma-frame.png").convert("RGBA")
    portrait = Image.open(OUT / "father/pai-portrait.png").convert("RGBA").resize((56, 56), Image.NEAREST)
    frame.alpha_composite(portrait, (12, 20))
    save(OUT / "recycling/holograma-pai.png", frame)


def portao() -> None:
    img = Image.new("RGBA", (128, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if BULK.is_dir():
        wall = next(BULK.glob("bulkhead-walls*.png"), None)
        if wall:
            tile = Image.open(wall).convert("RGBA").crop((0, 0, 32, 32))
            for y in range(0, 160, 32):
                for x in range(0, 128, 32):
                    img.alpha_composite(tile, (x, y))
    d.rectangle((40, 20, 88, 140), fill=(20, 18, 32, 240), outline=(0, 229, 204, 255), width=3)
    d.text((48, 70), "PORTAO", fill=(0, 229, 204, 255), font=font(8))
    save(OUT / "gate/portao.png", img)


def fragmento(name: str, label: str, color: tuple[int, int, int]) -> None:
    img = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(24, 4), (44, 24), (24, 44), (4, 24)], outline=(*color, 255), fill=(*color, 80))
    d.text((10, 20), label[:4].upper(), fill=(220, 215, 200, 255), font=font(7))
    save(OUT / f"fragments/fragmento-{name}.png", img)


def main() -> None:
    print("Narrative assets...")
    jornal()
    familia()
    pai_portrait()
    propaganda_pai()
    unidade_reciclagem()
    holograma_frame()
    holograma_pai()
    portao()
    fragmento("topo", "eu", (180, 100, 220))
    fragmento("corporativo", "voz", (100, 180, 220))
    fragmento("urbano", "amigos", (100, 220, 160))
    fragmento("industrial", "familia", (220, 140, 80))

    (OUT / "credits.txt").write_text(
        """Narrative assets — Flesh to Chrome (GDD §20.4)

Procedural placeholders composed for MVP / Marco 3–4.
Substituir por arte final quando houver tempo.

prologue/     — jornal, familia (cutscene §14.1)
father/       — pai-portrait, propaganda-pai (§14.2, Fase 4)
recycling/    — unidade-reciclagem, holograma-pai (§14.5, §17.8)
gate/         — portao (decisão Chrome)
fragments/    — 4 fragmentos da descida (§17.4)

Robô final: usar public/assets/player/alex-chrome/
"""
    )
    print("Concluído.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Compose George Vektor NPC spritesheets from LPC layers."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from compose_alex_variants import (
    COLS,
    DEFS,
    FRAME,
    LPC,
    credits_from_def,
    overlay_layer,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "npcs" / "george"

SHEET_W = COLS * FRAME
SHEET_H = 54 * FRAME  # matches Universal LPC expanded sheet height

# Bottom → top
GEORGE_LAYERS: list[tuple[str, str | None]] = [
    ("body/bodies/male", None),
    ("feet/boots/basic/male", None),
    ("legs/cuffed/male", None),
    ("torso/clothes/longsleeve/longsleeve/male", None),
    ("torso/aprons/apron/male", None),
    ("head/heads/human/male", None),
    ("hair/balding/adult", None),
    ("facial/glasses/glasses/adult", None),
]

GEORGE_CREDITS = [
    "body/bodies/bodies.json",
    "feet/boots/feet_boots_basic.json",
    "legs/pants/legs_cuffed.json",
    "torso/shirts/longsleeve/torso_clothes_longsleeve.json",
    "torso/aprons/torso_aprons_apron.json",
    "head/heads/head_human_male.json",
    "hair/bald/hair_balding.json",
    "headwear/accessories/glasses/facial_glasses.json",
]

FACE_BY_VARIANT = {
    "george-nervous": ("head/faces/male/shame", "head/faces/face_shame.json"),
    "george": ("head/faces/male/neutral", "head/faces/face_neutral.json"),
    "george-proud": ("head/faces/male/happy", "head/faces/face_happy.json"),
}


def blank_sheet() -> Image.Image:
    return Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))


def write_george(name: str, face_rel: str, face_credit: str, note: str) -> None:
    out_dir = OUT / name
    out_dir.mkdir(parents=True, exist_ok=True)

    canvas = blank_sheet()
    used: list[str] = []
    for rel, recolor in GEORGE_LAYERS:
        used.extend(overlay_layer(canvas, LPC / rel, recolor=recolor))
    used.extend(overlay_layer(canvas, LPC / face_rel, recolor=None))

    png_path = out_dir / f"{name}.png"
    canvas.save(png_path, format="PNG")

    parts = [
        "# George Vektor — cirurgião de implantes (Flesh to Chrome)\n",
        f"# Variant: {name} — {note}\n\n",
    ]
    for d in GEORGE_CREDITS + [face_credit]:
        block = credits_from_def(d)
        if block:
            parts.append(block)
    parts.append("\n# Layer files used:\n")
    for f in sorted(set(used)):
        parts.append(f"- {f}\n")

    (out_dir / "credits.txt").write_text("".join(parts))
    print(f"Wrote {png_path} ({canvas.size[0]}x{canvas.size[1]})")


def main() -> None:
    if not LPC.is_dir():
        raise SystemExit(f"Missing LPC spritesheets at {LPC}")

    write_george(
        "george-nervous",
        *FACE_BY_VARIANT["george-nervous"],
        note="Fase 1 — inseguro, explica riscos ao instalar pernas",
    )
    write_george(
        "george",
        *FACE_BY_VARIANT["george"],
        note="Estado neutro — clínica / diálogos gerais",
    )
    write_george(
        "george-proud",
        *FACE_BY_VARIANT["george-proud"],
        note="Fases 3–4 — confiante, orgulhoso do caso Alex",
    )


if __name__ == "__main__":
    main()

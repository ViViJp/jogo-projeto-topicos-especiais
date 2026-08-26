#!/usr/bin/env python3
"""Final ending sprites: Alex feliz (Flesh) e robô completo (Chrome)."""

from __future__ import annotations

from pathlib import Path

from compose_alex_variants import (
    DEFS,
    FLESH,
    FLESH_CREDITS,
    LPC,
    OUT,
    credits_from_def,
    load_rgba,
    overlay_layer,
)

ROOT = Path(__file__).resolve().parents[1]
DASH = OUT / "alex-dash" / "alex-dash.png"


def write_ending(
    name: str,
    *,
    base: Path,
    layers: list[tuple[str, str | None]],
    credit_defs: list[str],
    note: str,
) -> None:
    out_dir = OUT / name
    out_dir.mkdir(parents=True, exist_ok=True)

    canvas = load_rgba(base)
    used: list[str] = []
    for rel, recolor in layers:
        used.extend(overlay_layer(canvas, LPC / rel, recolor=recolor))

    png_path = out_dir / f"{name}.png"
    canvas.save(png_path, format="PNG")

    parts = [
        FLESH_CREDITS.read_text(),
        f"\n# --- Ending: {name} — {note} ---\n",
    ]
    for d in credit_defs:
        block = credits_from_def(d)
        if block:
            parts.append(block)
    parts.append("\n# Layer files used:\n")
    for f in sorted(set(used)):
        parts.append(f"- {f}\n")

    (out_dir / "credits.txt").write_text("".join(parts))
    print(f"Wrote {png_path} ({canvas.size[0]}x{canvas.size[1]})")


def main() -> None:
    if not FLESH.is_file():
        raise SystemExit(f"Missing {FLESH}")
    if not DASH.is_file():
        raise SystemExit(f"Missing {DASH} — run compose_alex_variants.py first")

    # Final Flesh — carne, família, expressão feliz (sem cromo).
    write_ending(
        "alex-flesh-happy",
        base=FLESH,
        layers=[
            ("head/faces/male/happy", None),
        ],
        credit_defs=["head/faces/face_happy.json"],
        note="Final Flesh — Alex em carne, rosto feliz, esgoto com família",
    )

    # Final Chrome — máquina completa no topo (Portão).
    write_ending(
        "alex-chrome",
        base=DASH,
        layers=[
            ("torso/armour/plate/male", "metal"),
            ("arms/armour/plate/male", "metal"),
            ("legs/armour/plate/male", "metal"),
            ("feet/armour/plate/male", "metal"),
            ("hat/helmet/close/male", "metal"),
            ("shoulders/pauldrons/male", "metal"),
        ],
        credit_defs=[
            "torso/armour/torso_armour_plate.json",
            "arms/arms_armour.json",
            "legs/legs_armour.json",
            "feet/feet_armour.json",
            "headwear/helmets/helmets/hat_helmet_close.json",
            "arms/shoulders/shoulders_pauldrons.json",
        ],
        note="Final Chrome — corpo máquina completo, Portão / topo",
    )


if __name__ == "__main__":
    main()

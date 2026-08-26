#!/usr/bin/env python3
"""Compose Alex shop skins (GDD monetization) over LPC base sheets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

# Reuse compositor helpers from progression script
from compose_alex_variants import (
    DEFS,
    FLESH,
    FLESH_CREDITS,
    LPC,
    OUT,
    load_rgba,
    overlay_layer,
    recolor_cyan,
    recolor_metal,
)

ROOT = Path(__file__).resolve().parents[1]


def recolor_tint(im: Image.Image, tint: tuple[int, int, int], strength: int = 60) -> Image.Image:
    """Blend opaque pixels toward a tint (street paint / rust / hazard)."""
    px = im.load()
    w, h = im.size
    tr, tg, tb = tint
    s = max(0, min(100, strength))
    keep = 100 - s
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 30 + g * 59 + b * 11) // 100
            # Keep some luminance variation
            nr = min(255, (lum * keep + tr * s) // 100)
            ng = min(255, (lum * keep + tg * s) // 100)
            nb = min(255, (lum * keep + tb * s) // 100)
            px[x, y] = (nr, ng, nb, a)
    return im


def credits_from_def(rel_json: str) -> str:
    path = DEFS / rel_json
    if not path.is_file():
        return ""
    data = json.loads(path.read_text())
    blocks = []
    for c in data.get("credits", []):
        file = c.get("file", "")
        notes = c.get("notes", "")
        licenses = "\n\t\t- ".join([""] + c.get("licenses", []))
        authors = "\n\t\t- ".join([""] + c.get("authors", []))
        links = "\n\t\t- ".join([""] + c.get("urls", []))
        blocks.append(
            f"{file}\n"
            f"\t- Note: {notes}\n"
            f"\t- Licenses:{licenses}\n"
            f"\t- Authors:{authors}\n"
            f"\t- Links:{links}\n"
        )
    return "\n".join(blocks)


def write_skin(
    name: str,
    *,
    base: Path,
    layers: list[tuple[str, str | None, tuple[int, int, int] | None]],
    extra_credit_defs: list[str],
    note: str,
) -> None:
    """
    layers: (relative_dir, preset_recolor|None, custom_tint|None)
    preset_recolor: 'metal' | 'cyan' | None
    """
    out_dir = OUT / name
    out_dir.mkdir(parents=True, exist_ok=True)

    canvas = load_rgba(base)
    used: list[str] = []

    for rel, preset, tint in layers:
        # Custom tint path: load via overlay with monkeypatch by pre-tinting in a temp way
        # We call overlay_layer with metal/cyan or plain, then if tint-only we need custom.
        if tint is not None and preset is None:
            used.extend(overlay_layer_tinted(canvas, LPC / rel, tint))
        else:
            used.extend(overlay_layer(canvas, LPC / rel, recolor=preset))

    png_path = out_dir / f"{name}.png"
    canvas.save(png_path, format="PNG")

    parts = [
        FLESH_CREDITS.read_text(),
        f"\n# --- Skin: {name} — {note} ---\n",
    ]
    for d in extra_credit_defs:
        block = credits_from_def(d)
        if block:
            parts.append(block)
    parts.append("\n# Layer files used:\n")
    for f in sorted(set(used)):
        parts.append(f"- {f}\n")

    (out_dir / "credits.txt").write_text("".join(parts))
    print(f"Wrote {png_path} ({canvas.size[0]}x{canvas.size[1]}) layers={len(set(used))}")


def overlay_layer_tinted(
    canvas: Image.Image,
    layer_dir: Path,
    tint: tuple[int, int, int],
) -> list[str]:
    """Like overlay_layer but applies a custom tint to each strip before paste."""
    from compose_alex_variants import (
        ANIMATION_OFFSETS,
        COLS,
        DIR_ROWS,
        FRAME,
        SINGLE_DIR,
        resolve_anim_file,
    )

    used: list[str] = []
    for anim, row0 in ANIMATION_OFFSETS.items():
        src_path = resolve_anim_file(layer_dir, anim)
        if src_path is None and anim == "spellcast":
            src_path = resolve_anim_file(layer_dir, "cast")
        if src_path is None:
            continue

        strip = recolor_tint(load_rgba(src_path), tint)
        sw, sh = strip.size
        frames_w = sw // FRAME
        frames_h = sh // FRAME

        if anim in SINGLE_DIR:
            direction = SINGLE_DIR[anim]
            src_row = 0 if frames_h == 1 else DIR_ROWS[direction]
            dest_row = row0
            for f in range(min(frames_w, COLS)):
                frame = strip.crop(
                    (f * FRAME, src_row * FRAME, (f + 1) * FRAME, (src_row + 1) * FRAME)
                )
                canvas.alpha_composite(frame, (f * FRAME, dest_row * FRAME))
            used.append(str(src_path.relative_to(LPC)))
            continue

        for direction, drow in DIR_ROWS.items():
            if drow >= frames_h:
                continue
            dest_row = row0 + drow
            for f in range(min(frames_w, COLS)):
                frame = strip.crop(
                    (f * FRAME, drow * FRAME, (f + 1) * FRAME, (drow + 1) * FRAME)
                )
                if frame.getbbox() is None:
                    continue
                canvas.alpha_composite(frame, (f * FRAME, dest_row * FRAME))
        used.append(str(src_path.relative_to(LPC)))
    return used


def main() -> None:
    if not FLESH.is_file():
        raise SystemExit(f"Missing {FLESH}")
    if not LPC.is_dir():
        raise SystemExit(f"Missing LPC at {LPC}")

    dash = OUT / "alex-dash" / "alex-dash.png"
    eyes = OUT / "alex-eyes" / "alex-eyes.png"
    legs = OUT / "alex-legs" / "alex-legs.png"

    # 1) Sucata — first skin (credits shop): dirty bandages + rusty scrap metal bits
    print("=== Sucata ===")
    write_skin(
        "alex-skin-sucata",
        base=FLESH,
        layers=[
            ("torso/bandage/male", None, (160, 130, 90)),  # dirty bandages
            ("legs/armour/plate/male", None, (140, 95, 60)),  # rust plate scraps
            ("feet/armour/plate/male", None, (120, 85, 55)),
            ("arms/bracers/male", None, (135, 100, 70)),
        ],
        extra_credit_defs=[
            "torso/torso_bandages.json",
            "legs/legs_armour.json",
            "feet/feet_armour.json",
            "arms/wrists/arms_bracers.json",
        ],
        note="créditos 80 — sucata / ferrugem / bandagens",
    )

    # 2) Tinta de rua
    print("=== Tinta de rua ===")
    write_skin(
        "alex-skin-tinta-rua",
        base=FLESH,
        layers=[
            ("torso/clothes/shortsleeve/tshirt/male", None, (40, 40, 40)),
            ("legs/pants/male", None, (200, 40, 60)),  # graffiti red pants
            ("arms/bracers/male", None, (240, 200, 40)),  # yellow tags
            ("feet/shoes/basic/male", None, (30, 30, 30)),
        ],
        extra_credit_defs=[
            "arms/wrists/arms_bracers.json",
            "legs/legs_armour.json",
        ],
        note="créditos 150 — tinta de rua / grafite",
    )

    # 3) Cabo desencapado
    print("=== Cabo desencapado ===")
    write_skin(
        "alex-skin-cabo",
        base=legs if legs.is_file() else FLESH,
        layers=[
            ("torso/clothes/shortsleeve/tshirt/male", None, (20, 20, 20)),
            ("arms/bracers/male", None, (230, 190, 30)),
            ("arms/hands/gloves/male", None, (230, 190, 30)),
            ("torso/bandage/male", None, (230, 190, 30)),  # hazard wrap accents
        ],
        extra_credit_defs=[
            "torso/torso_bandages.json",
            "arms/wrists/arms_bracers.json",
            "arms/arms_gloves.json",
            "legs/legs_armour.json",
        ],
        note="créditos 200 — cabo / amarelo-preto",
    )

    # 4) Neon Elite — ciano cosmético; base já traz olhos vermelhos do upgrade
    print("=== Neon Elite ===")
    write_skin(
        "alex-skin-neon-elite",
        base=eyes if eyes.is_file() else FLESH,
        layers=[
            ("arms/bracers/male", "cyan", None),
            ("shoulders/bauldron/male", "cyan", None),
            ("facial/glasses/sunglasses/adult", "cyan", None),
        ],
        extra_credit_defs=[
            "arms/wrists/arms_bracers.json",
            "arms/bauldron.json",
            "headwear/accessories/glasses/facial_glasses_sunglasses.json",
        ],
        note="R$ 4,90 — neon elite / ciano (cosmético; visão do upgrade = vermelho)",
    )

    # 5) Chrome Mirror
    print("=== Chrome Mirror ===")
    write_skin(
        "alex-skin-chrome-mirror",
        base=dash if dash.is_file() else FLESH,
        layers=[
            ("legs/armour/plate/male", "metal", None),
            ("arms/armour/plate/male", "metal", None),
            ("feet/armour/plate/male", "metal", None),
            ("shoulders/bauldron/male", "metal", None),
            ("backpack/jetpack/male", "metal", None),
        ],
        extra_credit_defs=[
            "legs/legs_armour.json",
            "arms/arms_armour.json",
            "feet/feet_armour.json",
            "arms/bauldron.json",
            "torso/backpack/backpack_jetpack.json",
        ],
        note="R$ 9,90 — chrome mirror / espelhado",
    )

    # 6) Vektor Special — clínica; mantém olhos vermelhos do kit
    print("=== Vektor Special ===")
    write_skin(
        "alex-skin-vektor",
        base=dash if dash.is_file() else FLESH,
        layers=[
            ("torso/clothes/longsleeve/formal_striped/male", None, (245, 245, 250)),
            ("arms/hands/gloves/male", None, (20, 20, 25)),
            ("shoulders/bauldron/male", "metal", None),
        ],
        extra_credit_defs=[
            "arms/arms_gloves.json",
            "arms/bauldron.json",
        ],
        note="R$ 14,90 — Vektor Special / clínica corporativa",
    )


if __name__ == "__main__":
    main()

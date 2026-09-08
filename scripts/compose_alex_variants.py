#!/usr/bin/env python3
"""Compose Alex chrome progression spritesheets from LPC layers over alex-flesh."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LPC = ROOT / ".tools" / "lpc-gen" / "spritesheets"
DEFS = ROOT / ".tools" / "lpc-gen" / "sheet_definitions"
FLESH = ROOT / "public" / "assets" / "player" / "alex-flesh" / "alex-flesh.png"
FLESH_CREDITS = ROOT / "public" / "assets" / "player" / "alex-flesh" / "credits.txt"
OUT = ROOT / "public" / "assets" / "player"

FRAME = 64
COLS = 13

# Matches LPC Universal expanded sheet (sources/state/constants.ts)
ANIMATION_OFFSETS = {
    "spellcast": 0,
    "thrust": 4,
    "walk": 8,
    "slash": 12,
    "shoot": 16,
    "hurt": 20,
    "climb": 21,
    "idle": 22,
    "jump": 26,
    "sit": 30,
    "emote": 34,
    "run": 38,
    "combat_idle": 42,
    "backslash": 46,
    "halfslash": 50,
}

# Direction row order inside each animation strip (n/w/s/e)
DIR_ROWS = {"n": 0, "w": 1, "s": 2, "e": 3}

# Animations that only have one direction row in the full sheet
SINGLE_DIR = {
    "hurt": "s",
    "climb": "n",
}


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def recolor_metal(im: Image.Image, tint: tuple[int, int, int] = (170, 185, 200)) -> Image.Image:
    """Push opaque pixels toward steel / chrome (desaturate + tint)."""
    px = im.load()
    w, h = im.size
    tr, tg, tb = tint
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 30 + g * 59 + b * 11) // 100
            # Keep contrast; blend toward metal tint
            nr = (lum * 45 + tr * 55) // 100
            ng = (lum * 45 + tg * 55) // 100
            nb = (lum * 45 + tb * 55) // 100
            # Preserve relative brightness
            scale = max(lum, 1) / 128.0
            nr = min(255, int(nr * (0.65 + 0.55 * scale)))
            ng = min(255, int(ng * (0.65 + 0.55 * scale)))
            nb = min(255, int(nb * (0.65 + 0.55 * scale)))
            px[x, y] = (nr, ng, nb, a)
    return im


def recolor_cyan(im: Image.Image) -> Image.Image:
    """Recolor opaque pixels toward cyan (Neon Elite skin / visor)."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 30 + g * 59 + b * 11) // 100
            nr = min(255, lum // 3)
            ng = min(255, int(lum * 0.95) + 40)
            nb = min(255, int(lum * 1.1) + 70)
            px[x, y] = (nr, ng, nb, a)
    return im


def recolor_red_glow(im: Image.Image) -> Image.Image:
    """Push eye pixels toward bright implant red."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 30 + g * 59 + b * 11) // 100
            # Keep highlights near white; body of the eye goes hot red
            if lum > 200:
                px[x, y] = (255, min(255, lum), min(220, lum - 20), a)
            else:
                nr = min(255, 180 + lum // 2)
                ng = min(80, lum // 3)
                nb = min(60, lum // 4)
                px[x, y] = (nr, ng, nb, a)
    return im


def resolve_anim_file(layer_dir: Path, anim: str) -> Path | None:
    """Find animation PNG for a layer directory (handles nested color files)."""
    # Prefer red eyes / steel metal / white bandages when color variants exist.
    preferred = (
        "red.png",
        "steel.png",
        "bronze.png",
        "gold.png",
        "white.png",
        "sunglasses.png",
    )
    anim_dir = layer_dir / anim
    if anim_dir.is_dir():
        for name in preferred:
            p = anim_dir / name
            if p.is_file():
                return p
        nested = sorted(anim_dir.glob("*.png"))
        if nested:
            return nested[0]

    candidates = [
        layer_dir / f"{anim}.png",
        layer_dir / anim / f"{anim}.png",
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def overlay_layer(
    canvas: Image.Image,
    layer_dir: Path,
    *,
    recolor: str | None = None,
) -> list[str]:
    """Overlay all available animations from layer_dir onto the full sheet."""
    used: list[str] = []
    for anim, row0 in ANIMATION_OFFSETS.items():
        src_path = resolve_anim_file(layer_dir, anim)
        if src_path is None:
            # spellcast files sometimes named differently
            if anim == "spellcast":
                src_path = resolve_anim_file(layer_dir, "cast")
            if src_path is None:
                continue

        strip = load_rgba(src_path)
        if recolor == "metal":
            strip = recolor_metal(strip)
        elif recolor == "cyan":
            strip = recolor_cyan(strip)
        elif recolor == "red":
            strip = recolor_red_glow(strip)

        sw, sh = strip.size
        frames_w = sw // FRAME
        frames_h = sh // FRAME

        if anim in SINGLE_DIR:
            # Single-direction animations: strip may be 1 row or 4 rows
            direction = SINGLE_DIR[anim]
            src_row = 0 if frames_h == 1 else DIR_ROWS[direction]
            dest_row = row0
            max_frames = min(frames_w, COLS)
            for f in range(max_frames):
                frame = strip.crop(
                    (f * FRAME, src_row * FRAME, (f + 1) * FRAME, (src_row + 1) * FRAME)
                )
                canvas.alpha_composite(frame, (f * FRAME, dest_row * FRAME))
            used.append(str(src_path.relative_to(LPC)))
            continue

        # Standard 4-direction strips
        for direction, drow in DIR_ROWS.items():
            if drow >= frames_h:
                continue
            dest_row = row0 + drow
            max_frames = min(frames_w, COLS)
            for f in range(max_frames):
                frame = strip.crop(
                    (f * FRAME, drow * FRAME, (f + 1) * FRAME, (drow + 1) * FRAME)
                )
                # Skip empty frames
                bbox = frame.getbbox()
                if bbox is None:
                    continue
                canvas.alpha_composite(frame, (f * FRAME, dest_row * FRAME))
        used.append(str(src_path.relative_to(LPC)))
    return used


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


def write_variant(
    name: str,
    layers: list[tuple[str, str | None]],
    extra_credit_defs: list[str],
) -> None:
    out_dir = OUT / name
    out_dir.mkdir(parents=True, exist_ok=True)

    canvas = load_rgba(FLESH)
    used_files: list[str] = []
    for rel, recolor in layers:
        used_files.extend(overlay_layer(canvas, LPC / rel, recolor=recolor))

    png_path = out_dir / f"{name}.png"
    canvas.save(png_path, format="PNG")

    credit_parts = [FLESH_CREDITS.read_text()]
    credit_parts.append(
        "\n# --- Additional chrome layers (composed for Flesh to Chrome) ---\n"
    )
    for d in extra_credit_defs:
        block = credits_from_def(d)
        if block:
            credit_parts.append(block)
    credit_parts.append("\n# Layer files used:\n")
    for f in sorted(set(used_files)):
        credit_parts.append(f"- {f}\n")

    (out_dir / "credits.txt").write_text("".join(credit_parts))
    print(f"Wrote {png_path} ({canvas.size[0]}x{canvas.size[1]}) layers={len(set(used_files))}")


def main() -> None:
    if not FLESH.is_file():
        raise SystemExit(f"Missing base sheet: {FLESH}")
    if not LPC.is_dir():
        raise SystemExit(f"Missing LPC spritesheets at {LPC} (clone generator into .tools/lpc-gen)")

    legs_layers = [
        ("legs/armour/plate/male", "metal"),
        ("feet/armour/plate/male", "metal"),
    ]
    arms_layers = legs_layers + [
        ("arms/bracers/male", "metal"),
        ("arms/hands/gloves/male", "metal"),
    ]
    # Visão artificial: olhos implantados vermelhos (não óculos ciano).
    eyes_layers = arms_layers + [
        ("eyes/human/adult/default", "red"),
    ]
    dash_layers = eyes_layers + [
        ("backpack/jetpack/male", "metal"),
        ("shoulders/bauldron/male", "metal"),
    ]

    shared_credits = [
        "legs/legs_armour.json",
        "feet/feet_armour.json",
        "arms/wrists/arms_bracers.json",
        "arms/arms_gloves.json",
        "head/eyes/meta_eyes.json",
        "torso/backpack/backpack_jetpack.json",
        "arms/bauldron.json",
    ]

    write_variant("alex-legs", legs_layers, shared_credits[:2])
    write_variant("alex-arms", arms_layers, shared_credits[:4])
    write_variant("alex-eyes", eyes_layers, shared_credits[:5])
    write_variant("alex-dash", dash_layers, shared_credits)


if __name__ == "__main__":
    main()

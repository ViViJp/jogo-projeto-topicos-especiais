#!/usr/bin/env python3
"""Generate HUD panels and credit pickup sprites (pixel art)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
HUD = ROOT / "public/assets/ui/hud"
CREDIT = ROOT / "public/assets/ui/credit"

# Palette — matches Esgoto / cyberpunk tone
BG = (22, 14, 32, 220)
BG_SOLID = (22, 14, 32, 255)
BORDER = (232, 125, 62, 255)  # sewer orange
GLOW = (0, 229, 204, 255)  # teal accent
TEXT = (200, 196, 210, 255)
TEXT_DIM = (120, 116, 135, 255)
COIN_CORE = (0, 200, 180, 255)
COIN_EDGE = (180, 90, 40, 255)
COIN_SHINE = (255, 255, 220, 255)


def draw_panel(size: int = 32) -> Image.Image:
    """9-slice panel (size×size) with orange border and teal corner accents."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    m = 3  # margin border width

    for y in range(size):
        for x in range(size):
            on_edge = x < m or y < m or x >= size - m or y >= size - m
            corner = (x < m or x >= size - m) and (y < m or y >= size - m)
            if corner:
                px[x, y] = GLOW if (x + y) % 2 == 0 else BORDER
            elif on_edge:
                px[x, y] = BORDER
            else:
                px[x, y] = BG

    # Inner highlight line
    for i in range(m + 1, size - m - 1):
        if px[i, m + 1][3]:
            px[i, m + 1] = (BORDER[0], BORDER[1], BORDER[2], 120)
    return im


def draw_coin_frame(phase: int, size: int = 16) -> Image.Image:
    """Credit chip — 4-frame pulse animation."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    cx, cy = size // 2, size // 2
    pulse = [0, 1, 2, 1][phase % 4]
    radius = 5 + (1 if pulse == 2 else 0)

    for y in range(size):
        for x in range(size):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                if dist >= radius - 1:
                    px[x, y] = COIN_EDGE
                elif dist <= 1.2 and phase in (1, 2):
                    px[x, y] = COIN_SHINE
                else:
                    px[x, y] = COIN_CORE
            elif dist <= radius + 1 + pulse * 0.5 and pulse > 0:
                a = 90 if pulse == 2 else 50
                px[x, y] = (GLOW[0], GLOW[1], GLOW[2], a)

    # Circuit "C" mark
    for (x, y) in ((cx - 2, cy - 2), (cx - 2, cy), (cx - 2, cy + 2), (cx - 1, cy + 2)):
        if 0 <= x < size and 0 <= y < size:
            px[x, y] = BG_SOLID if px[x, y][3] > 100 else COIN_SHINE

    return im


def draw_icon_credit(size: int = 16) -> Image.Image:
    return draw_coin_frame(2, size)


def try_font(size: int = 8) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in (
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ):
        p = Path(name)
        if p.is_file():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def draw_hud_reference() -> Image.Image:
    """Layout mockup for Vitor — 640×360."""
    w, h = 640, 360
    im = Image.new("RGBA", (w, h), (18, 12, 28, 255))
    draw = ImageDraw.Draw(im)

    # Simulated gameplay band
    draw.rectangle((0, 280, w, h), fill=(35, 30, 45, 255))

    panel = draw_panel(32)
    phase_w, phase_h = 220, 40
    total_w, total_h = 120, 28

    def stretch_panel(pw: int, ph: int) -> Image.Image:
        out = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        s = panel.size[0]
        # 9-slice blit
        for dest_y in range(ph):
            for dest_x in range(pw):
                sx = 0 if dest_x < s // 2 else (s - 1 if dest_x >= pw - s // 2 else s // 2)
                sy = 0 if dest_y < s // 2 else (s - 1 if dest_y >= ph - s // 2 else s // 2)
                out.putpixel((dest_x, dest_y), panel.getpixel((sx, sy)))
        return out

    phase_box = stretch_panel(phase_w, phase_h)
    total_box = stretch_panel(total_w, total_h)
    im.alpha_composite(phase_box, (12, 12))
    im.alpha_composite(total_box, (12, 58))

    icon = draw_icon_credit(16)
    im.alpha_composite(icon, (20, 24))
    im.alpha_composite(icon, (20, 64))

    font_lg = try_font(11)
    font_sm = try_font(9)
    draw.text((42, 18), "Créditos da fase: 3/12", fill=TEXT, font=font_lg)
    draw.text((42, 62), "Total: 47", fill=TEXT, font=font_sm)

    # Labels for dev
    draw.text((12, 100), "scrollFactor 0 | depth 100", fill=TEXT_DIM, font=font_sm)
    draw.text((12, 115), "Fase: label + phaseCurrent/phaseMax", fill=TEXT_DIM, font=font_sm)
    draw.text((12, 130), "Total: walletTotal (save)", fill=TEXT_DIM, font=font_sm)

    # Sample world credit
    coin = draw_coin_frame(0, 16)
    for i in range(4):
        im.alpha_composite(draw_coin_frame(i, 16), (300 + i * 20, 250))

    draw.text((280, 230), "credit pickup (4 frames)", fill=TEXT_DIM, font=font_sm)

    return im


def main() -> None:
    HUD.mkdir(parents=True, exist_ok=True)
    CREDIT.mkdir(parents=True, exist_ok=True)

    draw_panel(32).save(HUD / "panel-9slice.png")

    draw_icon_credit(16).save(HUD / "icon-credit.png")
    draw_icon_credit(24).save(HUD / "icon-credit-24.png")

    # Collectible spritesheet: 4 frames in a row
    frames = [draw_coin_frame(i, 16) for i in range(4)]
    sheet = Image.new("RGBA", (16 * 4, 16), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * 16, 0))
    sheet.save(CREDIT / "credit.png")

    draw_hud_reference().save(HUD / "hud-reference.png")

    credits = """HUD — Flesh to Chrome (João Pedro / UI)

GDD §13.4:
  - Créditos da fase: X/Y
  - Total: Z

Files:
  hud/panel-9slice.png   — 9-slice panel (32×32 source)
  hud/icon-credit.png    — HUD icon 16×16
  hud/icon-credit-24.png — HUD icon 24×24
  hud/hud-reference.png  — layout mockup 640×360
  credit/credit.png      — pickup spritesheet 64×16 (4 frames @ 16×16)

Phaser (Vitor):
  - panel: setScrollFactor(0), depth 100, nine-slice scale
  - credit anim: generateFrameNumbers, frameRate 8, repeat -1
  - text: monospace #c8c8d0 or BitmapText later
"""
    (HUD / "credits.txt").write_text(credits)
    print(f"Wrote HUD assets to {HUD.relative_to(ROOT)} and {CREDIT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

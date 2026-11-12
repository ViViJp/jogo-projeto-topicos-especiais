"""Gera o favicon: rosto da Alex metade carne, metade cromo.

Uso (a partir de flesh-to-chrome/): python3 scripts/gerar_favicon.py
Requer Pillow. Saída em src/assets/ui/favicon.png.
"""
import os

from PIL import Image

PALETTE = {
    ".": (0, 0, 0, 0),
    "K": "#14141f",  # contorno
    "H": "#d4572a", "h": "#a03a1c",  # cabelo
    "S": "#e8b48c", "s": "#c48a66",  # pele
    "E": "#2a1a1a", "M": "#8a4a3a",  # olho e boca
    "C": "#b8c4d0", "c": "#7a8894", "W": "#eef4f8",  # cromo
    "G": "#3df2e0",  # olho ciano
}
ART = """
................
....KKKKKKKK....
...KHHHHCCCCK...
..KHHHHHCWCCCK..
..KHHhHHCWCCcK..
..KHSSSSCCCCcK..
..KSSSSSCCCCcK..
..KSEESSCGGCcK..
..KSEESSCGGCcK..
..KSSSSSCCCCcK..
..KsSSSSCCCccK..
..KsSMMMcccccK..
...KsSSSCCccK...
....KssScccK....
.....KKKKKK.....
................
""".split()
assert len(ART) == 16 and all(len(r) == 16 for r in ART)

img = Image.new("RGBA", (16, 16))
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        c = PALETTE[ch]
        img.putpixel((x, y), c if isinstance(c, tuple) else (*bytes.fromhex(c[1:]), 255))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "assets", "ui", "favicon.png")
img.resize((64, 64), Image.NEAREST).save(out, optimize=True)
print(os.path.normpath(out))

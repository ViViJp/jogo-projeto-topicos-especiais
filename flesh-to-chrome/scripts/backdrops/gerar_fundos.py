"""Gera as camadas de fundo (parallax) das Fases 1, 2 e 3.

Uso (a partir de flesh-to-chrome/):

    python3 scripts/backdrops/gerar_fundos.py

Requer Pillow e NumPy. Saída em src/assets/backdrops/<setor>/.

As camadas são desenhadas em "pixel lógico" (metade da resolução do jogo) e
ampliadas 2x com vizinho mais próximo, para manter o aspecto pixel art.
Toda camada repete na horizontal sem emenda (o que sai pela direita volta
pela esquerda).

Restrição de contraste: o time calibrou o cinza #787f86 (luminância ~126)
como fundo da Fase 1/2 para a silhueta escura da Alex não "sumir" (ver
TILED_FASE1_BACKGROUND em src/levels/TiledFase1.ts). Por isso as faixas que
ficam atrás do personagem (y de tela ~440-600) são mantidas em cinzas
médios de baixo contraste, e os elementos escuros/saturados ficam no alto da
tela, abaixo do chão ou em detalhes finos.

Os PNGs gerados podem ser substituídos por arte feita à mão: o jogo só
depende do nome do arquivo e das image layers configuradas no Tiled.
"""
from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(PROJECT, "src", "assets", "backdrops")
WARPED_CITY_BG = os.path.join(PROJECT, "src", "assets", "tiles", "meio-urbano", "ENVIRONMENT", "background")

SCALE = 2  # pixel lógico -> pixel de tela
LW = 640  # largura lógica de repetição (1280 px na tela)

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], float) / 16 + 1 / 32


def rgb(h: str, a: int = 255) -> tuple[int, int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a


class Layer:
    """Imagem RGBA com desenho que dá a volta na horizontal."""

    def __init__(self, h: int, w: int = LW, fill: str | None = None):
        self.w, self.h = w, h
        self.im = Image.new("RGBA", (w, h), rgb(fill) if fill else (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im, "RGBA")

    def _paint(self, c, draw):
        """Desenha `draw(ImageDraw, dx)` nas três posições de repetição.

        Cor opaca: direto na imagem. Cor translúcida: numa camada à parte,
        composta com "over" de verdade - o modo "RGBA" do ImageDraw mistura a
        cor com o preto dos pixels transparentes e escurecia brilhos e fachos
        de luz desenhados sobre áreas vazias.
        """
        if c[3] == 255:
            for dx in (-self.w, 0, self.w):
                draw(self.d, dx)
            return
        overlay = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        for dx in (-self.w, 0, self.w):
            draw(od, dx)
        self.im.alpha_composite(overlay)

    def rect(self, x, y, w, h, c):
        if w <= 0 or h <= 0:
            return
        self._paint(c, lambda d, dx: d.rectangle([round(x + dx), round(y), round(x + dx) + round(w) - 1, round(y) + round(h) - 1], fill=c))

    def ellipse(self, x, y, w, h, c):
        self._paint(c, lambda d, dx: d.ellipse([round(x + dx), round(y), round(x + dx + w) - 1, round(y + h) - 1], fill=c))

    def ring(self, x, y, w, h, c, width):
        self._paint(c, lambda d, dx: d.ellipse([round(x + dx), round(y), round(x + dx + w) - 1, round(y + h) - 1], outline=c, width=width))

    def poly(self, pts, c):
        self._paint(c, lambda d, dx: d.polygon([(px + dx, py) for px, py in pts], fill=c))

    def line(self, pts, c, width=1):
        self._paint(c, lambda d, dx: d.line([(px + dx, py) for px, py in pts], fill=c, width=width))

    def px(self, x, y, c):
        self.rect(x, y, 1, 1, c)

    def array(self) -> np.ndarray:
        return np.asarray(self.im).astype(float)

    def set_array(self, a: np.ndarray):
        self.im = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), "RGBA")
        self.d = ImageDraw.Draw(self.im, "RGBA")

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.im.resize((self.w * SCALE, self.h * SCALE), Image.NEAREST).save(path, optimize=True)
        print(f"  {os.path.relpath(path, PROJECT)}  {self.w * SCALE}x{self.h * SCALE}")


def dithered_gradient(layer: Layer, stops: list[tuple[int, str]]):
    """Gradiente vertical com pontilhado ordenado (faixas de cor estilo pixel art)."""
    ys = np.arange(layer.h)
    colors = np.array([rgb(c)[:3] for _, c in stops], float)
    pos = np.array([p for p, _ in stops], float)
    out = np.zeros((layer.h, layer.w, 4))
    steps = 6  # sub-tons entre duas paradas
    for y in ys:
        i = int(np.clip(np.searchsorted(pos, y, side="right") - 1, 0, len(pos) - 2))
        t = np.clip((y - pos[i]) / max(1, pos[i + 1] - pos[i]), 0, 1) * steps
        lo = math.floor(t)
        frac = t - lo
        row_t = lo + (frac > BAYER4[y % 4][np.arange(layer.w) % 4])
        c = colors[i] + (colors[i + 1] - colors[i]) * (row_t[:, None] / steps)
        out[y, :, :3] = c
        out[y, :, 3] = 255
    layer.set_array(out)


def tileable_noise(w: int, h: int, seed: int, octaves=((1, 1.0), (2, 0.5), (5, 0.25))) -> np.ndarray:
    """Ruído suave que repete em X (soma de senos com períodos que dividem w)."""
    rnd = random.Random(seed)
    xs = np.arange(w)[None, :] / w * 2 * math.pi
    ys = np.arange(h)[:, None] / h * 2 * math.pi
    n = np.zeros((h, w))
    for freq, amp in octaves:
        for _ in range(3):
            fx = freq * rnd.choice([1, 2, 3])
            fy = freq * rnd.uniform(0.5, 1.6)
            n += amp * np.sin(fx * xs + rnd.uniform(0, 6.3) + np.sin(fy * ys + rnd.uniform(0, 6.3)) * 1.3)
    n -= n.min()
    return n / n.max()


def dithered_cloud(layer: Layer, color: str, alpha: int, density: np.ndarray, threshold: float):
    """Névoa/fumaça em pixel art: pixels ligados por pontilhado conforme a densidade."""
    a = layer.array()
    bayer = np.tile(BAYER4, (layer.h // 4 + 1, layer.w // 4 + 1))[: layer.h, : layer.w]
    strength = np.clip((density - threshold) / max(1e-6, 1 - threshold), 0, 1)
    on = strength > bayer
    c = np.array(rgb(color)[:3], float)
    # duas intensidades: núcleo mais opaco, borda mais transparente
    al = np.where(strength > 0.55, alpha, alpha * 0.55) * on
    src_a = al / 255
    dst_a = a[..., 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    for k in range(3):
        a[..., k] = np.where(out_a > 0, (c[k] * src_a + a[..., k] * dst_a * (1 - src_a)) / np.maximum(out_a, 1e-6), a[..., k])
    a[..., 3] = out_a * 255
    layer.set_array(a)


def brick_texture(layer: Layer, y0: int, y1: int, bw=16, bh=6, amount=0.06):
    a = layer.array()
    ys, xs = np.mgrid[y0:y1, 0 : layer.w]
    mortar = (ys % bh == 0) | (((xs + (ys // bh) % 2 * (bw // 2)) % bw) == 0)
    rnd = np.random.default_rng(7)
    jitter = rnd.uniform(-0.025, 0.025, size=((y1 - y0) // bh + 2, layer.w // bw + 2))
    brick_var = jitter[(ys - y0) // bh, (xs + (ys // bh) % 2 * (bw // 2)) // bw % (layer.w // bw)]
    factor = np.where(mortar, 1 - amount, 1 + brick_var)
    a[y0:y1, :, :3] *= factor[..., None]
    layer.set_array(a)


def cylinder(layer: Layer, x, y, w, h, base: str, light: str, dark: str):
    """Tubo/tanque vertical com faixa de luz e sombra."""
    layer.rect(x, y, w, h, rgb(base))
    layer.rect(x + max(1, w // 5), y, max(1, w // 6), h, rgb(light))
    layer.rect(x + w - max(1, w // 6), y, max(1, w // 6), h, rgb(dark))


def pour(layer: Layer, x, w, y, bottom, flange: str, seed: int):
    """Boca aberta no pé de um cano vertical (x..x+w, terminando em y)
    despejando água tóxica até `bottom`."""
    rnd = random.Random(seed)
    sx, sw = x + 2, w - 4
    layer.rect(sx, y, sw, bottom - y, rgb("#6f9c80", 215))
    layer.rect(sx, y, 1, bottom - y, rgb("#557a66", 215))
    layer.rect(sx + sw - 1, y, 1, bottom - y, rgb("#557a66", 215))
    # fios claros quebrados dão a leitura de água caindo
    for fx in (sx + 2, sx + sw - 3):
        yy = y + rnd.randint(0, 6)
        while yy < bottom - 4:
            seg = rnd.randint(5, 14)
            layer.rect(fx, yy, 1, min(seg, bottom - 4 - yy), rgb("#9cc9ac", 230))
            yy += seg + rnd.randint(3, 8)
    # espuma onde o jato bate no canal
    layer.rect(x - 4, bottom - 3, w + 8, 3, rgb("#9cc9ac", 200))
    layer.rect(x - 8, bottom - 1, w + 16, 1, rgb("#9cc9ac", 150))
    # colar da boca por cima do jato
    layer.rect(x - 2, y - 4, w + 4, 5, rgb(flange))


def hpipe(layer: Layer, y, thick, base: str, light: str, dark: str, flange: str, spacing=96, offset=0):
    layer.rect(0, y, LW, thick, rgb(base))
    layer.rect(0, y + 1, LW, max(1, thick // 5), rgb(light))
    layer.rect(0, y + thick - max(1, thick // 5), LW, max(1, thick // 5), rgb(dark))
    for fx in range(offset, LW + offset, spacing):
        layer.rect(fx, y - 1, 4, thick + 2, rgb(flange))
        layer.px(fx + 1, y, rgb(light))


def glow(layer: Layer, cx, cy, r, color: str, alpha: int):
    """Halo de luz em anéis concêntricos (sem gradiente suave, estilo pixel art)."""
    for i, k in enumerate((1.0, 0.7, 0.45)):
        rr = r * k
        layer.ellipse(cx - rr, cy - rr * 0.8, rr * 2, rr * 1.6, rgb(color, int(alpha * (0.35 + 0.3 * i))))


# ---------------------------------------------------------------------------
# Fase 1 — Esgoto / Periferia
# ---------------------------------------------------------------------------

def fase1():
    print("Fase 1 — esgoto")
    out = os.path.join(OUT, "esgoto")

    # Parede do fundo do túnel: tijolos e arcos, cinza frio próximo do calibrado.
    far = Layer(360)
    dithered_gradient(far, [(0, "#4f565c"), (90, "#636a70"), (200, "#757c82"), (300, "#717880"), (360, "#5a6168")])
    brick_texture(far, 0, 360)
    rnd = random.Random(11)
    for ax in (40, 360):
        w, top, bottom = 220, 70, 312
        r = w // 2
        # anel de pedra do arco
        far.ellipse(ax - 6, top - 6, w + 12, w + 12, rgb("#7f868c"))
        far.rect(ax - 6, top + r, w + 12, bottom - top - r, rgb("#7f868c"))
        # abertura do túnel (mais escura em cima, iluminada no chão)
        far.ellipse(ax, top, w, w, rgb("#646b71"))
        far.rect(ax, top + r, w, bottom - top - r, rgb("#646b71"))
        far.ellipse(ax + 24, top + 22, w - 48, w - 48, rgb("#5d646a"))
        far.rect(ax + 24, top + 22 + (w - 48) // 2, w - 48, bottom - top - 22 - (w - 48) // 2, rgb("#5d646a"))
        far.ellipse(ax + 52, top + 48, w - 104, w - 104, rgb("#596066"))
        far.rect(ax + 52, top + 48 + (w - 104) // 2, w - 104, bottom - top - 48 - (w - 104) // 2, rgb("#596066"))
        # luz difusa no fundo do túnel
        far.rect(ax + 52, 248, w - 104, 64, rgb("#666d73"))
        # pedra-chave e juntas do arco
        far.rect(ax + r - 5, top - 9, 10, 12, rgb("#8a9197"))
        for k in range(-5, 6):
            ang = math.pi * (0.5 + k / 11)
            x0 = ax + r + math.cos(ang) * (r + 3)
            y0 = top + r - math.sin(ang) * (r + 3)
            far.px(x0, y0, rgb("#6c7379"))
        # canaleta de água no pé do arco
        far.rect(ax, bottom - 4, w, 4, rgb("#5f7a6c"))
        far.rect(ax + rnd.randint(10, 60), bottom - 3, rnd.randint(20, 40), 1, rgb("#7d9a8a"))
    # base da parede (calha)
    far.rect(0, 312, LW, 6, rgb("#5f666c"))
    far.rect(0, 312, LW, 1, rgb("#878e94"))
    far.save(os.path.join(out, "esgoto-fundo.png"))

    # Plano médio: tubulações e grades com brilho tóxico.
    mid = Layer(320)
    hpipe(mid, 30, 18, "#565e64", "#6b7379", "#474e54", "#4b5258", spacing=128, offset=20)
    hpipe(mid, 54, 8, "#5d656b", "#737b81", "#4c535a", "#50575d", spacing=96, offset=60)
    for bx in range(0, LW, 128):
        mid.rect(bx + 60, 0, 3, 30, rgb("#4a5157"))
        mid.rect(bx + 56, 0, 11, 3, rgb("#4a5157"))
    # Canos terminam em boca aberta despejando água tóxica no canal (a base
    # desta camada encosta no topo de esgoto-agua.png). O cano para acima de
    # y lógico ~210 (tela ~420): abaixo disso ficam as passarelas e ele
    # atravessaria o chão; só o jato passa por trás delas.
    for vx, end_y in ((150, 188), (470, 176)):
        cylinder(mid, vx, 48, 12, end_y - 48, "#59616a", "#6d757b", "#4b5258")
        mid.rect(vx - 2, 48, 16, 5, rgb("#4b5258"))
        mid.rect(vx - 2, 84, 16, 4, rgb("#4f565c"))
        # registro (volante)
        mid.ring(vx - 6, 112, 24, 24, rgb("#4a5157"), 3)
        mid.rect(vx + 5, 112, 2, 24, rgb("#4a5157"))
        mid.rect(vx - 6, 123, 24, 2, rgb("#4a5157"))
        pour(mid, vx, 12, end_y, 320, "#4b5258", vx)
    # grades com luz esverdeada e escorrido
    for gx, gy in ((300, 196), (590, 150)):
        glow(mid, gx + 20, gy + 14, 34, "#7fb08f", 40)
        mid.rect(gx, gy, 40, 28, rgb("#4b5258"))
        mid.rect(gx + 2, gy + 2, 36, 24, rgb("#6f9c80"))
        for bx in range(gx + 4, gx + 38, 5):
            mid.rect(bx, gy + 2, 2, 24, rgb("#4b5258"))
        mid.rect(gx + 12, gy + 28, 3, 40, rgb("#5f7f6c", 170))
        mid.rect(gx + 25, gy + 28, 2, 22, rgb("#5f7f6c", 140))
    # saída de esgoto (cano curto pingando)
    for ox in (250, 540):
        mid.rect(ox, 120, 26, 14, rgb("#4f565c"))
        mid.rect(ox + 22, 118, 6, 18, rgb("#596066"))
        mid.rect(ox + 6, 134, 2, 10, rgb("#7fa891", 160))
    mid.save(os.path.join(out, "esgoto-tubos.png"))

    # Primeiro plano alto: cabos pendurados e luminárias.
    near = Layer(130)
    anchors = [(0, 0), (100, 4), (230, 0), (340, 6), (470, 0), (560, 3), (640, 0)]
    for (x0, y0), (x1, y1) in zip(anchors, anchors[1:]):
        for sag, col in ((38, "#3c4348"), (52, "#353b40")):
            pts = []
            for i in range(41):
                t = i / 40
                pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)))
            near.line(pts, rgb(col), 2)
    for lx in (165, 405):
        near.rect(lx, 0, 2, 70, rgb("#353b40"))
        near.rect(lx - 7, 70, 16, 6, rgb("#353b40"))
        near.rect(lx - 5, 76, 12, 4, rgb("#e9d48a"))
        glow(near, lx + 1, 86, 30, "#e9d48a", 26)
    near.save(os.path.join(out, "esgoto-cabos.png"))

    # Névoa baixa que desliza devagar.
    mist = Layer(90)
    dens = tileable_noise(LW, 90, 3)
    fade = np.sin(np.linspace(0, math.pi, 90))[:, None]
    dithered_cloud(mist, "#a9b1b6", 110, dens * fade, 0.45)
    mist.save(os.path.join(out, "esgoto-nevoa.png"))

    # Canal de água tóxica no rodapé (aparece abaixo das passarelas).
    water = Layer(40)
    water.rect(0, 0, LW, 40, rgb("#3f5f4e"))
    water.rect(0, 0, LW, 3, rgb("#5f8a70"))
    water.rect(0, 3, LW, 1, rgb("#4b705b"))
    rnd = random.Random(5)
    for _ in range(70):
        y = rnd.randint(6, 36)
        water.rect(rnd.randint(0, LW), y, rnd.randint(4, 18), 1, rgb("#679a7b" if y < 20 else "#52806a"))
    water.save(os.path.join(out, "esgoto-agua.png"))


# ---------------------------------------------------------------------------
# Fase 2 — Distrito Industrial
# ---------------------------------------------------------------------------

def fase2():
    print("Fase 2 — industrial")
    out = os.path.join(OUT, "industrial")
    rnd = random.Random(21)

    # Céu de fuligem e silhuetas distantes de chaminés e torres.
    far = Layer(360)
    dithered_gradient(far, [(0, "#57524f"), (120, "#6d6762"), (205, "#867d74"), (250, "#7c756e"), (360, "#5a5450")])
    skyline = "#706a64"
    x = 0
    while x < LW:
        w = rnd.randint(20, 60)
        h = rnd.randint(18, 60)
        far.rect(x, 250 - h, w, 110 + h, rgb(skyline))
        for _ in range(rnd.randint(0, 3)):
            far.px(x + rnd.randint(2, w - 3), 250 - h + rnd.randint(4, h), rgb("#c79062"))
        x += w + rnd.randint(0, 10)
    for cx in (70, 380):  # torres de resfriamento
        pts = [(cx, 250), (cx + 6, 205), (cx + 2, 172), (cx + 58, 172), (cx + 54, 205), (cx + 60, 250)]
        far.poly(pts, rgb("#6b655f"))
        far.rect(cx + 2, 172, 56, 2, rgb("#7d766f"))
    for sx, top in ((180, 104), (212, 128), (500, 96), (560, 140)):  # chaminés
        far.rect(sx, top, 10, 250 - top, rgb("#68625c"))
        for by in range(top + 6, top + 40, 12):
            far.rect(sx, by, 10, 4, rgb("#86685c"))
        far.px(sx + 4, top - 1, rgb("#d7744f"))
    far.rect(0, 250, LW, 110, rgb("#6a645e"))
    far.rect(0, 250, LW, 1, rgb("#7c756e"))
    plume = Layer(360)
    dens = np.zeros((360, LW))
    yy, xx = np.mgrid[0:360, 0:LW]
    for sx, top in ((185, 104), (505, 96), (217, 128), (565, 140)):
        for k in range(14):
            px_ = sx + k * 7 + math.sin(k) * 3
            py_ = top - 6 - k * 6
            rad = 5 + k * 1.6
            dx = np.minimum(np.abs(xx - px_), LW - np.abs(xx - px_))
            dens = np.maximum(dens, np.clip(1 - np.hypot(dx, yy - py_) / rad, 0, 1) * (1 - k / 16))
    dithered_cloud(plume, "#8c857f", 200, dens, 0.05)
    far.im.alpha_composite(plume.im)
    far.save(os.path.join(out, "industrial-fundo.png"))

    # Plano médio: tanques, galpão com janelas acesas, treliça superior.
    mid = Layer(320)
    # treliça (ponte rolante)
    mid.rect(0, 18, LW, 4, rgb("#4c4744"))
    mid.rect(0, 40, LW, 4, rgb("#4c4744"))
    for tx in range(0, LW, 22):
        mid.line([(tx, 22), (tx + 11, 40), (tx + 22, 22)], rgb("#4c4744"), 2)
    # feixe de canos ligando os prédios (desenhado antes = passa por trás)
    for py_, th in ((236, 6), (246, 4)):
        mid.rect(0, py_, LW, th, rgb("#4f4a47"))
        mid.rect(0, py_, LW, 1, rgb("#625c58"))
    # tanques
    for tx, tw, ttop in ((40, 104, 150), (180, 70, 190), (500, 90, 170)):
        mid.ellipse(tx, ttop - tw // 6, tw, tw // 3, rgb("#5e5955"))
        cylinder(mid, tx, ttop, tw, 300 - ttop, "#5e5955", "#6b6561", "#504b48")
        for sy in range(ttop + 24, 300, 26):
            mid.rect(tx, sy, tw, 1, rgb("#54504c"))
        mid.rect(tx + tw - 18, ttop + 8, 6, 300 - ttop - 8, rgb("#4c4744"))
        for ly in range(ttop + 10, 300, 6):
            mid.rect(tx + tw - 18, ly, 6, 1, rgb("#5e5955"))
        mid.rect(tx + 10, ttop + 40, tw // 3, 6, rgb("#8f7d4f"))
    # galpão com janelas
    mid.rect(290, 120, 170, 180, rgb("#56514e"))
    mid.poly([(284, 122), (375, 92), (466, 122)], rgb("#56514e"))
    mid.rect(284, 120, 182, 3, rgb("#625c58"))
    for wy in range(136, 280, 22):
        for wx in range(302, 448, 18):
            lit = rnd.random() < 0.55
            mid.rect(wx, wy, 10, 12, rgb("#c98d55" if lit else "#423d3a"))
            if lit:
                mid.rect(wx, wy, 10, 2, rgb("#e0aa6c"))
    # gancho da ponte rolante
    mid.rect(560, 44, 2, 96, rgb("#46413e"))
    mid.rect(552, 140, 18, 8, rgb("#46413e"))
    mid.rect(558, 148, 6, 10, rgb("#46413e"))
    mid.save(os.path.join(out, "industrial-galpao.png"))

    # Primeiro plano alto: correntes e luminárias de galpão.
    near = Layer(110)
    for cx, length in ((90, 70), (300, 46), (420, 84), (610, 58)):
        for cy in range(0, length, 4):  # elos alternados da corrente
            if (cy // 4) % 2:
                near.rect(cx, cy, 3, 4, rgb("#3c3734"))
            else:
                near.rect(cx + 1, cy, 1, 4, rgb("#3c3734"))
        near.rect(cx - 3, length, 9, 3, rgb("#3c3734"))
        near.rect(cx + 3, length + 3, 3, 6, rgb("#3c3734"))
    for lx in (200, 520):
        near.rect(lx, 0, 2, 40, rgb("#3c3734"))
        near.poly([(lx - 12, 52), (lx - 4, 40), (lx + 6, 40), (lx + 14, 52)], rgb("#3c3734"))
        near.rect(lx - 9, 52, 20, 2, rgb("#f0c27a"))
        near.poly([(lx - 9, 54), (lx + 11, 54), (lx + 34, 110), (lx - 32, 110)], rgb("#f0c27a", 22))
    near.save(os.path.join(out, "industrial-correntes.png"))

    # Fumaça que atravessa a tela.
    smoke = Layer(150)
    dens = tileable_noise(LW, 150, 9)
    fade = np.sin(np.linspace(0, math.pi, 150))[:, None] ** 0.8
    dithered_cloud(smoke, "#958c84", 120, dens * fade, 0.5)
    smoke.save(os.path.join(out, "industrial-fumaca.png"))

    # Rodapé: maquinário escuro abaixo do piso.
    base = Layer(40)
    base.rect(0, 6, LW, 34, rgb("#3f3a37"))
    base.rect(0, 6, LW, 2, rgb("#544e4a"))
    for bx in range(0, LW, 80):
        base.rect(bx + 8, 0, 30, 10, rgb("#47423f"))
        base.rect(bx + 46, 14, 20, 20, rgb("#4a4542"))
        base.px(bx + 55, 20, rgb("#d98a4f"))
    base.save(os.path.join(out, "industrial-rodape.png"))


# ---------------------------------------------------------------------------
# Fase 3 — Meio Urbano (reaproveita o pack Warped City, CC0, de ansimuz)
# ---------------------------------------------------------------------------

def tint(img: Image.Image, color: str, amount: float, keep_bright: float = 0.0, bottom_extra: float = 0.0) -> Image.Image:
    """Mistura a imagem com uma cor de smog.

    `keep_bright` preserva luzes/neon; `bottom_extra` engrossa o smog em
    direção à base da imagem (nível da rua), onde Alex e os inimigos
    correm e precisam se destacar do fundo.
    """
    a = np.asarray(img.convert("RGBA")).astype(float)
    c = np.array(rgb(color)[:3], float)
    lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]) / 255
    sat = (a[..., :3].max(-1) - a[..., :3].min(-1)) / 255
    ramp = (np.arange(a.shape[0]) / max(1, a.shape[0] - 1))[:, None] ** 1.5
    k = (amount + bottom_extra * ramp) * (1 - keep_bright * np.clip((sat - 0.35) * 2 + (lum - 0.5) * 2, 0, 1))
    k = np.clip(k, 0, 1)
    a[..., :3] = a[..., :3] * (1 - k[..., None]) + c * k[..., None]
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), "RGBA")


def fase3():
    print("Fase 3 — meio urbano")
    out = os.path.join(OUT, "meio-urbano")
    sky_a = Image.open(os.path.join(WARPED_CITY_BG, "skyline-a.png")).convert("RGBA")
    sky_b = Image.open(os.path.join(WARPED_CITY_BG, "skyline-b.png")).convert("RGBA")
    buildings = Image.open(os.path.join(WARPED_CITY_BG, "buildings-bg.png")).convert("RGBA")
    near = Image.open(os.path.join(WARPED_CITY_BG, "near-buildings-bg.png")).convert("RGBA")

    def save(img: Image.Image, scale: int, name: str):
        path = os.path.join(out, name)
        os.makedirs(out, exist_ok=True)
        img.resize((img.width * scale, img.height * scale), Image.NEAREST).save(path, optimize=True)
        print(f"  {os.path.relpath(path, PROJECT)}  {img.width * scale}x{img.height * scale}")

    # Céu: as duas variações lado a lado (256x240 -> 768x720), sob smog.
    sky = Image.new("RGBA", (sky_a.width * 2, sky_a.height))
    sky.paste(sky_a, (0, 0))
    sky.paste(sky_b, (sky_a.width, 0))
    save(tint(sky, "#6e6f80", 0.5, keep_bright=0.4), 3, "urbano-ceu.png")

    # Prédios distantes (144x124 -> 432x372).
    save(tint(buildings, "#727585", 0.5, keep_bright=0.5, bottom_extra=0.2), 3, "urbano-predios-longe.png")

    # Prédios próximos (493x209 -> 986x418), com folga entre repetições.
    pad = Image.new("RGBA", (near.width + 40, near.height))
    pad.paste(near, (0, 0))
    save(tint(pad, "#767a8c", 0.4, keep_bright=0.5, bottom_extra=0.42), 2, "urbano-predios-perto.png")

    # Smog baixo no nível da rua.
    haze = Layer(110)
    dens = tileable_noise(LW, 110, 31)
    fade = np.sin(np.linspace(0, math.pi, 110))[:, None]
    dithered_cloud(haze, "#8f93a3", 95, dens * fade, 0.42)
    haze.save(os.path.join(out, "urbano-smog.png"))

    # Rodapé: viaduto e avenida de baixo. Sem ele, a faixa abaixo do piso
    # (y de tela > ~650) mostrava só o azul liso do fim do céu.
    rnd = random.Random(33)
    base = Layer(72)
    dithered_cloud(base, "#2a2e49", 255, np.clip(np.arange(72)[:, None] / 22, 0, 1) * np.ones((1, LW)), 0.0)
    base.rect(0, 22, LW, 50, rgb("#2a2e49"))
    for _ in range(60):  # janelas e letreiros da rua de baixo
        base.rect(rnd.randint(0, LW), rnd.randint(40, 68), rnd.choice([2, 3]), 1, rgb(rnd.choice(["#b0508f", "#4a9fb8", "#c9a46a"]), 170))
    for px_ in range(40, LW, 160):  # pilares do viaduto
        base.rect(px_, 35, 12, 37, rgb("#33385a"))
        base.rect(px_, 35, 2, 37, rgb("#454b70"))
    base.rect(0, 30, LW, 5, rgb("#3a3f5e"))
    base.rect(0, 30, LW, 1, rgb("#565c82"))
    base.rect(0, 26, LW, 1, rgb("#4a5074"))  # guarda-corpo
    for px_ in range(0, LW, 16):
        base.rect(px_, 26, 1, 4, rgb("#3a3f5e"))
    for lx in range(20, LW, 80):  # postes
        glow(base, lx + 5, 15, 10, "#f2c98a", 30)
        base.rect(lx, 12, 1, 14, rgb("#3a3f5e"))
        base.rect(lx, 12, 5, 1, rgb("#3a3f5e"))
        base.px(lx + 5, 13, rgb("#f2c98a"))
    for _ in range(14):  # faróis e lanternas dos carros
        cx = rnd.randrange(8, LW, 4)
        base.rect(cx, 28, 2, 1, rgb("#e8e2c0"))
        base.px(cx - 5, 28, rgb("#d6506e"))
    base.save(os.path.join(out, "urbano-rodape.png"))


# ---------------------------------------------------------------------------
# Fase 4 — Distrito Corporativo
# ---------------------------------------------------------------------------

def fase4():
    """Saguão corporativo: fachada de vidro com a cidade de baixo ao fundo.

    Mais limpo e frio que as fases anteriores (GDD: "o cenário fica mais
    limpo e luxuoso"). Mantém o cinza calibrado (#787f86, mesmo fundo de
    câmera da Fase 1) na faixa do jogador.
    """
    print("Fase 4 — corporativo")
    out = os.path.join(OUT, "corporativo")
    rnd = random.Random(41)

    # Vista pela janela: a cidade baixa à noite, vista de cima, sob vidro fumê.
    far = Layer(360)
    dithered_gradient(far, [(0, "#3a4552"), (120, "#56616d"), (220, "#6d7783"), (300, "#68727d"), (360, "#505a65")])
    x = 0
    while x < LW:  # silhuetas da cidade lá embaixo
        w = rnd.randint(14, 40)
        top = rnd.randint(196, 250)
        far.rect(x, top, w, 360 - top, rgb("#5f6975"))
        for _ in range(rnd.randint(1, 5)):
            far.px(x + rnd.randint(1, w - 2), top + rnd.randint(3, 60), rgb(rnd.choice(["#c9a46a", "#8fc6c9", "#b8bfc6"])))
        x += w + rnd.randint(1, 6)
    haze = Layer(360)
    dens = tileable_noise(LW, 360, 43)
    band = np.exp(-(((np.arange(360) - 262) / 38.0) ** 2))[:, None]
    dithered_cloud(haze, "#7b858f", 150, dens * band, 0.25)
    far.im.alpha_composite(haze.im)
    for rx in range(0, LW, 160):  # reflexos diagonais no vidro
        far.poly([(rx + 30, 0), (rx + 70, 0), (rx - 50, 360), (rx - 90, 360)], rgb("#9aa5b0", 22))
        far.poly([(rx + 82, 0), (rx + 92, 0), (rx - 28, 360), (rx - 38, 360)], rgb("#9aa5b0", 18))
    far.save(os.path.join(out, "corp-cidade.png"))

    # Fachada: pilares claros com LED teal, caixilhos e forro iluminado.
    mid = Layer(320)
    # forro escuro: o HUD (texto claro) fica por cima dessa faixa
    mid.rect(0, 0, LW, 24, rgb("#5b636b"))
    mid.rect(0, 20, LW, 2, rgb("#d6e6ec"))
    mid.rect(0, 24, LW, 2, rgb("#4c535a"))
    for bx in range(0, LW, 160):
        # caixilhos finos entre os pilares
        for mx in (bx + 26 + 44, bx + 26 + 89):
            mid.rect(mx, 26, 2, 274, rgb("#7a838c"))
        mid.rect(bx + 26, 150, 134, 2, rgb("#7a838c"))
        # pilar
        mid.rect(bx, 26, 26, 274, rgb("#a3acb4"))
        mid.rect(bx, 26, 3, 274, rgb("#b8c1c8"))
        mid.rect(bx + 22, 26, 4, 274, rgb("#878f97"))
        mid.rect(bx + 12, 40, 2, 250, rgb("#59c9c4"))
        mid.rect(bx + 11, 40, 4, 1, rgb("#bff3ef"))
        mid.rect(bx - 2, 290, 30, 10, rgb("#8b939b"))
        # spot no forro
        mid.rect(bx + 90, 22, 10, 3, rgb("#eef6f8"))
        mid.poly([(bx + 90, 25), (bx + 100, 25), (bx + 118, 110), (bx + 72, 110)], rgb("#e9f2f5", 16))
    mid.rect(0, 300, LW, 20, rgb("#858d95"))
    mid.rect(0, 300, LW, 1, rgb("#a9b2ba"))
    mid.save(os.path.join(out, "corp-fachada.png"))

    # Telas holográficas penduradas (gráfico em alta e o emblema da corporação).
    near = Layer(200)
    # tela com gráfico (abaixo da faixa do HUD, y de tela > 200)
    sx, sy, sw, sh = 70, 112, 120, 62
    near.rect(sx + 14, 0, 1, sy, rgb("#5d666e"))
    near.rect(sx + sw - 15, 0, 1, sy, rgb("#5d666e"))
    near.rect(sx, sy, sw, sh, rgb("#59c9c4", 60))
    near.rect(sx, sy, sw, 2, rgb("#9ff0ea", 160))
    near.rect(sx, sy + sh - 2, sw, 2, rgb("#9ff0ea", 120))
    for i, h in enumerate((10, 16, 13, 22, 28, 25, 36, 44)):
        near.rect(sx + 10 + i * 13, sy + sh - 6 - h, 8, h, rgb("#a8f4ee", 120))
    near.line([(sx + 10, sy + 44), (sx + 40, sy + 34), (sx + 66, sy + 30), (sx + 110, sy + 10)], rgb("#e9fffd", 190), 1)
    # emblema (olho estilizado dentro de losango) — sem texto
    ex, ey = 420, 140
    near.rect(ex, 0, 1, ey - 30, rgb("#5d666e"))
    near.poly([(ex, ey - 30), (ex + 34, ey), (ex, ey + 30), (ex - 34, ey)], rgb("#59c9c4", 55))
    near.poly([(ex, ey - 24), (ex + 28, ey), (ex, ey + 24), (ex - 28, ey)], rgb("#59c9c4", 30))
    near.ellipse(ex - 18, ey - 8, 36, 16, rgb("#a8f4ee", 150))
    near.ellipse(ex - 6, ey - 6, 12, 12, rgb("#3f6f74", 220))
    near.ellipse(ex - 2, ey - 2, 4, 4, rgb("#e9fffd", 230))
    # trilho de luz no teto
    near.rect(0, 0, LW, 3, rgb("#4c535a"))
    for lx in range(20, LW, 80):
        near.rect(lx, 3, 6, 2, rgb("#eef6f8"))
    near.save(os.path.join(out, "corp-telas.png"))

    # Rodapé: piso escuro polido abaixo da passarela.
    base = Layer(40)
    base.rect(0, 0, LW, 40, rgb("#414a53"))
    base.rect(0, 0, LW, 2, rgb("#59c9c4"))
    base.rect(0, 2, LW, 1, rgb("#2f363d"))
    for rx in range(0, LW, 64):
        base.rect(rx, 8, 30, 1, rgb("#58626c"))
        base.rect(rx + 10, 18, 18, 1, rgb("#4f5962"))
    base.save(os.path.join(out, "corp-rodape.png"))


# ---------------------------------------------------------------------------
# Fase 5 — Topo da Cidade
# ---------------------------------------------------------------------------

def cloud_bank(layer: Layer, base_y: int, amp: float, seed: int, body: str, top: str, light: str):
    """Mar de nuvens em bolhas (repete em X), com topo iluminado pela lua.

    Cada bolha é desenhada três vezes: luz deslocada para cima, topo e corpo
    deslocados para baixo - sombreado clássico de nuvem em pixel art.
    """
    rnd = random.Random(seed)
    puffs = []
    x = 0.0
    while x < layer.w:
        r = rnd.uniform(10, 26)
        y = base_y - rnd.uniform(0, amp) + r * 0.6
        puffs.append((x, y, r))
        x += r * rnd.uniform(0.8, 1.3)
    for color, dy in ((light, -2), (top, 0), (body, 4)):
        for px_, py_, r in puffs:
            layer.ellipse(px_ - r, py_ - r + dy, r * 2, r * 2, rgb(color))
        layer.rect(0, base_y + 14 + dy, layer.w, layer.h, rgb(color))
    # segunda fileira de bolhas, mais baixa, para dar volume
    for color, dy in ((top, 0), (body, 4)):
        for px_, py_, r in puffs[::2]:
            layer.ellipse(px_ + r * 0.5 - r * 0.8, py_ + 26 - r * 0.8 + dy, r * 1.6, r * 1.6, rgb(color))


def fase5():
    """Topo da cidade: noite acima das nuvens, torres de luxo, lua.

    Mantém o azul-noite calibrado da fase (TILED_FASE5_BACKGROUND, #16283a)
    como tom dominante; a Alex se destaca pela camisa clara.
    """
    print("Fase 5 — topo")
    out = os.path.join(OUT, "topo")
    rnd = random.Random(51)

    # Céu com estrelas, lua e brilho roxo no horizonte.
    sky = Layer(360)
    dithered_gradient(sky, [(0, "#0b1322"), (110, "#13213a"), (200, "#1b2a48"), (250, "#2b2c55"), (290, "#463a6c"), (320, "#5a4479"), (360, "#3b2f5a")])
    for _ in range(140):
        y = int(rnd.triangular(0, 230, 0))
        sky.px(rnd.randint(0, LW - 1), y, rgb(rnd.choice(["#c9d3f0", "#8f9cc4", "#8f9cc4", "#f0e2b8"])))
    for _ in range(10):  # estrelas maiores em cruz
        sx_, sy_ = rnd.randint(0, LW - 1), rnd.randint(8, 180)
        sky.px(sx_, sy_, rgb("#eef2ff"))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sky.px(sx_ + dx, sy_ + dy, rgb("#8f9cc4"))
    # lua abaixo da faixa do HUD (y de tela < ~110): ela cruza a tela devagar
    # e passaria por trás do texto na segunda metade da fase
    mx, my, mr = 470, 104, 24
    glow(sky, mx, my, 56, "#7f86c8", 22)
    sky.ellipse(mx - mr, my - mr, mr * 2, mr * 2, rgb("#e6e1f2"))
    sky.ellipse(mx - mr + 6, my - mr + 2, mr * 2 - 4, mr * 2 - 4, rgb("#d2cce4"))
    sky.ellipse(mx - mr, my - mr, mr * 2 - 8, mr * 2 - 6, rgb("#ece8f6"))
    for cx, cy, cr in ((462, 96, 4), (476, 112, 6), (468, 118, 3), (482, 94, 3)):
        sky.ellipse(cx - cr, cy - cr, cr * 2, cr * 2, rgb("#d4cee6"))
    sky.save(os.path.join(out, "topo-ceu.png"))

    # Torres distantes furando o mar de nuvens.
    clouds = Layer(170)
    for tx in (40, 150, 230, 330, 420, 560):
        h = rnd.randint(70, 130)
        w = rnd.choice([6, 8, 10])
        clouds.rect(tx, 170 - 60 - h, w, h + 60, rgb("#24304e"))
        clouds.rect(tx + w // 2, 170 - 60 - h - 18, 1, 18, rgb("#24304e"))
        clouds.px(tx + w // 2, 170 - 60 - h - 19, rgb("#ff6f8f"))
        for wy in range(170 - 60 - h + 6, 170 - 50, 7):
            clouds.rect(tx + 1, wy, w - 2, 1, rgb("#d9b46a" if rnd.random() < 0.5 else "#5fb8e0", 150))
    cloud_bank(clouds, 112, 34, 52, "#41386a", "#5e5292", "#8577b8")
    puff = Layer(170)
    dithered_cloud(puff, "#6d60a0", 120, tileable_noise(LW, 170, 53) * np.clip((np.arange(170)[:, None] - 100) / 70, 0, 1), 0.35)
    clouds.im.alpha_composite(puff.im)
    clouds.save(os.path.join(out, "topo-nuvens.png"))

    # Torres de luxo com faixas de luz, pontes aéreas e antenas.
    towers = Layer(320)
    accents = ["#5fd6ff", "#f0c36a", "#b57cff", "#f0c36a"]
    layout = [(30, 62, 70), (170, 44, 120), (300, 74, 40), (460, 52, 96), (560, 38, 150)]
    for i, (tx, tw, top) in enumerate(layout):
        acc = accents[i % len(accents)]
        towers.rect(tx, top, tw, 320 - top, rgb("#1a2640"))
        towers.rect(tx, top, 3, 320 - top, rgb("#25334f"))
        towers.rect(tx + tw - 5, top, 5, 320 - top, rgb("#131c30"))
        # coroa recortada e antena
        towers.poly([(tx, top), (tx + tw // 2, top - 26), (tx + tw, top)], rgb("#1a2640"))
        towers.rect(tx + tw // 2, top - 50, 2, 26, rgb("#1a2640"))
        towers.px(tx + tw // 2, top - 51, rgb("#ff6f8f"))
        # faixas verticais de luz com interrupções
        for k, lx in enumerate((tx + 8, tx + tw - 12)):
            y = top + 10
            while y < 320:
                seg = rnd.randint(18, 60)
                towers.rect(lx, y, 2, seg, rgb(acc, 200 if k == 0 else 140))
                y += seg + rnd.randint(4, 14)
        for wy in range(top + 14, 320, 12):  # andares discretos
            towers.rect(tx + 14, wy, tw - 30, 1, rgb("#24324f"))
    # pontes aéreas
    for (ax, ay, bx_) in ((92, 190, 170), (214, 230, 300), (512, 170, 560)):
        towers.rect(ax, ay, bx_ - ax, 7, rgb("#1f2b45"))
        towers.rect(ax, ay + 2, bx_ - ax, 1, rgb("#8fe3ff", 170))
    towers.save(os.path.join(out, "topo-torres.png"))

    # Nuvens passando na frente das torres.
    wisps = Layer(100)
    dens = tileable_noise(LW, 100, 57)
    fade = np.sin(np.linspace(0, math.pi, 100))[:, None]
    dithered_cloud(wisps, "#8a7fb8", 120, dens * fade, 0.5)
    wisps.save(os.path.join(out, "topo-nevoa.png"))

    # Trecho contemplativo final (camadas com `appear_x` no mapa): aurora no
    # céu e a cidade alta iluminada ao longe, com a torre central.
    rnd = random.Random(59)
    aurora = Layer(360)
    xs = np.arange(LW)[None, :] / LW * 2 * math.pi
    ys = np.arange(360)[:, None]
    rays = 0.55 + 0.45 * tileable_noise(LW, 1, 61, octaves=((8, 1.0), (20, 0.6)))
    # cortinas acima de y lógico ~65 (tela ~130), fora da faixa do HUD
    for color, base_y, amp, k, thick, alpha in (("#4fd6b0", 124, 26, 2, 16, 105), ("#9a7be0", 152, 20, 3, 12, 90), ("#5fb8e0", 100, 12, 1, 9, 80)):
        d = ys - (base_y + amp * np.sin(k * xs + rnd.uniform(0, 6.3)))
        # borda de baixo nítida, raios esmaecendo para cima
        dens = np.where(d > 0, np.exp(-((d / (thick * 0.35)) ** 2)), np.exp(-((d / (thick * 2.2)) ** 2))) * rays
        dithered_cloud(aurora, color, alpha, dens, 0.12)
    aurora.save(os.path.join(out, "topo-final-aurora.png"))

    city = Layer(320)
    for bx_, tip in ((96, 70), (540, 84)):  # holofotes
        city.poly([(bx_, 230), (tip - 14, 22), (tip + 14, 22)], rgb("#c9d3f0", 14))
    lights = ["#f0c36a", "#f0c36a", "#5fd6ff", "#e9b0ff"]
    x = 0
    while x < LW - 12:
        w = min(rnd.randint(14, 34), LW - x)
        top = rnd.randint(120, 215)
        city.rect(x, top, w, 320 - top, rgb("#222e52"))
        city.rect(x, top, 2, 320 - top, rgb("#2e3c66"))
        if rnd.random() < 0.4:
            city.rect(x + w // 2, top - 12, 1, 12, rgb("#222e52"))
            city.px(x + w // 2, top - 13, rgb("#ff6f8f"))
        for wy in range(top + 5, 320, 5):
            for wx in range(x + 4, x + w - 3, 4):
                if rnd.random() < 0.3:
                    city.px(wx, wy, rgb(rnd.choice(lights), 170))
        x += w + rnd.randint(2, 10)
    # torre central com anéis de luz e farol
    cx = 320
    glow(city, cx, 56, 44, "#8fe3ff", 18)
    city.poly([(cx - 24, 320), (cx - 15, 124), (cx - 5, 52), (cx + 5, 52), (cx + 15, 124), (cx + 24, 320)], rgb("#1d2848"))
    city.line([(cx - 24, 320), (cx - 15, 124), (cx - 5, 52)], rgb("#33426e"), 1)
    city.rect(cx, 28, 1, 24, rgb("#1d2848"))
    city.px(cx, 27, rgb("#ff6f8f"))
    for y in range(64, 312, 14):
        city.rect(cx - 1, y, 2, 9, rgb("#8fe3ff", 200))
    for ry, rw in ((92, 60), (140, 84)):
        city.ring(cx - rw // 2, ry - 5, rw, 10, rgb("#8fe3ff", 170), 1)
    city.save(os.path.join(out, "topo-final-cidade.png"))


if __name__ == "__main__":
    fase1()
    fase2()
    fase3()
    fase4()
    fase5()

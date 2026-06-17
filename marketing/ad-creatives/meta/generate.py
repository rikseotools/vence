#!/usr/bin/env python3
"""
Generador de creativos para anuncios de Meta (Facebook/Instagram).

Produce imágenes 1080x1080 a partir de un CONFIG de oposición, en varias
variantes para A/B testing (color de acento, posición del logo, tema bandera).

Uso:
    python3 marketing/ad-creatives/meta/generate.py

Para una oposición nueva: copia un bloque de CONFIGS, cambia título/plazas/región
y la carpeta de salida. El texto se compone con Pillow (pixel-perfect, sin
erratas) — NO usa IA generativa, que escribe mal el texto.

Requiere: Pillow, fuentes Open Sans, public/vence-logo.png
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math

# Rutas relativas a la raíz del repo
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LOGO_PATH = os.path.join(REPO, "public", "vence-logo.png")
FONT_DIR = "/usr/share/fonts/open-sans"
FB = f"{FONT_DIR}/OpenSans-Bold.ttf"
FX = f"{FONT_DIR}/OpenSans-ExtraBold.ttf"
FS = f"{FONT_DIR}/OpenSans-Semibold.ttf"

W = H = 1080
NAVY = (8, 21, 56); BLUE = (20, 86, 160); WHITE = (255, 255, 255)
GREEN = (46, 213, 115); RED = (230, 57, 70); CARMESI = (193, 0, 47); GOLD = (247, 201, 72)


def font(sz, p=FB):
    if not os.path.exists(p):
        p = FB
    return ImageFont.truetype(p, sz)


def star(d, cx, cy, R, fill, points=5, rot=-90):
    pts = []
    for i in range(points * 2):
        ang = math.radians(rot + i * 180 / points)
        rad = R if i % 2 == 0 else R * 0.42
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    d.polygon(pts, fill=fill)


def grad(top, bot):
    im = Image.new("RGB", (W, H), top); p = im.load()
    for y in range(H):
        t = y / H
        row = (int(top[0]*(1-t)+bot[0]*t), int(top[1]*(1-t)+bot[1]*t), int(top[2]*(1-t)+bot[2]*t))
        for x in range(W):
            p[x, y] = row
    return im


def build(cfg, name, accent, accent_text, logo_pos, theme, out_dir):
    """Genera una variante. cfg = dict con titulo1, titulo2, numero, label, badge, cta, beneficios[]"""
    # --- fondo ---
    if theme == "navy":
        img = grad((7, 18, 50), (17, 72, 140))
        glow = Image.new("L", (W, H), 0)
        ImageDraw.Draw(glow).ellipse([W//2-460, 120, W//2+460, 1040], fill=70)
        glow = glow.filter(ImageFilter.GaussianBlur(180))
        img = Image.composite(Image.new("RGB", (W, H), (40, 120, 200)), img, glow)
    elif theme == "flag":  # bandera Comunidad de Madrid: carmesí + 7 estrellas
        img = grad((150, 0, 35), (205, 15, 55))
        wm = Image.new("RGBA", (W, H), (0, 0, 0, 0)); wd = ImageDraw.Draw(wm)
        for (sx, sy) in [(300,150),(450,150),(600,150),(750,150),(375,300),(525,300),(675,300)]:
            star(wd, sx, sy, 46, (255, 255, 255, 38))
        img = Image.alpha_composite(img.convert("RGBA"), wm).convert("RGB")
    d = ImageDraw.Draw(img)

    def bb(t, fn): return d.textbbox((0, 0), t, font=fn)
    def wf(t, fn): b = bb(t, fn); return b[2]-b[0]
    def ct(y, txt, fn, fill, sh=None, off=3):
        w = wf(txt, fn); x = (W-w)//2; b = bb(txt, fn)
        if sh:
            d.text((x+off, y+off-b[1]), txt, font=fn, fill=sh)
        d.text((x, y-b[1]), txt, font=fn, fill=fill)

    # --- logo en esquina ---
    logo = Image.open(LOGO_PATH).convert("RGBA")
    lh = 104; lw = int(logo.width*lh/logo.height); logo = logo.resize((lw, lh))
    lx, ly = (48, 46) if logo_pos == "tl" else (W-lw-48, H-lh-44)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([lx+4, ly+6, lx+lw+4, ly+lh+6], radius=20, fill=(0, 0, 0, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img.convert("RGBA"), sh).convert("RGB")
    img.paste(logo, (lx, ly), logo); d = ImageDraw.Draw(img)

    # --- badge ---
    bf = font(30, FB); bw = wf(cfg["badge"], bf); bbd = bb(cfg["badge"], bf); bh = bbd[3]-bbd[1]
    bx0 = (W-bw-60)//2
    d.rounded_rectangle([bx0, 72, bx0+bw+60, 72+bh+34], radius=30, outline=accent, width=3)
    d.text((bx0+30, 72+17-bbd[1]), cfg["badge"], font=bf, fill=accent)

    # --- títulos ---
    ct(168, cfg["headline"], font(118, FX), WHITE, (2, 8, 24), 4)
    ct(320, cfg["titulo1"], font(54, FB), accent, (2, 8, 24), 2)
    ct(387, cfg["titulo2"], font(54, FB), accent, (2, 8, 24), 2)

    # --- card de plazas ---
    cx0, cy0, cx1, cy1 = 200, 485, 880, 748
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([cx0+8, cy0+14, cx1+8, cy1+14], radius=36, fill=(0, 0, 0, 120))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img.convert("RGBA"), sh).convert("RGB"); d = ImageDraw.Draw(img)
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=36, fill=WHITE)
    d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=36, outline=accent, width=5)
    nf = font(150, FX); nbd = bb(cfg["numero"], nf); nh = nbd[3]-nbd[1]
    pf = font(38, FB); pbd = bb(cfg["label"], pf); ph = pbd[3]-pbd[1]
    gap = 30; group = nh+gap+ph; gy0 = cy0+((cy1-cy0)-group)//2
    nw = wf(cfg["numero"], nf); d.text(((W-nw)//2, gy0-nbd[1]), cfg["numero"], font=nf, fill=NAVY)
    pw = wf(cfg["label"], pf)
    d.text(((W-pw)//2, gy0+nh+gap-pbd[1]), cfg["label"], font=pf, fill=(BLUE if theme != "flag" else CARMESI))

    # --- beneficios con check ---
    tf = font(42, FS); r = 15; cg = 24
    mw = max(wf(t, tf) for t in cfg["beneficios"]); tot = 2*r+cg+mw; x0 = (W-tot)//2; yb = 798
    for t in cfg["beneficios"]:
        tbd = bb(t, tf); th = tbd[3]-tbd[1]; cy = yb+(th-2*r)//2
        d.ellipse([x0, cy, x0+2*r, cy+2*r], fill=accent)
        # check (si el acento es blanco, dibuja el tick en color de acento_text para que se vea)
        tick = NAVY if accent == WHITE else WHITE
        d.line([(x0+r*0.5, cy+r*1.05), (x0+r*0.85, cy+r*1.42), (x0+r*1.55, cy+r*0.58)], fill=tick, width=5)
        d.text((x0+2*r+cg, yb-tbd[1]), t, font=tf, fill=WHITE); yb += 70

    # --- CTA ---
    bx0, by0, bx1, by1 = 330, 938, 750, 1024
    sh2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh2).rounded_rectangle([bx0, by0+8, bx1, by1+8], radius=44, fill=(0, 0, 0, 110))
    sh2 = sh2.filter(ImageFilter.GaussianBlur(12))
    img = Image.alpha_composite(img.convert("RGBA"), sh2).convert("RGB"); d = ImageDraw.Draw(img)
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=44, fill=accent)
    cf = font(46, FX); cbd = bb(cfg["cta"], cf); cw = cbd[2]-cbd[0]; chh = cbd[3]-cbd[1]
    d.text(((W-cw)//2, by0+(by1-by0-chh)//2-cbd[1]), cfg["cta"], font=cf, fill=accent_text)

    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{name}.jpg")
    img.save(out, quality=94)
    print("OK", out)
    return out


# Variantes A/B estándar: (nombre, acento, color_texto_boton, posicion_logo, tema)
VARIANTS = [
    ("A_verde_logoTL",    GREEN,   NAVY,    "tl", "navy"),
    ("B_verde_logoBR",    GREEN,   NAVY,    "br", "navy"),
    ("C_rojo_logoTL",     RED,     WHITE,   "tl", "navy"),
    ("D_rojo_logoBR",     RED,     WHITE,   "br", "navy"),
    ("E_bandera_madrid",  WHITE,   CARMESI, "br", "flag"),
    ("F_carmesi_logoBR",  CARMESI, WHITE,   "br", "navy"),
]


def generate_all(cfg, out_dir):
    for (name, accent, atext, pos, theme) in VARIANTS:
        build(cfg, name, accent, atext, pos, theme, out_dir)


if __name__ == "__main__":
    # === CONFIG: Auxiliar Administrativo Comunidad de Madrid ===
    MADRID = {
        "badge": "CONVOCATORIA 2026",
        "headline": "¡HAZ TESTS!",
        "titulo1": "AUXILIAR ADMINISTRATIVO",
        "titulo2": "COMUNIDAD DE MADRID",
        "numero": "645",
        "label": "PLAZAS LIBRES",
        "beneficios": ["Tests de exámenes oficiales", "Practica gratis, mide tu progreso"],
        "cta": "PROBAR GRATIS",
    }
    generate_all(MADRID, os.path.join(os.path.dirname(__file__), "madrid"))

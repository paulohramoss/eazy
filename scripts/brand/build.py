"""Gera o kit de marca do Eazy a partir dos paths vetorizados.

Saídas em OUT/ (espelha a árvore do repo):
  public/...            favicons, ícones PWA, maskable, monochrome, splash iOS, og-image
  src/assets/brand/...  SVGs usados pela UI (lockup claro/escuro, marca)
"""
import io
import os
import re
import sys

import resvg_py
from PIL import Image

OUT = sys.argv[1]
W = os.path.dirname(os.path.abspath(__file__))

BLUE = '#0765F9'      # fundo do tile
LIME = '#BDDF33'      # traços da mão
WORD = '#1E45FC'      # "eazy" no tema claro
WORD_DARK = '#FFF9EF' # "eazy" no tema escuro
CREAM = '#FFF9EF'
INK = '#111111'


def rd(path):
    d = open(os.path.join(W, path)).read()
    return re.sub(r'(\d+\.\d)\d+', r'\1', d)  # 1 casa decimal basta


HAND, EAZY, TAG = rd('hand.d'), rd('eazy.d'), rd('tagline.d')

# Tile original: 374x324 em (80,104), raio 50.
TW, TH, TR = 374, 324, 50


def hand_in_square(size, scale=1.08, bleed_bottom=True):
    """Transform da mão (coords do tile 374x324) para um quadrado `size`,
    ancorada embaixo (o braço sai pela borda) e centrada na horizontal."""
    k = size / TW
    s = k * scale
    tx = k * (TW / 2) - s * (TW / 2)
    ty = size - s * TH
    return f'matrix({s:.5f} 0 0 {s:.5f} {tx:.3f} {ty:.3f})'


def svg(vb, body, w=None, h=None):
    wh = f' width="{w}" height="{h}"' if w else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{wh}>'
            f'{body}</svg>')


def mark_body(size=512, radius=None, art_scale=1.08, art_color=LIME, bg=BLUE, id_='m', bold=0):
    r = TR / TW * size if radius is None else radius
    clip = f'<clipPath id="{id_}"><rect width="{size}" height="{size}" rx="{r:.2f}"/></clipPath>'
    bgrect = f'<rect width="{size}" height="{size}" rx="{r:.2f}" fill="{bg}"/>' if bg else ''
    return (f'<defs>{clip}</defs>{bgrect}<g clip-path="url(#{id_})">'
            f'<path fill="{art_color}" fill-rule="evenodd"'
            + (f' stroke="{art_color}" stroke-width="{bold}" stroke-linejoin="round"' if bold else '')
            + f' transform="{hand_in_square(size, art_scale)}" d="{HAND}"/></g>')


def maskable_body(size=512, art_color=LIME, bg=BLUE):
    # Zona segura = círculo de 40% do lado. A mão (sem o braço) cabe nela.
    scale = 0.86
    k = size / TW
    s = k * scale
    tx = k * TW / 2 - s * TW / 2
    ty = size - s * TH
    bgrect = f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else ''
    return (f'<defs><clipPath id="c"><rect width="{size}" height="{size}"/></clipPath></defs>{bgrect}'
            f'<g clip-path="url(#c)"><path fill="{art_color}" fill-rule="evenodd" '
            f'transform="matrix({s:.5f} 0 0 {s:.5f} {tx:.3f} {ty:.3f})" d="{HAND}"/></g>')


def lockup_body(word_color, tagline=True, id_='t'):
    """Lockup horizontal original: tile 374x324 + "eazy" (+ slogan)."""
    clip = f'<clipPath id="{id_}"><rect x="80" y="104" width="{TW}" height="{TH}" rx="{TR}"/></clipPath>'
    out = (f'<defs>{clip}</defs><rect x="80" y="104" width="{TW}" height="{TH}" rx="{TR}" fill="{BLUE}"/>'
           f'<g clip-path="url(#{id_})"><path fill="{LIME}" fill-rule="evenodd" transform="translate(80 104)" d="{HAND}"/></g>'
           f'<path fill="{word_color}" fill-rule="evenodd" d="{EAZY}"/>')
    if tagline:
        out += f'<path fill="{word_color}" d="{TAG}"/>'
    return out


LOCKUP_VB = '80 104 928 412'      # x 80..1006, y 104..514 (pega o rabo do "y")
WORD_VB = '498 164 510 352'       # só "eazy" (+slogan)


def write(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    mode = 'wb' if isinstance(data, (bytes, bytearray)) else 'w'
    with open(p, mode) as f:
        f.write(data)


def png(svg_str, w, h=None):
    h = h or w
    b = bytes(resvg_py.svg_to_bytes(svg_string=svg_str, width=w, height=h))
    return Image.open(io.BytesIO(b)).convert('RGBA')


def save_png(rel, img, flatten=None):
    if flatten:
        bg = Image.new('RGBA', img.size, flatten)
        bg.alpha_composite(img)
        img = bg.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    write(rel, buf.getvalue())


# ───────────────────────── SVGs da UI ─────────────────────────
mark_svg = svg('0 0 512 512', mark_body())
write('src/assets/brand/eazy-mark.svg', mark_svg)
write('src/assets/brand/eazy-lockup.svg', svg(LOCKUP_VB, lockup_body(WORD, tagline=False)))
write('src/assets/brand/eazy-lockup-dark.svg', svg(LOCKUP_VB, lockup_body(WORD_DARK, tagline=False)))
write('src/assets/brand/eazy-lockup-tagline.svg', svg(LOCKUP_VB, lockup_body(WORD)))
write('src/assets/brand/eazy-lockup-tagline-dark.svg', svg(LOCKUP_VB, lockup_body(WORD_DARK)))
write('src/assets/brand/eazy-wordmark.svg', svg(WORD_VB, f'<path fill="{WORD}" fill-rule="evenodd" d="{EAZY}"/>'))
write('src/assets/brand/eazy-wordmark-dark.svg', svg(WORD_VB, f'<path fill="{WORD_DARK}" fill-rule="evenodd" d="{EAZY}"/>'))

# ───────────────────────── favicon ─────────────────────────
write('public/favicon.svg', mark_svg)
# Em 16-48px os traços somem: versão com traço engrossado só pros favicons.
fav = {s: png(svg('0 0 512 512', mark_body(bold=b)), s) for s, b in ((16, 9), (32, 6), (48, 4))}
for s, img in fav.items():
    save_png(f'public/favicon-{s}x{s}.png', img)
buf = io.BytesIO()
fav[48].save(buf, 'ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[fav[16], fav[32]])
write('public/favicon.ico', buf.getvalue())

# ───────────────────────── PWA ─────────────────────────
# "any": tile arredondado com cantos transparentes (Chrome desktop, Windows, atalhos)
for s in (64, 192, 512):
    save_png(f'public/pwa-{s}x{s}.png', png(mark_svg, s))
# "maskable": sangria total, arte dentro da zona segura (Android corta no formato do launcher)
mask_svg = svg('0 0 512 512', maskable_body())
write('public/maskable-icon.svg', mask_svg)
for s in (192, 512):
    save_png(f'public/maskable-icon-{s}x{s}.png', png(mask_svg, s))
# "monochrome": ícones temáticos do Android 13+ (só a silhueta conta)
mono_svg = svg('0 0 512 512', maskable_body(art_color='#FFFFFF', bg=None))
save_png('public/monochrome-icon-512x512.png', png(mono_svg, 512))
# badge de notificação (barra de status do Android): silhueta branca
save_png('public/badge-96x96.png', png(svg('0 0 512 512', maskable_body(art_color='#FFFFFF', bg=None)), 96))
# iOS: sem transparência, o sistema arredonda sozinho
apple_svg = svg('0 0 512 512', mark_body(radius=0))
save_png('public/apple-touch-icon.png', png(apple_svg, 180), flatten=BLUE)
save_png('public/apple-touch-icon-180x180.png', png(apple_svg, 180), flatten=BLUE)

# ───────────────────────── splash iOS ─────────────────────────
# (largura CSS, altura CSS, DPR) — retrato. iOS só mostra splash se o tamanho bater.
DEVICES = [
    (440, 956, 3),   # iPhone 16 Pro Max / 17 Pro Max
    (402, 874, 3),   # iPhone 16 Pro / 17 Pro
    (430, 932, 3),   # 14 Pro Max, 15 Plus/Pro Max, 16 Plus
    (393, 852, 3),   # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),   # 12/13 Pro Max, 14 Plus
    (390, 844, 3),   # 12, 13, 14
    (375, 812, 3),   # X, XS, 11 Pro, 12/13 mini
    (414, 896, 3),   # XS Max, 11 Pro Max
    (414, 896, 2),   # XR, 11
    (414, 736, 3),   # 6/7/8 Plus
    (375, 667, 2),   # SE 2/3, 6/7/8
    (320, 568, 2),   # SE 1ª geração
    (1024, 1366, 2), # iPad Pro 12.9"
    (834, 1194, 2),  # iPad Pro 11"
    (820, 1180, 2),  # iPad Air
    (768, 1024, 2),  # iPad / mini
]


def splash(w, h, dark):
    bg = INK if dark else CREAM
    word = WORD_DARK if dark else WORD
    m = min(w, h) * 0.30            # lado do tile
    x, y = (w - m) / 2, h * 0.40 - m / 2
    ws = m * 1.05 / 510             # "eazy" ~ largura do tile
    wy = y + m + m * 0.14
    wx = (w - 510 * ws) / 2
    body = (f'<rect width="{w}" height="{h}" fill="{bg}"/>'
            f'<g transform="translate({x:.2f} {y:.2f}) scale({m/512:.5f})">{mark_body()}</g>'
            f'<g transform="translate({wx:.2f} {wy:.2f}) scale({ws:.5f}) translate(-498 -164)">'
            f'<path fill="{word}" fill-rule="evenodd" d="{EAZY}"/></g>')
    return svg(f'0 0 {w} {h}', body)


splash_links = []
for cw, ch, dpr in DEVICES:
    pw, ph = cw * dpr, ch * dpr
    for dark in (False, True):
        name = f'apple-splash-{pw}x{ph}{"-dark" if dark else ""}.png'
        save_png(f'public/splash/{name}', png(splash(pw, ph, dark), pw, ph), flatten=INK if dark else CREAM)
        scheme = 'dark' if dark else 'light'
        splash_links.append(
            f'<link rel="apple-touch-startup-image" href="/splash/{name}" media="'
            f'(prefers-color-scheme: {scheme}) and (device-width: {cw}px) and (device-height: {ch}px) '
            f'and (-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)" />')
write('splash-links.html', '\n'.join(splash_links) + '\n')

# ───────────────────────── Open Graph ─────────────────────────
OW, OH = 1200, 630
lk_w = 926 * 0.95
sc = lk_w / 926
ox, oy = (OW - lk_w) / 2, (OH - 410 * sc) / 2
og = svg(f'0 0 {OW} {OH}',
         f'<rect width="{OW}" height="{OH}" fill="{CREAM}"/>'
         f'<g transform="translate({ox:.2f} {oy:.2f}) scale({sc:.5f}) translate(-80 -104)">{lockup_body(WORD)}</g>')
save_png('public/og-image.png', png(og, OW, OH), flatten=CREAM)
print('ok')

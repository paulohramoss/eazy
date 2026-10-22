from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import sys
f = TTFont('fonts/package/files/roboto-condensed-latin-800-normal.woff')
gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f['hmtx']
cap = f['OS/2'].sCapHeight
TEXT = "TRANQUILIDADE FINANCEIRA"
X0, X1, YTOP, YBOT = 525.9, 937.4, 367.7, 396.5
s = (YBOT - YTOP) / cap
names = [cmap[ord(c)] for c in TEXT]
adv = [hmtx[n][0] * s for n in names]
# bbox do texto sem tracking: do lsb do 1o ao fim da tinta do último
lsb0 = hmtx[names[0]][1] * s
gl = gs[names[-1]]
from fontTools.pens.boundsPen import BoundsPen
bp = BoundsPen(gs); gs[names[-1]].draw(bp); last_xmax = bp.bounds[2] * s
natural = sum(adv[:-1]) + last_xmax - lsb0
track = 1.2
sx = (X1 - X0 - track * (len(TEXT) - 1)) / natural
pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
x = X0 - lsb0 * sx
for n, a in zip(names, adv):
    tp = TransformPen(pen, (s * sx, 0, 0, -s, x, YBOT))
    gs[n].draw(tp)
    x += a * sx + track
open('tagline.d', 'w').write(pen.getCommands())
print('sx', round(sx, 3))

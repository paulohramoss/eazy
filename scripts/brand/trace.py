"""Vetoriza o logo do Eazy (PNG 1052x577) em paths SVG.

Alpha antialiased -> supersample -> contornos (OpenCV) -> suavização
gaussiana ao longo do contorno -> RDP -> Catmull-Rom em cúbicas.
Saídas: hand.d (coords do tile 374x324), eazy.d e tagline.d (coords originais).
"""
import re
import sys
import numpy as np
import cv2
from PIL import Image

SRC = sys.argv[1]
S = 8

im = np.array(Image.open(SRC).convert('RGB')).astype(float)


def smooth_closed(pts, sigma):
    n = len(pts)
    if n < 8:
        return pts
    r = min(int(3 * sigma) + 1, n // 2 - 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    out = np.empty_like(pts)
    for i in range(2):
        ext = np.concatenate([pts[-r:, i], pts[:, i], pts[:r, i]])
        out[:, i] = np.convolve(ext, k, mode='valid')
    return out


def catmull(pts, ox, oy):
    n = len(pts)
    f = lambda p: f"{p[0] + ox:.2f} {p[1] + oy:.2f}"
    d = [f"M{f(pts[0])}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d.append(f"C{f(c1)} {f(c2)} {f(p2)}")
    d.append("Z")
    return "".join(d)


def trace(alpha, ox, oy, min_area=6.0, sigma_px=2.2, eps=0.2, blur=1.1):
    h, w = alpha.shape
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), blur)
    big = cv2.resize(alpha.astype(np.float32), (w * S, h * S), interpolation=cv2.INTER_CUBIC)
    mask = (big > 0.5).astype(np.uint8)
    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    paths = []
    for c in contours:
        if abs(cv2.contourArea(c)) / (S * S) < min_area:
            continue
        pts = c[:, 0, :].astype(float) / S + 0.5 / S
        pts = smooth_closed(pts, sigma_px * S)
        approx = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), eps, True)[:, 0, :]
        if len(approx) < 3:
            continue
        paths.append(catmull(approx.astype(float), ox, oy))
    return paths


# --- traços lime da mão, recorte do tile 80..453 x 104..427
X0, X1, Y0, Y1 = 80, 454, 104, 428
tile = im[Y0:Y1, X0:X1]
a_lime = ((249 - tile[..., 2]) / (249 - 51)).clip(0, 1)
# o braço sai pela borda de baixo: estende os traços além do tile (o clip corta)
a_lime = np.pad(a_lime[:-3], ((0, 40), (0, 0)), mode='edge')
open('hand.d', 'w').write("".join(trace(a_lime, 0, 0)))

# --- wordmark (azul sobre creme), x >= 480
WX0 = 480
word = im[:, WX0:]
a_word = ((255 - word[..., 0]) / (255 - 30)).clip(0, 1)
eazy, tag = [], []
for p in trace(a_word, WX0, 0, min_area=3.0, sigma_px=1.2, eps=0.15, blur=0.7):
    n = list(map(float, re.findall(r'-?\d+\.?\d*', p)))
    ys = n[1::2]
    hgt, cy = max(ys) - min(ys), (max(ys) + min(ys)) / 2
    (tag if (hgt < 40 and 355 < cy < 405) else eazy).append(p)
open('eazy.d', 'w').write("".join(eazy))
open('tagline.d', 'w').write("".join(tag))
print(len(eazy), len(tag))

#!/usr/bin/env python3
"""Generate src/mimetypes/*.svg (and the page template) — Frost's file-type icons (DESIGN §6, §6b).

Construction ("sheet"): a colour-tinted frosted glass page in front, a deeper sheet of the same colour
peeking out lower-right. One symbol per *category* (colour = category); a short type *label* per MIME type
from 48 px up (vector caps ≥ 64, a 3×5 pixel font at 48). Small sizes use hand-drawn pixel hints.

Run from the repo root:  python3 tools/gen-mimetypes.py
"""
import json, math, os, re

# ── palette (DESIGN §3) ────────────────────────────────────────────────────
TOK = {"graphite": ("#CDD2DB", "#7A8394"), "red": ("#FF8E80", "#EE3048"), "pink": ("#FF93BC", "#EE3A70"),
       "violet": ("#D69BFF", "#8B42F5"), "orange": ("#FFC27E", "#FF7430"), "green": ("#93E4AE", "#1FAE63"),
       "teal": ("#86E3DC", "#12A3B0"), "blue": ("#8CB8FF", "#3F6DF5"), "yellow": ("#FFE17D", "#FFAA1F")}

# ── geometry (128 canvas) ──────────────────────────────────────────────────
def fmt(v): return f"{v:.3f}".rstrip("0").rstrip(".")
def page(x0, y0, x1, y1, cut, r):
    """Rounded page with a straight dog-ear cut at the top-right (cut 0 → plain rounded card)."""
    top = f"H{fmt(x1 - cut)} L{fmt(x1)} {fmt(y0 + cut)}" if cut else f"H{fmt(x1 - r)} a{fmt(r)} {fmt(r)} 0 0 1 {fmt(r)} {fmt(r)}"
    return (f"M{fmt(x0 + r)} {fmt(y0)} {top} V{fmt(y1 - r)} a{fmt(r)} {fmt(r)} 0 0 1 {fmt(-r)} {fmt(r)} "
            f"H{fmt(x0 + r)} a{fmt(r)} {fmt(r)} 0 0 1 {fmt(-r)} {fmt(-r)} V{fmt(y0 + r)} a{fmt(r)} {fmt(r)} 0 0 1 {fmt(r)} {fmt(-r)} Z")
PLATE = (14, 8, 100, 112, 22, 12)     # glass page (front, upper-left)
BACK = (38, 22, 116, 120, 0, 14)      # deeper sheet (behind, peeking lower-right)
GLYPH_C = (57, 50)                    # glyph centre when a label is shown
LABEL_CY = 89                         # label centre line
GLYPH_SHIFT = 12                      # no label (< 48 px, generic icons): glyph moves down to the glass centre
# pixel-grid page hints, target px: size → (plate (x0,y0,x1,y1,cut,r), back (…) or None)
PX = {16: ((3, 1, 13, 15, 3, 1.5), None),
      22: ((3, 1, 17, 18, 4, 1.5), (6, 4, 20, 20, 0, 1.5)),
      24: ((3, 1, 19, 20, 4, 1.5), (7, 4, 22, 22, 0, 1.5)),
      32: ((4, 2, 25, 28, 5, 2), (9, 6, 29, 30, 0, 2.5)),
      48: ((5, 3, 37, 42, 8, 4.5), (14, 8, 44, 45, 0, 5))}
def px_page(size, spec):
    u = 128 / size
    x0, y0, x1, y1, cut, r = spec
    return page(x0 * u, y0 * u, x1 * u, y1 * u, cut * u, r * u)

# ── drawing helpers (128 units unless noted; hints are in target pixels) ──────
F = 'fill="#FFFFFF"'; W78 = 'fill="#FFFFFF" fill-opacity=".78"'
def DEEP(op=".55"): return f'fill="TOKDEEP" fill-opacity="{op}"'
def r(x, y, w, h, a=F, rx=0): return f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}"' + (f' rx="{fmt(rx)}"' if rx else "") + f" {a}/>"
def p(d, a=F): return f'<path d="{d}" {a}/>'
def c(x, y, rr, a=F): return f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(rr)}" {a}/>'
def st(d, w=6, op=1, col="#FFFFFF"):
    return f'<path d="{d}" fill="none" stroke="{col}"' + (f' stroke-opacity="{op}"' if op != 1 else "") + f' stroke-width="{fmt(w)}" stroke-linecap="round" stroke-linejoin="round"/>'
def px(*rects, a=F): return "".join(r(*q, a=a) for q in rects)
def stairs(pts, a=F): return "".join(r(x, y, 1, 1, a) for x, y in pts)

def gear(cx, cy, ro, ri, hole, teeth=8):
    pts = []
    for i in range(teeth * 2):
        a0 = math.pi * 2 * i / (teeth * 2) - math.pi / 2; a1 = math.pi * 2 * (i + 1) / (teeth * 2) - math.pi / 2
        rad = ro if i % 2 == 0 else ri
        pts += [(cx + rad * math.cos(a0 + 0.08), cy + rad * math.sin(a0 + 0.08)), (cx + rad * math.cos(a1 - 0.08), cy + rad * math.sin(a1 - 0.08))]
    d = "M" + " L".join(f"{fmt(x)} {fmt(y)}" for x, y in pts) + " Z"
    return f'<path d="{d}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="{fmt(ro * 0.12)}" stroke-linejoin="round"/>' + c(cx, cy, hole, DEEP())
def gear_px(cx, cy, body, tooth):
    t = lambda a: f'<rect x="{fmt(cx - 1)}" y="{fmt(cy - tooth)}" width="2" height="{fmt(2 * tooth)}" fill="#FFFFFF" transform="rotate({a} {fmt(cx)} {fmt(cy)})"/>'
    return c(cx, cy, body) + t(0) + t(90) + t(45) + t(-45) + r(cx - 1, cy - 1, 2, 2, DEEP(".6"))

# ── letterforms ────────────────────────────────────────────────────────────
# Vector caps: centre-lines in a W × 16 box (y 2 → 14), stroked; drawn, not a font, so resvg is font-free.
VEC = {
    "A": (10, "M2 14 L5 2 L8 14 M3.1 10 H6.9"), "B": (10, "M2 14 V2 H5 A3 3 0 0 1 5 8 H2 M5 8 A3 3 0 0 1 5 14 H2"),
    "C": (10, "M8.2 4.2 A4 6 0 1 0 8.2 11.8"), "D": (10, "M2 2 H4.5 A3.5 3.5 0 0 1 8 5.5 V10.5 A3.5 3.5 0 0 1 4.5 14 H2 Z"),
    "E": (9, "M7.5 2 H2 V14 H7.5 M2 8 H6.5"), "F": (9, "M7.5 2 H2 V14 M2 8 H6.5"),
    "G": (10, "M8.2 4.2 A4 6 0 1 0 8 11 V8.5 H5.5"), "H": (10, "M2 2 V14 M8 2 V14 M2 8 H8"), "I": (4, "M2 2 V14"),
    "J": (10, "M8 2 V10.5 A3.5 3.5 0 0 1 1 10.5"), "K": (10, "M2 2 V14 M8 2 L2 9.5 M4 7.5 L8 14"), "L": (9, "M2 2 V14 H7.5"),
    "M": (12, "M2 14 V2 L6 9 L10 2 V14"), "N": (10, "M2 14 V2 L8 14 V2"),
    "O": (10, "M5 2 A3 3 0 0 1 8 5 V11 A3 3 0 0 1 2 11 V5 A3 3 0 0 1 5 2 Z"),
    "P": (10, "M2 14 V2 H5 A3 3 0 0 1 5 8 H2"), "Q": (10, "M5 2 A3 3 0 0 1 8 5 V11 A3 3 0 0 1 2 11 V5 A3 3 0 0 1 5 2 Z M6 11 L8.5 14.5"),
    "R": (10, "M2 14 V2 H5 A3 3 0 0 1 5 8 H2 M5 8 L8 14"),
    "S": (10, "M8.2 3.6 C7.5 2.5 6.4 2 5 2 C3.3 2 2 3.2 2 4.9 C2 8.5 8 7.4 8 11 C8 12.8 6.7 14 5 14 C3.5 14 2.4 13.4 1.8 12.3"),
    "T": (10, "M1.5 2 H8.5 M5 2 V14"), "U": (10, "M2 2 V11 A3 3 0 0 0 8 11 V2"), "V": (10, "M1.5 2 L5 14 L8.5 2"),
    "W": (13, "M1.5 2 L4 14 L6.5 5 L9 14 L11.5 2"), "X": (10, "M2 2 L8 14 M8 2 L2 14"), "Y": (10, "M1.5 2 L5 8 L8.5 2 M5 8 V14"),
    "Z": (10, "M2 2 H8 L2 14 H8"), "1": (7, "M2 4.5 L4.5 2 V14"), "2": (10, "M2.2 5 A3 3 0 0 1 8 5 C8 8 2 10.5 2 14 H8"),
    "3": (10, "M2 2 H7.5 L4.5 7 A3.5 3.5 0 1 1 2 12.5"), "4": (10, "M6.5 14 V2 L1.5 10.5 H8.5"), "7": (10, "M2 2 H8 L4 14"),
}
# 3 × 5 pixel caps for 48 px (M and W are 5 wide, N 4 wide).
PIX = {
    "A": ".#.|#.#|###|#.#|#.#", "B": "##.|#.#|##.|#.#|##.", "C": ".##|#..|#..|#..|.##", "D": "##.|#.#|#.#|#.#|##.",
    "E": "###|#..|##.|#..|###", "F": "###|#..|##.|#..|#..", "G": ".##|#..|#.#|#.#|.##", "H": "#.#|#.#|###|#.#|#.#",
    "I": "###|.#.|.#.|.#.|###", "J": "..#|..#|..#|#.#|.#.", "K": "#.#|##.|#..|##.|#.#", "L": "#..|#..|#..|#..|###",
    "M": "#...#|##.##|#.#.#|#...#|#...#", "N": "#..#|##.#|#.##|#..#|#..#", "O": ".#.|#.#|#.#|#.#|.#.",
    "P": "##.|#.#|##.|#..|#..", "Q": ".#.|#.#|#.#|#.#|.##", "R": "##.|#.#|##.|#.#|#.#", "S": ".##|#..|.#.|..#|##.",
    "T": "###|.#.|.#.|.#.|.#.", "U": "#.#|#.#|#.#|#.#|###", "V": "#.#|#.#|#.#|#.#|.#.", "W": "#...#|#...#|#.#.#|##.##|#...#",
    "X": "#.#|#.#|.#.|#.#|#.#", "Y": "#.#|#.#|.#.|.#.|.#.", "Z": "###|..#|.#.|#..|###",
    "1": ".#.|##.|.#.|.#.|###", "2": ".#.|#.#|..#|.#.|###", "3": "##.|..#|.#.|..#|##.", "4": "#.#|#.#|###|..#|..#",
    "7": "###|..#|.#.|.#.|.#.",
}
VGAP = 3.4
def label_vec(text, cx=GLYPH_C[0], cy=LABEL_CY, h=14, sw=3.8):
    s = h / 16; w = (sum(VEC[ch][0] for ch in text) + VGAP * (len(text) - 1)) * s; x = cx - w / 2; out = []
    for ch in text:
        W, d = VEC[ch]
        out.append(f'<path d="{d}" transform="translate({fmt(x)} {fmt(cy - h / 2)}) scale({fmt(s)})" fill="none" stroke="#FFFFFF" '
                   f'stroke-width="{fmt(sw / s)}" stroke-linecap="round" stroke-linejoin="round"/>')
        x += (W + VGAP) * s
    return "".join(out)
def label_px(text, size=48):
    """Pixel caps on the target grid; returns (content in px units)."""
    rows = [PIX[ch].split("|") for ch in text]
    w = sum(len(g[0]) for g in rows) + len(text) - 1
    cx = GLYPH_C[0] * size / 128; x = round(cx - w / 2); y = round(LABEL_CY * size / 128 - 2.5); out = []
    for g in rows:
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch == "#": out.append(r(x + i, y + j, 1, 1))
        x += len(g[0]) + 1
    return "".join(out)

# ── category symbols ───────────────────────────────────────────────────────
# name: (token, description, glyph at 128 centred on (0,0), hint16 [px, 16-frame], hint24 [px, 24-frame],
#        hint22 (None → hint24 shifted by (-1,-1)), hint-transform offsets for legacy hints)
def brace(side):
    k = 1 if side == "r" else -1
    return st(f"M{8*k} -16 C{13*k} -16 {14*k} -14 {14*k} -10 V-5 C{14*k} -2 {16*k} 0 {19*k} 0 C{16*k} 0 {14*k} 2 {14*k} 5 V10 C{14*k} 14 {13*k} 16 {8*k} 16")
def mirror16(rects): return [(16 - x - w, y, w, h) for x, y, w, h in rects]
def mirror24(rects): return [(22 - x - w, y, w, h) for x, y, w, h in rects]

CAT = {}
def cat(name, tok, desc, g128, h16, h24, h22=None, legacy=False, dy16=0, dy24=0):
    """dy16 / dy24: whole-pixel vertical nudge so every category sits at the same height (22 follows 24)."""
    CAT[name] = dict(tok=tok, desc=desc, g128=g128, h16=h16, h24=h24, h22=h22, legacy=legacy, dy16=dy16, dy24=dy24)

# legacy (existing) symbols: 16 px hints unchanged; 22/24 hints were drawn for the old flap, so they are
# re-used with a (-1, -5) offset that lands them on the glass page's centre.
cat("text", "graphite", "three text lines",
    [r(-18, -11, 36, 6, F, 3), r(-18, -1, 36, 6, F, 3), r(-18, 9, 22, 6, F, 3)],
    px((5, 8, 6, 1), (5, 10, 6, 1), (5, 12, 4, 1)),
    px((8, 14, 8, 1), (8, 16, 8, 1), (8, 18, 5, 1)), px((7, 13, 8, 1), (7, 15, 8, 1), (7, 17, 5, 1)), legacy=True, dy16=-1)
cat("binary", "graphite", "three dots: some file",
    [c(-14, 0, 5.5), c(0, 0, 5.5), c(14, 0, 5.5)],
    px((4, 9, 2, 2), (7, 9, 2, 2), (10, 9, 2, 2)),
    px((8, 16, 2, 2), (11, 16, 2, 2), (14, 16, 2, 2)), px((7, 14, 2, 2), (10, 14, 2, 2), (13, 14, 2, 2)), legacy=True, dy16=-1)
cat("log", "graphite", "log lines, each led by a dot",
    [c(-15, -8, 3.6), r(-8, -11, 26, 6, F, 3), c(-15, 2, 3.6), r(-8, -1, 26, 6, F, 3), c(-15, 12, 3.6), r(-8, 9, 18, 6, F, 3)],
    px((4, 7, 1, 1), (6, 7, 6, 1), (4, 9, 1, 1), (6, 9, 6, 1), (4, 11, 1, 1), (6, 11, 4, 1)),
    px((5, 7, 2, 2), (8, 7, 9, 2), (5, 11, 2, 2), (8, 11, 9, 2), (5, 15, 2, 2), (8, 15, 6, 2)))
cat("markdown", "blue", "M and a down arrow (the public-domain Markdown mark)",
    [st("M-19 13 V-13 L-10 0 L-1 -13 V13") + st("M13 -13 V11") + st("M6 5 L13 12 L20 5")],
    px((4, 6, 1, 6), (5, 7, 1, 1), (6, 8, 1, 1), (7, 7, 1, 1), (8, 6, 1, 6), (11, 6, 1, 5), (10, 9, 1, 1), (12, 9, 1, 1)),
    px((4, 7, 2, 9), (9, 7, 2, 9), (6, 8, 1, 2), (7, 9, 1, 2), (8, 8, 1, 2),
       (14, 7, 2, 8), (12, 11, 2, 2), (16, 11, 2, 2), (13, 13, 1, 2), (16, 13, 1, 2)),
    px((4, 6, 2, 9), (9, 6, 2, 9), (6, 7, 1, 1), (7, 8, 1, 1), (8, 7, 1, 1), (13, 6, 2, 8), (12, 10, 1, 2), (15, 10, 1, 2)))
cat("document", "blue", "heading and paragraph",
    [r(-18, -17, 20, 8, F, 4), r(-18, -3, 36, 6, W78, 3), r(-18, 9, 36, 6, W78, 3)],
    px((5, 7, 4, 2)) + px((5, 10, 6, 1), (5, 12, 6, 1), a=W78),
    px((8, 13, 5, 2)) + px((8, 16, 8, 1), (8, 18, 8, 1), a=W78), px((7, 12, 5, 2)) + px((7, 15, 8, 1), (7, 17, 8, 1), a=W78), legacy=True, dy16=-1)
cat("contact", "blue", "person: head and shoulders",
    [c(0, -8, 8.5), p("M-16 18 C-16 8 -9 3 0 3 C9 3 16 8 16 18 Z")],
    px((7, 5, 2, 1), (6, 6, 4, 2), (7, 8, 2, 1), (5, 10, 6, 1), (4, 11, 8, 2)),
    px((10, 5, 2, 1), (9, 6, 4, 4), (10, 10, 2, 1), (7, 12, 8, 1), (6, 13, 10, 2), (5, 15, 12, 2)))
cat("spreadsheet", "green", "3×3 grid, header row solid",
    [r(-18 + i * 13, -15 + j * 11, 10, 8, F if j == 0 else W78, 2) for j in range(3) for i in range(3)],
    "".join(r(4 + i * 3, 6 + j * 3, 2, 2, F if j == 0 else W78) for j in range(3) for i in range(3)),
    "".join(r(8 + i * 3, 13 + j * 3, 2, 2, F if j == 0 else W78) for j in range(3) for i in range(3)),
    "".join(r(7 + i * 3, 11 + j * 3, 2, 2, F if j == 0 else W78) for j in range(3) for i in range(3)), legacy=True, dy16=-1)
cat("script", "green", "prompt: chevron and cursor",
    [st("M-17 -10 L-8 0 L-17 10"), r(-2, 7, 20, 6, W78, 3)],
    stairs([(5, 7), (6, 8), (7, 9), (6, 10), (5, 11)]) + r(9, 11, 3, 1, W78),
    px((7, 13, 2, 1), (8, 14, 2, 1), (9, 15, 2, 1), (10, 16, 2, 1), (9, 17, 2, 1), (8, 18, 2, 1), (7, 19, 2, 1)) + r(13, 19, 4, 1, W78),
    None, legacy=True)
cat("json", "yellow", "curly braces around a dot: structured data",
    [brace("l"), brace("r"), c(0, 0, 3.6)],
    px((5, 6, 2, 1), (5, 7, 1, 2), (4, 9, 1, 1), (5, 10, 1, 2), (5, 12, 2, 1), *mirror16([(5, 6, 2, 1), (5, 7, 1, 2), (4, 9, 1, 1), (5, 10, 1, 2), (5, 12, 2, 1)])),
    px((7, 6, 3, 2), (6, 7, 2, 3), (4, 10, 3, 2), (6, 12, 2, 3), (7, 15, 3, 2),
       *mirror24([(7, 6, 3, 2), (6, 7, 2, 3), (4, 10, 3, 2), (6, 12, 2, 3), (7, 15, 3, 2)])) + r(10, 10, 2, 2),
    px((7, 5, 2, 2), (6, 6, 2, 3), (4, 9, 3, 2), (6, 11, 2, 3), (7, 14, 2, 2),
       *[(20 - x - w, y, w, h) for x, y, w, h in [(7, 5, 2, 2), (6, 6, 2, 3), (4, 9, 3, 2), (6, 11, 2, 3), (7, 14, 2, 2)]]) + r(9, 9, 2, 2))
cat("certificate", "yellow", "rosette with two ribbon tails",
    ['<path d="M-7 6 L-12 20 L-5 17 L-2 23 L2 10 Z M7 6 L12 20 L5 17 L2 23 L-2 10 Z" fill="#FFFFFF"/>',
     c(0, -4, 13), f'<circle cx="0" cy="-4" r="6.5" fill="none" stroke="TOKDEEP" stroke-opacity=".55" stroke-width="3"/>'],
    px((7, 5, 2, 1), (6, 6, 4, 3), (7, 9, 2, 1), (6, 10, 1, 3), (9, 10, 1, 3)),
    px((9, 5, 4, 1), (8, 6, 6, 1), (7, 7, 8, 4), (8, 11, 6, 1), (9, 12, 4, 1)) + r(10, 8, 2, 2, DEEP()) + px((8, 13, 2, 4), (12, 13, 2, 4)))
cat("key", "yellow", "key: ring, shaft and two teeth",
    [f'<circle cx="-10" cy="0" r="8" fill="none" stroke="#FFFFFF" stroke-width="6"/>', st("M-2 0 H18") + st("M11 0 V7") + st("M17 0 V9")],
    px((5, 7, 2, 1), (4, 8, 1, 2), (7, 8, 1, 2), (5, 10, 2, 1), (8, 8, 4, 1), (9, 9, 1, 2), (11, 9, 1, 2)),
    '<path d="M5 8h5v1h1v5h-1v1h-5v-1h-1v-5h1z M6 10v3h3v-3z" fill-rule="evenodd" fill="#FFFFFF"/>' + px((11, 10, 7, 2), (15, 12, 1, 2), (17, 12, 1, 3)),
    px((5, 7, 4, 1), (4, 8, 2, 4), (8, 8, 2, 4), (5, 12, 4, 1), (6, 8, 2, 1), (6, 11, 2, 1), (10, 9, 6, 2), (13, 11, 1, 2), (15, 11, 1, 3)))
cat("lock", "graphite", "padlock: a dependency lock file",
    [st("M-9 -4 V-9 A9 9 0 0 1 9 -9 V-4"), r(-16, -5, 32, 24, F, 5), c(0, 5, 3.6, DEEP()), r(-1.5, 6, 3, 6, DEEP())],
    px((6, 5, 4, 1), (5, 6, 1, 2), (10, 6, 1, 2), (4, 8, 8, 5)) + r(7, 9, 2, 2, DEEP()),
    px((8, 4, 6, 2), (7, 5, 2, 5), (13, 5, 2, 5), (5, 10, 12, 8)) + r(10, 12, 2, 3, DEEP()))
cat("presentation", "orange", "rising bar chart",
    [r(-17, 3, 9, 14, W78, 2.5), r(-4.5, -7, 9, 24, W78, 2.5), r(8, -17, 9, 34, F, 2.5)],
    px((4, 10, 2, 3), (7, 8, 2, 5), a=W78) + r(10, 6, 2, 7),
    px((8, 18, 2, 3), (11, 16, 2, 5), a=W78) + r(14, 14, 2, 7), px((7, 16, 2, 3), (10, 14, 2, 5), a=W78) + r(13, 12, 2, 7), legacy=True, dy24=-1)
cat("archive", "orange", "zipper with pull tab",
    [r(-8, -21, 8, 5, F, 1.5), r(0, -16, 8, 5, F, 1.5), r(-8, -11, 8, 5, F, 1.5), r(0, -6, 8, 5, F, 1.5), r(-11, 1, 22, 16, F, 4), r(-3, 6, 6, 5, DEEP(".6"), 1.5)],
    px((7, 6, 1, 1), (8, 7, 1, 1), (7, 8, 1, 1), (8, 9, 1, 1), (6, 10, 4, 3)) + r(7, 11, 2, 1, DEEP(".6")),
    px((11, 10, 2, 2), (13, 12, 2, 2), (11, 14, 2, 2), (9, 16, 6, 5)) + r(11, 18, 2, 2, DEEP(".6")),
    None, legacy=True)
cat("package", "orange", "box with a down arrow: an installer",
    [st("M0 -21 V-5") + st("M-8 -12 L0 -4 L8 -12"), r(-18, 3, 36, 16, F, 4), r(-18, 3, 36, 5, DEEP(".35"), 0)],
    px((7, 4, 2, 3), (5, 7, 6, 1), (6, 8, 4, 1), (7, 9, 2, 1), (4, 11, 8, 3)),
    px((10, 4, 2, 5), (7, 8, 8, 2), (8, 10, 6, 1), (9, 11, 4, 1), (10, 12, 2, 1), (5, 14, 12, 5)),
    px((9, 3, 2, 4), (6, 6, 8, 2), (7, 8, 6, 1), (8, 9, 4, 1), (9, 10, 2, 1), (4, 12, 12, 4)))
cat("disc", "orange", "optical disc with its hole",
    [c(0, 0, 18), c(0, 0, 5.5, DEEP(".6")), f'<path d="M-11 -6 A12.5 12.5 0 0 1 -3 -12" fill="none" stroke="TOKDEEP" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>'],
    px((6, 6, 4, 1), (5, 7, 6, 1), (4, 8, 8, 4), (5, 12, 6, 1), (6, 13, 4, 1)) + r(7, 9, 2, 2, DEEP(".6")),
    px((9, 5, 4, 1), (7, 6, 8, 1), (6, 7, 10, 1), (5, 8, 12, 6), (6, 14, 10, 1), (7, 15, 8, 1), (9, 16, 4, 1)) + r(10, 10, 2, 2, DEEP(".6")), dy16=-1)
cat("pdf", "red", "print layout: heading, image block, text lines",
    [r(-18, -18, 36, 8, F, 4), r(-18, -5, 16, 16, F, 3), r(2, -4, 16, 6, W78, 3), r(2, 6, 16, 6, W78, 3)],
    px((5, 7, 6, 2), (5, 10, 3, 3)) + px((9, 10, 2, 1), (9, 12, 2, 1), a=W78),
    px((8, 13, 8, 2), (8, 16, 4, 4)) + px((13, 16, 3, 1), (13, 18, 3, 1), a=W78),
    px((7, 12, 8, 2), (7, 15, 3, 3)) + px((11, 15, 4, 1), (11, 17, 4, 1), a=W78), legacy=True, dy16=-1)
cat("video", "red", "play triangle",
    ['<path d="M-7 -14 L-7 14 L16 0 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="8" stroke-linejoin="round"/>'],
    px((7, 6, 1, 7), (8, 7, 1, 5), (9, 8, 1, 3), (10, 9, 1, 1)),
    px((10, 13, 2, 8), (12, 14, 1, 6), (13, 15, 1, 4), (14, 16, 1, 2)), None, legacy=True)
cat("calendar", "red", "calendar: rings, header and day dots",
    [st("M-8 -20 V-12") + st("M8 -20 V-12"), r(-18, -14, 36, 32, W78, 5), r(-18, -14, 36, 10, F, 5), r(-18, -8, 36, 4, F),
     r(-11, 2, 5, 5, DEEP(), 1), r(-2.5, 2, 5, 5, DEEP(), 1), r(6, 2, 5, 5, DEEP(), 1), r(-11, 10, 5, 5, DEEP(), 1), r(-2.5, 10, 5, 5, DEEP(), 1)],
    px((6, 4, 1, 2), (9, 4, 1, 2), (4, 6, 8, 2)) + r(4, 8, 8, 5, W78) + px((5, 9, 1, 1), (7, 9, 1, 1), (9, 9, 1, 1), (5, 11, 1, 1), (7, 11, 1, 1), a=DEEP()),
    px((8, 4, 2, 3), (13, 4, 2, 3), (5, 6, 12, 3)) + r(5, 9, 12, 9, W78) + px((7, 11, 2, 2), (10, 11, 2, 2), (13, 11, 2, 2), (7, 14, 2, 2), (10, 14, 2, 2), a=DEEP()))
cat("executable", "red", "lightning bolt: runs",
    ['<path d="M5 -21 L-12 3 H-1 L-4 21 L13 -3 H2 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>'],
    px((9, 5, 1, 1), (8, 6, 1, 1), (7, 7, 1, 1), (6, 8, 4, 1), (8, 9, 1, 1), (7, 10, 1, 1), (6, 11, 1, 1)),
    px((13, 5, 2, 1), (12, 6, 2, 1), (11, 7, 2, 1), (10, 8, 2, 1), (9, 9, 2, 1), (8, 10, 7, 2), (12, 12, 2, 1), (11, 13, 2, 1), (10, 14, 2, 1), (9, 15, 2, 1), (9, 16, 1, 1)))
cat("image", "pink", "mountains under a sun",
    [c(11, -12, 6, W78), p("M-20 15 L-8 -4.5 a3.5 3.5 0 0 1 6 0 L6.5 9 L9.5 4.5 a3 3 0 0 1 5 0 L20 13 V15 a4 4 0 0 1 -4 4 H-16 a4 4 0 0 1 -4 -4 Z")],
    r(10, 7, 2, 2, W78) + px((7, 9, 1, 1), (6, 10, 3, 1), (5, 11, 6, 1), (4, 12, 8, 1)),
    r(14, 13, 2, 2, W78) + px((11, 16, 1, 1), (10, 17, 3, 1), (9, 18, 6, 1), (8, 19, 8, 1), (8, 20, 9, 1)),
    None, legacy=True, dy16=-1)
cat("mail", "pink", "envelope",
    [r(-19, -13, 38, 28, F, 5), st("M-14 -7 L0 4 L14 -7", 4, .55, "TOKDEEP")],
    r(4, 6, 8, 6) + px((5, 7, 1, 1), (6, 8, 1, 1), (7, 9, 2, 1), (9, 8, 1, 1), (10, 7, 1, 1), a=DEEP()),
    r(5, 7, 12, 10) + px((6, 8, 1, 1), (7, 9, 1, 1), (8, 10, 1, 1), (9, 11, 1, 1), (10, 12, 2, 1), (12, 11, 1, 1), (13, 10, 1, 1), (14, 9, 1, 1), (15, 8, 1, 1), a=DEEP()))
cat("ebook", "pink", "open book",
    [p("M-2 -12 C-7 -16 -14 -16 -20 -13 V15 C-14 12 -7 12 -2 16 Z"), p("M2 -12 C7 -16 14 -16 20 -13 V15 C14 12 7 12 2 16 Z", W78)],
    px((4, 6, 1, 6), (5, 6, 1, 7), (6, 7, 1, 6), (7, 7, 1, 7)) + px((12, 6, 1, 6), (11, 6, 1, 7), (10, 7, 1, 6), (9, 7, 1, 7), a=W78),
    # pages slope down toward the spine (an open V), one column at a time
    px((5, 6, 1, 9), (6, 6, 1, 10), (7, 7, 1, 10), (8, 7, 1, 10), (9, 8, 1, 10)) +
    px((16, 6, 1, 9), (15, 6, 1, 10), (14, 7, 1, 10), (13, 7, 1, 10), (12, 8, 1, 10), a=W78))
cat("audio", "violet", "two beamed notes",
    ['<g fill="#FFFFFF" transform="scale(.83) translate(-68 -88)"><ellipse cx="52" cy="104" rx="7" ry="5.5" transform="rotate(-20 52 104)"/><ellipse cx="78" cy="100" rx="7" ry="5.5" transform="rotate(-20 78 100)"/><rect x="54" y="78" width="6" height="26"/><rect x="80" y="73" width="6" height="27"/><path d="M54 78 L86 72 V79.5 L54 85.5 Z"/></g>'],
    px((7, 7, 5, 2), (7, 9, 1, 3), (11, 9, 1, 2), (5, 11, 3, 2), (9, 10, 3, 2)),
    px((9, 13, 7, 2), (9, 15, 2, 4), (14, 15, 2, 3), (7, 18, 4, 2), (12, 17, 4, 2)),
    px((8, 12, 7, 2), (8, 14, 2, 4), (13, 14, 2, 3), (6, 17, 4, 2), (11, 16, 4, 2)), legacy=True, dy16=-1)
cat("font", "violet", "open A: two legs and a crossbar (a symbol for type)",
    [st("M-15 16 L0 -17 L15 16"), st("M-7.5 6 H7.5")],
    stairs([(7, 6), (8, 6), (6, 7), (9, 7), (6, 8), (9, 8), (5, 9), (10, 9), (5, 10), (10, 10), (5, 11), (10, 11)]) + r(6, 9, 4, 1),
    px((11, 13, 2, 1), (10, 14, 4, 1), (9, 15, 2, 1), (13, 15, 2, 1), (9, 16, 2, 1), (13, 16, 2, 1), (8, 17, 2, 1), (14, 17, 2, 1),
       (8, 18, 8, 1), (8, 19, 2, 1), (14, 19, 2, 1), (8, 20, 2, 1), (14, 20, 2, 1)),
    None, legacy=True)
cat("config", "violet", "gear",
    [gear(0, 0, 18, 13.5, 5.5)],
    px((7, 5, 2, 1), (5, 6, 6, 2), (4, 8, 3, 2), (9, 8, 3, 2), (5, 10, 6, 2), (7, 12, 2, 1)),
    px((9, 4, 4, 2), (6, 5, 2, 2), (14, 5, 2, 2), (8, 6, 6, 1), (7, 7, 8, 2), (5, 9, 4, 4), (13, 9, 4, 4),
       (7, 13, 8, 2), (8, 15, 6, 1), (6, 15, 2, 2), (14, 15, 2, 2), (9, 16, 4, 2)))
cat("diff", "violet", "plus over minus: changes",
    [st("M0 -19 V-3") + st("M-8 -11 H8") + st("M-8 12 H8")],
    px((7, 4, 2, 6), (5, 6, 6, 2), (5, 11, 6, 2)),
    px((10, 4, 2, 8), (7, 7, 8, 2), (7, 15, 8, 2)))
cat("source", "teal", "angle brackets and slash: source code",
    [st("M-9 -10 L-16 0 L-9 10"), st("M9 -10 L16 0 L9 10"), st("M3 -11 L-3 11", 5, .78)],
    stairs([(6, 8), (5, 9), (4, 10), (5, 11), (6, 12), (9, 8), (10, 9), (11, 10), (10, 11), (9, 12)]),
    stairs([(10, 14), (9, 15), (8, 16), (7, 17), (8, 18), (9, 19), (10, 20), (14, 14), (15, 15), (16, 16), (17, 17), (16, 18), (15, 19), (14, 20)]) + stairs([(13, 14), (13, 15), (12, 16), (12, 17), (12, 18), (11, 19), (11, 20)], W78),
    stairs([(9, 12), (8, 13), (7, 14), (6, 15), (7, 16), (8, 17), (9, 18), (13, 12), (14, 13), (15, 14), (16, 15), (15, 16), (14, 17), (13, 18)]) + stairs([(12, 12), (12, 13), (11, 14), (11, 15), (11, 16), (10, 17), (10, 18)], W78), legacy=True, dy16=-1, dy24=-1)
cat("database", "teal", "database cylinder",
    ['<path d="M-17 -12 V12 A17 6.5 0 0 0 17 12 V-12 Z" fill="#FFFFFF" fill-opacity=".78"/>', '<ellipse cx="0" cy="-12" rx="17" ry="6.5" fill="#FFFFFF"/>',
     '<path d="M-17 0 A17 6.5 0 0 0 17 0" fill="none" stroke="TOKDEEP" stroke-opacity=".45" stroke-width="3"/>'],
    px((5, 4, 6, 1), (4, 5, 8, 2)) + px((4, 7, 8, 5), (5, 12, 6, 1), a=W78) + r(4, 9, 8, 1, DEEP(".45")),
    px((7, 4, 8, 1), (5, 5, 12, 1), (4, 6, 14, 2), (5, 8, 12, 1)) + px((4, 9, 14, 7), (5, 16, 12, 1), (7, 17, 8, 1), a=W78) + r(4, 12, 14, 1, DEEP(".45")),
    px((6, 3, 8, 1), (5, 4, 10, 1), (4, 5, 12, 2), (5, 7, 10, 1)) + px((4, 8, 12, 6), (5, 14, 10, 1), (6, 15, 8, 1), a=W78) + r(4, 11, 12, 1, DEEP(".45")))
cat("container", "teal", "stacked crates: a container recipe",
    [r(-20, 3, 12, 12, F, 2.5), r(-6, 3, 12, 12, F, 2.5), r(8, 3, 12, 12, F, 2.5), r(-13, -11, 12, 12, W78, 2.5), r(1, -11, 12, 12, W78, 2.5)],
    px((4, 10, 2, 2), (7, 10, 2, 2), (10, 10, 2, 2)) + px((5, 7, 2, 2), (8, 7, 2, 2), a=W78),
    px((4, 12, 4, 4), (9, 12, 4, 4), (14, 12, 4, 4)) + px((7, 7, 4, 4), (12, 7, 4, 4), a=W78),
    px((5, 11, 3, 3), (9, 11, 3, 3), (13, 11, 3, 3)) + px((7, 7, 3, 3), (11, 7, 3, 3), a=W78))
cat("git", "teal", "branch: two commits and a fork",
    [c(-8, -14, 5), c(-8, 14, 5), c(10, -6, 5), st("M-8 -9 V9"), st("M10 -1 C10 7 -8 4 -8 9")],
    px((5, 4, 2, 2), (5, 11, 2, 2), (9, 6, 2, 2), (6, 6, 1, 5), (9, 8, 1, 1), (8, 9, 1, 1), (7, 10, 1, 1)),
    px((6, 4, 3, 3), (6, 15, 3, 3), (13, 7, 3, 3), (7, 7, 1, 8), (13, 10, 2, 1), (12, 11, 2, 1), (11, 12, 2, 1), (10, 13, 2, 1), (9, 14, 2, 1)))

# ── types: icon name → (category, label or None for a generic, [alias names]) ──────────────────
T = {}
def t(name, category, label=None, *aliases): T[name] = (category, label, list(aliases))
# generics (no label): what unknown subtypes fall back to
t("text-x-generic", "text", None, "application-x-zerosize")  # empty files: COSMIC asks for x-zerosize
t("application-x-generic", "binary", None, "application-octet-stream")
t("text-x-script", "script", None)
t("x-office-document", "document", None)
t("x-office-spreadsheet", "spreadsheet", None)
t("x-office-presentation", "presentation", None)
t("x-office-addressbook", "contact", None)
t("x-office-calendar", "calendar", None)
t("package-x-generic", "archive", None, "application-x-archive")
t("application-x-executable", "executable", None, "application-x-sharedlib")
t("application-certificate", "certificate", None)
t("media-optical", "disc", None)
t("image-x-generic", "image", None)
t("audio-x-generic", "audio", None)
t("video-x-generic", "video", None)
t("font-x-generic", "font", None)
t("text-x-preview", "text", None)
# text & data
t("text-plain", "text", "TXT")
t("text-x-log", "log", "LOG")
t("text-markdown", "markdown", "MD", "text-x-markdown")
t("application-json", "json", "JSON", "application-schema+json", "application-x-json", "text-x-json", "application-geo+json")
t("application-x-ipynb+json", "json", "NB")
t("application-yaml", "config", "YAML", "application-x-yaml", "text-yaml", "text-x-yaml")
t("application-toml", "config", "TOML", "text-x-toml")
t("text-x-iniconf", "config", "CONF")
t("text-x-dotenv", "config", "ENV")
t("text-x-gomod", "config", "MOD")
t("application-x-desktop", "config", "DESK")
t("text-x-lockfile", "lock", "LOCK")
t("text-x-gosum", "lock", "SUM")
t("text-x-patch", "diff", "DIFF", "text-x-diff")
t("text-csv", "spreadsheet", "CSV", "text-x-csv")
t("text-tab-separated-values", "spreadsheet", "TSV")
t("application-sql", "database", "SQL", "text-x-sql")
t("application-vnd.sqlite3", "database", "DB", "application-x-sqlite3", "application-x-sqlite2")
# code
t("application-x-shellscript", "script", "SH", "text-x-sh", "application-x-sh", "text-x-shellscript")
t("text-x-python", "script", "PY", "text-x-python3", "application-x-python", "application-x-python-code")
t("text-javascript", "script", "JS", "application-javascript", "application-x-javascript", "text-x-javascript")
t("application-x-ruby", "script", "RB", "text-x-ruby")
t("application-x-php", "script", "PHP", "text-x-php")
t("application-x-perl", "script", "PL", "text-x-perl")
t("application-x-powershell", "script", "PS1")
t("text-x-makefile", "script", "MAKE", "text-x-cmake")
t("text-x-lua", "script", "LUA")
t("text-x-go", "source", "GO")
t("text-rust", "source", "RS", "text-x-rust")
t("text-x-csrc", "source", "C", "text-x-c")
t("text-x-chdr", "source", "H")
t("text-x-c++src", "source", "CPP", "text-x-c++", "text-x-cpp")
t("text-x-c++hdr", "source", "HPP")
t("text-x-java", "source", "JAVA", "text-x-java-source")
t("text-x-kotlin", "source", "KT")
t("text-x-csharp", "source", "CS")
t("text-x-typescript", "source", "TS", "application-typescript", "application-x-typescript")
t("text-x-tsx", "source", "TSX")
t("text-x-swift", "source", "SWFT")
t("text-x-protobuf", "source", "PROT")
t("text-x-hcl", "source", "HCL")
t("text-x-vim", "source", "VIM")
t("application-vnd.dart", "source", "DART")
t("text-css", "source", "CSS")
t("text-x-scss", "source", "SCSS", "text-x-sass")
t("text-html", "source", "HTML", "application-xhtml+xml")
t("application-xml", "source", "XML", "text-xml", "application-x-xml")
t("text-x-dockerfile", "container", "DOCK")
t("text-x-gitconfig", "git", "GIT")
# keys & certificates
t("application-x-x509-ca-cert", "certificate", "PEM", "application-x-pem-file", "application-pem-certificate-chain", "application-x-x509-user-cert")
t("application-pkix-cert", "certificate", "CRT")
t("application-x-pkcs12", "certificate", "P12", "application-pkcs12")
t("application-x-pem-key", "key", "KEY")
t("text-x-ssh-public-key", "key", "PUB")
t("application-pgp-keys", "key", "PGP")
t("application-pgp-encrypted", "key", "GPG")
t("application-pgp-signature", "certificate", "SIG")
# office
t("application-vnd.openxmlformats-officedocument.wordprocessingml.document", "document", "DOCX")
t("application-msword", "document", "DOC")
t("application-vnd.oasis.opendocument.text", "document", "ODT")
t("application-rtf", "document", "RTF", "text-rtf")
t("application-vnd.openxmlformats-officedocument.spreadsheetml.sheet", "spreadsheet", "XLSX")
t("application-vnd.ms-excel", "spreadsheet", "XLS")
t("application-vnd.oasis.opendocument.spreadsheet", "spreadsheet", "ODS")
t("application-vnd.openxmlformats-officedocument.presentationml.presentation", "presentation", "PPTX")
t("application-vnd.ms-powerpoint", "presentation", "PPT")
t("application-vnd.oasis.opendocument.presentation", "presentation", "ODP")
t("application-pdf", "pdf", "PDF")
t("application-epub+zip", "ebook", "EPUB")
t("text-vcard", "contact", "VCF", "text-x-vcard", "text-directory")
t("text-calendar", "calendar", "ICS")
t("message-rfc822", "mail", "EML")
# archives, packages, disc images, executables
t("application-zip", "archive", "ZIP")
t("application-x-tar", "archive", "TAR")
t("application-x-compressed-tar", "archive", "TGZ")
t("application-gzip", "archive", "GZ", "application-x-gzip")
t("application-x-7z-compressed", "archive", "7Z")
t("application-vnd.rar", "archive", "RAR", "application-x-rar")
t("application-x-xz", "archive", "XZ")
t("application-x-xz-compressed-tar", "archive", "TXZ")
t("application-zstd", "archive", "ZST")
t("application-x-zstd-compressed-tar", "archive", "TZST")
t("application-x-bzip2", "archive", "BZ2", "application-x-bzip")
t("application-vnd.debian.binary-package", "package", "DEB", "application-x-deb")
t("application-x-rpm", "package", "RPM")
t("application-vnd.snap", "package", "SNAP")
t("application-vnd.flatpak.ref", "package", "FLAT", "application-vnd.flatpak", "application-vnd.flatpak.repo")
t("application-vnd.android.package-archive", "package", "APK")
t("application-java-archive", "package", "JAR", "application-x-java-archive")
t("application-x-msi", "package", "MSI")
t("application-vnd.efi.iso", "disc", "ISO", "application-x-cd-image", "application-x-iso9660-image")
t("application-vnd.efi.img", "disc", "IMG", "application-x-raw-disk-image")
t("application-vnd.appimage", "executable", "APP", "application-x-appimage", "application-x-iso9660-appimage")
t("application-x-msdownload", "executable", "EXE", "application-x-ms-dos-executable", "application-x-msdos-program")
# media (Files shows thumbnails for most; the icon shows while they load and in lists)
t("image-png", "image", "PNG")
t("image-jpeg", "image", "JPG")
t("image-svg+xml", "image", "SVG")
t("image-webp", "image", "WEBP")
t("image-gif", "image", "GIF")
t("image-heif", "image", "HEIC", "image-heic")
t("image-avif", "image", "AVIF")
t("image-bmp", "image", "BMP")
t("image-tiff", "image", "TIFF")
t("audio-mpeg", "audio", "MP3")
t("audio-flac", "audio", "FLAC")
t("audio-vnd.wave", "audio", "WAV", "audio-x-wav")
t("audio-ogg", "audio", "OGG", "audio-x-vorbis+ogg", "audio-x-opus+ogg")
t("audio-mp4", "audio", "M4A", "audio-aac")
t("video-mp4", "video", "MP4")
t("video-x-matroska", "video", "MKV")
t("video-webm", "video", "WEBM")
t("video-quicktime", "video", "MOV")
t("video-vnd.avi", "video", "AVI", "video-x-msvideo")
t("font-ttf", "font", "TTF", "application-x-font-ttf")
t("font-otf", "font", "OTF", "application-x-font-otf")
t("font-woff", "font", "WOFF")
t("font-woff2", "font", "WOF2")

# ── emit ───────────────────────────────────────────────────────────────────
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="128" height="128" viewBox="0 0 128 128" data-family="sheet" data-category="{category}" data-glyph-shift="{shift}">'
def svg(name, category, label):
    C = CAT[category]; light, deep = TOK[C["tok"]]
    shift = GLYPH_SHIFT
    gx, gy = GLYPH_C[0], GLYPH_C[1] + (0 if label else shift)
    glyph = "".join(C["g128"]).replace("TOKDEEP", deep)
    hints = []
    for size in (16, 22, 24):
        body, ox, oy = C[f"h{size}"], 0, 0
        if C["legacy"] and size != 16: ox, oy = -1, -5   # old flap hints → glass page centre
        if body is None: body = C["h24"]; ox, oy = ox - 1, oy - 1  # 22 from 24, one pixel up-left
        oy += C["dy16"] if size == 16 else C["dy24"]
        tr = f"scale({fmt(128 / size)})" + (f" translate({ox} {oy})" if ox or oy else "")
        hints.append(f'    <g id="glyph-{size}" transform="{tr}">{body.replace("TOKDEEP", deep)}</g>')
    for size, (pl, bk) in PX.items():
        hints.append(f'    <path id="plate-shape-{size}" d="{px_page(size, pl)}"/>')
        if bk: hints.append(f'    <path id="back-shape-{size}" d="{px_page(size, bk)}"/>')
    # yellow is too light for white alone (about 1.4:1): a soft deep contact shadow lifts glyph and label (>= 48 px)
    yellow = C["tok"] == "yellow"
    lift = (f'\n    <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" '
            f'flood-color="{deep}" flood-opacity=".5"/></filter>') if yellow else ""
    lift_attr = ' filter="url(#lift)"' if yellow else ""
    lab = ""
    if label:
        hints.append(f'    <g id="label-48" transform="scale({fmt(128 / 48)})">{label_px(label)}</g>')
        lab = f'\n  <g id="label"{lift_attr}>{label_vec(label)}</g>'
    desc = f"{C['desc']}" + (f"; label {label}" if label else "; generic (no label)")
    return f'''{HEAD.format(shift=shift, category=category)}
  <!-- Frost {name} — sheet family (DESIGN §6), category {category}, token {C["tok"]}: {desc}. Generated by tools/gen-mimetypes.py. -->
  <defs>
    <linearGradient id="tint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{light}"/>
      <stop offset="1" stop-color="{deep}"/>
    </linearGradient>
    <linearGradient id="deep-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{deep}" stop-opacity=".85"/>
      <stop offset="1" stop-color="{deep}"/>
    </linearGradient>
    <linearGradient id="glass-fill" x1="0" y1="0" x2=".7" y2="1">
      <stop offset="0" stop-color="{light}" stop-opacity=".92"/>
      <stop offset="1" stop-color="{light}" stop-opacity=".78"/>
    </linearGradient>
    <linearGradient id="depth-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset=".35" stop-color="{deep}" stop-opacity="0"/>
      <stop offset="1" stop-color="{deep}" stop-opacity=".30"/>
    </linearGradient>
    <linearGradient id="rim-stroke" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".75"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity=".15"/>
    </linearGradient>
    <linearGradient id="sheen-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".40"/>
      <stop offset=".5" stop-color="#FFFFFF" stop-opacity=".10"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity=".04"/>
    </linearGradient>
    <path id="back-shape" d="{page(*BACK)}"/>
    <path id="plate-shape" d="{page(*PLATE)}"/>
    <!-- pixel-grid hints: derive() swaps these in at 16/22/24/32/48 px (units = target pixels × 128/size) -->
{chr(10).join(hints)}
    <clipPath id="plate-clip"><use xlink:href="#plate-shape"/></clipPath>
    <mask id="outside-plate"><rect width="128" height="128" fill="#FFFFFF"/><use xlink:href="#plate-shape" fill="#000000"/></mask>{lift}
    <filter id="blur-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="blur-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="blur-frost" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>

  <ellipse id="shadow" cx="66" cy="117" rx="42" ry="4" fill="#000000" opacity=".16" filter="url(#blur-shadow)"/>
  <use id="glow" xlink:href="#back-shape" fill="{deep}" transform="translate(0 4)" opacity=".35" filter="url(#blur-glow)"/>
  <use id="back" xlink:href="#back-shape" fill="url(#deep-fill)" mask="url(#outside-plate)"/>
  <g id="frost" clip-path="url(#plate-clip)"><use xlink:href="#back-shape" fill="{deep}" filter="url(#blur-frost)"/></g>
  <use id="plate" xlink:href="#plate-shape" fill="url(#glass-fill)"/>
  <g id="depth"><use xlink:href="#plate-shape" fill="url(#depth-fill)"/><use xlink:href="#plate-shape" fill="url(#sheen-fill)"/></g>
  <g id="rim" clip-path="url(#plate-clip)"><use xlink:href="#plate-shape" fill="none" stroke="url(#rim-stroke)" stroke-width="3"/></g>
  <g id="glyph" transform="translate({gx} {gy}){"" if label else " scale(1.3)"}"{lift_attr}>{glyph}</g>{lab}
</svg>
'''

def main():
    for ch in {ch for _, (_, lab, _) in T.items() if lab for ch in lab}:
        assert ch in VEC and ch in PIX, f"no letterform for {ch!r}"
    os.makedirs("src/mimetypes", exist_ok=True)
    for f in os.listdir("src/mimetypes"):
        if f.endswith(".svg"): os.remove(os.path.join("src/mimetypes", f))
    for name, (category, label, _) in T.items():
        open(f"src/mimetypes/{name}.svg", "w").write(svg(name, category, label))
    # template: the construction without glyph content
    tpl = re.sub(r'<g id="glyph" [^>]*>.*?</g>\n', '<g id="glyph"/>\n', svg("page-template", "text", None), flags=re.S)
    open("src/_templates/page.svg", "w").write(tpl)
    # aliases: this generator owns every entry whose target is a mimetype icon
    al = json.load(open("src/aliases.json"))
    owned = set(T) | {k for k in al if k != "$comment" and os.path.exists(f"src/mimetypes/{k}.svg")}
    old_mime_keys = {"text-x-generic", "application-x-generic", "image-x-generic", "audio-x-generic", "video-x-generic",
                     "package-x-generic", "text-x-script", "text-html", "x-office-document", "x-office-spreadsheet",
                     "x-office-presentation", "font-x-generic", "application-x-executable", "application-pdf"}
    out = {k: v for k, v in al.items() if k not in owned and k not in old_mime_keys}
    for name, (_, _, aliases) in T.items():
        if aliases: out[name] = aliases
    json.dump(out, open("src/aliases.json", "w"), indent=2); open("src/aliases.json", "a").write("\n")
    print(f"gen-mimetypes: {len(T)} icons ({sum(1 for v in T.values() if v[1])} labelled), {len(CAT)} categories")

if __name__ == "__main__":
    main()

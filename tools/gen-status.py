#!/usr/bin/env python3
"""Generate Frost's symbolic status icons (src/status/*-symbolic.svg) — DESIGN §8, ADR-005.

Why a generator: families like battery (34 states) and signal bars are parametric; one geometry, every state.
Rules the output obeys (GNOME Shell 50 St recolouring, see RESEARCH.md):
  16×16 canvas · filled shapes only (St ignores strokes) · recolour classes only `success|warning|error`
  · dimmed parts via group opacity .35 (no seams) · gaps around slashes/badges via clip-path geometry.
Run: python3 tools/gen-status.py   (writes src/status/, prints the count)
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "status")
DIM = ".35"
FG = 'fill="#000000"'


def f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


# ── geometry helpers (all return path data) ──────────────────────────────────
def rect(x, y, w, h, r=0):
    if not r:
        return f"M{f(x)} {f(y)}h{f(w)}v{f(h)}h{f(-w)}z"
    r = min(r, w / 2, h / 2)
    return (f"M{f(x + r)} {f(y)}h{f(w - 2 * r)}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(r)}v{f(h - 2 * r)}"
            f"a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(r)}h{f(-(w - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(-r)}"
            f"v{f(-(h - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(-r)}z")


def circle(cx, cy, r):
    return f"M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0z"


def sector(cx, cy, r0, r1, a0, a1):
    """Annular sector (r0=0 → wedge). Angles in degrees, 0 = up, clockwise."""
    def pt(r, a):
        t = math.radians(a - 90)
        return cx + r * math.cos(t), cy + r * math.sin(t)
    large = 1 if (a1 - a0) > 180 else 0
    x0, y0 = pt(r1, a0)
    x1, y1 = pt(r1, a1)
    d = f"M{f(x0)} {f(y0)}A{f(r1)} {f(r1)} 0 {large} 1 {f(x1)} {f(y1)}"
    if r0 <= 0:
        return d + f"L{f(cx)} {f(cy)}z"
    x2, y2 = pt(r0, a1)
    x3, y3 = pt(r0, a0)
    return d + f"L{f(x2)} {f(y2)}A{f(r0)} {f(r0)} 0 {large} 0 {f(x3)} {f(y3)}z"


def poly(*pts):
    return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in pts) + "z"


def thick(points, w=2.0, round_=True):
    """A 'stroke' as filled geometry: one quad per segment (+ round joins/caps). Put in a group for opacity."""
    parts = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        nx, ny = -dy / L * w / 2, dx / L * w / 2
        parts.append(poly((x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)))
    if round_:
        parts += [circle(x, y, w / 2) for x, y in points]
    return "".join(parts)


def cells(rows, x0, y0):
    """Pixel art → path: `rows` is a list of strings ('#' = on); merged into horizontal runs on whole pixels."""
    d = ""
    for j, row in enumerate(rows):
        i = 0
        while i < len(row):
            if row[i] == "#":
                k = i
                while k < len(row) and row[k] == "#":
                    k += 1
                d += rect(x0 + i, y0 + j, k - i, 1)
                i = k
            else:
                i += 1
    return d


def dilate(rows):
    """Grow a pixel mask by 1 px in every direction (for a 1-px moat); returns rows padded by 1 on each side."""
    h, w = len(rows), len(rows[0])
    out = [["." for _ in range(w + 2)] for _ in range(h + 2)]
    for j in range(h):
        for i in range(w):
            if rows[j][i] == "#":
                for dj in (-1, 0, 1):
                    for di in (-1, 0, 1):
                        out[j + 1 + dj][i + 1 + di] = "#"
    return ["".join(r) for r in out]


# ── composition ──────────────────────────────────────────────────────────────
def svg(body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">'
            f'{"<defs>" + defs + "</defs>" if defs else ""}{body}</svg>\n')


def g(d, dim=False, cls=None, clip=None):
    attrs = FG + (f' class="{cls}"' if cls else "")
    inner = f'<path d="{d}" {attrs}/>'
    wrap = []
    if dim:
        wrap.append(f'opacity="{DIM}"')
    if clip:
        wrap.append(f'clip-path="url(#{clip})"')
    return f'<g {" ".join(wrap)}>{inner}</g>' if wrap else inner


SLASH = [(2.5, 2.5), (13.5, 13.5)]


def cut_slash():
    """clip keeping everything except a band along the '\\' slash y = x (2-px slash + 1-px gap each side)."""
    b = 2.0 * math.sqrt(2)  # perpendicular half-band of 2 px, measured along an axis
    return ('<clipPath id="cut">' +
            f'<path d="{poly((b, 0), (16, 0), (16, 16 - b))}{poly((0, b), (0, 16), (16 - b, 16))}"/></clipPath>')


def off(glyph_d):
    """Off state: dimmed glyph with a 1-px gap, full-strength slash."""
    return svg(g(glyph_d, dim=True, clip="cut") + g(thick(SLASH, 2)), cut_slash())


# Shared marks — all on whole pixels.
DOTS = rect(3, 13, 2, 2) + rect(7, 13, 2, 2) + rect(11, 13, 2, 2)  # "connecting"
ABOVE_DOTS = '<clipPath id="above"><path d="M0 0H16V11.5H0z"/></clipPath>'  # glyph kept clear of the dot row


def cross(cx, cy, a=0.85, L=2.5):
    """A single 12-vertex '×' outline (no overlapping quads → no evenodd holes)."""
    pts = [(-a, -L), (a, -L), (a, -a), (L, -a), (L, a), (a, a), (a, L), (-a, L), (-a, a), (-L, a), (-L, -a), (-a, -a)]
    c = math.cos(math.radians(45))
    return poly(*[(cx + (x - y) * c, cy + (x + y) * c) for x, y in pts])


def cut_badge(cx=12, cy=12, r=4):  # the × (10..16) sits inside this disc + gap too
    """clip removing the badge disc + 1-px gap from the glyph."""
    return (f'<clipPath id="cutb"><path clip-rule="evenodd" fill-rule="evenodd" '
            f'd="M0 0H16V16H0z{circle(cx, cy, r + 1)}"/></clipPath>')


def badge_bang(cls):
    """8-px disc at (12,12) in the state colour, a 2-px '!' knocked out on whole rows (stem 3, gap 1, dot 2)."""
    return f'<path fill-rule="evenodd" class="{cls}" {FG} d="{circle(12, 12, 4)}{rect(11, 9, 2, 3)}{rect(11, 13, 2, 2)}"/>'


def badge_x():
    """A solid 2-px-armed × across 5 px (no disc) — reads as × at 16 px."""
    return f'<path {FG} d="{cells(["##..##", ".####.", "..##..", "..##..", ".####.", "##..##"], 10, 10)}"/>'


def with_badge(glyph_svg_part, badge, shrink=False):
    """glyph (already-built markup) cut around the badge (+1-px gap). `shrink` is unused: families that
    need room pass a hand-drawn 13-px glyph instead of scaling (scaling leaves half-pixel edges)."""
    return svg(f'<g clip-path="url(#cutb)">{glyph_svg_part}</g>' + badge, cut_badge())


def acquiring(glyph_svg_part):
    """Connecting: a glyph drawn to fit rows 0–11 (whole pixels), dimmed, over the shared dot row 13–15."""
    return svg(f'<g opacity="{DIM}">{glyph_svg_part}</g>' + g(DOTS))


ICONS = {}

# ── Wi-Fi: wedge + 3 bands from apex (8, 14), ±40°, band edges on whole radii ──
WAX, WAY = 8, 14
WIFI = [sector(WAX, WAY, 0, 3, -40, 40), sector(WAX, WAY, 4, 6, -40, 40),
        sector(WAX, WAY, 7, 9, -40, 40), sector(WAX, WAY, 10, 12, -40, 40)]
WIFI_ALL = "".join(WIFI)


def wifi(level):
    lit, dim = "".join(WIFI[:level]), "".join(WIFI[level:])
    return svg((g(lit) if lit else "") + (g(dim, dim=True) if dim else ""))


for i, name in enumerate(["none", "weak", "ok", "good", "excellent"]):
    ICONS[f"network-wireless-signal-{name}-symbolic"] = wifi(i)
ICONS["network-wireless-symbolic"] = wifi(4)
ICONS["network-wireless-connected-symbolic"] = wifi(4)
ICONS["network-wireless-acquiring-symbolic"] = svg(
    f'<g transform="translate(0 -2)"><g opacity="{DIM}"><path d="{WIFI_ALL}" {FG}/></g></g>' + g(DOTS))
ICONS["network-wireless-disabled-symbolic"] = off(WIFI_ALL)
ICONS["network-wireless-offline-symbolic"] = with_badge(g(WIFI_ALL, dim=True), badge_x())
ICONS["network-wireless-no-route-symbolic"] = with_badge(g(WIFI_ALL), badge_bang("warning"))
ICONS["network-wireless-encrypted-symbolic"] = with_badge(
    g(WIFI_ALL), f'<path {FG} d="{cells([".###.", ".#.#.", "#####", "#####", "#####"], 10, 10)}"/>')
ICONS["network-wireless-hotspot-symbolic"] = svg(g(
    circle(8, 8, 2) + sector(8, 8, 4, 6, 225, 315) + sector(8, 8, 4, 6, 45, 135) +
    sector(8, 8, 7, 8.5, 235, 305) + sector(8, 8, 7, 8.5, 55, 125)))

# ── Wired: an ethernet port on whole pixels ───────────────────────────────────
# Wired: an RJ45 socket profile — 2-px wall, the clip notch stepped into the outline (never touched by a badge).
RJ45 = "M2 2H14V11H11V13H5V11H2Z" + "M4 4V9H7V11H9V9H12V4Z"
PORT = f'<path fill-rule="evenodd" {FG} d="{RJ45}"/>'
PORT_LOW = PORT  # fits rows 2–12 already
ICONS["network-wired-symbolic"] = svg(PORT)
ICONS["network-wired-acquiring-symbolic"] = acquiring(PORT_LOW)
ICONS["network-wired-no-route-symbolic"] = with_badge(PORT, badge_bang("warning"))
ICONS["network-wired-disconnected-symbolic"] = with_badge(f'<g opacity="{DIM}">{PORT}</g>', badge_x())
ICONS["network-wired-offline-symbolic"] = ICONS["network-wired-disconnected-symbolic"]

# ── VPN: a shield; keyhole is ONE sub-path (circle + slot merged, no evenodd bridge) ─
def keyhole(cx, cy, r, w, bottom):
    h = math.sqrt(r * r - (w / 2) ** 2)
    return (f"M{f(cx - w / 2)} {f(cy + h)}A{f(r)} {f(r)} 0 1 1 {f(cx + w / 2)} {f(cy + h)}"
            f"L{f(cx + w / 2)} {f(bottom)}L{f(cx - w / 2)} {f(bottom)}z")


SHIELD_D = ("M8 1L13 2.7v4c0 2.7-2 4.6-5 5.3C5 11.3 3 9.4 3 6.7V2.7z"
            "M8 3.1L11 4.1v2.6c0 1.7-1.2 2.9-3 3.4C6.2 9.6 5 8.4 5 6.7V4.1z")
SHIELD = f'<path fill-rule="evenodd" {FG} d="{SHIELD_D}"/><path {FG} d="{rect(6, 4, 4, 3, 1.5)}{rect(7, 6, 2, 3)}"/>'
SHIELD_LOW = SHIELD  # one shield, every state
ICONS["network-vpn-symbolic"] = svg(SHIELD)
ICONS["network-vpn-acquiring-symbolic"] = acquiring(SHIELD_LOW)
ICONS["network-vpn-disabled-symbolic"] = svg(
    f'<g opacity="{DIM}" clip-path="url(#cut)">{SHIELD}</g>' + g(thick(SLASH, 2)), cut_slash())
ICONS["network-vpn-no-route-symbolic"] = with_badge(SHIELD, badge_bang("warning"))

# ── Bluetooth: the rune, 2-px ─────────────────────────────────────────────────
RUNE = thick([(4, 5), (11.5, 10.5), (8, 14), (8, 2), (11.5, 5.5), (4, 11)], 2)
ICONS["bluetooth-active-symbolic"] = svg(g(RUNE))
ICONS["bluetooth-symbolic"] = ICONS["bluetooth-active-symbolic"]
ICONS["bluetooth-disabled-symbolic"] = svg(g(RUNE, dim=True, clip="cut") + g(thick(SLASH, 2)), cut_slash())
RUNE_LOW = thick([(4, 4), (11, 8.5), (8, 11), (8, 1), (11, 3.5), (4, 8)], 2)
ICONS["bluetooth-acquiring-symbolic"] = acquiring(f'<path d="{RUNE_LOW}" {FG}/>')

# ── Volume: speaker + three 2-px waves centred at (5, 8) ─────────────────────
SPEAKER = poly((1, 6), (3, 6), (6, 3), (6, 13), (3, 10), (1, 10))
WAVES = [sector(5, 8, 2, 4, 45, 135), sector(5, 8, 5, 7, 45, 135), sector(5, 8, 8, 10, 50, 130)]


def volume(level):
    lit, dim = "".join(WAVES[:level]), "".join(WAVES[level:])
    return svg(g(SPEAKER) + (g(lit) if lit else "") + (g(dim, dim=True) if dim else ""))


ICONS["audio-volume-low-symbolic"] = volume(1)
ICONS["audio-volume-medium-symbolic"] = volume(2)
ICONS["audio-volume-high-symbolic"] = volume(3)
# over-amplified changes SHAPE too: the outer wave spills past the speaker (35–145°) — and turns warning
ICONS["audio-volume-overamplified-symbolic"] = with_badge(g(SPEAKER + "".join(WAVES)), badge_bang("warning"))
ICONS["audio-volume-muted-symbolic"] = off(SPEAKER + "".join(WAVES))

# ── Microphone (owner decision 2026-09-19): the Shell shows this indicator ONLY while an app is recording, so the
#    whole icon is drawn in the in-use colour (`warning` = orange, GNOME's privacy colour) — clear under Dash to
#    Panel too, whose panel does not get Yaru's `.privacy-indicator` CSS colour. Shape: a solid mic + two sound arcs
#    (as Yaru), the input level lit arc by arc (low: both dim, medium: one, high: both). Muted = neutral + slash.
MIC = rect(1, 1, 6, 9, 3) + sector(4, 6, 4.5, 6, 100, 260) + rect(3, 12, 2, 2) + rect(1, 14, 6, 2, 1)
MIC_ARCS = [sector(4, 5.5, 7.5, 9.2, 55, 125), sector(4, 5.5, 10.5, 12, 58, 122)]  # 1-px gaps from the stand


def mic(level, live=True):
    lit, dim = "".join(MIC_ARCS[:level]), "".join(MIC_ARCS[level:])
    cls = "warning" if live else None
    return svg(g(MIC, cls=cls) + (g(lit, cls=cls) if lit else "") + (g(dim, dim=True, cls=cls) if dim else ""))


ICONS["microphone-sensitivity-low-symbolic"] = mic(0)
ICONS["microphone-sensitivity-medium-symbolic"] = mic(1)
ICONS["microphone-sensitivity-high-symbolic"] = mic(2)
ICONS["microphone-sensitivity-muted-symbolic"] = off(MIC + "".join(MIC_ARCS))
ICONS["audio-input-microphone-symbolic"] = mic(2, live=False)  # device icon (Settings, lists): not "in use"

# ── Battery: 1-px frame on whole pixels; the level is NEVER covered. Charging/plug marks
#    replace the terminal cap to the right of the body instead of cutting the fill. ─────────────
B_FRAME = rect(0, 3, 13, 10, 2) + rect(1, 4, 11, 8, 1)  # body x 0–13, inner x 1–12
B_CAP = rect(13, 6, 2, 4, 1)
FILL_X, FILL_Y, FILL_W, FILL_H = 2, 5, 9, 6  # 9-px fill track: 20 % → 1 col … 100 % → 9 cols
# Power marks are pixel BADGES on the body's bottom-right corner (like the "!"/× badges, and like Adwaita):
# the frame and fill are cut by a 1-px moat around the mark, the fill itself is untouched — so the level reads
# at every percentage and the mark keeps its shape.
BOLT_M = ["...##", "..##.", ".##..", "#####", "..##.", ".##.."]   # x 11–16, y 10–16 (bar on row 13, below the frame)
PLUG_M = ["#.#", "#.#", "###", "###", ".#.", ".#."]                # x 13–16, y 10–16 (clear of the frame edge)
CHECK_M = [".....##", "....##.", "##.##..", ".###...", "..#...."]  # 2-px strokes, x 9–16, y 11–16
BADGE_AT = {"charging": (BOLT_M, 11, 10), "plugged-in": (PLUG_M, 13, 10), "charged": (CHECK_M, 9, 11)}
BANG = rect(5, 5, 2, 3) + rect(5, 9, 2, 2)  # centred in the 11-px interior


def battery(level, state=""):
    """level 0..100 (step 10); state '' | 'charging' | 'plugged-in' | 'charged'."""
    critical = level <= 10 and not state
    klass = lambda c: f' class="{c}"' if c else ""
    w = FILL_W if state == "charged" else max(0, min(FILL_W, level // 10 - 1)) if level >= 20 else (1 if level > 0 else 0)
    body = [f'<path fill-rule="evenodd" {FG} d="{B_FRAME}{B_CAP}"/>']
    if critical:
        body.append(f'<path class="error" {FG} d="{BANG}"/>')
    elif w:
        cls = "warning" if level == 20 and not state else ("success" if state == "charged" else None)
        body.append(f'<path {FG}{klass(cls)} d="{rect(FILL_X, FILL_Y, w, FILL_H)}"/>')
    if state not in BADGE_AT:
        return svg("".join(body))
    mask, x0, y0 = BADGE_AT[state]
    moat = cells(dilate(mask), x0 - 1, y0 - 1)
    defs = f'<clipPath id="moat"><path clip-rule="evenodd" fill-rule="evenodd" d="M0 0H16V16H0z{moat}"/></clipPath>'
    mark_cls = {"charging": "success", "charged": "success"}.get(state)
    return svg(f'<g clip-path="url(#moat)">{"".join(body)}</g><path{klass(mark_cls)} {FG} d="{cells(mask, x0, y0)}"/>', defs)


for lv in range(0, 101, 10):
    ICONS[f"battery-level-{lv}-symbolic"] = battery(lv)
    ICONS[f"battery-level-{lv}-charging-symbolic"] = battery(lv, "charging")
    ICONS[f"battery-level-{lv}-plugged-in-symbolic"] = battery(lv, "plugged-in")
ICONS["battery-level-100-charged-symbolic"] = battery(100, "charged")
ICONS["battery-missing-symbolic"] = svg(
    f'<g opacity="{DIM}"><path fill-rule="evenodd" {FG} d="{B_FRAME}{B_CAP}"/></g><path {FG} d="{BANG}"/>')  # whole-row '!'

# ── Privacy / activity indicators — one colour (the Shell paints them itself) ──
ICONS["camera-web-symbolic"] = svg(
    f'<path fill-rule="evenodd" {FG} d="{circle(8, 6.5, 5.5)}{circle(8, 6.5, 2.5)}"/>' + g(rect(5, 13, 6, 2, 1) + rect(7, 11.5, 2, 2)))
ICONS["location-services-active-symbolic"] = svg(
    f'<path fill-rule="evenodd" {FG} d="M8 1C5.2 1 3 3.2 3 6c0 3.6 5 9 5 9s5-5.4 5-9c0-2.8-2.2-5-5-5z{circle(8, 6, 2)}"/>')
ICONS["media-record-symbolic"] = svg(g(circle(8, 8, 5)))
ICONS["screen-shared-symbolic"] = svg(
    f'<path fill-rule="evenodd" {FG} d="{rect(1, 2, 14, 10, 2)}{rect(2.5, 3.5, 11, 7, 1)}"/>' + g(rect(5, 13, 6, 2, 1)) +
    g(poly((8, 4.5), (11, 7.5), (9, 7.5), (9, 9.5), (7, 9.5), (7, 7.5), (5, 7.5))))

# ── Quick-settings / indicators ───────────────────────────────────────────────
RAYS = "".join(rect(x, y, 2, 2, 0.4) for x, y in [(1, 7), (13, 7), (7, 1), (7, 13), (3, 3), (11, 3), (3, 11), (11, 11)])
ICONS["display-brightness-symbolic"] = svg(g(circle(8, 8, 3) + RAYS))
MOON = f'<path fill-rule="evenodd" {FG} d="{circle(8, 8, 6.5)}{circle(11.2, 5.2, 5.6)}"/>'
ICONS["night-light-symbolic"] = svg(f'<defs><clipPath id="c"><path d="{circle(8, 8, 6.5)}"/></clipPath></defs>'
                                    f'<g clip-path="url(#c)">{MOON}</g>')
PLANE = ("M7.1 1.6c0-.9 1.8-.9 1.8 0v4.3l5.6 3.3v1.7l-5.6-1.6v3.1l1.7 1.3v1.3L8 14.2l-2.6.8v-1.3l1.7-1.3V9.3"
         "l-5.6 1.6V9.2l5.6-3.3z")
ICONS["airplane-mode-symbolic"] = svg(g(PLANE))
ICONS["airplane-mode-disabled-symbolic"] = off(PLANE)
BELL = ("M8 1.5c-2.6 0-4.3 2-4.3 4.5v3.2L2.3 11.4v1h11.4v-1L12.3 9.2V6c0-2.5-1.7-4.5-4.3-4.5z" + rect(6.4, 13, 3.2, 2, 1))
ICONS["notifications-symbolic"] = svg(g(BELL))
ICONS["notifications-disabled-symbolic"] = off(BELL)
GAUGE = sector(8, 10, 4.3, 6.5, -90, 90)
ICONS["power-profile-balanced-symbolic"] = svg(g(GAUGE) + g(thick([(8, 10), (8, 5.3)], 1.8)) + g(circle(8, 10, 1.6)))
ICONS["power-profile-performance-symbolic"] = svg(
    g(GAUGE) + g(thick([(8, 10), (11.6, 6.4)], 1.8)) + g(circle(8, 10, 1.6)))
ICONS["power-profile-power-saver-symbolic"] = svg(g(
    "M13.5 2.5C7 2.5 2.5 5.6 2.5 10.2c0 1.2.3 2.2.9 3.1L2.2 14.5l1 1 1.3-1.3c.8.5 1.8.8 2.9.8 4.7 0 6.1-4.6 6.1-12.5z"
    "M5.2 12.3l5.5-5.5.8.8-5.5 5.5z"))


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, body in ICONS.items():
        with open(os.path.join(OUT, f"{name}.svg"), "w") as fh:
            fh.write(body)
    print(f"gen-status: {len(ICONS)} symbolic icons → src/status/")


if __name__ == "__main__":
    main()

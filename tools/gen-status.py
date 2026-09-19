#!/usr/bin/env python3
"""Generate Hyaline's symbolic status icons (src/status/*-symbolic.svg) — DESIGN §8, ADR-005.

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


def cut_badge(cx=12, cy=12, r=4):
    """clip removing the badge disc + 1-px gap from the glyph."""
    return (f'<clipPath id="cutb"><path clip-rule="evenodd" fill-rule="evenodd" '
            f'd="M0 0H16V16H0z{circle(cx, cy, r + 1)}"/></clipPath>')


def badge_bang(cls):
    """8-px disc at (12,12) in the state colour, a 2-px '!' knocked out."""
    return f'<path fill-rule="evenodd" class="{cls}" {FG} d="{circle(12, 12, 4)}{rect(11, 9, 2, 3.2)}{rect(11, 13.2, 2, 1.8)}"/>'


def badge_x():
    return f'<path fill-rule="evenodd" {FG} d="{circle(12, 12, 4)}{cross(12, 12, 0.8, 2.3)}"/>'


def with_badge(glyph_svg_part, badge, shrink=False):
    """glyph (already-built markup) cut around the badge; optionally scaled to 13 px so the badge eats less."""
    inner = f'<g transform="scale(.8125)">{glyph_svg_part}</g>' if shrink else glyph_svg_part
    return svg(f'<g clip-path="url(#cutb)">{inner}</g>' + badge, cut_badge())


def acquiring(glyph_svg_part):
    return svg(f'<g opacity="{DIM}" clip-path="url(#above)">{glyph_svg_part}</g>' + g(DOTS), ABOVE_DOTS)


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
    g(WIFI_ALL), f'<path fill-rule="evenodd" {FG} d="{rect(9, 11, 6, 5, 1)}{rect(10, 7.5, 4, 5, 2)}{rect(11.5, 9, 1, 3)}"/>')
ICONS["network-wireless-hotspot-symbolic"] = svg(g(
    circle(8, 8, 2) + sector(8, 8, 4, 6, 225, 315) + sector(8, 8, 4, 6, 45, 135) +
    sector(8, 8, 7, 8.5, 235, 305) + sector(8, 8, 7, 8.5, 55, 125)))

# ── Wired: an ethernet port on whole pixels ───────────────────────────────────
PORT_D = rect(1, 2, 14, 12, 2.5) + poly((4, 11), (4, 7), (6, 7), (6, 5), (10, 5), (10, 7), (12, 7), (12, 11))
PORT = f'<path fill-rule="evenodd" {FG} d="{PORT_D}"/>'
ICONS["network-wired-symbolic"] = svg(PORT)
ICONS["network-wired-acquiring-symbolic"] = acquiring(PORT)
ICONS["network-wired-no-route-symbolic"] = with_badge(PORT, badge_bang("warning"), shrink=True)
ICONS["network-wired-disconnected-symbolic"] = with_badge(f'<g opacity="{DIM}">{PORT}</g>', badge_x(), shrink=True)
ICONS["network-wired-offline-symbolic"] = ICONS["network-wired-disconnected-symbolic"]

# ── VPN: a shield; keyhole is ONE sub-path (circle + slot merged, no evenodd bridge) ─
def keyhole(cx, cy, r, w, bottom):
    h = math.sqrt(r * r - (w / 2) ** 2)
    return (f"M{f(cx - w / 2)} {f(cy + h)}A{f(r)} {f(r)} 0 1 1 {f(cx + w / 2)} {f(cy + h)}"
            f"L{f(cx + w / 2)} {f(bottom)}L{f(cx - w / 2)} {f(bottom)}z")


SHIELD_D = "M8 1L14 3v5c0 3.4-2.5 6-6 7C4.5 14 2 11.4 2 8V3z" + keyhole(8, 6.5, 1.8, 1.6, 11)
SHIELD = f'<path fill-rule="evenodd" {FG} d="{SHIELD_D}"/>'
ICONS["network-vpn-symbolic"] = svg(SHIELD)
ICONS["network-vpn-acquiring-symbolic"] = acquiring(SHIELD)
ICONS["network-vpn-disabled-symbolic"] = svg(
    f'<g opacity="{DIM}" clip-path="url(#cut)">{SHIELD}</g>' + g(thick(SLASH, 2)), cut_slash())
ICONS["network-vpn-no-route-symbolic"] = with_badge(SHIELD, badge_bang("warning"), shrink=True)

# ── Bluetooth: the rune, 2-px ─────────────────────────────────────────────────
RUNE = thick([(4, 5), (11.5, 10.5), (8, 14), (8, 2), (11.5, 5.5), (4, 11)], 2)
ICONS["bluetooth-active-symbolic"] = svg(g(RUNE))
ICONS["bluetooth-symbolic"] = ICONS["bluetooth-active-symbolic"]
ICONS["bluetooth-disabled-symbolic"] = svg(g(RUNE, dim=True, clip="cut") + g(thick(SLASH, 2)), cut_slash())
ICONS["bluetooth-acquiring-symbolic"] = svg(
    f'<g transform="translate(1.6 0) scale(.8)"><g opacity="{DIM}"><path d="{RUNE}" {FG}/></g></g>' + g(DOTS))

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
ICONS["audio-volume-overamplified-symbolic"] = svg(
    g(SPEAKER) + g("".join(WAVES[:2])) + g(sector(5, 8, 8, 10, 35, 145), cls="warning"))
ICONS["audio-volume-muted-symbolic"] = off(SPEAKER + "".join(WAVES))

# ── Microphone: SOLID capsule, level = lit rows from the bottom, rest at 35 % (same language as volume) ─
CAPSULE = rect(5, 1, 6, 9, 3)
STAND = sector(8, 6, 5, 6.5, 100, 260) + rect(7, 12, 2, 2) + rect(4, 14, 8, 2, 1)


def mic(level):
    if level >= 3:
        return svg(g(CAPSULE + STAND))
    rows = {0: 0, 1: 3, 2: 6}[level]
    clip = f'<clipPath id="lvl"><path d="{rect(0, 10 - rows, 16, rows)}"/></clipPath>' if rows else ""
    lit = g(CAPSULE, clip="lvl") if rows else ""
    return svg(g(CAPSULE, dim=True) + lit + g(STAND), clip)


ICONS["microphone-sensitivity-low-symbolic"] = mic(1)
ICONS["microphone-sensitivity-medium-symbolic"] = mic(2)
ICONS["microphone-sensitivity-high-symbolic"] = mic(3)
ICONS["microphone-sensitivity-muted-symbolic"] = off(CAPSULE + STAND)
ICONS["audio-input-microphone-symbolic"] = mic(3)

# ── Battery: 1-px frame on whole pixels; the level is NEVER covered. Charging/plug marks
#    replace the terminal cap to the right of the body instead of cutting the fill. ─────────────
B_FRAME = rect(1, 3, 11, 10, 2) + rect(2, 4, 9, 8, 1)  # body x 1–12, inner x 2–11
B_CAP = rect(12, 6, 2, 4, 1)
FILL_X, FILL_Y, FILL_W, FILL_H = 3, 5, 7, 6  # 7-px fill track
BOLT = poly((14.2, 2.5), (11.6, 8.6), (13.4, 8.6), (12.6, 13.5), (15.6, 7.2), (13.8, 7.2))
PLUG = rect(12.5, 6, 3, 4, 1) + rect(13, 3.5, 0.8, 2.8) + rect(14.4, 3.5, 0.8, 2.8) + rect(13.6, 9.6, 0.9, 2.6)
BANG = rect(6, 5, 2, 3.5) + rect(6, 9.5, 2, 1.8)


def battery(level, state=""):
    """level 0..100 (step 10); state '' | 'charging' | 'plugged-in' | 'charged'."""
    critical = level <= 10 and not state
    klass = lambda c: f' class="{c}"' if c else ""
    parts = [f'<path fill-rule="evenodd" {FG} d="{B_FRAME}{"" if state else B_CAP}"/>']
    w = round(FILL_W * level / 100)
    if level > 0 and w == 0:
        w = 1
    fill_cls = "warning" if level == 20 and not state else ("success" if state == "charged" else None)
    if critical:
        parts.append(f'<path class="error" {FG} d="{BANG}"/>')  # '!' in error; frame stays neutral
    elif w:
        parts.append(f'<path {FG}{klass(fill_cls)} d="{rect(FILL_X, FILL_Y, w, FILL_H, 0.5)}"/>')
    if state == "charging":
        parts.append(f'<path class="success" {FG} d="{BOLT}"/>')
    elif state in ("plugged-in", "charged"):
        parts.append(f'<path{klass("success" if state == "charged" else None)} {FG} d="{PLUG}"/>')
    return svg("".join(parts))


for lv in range(0, 101, 10):
    ICONS[f"battery-level-{lv}-symbolic"] = battery(lv)
    ICONS[f"battery-level-{lv}-charging-symbolic"] = battery(lv, "charging")
    ICONS[f"battery-level-{lv}-plugged-in-symbolic"] = battery(lv, "plugged-in")
ICONS["battery-level-100-charged-symbolic"] = battery(100, "charged")
ICONS["battery-missing-symbolic"] = svg(
    f'<g opacity="{DIM}"><path fill-rule="evenodd" {FG} d="{B_FRAME}{B_CAP}"/></g><path {FG} d="{BANG}"/>')

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
SUN = circle(8, 8, 3) + "".join(
    rect(7.25, 0.8, 1.5, 2.6, 0.75).replace("M", "M", 1) if False else "" for _ in range(0))
RAYS = "".join(thick([(8 + 5.2 * math.cos(math.radians(a)), 8 + 5.2 * math.sin(math.radians(a))),
                      (8 + 6.8 * math.cos(math.radians(a)), 8 + 6.8 * math.sin(math.radians(a)))], 1.6)
               for a in range(0, 360, 45))
ICONS["display-brightness-symbolic"] = svg(g(circle(8, 8, 3.2)) + g(RAYS))
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

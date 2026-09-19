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


def cut_badge(cx=12.5, cy=12.5, r=3.5):
    """clip that removes a disc (badge + 1-px gap) from the glyph — evenodd frame minus circle."""
    return (f'<clipPath id="cutb"><path clip-rule="evenodd" fill-rule="evenodd" '
            f'd="M0 0H16V16H0z{circle(cx, cy, r + 1)}"/></clipPath>')


def off(glyph_d):
    """Off state: dimmed glyph with a 1-px gap, full-strength slash."""
    return svg(g(glyph_d, dim=True, clip="cut") + g(thick(SLASH, 2)), cut_slash())


def dots(y=13.5, x0=5, step=3, r=1.1):
    return "".join(circle(x0 + i * step, y, r) for i in range(3))


def badge_bang(cls, cx=12.5, cy=12.5):
    """'!' in a disc: disc in the state colour with the '!' knocked out (evenodd)."""
    return (f'<path fill-rule="evenodd" class="{cls}" {FG} d="{circle(cx, cy, 3.5)}'
            f'{rect(cx - 0.75, cy - 2.25, 1.5, 2.6, 0.5)}{circle(cx, cy + 1.6, 0.8)}"/>')


def badge_x(cx=12.5, cy=12.5):
    return (f'<path fill-rule="evenodd" {FG} d="{circle(cx, cy, 3.5)}'
            f'{thick([(cx - 1.3, cy - 1.3), (cx + 1.3, cy + 1.3)], 1.3, False)}'
            f'{thick([(cx + 1.3, cy - 1.3), (cx - 1.3, cy + 1.3)], 1.3, False)}"/>')


ICONS = {}

# ── Wi-Fi: wedge + 3 rings from an apex at (8, 14), ±45° ──────────────────────
WAX, WAY = 8, 14
WIFI = [sector(WAX, WAY, 0, 3, -45, 45), sector(WAX, WAY, 4.5, 6.5, -45, 45),
        sector(WAX, WAY, 8, 10, -45, 45), sector(WAX, WAY, 11.5, 13.5, -45, 45)]
WIFI_ALL = "".join(WIFI)


def wifi(level):  # 0..4 parts lit
    lit, dim = "".join(WIFI[:level]), "".join(WIFI[level:])
    return svg((g(lit) if lit else "") + (g(dim, dim=True) if dim else ""))


for i, name in enumerate(["none", "weak", "ok", "good", "excellent"]):
    ICONS[f"network-wireless-signal-{name}-symbolic"] = wifi(i)
ICONS["network-wireless-symbolic"] = wifi(4)
ICONS["network-wireless-connected-symbolic"] = wifi(4)
ICONS["network-wireless-acquiring-symbolic"] = svg(g("".join(WIFI[1:]), dim=True) + g(dots(13.2, 5, 3, 1.1)))
ICONS["network-wireless-disabled-symbolic"] = off(WIFI_ALL)
ICONS["network-wireless-offline-symbolic"] = svg(g(WIFI_ALL, dim=True, clip="cutb") + badge_x(), cut_badge())
ICONS["network-wireless-no-route-symbolic"] = svg(g(WIFI_ALL, clip="cutb") + badge_bang("warning"), cut_badge())
ICONS["network-wireless-encrypted-symbolic"] = svg(
    g(WIFI_ALL, clip="cutb") +
    f'<path fill-rule="evenodd" {FG} d="{rect(10, 11.5, 5, 4, 1)}{rect(11, 8.5, 3, 4.5, 1.5)}{rect(11.9, 9.4, 1.2, 3, 0.6)}"/>',
    cut_badge(12.5, 12.2, 3.2))
ICONS["network-wireless-hotspot-symbolic"] = svg(g(
    circle(8, 8, 2) + sector(8, 8, 4, 6, 225, 315) + sector(8, 8, 4, 6, 45, 135) +
    sector(8, 8, 7.5, 9.5, 235, 305) + sector(8, 8, 7.5, 9.5, 55, 125)))

# ── Wired: an ethernet port (frame with the port opening knocked out) ─────────
PORT = rect(1.5, 2.5, 13, 11, 2.5) + poly((4.5, 11), (4.5, 7), (6, 7), (6, 5.5), (10, 5.5), (10, 7), (11.5, 7), (11.5, 11))
ICONS["network-wired-symbolic"] = svg(f'<path fill-rule="evenodd" {FG} d="{PORT}"/>')
ICONS["network-wired-acquiring-symbolic"] = svg(
    f'<g opacity="{DIM}"><path fill-rule="evenodd" {FG} d="{PORT}"/></g>' + g(dots(15, 5, 3, 1)))
ICONS["network-wired-no-route-symbolic"] = svg(
    f'<g clip-path="url(#cutb)"><path fill-rule="evenodd" {FG} d="{PORT}"/></g>' + badge_bang("warning"), cut_badge())
ICONS["network-wired-disconnected-symbolic"] = svg(
    f'<g opacity="{DIM}" clip-path="url(#cut)"><path fill-rule="evenodd" {FG} d="{PORT}"/></g>' + g(thick(SLASH, 2)),
    cut_slash())
ICONS["network-wired-offline-symbolic"] = ICONS["network-wired-disconnected-symbolic"]

# ── VPN: a shield with a keyhole ─────────────────────────────────────────────
SHIELD = ("M8 1L13.5 3v4.5c0 3.4-2.3 6.1-5.5 7.3C4.8 13.6 2.5 10.9 2.5 7.5V3z"
          + circle(8, 6.6, 1.6) + rect(7.3, 7.4, 1.4, 3.6, 0.7))
ICONS["network-vpn-symbolic"] = svg(f'<path fill-rule="evenodd" {FG} d="{SHIELD}"/>')
ICONS["network-vpn-acquiring-symbolic"] = svg(
    f'<g opacity="{DIM}"><path fill-rule="evenodd" {FG} d="{SHIELD}"/></g>' + g(dots(14.5, 5, 3, 1)))
ICONS["network-vpn-disabled-symbolic"] = svg(
    f'<g opacity="{DIM}" clip-path="url(#cut)"><path fill-rule="evenodd" {FG} d="{SHIELD}"/></g>' + g(thick(SLASH, 2)),
    cut_slash())
ICONS["network-vpn-no-route-symbolic"] = svg(
    f'<g clip-path="url(#cutb)"><path fill-rule="evenodd" {FG} d="{SHIELD}"/></g>' + badge_bang("warning"), cut_badge())

# ── Bluetooth: the rune as filled strokes ────────────────────────────────────
RUNE = thick([(4, 5), (11.5, 11), (8, 14), (8, 2), (11.5, 5), (4, 11)], 1.8)
ICONS["bluetooth-active-symbolic"] = svg(g(RUNE))
ICONS["bluetooth-symbolic"] = ICONS["bluetooth-active-symbolic"]
ICONS["bluetooth-disabled-symbolic"] = svg(g(RUNE, dim=True, clip="cut") + g(thick(SLASH, 2)), cut_slash())
ICONS["bluetooth-acquiring-symbolic"] = svg(g(RUNE, dim=True) + g(dots(14.6, 11, 1.9, 0.9)))

# ── Volume: speaker + 3 waves centred at (4.5, 8) ─────────────────────────────
SPEAKER = poly((1, 5.5), (3.5, 5.5), (7, 2.5), (7, 13.5), (3.5, 10.5), (1, 10.5))
WAVES = [sector(6, 8, 2.5, 4.2, 45, 135), sector(6, 8, 5.2, 6.9, 45, 135), sector(6, 8, 7.9, 9.6, 50, 130)]


def volume(level, warn=False):
    lit = "".join(WAVES[:level])
    dim = "".join(WAVES[level:])
    body = g(SPEAKER) + (g(lit) if lit else "") + (g(dim, dim=True) if dim else "")
    return svg(body)


ICONS["audio-volume-low-symbolic"] = volume(1)
ICONS["audio-volume-medium-symbolic"] = volume(2)
ICONS["audio-volume-high-symbolic"] = volume(3)
ICONS["audio-volume-overamplified-symbolic"] = svg(
    g(SPEAKER) + g("".join(WAVES[:2])) + g(WAVES[2], cls="warning"))
ICONS["audio-volume-muted-symbolic"] = off(SPEAKER + "".join(WAVES))

# ── Microphone: capsule filled to the sensitivity level + stand ──────────────
CAPSULE = rect(5, 1, 6, 9, 3)
CAP_IN = rect(6.3, 2.3, 3.4, 6.4, 1.7)
STAND = sector(8, 6.5, 4.8, 6.3, 100, 260) + rect(7.25, 12, 1.5, 2.5) + rect(4.5, 14, 7, 1.5, 0.75)


def mic(level):  # 0..3: how much of the capsule is filled (from the bottom)
    frame = f'<path fill-rule="evenodd" {FG} d="{CAPSULE}{CAP_IN}"/>'
    fill = ""
    if level:
        h = 6.4 * level / 3
        fill = f'<clipPath id="lvl"><path d="{rect(6.3, 8.7 - h, 3.4, h)}"/></clipPath>'
        return svg(frame + g(CAP_IN, clip="lvl") + g(STAND), fill)
    return svg(frame + g(STAND))


ICONS["microphone-sensitivity-low-symbolic"] = mic(1)
ICONS["microphone-sensitivity-medium-symbolic"] = mic(2)
ICONS["microphone-sensitivity-high-symbolic"] = mic(3)
ICONS["microphone-sensitivity-muted-symbolic"] = off(CAPSULE + STAND)
ICONS["audio-input-microphone-symbolic"] = mic(3)

# ── Battery (horizontal): body frame + cap, inner fill by level, state badges ─
B_OUT, B_IN = rect(1, 3.5, 12.5, 9, 2.2), rect(2.3, 4.8, 9.9, 6.4, 1.2)
B_CAP = rect(14, 6, 1.5, 4, 0.6)
FILL_X, FILL_Y, FILL_W, FILL_H = 3.3, 5.8, 7.9, 4.4
# Charging marks sit *inside* the body: the frame stays whole, only the fill is cut around the mark (1-px gap).
BOLT = poly((8.6, 4.4), (5.2, 8.6), (7.4, 8.6), (6.6, 11.6), (10, 7.3), (7.8, 7.3))
BOLT_GAP = poly((9.4, 2.4), (2.9, 9.7), (5.9, 9.7), (4.9, 13.9), (12.4, 6.2), (9.4, 6.2))
PLUG = rect(5.6, 6.6, 4.2, 3, 1) + rect(6.2, 4.6, 0.9, 2.3) + rect(8.3, 4.6, 0.9, 2.3) + rect(7.25, 9.4, 0.9, 2.2)
PLUG_GAP = rect(4.6, 3.6, 6.2, 9, 1.6)


def battery(level, state=""):
    """level 0..100 (step 10); state '' | 'charging' | 'plugged-in' | 'charged'."""
    critical = level <= 10 and not state
    klass = lambda c: f' class="{c}"' if c else ""
    frame = f'<path fill-rule="evenodd" {FG}{klass("error" if critical else None)} d="{B_OUT}{B_IN}{B_CAP}"/>'
    w = FILL_W * level / 100
    fill_cls = "warning" if level == 20 and not state else ("success" if state == "charged" else None)
    mark, gap = {"charging": (BOLT, BOLT_GAP), "plugged-in": (PLUG, PLUG_GAP)}.get(state, ("", ""))
    defs = f'<clipPath id="gap"><path clip-rule="evenodd" fill-rule="evenodd" d="M0 0H16V16H0z{gap}"/></clipPath>' if gap else ""
    parts = [frame]
    if w > 0 and not critical:
        fill = f'<path {FG}{klass(fill_cls)} d="{rect(FILL_X, FILL_Y, w, FILL_H, 0.6)}"/>'
        parts.append(f'<g clip-path="url(#gap)">{fill}</g>' if gap else fill)
    if critical:  # '!' inside, in error — shape as well as colour
        parts.append(f'<path class="error" {FG} d="{rect(6.9, 5.6, 1.6, 3.2, 0.6)}{circle(7.7, 10.1, 0.9)}"/>')
    if state == "charging":
        parts.append(f'<path class="success" {FG} d="{BOLT}"/>')
    elif state == "plugged-in":
        parts.append(f'<path {FG} d="{PLUG}"/>')
    return svg("".join(parts), defs)


for lv in range(0, 101, 10):
    ICONS[f"battery-level-{lv}-symbolic"] = battery(lv)
    ICONS[f"battery-level-{lv}-charging-symbolic"] = battery(lv, "charging")
    ICONS[f"battery-level-{lv}-plugged-in-symbolic"] = battery(lv, "plugged-in")
ICONS["battery-level-100-charged-symbolic"] = battery(100, "charged")
ICONS["battery-missing-symbolic"] = svg(
    f'<g opacity="{DIM}"><path fill-rule="evenodd" {FG} d="{B_OUT}{B_IN}{B_CAP}"/></g>'
    f'<path {FG} d="{rect(6.9, 5.6, 1.6, 3.2, 0.6)}{circle(7.7, 10.1, 0.9)}"/>')

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

#!/usr/bin/env python3
"""Render real scenes through real GTK 4 icon lookup — what the owner actually sees.

  python3 tools/scene.py files DIR [DIR…]   Files-style grid of a directory (special dirs, folder tags, mimetypes)
  python3 tools/scene.py apps [ID…]         dock row + app grid (default: every visible installed app)
Options: --theme Hyaline  --size 64  --light  --search-path DIR (prepend, e.g. dist)  --out PATH

Icons resolve exactly as GTK would for the named theme (inheritance included), and each tile is marked
with a small dot when the icon came from outside the theme (inherited) — so gaps are visible at a glance.
"""
import math
import os
import sys

import cairo
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf, Gio, GLib, Gtk  # noqa: E402

# No python3-gi-cairo here (and no sudo), so GI objects never touch cairo directly:
# GdkPixbuf loads icon files, cairo's own text API draws labels.
FONT = "Ubuntu Sans"

ARGS = sys.argv[1:]


def opt(name, default=None):
    if name in ARGS:
        i = ARGS.index(name)
        v = ARGS[i + 1]
        del ARGS[i : i + 2]
        return v
    return default


THEME = opt("--theme", "Hyaline")
SIZE = int(opt("--size", "64"))
OUT = opt("--out", "dist/preview/scene.png")
SEARCH = opt("--search-path")
LIGHT = "--light" in ARGS
if LIGHT:
    ARGS.remove("--light")
BG, INK, DIM = ((1, 1, 1), (0.13, 0.13, 0.15), (0.45, 0.45, 0.5)) if LIGHT else (
    (0.118, 0.118, 0.118), (0.93, 0.93, 0.95), (0.6, 0.6, 0.65))

Gtk.init()
theme = Gtk.IconTheme.new()
if SEARCH:
    theme.set_search_path([SEARCH, *theme.get_search_path()])
theme.set_theme_name(THEME)

SPECIAL = {
    GLib.UserDirectory.DIRECTORY_DESKTOP: "user-desktop",
    GLib.UserDirectory.DIRECTORY_DOCUMENTS: "folder-documents",
    GLib.UserDirectory.DIRECTORY_DOWNLOAD: "folder-download",
    GLib.UserDirectory.DIRECTORY_MUSIC: "folder-music",
    GLib.UserDirectory.DIRECTORY_PICTURES: "folder-pictures",
    GLib.UserDirectory.DIRECTORY_PUBLIC_SHARE: "folder-publicshare",
    GLib.UserDirectory.DIRECTORY_TEMPLATES: "folder-templates",
    GLib.UserDirectory.DIRECTORY_VIDEOS: "folder-videos",
}
SPECIAL_PATHS = {GLib.get_user_special_dir(k): v for k, v in SPECIAL.items() if GLib.get_user_special_dir(k)}
SPECIAL_PATHS[GLib.get_home_dir()] = "user-home"


def surface_for(gicon, size):
    """Draw the file GTK picks for `gicon` at `size` (scale 1); return (surface, own?).
    GTK decides *which* file; cairo/librsvg draw it (symbolic recolouring is not simulated)."""
    paintable = theme.lookup_by_gicon(gicon, size, 1, Gtk.TextDirection.NONE, 0)
    f = paintable.get_file()
    path = f.get_path() if f else ""
    out = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    if path:
        pb = GdkPixbuf.Pixbuf.new_from_file_at_size(path, size, size)
        tmp = os.path.join(GLib.get_tmp_dir(), f"hyaline-scene-{os.getpid()}.png")
        pb.savev(tmp, "png", [], [])
        img = cairo.ImageSurface.create_from_png(tmp)
        os.unlink(tmp)
        cr = cairo.Context(out)
        cr.set_source_surface(img, (size - img.get_width()) / 2, (size - img.get_height()) / 2)
        cr.paint()
    return out, f"/{THEME}/" in path


def file_icon(path):
    if path in SPECIAL_PATHS:
        return Gio.ThemedIcon.new(SPECIAL_PATHS[path])
    info = Gio.File.new_for_path(path).query_info(
        "standard::icon,metadata::custom-icon-name,metadata::custom-icon", Gio.FileQueryInfoFlags.NONE, None)
    custom = info.get_attribute_string("metadata::custom-icon-name")
    if custom:
        return Gio.ThemedIcon.new(custom)
    return info.get_icon()


def text(cr, x, y, s, size, rgb, bold=False, width=None, lines=1, center=False):
    cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)
    cr.set_source_rgb(*rgb)
    rows, cur = [], ""
    for ch in s:  # greedy char wrap, ellipsize the last line
        if width and cr.text_extents(cur + ch).x_advance > width:
            rows.append(cur)
            cur = ch
        else:
            cur += ch
    rows.append(cur)
    if len(rows) > lines:
        rows = rows[:lines]
        last = rows[-1]
        while last and cr.text_extents(last + "…").x_advance > width:
            last = last[:-1]
        rows[-1] = last + "…"
    for i, r in enumerate(rows):
        w = cr.text_extents(r).x_advance
        cr.move_to(x + ((width - w) / 2 if center and width else 0), y + size + i * size * 1.3)
        cr.show_text(r)


def draw_tiles(tiles, title, cols, cell_w, cell_h, size):
    """tiles: [(label, gicon)] → cairo surface."""
    rows = max(1, math.ceil(len(tiles) / cols))
    W, H = cols * cell_w + 48, rows * cell_h + 72
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surf)
    cr.set_source_rgb(*BG)
    cr.paint()
    text(cr, 24, 18, title, 13, DIM, bold=True)
    for i, (label, gicon) in enumerate(tiles):
        x0, y0 = 24 + (i % cols) * cell_w, 56 + (i // cols) * cell_h
        icon, own = surface_for(gicon, size)
        cr.set_source_surface(icon, x0 + (cell_w - size) / 2, y0)
        cr.paint()
        if not own:  # inherited: small marker so gaps are obvious
            cr.set_source_rgba(1, 0.55, 0.2, 0.9)
            cr.arc(x0 + (cell_w + size) / 2 - 2, y0 + 4, 3.5, 0, 2 * math.pi)
            cr.fill()
        text(cr, x0 + 6, y0 + size + 4, label, 12.5, INK, width=cell_w - 12, lines=2, center=True)
    return surf


def stack(surfs):
    W = max(s.get_width() for s in surfs)
    H = sum(s.get_height() for s in surfs)
    out = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(out)
    cr.set_source_rgb(*BG)
    cr.paint()
    y = 0
    for s in surfs:
        cr.set_source_surface(s, 0, y)
        cr.paint()
        y += s.get_height()
    return out


def files_scene(dirs):
    out = []
    for d in dirs:
        d = os.path.abspath(os.path.expanduser(d))
        names = [n for n in os.listdir(d) if not n.startswith(".")]
        is_dir = {n: os.path.isdir(os.path.join(d, n)) for n in names}
        names.sort(key=lambda n: (not is_dir[n], n.lower()))  # Files default: folders first
        tiles = [(n, file_icon(os.path.join(d, n))) for n in names]
        out.append(draw_tiles(tiles, d.replace(GLib.get_home_dir(), "~"), 8, max(SIZE + 40, 112), SIZE + 52, SIZE))
    return stack(out)


def apps_scene(ids):
    if ids:
        infos = [Gio.DesktopAppInfo.new(i if i.endswith(".desktop") else i + ".desktop") for i in ids]
        infos = [a for a in infos if a]
    else:
        infos = [a for a in Gio.AppInfo.get_all() if a.should_show()]
        infos.sort(key=lambda a: a.get_display_name().lower())
    fav = [Gio.DesktopAppInfo.new(i) for i in Gio.Settings.new("org.gnome.shell").get_strv("favorite-apps")]
    fav = [a for a in fav if a]
    dock = draw_tiles([(a.get_display_name(), a.get_icon() or Gio.ThemedIcon.new("application-x-executable"))
                       for a in fav], "Dock (favourites) — 48 px", max(len(fav), 1), 88, 48 + 44, 48)
    grid = draw_tiles([(a.get_display_name(), a.get_icon() or Gio.ThemedIcon.new("application-x-executable"))
                       for a in infos], f"App grid — {SIZE} px   (orange dot = inherited, not Hyaline)", 10,
                      max(SIZE + 40, 112), SIZE + 52, SIZE)
    return stack([dock, grid])


def main():
    if not ARGS:
        print(__doc__)
        return 2
    mode, rest = ARGS[0], ARGS[1:]
    surf = files_scene(rest or ["~"]) if mode == "files" else apps_scene(rest)
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    surf.write_to_png(OUT)
    print(f"scene: {mode} → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

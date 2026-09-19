# Research notes

## Reference set (inspiration)
- **Glassmorphism – Glass Icon set (Free)** — Kristaps Elsiņš (uibits). Figma Community,
  **CC BY 4.0**, ~10k users, last updated 2024.
  https://www.figma.com/community/file/1389159203053638214/glassmorphism-glass-icon-set-free
  Expanded free set: https://uibits.lemonsqueezy.com/buy/bc0eebe5-c8ed-4a86-8c24-41b28b1641eb
- Visible icons: weather (sun + cloud), calendar ("Sun 8"), mail (envelope + letter), chat bubbles,
  folder, add-to-stack, award ribbon, video camera with list plate.
- Style anatomy observed:
  - one **vivid gradient back shape** (pastel → saturated, ~135°), upper-right
  - one **frosted white plate** overlapping it lower-left; the back shape shows *through* it blurred
  - **white glyph** on the plate (lines, dots, plus, play, date)
  - soft **coloured glow** under the back shape, very light contact shadow
  - no outlines, no texture, generous rounding
- Key insight: the only thing "behind" the glass is the icon's own back shape, so the blur is
  reproducible statically (blurred copy of `back` clipped to `plate`) — no live backdrop needed.

## Rendering landscape (Sept 2026, owner's system)
- Ubuntu 26.04.1, GNOME Shell 50.1, GTK 4.22.4, librsvg 2.61.3, glycin-loaders 2.1.1.
- GTK 4.22 ships **GtkSvg** (native SVG incl. animation, passes ~1250/1616 resvg tests) but still
  uses the simpler legacy parser for icons looked up **by name from an icon theme**; complex filters
  are called out as a remaining gap.
  - https://blogs.gnome.org/gtk/2025/10/23/svg-in-gtk/
  - https://blogs.gnome.org/gtk/2026/02/25/an-update-on-svg-in-gtk/
  - https://www.phoronix.com/news/GTK-4.22-SVG-2026
- Qt's QtSvg implements SVG 1.2 Tiny → no filters. KDE/Qt apps would drop blur entirely.
- ⇒ ADR-001: author SVG, ship PNG (+@2x).
- **To verify in M1:** render one filter-heavy SVG through GTK by name (tools/lookup.py + screenshot)
  to record what actually happens; update this file with the result.

## Icon theme mechanics
- Freedesktop Icon Theme Spec (v0.11): lookup = current theme → `Inherits` chain → `hicolor`;
  within a theme the closest size wins **before** falling back to parents, so if an icon exists at any
  size it will be scaled rather than inherited → ship every size for every icon.
  https://specifications.freedesktop.org/icon-theme/latest/
- Icon Naming Spec for standard names (places, mimetypes, devices…):
  https://specifications.freedesktop.org/icon-naming/latest/
- `Scale=2` directories give HiDPI art (48@2x = 96 px drawn with 48 px detail).
- `gtk-update-icon-cache` fails ("generated cache was invalid") on file names with spaces/odd chars
  or broken symlinks — seen repeatedly with third-party themes on this machine. Lint for it.
- App icon names: `Icon=` key in `/usr/share/applications/*.desktop`, `~/.local/share/applications`,
  `/var/lib/flatpak/exports/share/applications`, `/var/lib/snapd/desktop/applications`.

## Owner context
- Currently uses **Folio**: `~/.local/share/icons/Folio`, a symlink overlay
  (`Inherits=Papirus,Adwaita,hicolor`) with Adwaita folders + official Chrome Dev logo.
- Rejected before (too busy / inconsistent): Infinity Glass, Papirus folders, Pure, Reversal,
  Cool-Dark, Haptic, Paper, the aura-glass theme suite. Wants **clean, minimal, sleek**.
- Uses dark mode, blue accent, Dash to Panel, Blur My Shell.

# Hyaline

*Hyaline* — from Greek *hyalos*, glass.

A clean, minimal **frosted-glass icon theme** for Linux desktops. Every icon is two shapes and a glyph:
a vivid gradient shape seen through a soft pane of frosted glass, with a crisp white symbol on top.

![Hyaline on light, dark and wallpaper backgrounds](docs/preview.png)

Every size is checked, not just the big one — small sizes are hand-hinted onto the pixel grid:

![Selected icons at 16, 24, 48 and 128 px](docs/preview-sizes.png)

> Status: **v0.1** — folders, places and common file types. See [`docs/ROADMAP.md`](docs/ROADMAP.md)
> and the honest shipped-vs-inherited list in [`docs/COVERAGE.md`](docs/COVERAGE.md).

## What's in it
- **Folders** — `folder`, `folder-open`, and the special folders (Documents, Downloads, Music, Pictures,
  Videos, Templates, Public, Desktop, Home, remote, drag-accept).
- **Places** — Trash (empty/full), Bookmarks, Network, Server.
- **File types** — text, generic, PDF, image, audio, video, archive, script, HTML, office document /
  spreadsheet / presentation, executable, font.

Everything else — apps, symbolic icons, devices — falls back to **Papirus**, then Adwaita, then hicolor.
That is deliberate: Hyaline only ships icons it has redrawn well. No brand logos are redrawn.

The glass is baked: Hyaline ships pre-rendered PNGs at 16–256 px plus `@2x` HiDPI copies, so it looks
identical in GTK 4, GTK 3, Qt/KDE apps and the GNOME Shell app grid.

## Install
Requires [Bun](https://bun.sh) to build. Papirus is recommended for the fallback icons
(`sudo apt install papirus-icon-theme` on Ubuntu/Debian).

```bash
bun install
bun run build
bun run install:local        # → ~/.local/share/icons/Hyaline (does not switch your theme)
```

Then pick **Hyaline** in *GNOME Tweaks → Appearance → Icons*, or:

```bash
gsettings set org.gnome.desktop.interface icon-theme 'Hyaline'
```

## Uninstall
```bash
gsettings reset org.gnome.desktop.interface icon-theme   # or set your previous theme back
rm -rf ~/.local/share/icons/Hyaline
```

## Development
```bash
bun run build     # src/**/*.svg → dist/Hyaline (PNG @1x/@2x, aliases, index.theme, icon cache)
bun run preview   # dist/preview/sheet.png — every icon at 16/24/48/128 on light, dark and wallpaper
bun run verify    # lint + index.theme checks + real GTK lookup of every shipped name
bun run coverage  # regenerate docs/COVERAGE.md
bun run preview --grid --out docs/preview.png   # regenerate the README screenshot
```
Design rules live in [`docs/DESIGN.md`](docs/DESIGN.md); the pipeline and its decisions in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Credits
- Visual direction inspired by **Glassmorphism – Glass Icon set (Free)** by
  [Kristaps Elsiņš / uibits](https://www.figma.com/community/file/1389159203053638214/glassmorphism-glass-icon-set-free),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Hyaline's artwork is original —
  no geometry was copied.
- Fallback icons: [Papirus](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme), Adwaita.
- Rendering: [resvg](https://github.com/linebender/resvg).

## License
Icon artwork (`src/`, and the PNGs built from it): [CC BY-SA 4.0](LICENSE).
Build tools and scripts: [MIT](LICENSE-CODE).

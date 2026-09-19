# Hyaline

*Hyaline* — from Greek *hyalos*, glass.

A clean, minimal **frosted-glass icon theme** for Linux desktops. Every icon is two shapes and a glyph:
a vivid gradient shape seen through a soft pane of frosted glass.

> Status: in development — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Design
See [`docs/DESIGN.md`](docs/DESIGN.md). Hyaline ships only the icons it redraws (folders, places,
common file types, core GNOME apps); everything else falls back to **Papirus**, then Adwaita.

## Install
```bash
bun install && bun run build && bun run install:local
gsettings set org.gnome.desktop.interface icon-theme 'Hyaline'
```
Recommended: install Papirus for the best fallback coverage.

## Credits
- Visual direction inspired by **Glassmorphism – Glass Icon set (Free)** by
  [Kristaps Elsiņš / uibits](https://www.figma.com/community/file/1389159203053638214/glassmorphism-glass-icon-set-free),
  licensed CC BY 4.0. Hyaline's artwork is original.
- Fallback icons: [Papirus](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme), Adwaita.

## License
Icon artwork: [CC BY-SA 4.0](LICENSE). Build tools and scripts: [MIT](LICENSE-CODE).

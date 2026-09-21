# Changelog

## Unreleased (v0.3.0 / v0.4.0)
- **KDE Plasma 6** — tray icons now follow KDE's colour scheme (they were drawn black), crisp at the tray's 22 px;
  Plasma's own tray names (network, battery, Bluetooth, notifications) and KDE apps (Dolphin, Konsole, Kate,
  Okular, Gwenview, Spectacle, Discover…) resolve to Frost; new art for Ark, Elisa, KDE Connect and Info Center.
- **COSMIC** — COSMIC Files, Terminal, Settings, Edit, Store and Screenshot, the panel's battery, Bluetooth and
  notification applets, and new art for COSMIC Player (also GNOME's video player).
- **Your colours** — `frost.colors.json` recolours folders, file types, a palette colour or single icons from one
  CSS colour each; `install.sh --colors FILE|warm` builds and installs it after asking. JSON Schema for editors.
- `verify` looks every name up through GTK, KDE's KIconLoader and Qt; `tools/de/run.sh` shows Frost in real
  Plasma and COSMIC desktops in Docker.

## v0.2.0 — 2026-09-20
The first public release. **Licensed MIT** (icons and tools).

- **File types that say what they are** — 134 types in 31 kinds, drawn as a tinted glass sheet: one symbol per
  kind (colour = kind) and, from 48 px, a short type label (JSON, MD, PEM, LOCK, GO…). Pixel-hinted at 16/22/24.
- **Optional per-user MIME add-on** — real types for lock files, `.env`, Dockerfiles, git files, TypeScript/TSX,
  PEM/SSH keys, `go.mod`/`go.sum`, `.proto`, HCL; fixes GNOME typing `.ts` as Qt Linguist and `go.mod` as music.
- **Apps** — 31 core GNOME/Ubuntu apps in the glass app family (Files, Settings, Terminal, Text Editor,
  Calculator, Disks, Logs, Screenshot, System Monitor tools…). No brand logos.
- **Top-bar status icons** — Wi-Fi, wired, VPN, Bluetooth, volume, microphone (in-use orange), battery with
  power marks, night light, airplane, notifications, privacy indicators: states you can read at a glance.
- **Renamed Hyaline → Frost** — v0.1.0 was tagged as Hyaline.
- Pipeline: generated file types (`tools/gen-mimetypes.py`), identical renders deduplicated, `install.sh`.

## v0.1.0 — 2026-09-19
First usable set: folders, places and common file types. Everything else inherits from Papirus → Adwaita.

- **Pipeline** (Bun + resvg): `build` renders every source to PNG at 16/22/24/32/48/64/96/128/256 and
  `@2x`, derives small sizes by dropping layers, swaps in pixel-grid hints, links aliases, writes
  `index.theme` and the icon cache. `preview`, `verify` (lint + spec checks + real GTK lookup),
  `coverage`, `install:local`.
- **Folders** — `folder` (style anchor), `folder-open`, documents, download, music, pictures, videos,
  templates, publicshare, remote, drag-accept, `user-desktop`, `user-home` (owner's house glyph).
- **Places** — `user-trash`, `user-trash-full`, `user-bookmarks`, `network-workgroup`, `network-server`.
- **Mimetypes** — text, generic, PDF, image, audio, video, archive, script, HTML, office document /
  spreadsheet / presentation, executable, font; plus aliases for common specific types.
- Design language updates: plate contact shadow (`lift`), generic plate at (16, 40), small-size squircle
  re-layout, page family, pixel/glyph hints (see `docs/DESIGN.md`).

## Scaffold
- Project scaffold: design language, architecture, roadmap, research, templates, Claude Code skills/agent.

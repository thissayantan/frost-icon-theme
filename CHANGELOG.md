# Changelog

## Unreleased
- **Renamed Hyaline → Frost** (short, easy to say; theme dir `Frost`, repo folder `frost`). v0.1.0 was tagged as Hyaline.
- App family (24 core GNOME/Ubuntu apps), symbolic status icons (ADR-005), personal overlay, folder tagging, scene renderer, inventory.

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

## Unreleased (scaffold)
- Project scaffold: design language, architecture, roadmap, research, templates, Claude Code skills/agent.

# Roadmap

Tick items (`[x]`) as they land. A milestone is done only when every box is ticked **and**
`bun run verify` exits 0.

## M1 — Pipeline (no art yet beyond the template)
- [x] `package.json`, `tsconfig.json`, Bun scripts listed in CLAUDE.md
- [x] `tools/lint.ts` — layer ids present, palette-only colours, `viewBox 0 0 128 128`, no raster embeds
- [x] `tools/build.ts` — derive sizes (DESIGN §4), render @1x/@2x with resvg-js, optimise, aliases, index.theme, cache
- [x] `tools/preview.ts` — contact sheet: rows = icons, columns = 16/24/48/128 on light, dark and wallpaper backgrounds
- [x] `tools/verify.ts` — runs lint, validates index.theme against the spec, runs `tools/lookup.py` for every shipped name
- [x] `bun run install:local` works; theme selectable in GNOME Tweaks (do **not** activate it)
- [x] Template `src/_templates/glass.svg` renders correctly through the pipeline
- [x] Fix known template issue (see `docs/template-baseline.png`, headless-Chrome render): on the
      **light** background the part of the plate outside the back shape nearly vanishes (white on white).
      Solve within DESIGN rules — e.g. a faint plate-only contact shadow (`#000` 6–8 %, σ 3, y+2) or a
      slightly cooler plate tint — then update DESIGN.md §1 with the chosen recipe

## M2 — Anchor: the folder family (v0.1-alpha)
- [x] `folder` perfected at 128/48/24/16 on light + dark — this is the style anchor, iterate until it's genuinely good
- [x] `user-home` refined from the seed `src/places/user-home.svg` (owner's house glyph — DESIGN §6); keep the roof/body/door read at 24 px
- [x] Special folders: documents, download, music, pictures, videos, templates, publicshare, desktop, user-home, remote, drag-accept
- [x] `folder-open`, aliases (`inode-directory`, `folder-*` legacy names) in `aliases.json`
- [x] `icon-critic` agent review passed; findings fixed

## M3 — Places + mimetypes (v0.1)
- [x] `user-trash`, `user-trash-full`, `user-bookmarks`, `network-workgroup`, `network-server`
- [x] Mimetypes (generic + top types): text-x-generic, application-x-generic, application-pdf, image-x-generic,
      audio-x-generic, video-x-generic, package-x-generic / archives, text-x-script, text-html,
      x-office-document, x-office-spreadsheet, x-office-presentation, application-x-executable, font-x-generic
- [x] `docs/COVERAGE.md` generated (shipped vs inherited), preview sheet committed as `docs/preview.png`
- [x] README with screenshots, credits, install/uninstall
- [x] Tag `v0.1.0`

## M4 — Core apps (v0.2)
- [ ] Generic GNOME apps listed in DESIGN §6, names taken from installed `.desktop` files (`tools/inventory.ts`)
- [ ] Devices: drive-harddisk, drive-removable-media, computer, phone, printer, camera

## M5 — Release (v1.0)
- [ ] `release` skill checklist complete: tarball, gnome-look listing text, GitHub release, install.sh

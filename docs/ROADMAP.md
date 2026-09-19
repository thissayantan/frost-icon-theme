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

## M4 — Real-world pass: apps + language folders (v0.2)
Owner feedback 2026-09-19: judge icons in real scenes; Files and Settings must be excellent; Chrome keeps its
official logo; language folders (Android, Go, Node, Python…) should show their logos; nothing macOS-like.
- [x] `tools/scene.py` — real scenes through real GTK lookup: a directory as the Files grid (XDG special dirs,
      folder tags), the dock and the app grid, on the owner's dark setup and light
- [x] Local overlay (`install:local`, never committed): official Chrome / Chrome Dev icons linked from
      `/opt/google/*/product_logo_*`; language folders with the real brand marks (Simple Icons, CC0 paths)
      on the Frost folder — kept in git-ignored `local/`
- [x] `tools/tag-folders.ts` — tag `~/Android`, `~/go` and project folders by marker file
      (`gio set … metadata::custom-icon-name`); `--dry-run`, `--undo`
- [x] `tools/inventory.ts` — every installed app's `Icon=` (system, local, snap, flatpak) → decide the redraw list
- [x] Core apps, original art in the Frost anatomy: Files, Settings, Terminal, Ghostty (original ghost, not its
      logo), Text Editor, Calculator, System Monitor/Resources, App Center, Tweaks, Disks, Extensions + what the
      inventory shows the owner actually uses
- [ ] Devices: drive-harddisk, drive-removable-media, computer, phone, printer, camera
- [ ] icon-critic SHIP on every new icon, reviewed in scenes

## M4b — Status icons (symbolic, owner request 2026-09-19)
Top-bar / panel status icons whose *state* reads at a glance (Wi-Fi, VPN, Bluetooth, volume, mic, battery,
power profile, airplane, DND, privacy indicators…). Exception to rule 4, decided by the owner.
- [x] Research (names GNOME Shell 50 actually requests, symbolic recolouring classes, state language) → RESEARCH.md
- [x] ADR-005: symbolic icons ship as plain SVG (recolourable), not baked PNG; state colour via `success/warning/error` classes
- [x] Design the state language in DESIGN.md §8 (levels, off, acquiring, warning, critical; never colour alone)
- [ ] Draw the status set; test in the real top bar (owner screenshot) on dark and light

## M4c — File types that say what they are (owner request 2026-09-20)
JSON showed as a terminal, lock files / Markdown / certificates as the same grey page. Symbol + label, tinted
glass sheet (DESIGN §6, §6b; ADR-006).
- [x] Research: code-editor packs (JetBrains New UI, Material, vscode-icons), Papirus/Adwaita/Yaru mimetypes,
      Dribbble glass references, GIO's real icon names on this machine → RESEARCH.md
- [x] Owner decisions: symbol + label at ≥ 48 px; construction C (tinted glass sheet) over A (flap + band)
- [x] `tools/gen-mimetypes.py`: 31 categories × 134 types, drawn letterforms, 16/22/24 hints; `derive()` sheet branch
- [x] Per-user MIME add-on + `mime-probe` in `verify`; `install:local --undo-mime`
- [x] Scenes: a real project folder and Home (dark + light)
- [x] icon-critic SHIP on the file-type set (after two fix rounds, 2026-09-20)
- [ ] Owner's Files screenshot after `nautilus -q`

## M5 — Release (v1.0)
- [x] GitHub release v0.2.0 (tarball; install.sh one-liner tested against the live release), MIT, launch kit in docs/launch/
- [x] gnome-look.org listing live (p/2372226); GNOME Discourse post; press pitches sent
- [ ] AUR package pushed · Reddit + Show HN posts

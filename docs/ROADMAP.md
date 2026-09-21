# Roadmap

Tick items (`[x]`) as they land. A milestone is done only when every box is ticked **and**
`bun run verify` exits 0.

## Done
- **M1 Pipeline:** lint, build (resvg @1x/@2x, derived sizes, aliases, index.theme, cache), preview, verify
  (spec checks + real GTK lookup), `install:local`; plate contact shadow `lift` for light backgrounds.
- **M2 Folders (v0.1-alpha):** `folder` style anchor, `user-home`, special folders, `folder-open`, aliases.
- **M3 Places + mimetypes (v0.1.0):** trash, bookmarks, network; generic mimetypes; `docs/COVERAGE.md`; README.
- **M4 Real-world pass (v0.2):** `tools/scene.py`, local brand overlay (`local/`, never committed),
  `tag-folders`, `inventory`, 31 core apps in the Frost anatomy.
- **M4b Status icons:** research, ADR-005, DESIGN §8 state language.
- **M4c File types:** 31 categories × 134 types (`gen-mimetypes.py`), per-user MIME add-on (ADR-006), icon-critic SHIP.
- **M5 Launch (v0.2.0, 2026-09-20):** GitHub release + `install.sh` one-liner; gnome-look p/2372226; Show HN
  49770157; GNOME Discourse; dev.to / Medium / LinkedIn articles; r/gnome and r/LinuxPorn posts; press emailed
  (OMG! Ubuntu, Linux Uprising) and forms sent (It's FOSS, 9to5Linux).
  The published posts hotlink `docs/*.png` from `main`, so don't rename or delete those images.

## M6 — KDE Plasma (v0.3, promised on Reddit 2026-09-20)
- [x] Symbolic spike: one file for GTK, GNOME Shell, KDE and COSMIC (`currentColor` + `ColorScheme-*`,
      verified with GTK 3/4 and Qt renders, then in a real Plasma 6 tray) — ADR-005 amendment
- [x] `gen-status.py` emits it; 22 px padded status dir; lint rules; `FollowsColorScheme` + KDE size keys
- [x] KDE tray and app aliases (plasma-nm, battery, bluedevil, notifications; Dolphin, Konsole, Kate…)
- [x] New art: ark, elisa, kdeconnect, hwinfo — icon-critic SHIP
- [x] `verify` resolves every name through KIconLoader (flatpak runtime) and Qt (PySide6 via uv)
- [x] Plasma 6 in Docker (`tools/de/run.sh kde`): desktop, tray, Dolphin, System Settings, light + dark
- [ ] Release v0.3.0 (owner go-ahead); confirm the gnome-look listing sits in "Full Icon Themes" (KDE Store)

## M7 — COSMIC
- [x] `com.system76.Cosmic*` app and `cosmic-applet-*` panel aliases; CosmicPlayer art — icon-critic SHIP
- [ ] COSMIC in Docker (`tools/de/run.sh cosmic`) — panel + Files screenshots

## M8 — Custom colours (v0.4)
- [x] `frost.colors.json` + generated JSON Schema; `tools/colors.ts` (OKLCH mid-tone derivation, unit-tested)
- [x] `data-category` on file types; `derive()` substitution; `build`/`preview --colors`; `presets/warm.json`
- [x] `install.sh --colors` with consent prompt + official Bun installer — tested in a clean container
      (accepted and declined); ADR-007; README "Make it yours"

## Open
- [ ] Devices: drive-harddisk, drive-removable-media, computer, phone, printer, camera
- [ ] icon-critic SHIP on every new icon, reviewed in scenes
- [ ] Status set: test in the real top bar (owner screenshot) on dark and light
- [ ] Owner's Files screenshot after `nautilus -q`
- [ ] AUR package (blocked: Arch registration closed; package ready in `packaging/aur/`)
- [ ] X thread (blocked: X wants a phone number on the account; draft in git history, `docs/launch/x-thread.md`
      before 2026-09-21)

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

## Open
- [ ] Devices: drive-harddisk, drive-removable-media, computer, phone, printer, camera
- [ ] icon-critic SHIP on every new icon, reviewed in scenes
- [ ] Status set: test in the real top bar (owner screenshot) on dark and light
- [ ] Owner's Files screenshot after `nautilus -q`
- [ ] AUR package (blocked: Arch registration closed; package ready in `packaging/aur/`)
- [ ] X thread (blocked: X wants a phone number on the account; draft in git history, `docs/launch/x-thread.md`
      before 2026-09-21)

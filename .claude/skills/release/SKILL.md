---
name: release
description: Use when preparing a Frost release — versioning, tarball, install.sh, README/screenshots, licences and credits, GitHub release and the gnome-look.org listing. Never publish without the owner's explicit go-ahead.
---

# Releasing Frost

**Publishing is outward-facing: prepare everything locally, then stop and ask the owner.**

## Checklist
1. `bun run verify` exits 0; ROADMAP milestone fully ticked.
2. Bump version in `package.json` and `index.theme` (`Comment=… vX.Y.Z` is fine); update `CHANGELOG.md`.
3. `bun run build` then `tar -C dist -cJf dist/Frost-vX.Y.Z.tar.xz Frost` (tarball root = theme dir).
4. `install.sh` at repo root: copies to `~/.local/share/icons` (or `/usr/share/icons` with `--system`),
   runs the cache, prints how to activate. `install.sh --uninstall` removes it. No sudo unless `--system`.
5. Screenshots: `docs/preview.png` + one real Files window on light and dark.
6. Licences present and correct:
   - `LICENSE` (MIT, owner's choice 2026-09-20) covers everything: icon art in `src/` and `dist/`, `tools/`, `install.sh`.
   - README credits: inspired by *Glassmorphism – Glass Icon set* by Kristaps Elsiņš (uibits), CC BY 4.0.
   - No trademarked logos anywhere in `src/`.
7. Draft (don't post) the gnome-look.org text in `docs/LISTING.md`: category *Full Icon Themes*,
   summary, requirements ("Papirus recommended as fallback"), install steps, changelog.
8. Ask the owner before: pushing a public repo, creating a GitHub release, uploading to gnome-look.

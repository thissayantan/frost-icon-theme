# Frost — frosted-glass icon theme for Linux

Frost (renamed from Hyaline on 2026-09-19 — the owner wanted a short, easy name) is a clean, minimal icon theme with a frosted-glass
look: a vivid gradient back shape seen through a soft frosted plate, with a crisp white glyph.
It targets GNOME 50 / GTK 4.22 on Ubuntu 26.04 (the owner's machine) and must also look
right in GTK3, Qt/KDE apps and the GNOME Shell app grid.

## Read before working
- `docs/DESIGN.md` — the design language. Every icon obeys it. Non-negotiable.
- `docs/ARCHITECTURE.md` — source → build → dist pipeline and the decisions (ADRs) behind it.
- `docs/ROADMAP.md` — milestones with checklists. Work the current milestone top-down; tick items as they land.
- `docs/RESEARCH.md` — what we learned and the sources. Add to it when you learn something new.
- Skills in `.claude/skills/` load automatically when relevant: `frost-design`, `icon-theme-spec`, `build-preview`, `release`.

## Ground rules
1. **Minimal first.** Fewer, better icons beat broad coverage. Anything not shipped falls back
   through `Inherits=Papirus,Adwaita,hicolor` — that is a feature, not a gap.
2. **Never copy the reference art.** The uibits / Kristaps Elsiņš Figma set (CC BY 4.0) is
   *inspiration only*. Draw original geometry. Credit it in README regardless.
3. **No trademarked logos redrawn or redistributed** (Chrome, Firefox, VS Code, Spotify…).
   Brand apps are left to inherit. The owner's *personal* brand icons (official Chrome/Chrome Dev, language-folder
   logos) live only in the git-ignored `local/` overlay applied by `install:local` — never committed (owner, 2026-09-19).
4. **Symbolic icons:** only the top-bar *status* set (owner request 2026-09-19, ADR-005, DESIGN §8) — plain
   recolourable SVG from `tools/gen-status.py`. All other `*-symbolic` icons inherit so GTK can recolour them.
5. **Glass is baked, not live.** Shipped files must not depend on SVG filters rendering at runtime
   (see ADR-001). Filters live in `src/`; `dist/` gets PNGs.
6. **Verify visually.** Never call an icon done without looking at the rendered preview sheet on
   both a light and a dark background, at 16, 24, 48 and 128 px.
7. **Don't touch the owner's system state** beyond `~/.local/share/icons/Frost*` (install target), the folder
   tags written by `tag-folders`, and the marked snap launcher copies in `~/.local/share/applications`
   (`X-Frost-Override`, undo with `bun run install:local --undo-launchers`) — both requested by the owner.
   Never change their active icon theme without being asked. Since 2026-09-19 the owner uses `Frost` itself
   (previous: `Folio`).

## Commands (create these in milestone M1; keep this list accurate)
- `bun install` — toolchain (resvg-js, sharp, @xmldom/xmldom)
- `bun run build` — `src/**/*.svg` → `dist/Frost/` PNGs at every size + `index.theme` + cache
- `bun run preview` — contact sheet `dist/preview/sheet.png` (light + dark rows, all sizes)
- `bun run verify` — lint SVG sources, check naming/coverage, validate `index.theme`, run `tools/lookup.py`
- `bun run install:local` — copy `dist/Frost` to `~/.local/share/icons/` and refresh the cache
- `bun run coverage` — regenerate `docs/COVERAGE.md` (shipped vs inherited, via real GTK lookup)
- `bun run typecheck` — `tsc` over `tools/`
- `bun run preview --from-src` renders sources in memory (no dist); `--grid --out docs/preview.png` makes the README shot

## Layout
```
src/<context>/<icon-name>.svg   one source per icon, 128×128 canvas, layers per DESIGN.md
src/_templates/                 canonical layer template — copy it, never start blank
tools/                          build, preview, verify scripts (+ lookup.py: real GTK lookup test)
dist/                           build output (git-ignored)
docs/                           design, architecture, roadmap, research, coverage
```

## Conventions
- Icon file names are exact freedesktop / app `Icon=` names. Aliases are symlinks created at build time
  from `src/aliases.json`, never duplicate files.
- Colours come only from the palette tokens in `docs/DESIGN.md`. No ad-hoc hex values.
- Commit small and often: one icon family or one pipeline step per commit, imperative subject line.

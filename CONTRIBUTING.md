# Contributing to Frost

Thanks for helping! Frost is small on purpose: **fewer, better icons**. Anything not drawn falls back to
Papirus → Adwaita, and that's fine.

## Asking for an icon
Open an [icon request](https://github.com/thissayantan/frost-icon-theme/issues/new/choose) with:
- **Apps:** the `Icon=` value from the app's `.desktop` file (`grep Icon= /usr/share/applications/<app>.desktop`).
- **File types:** the name GTK looks up — `gio info -a standard::icon,standard::content-type FILE`.

Brand logos (Firefox, Chrome, VS Code, Spotify…) are **never** redrawn — they keep their own icons.

## Drawing an icon
1. Read [`docs/DESIGN.md`](docs/DESIGN.md) — two shapes and a glyph, palette tokens only, pixel hints at small sizes.
2. Copy the right template from `src/_templates/` (folder, glass, page, app) into `src/<context>/<icon-name>.svg`.
   File names are the exact freedesktop / `Icon=` names; extra names go in `src/aliases.json`.
3. **File types are generated** — edit the category/type tables in `tools/gen-mimetypes.py`, then run
   `python3 tools/gen-mimetypes.py`. Status icons come from `tools/gen-status.py`. Don't hand-edit their SVGs.
4. Check it: `bun run preview --from-src --only <name> --sizes 16,24,48,128` on light *and* dark.
5. `bun run verify` must pass.

## Commits
`<gitmoji> <type>(<scope>): <imperative subject>` — e.g. `✨ feat(apps): add Weather`, `🐛 fix(status): …`,
`🎨 style(mimetypes): …`, `📝 docs: …`. One icon family or one pipeline step per commit.

By contributing you agree your work is released under the [MIT license](LICENSE).

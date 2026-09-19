---
name: build-preview
description: Use when building Frost, generating or reading the preview sheet, installing locally, or verifying that GTK really loads Frost's files. The build → look → verify loop.
---

# Build → look → verify

```bash
bun run build          # src → dist/Frost (PNG @1x/@2x, aliases, index.theme, cache)
bun run preview        # dist/preview/sheet.png
bun run verify         # lint + index.theme validation + GTK lookup for every shipped name
bun run install:local  # → ~/.local/share/icons/Frost, cache refreshed
```

## Looking is mandatory
After any art change, open `dist/preview/sheet.png` with the **Read** tool and actually inspect it.
Sheet layout: one row per icon; column groups for light `#FAFAFB`, dark `#1E1E22`, and a photo
background; sizes 16 / 24 / 48 / 128 in each group. Zoom by rendering a single icon large:
`bun run preview --only folder --size 256`.

## Real-desktop check (only when a milestone closes)
1. `bun run install:local`
2. Temporarily preview in an isolated way: `GTK_THEME=Adwaita:dark gtk4-icon-browser` if installed,
   or `python3 tools/lookup.py Frost <names…>`.
3. Only if the owner asks: switch with `gsettings set org.gnome.desktop.interface icon-theme Frost`
   and always tell them how to switch back to `Folio`.

## When something renders wrong
- Different in GTK than in the sheet → ADR-001 broken: something in dist is SVG, or a PNG size is missing.
- Blurry at small sizes → the size variant needs a hand-tuned `<name>.<size>.svg`.
- Icon not picked up → name mismatch (see `icon-theme-spec`) or directory missing from `index.theme`.

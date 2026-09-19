---
name: frost-design
description: Use when drawing, editing or reviewing any Frost icon SVG — the glass layer recipe, grid, palette tokens, small-size rules and quality checklist. Load before touching anything in src/.
---

# Drawing a Frost icon

1. **Start from the template**: `cp src/_templates/glass.svg src/<context>/<icon-name>.svg`.
   The file name is the exact freedesktop/app icon name.
2. **Pick the palette token** for the family (docs/DESIGN.md §3). Replace the two gradient stops
   in `<defs>` — the only colours you may change.
3. **Draw `back`** (the identity shape) inside its box (≈84×84 at 36,12). Folders: full-width silhouette.
4. **`frost` updates itself** — it `<use>`s `#back-shape` through the blur filter and the plate clip.
   Never draw into `frost` directly.
5. **Adjust `plate`** only if the family demands (folder flap, page, etc.). Keep rx 18.
6. **Draw `glyph`** centred on the plate, ≤40×40, stroke 8 px round caps, then convert strokes to
   fills only if resvg renders them differently (it shouldn't).
7. Build and **look**: `bun run build && bun run preview`, then read `dist/preview/sheet.png`
   with the Read tool. Compare against the `folder` anchor on light + dark rows.
8. Run the DESIGN.md §7 checklist. If a small size fails, add `<name>.<size>.svg`.

## Glass recipe cheat-sheet (128 canvas)
| layer | key values |
|---|---|
| shadow | ellipse cx 64 cy 118 rx 40 ry 5, #000 12 %, σ 5 |
| glow | use #back-shape, σ 6, opacity .35, translate(0 4) |
| back | linearGradient 135° light→deep |
| frost | use #back-shape, σ 8, clip-path = plate |
| plate | #FFF, gradient opacity .55 → .28 top→bottom, rx 18 |
| rim | stroke 1.5 inside (clip to plate), #FFF .70 → .12 |
| glyph | #FFF solid |

## Taste rules
- If you're adding a third shape, stop: the idea is wrong, simplify the glyph instead.
- Glyphs are *symbols*, not illustrations: 1–3 primitives.
- Same glyph weight across the whole set. Compare against three siblings before finishing.
- Brand logos: never. Leave them to inherit.

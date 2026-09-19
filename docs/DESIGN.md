# Hyaline design language

> Clean. Minimal. Glass. Every icon is **two shapes and a glyph** — nothing more.

Reference mood: *Glassmorphism – Glass Icon set (Free)* by Kristaps Elsiņš / uibits
(Figma Community, CC BY 4.0). Inspiration only — Hyaline geometry is original.

## 1. Anatomy (the only allowed structure)

Every full-colour icon is built from these layers, bottom to top. Layer `id`s are **mandatory** —
the build derives small-size variants by dropping layers by id.

| # | `id`      | What it is | Recipe |
|---|-----------|------------|--------|
| 1 | `shadow`  | Soft contact shadow | Ellipse under the icon, `#000` 10–14 %, blur σ 5, ry 4, centre ≤ y 117 so the blur never hits the canvas edge |
| 2 | `glow`    | Coloured bloom of the back shape | Copy of `back`, blur σ 6, 35 % opacity, offset y +4 |
| 3 | `back`    | The vivid shape — identity & colour | Linear gradient 135°, palette `light → deep` |
| 4 | `frost`   | Fake backdrop blur | Copy of `back` blurred σ 8, **clipped to `plate`** |
| 4b | `lift`   | Plate contact shadow (only when the plate leaves the back shape) | Copy of `plate`, `#000` 8 %, blur σ 3, offset y +2, **masked to outside the plate** |
| 5 | `plate`   | The frosted glass pane | Fill `#FFF`, vertical gradient 55 % → 28 % opacity |
| 6 | `rim`     | Light catching the glass edge | 1.5 px inner stroke, `#FFF` 70 % top → 12 % bottom |
| 7 | `glyph`   | The meaning | Solid `#FFF`, geometric, no outlines of outlines |

Why `lift` exists: on a light background the part of a white plate that hangs outside the back shape
is white-on-white and vanishes. A faint contact shadow outside the plate's edge gives it a body without
an outline and without greying the glass itself (the mask keeps it off the plate). Folder and page
families don't need it — their plate sits entirely inside the back shape. Chosen over a cooler plate
tint because the tint muddied the plate on dark backgrounds.

In the folder and page families the plate sits entirely inside a one-colour back, so `frost` is
visually inert there; it stays in the source (harmless, and consistent anatomy) and the glass reads through
the plate gradient and rim instead.

Why `frost` exists: real backdrop blur is impossible in an icon file, but in this style the only
thing behind the plate is the icon's own back shape. Blurring a clipped copy of `back` inside the
plate reproduces the effect exactly and statically.

**Not allowed:** text (except the calendar date), more than one back shape, outlines around the
whole icon, drop shadows on the glyph larger than σ 1, noise/grain, 3D perspective, skeuomorphic detail.

## 2. Grid (128 × 128 canvas, `viewBox="0 0 128 128"`)

- Live area: 8 px padding → 112 × 112. Nothing but `shadow`/`glow` bleeds outside it.
- **Back shape** sits upper-right: its bounding box ≈ 84 × 84, anchored at (36, 12).
- **Plate** sits lower-left, overlapping the back shape by 45–60 % of its area: ≈ 80 × 72, anchored at (12, 44).
- Folder family is the exception: back = folder silhouette full width (12 → 116), plate = lower
  62 % of the folder, full width, so it reads as the folder's front flap. Radii: back r12, flap top r10,
  flap bottom r12 (shared exactly with the back, so no back colour peeks round the corner). The tab rises
  with a smooth S-curve (`c6 0 7.5 10 15 10`) — no hard corner where it meets the body.
- Corner radii: plate 18, back shape 20 (squircle-ish, `rx` not superellipse), glyph strokes 8 px with round caps.
- Glyph lives centred on the **plate**, max 40 × 40, optical centre nudged 1 px up.

## 3. Palette tokens

Use only these. Each family is a 135° gradient `light → deep`; glow uses `deep`.

| Token      | light     | deep      | Used for |
|------------|-----------|-----------|----------|
| `blue`     | `#8CB8FF` | `#3F6DF5` | folders, places, file manager |
| `teal`     | `#86E3DC` | `#12A3B0` | network, devices, connectivity |
| `green`    | `#93E4AE` | `#1FAE63` | system utilities, spreadsheets, success |
| `yellow`   | `#FFE17D` | `#FFAA1F` | favourites, weather, notes |
| `orange`   | `#FFC27E` | `#FF7430` | creation, presentations, archives |
| `red`      | `#FF8E80` | `#EE3048` | video, alerts, recording |
| `pink`     | `#FF93BC` | `#EE3A70` | mail, documents-rich, messaging |
| `violet`   | `#D69BFF` | `#8B42F5` | chat, audio, media players |
| `graphite` | `#CDD2DB` | `#7A8394` | generic files, unknown types, terminal |

Glass: plate `#FFFFFF` (opacity per table above). Glyph: `#FFFFFF`. Shadow: `#000000`.

## 4. Small sizes (derived automatically, hand-tuned when needed)

| Size | Layers kept | Notes |
|------|-------------|-------|
| 128, 96, 64, 256 | all | full glass |
| 48 | `glow`(σ 4, 15 %) `back` `frost` `lift` `plate` `rim` `glyph` | shadow dropped |
| 32 | `back` `frost` `lift` `plate` `rim` `glyph` | glow dropped too: its blur is wider than a hinted pixel edge and re-softens the silhouette on light |
| 24, 22 | `back` (`lift`) `plate` `glyph` | flat: plate at fixed 40 %, no blur, glyph thickened to 2 px at target size |
| 16 | `back` `glyph` | silhouette + white glyph only |

**Generic layout at ≤ 24 px** (rect back + a plate that leaves it): the plate is dropped too, the back
grows to the live area (112 × 112, rx 28) and the glyph moves to its centre at 1.3×. A half-visible plate
at 24 px is mud; a solid tinted squircle with a white glyph is crisp. Folder and page families keep the
table above.

**Pixel-grid hints.** A source may carry `<path id="back-shape-<size>">` / `<path id="plate-shape-<size>">`
in `<defs>`; at that size `derive()` swaps the hint's geometry into `#back-shape` / `#plate-shape`, so edges
land on whole pixels (the 128 master's x = 12 is 1.5 px at 16 and 2.25 px at 24 — visibly soft). The folder
template carries hints for 16/22/24/32/48; every folder copied from it inherits them.

If an auto-derived size looks wrong, add a hand-drawn `src/<ctx>/<name>.<size>.svg`; the build prefers it.

## 5. Backgrounds

Every icon must pass on **both** `#FAFAFB` (light) and `#1E1E22` (dark), plus a busy photo wallpaper.
On dark backgrounds the plate must still read as glass, not grey mud: if it does, raise plate
opacity top stop, never add an outline.

## 6. Families (v0.1 scope)

- **Folders** — `folder` + special folders: glyph on the flap (documents, download, music,
  pictures, videos, templates, publicshare, desktop, user-home, remote, drag-accept).
- **`user-home` glyph (owner-specified)** — the house from `docs/references/user-home-glyph.png`,
  translated to glass: rounded **trapezoid roof** (narrow top, wide eaves) in solid white, **box body**
  below it in white 78 %, and a small **door** tucked directly under the roof line in the `deep` tint at
  55 %. No chimney, no windows, no outline. Seed art: `src/places/user-home.svg` — refine, don't replace.
  The same house (roof + body + door, same proportions) is the glyph wherever "home" appears (e.g. `go-home` apps icon).
- **Places** — `user-trash`(+`-full`), `network-workgroup`, `user-bookmarks`.
- **Mimetypes** — page silhouette back (graphite unless family colour applies), plate over lower half, type glyph.
- **Core apps** — only generic GNOME apps (Files, Terminal, Settings, Text Editor, Calculator,
  System Monitor/Resources, Software, Tweaks, Disks, Extensions). No brand logos.

## 7. Quality bar (checklist per icon)
- [ ] Reads instantly at 48 px on light and dark
- [ ] Recognisable at 16 px
- [ ] Uses only palette tokens; layer ids present
- [ ] Glyph centred on the plate, stroke weight consistent with siblings
- [ ] Looks like it belongs next to the folder icon (the family anchor)

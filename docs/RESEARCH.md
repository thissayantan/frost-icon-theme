# Research notes

## Reference set (inspiration)
- **Glassmorphism – Glass Icon set (Free)** — Kristaps Elsiņš (uibits). Figma Community,
  **CC BY 4.0**, ~10k users, last updated 2024.
  https://www.figma.com/community/file/1389159203053638214/glassmorphism-glass-icon-set-free
  Expanded free set: https://uibits.lemonsqueezy.com/buy/bc0eebe5-c8ed-4a86-8c24-41b28b1641eb
- Visible icons: weather (sun + cloud), calendar ("Sun 8"), mail (envelope + letter), chat bubbles,
  folder, add-to-stack, award ribbon, video camera with list plate.
- Style anatomy observed:
  - one **vivid gradient back shape** (pastel → saturated, ~135°), upper-right
  - one **frosted white plate** overlapping it lower-left; the back shape shows *through* it blurred
  - **white glyph** on the plate (lines, dots, plus, play, date)
  - soft **coloured glow** under the back shape, very light contact shadow
  - no outlines, no texture, generous rounding
- Key insight: the only thing "behind" the glass is the icon's own back shape, so the blur is
  reproducible statically (blurred copy of `back` clipped to `plate`) — no live backdrop needed.

## Rendering landscape (Sept 2026, owner's system)
- Ubuntu 26.04.1, GNOME Shell 50.1, GTK 4.22.4, librsvg 2.61.3, glycin-loaders 2.1.1.
- GTK 4.22 ships **GtkSvg** (native SVG incl. animation, passes ~1250/1616 resvg tests) but still
  uses the simpler legacy parser for icons looked up **by name from an icon theme**; complex filters
  are called out as a remaining gap.
  - https://blogs.gnome.org/gtk/2025/10/23/svg-in-gtk/
  - https://blogs.gnome.org/gtk/2026/02/25/an-update-on-svg-in-gtk/
  - https://www.phoronix.com/news/GTK-4.22-SVG-2026
- Qt's QtSvg implements SVG 1.2 Tiny → no filters. KDE/Qt apps would drop blur entirely.
- ⇒ ADR-001: author SVG, ship PNG (+@2x).
- **Verified (M1, 2026-09-19):** a filter-heavy source (`user-home.svg`: 4 × feGaussianBlur, clip-path,
  `<use>`) placed in a scratch `Type=Scalable` theme, looked up by name through `Gtk.IconTheme` (returns an
  `IconPaintable`) and rendered with `GskCairoRenderer.render_texture` at 256 px, is visually
  indistinguishable from resvg's render — blur, clip and gradients all survive in GTK 4.22 (the SVG goes
  through glycin/librsvg 2.61, not the GtkSvg engine). ADR-001 still stands: Qt/QtSvg (Tiny 1.2) has no
  filters, GTK3 apps depend on the pixbuf loader, and PNG makes all of them identical.

## Pipeline notes (M1)
- `index.theme`: `@2x` directories go **only** in `ScaledDirectories=`, not also in `Directories=` —
  that is what the spec says and what Papirus does. Verify enforces it.
- GNOME Tweaks lists any directory under an icon path that contains an `index.theme`
  (`gtweak/tweaks/tweak_group_appearance.py::_get_valid_icon_themes`) — no other requirement.
- `tools/lookup.py --search-path dist` prepends `dist/` to GTK's search path, so verify tests the build
  before it is installed; GTK resolves `@2x` lookups to the `…@2x/` PNGs as expected.
- resvg-js cannot find fonts by a CSS fallback list with unknown first entries in our setup; preview
  labels use a single installed family (`Ubuntu Sans`).
- A `σ 5` contact shadow centred at y 119 is visibly clipped by the 128 canvas edge (hard line under the
  icon). Keep `cy + ry + 2σ ≤ 128`.
- White glyph + white plate on `#FAFAFB`: anything that hangs outside the back shape disappears at
  every size. Solved with `lift` (≥ 32 px) and the generic small-size re-layout (≤ 24 px), see DESIGN §1/§4.

## Icon theme mechanics
- Freedesktop Icon Theme Spec (v0.11): lookup = current theme → `Inherits` chain → `hicolor`;
  within a theme the closest size wins **before** falling back to parents, so if an icon exists at any
  size it will be scaled rather than inherited → ship every size for every icon.
  https://specifications.freedesktop.org/icon-theme/latest/
- Icon Naming Spec for standard names (places, mimetypes, devices…):
  https://specifications.freedesktop.org/icon-naming/latest/
- `Scale=2` directories give HiDPI art (48@2x = 96 px drawn with 48 px detail).
- `gtk-update-icon-cache` fails ("generated cache was invalid") on file names with spaces/odd chars
  or broken symlinks — seen repeatedly with third-party themes on this machine. Lint for it.
- App icon names: `Icon=` key in `/usr/share/applications/*.desktop`, `~/.local/share/applications`,
  `/var/lib/flatpak/exports/share/applications`, `/var/lib/snapd/desktop/applications`.

## Mimetype lookup order (verified M3, GTK 4.22)
- A file's `GThemedIcon` carries names like `[image-png, image-x-generic, image-png-symbolic]`.
  `Gtk.IconTheme.lookup_by_gicon` tries **every name inside Frost first**, then the inherited themes —
  so `image-x-generic` from Frost beats Papirus's specific `image-png`. Verified for image/png,
  text/plain, application/zip, application/pdf, inode/directory against `dist/`.
- application/pdf's generic fallback is `x-office-document`, not `application-x-generic`.
- Not verified for Qt/KDE or GTK 3, whose loops may run name-by-name through the whole chain. Symlink
  aliases for the most common specific types (`src/aliases.json`) are cheap insurance either way.

## Real-world pass (M4, 2026-09-19)
- **Screenshots are blocked on GNOME Wayland** for non-allowlisted callers: `org.gnome.Shell.Screenshot`
  → `AccessDenied`, `gnome-screenshot` fails. Real scenes are rendered by `tools/scene.py` (real GTK lookup of
  each file/app, drawn with GdkPixbuf + cairo); the owner provides live screenshots at checkpoints.
- `python3-gi-cairo` is not installed (no sudo), so GI objects can't be passed to pycairo — scene.py keeps them apart.
- Rendering GTK paintables via `Gsk.CairoRenderer` from Python crashes on dispose (`!priv->is_realized`) when
  the GC collects it mid-run; avoid, use the looked-up file path instead.
- GNOME Files has no name-based folder icons. Per-folder: `gio set DIR metadata::custom-icon-name NAME`
  (theme icon, follows the theme) — `tools/tag-folders.ts`. Refresh Files (F5) to see it.
- Snap apps App Center, Firmware Updater, Security Center set `Icon=` to absolute PNG paths — no theme can
  restyle them.
- Terminal on Ubuntu 26.04 is Ptyxis (`org.gnome.Ptyxis`).
- Chrome ships its own official PNGs (`/opt/google/chrome*/product_logo_{16..256}[_dev|_beta].png`); Papirus
  restyles `google-chrome-unstable` as a red circle. The personal overlay links the official files.

## Status icons (symbolic) — research for M4b
Verified against the installed GNOME Shell 50.1 JS (extracted from `libshell-18.so`), St C source and local renders.
- **All top-bar status icons come from the icon theme** (overridable). Shell-bundled icons in
  `gnome-shell-icons.gresource` (accessibility-*, screencast-*, keyboard-brightness-*, dark-mode, osk-*…) sit in
  the hicolor fallback, so a theme can override them too (not verified live).
- Names 50.1 requests: Wi-Fi `network-wireless-{disabled,acquiring,hotspot,no-route,offline}` and
  `network-wireless-signal-{none,weak,ok,good,excellent}` (<20/<40/<50/<80/≥80 %); wired `network-wired`,
  `-acquiring`, `-no-route`, `-disconnected`; cellular `network-cellular-signal-*`, `-acquiring`, `-connected`,
  `-disabled`; VPN `network-vpn`, `-acquiring`, `-disabled`; Bluetooth `bluetooth-{active,disabled,acquiring}`;
  volume `audio-volume-{muted,low,medium,high,overamplified}`; mic `microphone-sensitivity-{muted,low,medium,high}`;
  **battery `battery-level-{0,10…100}` + `-charging`, `-plugged-in`, and `battery-level-100-charged`** (no fallback
  names; legacy `battery-{full,good,low,caution,empty}` still used by apps/UPower); `night-light`,
  `airplane-mode`, `power-profile-{performance,balanced,power-saver}`, `notifications-disabled`, `camera-web`,
  `location-services-active`, `media-record`, `screen-shared`, `display-brightness` — all `-symbolic`.
  Keyboard layout is a text label, not an icon.
- **St (top bar) recolouring**: wraps the SVG with `rect,path,ellipse,circle,polygon {fill: fg}` plus
  `.warning/.error/.success`. Colours are St defaults (success #4e9a06, warning #f5793e, error #cc0000) unless a
  shell theme sets `warning-color` etc. Strokes are *not* recoloured (keep hard-coded colour; GTK 4.22 drops them),
  `line/polyline` likewise; `warning-fill`/`transparent-fill` are ignored by St; opacity is kept.
  ⇒ Status icons: plain SVG, 16×16, filled outlines only, classes `success|warning|error` only, dim via opacity.
- Privacy indicators are coloured by the Shell itself (orange/red pill) — keep them one colour.
- Error red is 2.82:1 on #1E1E22 — use error as a fill + shape ("!"), never thin strokes; never colour alone.
- Sources: gnome-shell js/ui/status/{system,network,volume}.js, src/st/st-icon-theme.c, st-theme-node.c;
  docs.gtk.org/gtk4/icon-format.html; GNOME HIG UI icons; KDE HIG monochrome icons.

## Volume: waveform, not a speaker (owner's design, 2026-09-24)
The redrawn cone below was smooth but, in the owner's words, generic, and its muted state (dim wedge + slash) was
badly balanced at OSD size. Three replacements were mocked up and rendered at 16/32/96 before choosing
(`dist/preview/volume-ideas.png`): a waveform, a front-facing driver with parenthesis waves, and a rotary knob.
- The **driver** collapses to a donut at 16 px (ring + cone + screws is too much detail) and reads as a record or
  a power button; one-sided waves fight its symmetry.
- The **knob** loses its ticks and pointer at 16 px and reads as a settings gear; pointer angle is the least
  glanceable way to show a level in a panel.
- The **waveform** wins on the one axis that defeated the cone: vertical bars land on whole pixels at every size,
  so nothing blurs at 16 and nothing stair-steps at 96. Level maps to amplitude, and muting flattens the wave —
  no slash to misalign. No mainstream theme ships this, which is the point.

## Speaker and microphone redraw (2026-09-24, cone retired the same day)
The owner saw a stair-stepped speaker in GNOME's volume OSD: `audio-volume-*` was pixel art (`cells()`), fine at
16 px and blocky at every multiple. Measured from upstream sources before redrawing:
- **GNOME Shell's OSD icon is 32 px**, not 96: `$large_icon_size` = `$base_icon_size * 2` since GNOME 42
  (`data/theme/gnome-shell-sass/_variables.scss`, `widgets/_osd.scss`). 96 px (6×) still applies to GNOME ≤ 41 and
  Cinnamon. Both are integer multiples of 16, so whole and half coordinates stay sharp.
- **Adwaita** `audio-volume-high-symbolic`: one silhouette, box x0–3/y5–11 (r≈2) + 45° cone to x7/y1–15; waves are
  2-px annular sectors centred (6, 8) at r 4–6 and 8–10, sweeps ±34–48°, semicircular ends. Levels dim the outer
  wave (`fill-opacity .35/.67`) instead of removing it; muted adds a × rather than a slash.
- **Breeze 16**: same construction with 1-px bands (they grey out at 100 %), centre (8, 8), **radial** arc ends, and
  a 1-px slash with a measured 0.93-px moat. 22 px is redrawn, not scaled.
- **Adwaita's mic** shows sensitivity by filling the capsule from the bottom (the rest at `fill-opacity .67`), which
  keeps the silhouette identical across levels — Frost now does the same at 35 %.
- HIG rules applied: GNOME "2-px features, avoid 1 px, align to the pixel grid"; KDE "16-px monochrome icons should
  not use the top or bottom 2 pixels", badges ≥ 5 px with a 1-px moat.
- Three 2-px waves do not fit beside a wide speaker at 16 px (every upstream set ships two). The owner wanted three,
  so the body is narrower (box x1–4, face x7) and the bands are 1.6 px with 0.8-px gaps.
- Arcs must be filled annular sectors: St and KIconLoader recolour `fill` only, and butt-capped arc ends splay at
  ±50° and blur at 16 px.
  Sources: developer.gnome.org/hig/guidelines/ui-icons.html · develop.kde.org/hig/icons/monochrome/ ·
  gitlab.gnome.org/GNOME/adwaita-icon-theme · github.com/KDE/breeze-icons · gitlab.gnome.org/GNOME/gnome-shell

## Live mic indicator (parked by the owner, 2026-09-19)
- The top-bar mic icon is static (`microphone-sensitivity-*` follows the input-volume slider, not live audio).
  A live meter needs a Shell extension: GStreamer `pulsesrc ! level` with `application.id=org.gnome.VolumeControl`
  (so the Shell ignores it) worked at ~20 updates/s, ~4 % CPU. Hook: `quickSettings._volumeInput._indicator`.

## File types (M4c, 2026-09-20)
**What GIO really asks for** (`Gio.content_type_get_icon`, shared-mime-info on Ubuntu 26.04):
- JSON is `application-json` → **`text-x-script`**; `biome.json` / `turbo.json` are `application-schema+json`
  → `text-x-script`. That is why every JSON showed a terminal. `.md` → `text-markdown` → `x-office-document`;
  `.pem` → `application-x-x509-ca-cert` → `text-x-generic`; `.crt` → `application-pkix-cert`.
- **Wrong types:** `.ts` → Qt Linguist (`text-vnd.trolltech.linguist`), `.tsx` → Tiled tileset, `.key` → Keynote
  (glob weight 80), `.pub` → MS Publisher, `go.mod` → `audio/x-mod` (a tracker-music module), `.tf` and `go.sum`
  → todo.txt, `.otf` (name only) → OpenDocument formula template.
- **No type:** lock files, `.env`, Dockerfile, `.gitignore`, `.editorconfig`, `.ini/.conf/.cfg`, `.jsonc/.jsonl`,
  `.zsh`, `.proto`, `.hcl`, `.sqlite` — `text/plain` with content, `application/octet-stream` by name.
  No icon theme can tell these apart; a per-user MIME package can (ADR-006).
- `.iso`/`.img` are now `application-vnd.efi.iso` / `-img`; `.avi` is `video-vnd.avi`, `.wav` `audio-vnd.wave`.
- GTK 4 does not strip name parts (`application-json` does not fall back to `application`), so every generic in
  a chain must exist in the theme.
**How others show type.** JetBrains New UI (the owner's reference): one small symbol per type, restrained colour
(`{}` JSON, `M↓` Markdown, padlock lock files, `>_` shell, cylinder DB, gear config). Material Icon Theme: same
symbols, stronger colours. vscode-icons: page + badge. Papirus: category colours (documents blue, sheets green,
slides orange, PDF red, certificates green). Adwaita (GNOME 50) ships ~28 mimetype icons only.
Shared conventions Frost follows: `{}` data, `</>` code/markup, `>_` shell, gear config, padlock lock, key/rosette
crypto, cylinder database, grid table, `±` diff. The Markdown mark (M↓) is public domain (CC0, dcurtis/markdown-mark).
**Glass references** (owner, Dribbble): Moranart "3D Frosted Glass Icon Design" and glass icon sets — the glass
itself is *tinted* in the object's colour and a smaller vivid shape peeks out behind. A clear (white) glass page
reads grey on dark and vanishes on light — tried as construction B and dropped.
**Size:** 134 types × 18 renders ≈ 34 MB, mostly 256@2x; types in one category are byte-identical below 48 px
(labels drop), so those renders are symlinked (≈ 830 files).
Sources: github.com/PKief/vscode-material-icon-theme, github.com/vscode-icons/vscode-icons,
marketplace.visualstudio.com/items?itemName=fogio.jetbrains-file-icon-theme,
github.com/PapirusDevelopmentTeam/papirus-icon-theme, dribbble.com/shots/21062097-3D-Frosted-Glass-Icon-Design,
freedesktop.org shared-mime-info spec (glob weights, sub-class-of, magic priority).

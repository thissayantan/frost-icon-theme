---
title: "Your Linux desktop thinks go.mod is music"
published: false
description: "What I learned drawing 183 icons: why small sizes must be drawn, not scaled, and why file types are a lie."
tags: linux, gnome, opensource, design
cover_image: https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/hero.png
canonical_url:
---

*(dev.to reads the front matter above. For Medium, delete it and use the title and subtitle as the headline
and kicker.)*

---

Open a project folder in GNOME Files. `package.json`, `tsconfig.json`, `biome.json` — all three show a
terminal prompt. `bun.lock`, `CLAUDE.md` and your `.pem` certificate all show the same grey page with lines on
it. Nothing lies to you exactly, but nothing tells you anything either.

I spent a few weeks fixing that for myself, and ended up with an icon theme, a rendering pipeline and an
uncomfortable discovery about what Linux believes your files are.

The result is [Frost](https://github.com/thissayantan/frost-icon-theme): a frosted-glass icon theme for
GNOME, MIT licensed. This is what I learned making it.

## Icons are a language, not a picture

The first rule I set: every icon is **two shapes and a symbol**. A vivid coloured shape, a pane of frosted
glass over it, one white symbol on top. Nothing else. No 3D, no realism, no little screens with bezels.

That constraint is what makes a theme feel like a theme instead of a collection. The folder icon took the
longest — not because folders are hard, but because everything else inherits its rules: how round the
corners are, how thick the white lines are, where the glass sits, how the colour glows through it.

The second rule: **no brand logos, ever**. Firefox, Chrome, VS Code and Spotify keep their own icons. Partly
that's trademark hygiene, partly it's honesty: a redrawn Chrome logo is someone else's design wearing your
paint. Frost draws generic apps well and inherits the rest from
[Papirus](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme), and says so in the README.

## Small sizes must be drawn, not scaled

Here's the part most theme tutorials skip. Your file manager shows icons at 16, 24, 48, 64 and 128 pixels.
If you draw one beautiful 128 px icon and let the computer scale it down, the 16 px version is mud: a
1.5-pixel line becomes two grey half-lit pixels, and the crisp symbol turns into a smudge.

So in Frost every icon carries **hand-drawn pixel versions** for 16, 22 and 24 px. They're not the big icon
shrunk; they're a different drawing of the same idea, with every edge landing on a whole pixel. The build
swaps them in automatically. At those sizes the glass also goes solid, because a translucent pastel behind a
white symbol has nowhere near enough contrast when it's 16 pixels wide.

This is where most of the work went. A reviewer pass over the file types alone produced nine concrete fixes:
glyphs that overran the page edge at 22 px, seven categories that were anti-aliased instead of pixel-exact,
a "2" that read as a "Z" in the 3×5 pixel font I drew for labels.

## The glass has to be baked

Frosted glass is a blur, and blurs come from SVG filters. But an icon theme can't rely on filters: GTK
renders theme icons through a path where filter support is, politely, inconsistent. Live filters at 16 px
are also just slow and ugly.

So the pipeline bakes them. Sources are SVG with filters; a small [Bun](https://bun.sh) +
[resvg](https://github.com/linebender/resvg) script renders every icon to PNG at nine sizes, each at 1× and
2× for HiDPI, dropping layers and swapping in the pixel-grid versions as the size shrinks. Identical renders
get linked together instead of duplicated, which matters when 134 file types share 31 symbols.

The part I'd recommend to anyone shipping a theme: **verify with the real lookup**. Frost's `verify` step
uses PyGObject to ask GTK itself for every icon name it ships, and fails if any name resolves to something
outside the theme. That caught a whole class of bugs, including one that bites everyone doing file icons:
GTK 4 does **not** strip name parts. `application-json` does not quietly fall back to `application`. If the
exact name isn't there, you get the generic file icon and never know why.

## What your computer thinks your files are

Which brings me to the discovery. File icons come from MIME types, and MIME types on Linux come from
`shared-mime-info`. I probed the types for a normal developer folder. On an up-to-date Ubuntu with GNOME:

| File | What Linux thinks it is |
|---|---|
| `.ts` | a Qt Linguist translation file |
| `.tsx` | a Tiled tileset (a 2D game map format) |
| `go.mod` | `audio/x-mod` — a tracker music module |
| `.tf`, `go.sum` | a todo.txt list |
| `.key` | Apple Keynote, even when the file starts with `-----BEGIN PRIVATE KEY-----` |
| `bun.lock`, `.env`, `Dockerfile`, `.gitignore` | plain text, nothing more |
| `.jsonc`, `.zsh`, `.proto`, `.hcl`, `.sqlite` | nothing at all |

None of this is anyone's fault. `.ts` meant Qt translations long before TypeScript existed, and `.mod` was
tracker music in 1987. But it does mean **no icon theme can fix these on its own**. If the system tells the
file manager your `go.mod` is music, a prettier icon set just gives you a prettier music note.

So Frost ships an optional, per-user MIME add-on: one XML file in `~/.local/share/mime/packages/`, no root,
removable with a flag. It gives lock files, dotenv files, Dockerfiles, git config, TypeScript, PEM keys,
`go.mod`/`go.sum`, `.proto` and HCL real types. Where the stock guess is genuinely ambiguous — `.key` could
be Keynote or a private key — it ties the weights and lets content sniffing decide, rather than bulldozing
it.

The file icons then follow for free, because now there's something to name.

## Colour says the kind, the label says the type

With types sorted, the design question was: how much can an icon tell you at a glance?

Frost's answer is three layers of information. **Colour** tells you the kind: yellow for data and keys, blue
for documents, teal for code, orange for archives and installers, red for PDFs and media, graphite for plain
text. **The symbol** tells you the family: `{ }` for JSON, `M↓` for Markdown, a padlock for lock files, a
rosette for certificates, stacked crates for a Dockerfile. And from 48 px up, **a small text label** spells
out the exact type: JSON, MD, PEM, LOCK, GO, YAML.

Below 48 px the label disappears and only the symbol remains, because four letters in 24 pixels is a smudge,
not information. The letters are drawn as paths, not set in a font — including a 3×5 pixel alphabet for the
48 px size — so the output is identical on every machine regardless of what fonts are installed.

## On reviewing your own work

One last thing worth sharing. Design work has a failure mode: you stare at an icon for an hour, and you stop
seeing it. I leaned on a mechanical loop instead. Every icon got rendered to a contact sheet at 16, 24, 48
and 128 px, on light, dark and a busy wallpaper, and then reviewed against the written design rules —
largely with Claude Code acting as a pixel-level critic, with a verdict of SHIP or a numbered list of fixes.

It caught things I'd stopped seeing: an app icon that read as a rubbish bin instead of a parcel, a speaker
that looked like a cocoon, a microphone that looked half-broken because it was half-filled, a "frosted"
panel that still showed the hard edge of the shape behind it. The written rules mattered more than the
tooling: once "two shapes and a symbol, palette colours only, whole pixels at small sizes" was written down,
disagreements became checkable instead of matters of taste.

## Try it

```sh
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh
# with the developer file-type fixes:
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh -s -- --mime
```

Then pick Frost in GNOME Tweaks → Appearance → Icons. It never switches your theme for you, and
`--uninstall` puts everything back.

- Source and icon requests: [github.com/thissayantan/frost-icon-theme](https://github.com/thissayantan/frost-icon-theme)
- Store page: [gnome-look.org/p/2372226](https://www.gnome-look.org/p/2372226/)

It's MIT, artwork included. If you want to fork it and make a blue-on-black version called Permafrost, go
ahead.

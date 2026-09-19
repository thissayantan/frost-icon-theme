---
title: "Linux deserves nicer icons, so I made some"
published: false
description: "Frost is a free, open-source frosted-glass icon theme for Linux. Your project folders show their stack, your file types say what they are, and it takes one line to try."
tags: linux, opensource, design, productivity
cover_image: https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/dev-hero.png
---

![Frost: project folders showing their stack, and file icons that say what they are](https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/dev-hero.png)

Look at your Linux desktop for a second. The Home folder icon. The file manager in your dock. The row of
folders in your Documents.

They're fine. They're also dull. Flat, muddy, a bit sad, clearly not something anyone enjoyed making. And
once you notice it you can't stop noticing it, because these are the icons you look at more than any others,
all day.

I went looking for a replacement on gnome-look.org and came away frustrated. Lots of packs cover a handful of
icons and leave the rest mismatched. Lots look great in the showcase screenshot and fall apart in an actual
file list. Almost none of them felt like someone had thought about how you actually use a desktop.

I wanted something clean, simple and genuinely usable. I couldn't find it, so I made it.

**[Frost](https://github.com/thissayantan/frost-icon-theme)** is a frosted-glass icon theme for Linux. It's
free, MIT licensed, one line to install and one line to remove.

```sh
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh
```

## What it actually looks like

Every icon is the same idea: a vivid colour seen through a soft pane of frosted glass, with one crisp white
symbol on top. Nothing fussy, nothing 3D, no fake screens with bezels.

![Before: Ubuntu's default icons. After: Frost](https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/before-after.png)

Left is the stock set. Right is Frost. Same folder, same files.

## Your project folders show what's in them

This is the part I use most. Frost can tag your project folders with the stack they actually
contain, the framework, the runtime, the platform, so you can see what a project is without opening it.

![Project folders showing Next + Bun + TypeScript, Docker + Go, Docker + Python and Flutter](https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/project-folders.png)

It reads the project itself: a `package.json` with Next and TypeScript and a `bun.lock` gets Next, Bun and
TS. A `go.mod` next to a `Dockerfile` gets Go and Docker. A `pubspec.yaml` gets Flutter. One command tags
everything under your code directory, and `--undo` removes it.

```sh
bun run tag-folders          # tag your project folders
bun run tag-folders --undo   # put them back
```

The marks are fetched on your machine from [Simple Icons](https://simpleicons.org) (public domain), so the
theme itself ships no trademarked logos.

## Your files say what they are

Out of the box, every JSON file in your project looks like a terminal. Your lock file, your Markdown notes
and your TLS certificate all look like the same grey page.

Frost draws 134 file types. Colour tells you the kind: yellow for data and keys, teal for code, blue for
documents, orange for archives. The symbol tells you the family: `{ }` for JSON, `M↓` for Markdown, a padlock
for lock files, a rosette for certificates, stacked crates for a Dockerfile. And from 48 px up, a small label
spells out the exact type.

![All 134 file types in Frost](https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/preview-filetypes.png)

There's a catch that isn't Frost's fault, and it's my favourite thing I learned building this. Icons come
from file types, and Linux's file types are, in places, wrong:

- `.ts` is treated as a **Qt translation file**, not TypeScript
- `.tsx` is a **Tiled tileset** (a 2D game map format)
- `go.mod` is **tracker music** from the 1980s
- `.tf` and `go.sum` are **to-do lists**
- `.key` is **Keynote**, even when the file begins `-----BEGIN PRIVATE KEY-----`
- `bun.lock`, `.env`, `Dockerfile` and `.gitignore` are just **plain text**

Nobody's to blame here. `.ts` meant Qt translations long before TypeScript existed. But no icon theme can fix
it alone. If your system says `go.mod` is music, a prettier theme just gives you a prettier music note. So
Frost ships an optional one-file fix for your user account only (add `--mime` to the install command), and
then the icons follow.

## It still looks good when it's tiny

Most themes look great at 256 pixels and turn to mush in a file list. That's because shrinking a big icon is
not the same as drawing a small one.

![The same icons: scaled down from 128 px, next to drawn at 16 px](https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/docs/drawn-vs-scaled.png)

Left is a 128 px icon scaled down to 16. Right is Frost's hand-drawn 16 px version. Every Frost icon has its
own 16, 22 and 24 px drawing, with every edge on a whole pixel. That's where most of the work went, and it's
the difference you feel every day without being able to name it.

## Try it, and remove it in one line if you don't like it

```sh
# install (never changes your current theme)
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh

# with the file-type fixes for developer files
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh -s -- --mime

# changed your mind
sh install.sh --uninstall
```

Then pick **Frost** in GNOME Tweaks → Appearance → Icons. It never switches your theme for you.

Frost leaves brand icons alone. Firefox, Chrome and VS Code keep their own, and anything Frost hasn't drawn
falls back to [Papirus](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme), so nothing ends up
blank.

- **Source, one-line install, icon requests:** [github.com/thissayantan/frost-icon-theme](https://github.com/thissayantan/frost-icon-theme)
- **Store page:** [gnome-look.org/p/2372226](https://www.gnome-look.org/p/2372226/)

It's MIT, artwork included. Use it, fork it, repaint it, ship it in your distro. If it makes your desktop
nicer to look at, a star on the repo is the only thanks I'm after. If an icon you use is missing, open an
issue and I'll draw it.

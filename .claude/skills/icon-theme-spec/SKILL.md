---
name: icon-theme-spec
description: Use when deciding icon names, directory layout, index.theme contents, aliases, inheritance or cache behaviour for Frost, or when an icon "doesn't show up" in an app. Freedesktop icon theme + naming spec, applied.
---

# Icon theme mechanics (what actually matters)

## Lookup order
App asks for a **name** → GTK searches the active theme → its `Inherits=` chain → `hicolor`.
Within one theme the closest **size** wins before parents are consulted — so an icon shipped only
at 128 will be *scaled* at 16 instead of inherited. Ship every size (the build does).

## Finding the right name
- Standard names: https://specifications.freedesktop.org/icon-naming/latest/ (places, mimetypes, devices…).
- App names: the `Icon=` line of its `.desktop` file. Search all of:
  `/usr/share/applications`, `~/.local/share/applications`,
  `/var/lib/flatpak/exports/share/applications`, `/var/lib/snapd/desktop/applications`.
  (`tools/inventory.ts` does this.)
- Mimetype icons: `application/pdf` → `application-pdf`; generic fallback via `generic-icon` in
  `/usr/share/mime/packages/*.xml` (e.g. `x-office-document`).
- Files/Nautilus asks for `folder`, `folder-<special>` (`folder-documents`, `folder-download`, …),
  `user-home`, `user-desktop`, `user-trash`, `inode-directory`.

## index.theme
Every directory must appear in `Directories=` (and `@2x` ones also in `ScaledDirectories=`) with a
section giving `Size`, optional `Scale`, `Context`, `Type`. Unlisted directories are ignored silently.
Frost uses `Type=Fixed` everywhere (PNG, ADR-001).

## Cache
`gtk-update-icon-cache -f -t <theme>` after every install. "The generated cache was invalid" =
a filename with spaces/non-ASCII, or a broken symlink. Fix the file, never ship without a cache.

## Proving it works
`python3 tools/lookup.py Frost folder user-home application-pdf` prints the file GTK would
load for each name at several sizes. Anything resolving outside `Frost/` is inherited — expected
only for names we don't ship.

## Don'ts
- Don't ship `*-symbolic` icons.
- Don't modify system themes in `/usr/share/icons`.
- Don't activate the theme on the owner's desktop unless asked (their active theme is `Folio`).

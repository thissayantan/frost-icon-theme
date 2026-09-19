# gnome-look.org listing
- **Category:** Icon Themes → Full Icon Themes
- **Title:** Frost — frosted-glass icon theme
- **License:** MIT
- **Tags:** icons, gnome, glass, glassmorphism, frosted, gtk, papirus, pastel, developer, mimetypes
- **Link:** https://github.com/thissayantan/frost-icon-theme
- **File:** Frost-v0.2.0.tar.xz (from the GitHub release)

## Description
A clean, minimal frosted-glass icon theme: every icon is a vivid colour seen through a soft pane of frosted
glass, with a crisp white symbol on top. Hand-hinted on the pixel grid at 16/22/24 px, HiDPI @2x included.

**What's in it**
- Folders & places — Home, Documents, Downloads, Music, Pictures, Videos, Templates, Public, Desktop, Trash…
- 31 core apps — Files, Settings, Terminal, Text Editor, Calculator, Disks, Logs, Screenshot, System Monitor…
- **134 file types that say what they are** — JSON `{ }`, Markdown `M↓`, lock files 🔒, certificates, keys,
  YAML/TOML config, Dockerfiles, SQL, source code, office files, archives, installers, disk images, AppImages.
  Colour tells the kind; from 48 px a short label (JSON, MD, PEM, GO…) tells the exact type.
- Top-bar status icons — Wi-Fi, VPN, Bluetooth, volume, mic (orange while in use), battery, night light.
- Optional MIME add-on for developers: real types for bun.lock, .env, Dockerfile, .gitignore, TypeScript, go.mod.

No brand logos are redrawn — Firefox, Chrome, VS Code… keep their own icons. Everything Frost doesn't draw falls
back to **Papirus** (recommended) → Adwaita.

**Install**
```
curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh
```
or extract the archive and copy the `Frost` folder to `~/.local/share/icons/`. Then GNOME Tweaks → Appearance →
Icons → Frost. Add `--mime` (`… | sh -s -- --mime`) for the developer file-type fixes.

Tested on GNOME 50 / Ubuntu 26.04. Icon requests and bug reports: GitHub issues.

## Changelog (v0.2.0)
First public release: file-type family (134 types), 31 apps, top-bar status icons, MIME add-on, install.sh. MIT.

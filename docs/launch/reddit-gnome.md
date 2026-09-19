# r/gnome
**Title:** Frost: a frosted-glass icon theme for GNOME 50 (folders, apps, 134 file types, top-bar status icons)

**Body:**
I've been building an icon theme that stays consistent with GNOME's look but adds a soft frosted-glass depth.
Some things I cared about:
- File types that say what they are — JSON, Markdown, lock files, certificates, Dockerfiles, YAML… each has its
  own symbol, and from 48 px a small type label.
- Top-bar status icons redrawn on the pixel grid (volume, mic that turns orange while in use, battery marks),
  still symbolic so the shell recolours them.
- No brand logos; Papirus is the fallback for everything I haven't drawn.
- An optional per-user MIME add-on: GNOME types `.ts` as a Qt translation file and `go.mod` as a music module 🙂

Before/after vs Yaru and install one-liner in the README: https://github.com/thissayantan/frost-icon-theme
MIT licensed. Feedback and icon requests very welcome.

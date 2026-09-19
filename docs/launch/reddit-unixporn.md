# r/unixporn
Check the current sidebar rules before posting (title tag format, "details" comment required, one post per week).
**Needs:** the owner's own full-desktop screenshot (GNOME, Frost active, a Files window open on a project folder).

**Title:** [GNOME] Frost — I made a frosted-glass icon theme where file types actually say what they are

**Details comment:**
- **Icons:** Frost (my own, MIT) — https://github.com/thissayantan/frost-icon-theme
- **DE:** GNOME 50 on Ubuntu 26.04 · **GTK theme:** default Adwaita · **Font:** Ubuntu Sans
- **Wallpaper:** <owner fills in>
- Every file type has its own glass symbol + a small type label from 48 px (JSON, MD, PEM, LOCK…); there's an
  optional MIME add-on that fixes GNOME typing `bun.lock`/`.env`/Dockerfiles as plain text.
- Brand apps keep their own icons (no redrawn logos); everything else falls back to Papirus.
- Install: `curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh`

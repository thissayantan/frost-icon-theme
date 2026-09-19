# X thread (final wording, staged in the composer on 2026-09-20)

Status: **not posted.** X refused with "You have reached your daily limit for this action. Please add a
phone to your account to remove the limit." Saving it to Drafts then failed with "The content of your post
is invalid." The thread is still sitting in the composer at https://x.com/compose/post — press **Post all**
once the limit clears, or paste the six posts below.

Images: 1 `docs/dev-hero.png` · 2 `docs/project-folders.png` · 3 `docs/file-types.png` ·
5 `docs/drawn-vs-scaled.png` · 6 `docs/before-after.png`. Post 4 has no image.

---

**1/6** — image: docs/dev-hero.png

Linux desktop icons are dull. The Home folder, the file manager, every folder in Documents. Flat and sad.

So I drew a whole icon theme. Frosted glass, free, MIT.

---

**2/6** — image: docs/project-folders.png

The bit I use every day: project folders show their stack.

Next + Bun + TypeScript. Docker + Go. Flutter. It reads the project and marks the folder, so you can see
what something is without opening it.

---

**3/6** — image: docs/file-types.png

134 file types that say what they are.

Colour = the kind. Symbol = the family ({ } for JSON, M for markdown, a padlock for lock files, a rosette
for certs). From 48 px, a small label spells out the exact type.

---

**4/6** — no image

While mapping types I found out what Linux actually thinks your files are:

.ts is a Qt translation file
.tsx is a game tileset
go.mod is tracker music
.key is Keynote, even when it starts with BEGIN PRIVATE KEY

Frost ships an optional one file fix.

---

**5/6** — image: docs/drawn-vs-scaled.png

Left: a 128 px icon scaled down to 16. Right: drawn at 16.

Every icon has its own 16, 22 and 24 px drawing on the pixel grid. That is why it still looks good in a
file list.

---

**6/6** — image: docs/before-after.png

One line to install, one line to remove, and it never switches your theme for you:

curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh

MIT, artwork included: github.com/thissayantan/frost-icon-theme

#Linux #OpenSource

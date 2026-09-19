# X thread. Image on 1, 2, 3, 5; repo link in the last post

**1/6** — image: docs/dev-hero.png
Linux desktop icons are dull. The Home folder, the file manager, every folder in Documents. Flat and sad.

So I drew a whole icon theme. Frosted glass, free, MIT.

**2/6** — image: docs/project-folders.png
The bit I use every day: project folders show their stack.

Next + Bun + TypeScript. Docker + Go. Flutter. It reads the project and marks the folder, so you can see what
something is without opening it.

**3/6** — image: docs/preview-filetypes.png
134 file types that say what they are.

Colour = the kind. Symbol = the family ({ } JSON, M↓ markdown, padlock for lock files, rosette for certs).
From 48 px, a small label spells out the exact type.

**4/6**
While mapping types I found what Linux actually thinks your files are:

· .ts → a Qt translation file
· .tsx → a game tileset
· go.mod → tracker music
· .key → Keynote, even when it starts with BEGIN PRIVATE KEY

Frost ships an optional one-file fix.

**5/6** — image: docs/drawn-vs-scaled.png
Left: a 128 px icon scaled down to 16. Right: drawn at 16.

Every icon has its own 16, 22 and 24 px drawing on the pixel grid. It's why it still looks good in a file
list.

**6/6**
One line to install, one line to remove, never switches your theme for you:

curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh

MIT, artwork included: github.com/thissayantan/frost-icon-theme
#Linux #OpenSource

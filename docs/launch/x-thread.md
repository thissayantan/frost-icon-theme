# X / Twitter thread (attach images as noted)

**1/7** — attach `docs/before-after.png`
I got tired of every JSON file in my file manager looking like a terminal, so I drew a whole icon theme.

Frost: frosted glass, 134 file types that actually say what they are, MIT.

github.com/thissayantan/frost-icon-theme

**2/7** — attach `docs/preview-filetypes.png`
Colour tells you the kind of file. The symbol tells you the family: `{ }` data, `M↓` markdown, a padlock for
lock files, a rosette for certificates, crates for Dockerfiles.

From 48 px up, a small label spells out the exact type: JSON, MD, PEM, GO.

**3/7** — attach a 16 px zoom (`dist/preview/mtz.png`)
Small sizes aren't scaled down, they're drawn.

Every icon has a hand-made 16, 22 and 24 px version on the pixel grid. Scaling a 128 px icon down to 16 gives
you grey mush; a 16 px icon drawn as 16 pixels stays sharp.

**4/7**
Then the fun part. While mapping file types I found what Linux actually thinks your files are:

· `.ts` → a Qt translation file
· `.tsx` → a Tiled tileset
· `go.mod` → tracker music (audio/x-mod)
· `.tf` → a to-do list
· `.key` → Keynote, even when it starts with BEGIN PRIVATE KEY

**5/7**
So Frost ships an optional per-user MIME add-on. One file, reversible, no root:

lock files, .env, Dockerfile, .gitignore, TypeScript, PEM keys and go.mod all get real types — and therefore
real icons.

**6/7** — attach `docs/hero.png`
The glass is baked, not live. GTK can't be trusted to render SVG filters, so a small Bun + resvg pipeline
renders every icon to PNG at 9 sizes × @1x/@2x, and `verify` runs a real GTK lookup so every shipped name is
proven to resolve.

**7/7**
Install in one line:

curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh

MIT. Icon requests welcome.
gnome-look.org/p/2372226
#Linux #GNOME #OpenSource

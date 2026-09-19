# LinkedIn (article + feed post). Lead with docs/dev-hero.png.

## Article title
Linux deserves nicer icons, so I made some

## Article body (images inline, then link out)
[IMAGE: docs/dev-hero.png]

Look at a Linux desktop for a second. The Home folder. The file manager in the dock. A row of folders in
Documents. They're fine, and they're dull. Flat, muddy, clearly nobody's favourite piece of work. These are the
icons you look at more than any others, all day.

I went looking for a replacement and came away frustrated: packs that cover a handful of icons and leave the
rest mismatched, packs that look great in a showcase screenshot and fall apart in an actual file list.

So I built my own, and made it free and open source.

**Frost** is a frosted-glass icon theme for Linux. Every icon is the same idea: a vivid colour seen through a
soft pane of frosted glass, with one crisp white symbol on top.

[IMAGE: docs/before-after.png]

Two things make it more than a paint job, both aimed at people who work in folders all day:

**Your project folders show their stack.** Frost reads each project and marks the folder with what's actually
inside (Next + Bun + TypeScript, Docker + Go, Flutter), so you can see what a project is without opening it.

[IMAGE: docs/project-folders.png]

**Your files say what they are.** 134 file types, each with its own symbol and colour, and a small type label
from 48 px up. JSON stops looking like a terminal; your lock file, your notes and your certificate stop
looking identical.

[IMAGE: docs/preview-filetypes.png]

One detail I didn't expect to find: Linux's own file types are wrong in places. `.ts` is registered as a Qt
translation file, `go.mod` as tracker music from the 1980s, `.key` as Keynote even when the file plainly says
BEGIN PRIVATE KEY. No icon theme can fix that alone, so Frost ships an optional one-file fix for your user
account.

It's MIT licensed, one line to install, one line to remove, and it never switches your theme for you. If it
makes your desktop nicer, a star on the repo is the only thanks I'm after.

Install and source: https://github.com/thissayantan/frost-icon-theme
Full write-up: <article URL>

#Linux #OpenSource #GNOME #Design #DeveloperTools

## Feed post (links to the article)
[IMAGE: docs/dev-hero.png]

Linux desktop icons are dull. So I spent a few weeks drawing a better set and made it free.

Frost is a frosted-glass icon theme where your project folders show their stack (Next + Bun + TS, Docker + Go,
Flutter) and 134 file types actually say what they are. One line to install, one line to remove, MIT licensed.

I also found out along the way that Linux thinks go.mod is tracker music and .key is a Keynote file. Frost
ships an optional fix for that too.

Article: <article URL>
Code: https://github.com/thissayantan/frost-icon-theme

#Linux #OpenSource #DeveloperTools #Design

# LinkedIn post (attach docs/before-after.png; add the article link in the first comment)

Every JSON file in my file manager looked like a terminal. Every lock file, every Markdown note and every TLS
certificate looked like the same grey page. So I drew an icon theme — and found something more interesting
than icons.

**Frost** is now open source (MIT): a frosted-glass icon theme for Linux, with 134 file types that say what
they are. https://github.com/thissayantan/frost-icon-theme

Three things I took away from it:

**1. Small sizes have to be drawn, not scaled.**
A file manager shows icons at 16 pixels. Shrinking a beautiful 128 px icon to 16 px turns crisp lines into
grey mush, because a 1.5-pixel line has nowhere to land. Every Frost icon carries hand-drawn 16, 22 and 24 px
versions, with every edge on a whole pixel. Most of the work was there, not in the big showpiece sizes.

**2. Your computer is often wrong about your files, and no theme can fix that.**
While mapping file types I checked what Linux actually thinks a developer's folder contains:
· `.ts` → a Qt translation file
· `.tsx` → a game tileset
· `go.mod` → tracker music from the 1980s
· `.tf` and `go.sum` → to-do lists
· `.key` → Keynote, even when the file plainly begins "BEGIN PRIVATE KEY"
· lock files, `.env`, Dockerfiles → plain text, nothing more

None of it is anybody's fault: `.ts` meant Qt translations long before TypeScript, and `.mod` was music in
1987. But icons come from those types, so a prettier icon set just gives you a prettier music note. Frost
ships an optional per-user fix — one file, no root, reversible — and the icons follow.

**3. Write the rules down, then review against them.**
"Two shapes and a symbol, palette colours only, whole pixels at small sizes." Once that was written, reviews
stopped being about taste and became checkable. I ran every icon through a rendered contact sheet at four
sizes on light, dark and busy backgrounds, and used an AI critic loop against those written rules. It caught
an app icon that read as a rubbish bin instead of a parcel, and a microphone that looked half-broken because
it was half-filled.

The same idea applies well beyond icons: the constraint you write down is the one you can actually hold
yourself to.

Frost is MIT licensed, artwork included. Install is one line, and it never switches your theme for you.

#Linux #OpenSource #GNOME #DesignSystems #SoftwareEngineering

---
**First comment:** Longer write-up, including the full list of mis-typed files and how the rendering pipeline
bakes the glass into PNGs: <article URL once published>

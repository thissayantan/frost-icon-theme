# Show HN
**Title (≤ 80 chars):** Show HN: Frost – a frosted-glass Linux icon theme with file types that say what they are
**URL:** https://github.com/thissayantan/frost-icon-theme

**First comment (post right after submitting):**
Hi HN — Frost is an icon theme for GNOME/GTK (works in Qt apps too). A few things that might be interesting
beyond "pretty icons":

- The glass (blur + gradients) is drawn with SVG filters, but GTK can't be trusted to render filters, so a
  small Bun + resvg pipeline bakes every icon to PNG at 9 sizes × @1x/@2x, and swaps in hand-drawn pixel-grid
  versions at 16/22/24 px.
- `verify` runs a *real* GTK icon lookup (PyGObject) against the build, so every shipped name is proven to
  resolve — including GTK4's lack of name-part fallback, which bites mimetypes.
- File types are generated from two tables (31 categories × 134 GIO icon names) instead of 134 hand-edited SVGs.
- While doing this I found GNOME/shared-mime-info types `.ts` as Qt Linguist, `.tsx` as a Tiled tileset,
  `go.mod` as a tracker-music module and `.tf` as a todo.txt list. There's an optional per-user MIME add-on.
- A lot of the review loop (pixel-level critique of every icon) was done with Claude Code acting as a critic.

MIT licensed. Happy to answer questions about the pipeline or the design rules.

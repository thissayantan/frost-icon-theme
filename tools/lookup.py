#!/usr/bin/env python3
"""Ask real GTK 4 which file it would load for icon names in a given theme.

Usage: python3 tools/lookup.py <theme> <icon-name> [<icon-name> ...] [--sizes 16,24,48,128]
                              [--search-path DIR] [--json]

--search-path DIR prepends DIR to GTK's icon search path (e.g. dist/ to test a build before install).

Exit code 1 if any name resolves to nothing. Names resolving outside the theme's own
directory are reported as "inherited" (expected only for icons Hyaline doesn't ship).
"""
import json
import sys

import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gtk  # noqa: E402


def main() -> int:
    argv = sys.argv[1:]
    opts = {}
    for key in ("--sizes", "--search-path"):
        if key in argv:
            i = argv.index(key)
            opts[key] = argv[i + 1]
            del argv[i : i + 2]
    args = [a for a in argv if not a.startswith("--")]
    sizes = [int(s) for s in opts.get("--sizes", "16,24,48,128").split(",")]
    as_json = "--json" in sys.argv
    if len(args) < 2:
        print(__doc__)
        return 2
    theme_name, names = args[0], args[1:]

    Gtk.init()
    theme = Gtk.IconTheme.new()
    if "--search-path" in opts:
        theme.set_search_path([opts["--search-path"], *theme.get_search_path()])
    theme.set_theme_name(theme_name)

    results, missing = [], False
    for name in names:
        for size in sizes:
            for scale in (1, 2):
                paintable = theme.lookup_icon(name, None, size, scale, Gtk.TextDirection.NONE, 0)
                f = paintable.get_file()
                path = f.get_path() if f else None
                own = bool(path) and f"/{theme_name}/" in path
                if not path or path.endswith("image-missing.svg"):
                    missing = True
                results.append({"name": name, "size": size, "scale": scale, "path": path, "own": own})

    if as_json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            tag = "own      " if r["own"] else ("MISSING  " if not r["path"] else "inherited")
            print(f"{tag} {r['name']:28} {r['size']:>3}@{r['scale']}x  {r['path']}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Ask plain Qt (QIcon.fromTheme, as non-KDE Qt apps do) whether it finds each name in Frost, at @1x and @2x.

Run through uv so nothing is installed system-wide:
  QT_QPA_PLATFORM=offscreen uv run -q --with PySide6-Essentials python tools/qtlookup.py DIST NAME...
Prints JSON [{name, found, sizes}] — found = Qt resolved the name inside DIST (no other theme is on the path).
"""
import json
import sys

from PySide6.QtCore import QSize
from PySide6.QtGui import QGuiApplication, QIcon

app = QGuiApplication(sys.argv[:1])
dist, names = sys.argv[1], sys.argv[2:] or sys.stdin.read().split()
QIcon.setThemeSearchPaths([dist])
QIcon.setFallbackSearchPaths([])
QIcon.setThemeName("Frost")
out = []
for n in names:
    icon = QIcon.fromTheme(n)
    ok = not icon.isNull() and not icon.pixmap(QSize(16, 16), 1.0).isNull() and not icon.pixmap(QSize(48, 48), 2.0).isNull()
    out.append({"name": n, "found": ok, "sizes": sorted({s.width() for s in icon.availableSizes()})})
print(json.dumps(out))

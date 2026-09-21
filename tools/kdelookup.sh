#!/bin/sh
# Ask real KDE (KIconLoader, via kiconfinder6 in the org.kde.Platform flatpak runtime) which file it loads for
# each name, with Frost as the icon theme and dist/ as the only extra data dir. Prints "name<TAB>path" lines.
# Usage: sh tools/kdelookup.sh NAME... (names also read from stdin when none are given)
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
RUNTIME=${KDE_RUNTIME:-org.kde.Platform//6.10}
CFG="$ROOT/dist/.kcfg"   # inside dist/: flatpak can't see /tmp or /var/tmp of the host
mkdir -p "$CFG/share/icons"
printf '[Icons]\nTheme=Frost\n' > "$CFG/kdeglobals"
ln -sfn ../../../Frost "$CFG/share/icons/Frost"
if [ $# -eq 0 ]; then set -- $(cat); fi
flatpak run --command=sh --filesystem="$ROOT/dist:ro" --env=QT_QPA_PLATFORM=offscreen \
  --env=XDG_CONFIG_HOME="$CFG" --env=XDG_DATA_DIRS="$CFG/share:/app/share:/usr/share" "$RUNTIME" \
  -c 'for n in "$@"; do printf "%s\t%s\n" "$n" "$(kiconfinder6 "$n" 2>/dev/null)"; done' sh "$@"

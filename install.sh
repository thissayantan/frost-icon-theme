#!/bin/sh
# Frost icon theme installer — https://github.com/thissayantan/frost-icon-theme (MIT)
#
#   curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh
#   sh install.sh [--mime] [--system] [--version vX.Y.Z] [--from DIR] [--uninstall]
#
#   (default)     download the latest release and install to ~/.local/share/icons/Frost
#   --mime        also install the per-user MIME add-on (real types for lock files, .env, Dockerfiles,
#                 TypeScript, keys, go.mod…) to ~/.local/share/mime/packages/frost.xml
#   --system      install to /usr/share/icons instead (uses sudo)
#   --version V   install release V instead of the latest
#   --from DIR    install from a local directory holding Frost/ (e.g. an unpacked tarball or dist/)
#   --uninstall   remove Frost (and the MIME add-on) again
#
# It never changes your active icon theme; it prints how to switch.
set -eu

REPO="thissayantan/frost-icon-theme"
THEME="Frost"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/icons"
MIME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/mime"
SUDO=""
MODE="install"
WITH_MIME=0
VERSION=""
FROM=""

say() { printf '%s\n' "frost: $*"; }
die() { printf '%s\n' "frost: error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --mime) WITH_MIME=1 ;;
    --system) DEST="/usr/share/icons"; [ "$(id -u)" -eq 0 ] || SUDO="sudo" ;;
    --version) shift; VERSION="${1:-}"; [ -n "$VERSION" ] || die "--version needs a value" ;;
    --from) shift; FROM="${1:-}"; [ -n "$FROM" ] || die "--from needs a directory" ;;
    --uninstall) MODE="uninstall" ;;
    -h|--help) sed -n '2,15p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

refresh_cache() {
  for tool in gtk-update-icon-cache gtk4-update-icon-cache; do
    if command -v "$tool" >/dev/null 2>&1; then $SUDO "$tool" -f -t -q "$DEST/$THEME" 2>/dev/null || true; return; fi
  done
}

refresh_mime() {
  command -v update-mime-database >/dev/null 2>&1 && update-mime-database "$MIME_DIR" >/dev/null 2>&1 || true
}

if [ "$MODE" = "uninstall" ]; then
  if [ -d "$DEST/$THEME" ]; then $SUDO rm -rf "$DEST/$THEME"; say "removed $DEST/$THEME"; else say "not installed in $DEST"; fi
  if [ -f "$MIME_DIR/packages/frost.xml" ]; then rm -f "$MIME_DIR/packages/frost.xml"; refresh_mime; say "removed the MIME add-on"; fi
  say "if Frost was your icon theme, pick another: gsettings reset org.gnome.desktop.interface icon-theme"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

if [ -z "$FROM" ]; then
  command -v curl >/dev/null 2>&1 || die "curl is required"
  command -v tar >/dev/null 2>&1 || die "tar is required"
  if [ -n "$VERSION" ]; then api="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
  else api="https://api.github.com/repos/$REPO/releases/latest"; fi
  url="$(curl -fsSL "$api" | grep -o '"browser_download_url": *"[^"]*\.tar\.xz"' | head -n1 | sed 's/.*"\(https[^"]*\)"/\1/')"
  [ -n "$url" ] || die "no release tarball found at $api"
  say "downloading $url"
  curl -fsSL "$url" -o "$TMP/frost.tar.xz"
  tar -xJf "$TMP/frost.tar.xz" -C "$TMP"
  FROM="$TMP"
fi

[ -f "$FROM/$THEME/index.theme" ] || die "$FROM/$THEME/index.theme not found"
$SUDO mkdir -p "$DEST"
$SUDO rm -rf "$DEST/$THEME"
$SUDO cp -R "$FROM/$THEME" "$DEST/$THEME"
refresh_cache
say "installed to $DEST/$THEME"

if [ "$WITH_MIME" -eq 1 ]; then
  mime="$FROM/frost-mime.xml"
  [ -f "$mime" ] || mime="$(dirname "$0")/tools/mime/frost.xml"
  [ -f "$mime" ] || die "MIME add-on not found (frost-mime.xml)"
  mkdir -p "$MIME_DIR/packages"
  cp "$mime" "$MIME_DIR/packages/frost.xml"
  refresh_mime
  say "installed the MIME add-on (restart Files to see it: nautilus -q)"
fi

if [ ! -d /usr/share/icons/Papirus ] && [ ! -d "$HOME/.local/share/icons/Papirus" ]; then
  say "tip: install Papirus for the icons Frost doesn't draw (Ubuntu/Debian: sudo apt install papirus-icon-theme)"
fi
say "activate: gsettings set org.gnome.desktop.interface icon-theme '$THEME'   (or GNOME Tweaks → Appearance → Icons)"

#!/bin/sh
# Frost icon theme installer — https://github.com/thissayantan/frost-icon-theme (MIT)
#
#   curl -fsSL https://raw.githubusercontent.com/thissayantan/frost-icon-theme/main/install.sh | sh
#   sh install.sh [--mime] [--colors FILE|PRESET] [--system] [--version vX.Y.Z] [--from DIR] [--uninstall]
#
#   (default)       download the latest release and install to ~/.local/share/icons/Frost
#   --mime          also install the per-user MIME add-on (real types for lock files, .env, Dockerfiles,
#                   TypeScript, keys, go.mod…) to ~/.local/share/mime/packages/frost.xml
#   --colors X      build Frost in your own colours. X is a frost.colors.json file, a link from the colour
#                   builder (https://thissayantan.github.io/frost-icon-theme/), a URL of a JSON file, or a
#                   preset: warm, forest, ocean, pastel, mono. Needs Bun; asks before installing anything.
#   --yes           answer yes to the --colors questions (for scripts; nothing is asked otherwise)
#   --system        install to /usr/share/icons instead (uses sudo)
#   --version V     install release V instead of the latest
#   --from DIR      install from a local directory holding Frost/ (e.g. an unpacked tarball or dist/)
#   --source DIR    with --colors: build from a local Frost checkout instead of downloading the source
#   --uninstall     remove Frost (and the MIME add-on) again
#
# It never changes your active icon theme; it prints how to switch.
set -eu

REPO="thissayantan/frost-icon-theme"
THEME="Frost"
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/icons"
MIME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/mime"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/frost"
SUDO=""
MODE="install"
WITH_MIME=0
VERSION=""
FROM=""
COLORS=""
SOURCE=""
YES=0

say() { printf '%s\n' "frost: $*"; }
die() { printf '%s\n' "frost: error: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --mime) WITH_MIME=1 ;;
    --colors|--colours) shift; COLORS="${1:-}"; [ -n "$COLORS" ] || die "--colors needs a file or a preset name" ;;
    --yes|-y) YES=1 ;;
    --system) DEST="/usr/share/icons"; [ "$(id -u)" -eq 0 ] || SUDO="sudo" ;;
    --version) shift; VERSION="${1:-}"; [ -n "$VERSION" ] || die "--version needs a value" ;;
    --from) shift; FROM="${1:-}"; [ -n "$FROM" ] || die "--from needs a directory" ;;
    --source) shift; SOURCE="${1:-}"; [ -n "$SOURCE" ] || die "--source needs a directory" ;;
    --uninstall) MODE="uninstall" ;;
    -h|--help) sed -n '2,21p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
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

# Questions go to the terminal even when the script itself arrives on stdin (curl … | sh).
ask() {
  [ "$YES" -eq 1 ] && return 0
  [ -r /dev/tty ] || return 1
  printf '%s [y/N] ' "$1" > /dev/tty
  read -r answer < /dev/tty || return 1
  case "$answer" in y|Y|yes|YES|Yes) return 0 ;; *) return 1 ;; esac
}

if [ "$MODE" = "uninstall" ]; then
  if [ -d "$DEST/$THEME" ]; then $SUDO rm -rf "$DEST/$THEME"; say "removed $DEST/$THEME"; else say "not installed in $DEST"; fi
  if [ -f "$MIME_DIR/packages/frost.xml" ]; then rm -f "$MIME_DIR/packages/frost.xml"; refresh_mime; say "removed the MIME add-on"; fi
  say "if Frost was your icon theme, pick another: gsettings reset org.gnome.desktop.interface icon-theme"
  command -v bun >/dev/null 2>&1 && [ -d "$HOME/.bun" ] && say "Bun (used for custom colours) stays installed; remove it with: rm -rf ~/.bun"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# An upgrade keeps custom colours only if you say so: offer the saved config back.
if [ -z "$COLORS" ] && [ -z "$FROM" ] && [ -f "$DEST/$THEME/frost-colors.json" ]; then
  if ask "Your Frost uses custom colours ($DEST/$THEME/frost-colors.json). Re-apply them to the new version?"; then
    cp "$DEST/$THEME/frost-colors.json" "$TMP/frost-colors.json"
    COLORS="$TMP/frost-colors.json"
  else
    say "installing the standard colours (your config was: $DEST/$THEME/frost-colors.json — copy it first if you want it)"
  fi
fi

# ── custom colours: build from source with the user's config (ADR-007) ────────
if [ -n "$COLORS" ]; then
  [ -z "$FROM" ] || die "--colors builds the theme itself; it can't be combined with --from"
  command -v curl >/dev/null 2>&1 || die "curl is required"
  case "$COLORS" in
    http://*|https://*)
      code="$(printf '%s' "$COLORS" | sed -n 's/.*[?#&]c=\([A-Za-z0-9_-]*\).*/\1/p')"
      if [ -n "$code" ]; then
        # a colour-builder link carries the whole config in ?c= (URL-safe base64): decode it here, no download
        command -v base64 >/dev/null 2>&1 || die "base64 is required to read a colour-builder link"
        pad="$(printf '%s' "$code" | wc -c)"; pad=$(( (4 - pad % 4) % 4 ))
        { printf '%s' "$code" | tr '_-' '/+'; printf '%*s' "$pad" '' | tr ' ' '='; } | base64 -d > "$TMP/frost-colors.json" 2>/dev/null \
          || die "that colour-builder link is damaged — copy it again"
        KIND="your colour-builder link"
      else
        curl -fsSL "$COLORS" -o "$TMP/frost-colors.json" || die "could not download $COLORS"
        KIND="the file at $COLORS"
      fi
      # catch a wrong link now, before anything is installed (the build checks every key and colour later)
      [ "$(tr -d ' \t\r\n' < "$TMP/frost-colors.json" | cut -c1)" = "{" ] \
        || die "$COLORS didn't give a colours file (frost.colors.json). Check the link, or use the colour builder."
      COLORS="$TMP/frost-colors.json" ;;
    *)
      if [ -f "$COLORS" ]; then COLORS="$(cd "$(dirname "$COLORS")" && pwd)/$(basename "$COLORS")"; KIND="your file $COLORS"
      else KIND="the preset \"$COLORS\""; fi ;;
  esac
  command -v tar >/dev/null 2>&1 || die "tar is required"
  HAVE_BUN=0; command -v bun >/dev/null 2>&1 && HAVE_BUN=1
  [ -x "$HOME/.bun/bin/bun" ] && { HAVE_BUN=1; PATH="$HOME/.bun/bin:$PATH"; }
  if [ "$HAVE_BUN" -eq 0 ]; then command -v unzip >/dev/null 2>&1 || die "unzip is required to install Bun (Ubuntu/Debian: sudo apt install unzip)"; fi

  cat <<EOF

  Frost with custom colours
  ─────────────────────────
  Colours come from $KIND.
  Frost ships ready-made pictures, so a new colour means drawing the icons again on this computer:

    1. download the Frost source code (about 10 MB) into $CACHE
EOF
  if [ "$HAVE_BUN" -eq 0 ]; then cat <<EOF
    2. install Bun, the JavaScript runtime the build uses, with its official installer
       (curl -fsSL https://bun.sh/install | bash). It goes to ~/.bun and may add a PATH line
       to your shell profile. Remove it any time with: rm -rf ~/.bun
EOF
  else printf "%s\n" "    2. Bun is already installed — nothing to add"; fi
  cat <<EOF
    3. download the build's own libraries (about 85 MB, inside that folder only)
    4. draw every icon in your colours (1–3 minutes)
    5. install the result to $DEST/$THEME, replacing any Frost that is there
       (your colour file is kept inside it, so an upgrade can re-apply it)

  Nothing else on your system changes, and no sudo is needed (unless you used --system).
  The build folder is deleted at the end.

EOF
  if ! ask "Continue?"; then
    [ -r /dev/tty ] || say "no terminal to ask on — re-run with --yes to agree up front"
    say "nothing was changed"; exit 1
  fi

  if [ "$HAVE_BUN" -eq 0 ]; then
    say "installing Bun (official installer)"
    curl -fsSL https://bun.sh/install | bash >"$TMP/bun-install.log" 2>&1 || { cat "$TMP/bun-install.log" >&2; die "Bun install failed"; }
    PATH="$HOME/.bun/bin:$PATH"
  fi
  command -v bun >/dev/null 2>&1 || die "bun not found after installing it"

  mkdir -p "$CACHE"
  BUILD="$(mktemp -d "$CACHE/build-XXXXXX")"
  trap 'rm -rf "$TMP" "$BUILD"' EXIT INT TERM
  if [ -n "$SOURCE" ]; then
    [ -f "$SOURCE/tools/build.ts" ] || die "$SOURCE is not a Frost checkout"
    say "using the source in $SOURCE"
    (cd "$SOURCE" && tar --exclude=./node_modules --exclude=./dist --exclude=./.git -cf - .) | tar -xf - -C "$BUILD"
  else
    if [ -z "$VERSION" ]; then
      VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -o '"tag_name": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
      [ -n "$VERSION" ] || die "could not find the latest release"
    fi
    say "downloading the Frost $VERSION source"
    curl -fsSL "https://github.com/$REPO/archive/refs/tags/$VERSION.tar.gz" | tar -xz -C "$BUILD" --strip-components=1 \
      || die "could not download the source for $VERSION"
    [ -f "$BUILD/tools/colors.ts" ] || die "Frost $VERSION predates custom colours — use a newer --version"
  fi
  if [ ! -f "$COLORS" ]; then
    [ -f "$BUILD/presets/$COLORS.json" ] || die "no file or preset called \"$COLORS\" (presets: $(ls "$BUILD/presets" | sed 's/\.json$//' | tr '\n' ' '))"
    COLORS="$BUILD/presets/$COLORS.json"
  fi
  say "installing the build's libraries"
  (cd "$BUILD" && bun install --frozen-lockfile >/dev/null 2>&1) || (cd "$BUILD" && bun install) || die "bun install failed"
  say "drawing the icons in your colours"
  (cd "$BUILD" && bun tools/build.ts --colors "$COLORS") || die "the build failed (see the message above)"
  cp "$BUILD/tools/mime/frost.xml" "$BUILD/dist/frost-mime.xml"
  FROM="$BUILD/dist"
fi

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
rm -f "$HOME/.cache/icon-cache.kcache" 2>/dev/null || true   # KDE's own icon cache, rebuilt on next start
say "installed to $DEST/$THEME${COLORS:+ (custom colours)}"

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
case "${XDG_CURRENT_DESKTOP:-}" in
  *KDE*) say "activate: System Settings → Colours & Themes → Icons → Frost   (or: plasma-changeicons $THEME)" ;;
  *COSMIC*) say "activate: Settings → Desktop → Appearance → Icons → Frost" ;;
  *) say "activate: gsettings set org.gnome.desktop.interface icon-theme '$THEME'   (or GNOME Tweaks → Appearance → Icons)" ;;
esac

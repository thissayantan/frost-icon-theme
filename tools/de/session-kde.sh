#!/bin/sh
# Inside the Plasma container: a virtual kwin_wayland with a Plasma panel; opens Dolphin and System Settings and
# screenshots each scene to /out. The theme is bind-mounted read-only at ~/.local/share/icons/Frost.
set -u
# KWin runs as a window on a virtual X display; ImageMagick grabs that display (spectacle needs a real session).
shot() { sleep "$2"; import -display :99 -window root "/out/$1.png" 2>/dev/null && echo "shot $1" || echo "shot $1 FAILED"; }
if [ "${1:-}" != inner ]; then
  export XDG_RUNTIME_DIR=/tmp/xdg; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
  mkdir -p ~/.config
  printf '[Icons]\nTheme=%s\n' "${THEME:-Frost}" > ~/.config/kdeglobals
  exec dbus-run-session sh "$0" inner
fi
pipewire >/dev/null 2>&1 & sleep 1; wireplumber >/dev/null 2>&1 & pipewire-pulse >/dev/null 2>&1 &
Xvfb :99 -screen 0 1440x900x24 >/dev/null 2>&1 & sleep 2
DISPLAY=:99 kwin_wayland --x11-display :99 --no-lockscreen --width 1440 --height 900 >/tmp/kwin.log 2>&1 &
sleep 6
export WAYLAND_DISPLAY=wayland-0 QT_QPA_PLATFORM=wayland
# services D-Bus starts on demand (activity manager, kded) need the display too, or plasmashell waits forever
dbus-update-activation-environment WAYLAND_DISPLAY QT_QPA_PLATFORM XDG_RUNTIME_DIR DISPLAY=:99
plasma-apply-colorscheme "${SCHEME:-BreezeDark}" >/tmp/scheme.log 2>&1 || echo "colour scheme: $(tail -1 /tmp/scheme.log)"
# a Home worth looking at: special folders and a small project
mkdir -p ~/Desktop ~/Documents ~/Downloads ~/Music ~/Pictures ~/Videos ~/Templates ~/Public ~/project
( cd ~/project && touch package.json README.md bun.lock .env Dockerfile main.go notes.txt photo.png song.mp3 clip.mp4 archive.zip key.pem )
plasmashell --no-respawn >/tmp/plasma.log 2>&1 &
shot desktop 45
dolphin --new-window "$HOME" >/dev/null 2>&1 & shot dolphin 10; pkill dolphin; sleep 1
systemsettings kcm_icons >/dev/null 2>&1 & shot settings 12; pkill systemsettings; sleep 1
dolphin --new-window "$HOME/project" >/dev/null 2>&1 & shot project 10; pkill dolphin; sleep 1
echo "--- kwin"; grep -iE 'error|fail|abort' /tmp/kwin.log | tail -5; echo "--- plasma"; grep -ivE 'qml.*warning|binding loop' /tmp/plasma.log | tail -25

#!/bin/sh
# Inside the COSMIC container: cosmic-comp as a window on a virtual X display, the panel, then COSMIC Files;
# ImageMagick grabs the display. The theme is bind-mounted read-only at ~/.local/share/icons/Frost.
set -u
shot() { sleep "$2"; import -display :99 -window root "/out/$1.png" 2>/dev/null && echo "shot $1" || echo "shot $1 FAILED"; }
if [ "${1:-}" != inner ]; then
  export XDG_RUNTIME_DIR=/tmp/xdg; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
  d=~/.config/cosmic/com.system76.CosmicTk/v1; mkdir -p "$d"; printf '"%s"' "${THEME:-Frost}" > "$d/icon_theme"
  d=~/.config/cosmic/com.system76.CosmicTheme.Mode/v1; mkdir -p "$d"
  [ "${MODE:-dark}" = light ] && echo false > "$d/is_dark" || echo true > "$d/is_dark"
  exec dbus-run-session sh "$0" inner
fi
Xvfb :99 -screen 0 1440x900x24 >/dev/null 2>&1 & sleep 2
DISPLAY=:99 cosmic-comp >/tmp/comp.log 2>&1 &
sleep 8
export WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR" | grep -m1 '^wayland-[0-9]*$')
echo "wayland: $WAYLAND_DISPLAY"
cosmic-settings-daemon >/dev/null 2>&1 &   # needs the compositor; light mode is not applied yet (dark only)
cosmic-panel >/tmp/panel.log 2>&1 &
shot panel 15
mkdir -p ~/Documents ~/Downloads ~/Music ~/Pictures ~/Videos ~/project && cd ~/project && touch package.json README.md bun.lock .env Dockerfile main.go notes.txt photo.png song.mp3 clip.mp4 archive.zip && cd
cosmic-files "$HOME/project" >/tmp/files.log 2>&1 & shot files 12
[ -f /out/panel.png ] || { echo "--- comp"; tail -20 /tmp/comp.log; echo "--- panel"; tail -10 /tmp/panel.log; }

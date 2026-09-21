#!/bin/sh
# Look at Frost in real desktops without installing them: [SCALE=2] tools/de/run.sh kde [light|dark]
# Builds the image once (tools/de/<de>.Dockerfile), mounts dist/Frost read-only, writes PNGs to dist/preview/de/.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DE=${1:-kde}; MODE=${2:-dark}
case "$DE" in kde) IMG=frost-test-plasma; FILE=plasma.Dockerfile ;; cosmic) IMG=frost-test-cosmic; FILE=cosmic.Dockerfile ;; *) echo "usage: $0 kde|cosmic [light|dark]"; exit 2 ;; esac
docker image inspect "$IMG" >/dev/null 2>&1 || docker build -t "$IMG" -f "$ROOT/tools/de/$FILE" "$ROOT/tools/de"
OUT="$ROOT/dist/preview/de/$DE-$MODE"; mkdir -p "$OUT"; chmod 777 "$OUT"
[ "$MODE" = light ] && SCHEME=BreezeLight || SCHEME=BreezeDark
docker run --rm --cap-add=SYS_NICE --shm-size=512m -e SCHEME="$SCHEME" -e MODE="$MODE" -e SCALE="${SCALE:-1}" \
  -v "$ROOT/dist/Frost:/home/tester/.local/share/icons/Frost:ro" -v "$OUT:/out" "$IMG"
echo "→ $OUT"

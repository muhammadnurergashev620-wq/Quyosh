#!/usr/bin/env bash
# Mahalliy S3 mock (s3rver) — Docker/MinIO bo‘lmagan dev mashinalar uchun. Ma’lumot: $QUYOSH_S3_HOME.
# `.env`: STORAGE_ENDPOINT=http://localhost:59100, STORAGE_ACCESS_KEY_ID/SECRET=S3RVER, STORAGE_FORCE_PATH_STYLE=true.
#   scripts/quyosh-s3.sh start|stop|status
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S3_HOME="${QUYOSH_S3_HOME:-$HOME/.local/share/quyosh/s3}"
PORT="${QUYOSH_S3_PORT:-59100}"
PID_FILE="$S3_HOME/.pid"
BIN="$(ls -d "$ROOT"/node_modules/.pnpm/s3rver@*/node_modules/s3rver/bin/s3rver.js 2>/dev/null | head -1)"

running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if running; then echo "s3rver allaqachon ishlayapti (:$PORT)"; exit 0; fi
    [ -n "$BIN" ] || { echo "s3rver topilmadi — pnpm install" >&2; exit 1; }
    mkdir -p "$S3_HOME"
    nohup node "$BIN" -d "$S3_HOME" -a 127.0.0.1 -p "$PORT" --configure-bucket quyosh-media --configure-bucket quyosh-test >"$S3_HOME/server.log" 2>&1 &
    echo $! >"$PID_FILE"
    echo "s3rver :$PORT ($S3_HOME)"
    ;;
  stop) running && kill "$(cat "$PID_FILE")" && rm -f "$PID_FILE" || echo "ishlamayapti" ;;
  status) running && echo "ishlayapti :$PORT" || echo "ishlamayapti" ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac

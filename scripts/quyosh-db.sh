#!/usr/bin/env bash
# Root huquqisiz mahalliy PostgreSQL 18 + PostGIS klasteri (Docker bo‘lmagan dev mashinalar uchun).
# Tuzilishi: $QUYOSH_PG_HOME ichida tizimdagi /usr/lib/postgresql/18 va /usr/share/postgresql/18 nusxasi
# hamda `apt-get download` qilingan postgis/geos/proj paketlari (`dpkg-deb -x`). Docker bor bo‘lsa —
# infrastructure/docker/docker-compose.local.yml dan foydalaning.
#   scripts/quyosh-db.sh start|stop|status|psql
set -euo pipefail
PG_HOME="${QUYOSH_PG_HOME:-$HOME/.local/share/quyosh/pg}"
PORT="${QUYOSH_PG_PORT:-55434}"
BIN="$PG_HOME/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$PG_HOME/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PROJ_DATA="$PG_HOME/usr/share/proj"

case "${1:-status}" in
  start)
    "$BIN/pg_ctl" -D "$PG_HOME/data" -l "$PG_HOME/server.log" -w \
      -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" start
    ;;
  stop) "$BIN/pg_ctl" -D "$PG_HOME/data" -m fast stop ;;
  status) "$BIN/pg_ctl" -D "$PG_HOME/data" status ;;
  psql) shift; "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U quyosh "$@" ;;
  *) echo "usage: $0 start|stop|status|psql" >&2; exit 2 ;;
esac

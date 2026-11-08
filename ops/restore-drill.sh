#!/usr/bin/env bash
# Restore drill: proves a backup set can be restored, without touching the live database.
#
#   ops/restore-drill.sh backups/20261108T020000Z
#
# The dump is restored into a scratch database (ethos_restore_drill) on the same server,
# row counts are compared with the live database, the file archive is unpacked into a
# temporary directory and checked against the stored checksums, and everything is removed.

set -Eeuo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows would rewrite container paths

cd "$(dirname "$0")/.."

SET="${1:?usage: ops/restore-drill.sh <backup set directory>}"
SCRATCH=ethos_restore_drill
COMPOSE=(docker compose)
TABLES=(tasks projects goals habits habit_logs notes inbox_items file_assets calendar_blocks)

[ -f "$SET/ethos.dump" ] && [ -f "$SET/files.tar.gz" ] || { echo "not a backup set: $SET" >&2; exit 1; }
(cd "$SET" && sha256sum --check --quiet SHA256SUMS)

psql() { "${COMPOSE[@]}" exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -tAc \"$2\""; }
cleanup() { psql postgres "DROP DATABASE IF EXISTS $SCRATCH" > /dev/null || true; rm -rf "$WORK"; }
WORK="$(mktemp -d)"
trap cleanup EXIT

echo "restoring into $SCRATCH"
psql postgres "DROP DATABASE IF EXISTS $SCRATCH" > /dev/null
psql postgres "CREATE DATABASE $SCRATCH" > /dev/null
"${COMPOSE[@]}" exec -T db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $SCRATCH --no-owner --exit-on-error" \
  < "$SET/ethos.dump"

echo "comparing row counts (live counts may have grown since the backup)"
printf '%-18s %8s %8s\n' table backup live
for table in "${TABLES[@]}"; do
  restored="$(psql "$SCRATCH" "SELECT count(*) FROM $table")"
  live="$(psql '"$POSTGRES_DB"' "SELECT count(*) FROM $table")"
  printf '%-18s %8s %8s\n' "$table" "$restored" "$live"
done

echo "unpacking files"
tar -xzf "$SET/files.tar.gz" -C "$WORK"
echo "files restored: $(find "$WORK" -type f | wc -l)"
echo "restore drill ok: $SET"

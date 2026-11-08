#!/usr/bin/env bash
# Restore drill: proves a backup set restores into a clean PostgreSQL server and matches the
# live data, without touching the live database.
#
#   ops/restore-drill.sh backups/20261108T020000Z
#
# The dump is restored into a throwaway postgres container with no published ports. Foreign
# keys are validated, every table is compared with the live database by content digest, and
# every uploaded file is checked against its stored checksum and size. The container and the
# unpacked files are removed on exit. Exit status is non-zero on any mismatch.
#
# Tables that the background worker writes continuously are compared by row count only.
# Digests of the other tables only match if nothing was edited between the backup and the
# drill, so run the drill right after the backup or against a quiet system.

set -Eeuo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows would rewrite container paths

cd "$(dirname "$0")/.."

SET="${1:?usage: ops/restore-drill.sh <backup set directory>}"
DRILL=ethos-restore-drill
COMPOSE=(docker compose)
VOLATILE=(calendar_blocks service_heartbeats)
mismatches=0
WORK=""

[ -f "$SET/ethos.dump" ] && [ -f "$SET/files.tar.gz" ] && [ -f "$SET/SHA256SUMS" ] \
  || { echo "not a backup set: $SET" >&2; exit 1; }
(cd "$SET" && sha256sum --check --quiet SHA256SUMS)

cleanup() {
  docker rm -f "$DRILL" > /dev/null 2>&1 || true
  [ -z "$WORK" ] || rm -rf "$WORK"
}
trap cleanup EXIT

# SQL is passed on stdin so quoting stays simple.
live() { printf '%s\n' "$1" | "${COMPOSE[@]}" exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'; }
drill() { printf '%s\n' "$1" | docker exec -i "$DRILL" psql -X -v ON_ERROR_STOP=1 -U drill -d ethos -At; }

IMAGE="$("${COMPOSE[@]}" config --images | grep -E '^postgres:')"
docker rm -f "$DRILL" > /dev/null 2>&1 || true
echo "starting throwaway $IMAGE (no published ports)"
docker run -d --name "$DRILL" -e POSTGRES_USER=drill -e POSTGRES_DB=ethos \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$IMAGE" > /dev/null
# The image starts a temporary server before the real one: wait for the second "ready" line.
for _ in $(seq 60); do
  [ "$(docker logs "$DRILL" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ] && break
  sleep 1
done
[ "$(docker logs "$DRILL" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ] \
  || { echo "throwaway database did not start" >&2; exit 1; }

echo "restoring dump"
docker exec -i "$DRILL" pg_restore -U drill -d ethos --no-owner --exit-on-error \
  < "$SET/ethos.dump"

echo "validating foreign keys"
fk_count="$(drill "SELECT count(*) FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace WHERE con.contype = 'f' AND n.nspname = 'public'")"
drill "$(drill "SELECT format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I;', n.nspname, c.relname, con.conname) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE con.contype = 'f' AND n.nspname = 'public'")" > /dev/null
echo "foreign keys valid: $fk_count"

echo "comparing tables with live"
printf '%-22s %8s %8s  %s\n' table backup live content
tables="$(live "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1")"
digest_sql() { printf "SELECT count(*) || ' ' || md5(coalesce(string_agg(t::text, E'\\\\n' ORDER BY t::text), '')) FROM %s t" "$1"; }
for table in $tables; do
  restored="$(drill "$(digest_sql "$table")")"
  current="$(live "$(digest_sql "$table")")"
  backup_rows="${restored%% *}"
  live_rows="${current%% *}"
  if [[ " ${VOLATILE[*]} " == *" $table "* ]]; then
    status="volatile (count only)"
    [ "$backup_rows" = "$live_rows" ] || status="volatile (count only; changed since backup)"
  elif [ "$restored" = "$current" ]; then
    status="match"
  else
    status="DIFFERS"
    mismatches=$((mismatches + 1))
  fi
  printf '%-22s %8s %8s  %s\n' "$table" "$backup_rows" "$live_rows" "$status"
done

echo "checking uploaded files"
WORK="$(mktemp -d)"
tar --force-local -xzf "$SET/files.tar.gz" -C "$WORK"
files=0
while IFS='|' read -r key sha size; do
  files=$((files + 1))
  path="$WORK/${key:0:2}/$key"
  if [ ! -f "$path" ]; then
    echo "missing blob for $key"
    mismatches=$((mismatches + 1))
  elif [ "$(sha256sum "$path" | cut -d' ' -f1)" != "$sha" ] || [ "$(stat -c %s "$path")" != "$size" ]; then
    echo "checksum or size mismatch for $key"
    mismatches=$((mismatches + 1))
  fi
done < <(drill "SELECT storage_key || '|' || sha256 || '|' || size_bytes FROM file_assets")
echo "file rows checked: $files"

if [ "$mismatches" -ne 0 ]; then
  echo "restore drill FAILED: $mismatches mismatch(es) in $SET" >&2
  exit 1
fi
echo "restore drill ok: $SET"

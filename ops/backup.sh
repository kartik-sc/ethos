#!/usr/bin/env bash
# Daily Ethos backup: PostgreSQL (custom-format dump) and uploaded files, verified, then pruned.
#
#   ops/backup.sh                     # run from the repository root, next to compose.yaml
#
# Environment (all optional):
#   BACKUP_DIR            where backups go (default: ./backups, outside any container)
#   BACKUP_RETAIN_DAYS    keep local backups this many days (default 7, never fewer than 7 sets)
#   BACKUP_AGE_RECIPIENT  age public key; when set, an encrypted copy is made for off-server use
#   BACKUP_RCLONE_REMOTE  rclone destination (e.g. "offsite:ethos"); requires the recipient
#
# Exit status is non-zero on any failure, and `last-failure` records why, so a cron wrapper or
# monitor can alert. A run only counts as successful once both archives pass their checks.

set -Eeuo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash on Windows would rewrite container paths

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SET="$BACKUP_DIR/$STAMP"
COMPOSE=(docker compose)

fail() {
  mkdir -p "$BACKUP_DIR"
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" > "$BACKUP_DIR/last-failure"
  echo "backup failed: $1" >&2
  rm -rf "$SET"
  exit 1
}
trap 'fail "unexpected error on line $LINENO"' ERR

mkdir -p "$SET"
umask 077

echo "dumping database"
"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$SET/ethos.dump" || fail "pg_dump failed"

echo "archiving uploaded files"
"${COMPOSE[@]}" exec -T worker tar -C /data/files -czf - . > "$SET/files.tar.gz" \
  || fail "file archive failed"

echo "verifying"
"${COMPOSE[@]}" exec -T db pg_restore --list < "$SET/ethos.dump" > /dev/null \
  || fail "dump does not read back"
tar --force-local -tzf "$SET/files.tar.gz" > /dev/null || fail "file archive does not read back"
[ -s "$SET/ethos.dump" ] || fail "dump is empty"
(cd "$SET" && sha256sum ethos.dump files.tar.gz > SHA256SUMS)

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "encrypting off-server copy"
  tar --force-local -C "$BACKUP_DIR" -cf - "$STAMP" | age -r "$BACKUP_AGE_RECIPIENT" > "$SET.tar.age" \
    || fail "encryption failed"
  if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
    rclone copy "$SET.tar.age" "$BACKUP_RCLONE_REMOTE" || fail "off-server copy failed"
    rclone check --one-way "$SET.tar.age" "$BACKUP_RCLONE_REMOTE" \
      || fail "off-server copy does not match"
  fi
  rm -f "$SET.tar.age"
elif [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  fail "BACKUP_RCLONE_REMOTE is set without BACKUP_AGE_RECIPIENT; refusing to upload unencrypted"
fi

echo "pruning"
# Keep everything newer than the retention period, and never fewer than RETAIN_DAYS sets.
mapfile -t sets < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*Z' | sort -r)
for old in "${sets[@]:RETAIN_DAYS}"; do
  if [ -n "$(find "$old" -maxdepth 0 -mtime +"$RETAIN_DAYS")" ]; then
    rm -rf "$old"
  fi
done

date -u +%FT%TZ > "$BACKUP_DIR/last-success"
rm -f "$BACKUP_DIR/last-failure"
echo "backup ok: $SET ($(du -sh "$SET" | cut -f1))"

# Ethos operations

Run everything from the repository root on the host that runs `docker compose`. Nothing here
restores data or rolls back automatically; each recovery step is a deliberate, manual action.

## Backups

`ops/backup.sh` makes one backup set in `backups/<UTC timestamp>/`:

| File | Contents | Check |
|---|---|---|
| `ethos.dump` | `pg_dump -Fc` of the database | `pg_restore --list` reads it back |
| `files.tar.gz` | the `files` volume (uploaded project files) | `tar -t` reads it back |
| `SHA256SUMS` | checksums of both | used by the restore drill |

Local sets older than `BACKUP_RETAIN_DAYS` (default 7) are pruned, but the newest seven are
always kept, so a week of failed runs never deletes the last good backups. A run writes
`backups/last-success` or `backups/last-failure` and exits non-zero on failure.

**Daily schedule (VPS).** As the deploy user, `crontab -e`:

```cron
30 2 * * * cd /srv/ethos && ops/backup.sh >> backups/backup.log 2>&1
```

Failure alerts are not wired yet: they need a delivery channel (WhatsApp is pending provider
selection). Until then, check `backups/last-success` and `backups/last-failure`.

**Off-server copy.** Once the owner picks independent storage (see the roadmap's procurement
list), install [`age`](https://age-encryption.org) and [`rclone`](https://rclone.org), configure
an rclone remote, and set:

```sh
BACKUP_AGE_RECIPIENT=age1...          # public key; the private key never lives on the VPS
BACKUP_RCLONE_REMOTE=offsite:ethos
```

The script then uploads an encrypted copy of each set and verifies it. It refuses to upload
unencrypted. Keep the age private key offline, separate from the OAuth token encryption key, and
test decrypting one copy after setup: `age -d -i key.txt set.tar.age | tar -t`.

**Manual export** at any time: run `ops/backup.sh` and copy the newest set.

## Restore drill

Monthly, and after any change to backups or migrations:

```sh
ops/restore-drill.sh backups/<set>
```

It checks the checksums, starts a throwaway PostgreSQL container with the same image as the
stack and no published ports, restores the dump into it, and then:

- validates every foreign key;
- compares every table with the live database by row count and content digest. The worker
  writes `calendar_blocks` and `service_heartbeats` continuously, so those are count-only;
- checks each uploaded file's stored checksum and size against the unpacked archive.

Any mismatch makes the script exit non-zero. The container and the unpacked files are removed
afterwards, and the live database is never touched. Run it right after `ops/backup.sh` or on a
quiet system, otherwise live tables that users edit will show `DIFFERS`.

**Verified 2026-11-08** (set `20261108T065255Z`, one project file, 4 notes, 3 note links, 7
versions): all 17 foreign keys valid; 19 of 20 tables match by digest, the 20th
(`service_heartbeats`) is volatile. Two negative tests failed as they should: a tampered file
blob (with the outer checksums recomputed) and a live note edit. Both were reverted.

## Rehearsing a full restore in isolation

The drill checks the backup. To rehearse the recovery steps below, bring up a second compose
project with its own volumes and ports. It never shares state with the live stack:

```sh
export COMPOSE_PROJECT_NAME=ethos-drill HTTP_PORT=8081 HTTPS_PORT=8444 POSTGRES_PORT=5443
docker compose up -d --build --wait
```

Then run *Restoring for real* below, skipping its first `ops/backup.sh` step, which would
overwrite `backups/last-success` with the rehearsal state. Tear it down with
`docker compose down -v` while `COMPOSE_PROJECT_NAME` is still set. That removes only the
`ethos-drill_*` volumes.

**Verified 2026-11-08** with set `20261108T065255Z`: the restored database matched live on 19 of
20 tables (`service_heartbeats` differs because the rehearsal worker writes it). The uploaded file
downloaded byte-for-byte identical to the original, and a linked note's API JSON (title, folder,
tags, version, content) was identical to live.

## Restoring for real

Only when the owner decides the live data is lost or wrong. Take a fresh backup of the current
state first, even if it looks broken. On Windows, run these from Git Bash with
`MSYS_NO_PATHCONV=1` set. Otherwise the `-v` path is rewritten and the file step fails. Check
the exit status of each step, since the file step's failure does not stop the sequence on its
own.

```sh
ops/backup.sh                                   # keep what is there now
docker compose stop api worker web              # nothing writes during the restore
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < backups/<set>/ethos.dump
docker compose run --rm --no-deps -v "$PWD/backups/<set>:/restore:ro" worker \
  sh -c 'find /data/files -mindepth 1 -delete && tar -xzf /restore/files.tar.gz -C /data/files'
docker compose up -d --wait                     # migrate runs first and brings the schema up to date
```

Afterwards, spot-check the restored data: row counts for the main tables, one note, and one
uploaded file downloaded through the API. `ops/restore-drill.sh` checks the backup set itself,
not the live database, so it does not replace these checks.

## Application rollback

Images are tagged with the release (`ETHOS_RELEASE`, the commit SHA in production). The
previous tag stays on the host. To roll back the application, not the data:

```sh
docker image ls ethos-backend                   # find the previous tag
ETHOS_RELEASE=<previous sha> docker compose -f compose.yaml up -d --no-build --wait
```

Migrations are backward-compatible, so the previous release runs against the newer schema.
The database is never downgraded automatically. If a migration itself must be undone, that is
a separate, reviewed change.

## Service failures

- **Database container stops:** `restart: unless-stopped` restarts it; check with
  `docker compose ps` and `curl -s localhost/api/v1/health`. If it keeps failing, read
  `docker compose logs db`; do not restore unless the data is actually damaged.
- **Worker stalls:** `/api/v1/health` reports the worker as degraded after three missed
  heartbeats; `docker compose restart worker`.
- **Disk filling:** `docker system df`, `du -sh backups`; logs rotate at 10 MB × 5 per container.

## Host recovery (VPS lost)

1. Provision a new Ubuntu 24.04 VPS, SSH keys only, firewall open for 22 (restricted), 80, 443.
2. Install Docker, clone the repository, restore `.env` from the owner's password manager.
3. Fetch the newest off-server set, decrypt it with the age private key, and follow
   *Restoring for real* (skipping the first backup step).
4. Point DNS at the new host; Caddy issues certificates on first request.

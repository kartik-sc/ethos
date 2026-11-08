# Ethos

A single-user personal command centre and lightweight PKM. Product requirements live in
[`ETHOS_BUILD_SPEC.md`](ETHOS_BUILD_SPEC.md); agent rules in [`CLAUDE.md`](CLAUDE.md); the
milestone checklist in [`IMPLEMENTATION_ROADMAP.md`](IMPLEMENTATION_ROADMAP.md).

## Architecture

```
browser ──► Caddy ──┬─ /api/* ─► api     (FastAPI, /api/v1)  ─┐
                    └─ /*     ─► web     (Next.js, standalone) │
                                 worker  (Python loop)  ───────┼─► PostgreSQL
                                 migrate (alembic upgrade, one-shot) ─┘
```

One repository, one database, five long-running containers. The API and worker share the
`backend/` codebase and image. The browser only ever talks to one origin: Caddy in
production, the Next.js dev rewrite locally.

| Path | Contents |
|---|---|
| `backend/app/core` | Settings (validated at start-up), database engine, JSON logging |
| `backend/app/<domain>` | One package per domain: `models`, `schemas`, `service`, `router` |
| `backend/app/worker` | Background worker entry point |
| `backend/alembic` | Migrations |
| `frontend/src/app` | App Router routes; `(workspace)` holds the shell-wrapped pages |
| `frontend/src/components` | `shell/`, `home/`, `system/`, `settings/`, shadcn `ui/` |
| `frontend/src/lib` | Typed API client, pure helpers, shared types |

### Decisions taken in Phase 0

- **Sync SQLAlchemy + psycopg 3.** A single-user app gains nothing from async here; FastAPI
  runs sync handlers in a thread pool.
- **Worker liveness via a heartbeat row** (`service_heartbeats`). `/api/v1/health` reports the
  worker as degraded after three missed beats. The durable job mechanism for reminders and
  sync retries is deferred until those features land (planned: a PostgreSQL job table polled
  with `FOR UPDATE SKIP LOCKED`, no Redis).
- **Theme and sidebar state** are applied by a tiny inline script before first paint and
  stored in `localStorage`. This keeps every page statically prerenderable under Next 16's
  `cacheComponents`. Dark is the default; nothing switches automatically.
- **Sidebar** floats by default: hover the left edge or the mark (top left) to slide it in, or
  press `[` to dock it. Under Cache Components, active-link state is read in small Suspense
  leaves (`components/shell/with-active.tsx`) so dynamic routes keep a prerendered shell.
- **Logs** are JSON lines on stdout; Docker's `json-file` driver rotates them (10 MB × 5).

## Local development

Requirements: Docker, [uv](https://docs.astral.sh/uv/), Node 22 and pnpm.

```sh
cp .env.example .env          # then change POSTGRES_PASSWORD and both URLs to match
docker compose up -d db       # PostgreSQL on 127.0.0.1:5433
```

Backend (from `backend/`):

```sh
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000   # API
uv run python -m app.worker.main                    # worker, in a second terminal
```

Frontend (from `frontend/`):

```sh
pnpm install
pnpm dev                       # http://localhost:3000, proxies /api to 127.0.0.1:8000
```

If port 8000 is taken, run the API on another port and start the frontend with
`API_ORIGIN=http://127.0.0.1:<port> pnpm dev`. Use `localhost:3000` rather than
`127.0.0.1:3000`: Next's dev server only accepts HMR from its own origin.

> On Windows, use `127.0.0.1` rather than `localhost` in database URLs. Docker Desktop can
> leave IPv6 `::1` connections hanging before the IPv4 fallback.

### Full stack in Docker

```sh
docker compose up -d --build --wait
open http://localhost:8080     # HTTP_PORT from .env
```

`compose.override.yaml` (development only) publishes PostgreSQL on localhost. Production
deploys with `-f compose.yaml` only, so the database is never published.

## Checks

| | Command (run in the package directory) |
|---|---|
| Backend format/lint | `uv run ruff format --check . && uv run ruff check .` |
| Backend types | `uv run mypy app tests alembic/env.py` |
| Backend tests | `uv run pytest` (needs the compose `db`; creates `ethos_test` itself) |
| Frontend format/lint | `pnpm format:check && pnpm lint` |
| Frontend types | `pnpm typecheck` |
| Frontend tests | `pnpm test` |
| Frontend build | `pnpm build` |

GitHub Actions (`.github/workflows/ci.yml`) runs all of these on every push and pull
request, against a PostgreSQL 18 service, and then builds both images.

The backend suite migrates the test database down and up on every run and asserts that the
models and migrations match, so a missing migration fails CI.

## Configuration

All settings are environment variables; see [`.env.example`](.env.example). The backend
refuses to start if a value is missing or invalid, and validation errors never echo values.

| Variable | Used by | Notes |
|---|---|---|
| `ENVIRONMENT` | backend | `development`, `test` or `production`. Production disables `/api/docs` |
| `LOG_LEVEL` | backend | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `DEFAULT_TIMEZONE` | backend | IANA name; default `Asia/Kolkata`. Only the initial value: the timezone is then set in Settings |
| `DATABASE_URL` | backend | Must use `postgresql+psycopg://`. Compose builds it from `POSTGRES_*` |
| `TEST_DATABASE_URL` | tests | Separate database; tests drop and recreate its schema |
| `WORKER_HEARTBEAT_SECONDS` | worker, api | 5–300, default 30 |
| `FILE_STORAGE_DIR` | api, worker | Uploaded files. Default `data/files` (host); `/data/files` on the `files` volume in compose |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose | Use a URL-safe password (e.g. `openssl rand -hex 24`) |
| `POSTGRES_PORT` | compose (dev) | Host port for the dev override |
| `SITE_ADDRESS` | Caddy | `:80` locally; the domain in production (Caddy provisions HTTPS) |
| `HTTP_PORT` / `HTTPS_PORT` | compose | `80`/`443` in production |
| `API_ORIGIN` | `next dev` | Dev proxy target, default `http://127.0.0.1:8000` |

## API

FastAPI serves OpenAPI docs at `/api/docs` outside production.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/health/live` | Process liveness, no dependencies. Used by the container healthcheck |
| GET | `/api/v1/health` | Database and worker status. `200` when ok/degraded, `503` when the database is down |
| GET | `/api/v1/tasks?view=open\|done\|trash` | Open tasks by deadline; done/cancelled newest first (last 100); Trash |
| POST | `/api/v1/tasks` | Create a task |
| PATCH | `/api/v1/tasks/{id}` | Partial update; `status` stamps `completed_at` / `cancelled_at` |
| DELETE | `/api/v1/tasks/{id}` | Move to Trash (soft delete) |
| POST | `/api/v1/tasks/{id}/restore` | Restore from Trash |
| GET | `/api/v1/tasks/next-action` | The one highlighted task and why |
| POST | `/api/v1/tasks/next-action/override` | Record that the owner picked a different task; honoured for the rest of the day |
| GET | `/api/v1/projects?view=active\|trash` | Projects with live task counts and next task deadline |
| POST | `/api/v1/projects` | Create a project |
| GET / PATCH | `/api/v1/projects/{id}` | Read or partially update a project |
| DELETE | `/api/v1/projects/{id}` | Move the project and its live tasks to Trash together |
| POST | `/api/v1/projects/{id}/restore` | Restore the project and the tasks trashed with it |

| GET | `/api/v1/goals?view=active\|trash` | Goals with derived progress |
| POST | `/api/v1/goals` | Create a goal |
| GET / PATCH | `/api/v1/goals/{id}` | Read or partially update a goal |
| DELETE | `/api/v1/goals/{id}` | Move the goal to Trash; its projects and tasks are untouched |
| POST | `/api/v1/goals/{id}/restore` | Restore the goal; its links reappear |

| GET | `/api/v1/habits?view=active\|trash` | Habits with today's state, streak, this week's progress and the last 7 days |
| POST | `/api/v1/habits` | Create a habit |
| GET / PATCH | `/api/v1/habits/{id}` | Read or partially update; the merged habit is re-validated as a whole |
| DELETE | `/api/v1/habits/{id}` · POST `…/restore` | Trash and restore (history is kept) |
| PUT / DELETE | `/api/v1/habits/{id}/logs/{date}` | Write or clear one day's entry; returns the fresh summary |
| GET | `/api/v1/habits/{id}/history?weeks=12` | Whole weeks of day states, Monday first, for the heatmap |

| GET | `/api/v1/inbox?view=open\|processed` | Captures: open oldest first; processed newest first (last 100) |
| POST | `/api/v1/inbox` | Capture text |
| PATCH | `/api/v1/inbox/{id}` | Edit an open capture |
| POST | `/api/v1/inbox/{id}/convert` | Create a task, project or goal from it (one transaction) |
| POST | `/api/v1/inbox/{id}/resolve` · `…/reopen` | Mark handled or dismissed; reopen. Nothing is discarded |
| GET / PATCH | `/api/v1/preferences` | `archive_after_days` (30), `timezone`, `default_task_minutes` (60), `day_starts_at`/`day_ends_at` (08:00–22:00) |
| GET | `/api/v1/quotes` · `/api/v1/quotes/today` | Quotes; today's pick (fixed for the day) |
| POST / PUT / DELETE | `/api/v1/quotes[/{id}]` | Manage quotes |
| GET | `/api/v1/dashboard` | Deadline radar (overdue + next 30 days) and task counts |
| GET | `/api/v1/search?q=&kind=&area=&status=` | Search tasks, projects, goals, habits and captures |

| GET | `/api/v1/projects/{id}/files?view=active\|trash` | A project's files |
| POST | `/api/v1/projects/{id}/files?filename=&replace=` | Upload; the body is the raw file. `409` + `existing` if the name is taken |
| GET | `/api/v1/files/{id}/content` | Download (always as an attachment) |
| PATCH / DELETE | `/api/v1/files/{id}` · POST `…/restore` | Rename, Trash and restore |

| GET / POST | `/api/v1/integration-tokens` | Capture tokens; the secret is returned once, on creation |
| DELETE | `/api/v1/integration-tokens/{id}` | Revoke (kept in the list as revoked) |
| GET | `/api/v1/calendar/status` | `connected` (false until Google Calendar is linked) and blocks waiting to sync |
| GET | `/api/v1/calendar/blocks?start=&end=` | Blocks overlapping local dates (default today) |
| POST | `/api/v1/calendar/tasks/{id}/schedule` | One block in the earliest free slot; `409` with the reason if none |
| POST | `/api/v1/calendar/plan` | `{horizon_days, apply}`: preview or create blocks; lists what doesn't fit |
| POST | `/api/v1/calendar/refresh` | Settle past habit sessions and book today's and tomorrow's now |
| DELETE | `/api/v1/calendar/blocks/{id}` | Remove an Ethos block (fixed blocks: `409`) |
| GET | `/api/v1/clip/folders` | Token-only: folders for the clipper, with the suggested one |
| POST | `/api/v1/clip` | Token-only: save a web clip as a note (see `extension/`) |
| POST | `/api/v1/capture` | `Authorization: Bearer eth_…`, body `{"text": …}`. Token-only; `401` otherwise |

| GET | `/api/v1/notes/tree` | Folders, live notes (no bodies) and tags in use |
| POST | `/api/v1/notes` | Create a note |
| GET / PUT | `/api/v1/notes/{id}` | Read with links and backlinks; save with `base_version` (409 + `current` if stale) |
| DELETE · POST | `/api/v1/notes/{id}` · `…/restore` | Trash and restore |
| GET | `/api/v1/notes/{id}/versions[/{versionId}]` | Version history and one snapshot |
| GET | `/api/v1/notes/link-targets?q=` | `[[` autocomplete; `task:`, `project:`, `goal:` prefixes search records |
| POST / PATCH / DELETE | `/api/v1/note-folders[/{id}]` | Nested folders; only empty folders delete |
| POST | `/api/v1/notes/import` | Up to 500 Markdown files with relative paths; folders are created or reused |
| GET | `/api/v1/note-folders/{id}/export` | A folder's notes (with subfolders) as `{path, content}` files |

### Analytics

`GET /api/v1/analytics?period=week|month&offset=0` (0 = current, −1 = previous…; up to 104 weeks
or 24 months back). Weeks run Monday to Sunday and months are calendar months, both in the
owner's timezone; every number comes with the window before it for comparison.

- **Tasks:** completed, cancelled and created; completions per day and per life area.
- **Deadlines:** *met* = completed on or before the due date; *missed* = the date has passed
  without that. Deadlines still ahead are neither. Cancelled tasks are left out.
- **Habits:** done out of what came due. Today, and a weekly habit's current week, only count
  once done; what is still possible is reported as *open*, never as missed. A weekly habit's
  week belongs to the window its Monday falls in.
- **Inbox:** captured, processed and median time to process. **Notes:** notes saved.
- **Observations** (`app/analytics/rules.py`) are plain statements generated from the numbers,
  e.g. "Met 3 of 4 deadlines that fell in this week." No advice, praise or motivation.

### Command palette

`Ctrl+K` anywhere (or the terminal button on the phone's top bar). Plain text + Enter goes to the
Inbox; `/` lists commands. Commands are parsed deterministically in the backend
(`app/commands/parser.py`); nothing is guessed, and a missing essential detail gets one question.

| Command | Example |
|---|---|
| `/task` (`/t`) | `/task Finish DBMS report by fri !high #academics @portfolio 45m` |
| `/deadline` (`/d`) | `/deadline Scholarship form 20 nov` (a date is required) |
| `/capture` (`/c`) | `/capture call the bank about the card` |
| `/habit` (`/h`) | `/habit leetcode 90` · `/habit sleep 23:30-07:00` · `/habit gym` |
| `/note` (`/n`) | `/note Graph theory` (opens it) |
| `/project` (`/p`) · `/goal` (`/g`) | `/project Portfolio site by 2026-12-31 #career` |
| `/search` (`/s`) | `/search dbms` |

- Dates: `today`, `tomorrow`/`tmrw`, weekday names (next occurrence, today included),
  `in 3 days`, `in 2 weeks`, `2026-12-31`, `20/11` (day first), `20 nov`, `nov 20 2027`. After
  `by`, `due`, `on` or `before`, or at the end of the title.
- `!high`/`!low`, `#area` (a life area), `@project` (matched by title), durations `45m`, `2h`, `1h30m`.
- `POST /api/v1/commands/preview` shows what Enter will do without writing;
  `POST /api/v1/commands/run` executes it. Similar existing tasks, projects or goals return `409`
  with the matches; resending with `confirm_duplicate` creates it anyway. Nothing is ever merged.
- Natural-language commands plug in through `app/commands/interpreter.py` once a provider is
  chosen; until then plain text is an Inbox capture.

### Notes

- **Raw Markdown**, edited as source. No preview, templates, attachments or AI, per the spec.
- **Saving:** autosave every 2 minutes while there are changes, `Ctrl+S`, and a last save when
  leaving the note. Network and server failures retry (15 s → 2 min); the draft is never dropped.
  Closing the tab with unsaved changes asks first.
- **Concurrent edits:** every save carries the version it started from and that version's text.
  If the note changed elsewhere, the server merges three ways (`app/notes/merge.py`): edits to
  different lines combine, tags merge with removals winning, and the other version is kept in
  History. Edits to the same lines (or two different renames) are not merged: nothing is saved,
  your text stays in the editor, and you can *Merge by hand* (both sides between
  `<<<<<<< yours` / `=======` / `>>>>>>> other version` markers), *Keep mine* (the other version
  goes to History) or *Use the other version* (asks before discarding yours).
- **History:** a snapshot per save, with saves under 10 minutes apart sharing one; the latest 50
  are kept. Restoring a version saves it as a new one.
- **Wiki-links:** `[[Title]]`, `[[Title|shown text]]`, and `[[task:…]]`, `[[project:…]]`,
  `[[goal:…]]`. Links are stored by id, so renaming a target never breaks them; a link written
  before its note exists resolves when that note is created. Titles are unique (ignoring case).
- **Search** matches note titles, folder names and tags only; note text is never searched.
- **Import:** pick Markdown files or a whole folder (its structure is recreated). Titles come
  from file names; a taken title becomes "Title (2)". Non-Markdown files and files over 500,000
  characters are skipped and listed. Links between imported files resolve in any order.
- **Export:** one note as `.md` from the editor, or a folder (with subfolders) from the library.
  In Chrome and Edge the folder is written into a directory you choose; elsewhere each note
  downloads separately. There is deliberately no whole-library ZIP.
- Notes in Trash follow the same 30-day purge as everything else.

### Files

- Files belong to a project and appear under its tasks. Upload with the button or by dropping
  files on the list. Each file is limited to 25 MB (checked in the browser, by Caddy and while
  the API streams the body to disk).
- Blobs are stored under random keys in `FILE_STORAGE_DIR` (sharded by the first two hex
  characters); the uploaded name is display text only and never becomes a path. The API keeps
  a SHA-256 of every blob.
- Names are unique per project, ignoring case. Uploading a taken name asks first; replacing
  keeps only the new version (backups may still hold older copies).
- Downloads are always `Content-Disposition: attachment` with `nosniff`, so an uploaded HTML
  file never renders on Ethos' own origin.
- Deleting a file or its project moves it to Trash; restoring the project restores the files
  trashed with it. The hourly worker pass purges expired rows and then removes blobs that no
  row references (older than an hour, so in-flight uploads are safe).

### Scheduling

`app/calendar/slots.py` holds the pure rules, tested without a database:

- Work goes only into **free time inside the day window** (Settings → Time, default 08:00–22:00
  in the owner's timezone), starting on a quarter hour, never before now.
- **Nothing existing moves.** Calendar events, habit sessions and earlier blocks are all busy
  time; a new block never overlaps them. If nothing fits, the API says so (`409`, or the plan's
  *Doesn't fit* list) instead of overbooking.
- A block lasts the task's planned duration, or the default duration from Settings.
- **Schedule** (in a task's editor) places one block before the task's deadline, within 14
  days; an overdue task can still be scheduled by hand. A task has at most one upcoming block.
- **Plan into free time** (Tasks page) takes open tasks due within the chosen period or with a
  duration, in Next Action order, and previews the blocks before creating them. Overdue tasks
  are listed, not rescheduled: missed work is never pushed forward automatically.
- Blocks are stored as UTC instants and the API returns UTC. Each block carries its own pending
  Google Calendar change (`sync_op`), so nothing is lost while the calendar is unavailable;
  until Google Calendar is connected every Ethos block reads *not synced*. A block Google never
  saw is deleted outright; one it has seen is kept until the deletion syncs.
- A task in Trash hides its blocks and frees their time; purging the task deletes them.

### Habit sessions

A habit with a **session length** (and optionally a preferred start) gets calendar sessions.
`app/calendar/habit_sessions.py` books and settles them; the worker runs it every heartbeat,
and planning runs it first so task work never takes a session's time.

- **Daily habits** get a session on each due day: at the preferred time if it is free and
  still ahead, otherwise the first free slot in the working day.
- **Weekly habits** keep their target reachable: sessions still owed this week (target minus
  days done minus sessions booked) are spread evenly over the days left.
- A session is **done** when that day's entry meets the habit, and **missed** once it ends
  without one.
- **Protected daily habit (LeetCode):** a missed session immediately gets another free slot
  later the same day at full length (marked *recovery*). If none exists it stays missed and Home
  shows "no free 2h slot left today". It is never shortened or moved to tomorrow. Protected
  sessions are fixed and can't be removed.
- **Weekly habits:** a missed session is replaced across the rest of the week, around fixed
  commitments; sessions that cannot fit are reported.
- **Everything else** stays missed. Removing an ordinary session cancels it for that day.
- After a timezone, working-day or session change, sessions that haven't started are rebooked
  at the same local clock time.
- The migration gives the seeded LeetCode habit its 120-minute session.

### Web clipper

`extension/` is a dependency-free Manifest V3 extension for Chrome and Edge that clips the
page, or the selection, to Notes as Markdown with its source and metadata. It authenticates
with a capture token from Settings → Capture. Setup and details are in
[`extension/README.md`](extension/README.md).

### Installing and the phone

Ethos ships a web manifest (`src/app/manifest.ts`) and icons, so Chrome or Edge on Windows can
install it (address bar → *Install*), and Safari on iPhone can *Add to Home Screen*, which opens
it full-screen. There is deliberately no service worker: notes are online-only and nothing is
cached for offline use. Installing from another device needs HTTPS, so it works on the VPS
deployment rather than over a local IP.

Below the `md` breakpoint Home becomes a lighter Today screen: a capture line (commands run,
plain text goes to the Inbox), the agenda, the Next Action and today's habits. The radar,
counts, analytics and quote stay on the desktop layout. The bottom bar reaches Tasks, Habits,
Notes and Inbox.

### Shortcut capture

Settings → Capture creates a token for a capture client such as an iPhone Shortcut. Tokens are
`eth_` + 32 random bytes; only their SHA-256 is stored, with the first 12 characters for
recognition and a last-used time. A token can call `POST /api/v1/capture` and nothing else; it
is not a login and creates no account.

A capture runs through the same deterministic parser as the palette. Clear commands execute
(`/task Book dentist by fri`). Anything that would need an answer (a missing date, a possible
duplicate) or plain text is stored whole in the Inbox, marked `shortcut`. A `201` always means
the text is stored; the JSON `message` says where. The Shortcut steps are listed in Settings.

Until Google sign-in lands, the token management endpoints are as open as the rest of the local
API; the capture endpoint already refuses anything without a live token.

### Records over time

- **Trash:** deleted tasks, projects, goals and habits stay restorable for 30 days. The worker
  checks hourly and removes older ones for good (projects take their tasks with them; a goal only
  unlinks). Every Trash row shows the days left.
- **Archive:** done and cancelled tasks older than `archive_after_days` move from Done to
  Archived. Archived tasks still appear in search. Archiving never deletes.
- **Inbox:** processing records the outcome (`task`, `project`, `goal`, `done`, `dismissed`) and
  the created record's id. Items get an amber marker after 24 hours and a red one after 48.
- **Quotes:** each quote stores when it was last shown; the least recently shown goes next, so
  the whole collection cycles before any repeats.
- **Search:** case-insensitive substring match on titles and descriptions (capture text for
  Inbox), up to 20 per type. Trashed records are excluded. Notes will match on title, folder and
  tags only. Press `/` anywhere outside a text field to open it.

### Habit rules

`app/habits/rules.py` holds the pure rules, tested without a database:

- **Cadence:** `daily` on chosen weekdays, or `weekly` N times a week on any days.
- **Measure:** `check`, `amount` (a unit and optional target per entry) or `span` (start and end
  time; hours are derived and cross midnight, e.g. sleep).
- **One entry per habit per day.** Missed days are derived from the schedule, never stored. An entry
  below its target is *partial*: it shows, but does not count as done.
- **Streaks:** daily habits count scheduled days back from today; rest days are skipped and an
  unfinished today does not break the streak. Weekly habits count consecutive weeks that hit
  their target; the current week only adds once it is met.
- A habit starts on its creation day, or earlier if older days are backfilled.
- The migration seeds the spec's protected daily LeetCode habit (120 min) with a fixed
  two-hour calendar session; see *Habit sessions*.
- Goals show how many habits link to them. Habit consistency is not folded into the goal's task
  percentage, because the two measure different things.

Goal progress counts live, non-cancelled tasks. A task counts toward its own `goal_id`, or if it
has none, its project's goal, so nothing is counted twice. A goal in Trash reads as `goal: null`
on linked records while the stored link is kept for restore. Projects and tasks accept
`goal_id`; `GET /api/v1/projects?goal_id=…` and `GET /api/v1/tasks?goal_id=…` filter by it.

Tasks accept an optional `project_id` (`GET /api/v1/tasks?project_id=…` filters by it). A task
whose project is in Trash cannot be restored on its own (`409`); restore the project instead.
Group restore matches on the shared `deleted_at` timestamp, so tasks deleted individually before
the project stay in Trash.

### Next Action rule

`app/tasks/service.py::rank_key` orders open tasks: overdue → due today or tomorrow → high
priority → due within 7 days → everything else; ties go to higher priority, earlier deadline,
then the oldest task. "Today" is the owner's timezone (Settings → Time). An override applies
until local midnight or until the chosen task is closed, and every override is stored in
`next_action_overrides` for later pattern reports.

> Not yet: the API has no authentication (Google sign-in is the next owner-dependent slice), and
> Trash is not purged after 30 days yet. Neither matters while Ethos only runs locally.

## Operations

Backups, the restore drill, rollback and recovery are in [`ops/README.md`](ops/README.md).

## Deployment

Not wired up yet; it comes in the next Phase 0 slice and needs the VPS and domain (see the
procurement list in the roadmap). The shape will be: GitHub Actions passes CI, then connects
over SSH to the VPS, builds images tagged with the commit SHA, runs `migrate`, restarts the
services and keeps the previous tag for manual rollback.

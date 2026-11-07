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
| `DEFAULT_TIMEZONE` | backend | IANA name; default `Asia/Kolkata` |
| `DATABASE_URL` | backend | Must use `postgresql+psycopg://`. Compose builds it from `POSTGRES_*` |
| `TEST_DATABASE_URL` | tests | Separate database; tests drop and recreate its schema |
| `WORKER_HEARTBEAT_SECONDS` | worker, api | 5–300, default 30 |
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

### Next Action rule

`app/tasks/service.py::rank_key` orders open tasks: overdue → due today or tomorrow → high
priority → due within 7 days → everything else; ties go to higher priority, earlier deadline,
then the oldest task. "Today" is the owner's timezone (`DEFAULT_TIMEZONE`). An override applies
until local midnight or until the chosen task is closed, and every override is stored in
`next_action_overrides` for later pattern reports.

> Not yet: the API has no authentication (Google sign-in is the next owner-dependent slice), and
> Trash is not purged after 30 days yet. Neither matters while Ethos only runs locally.

## Deployment

Not wired up yet; it comes in the next Phase 0 slice and needs the VPS and domain (see the
procurement list in the roadmap). The shape will be: GitHub Actions passes CI, then connects
over SSH to the VPS, builds images tagged with the commit SHA, runs `migrate`, restarts the
services and keeps the previous tag for manual rollback.

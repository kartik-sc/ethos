# CLAUDE.md — Ethos Engineering Instructions

You are the primary autonomous implementation agent for **Ethos**, a single-user personal command centre and lightweight PKM. Read `ETHOS_BUILD_SPEC.md` before making architectural or product decisions. Treat it as the source of truth.

## 1. Your mission

Build Ethos as a polished, dependable personal product. The product owner has chosen autonomous implementation with supervision. You should plan and implement most work yourself, run checks, fix issues, maintain concise documentation and surface only decisions that genuinely require the owner's account access, money, approval or product judgement.

**North star:** build the simplest system that faithfully delivers the spec. Avoid feature creep, speculative abstractions, unnecessary dependencies and infrastructure theatre.

Ethos is not a chatbot. The main experience is a visual dashboard with a refined CLI-inspired command surface.

## 2. Read before coding

At the start of work:

1. Inspect the repository and current git state. Do not overwrite or replace existing work blindly.
2. Read `ETHOS_BUILD_SPEC.md` and this file.
3. Identify the smallest useful vertical slice and its acceptance criteria.
4. Produce a short implementation plan for that slice, then begin. Do not create a large plan for the entire codebase before implementing anything.
5. If the repo is empty, scaffold the agreed stack. If it already contains useful code, adapt it incrementally.
6. Remember: NEVER MAKE ANY COMMIT ANYWHERE. Don't leave co-author trails or anything, still make sure to make proper commits with conventional commit msgs, but not too specific, just basic stuff, basic commits at proper intervals while say building a feature. make those commits and push but only if you aren't leaving a co-author trail.

Do not ask the owner to reconfirm decisions already present in the spec. Resolve ordinary implementation details independently using current official documentation.

## 3. Non-negotiable product constraints

- Single user, Google OAuth only. No public registration, teams, roles or multi-tenancy.
- No finances, no inactive TRACE project, no unapproved integrations.
- No conversational assistant UI. Commands and structured confirmations/status only.
- One highlighted Next Action; user can override immediately. Record overrides without judgement.
- Clear commands execute. Ambiguous captures go to Inbox. Ask only when an essential detail is missing.
- Duplicate candidates require confirmation; never silently merge.
- Do not automatically decompose a task into subtasks.
- Do not automatically create projects from ideas.
- Google Calendar is the only calendar provider initially and is authoritative for actual calendar events.
- Protect fixed commitments. Surface overload; never silently overbook or reshuffle.
- Daily LeetCode is a protected two-hour commitment with same-day recovery only.
- Missed weekly recurring commitments may redistribute remaining occurrences to preserve the weekly target, subject to real availability.
- Notes are raw Markdown, online-only, with two-minute dirty autosave. Do not add WYSIWYG editing, templates, daily notes, attachments, AI summaries, graph view or full-text body search.
- The Notes library uses nested folders, tags, `[[wiki-links]]` and backlinks.
- Dark and light themes are manually selected. Dark is the initial default.
- Do not make the dashboard user-customisable.
- No Kubernetes, microservices, service mesh or multiple databases.
- No automatic database restore or automatic application rollback.

## 4. Architecture rules

Use the agreed stack:

- Next.js App Router + TypeScript for UI/PWA.
- shadcn/ui + Tailwind CSS.
- Zustand for small global client state; TanStack Query for server state.
- Motion for React for general UI motion; anime.js only for selected bespoke effects/timelines.
- FastAPI for the REST backend (`/api/v1`).
- SQLAlchemy 2.0 + Alembic.
- PostgreSQL.
- One Python background worker.
- Docker Compose + Caddy on one Ubuntu VPS.
- GitHub Actions for CI and deployment.

Keep domain/business logic in FastAPI. Do not duplicate domain logic in Next.js API routes. The frontend should call the backend through a small typed API client.

Prefer a modular monolith organised by clear domains. Use explicit modules and direct relationships. Do not build a generic plugin framework, universal entity system, workflow engine or event-sourcing platform.

Keep the worker in the same backend codebase where practical. Select the smallest dependable durable job mechanism for scheduled reminders, calendar sync retries and weekly reports. Do not add Redis or another infrastructure dependency unless a demonstrated requirement justifies it.

Use PostgreSQL transactions and an outbox/pending-operation record where needed to avoid losing side effects between a database change and an external API call.

## 5. Engineering workflow

For each vertical slice:

1. Inspect relevant modules and existing conventions.
2. Implement backend model/schema/migration and business logic.
3. Implement API contract and error handling.
4. Implement frontend interaction and loading/empty/error states.
5. Add focused tests for core behaviour and edge cases.
6. Run formatting, linting, type checks, backend tests, frontend tests and relevant integration tests.
7. Update concise documentation and mark the slice complete.

Keep the default branch buildable. Use small branches/commits when helpful, but do not create a complicated Git process for a single-user repository. Never skip failing checks to force a deployment.

### Testing expectations

Use practical, high-value coverage:

- Backend unit tests for domain rules and scheduling decisions.
- API integration tests for task/project/goal/habit/note flows.
- Modular adapter tests for Google OAuth, Google Calendar and WhatsApp using mocks/fakes or provider test modes.
- Frontend component/interaction tests for important controls and command flows.
- A small number of end-to-end smoke paths for sign-in, dashboard, task creation, calendar sync and capture.

Do not create a massive test matrix or a test abstraction for every trivial component. Tests must protect the scheduling, sync, deletion, autosave and security behaviours that could lose data or create real-world consequences.

## 6. UI quality bar

Do not ship a generic admin template, empty card grid or placeholder aesthetic. Build the design system before expanding the page count.

Visual direction:

- Distinctive premium product identity.
- Cool dark graphite/charcoal/slate surfaces, muted blue/cyan accents.
- Clean, Claude-inspired typography and visual restraint, without copying Claude's layout or assets.
- Dense Command Centre home; spacious dedicated pages.
- Collapsible sidebar, manually switchable dark/light modes.
- Custom SVG charts/heatmaps/timelines for signature visualisations where they materially improve the experience.
- Skeleton loading states.
- Carefully designed empty, loading, error, success and disabled states.
- Purpose-built lightweight iPhone screens, not a shrunken desktop dashboard.

Animation rules:

- CSS for simple transitions.
- Motion for React for component/layout/interaction animation.
- anime.js for a small number of complex bespoke visual timelines.
- Never animate the same property of the same element with two libraries.
- Respect `prefers-reduced-motion` and avoid motion that delays task execution or reduces readability.
- Keep charts understandable without animation.

Use accessible contrast, keyboard navigation, visible focus, semantic controls and responsive layouts. Visual polish is a requirement, but not at the expense of speed, reliability or clarity.

## 7. Data safety and behaviour

- Use soft deletion with 30-day Trash and restoration.
- Project deletion cascades to its associated records; restoration restores the group.
- Keep archive separate from Trash; archived records stay searchable.
- Record task completion timestamps and habit occurrences.
- Note autosave occurs every two minutes only when dirty. Preserve unsaved content on failure and show save status.
- Note concurrent edits require conflict-aware merging; if merge is unsafe, preserve both versions and ask the owner to resolve. Never silently discard.
- Notes search must not index note-body content. Global search includes Notes by title/folder/tags only.
- File uploads are limited to 25 MB, stored using opaque paths on a persistent volume, included in backups and require confirmation before overwrite.
- Never trust a client-supplied filename as a filesystem path.
- Never log OAuth tokens, capture tokens or secrets.
- Do not claim a notification, WhatsApp message or capture succeeded until provider/API confirmation supports that state.

## 8. Calendar and scheduler safety

- Google Calendar is authoritative for external calendar events.
- Ethos stores sync state and stable external event IDs.
- Ethos task deadlines are distinct from work blocks and map to all-day calendar entries.
- Queue calendar writes when the provider is unavailable; visibly mark them unsynced.
- On conflicts, show both versions and let the owner choose. No silent overwrite.
- Protect fixed calendar commitments. If no valid slot exists, report the conflict rather than overbooking.
- Ordinary missed tasks are not automatically pushed to tomorrow.
- LeetCode recovery is same-day only; do not reduce two hours or roll it forward.
- Weekly recurring habit recovery may redistribute remaining occurrences during the same week, without moving fixed commitments.
- The default timezone is `Asia/Kolkata`, but timezone is configurable. Preserve local clock time for recurring schedules after timezone changes.
- Scheduling needs a duration. Implement a configurable default and a per-task override; do not add time tracking.

## 9. Security and integration rules

- Google OAuth is the only human sign-in mechanism.
- Encrypt OAuth tokens in PostgreSQL. Encryption keys live outside the database as VPS environment secrets. Document a secure key-recovery procedure.
- Use minimum OAuth scopes and handle revocation with graceful degraded mode.
- Use HTTPS, secure HTTP-only cookies, CSRF protection, input validation and secure headers.
- Keep PostgreSQL and Docker management interfaces off the public network.
- Use SSH keys and host/provider firewalls.
- Use revocable, narrowly scoped integration tokens only for capture clients where OAuth browser sessions are impractical. These do not create additional user accounts.
- Validate inbound WhatsApp provider signatures and the owner's sender identity.
- Use an approved WhatsApp Business provider. Do not implement unofficial WhatsApp Web scraping.
- Keep external service integrations behind small adapters. The natural-language model/provider and WhatsApp provider are not yet chosen. Do not hard-code one or block deterministic command flows on an LLM.

## 10. Deployment and operations

- One Ubuntu 24.04 VPS with Docker Compose and Caddy.
- Daily local and encrypted independent off-server backups, at least seven days retained. Back up PostgreSQL and file storage. Verify backup integrity.
- Local Docker/application logs with rotation; no external logging service initially.
- Monitor CPU, RAM, disk, containers, PostgreSQL, API, worker and uptime.
- VPS host recovery is manual.
- A failed database service may be safely restarted automatically; do not automatically restore from a backup.
- GitHub Actions runs required checks and deploys after a successful deployment-branch push/merge.
- Alembic migrations run during deployment and must be backward-compatible. Never run destructive data migrations casually.
- Application rollback is manual. Retain the previous release and document the commands/procedure.
- No automatic database rollback.

## 11. Handling ambiguity and owner involvement

Do not interrupt the owner for ordinary engineering details. Research current official docs, select a simple default and document it briefly.

Pause and request owner action only when a real external dependency requires it, such as:

- Google OAuth client setup or account consent.
- WhatsApp provider selection, business approval or paid plan.
- VPS purchase, domain/DNS or payment.
- Natural-language model/provider and budget approval.
- Recovery-key custody or another security-sensitive owner decision.

Do not invent credentials, claim a service is connected when it is not, or create paid resources without approval.

## 12. Documentation discipline

Maintain only useful documents:

- `ETHOS_BUILD_SPEC.md` — product requirements and architecture source of truth.
- `CLAUDE.md` — these agent instructions.
- `README.md` — local setup, required environment variables, run/test commands and high-level deployment notes.
- Short architecture decision records only for consequential decisions not covered by the spec.

Avoid creating a large collection of planning documents that duplicate the spec. Keep a small milestone checklist in the README or repository issue tracker. Document actual implementation choices; do not leave stale aspirational documentation.

## 13. Definition of done

A feature is done only when:

- It matches the product spec.
- It is integrated into the real application, not a disconnected demo.
- Loading, empty, error and success states are handled.
- Data validation and failure behaviour are reasonable.
- Relevant tests pass.
- No secrets are exposed.
- The UI meets the visual quality bar and works at desktop and intended mobile breakpoints.
- Documentation reflects the shipped behaviour.

When in doubt, choose the smallest implementation that preserves user control, data integrity and a polished experience.

# Ethos — Implementation Roadmap

This is the short execution checklist. The full product and technical requirements live in `ETHOS_BUILD_SPEC.md`; engineering operating rules live in `CLAUDE.md`.

## Phase 0 — Foundation

- [x] Inspect repository and preserve existing work.
- [x] Scaffold Next.js App Router + TypeScript frontend.
- [x] Scaffold FastAPI backend, SQLAlchemy 2.0, Alembic and PostgreSQL.
- [x] Add one Python worker process.
- [x] Add Docker Compose and Caddy configuration.
- [x] Add environment variable validation and secret-safe configuration.
- [x] Add health endpoints and local structured logs with rotation.
- [ ] Add GitHub Actions checks and deployment workflow. *(checks done; deployment workflow pending VPS)*
- [x] Establish typography, colour tokens, dark/light themes and responsive shell.

**Gate:** local stack starts cleanly; migration works; CI passes; secrets are not committed.

## Phase 1 — Usable personal workspace

- [ ] Google OAuth single-user login and owner allowlist. *(waiting on the owner's OAuth client)*
- [x] Core data model and migrations.
- [x] Tasks, projects, goals and habits CRUD.
- [x] Chronological Inbox with process/edit/dismiss/convert actions.
- [x] Trash and restore; configurable archive behaviour.
- [x] Notes: raw Markdown, nested folders, tags, wiki-links and backlinks.
- [x] Two-minute dirty autosave and basic note version history.
- [x] Global search with Notes limited to title/folder/tag matches.
- [x] Home Command Centre and dedicated module pages. *(agenda shows "not connected" until Phase 2)*
- [x] Manual quotes and daily rotation.

**Gate:** user can manage day-to-day records within Ethos without external capture integrations.

## Phase 2 — Google Calendar and scheduling

- [ ] Google Calendar OAuth scopes and connection status.
- [ ] External event import/update handling.
- [ ] Ethos time-block and all-day deadline event creation.
- [x] Task duration/default duration and slot selection.
- [x] Fixed-commitment protection and overload reporting. *(against Ethos blocks; Google events join once connected)*
- [ ] Pending sync queue and visible unsynced state. *(queue state and "not synced" UI done; the Google writer needs OAuth)*
- [ ] Conflict resolution showing both versions.
- [ ] Daily two-hour LeetCode same-day recovery.
- [ ] Weekly recurring-habit redistribution.
- [x] Configurable timezone, default `Asia/Kolkata`.

**Gate:** calendar changes do not disappear, conflicts are explicit and fixed events are protected.

## Phase 3 — Command and capture channels

- [x] `Ctrl+K` command palette with slash commands.
- [ ] Natural-language capture behind a provider adapter. *(adapter seam in place; waiting on a provider choice)*
- [x] Immediate execution for clear commands; clarification only when essential.
- [x] Duplicate detection and confirmation.
- [ ] Brain-dump classification without task-subtask decomposition.
- [x] 24-hour and 48-hour Inbox ageing indicators.
- [x] iPhone Shortcuts capture endpoint.
- [ ] WhatsApp Business capture/notification integration.
- [ ] Browser extension for full-page and selected-text Markdown clipping.

**Gate:** all captures are acknowledged accurately, ambiguous items remain visible and provider failures are observable.

## Phase 4 — Notifications, analytics and files

- [ ] Worker-backed reminders and limited retries.
- [ ] Fifteen-minute and scheduled-time reminders.
- [ ] Morning agenda and deadline alerts.
- [ ] Sunday WhatsApp metrics-and-observations report.
- [x] Weekly/monthly analytics.
- [ ] Habit consistency and selected quantitative tracking.
- [x] File storage on persistent VPS volume, 25 MB limit and overwrite confirmation.
- [ ] Project-associated file links and backup inclusion. *(links done; backups land with Phase 5)*
- [x] Concurrent note edit conflict detection/merge.
- [ ] PWA installability and purpose-built mobile screens.

**Gate:** scheduled work is durable, reports are factual and files/notes are recoverable.

## Phase 5 — Production hardening

- [ ] Daily local and encrypted off-server backups.
- [ ] At least seven-day backup retention.
- [ ] Automated backup integrity check and failure alert.
- [ ] Restore drill for PostgreSQL and uploaded files.
- [ ] Health monitoring: host, database, API, worker, containers and uptime.
- [ ] Manual VPS recovery runbook.
- [ ] Manual application rollback runbook.
- [ ] Verify OAuth token encryption and encryption-key recovery procedure.
- [ ] Review firewall, SSH, HTTPS, uploads, secrets and log redaction.
- [ ] Confirm archive, Trash and project cascade behaviour.
- [ ] Final accessibility, performance and visual QA.

**Gate:** owner can operate, back up, recover and deploy Ethos without undocumented manual steps.

## Procurement / owner actions (only when implementation reaches them)

The first prototype runs entirely on the owner's machine (`docker compose up`). Nothing before
VPS procurement may depend on a server, domain or public URL; integrations use localhost
redirect URIs and show an honest "not connected" state until credentials exist.

- Select a VPS after checking current total price, latency, CPU/RAM, NVMe, transfer, support and recovery features. Target 4 vCPU, 8 GB RAM, 100–160 GB NVMe; budget target ₹700–₹1,200/month with up to ₹1,800 if justified.
- Configure a domain and DNS.
- Create Google OAuth credentials and approve required scopes.
- Select an approved WhatsApp Business provider and review pricing/approval requirements.
- Select the natural-language model/provider and a usage budget.
- Select independent off-server backup storage.
- Securely store a recovery copy of the OAuth-token encryption key.

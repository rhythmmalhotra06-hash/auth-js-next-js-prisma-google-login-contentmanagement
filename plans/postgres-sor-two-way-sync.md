# Postgres system-of-record + two-way Airtable sync (tickets first)

## Context

Two meetings on Jul 1, 2026 set the direction:
- **Vishen + Muley (clips strategy):** rebuild on "proper infrastructure" — **Postgres, not
  Airtable** — for speed (Airtable is ~5 req/s, the Prio table exceeds 10k rows, and the portal
  needs real joins/transactions). Vishen separately wants **true memory** to power the *knowledge*
  layer (DNA / brand rules), via **BlinkWork** (through Shafiu) — a **separate track**, not this DB work.
- **Muley + Moniek (platform):** confirmed the **Postgres/Kessel** path.

The constraint the user restated: **"we have to feed in and out as a 2-way sync so Mindvalley can
see the data in Airtable *and* the portal."** The team keeps editing in Airtable; the portal is
fast on Postgres; the two stay in step within seconds.

**Where the code is today (verified):** the app is **Airtable-direct**. Tickets read
([lib/tickets/data.ts](lib/tickets/data.ts)) and write
([app/intake/actions.ts](app/intake/actions.ts) →
`lib/repositories/ticket.repository.ts`) straight to the Prio Requests table. This came from
[plans/airtable-direct-pivot.md](plans/airtable-direct-pivot.md),
which dropped Postgres **because deploy/schema mismatches kept breaking prod** (migrations landing
in the wrong DB; the deployed Prisma client expecting columns the real DB lacked; only `main`
auto-deploys serve traffic).

**Crucial asset:** the Postgres schema for exactly this sync **still exists and is complete** in
[prisma/schema.prisma](prisma/schema.prisma) — `Ticket`
(with `airtableId` + `airtablePushedAt` echo-suppression), `AirtableOutbox` (with the `drainOutbox`
design documented in-model), `TicketEvent`, `Approval`, `Asset`, and the reference models that are
**already synced one-way** from Airtable. The pivot removed the *usage*, not the *schema*. So this
is a **reverse migration + finishing the sync loop**, not a greenfield build.

**Decisions locked with the user:**
1. **Postgres = source of truth.** Portal reads *and* writes Postgres; sync mirrors PG↔Airtable.
2. **Tickets first**, then media/clips/Vishen videos.
3. **Inbound via a Kessel internal scheduled poll** (same-origin — bypasses the external IAP gate
   that blocks Airtable webhooks).

**Non-negotiable given the pivot's history:** the root cause of the pivot (DB/deploy drift) must be
fixed *before* PG becomes authoritative again — otherwise we re-break prod. That is Phase 0.

---

## Phase 0 — De-risk the Postgres deploy (prerequisite; the pivot's root cause)

**Concrete target (confirmed from `.kessel.json` + `.env` + user):**
- **Kessel project:** `auth-js-next-js-prisma-google-login-ContentManagement` (id `73a72afa-3d8f-40a4-afda-d4c038010760`).
- **Managed Postgres:** Cloud SQL instance `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`,
  database **`js_next_js_prisma_google_login_dev`**.
- **`DATABASE_URL` is NOT retrievable locally** — not in `kessel env list`, not in `kessel env pull`.
  It is **auto-injected at runtime inside the container only**. The **local prisma CLI cannot connect
  to the managed DB.** `prisma.config.ts` hard-requires the var to even load, so local `prisma
  generate`/`validate` need a placeholder: `export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"`.
- **DB access + DDL path (corrected):** the managed DB is reachable only via `kessel db query` /
  `kessel db migrate`. Its history is **Kessel-native raw-SQL** (`kessel db migrations`), NOT
  `_prisma_migrations` (that table doesn't exist). So **`prisma migrate deploy`/`resolve` is not
  available** — going-forward DDL = author in Prisma schema → `prisma migrate diff` to generate SQL →
  apply via `kessel db migrate`. The deploy pipeline is just `next build` (no auto-migrate), so repo
  migration files are artifacts, not enforced.

### ✅ Phase 0 outcome (done 2026-07-02)

- **One DB, confirmed.** `kessel status` shows the app + `kessel db` both on
  `js_next_js_prisma_google_login_dev` (the instance above) — the pivot's divergence is NOT present.
- **`main` serves** — latest deploy success (Vishen's Media #44).
- **Smoke read works** — reference tables populated: 212 employees, 99 asset types, 57 event types.
  All ticket-sync tables exist (`tickets`, `airtable_outbox`, `ticket_events`, `approvals`) with the
  expected columns; `tickets` is empty (0 rows — Phase 1 backfill fills it).
- **Drift found + closed (code-only, no prod DDL):** the live DB never had `tickets.blinklife_pushed_at`
  or the `blinklife_outbox`/`blinklife_refs` tables (migration 0007 was never applied), but the schema
  + `lib/blinklife/*` referenced them — a latent "client expects a column the DB lacks" failure that
  would fire the moment Prisma reads tickets. **Per user decision, the dormant BlinkLife track was
  removed:** deleted `lib/blinklife/`, `scripts/push-blinklife.ts`, `app/api/push/blinklife/`, migration
  `0007_blinklife_push`, and the `BlinkLifeOutbox`/`BlinkLifeRef` models + `Ticket.blinklifePushedAt`.
  Schema now matches the live DB exactly. `prisma validate` + `prisma generate` + `tsc --noEmit` + lint
  all clean. (Re-add as a fresh **BlinkWork** integration when the true-memory track starts.)

**Exit criteria met:** schema == live DB, client regenerates, project typechecks. Proceed to Phase 1.

---

## Implementation status (2026-07-02)

**Phase 1 — code complete, not yet deployed/backfilled/verified.**
- Added 10 delivery/detail columns to `Ticket` (`download_link`, `project_program`, `asset_folder_link`,
  `working_files`, `final_16x9`/`folder_16x9`, `final_9x16`/`folder_9x16`, `final_4x5`/`folder_4x5`);
  migration `0009_ticket_delivery_fields` **applied to the managed DB via `kessel db migrate`** + verified.
- New [lib/airtable/ticket-upsert.ts](lib/airtable/ticket-upsert.ts) `upsertTicketsFromRecords` (shared by
  backfill + Phase 3 pull). New [app/api/sync/backfill-tickets/route.ts](app/api/sync/backfill-tickets/route.ts)
  (bearer-gated; `?all=true` mirrors the full ~9k set — recommended for uniform PG reads).
- Rewrote all reads in [lib/tickets/data.ts](lib/tickets/data.ts) to Prisma, preserving `QueueTicket`/
  `TicketDetail` shapes + scoring/order. Person/calendar ids exposed as **Airtable recIds** (relation
  `airtableId`) so recId-based filters keep working. `teamLead`/`dimensions` derived from PG asset-type
  joins; `team` falls back to `teamServiceLevel` (creativeServiceType not stored). `tsc`+`lint`+`build` clean.
- **Not shipping to `main` alone** (PG reads + Airtable writes = stale queue). Bundle with Phase 2.

**Phase 2 — design refined against the real code (NOT yet built):**
- Write call sites (not the plan's assumed `app/manager/actions.ts`, which doesn't exist):
  - [app/intake/actions.ts](app/intake/actions.ts) `createTicket` (also called by social/media/content-engine).
  - [app/tickets/[id]/actions.ts](app/tickets/[id]/actions.ts): `updateTicketStatus`, `updatePrioStatus`,
    `assignTicket`, `requestApproval`, `decideApproval`, `updateTicketLink`.
  - [app/studio/actions.ts](app/studio/actions.ts): prio→In Queue, sign-off approve/revise, and the
    `queueRank` **rating** write (queueRank is a 1–5 rating, not a position — no bulk `setQueueOrder`).
  - All currently go through `lib/repositories/ticket.repository.ts` (Airtable-direct) → rewrite to Prisma
    `$transaction` writing the PG row + a `TicketEvent` + an `AirtableOutbox` enqueue.
- **Reference resolution:** `resolve-reference.ts`/`ensureReferenceRows` does NOT exist. Resolve intake
  recIds→PG uuids via Prisma `airtableId` lookup (reuse the idMap pattern in `ticket-upsert.ts`); lazy-fetch
  a single reference row if not yet mirrored.
- **Drainer:** `drainOutbox()` extends [lib/airtable/push-map.ts](lib/airtable/push-map.ts)
  `ticketToAirtableFields` to include the new delivery columns; pushes via `rest.ts`
  `createRecords`/`updateRecords`, stamps `airtableId` + `airtablePushedAt`. Bearer route `POST /api/sync/push`.
- **Notify triggers need rework:** [lib/notify/triggers.ts](lib/notify/triggers.ts) reads the ticket from
  **Airtable by recId** — breaks once ids are PG uuids. Rewrite to read from PG (name/email from PG employee),
  and move the asset-ready dedupe off the Airtable "Asset Ready Notified" checkbox onto a **new PG flag column**
  (`asset_ready_notified` — another small `kessel db migrate`). On create, the Airtable recId doesn't exist
  until the drainer pushes, so notify must key off the PG ticket, not the recId.

**Phase 2 — code complete (2026-07-02), not yet deployed.** `tsc`+`lint`+`build` clean.
- New PG write layer [lib/tickets/write.ts](lib/tickets/write.ts): `updateTicket` (patch + status
  `TicketEvent` + outbox enqueue, all in one `$transaction`) and `createTicketRow` (recId→uuid
  resolution with a `syncReference` retry fallback, seeds first event + outbox).
- Rewrote write call sites to the PG layer: [app/intake/actions.ts](app/intake/actions.ts),
  [app/tickets/[id]/actions.ts](app/tickets/[id]/actions.ts), [app/studio/actions.ts](app/studio/actions.ts).
- Drainer [lib/airtable/push.ts](lib/airtable/push.ts) `drainOutbox` (collapses rapid edits per ticket,
  create-or-update by `airtableId`, stamps `airtableId`+`airtablePushedAt`, gated by `AIRTABLE_PUSH_ENABLED`)
  + route [app/api/sync/push/route.ts](app/api/sync/push/route.ts). Extended
  [push-map.ts](lib/airtable/push-map.ts) with the delivery columns, project/download, shoots, and
  **queueRank** (it's a 1–5 rating here, so it IS two-way — corrected the old exclusion).
- Rewrote [lib/notify/triggers.ts](lib/notify/triggers.ts) to read the ticket + contacts from Postgres;
  moved the asset-ready dedupe onto the new `asset_ready_notified` column (migration `0010`, applied).
- Old Airtable write fns in `lib/repositories/ticket.repository.ts` are now orphaned (kept; `listActiveTickets`
  read is still used by the shoots page).

**Phase 3 — code complete (2026-07-02).** `tsc`+`build` clean.
- Created the Airtable cursor field on the Prio table via MCP: **"App Last Modified (sync)"**
  `fld3auCPy53ekstlF` = `DATETIME_FORMAT(LAST_MODIFIED_TIME(),'YYYY-MM-DD HH:mm:ss')` (UTC, watches all
  fields). Added to [field-map.ts](lib/airtable/field-map.ts) as `TICKETS.fields.lastModified`.
- `SyncState` cursor table (migration `0011`, applied). New [lib/airtable/pull.ts](lib/airtable/pull.ts)
  `pullTickets`: incremental `IS_AFTER` filter on the cursor; **echo-suppression** (skip within ~90s of
  `airtablePushedAt`), **last-writer-wins** (Airtable newer → import + "updated from Airtable" event;
  portal newer → re-enqueue a push). Reuses `upsertTicketsFromRecords`. Route
  [app/api/sync/pull/route.ts](app/api/sync/pull/route.ts). The backfill route seeds the cursor so the
  first pull is incremental, not a 10k rescan.

**Phase 4 — code complete (2026-07-02).** Admin-gated [app/admin/sync/page.tsx](app/admin/sync/page.tsx)
+ [lib/sync/health.ts](lib/sync/health.ts): tickets-in-PG, outbox pending/failed, last push, pull-cursor
lag, and recent push failures.

### Cutover (deploy 1–4 together) — pending user go-ahead
1. Merge branch → `main` (auto-deploys; `next build` runs no migrations — DDL already applied via
   `kessel db migrate` for `0009`–`0011`). 2. `POST /api/sync/reference`. 3. `POST /api/sync/backfill-tickets?all=true`
   (mirrors tickets into PG + seeds the pull cursor). 4. Verify: queue/board/detail read from PG and match
   Airtable; portal create/edit → Prio record updates via `POST /api/sync/push` (`Name`/`SCORE` untouched);
   edit a ticket in Airtable → `POST /api/sync/pull` imports it (no ping-pong); check `/admin/sync`.
   5. Schedule Kessel internal crons: push drain ~1–2 min, pull ~2–3 min, plus the periodic `syncReference`.
   6. `AIRTABLE_PUSH_ENABLED=true` is already set in prod.

---

## Phase 1 — Backfill + make Postgres the READ source for tickets

**Goal:** the queue/board/detail views read from Postgres (fast, relational), while writes still go
to Airtable for now (unchanged) — so we can validate PG reads against live data with zero write risk.

1. **Backfill active tickets Airtable → PG.** Reuse the existing Stage-1 upsert in
   [lib/airtable/migrate.ts](lib/airtable/migrate.ts)
   (refactor its per-record ticket upsert into `upsertTicketsFromRecords(records)` per the
   interim-hybrid plan). Import the **active** set only (`NOT(Done OR Won't Do)` — the same filter
   `lib/tickets/data.ts` already uses), keyed on `airtableId`. Leave the ~9k Done history in Airtable
   (surface it via a read-through fallback, below). Reference FKs already resolve — reference tables
   are mirrored by `syncReference()`.
2. **Rewire ticket reads to Prisma.** Reimplement `getQueueTickets`, `getTicketDetail`,
   `getMyRequests`, `getRequestsForScope`, `getRecentShipped` in
   [lib/tickets/data.ts](lib/tickets/data.ts) against
   Prisma (`lib/prisma.ts`), preserving the exact `QueueTicket`/`TicketDetail` shapes so the UI is
   untouched. The blended scoring (`blendQueueScore`, `dueProximityNorm`, `campaignProximityNorm`)
   and the `queue_rank`-then-blended ordering move server-side onto PG rows — now a real
   `ORDER BY queue_rank NULLS LAST, priority_score DESC` plus the app-side urgency blend.
   `TicketEvent`/`Approval` (currently returned empty) become real PG-backed history again.
3. **Read-through fallback for the Done archive.** `getTicketDetail`/`getMyRequests` on a ticket not
   in PG (old Done history) fall back to the current Airtable read path — so nothing 404s while only
   the active set is mirrored.
4. **IDs.** Reads now return **PG UUIDs**; the app already round-trips ticket ids opaquely through
   detail/action routes, so keep `airtableId` on the row for the sync layer and expose the UUID as
   the app id.

**Exit criteria:** queue/board/detail render identically from Postgres; a manual `syncReference` +
backfill makes them match Airtable; reads are sub-second on the active set.

---

## Phase 2 — Rewire ticket WRITES to Postgres + turn on the outbound drainer (PG → Airtable)

**Goal:** the portal writes Postgres as system of record; every write enqueues an outbox row in the
same transaction; a background drainer pushes current state to Airtable so the team sees it.

1. **Writes → Postgres + enqueue, atomically.** Rewrite the write paths to Prisma inside
   `prisma.$transaction`, enqueuing an `AirtableOutbox` row (by `ticketId`) in the same txn:
   - `app/intake/actions.ts` `createTicket` (create the PG row; resolve reference recIds→UUIDs via
     the existing `lib/airtable/resolve-reference.ts` / `ensureReferenceRows` pattern).
   - `app/tickets/[id]/actions.ts` (status / assign / approve = status→Approved/In Revision / add
     delivery-link fields) — each also writes a `TicketEvent` for audit.
   - `app/manager/actions.ts` `setQueueOrder` (batch `queueRank` updates — one txn, one outbox row
     per ticket).
   - `app/studio/actions.ts` sign-off transitions.
2. **Turn on the drainer.** Implement `drainOutbox()` per the design already documented on the
   `AirtableOutbox` model: pull `pending` rows, load current ticket state, batch **≤10 records**
   create/update to the Prio table via
   [lib/airtable/rest.ts](lib/airtable/rest.ts)
   (`createRecords`/`updateRecords`), **429 exponential backoff**, store the returned recId on
   `ticket.airtableId`, stamp `ticket.airtablePushedAt`, mark rows `done`/`error` with `attempts`.
   Reuse [lib/airtable/push-map.ts](lib/airtable/push-map.ts)
   `ticketToAirtableFields` — it **already excludes** the formula fields (`Name`, `SCORE`) and
   `queueRank`-as-rating that 400 the batch, and writes links as recId arrays.
3. **Trigger.** Bearer-gated `POST /api/sync/push` (copy the auth pattern in
   `app/api/sync/reference/route.ts`), driven by a **Kessel internal scheduled job** every ~1–2 min.
   (No external IAP problem — the job is same-origin.)

**Exit criteria:** create/status/assign/reorder in the portal → the Prio record appears/updates
within a drain cycle; `Name`/`SCORE` untouched (no 400s); `airtableId`/`airtablePushedAt` set.

---

## Phase 3 — Inbound pull (Airtable → PG) + conflict handling (the two-way close)

**Goal:** a Mindvalley editor's Airtable edit lands in Postgres within a poll cycle, without
ping-ponging against our own writes.

1. **Add a LAST_MODIFIED field on the Prio table** `tblhrRl8GzsDMv0DD` (none is mapped today):
   an Airtable **"Last Modified Time" watching *all* fields** — or pull silently misses edits. Add
   its `fld…` id to `TICKETS` in
   [lib/airtable/field-map.ts](lib/airtable/field-map.ts).
   *(Manual Airtable step by Rhythm.)*
2. **`lib/airtable/pull.ts` `pullTickets({ since })`.** A `SyncState { key, value, updatedAt }` row
   (new small model) holds the watermark; `listModifiedSince` uses `filterByFormula` on LAST_MODIFIED
   to fetch only changed records; feed them through the shared `upsertTicketsFromRecords` from
   Phase 1 (zero new mapping code). Bearer-gated `POST /api/sync/pull`.
3. **Echo suppression + conflict = last-writer-wins with a grace window** (the field
   [prisma/schema.prisma](prisma/schema.prisma)
   already carries for this):
   - **Echo:** if an incoming record's Airtable modified time is within ~90s *after*
     `ticket.airtablePushedAt` and the fields equal what we pushed → skip (our own write echoing).
   - **Conflict:** record-level last-modified-wins. Airtable newer than `ticket.updatedAt` → import
     + write an `"updated from Airtable"` `TicketEvent` for provenance. Portal newer → skip and
     re-enqueue a push to re-assert. (Field-level merge is out of scope — disproportionate for an
     interim brain-nodes will replace.)
4. **Schedule.** Kessel internal cron: **pull ~every 2–3 min**, **push drain ~every 1–2 min**, plus
   the existing periodic `syncReference` reconcile as the safety net (webhooks/polls can drop).

**Exit criteria:** edit a ticket's status in Airtable → it reflects in the portal within a cycle
with an audit event; a portal write does **not** bounce back; conflicting both-side edits resolve
last-modified-wins.

---

## Phase 4 — Sync health surface (small, but do it)

A bearer/admin view (extend `/admin`) showing: last pull watermark + lag, last reconcile, outbox
depth, failed pushes (`status='error'`, `attempts`, `lastError`). Makes "is Airtable in step?"
answerable and catches drift early. Reuse the admin access gate in `lib/admin/access.ts`.

---

## After tickets prove out (explicitly out of scope for this build)

- **Media / Clip Suggestions / Vishen videos → Postgres-SoR.** Today Airtable-direct
  (`lib/media/repository.ts`, `lib/media/vishen-videos.ts`) with cross-base Airtable automations
  (`docs/airtable-automations/*`). Apply the same backfill → PG-read → PG-write+outbox → pull loop
  once the ticket loop is stable. Reconcile the existing cross-base automations with the new PG-SoR
  model at that point (they currently keep two Airtable bases in step, not PG).
- **True memory (Vishen's ask) — separate track.** DNA/brand rules/insights as a notes-wiki in
  **BlinkWork** (true-memory engine), integrated via Shafiu. This is the *knowledge* layer; it does
  **not** replace the workflow DB above. Depends on the BlinkWork read API (the current
  `lib/blinklife/` push targets BlinkLife and must be retargeted). Tracked in
  [plans/jul1-2026-meetings-plan.md](plans/jul1-2026-meetings-plan.md) §C.

---

## Reuse map (don't rebuild)

| Need | Already exists |
|------|----------------|
| Ticket / outbox / event / approval schema | `prisma/schema.prisma` (complete, incl. `airtablePushedAt`) |
| Reference mirror Airtable→PG | `lib/airtable/sync.ts` `syncReference()` + mapping helpers |
| Ticket upsert from Airtable records | `lib/airtable/migrate.ts` (refactor → `upsertTicketsFromRecords`) |
| PG→Airtable field serialization (excludes formula fields) | `lib/airtable/push-map.ts` `ticketToAirtableFields` |
| Rate-limited Airtable REST (429 backoff, batch ≤10) | `lib/airtable/rest.ts` (`createRecords`/`updateRecords`/`getRecord`/`listAll`) |
| Reference recId→UUID resolution at write time | `lib/airtable/resolve-reference.ts` `ensureReferenceRows` |
| Bearer-gated sync route pattern | `app/api/sync/reference/route.ts` |
| Blended scoring / ordering | `lib/tickets/scoring.ts`, `lib/scoring-config/repository.ts` |

## Riskiest parts (watch these)
1. **Phase 0 deploy contract** — the exact thing that caused the pivot. Do not skip; verify in prod.
2. **Echo correctness** — the ~90s grace window + field-equality check; the audit event is the backstop.
3. **LAST_MODIFIED coverage** — must watch *all* fields or pull silently misses edits.
4. **Burst writes** from `setQueueOrder` — the outbox decouples them; watch drain cadence vs 5 req/s.
5. **ID cutover** — reads switch from Airtable recIds to PG UUIDs; keep `airtableId` on rows and
   verify every detail/action route round-trips the new id.

## Simpler fallback (if full two-way is too heavy for the interim)
Ship **Phase 0–2 only** (PG-SoR + push-out), and keep **pull reference-only** — declaring the portal
the sole writer of ticket transactional state. This removes all conflict logic and matches the
documented end-state (Airtable as connector). Recommended starting posture if Airtable-side ticket
edits by the team turn out to be rare; add Phase 3 pull if/when the team edits tickets in Airtable.

## Verification (end-to-end, per the app — the only real backend)
- **Phase 0:** `prisma migrate status` clean against managed DB; a deployed Prisma read returns rows;
  confirm the serving revision is the `main` deploy.
- **Phase 1:** backfill + `syncReference`; queue/board/detail render from PG and match Airtable;
  a Done-history ticket still opens via the read-through fallback. Sub-second active reads.
- **Phase 2:** create/status/assign/reorder in the portal → Prio record appears/updates within a
  drain cycle; `Name`/`SCORE` untouched; verify no 400s; `airtableId`/`airtablePushedAt` set.
- **Phase 3:** edit status in Airtable → reflects in portal within a cycle + `"updated from Airtable"`
  event; portal write does not ping-pong; both-side conflict resolves last-modified-wins.
- **Phase 4:** health view shows lag/outbox depth/failures.
- No test runner configured — verification is manual + `npm run lint` + `npm run build`, and
  cross-checking rows via the Airtable MCP (`list_records_for_table`).

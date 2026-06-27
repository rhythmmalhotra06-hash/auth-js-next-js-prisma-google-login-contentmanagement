# Pivot: Airtable-direct backend (drop Postgres entirely)

## Context

The Postgres mirror has been the source of every recent failure: migrations landing in the wrong
database, schema drift, the app and `kessel db` pointing at different databases, and the discovery that
**only `main` auto-deploys actually serve traffic**. Ticket creation is broken in prod because the
deployed Prisma client expects columns the app's real DB lacks.

**Decision (user):** replicate the **vendor portal** pattern — Airtable as the *direct* backend, no
Postgres, no Prisma, no sync/outbox. Build all logic/workflow/inputs as Airtable fields on existing
tables. This dissolves the entire DB-mismatch problem (no DB to mismatch) and matches a proven, working
in-house app.

**Reference implementation to replicate** (`/Users/rhythmmalhotra/Documents/GithubDev/auth-js-next-js-prisma-google-login-vendorportal`):
- `lib/airtable/client.ts` — rate-limited (200ms/queue) Airtable REST client, 429 retry, `AirtableResult<T>`
  discriminated-union returns, `listRecords/getRecord/createRecord/updateRecord` with
  `filterByFormula`/`fields`/`offset`.
- `lib/repositories/base.repository.ts` + `vendor.repository.ts` / `vendor-request.repository.ts` —
  **repository pattern**: typed records, `RepositoryResult<T>`, lookup-id extraction, field-subset fetches,
  manual pagination.
- `lib/airtable/constants.ts` — all field IDs centralized.
- `lib/auth.ts` — **JWT sessions, NO DB adapter**; resolves the user's employee record from the Employees
  table on sign-in and stores `employeeId`/`role` in the JWT.
- `app/page.tsx` (server component, parallel Airtable reads) + `app/actions/*` (server actions → repos).

## User's simplifying constraints (avoid new tables — collapse onto existing Prio Requests fields)

- **Approvals** → `Ticket Status` transitions. The live enum already has `Review`, `Approved`,
  `In Revision` — no separate Approvals table/entity. Reviewer feedback goes in a notes/comment field.
- **Audit trail** → Airtable's built-in record revision history. Drop the in-app `ticket_events` log.
- **Assets (raw/final versioning)** → existing Prio fields: `rawFileUrl`, `outputLink`,
  `final16x9/9x16/4x5`, `assetFolderLink`.
- **Priority score** → existing Airtable `SCORE` formula field; manual order via existing `queueRank`
  ("Priority ranking (Manual)"). Drop the app-side score-service entirely.
- **Content-Engine** → stateless: transcript → generate strategy (Anthropic) → show → convert selected
  clips to tickets via the Airtable ticket create. Don't persist strategies/suggestions (no tables).
- **BlinkLife** → direct best-effort push on ticket create/status; store any external ref id in a single
  Prio field if strictly needed (else fire-and-forget). No outbox/refs tables.
- Only unavoidable new **fields** (not tables): `positioning`, `audience` on Prio if we keep those intake
  inputs — otherwise fold them into the Creative Brief. Decide during build; default to folding in to keep
  Airtable untouched.

## Process / de-risking (recommended by dev+PM — no full PRD)

Requirements are settled (replicate the vendor portal; it *is* the spec). The errors we keep hitting are
**schema/contract** errors, not requirements errors — so the rigor goes there, not into a PRD narrative.

1. **Lock the data contract first** (validate live Airtable schema via MCP; see below). Decide field
   mappings before code.
2. **POC vertical slice first:** ship ONE thin end-to-end path (queue **read** + one status **write**,
   Airtable-direct, JWT auth) to `main` and verify live. Proves the riskiest assumptions cheaply —
   Airtable CRUD, auth-without-DB, rate-limit/caching, and that the `main` deploy actually serves.
3. **Then phase the rest**, running `/verify` in the real app and `/code-review` on each diff before every
   merge to `main`.

## Validated data contract (live Airtable, confirmed 2026-06-27 via MCP)

Prio Requests `tblhrRl8GzsDMv0DD` single-selects (collapse target — confirms "no new tables" works):
- **Ticket Status** `fldanOtkhcohQbnK1`: Backlog · To Do · In Progress · Review · In Revision · **Approved** ·
  Done · Won't Do · Shipping · Request on Hold → approval = move to `Approved`; request-changes = `In Revision`.
- **Prio Status** `fldFH3scvUfjnOwhg`: New Request · To be reviewed by Vishen · In Queue · Pending
  Information/Brief Not Clear · Rejected - No need to work · Assigned.
- **Type of Request** `fldlfaGYlYlTxNy1s`: Video · Design.
- **Team/Service Level** `fldHGT2p5SObJEzPh`: Content Video · Ad Creatives Video · Social Media Video ·
  Event Design Graphic · Brand Design Graphic · Pathway Organic.
- TODO during build: confirm whether `positioning`/`audience` fields exist on Prio (the field-map lacks
  them); if not, fold those intake inputs into the Creative Brief rather than add fields.

## Architecture

- **Data layer:** upgrade `lib/airtable/client.ts` to the vendor-portal shape (`AirtableResult`,
  single-record create/update, `filterByFormula`, `fields`, pagination) — keep the existing 220ms pacing +
  429 backoff. Add `lib/repositories/` (`ticket.repository.ts`, `reference.repository.ts`,
  `employee.repository.ts`) returning typed records mapped via `lib/airtable/field-map.ts` (extend it as the
  single field-id source, mirroring vendor `constants.ts`).
- **Auth:** drop `@auth/prisma-adapter`; switch to **JWT strategy** (copy vendor `lib/auth.ts`). Resolve
  employee via Airtable email lookup at sign-in, cache; store `employeeId`/`role` in the JWT. This also ends
  the `Invalid Compact JWE` session breakage.
- **Reads:** server components read repos directly (`Promise.all`), filtered by status via
  `filterByFormula` and paginated; wrap hot reads (queue, reference) in a short cache (reuse the 60s TTL
  pattern already in `reference-live.ts`) so the >10k Prio table and 5 req/s cap aren't a problem — the
  active working set is small once filtered to non-`Done`/`Won't Do` statuses.
- **Writes:** server actions call repo `create/update` against the Prio table directly (no outbox). Link
  fields written as arrays of reference recIds (intake already serves recIds via `reference-live.ts`).

## Build phases (one cohesive migration on a branch, shipped via `main`)

1. **Client + repos foundation:** upgrade `client.ts`; add `lib/repositories/*` + extend `field-map.ts`.
   Map the Prio record ↔ a `Ticket` type (reusing existing UI's expected shape).
2. **Auth → JWT:** rewrite `lib/auth.ts`, `lib/employee.ts` (Airtable email lookup), `middleware.ts`;
   remove Prisma adapter.
3. **Reads:** rewrite `lib/tickets/data.ts` (`getQueueTickets`, `getTicketDetail`, `getActiveEmployees`)
   and confirm `lib/intake/data.ts` is pure-Airtable (drop the Postgres fallback). Map approvals/assets
   from Prio fields; ordering by `SCORE`/`queueRank`.
4. **Writes:** rewrite `app/intake/actions.ts` (`createTicket` → Prio create with link recIds),
   `app/tickets/[id]/actions.ts` (status/assign via field updates; approve = status→Approved/In Revision;
   addAsset = set URL field), `app/manager/actions.ts` (`setQueueOrder` = batch `queueRank` updates; drop
   `recomputePriority`/`syncToAirtableNow`).
5. **Content-Engine + BlinkLife:** make clipping stateless (generate→convert-to-ticket); BlinkLife push
   direct/best-effort. Remove their Postgres reads/writes.
6. **Rip out Postgres:** delete `prisma/`, `lib/prisma.ts`, `app/generated/prisma/`, `prisma.config.ts`,
   `lib/airtable/sync.ts`, `migrate.ts`, `outbox.ts`, `push.ts`, `instrumentation.ts`,
   `app/admin/db-repair`, `app/api/debug`, `app/api/sync`, `scripts/*sync*`/`*migrate*`,
   `lib/blinklife/outbox.ts`+`push.ts` (repurpose to direct). Remove `@prisma/*`, `@auth/prisma-adapter`,
   `pg` from `package.json`. Drop `--database`/`DATABASE_URL` usage. Revert the temporary `db-repair`/
   diagnostic commits from `main`.

## Deploy & verify
- **Ship via `main` only** — confirmed the sole track that serves production traffic (branch/detached
  `kessel deploy`s build non-serving revisions). Each phase merges to `main` → auto-deploy.
- Set `AIRTABLE_API_KEY` (already present) to a token with `data.records:read`+`write`; remove DB env reqs.
- **Verify through the app** (the only thing on the real backend): submit intake → a new row appears in the
  Prio table (`tblhrRl8GzsDMv0DD`); queue/manager show live Airtable tickets; status change/assignment
  reflect on the record within a refresh; approve = status→Approved; convert a clip → ticket row created.
  Cross-check rows via the Airtable MCP (`list_records_for_table`).

## Risks / tradeoffs (accepted)
- **No transactions / no FK integrity** — a multi-write action can partially apply; mitigate by ordering
  writes and surfacing errors via `RepositoryResult`. Acceptable per vendor-portal precedent.
- **Rate limit (5 req/s) + >10k Prio rows** — mitigate with `filterByFormula` (active statuses only),
  field-subset fetches, pagination, and short read caches.
- **Lost in-app audit log + approval history** — replaced by Airtable revision history (per user choice).
- **Content-Engine strategy history not persisted** — stateless for now; revisit if needed.

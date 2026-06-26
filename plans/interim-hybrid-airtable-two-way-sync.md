# Interim HYBRID: live Airtable reference + two-way ticket sync

## Context

The team lives in Airtable today, and the portal mirrors it one-way (Airtable → Postgres) via a **manual** reference sync. That just bit us: new asset types added in Airtable didn't show in the intake form because the sync hadn't run. The ask: for the interim, make Airtable feel like the live backend — reference data current in real time, and tickets flowing **both ways** so the team can keep editing in Airtable *and* the portal without divergence.

Why not "just point everything at Airtable": the Postgres mirror exists on purpose. Airtable's API is ~5 req/sec with monthly caps, the tickets table exceeds 10k records, and the app depends on relational features Airtable can't do (`$transaction` for queue-reorder/status+audit atomicity/approval gates, a 7-way join for ticket detail, `_count` in scoring, `ORDER BY queue_rank NULLS LAST, priority_score DESC`). Also, the current Airtable client ([lib/airtable/client.ts](lib/airtable/client.ts)) is **read-only** — there is no write layer to flip on.

**Decision (confirmed with user): HYBRID.** Postgres stays system of record for tickets (keeps the queue/board fast and transactional); Airtable becomes the live source for reference data and a two-way peer for ticket state. This is additive and isolated under `lib/airtable/`, matching the documented HYBRID direction in CLAUDE.md, so it's cheap to retire when nouns move to brain nodes.

This builds on the calendar-optional fix already made in [app/intake/actions.ts](app/intake/actions.ts) and [components/intake/IntakeForm.tsx](components/intake/IntakeForm.tsx).

---

## Phase 1 — Live reference reads (fixes the staleness now)

**Goal:** intake dropdowns reflect Airtable's current asset/event types within ~60s, without breaking ticket FK integrity.

The tension: ticket FK columns (`eventTypeId`, `assetTypeId`, `requesterId`, `officialCalendarId`) point at Postgres reference UUIDs. A brand-new Airtable asset type shown in the dropdown isn't mirrored yet, so a `ticket.create` referencing it would violate the FK.

**Approach — live-read for display, lazy-upsert-on-select for integrity:**

1. **Refactor [lib/airtable/sync.ts](lib/airtable/sync.ts)** to export its per-record mapping helpers (`mapAssetType`, `mapEventType`, etc.) so they can be reused without duplicating field logic.
2. **New `lib/airtable/reference-live.ts`** — `getLiveIntakeReference()` reads EVENT_TYPES + ASSET_TYPES (and authors/calendars) live via `listRecords`, with a ~60s in-memory TTL cache. Returns options keyed by **Airtable recId** (stable whether or not mirrored). Asset→Event filtering uses the Airtable eventType recId arrays already in the map.
3. **Modify [lib/intake/data.ts](lib/intake/data.ts)** `getIntakeReferenceData` to serve the live lists, with a **Postgres fallback** if Airtable is slow/down so intake never hard-fails. Option values become recIds.
4. **New `lib/airtable/resolve-reference.ts`** — `ensureReferenceRows({eventTypeRecId, assetTypeRecId, requesterRecId, officialCalendarRecId, authorRecIds})`: for each recId, look up Postgres by `airtableId`; if missing, fetch that single record (new `getRecord` client fn) and upsert via the shared mapper, rebuilding asset-type join rows. Returns our UUIDs.
5. **Modify [app/intake/actions.ts](app/intake/actions.ts)** `createTicket` to call `ensureReferenceRows` first and use the resolved UUIDs. [app/content-engine/actions.ts](app/content-engine/actions.ts) delegates to `createTicket`, so it's covered.

Queue/detail reads in [lib/tickets/data.ts](lib/tickets/data.ts) are **unchanged** — they keep joining on Postgres reference names, which now always resolve because the chosen rows are guaranteed present. **No schema change in Phase 1.**

---

## Phase 2 — Push (portal → Airtable) via an outbox

**Why an outbox, not synchronous:** four write paths (`updateTicketStatus`, `assignTicket`, `decideApproval`, `setQueueOrder`) run inside `prisma.$transaction`. Awaiting a 220ms+ Airtable call there blocks the txn or silently diverges on failure; the 5 req/s cap makes per-write calls fragile under burst (`setQueueOrder` rewrites N tickets at once). So enqueue cheaply in-txn; drain in the background.

1. **Schema additions ([prisma/schema.prisma](prisma/schema.prisma)):**
   - `AirtableOutbox { id, ticketId, op, enqueuedAt, attempts, lastError }` — enqueue **by ticketId** (not a field snapshot) so the drainer always pushes current state.
   - `Ticket.airtablePushedAt DateTime?` — echo-suppression window for Phase 3. (`Ticket.airtableId` already exists for the returned recId.)
2. **Extend [lib/airtable/client.ts](lib/airtable/client.ts)** with `getRecord`, `createRecords`, `updateRecords` (batch ≤10/request). Factor the existing pacing + 429-backoff loop into a private `request()` and reuse it.
3. **New `lib/airtable/push-map.ts`** — inverse of the `TICKETS` read map. **Critically excludes formula fields `name` (fld59SWr1qd1XPuR0) and `score` (fldjY4VfI44oGmtuS)** — writing them 400s the whole batch. Link fields write as arrays of reference `airtableId`s.
4. **New `lib/airtable/outbox.ts`** — `enqueueTicketPush(tx, ticketId, op)`, a local INSERT safe inside existing `$transaction` arrays. Call it from every ticket write path (intake create, manager reorder/recompute, ticket status/prio/assign/approval/asset actions).
5. **New `lib/airtable/push.ts`** `drainOutbox()` — pull pending rows, fetch current ticket state, batch create/update to Airtable, store returned recId on `ticket.airtableId`, stamp `airtablePushedAt`, clear/retry rows. Triggered by a bearer-gated **`POST /api/sync/push`** copying the auth pattern in [app/api/sync/reference/route.ts](app/api/sync/reference/route.ts).

---

## Phase 3 — Pull (Airtable → portal) + conflict handling

**IAP constraint:** the deployed service is behind Google IAP; the existing [.github/workflows/reference-sync.yml](.github/workflows/reference-sync.yml) is disabled because a plain bearer curl is rejected. Inbound Airtable **webhooks are therefore also blocked**. Pull must be **polling**, initiated from a **Kessel internal scheduled job** (same-origin, bypasses external IAP rejection) — preferred — or the GitHub Action + Google OIDC wiring already scaffolded in that workflow header.

1. **Verify/create a LAST_MODIFIED field** on the Prio table `tblhrRl8GzsDMv0DD` (none is mapped today). Must be a `Last Modified Time` watching **all** fields, or pull misses edits. Add its field ID to the `TICKETS` map.
2. **Refactor [lib/airtable/migrate.ts](lib/airtable/migrate.ts)** Stage-1 ticket upsert into a reusable `upsertTicketsFromRecords(records)` so pull reuses it with zero new mapping code.
3. **New `lib/airtable/pull.ts`** `pullTickets({ since })` — `SyncState` cursor row holds the last-modified watermark; `listModifiedSince` uses `filterByFormula` on the LAST_MODIFIED field to fetch only changed records; feed through `upsertTicketsFromRecords`. Triggered by bearer-gated **`POST /api/sync/pull`**.
4. **Conflict strategy — origin-marker + last-modified-wins with a grace window:**
   - **Echo suppression (kills ping-pong):** if an incoming record's Airtable modified time is within ~90s *after* `ticket.airtablePushedAt` and fields match what we pushed, skip — it's our own write echoing back.
   - **Genuine conflict:** record-level last-modified-wins. Airtable newer than `ticket.updatedAt` → import; portal newer → skip and re-enqueue a push to re-assert.
   - Every pull-overwrite writes an `"updated from Airtable"` `TicketEvent` for audit provenance. (Field-level merge rejected as disproportionate for an interim brain nodes will replace.)
5. **Schema:** add `SyncState { key, value, updatedAt }` (or reuse an existing settings row if present) for the watermark.

---

## Infra / config
- Swap the Airtable token for one with `data.records:write` scope: `kessel env secret AIRTABLE_API_KEY=...`.
- Create/verify the Prio `LAST_MODIFIED` field; add its ID to `field-map.ts`.
- Schedule **pull** every ~2–3 min and **push drain** every ~1–2 min via a Kessel internal job (preferred over the IAP-blocked GitHub Action).

## Riskiest parts (watch these)
1. **Echo correctness** — the 90s grace window + field-equality check. Mitigated by the audit event and a generous window.
2. **Formula/lookup fields** — pushing `name`/`score` 400s the batch; `push-map.ts` must exclude them (verified against live schema).
3. **Burst writes** from `setQueueOrder` — the outbox decouples them; watch drain cadence vs 5 req/s.
4. **LAST_MODIFIED coverage** — must watch all fields or pull silently misses edits.

## Simpler fallback (if full two-way is too heavy for interim)
Ship **Phase 1 + Phase 2 push only**, and make pull **reference-only** (re-enable `reference-sync.yml`), declaring the portal the sole writer of ticket transactional state for the interim. This removes all conflict logic, matches the documented end-state (Airtable as connector), and is the lowest-risk path. Recommend starting here if Airtable-side ticket edits are rare.

---

## Verification
- **Phase 1:** add an asset type in Airtable → it appears in intake within ~60s with no sync run; submit a ticket using it → row created, FK resolves, the asset type is now in Postgres.
- **Phase 2:** create/update/reorder tickets in the portal → outbox drains → records appear/update in the Prio table; `name`/`score` untouched; verify no 400s.
- **Phase 3:** edit a ticket's status in Airtable → within a poll cycle it reflects in the portal with a `"updated from Airtable"` event; do a portal write and confirm it does **not** ping-pong back; make conflicting edits both sides and confirm last-modified-wins.
- Run `npm run lint` and `npm run build`; smoke-test queue/board still load fast (Postgres-backed reads unchanged).

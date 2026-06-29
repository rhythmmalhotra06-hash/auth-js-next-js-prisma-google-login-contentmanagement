# Build — complete the genuine loose ends (A / B / C / D)

## Context

The product evaluation flagged "half-finished loops." Reading the actual code showed the original inventory was stale: the approval panel and asset upload are largely built, and the "outbox drainer" is **obsolete** — the app pivoted to *Airtable-direct* (all writes go straight to Airtable; `syncToAirtableNow`/`setQueueOrder` are intentional no-ops; `AirtableOutbox` + `push-map.ts` are dead scaffolding).

The user chose to fix the **real** gaps found on inspection: **A** decision lock + approvals, **B** persist queue reorder, **C** delete dead code, **D** audit-trail panel.

## C — Delete dead code (no DB)
- Delete [components/tickets/SyncAirtableButton.tsx](../components/tickets/SyncAirtableButton.tsx) — orphaned, imported by no page.
- Delete [lib/airtable/push-map.ts](../lib/airtable/push-map.ts) — dead; only a *comment* in `lib/blinklife/map.ts` mentions it (leave blinklife untouched).
- Remove the no-op `syncToAirtableNow` from [app/manager/actions.ts](../app/manager/actions.ts).
- Remove `model AirtableOutbox` from [prisma/schema.prisma](../prisma/schema.prisma) (folded into B's migration).

## A — Decision lock + approvals (no DB)
- [lib/tickets/data.ts](../lib/tickets/data.ts) `getTicketDetail`: synthesize `approvals[]` from ticket status — `Review`→`pending`, `Approved`→`approved`, `In Revision`→`changes_requested` (id = ticketId). This makes the panel render the correct state and exposes the decide buttons when pending (today `approvals` is always `[]`, so they never render).
- [components/tickets/ApprovalPanel.tsx](../components/tickets/ApprovalPanel.tsx): fix `decide()` to pass **ticketId** to `decideApproval` (it currently passes the approval row id — a latent bug).
- [app/tickets/[id]/actions.ts](../app/tickets/[id]/actions.ts) `updateTicketStatus`: enforce the lock — reject a move to a `GATED_STATUSES` value (`Shipping`) unless the ticket's current Airtable status is `Approved`. Read current status via `getRecord`; return a clear error otherwise.

## D — Audit-trail panel (no DB)
- [app/tickets/[id]/page.tsx](../app/tickets/[id]/page.tsx): the "Lifecycle history" list is always empty (`events: []` under Airtable-direct). Render it only when events exist; otherwise show a short note that status history lives in Airtable's record revision history. (Populating `ticket_events` would mean re-adding Postgres writes on every status change — out of scope; noted as a future option.)

## B — Persist queue reorder (needs DB migration)
- [prisma/schema.prisma](../prisma/schema.prisma): add `model QueueRank { recordId String @id  rank Int  updatedAt DateTime @updatedAt }`. Same migration drops `AirtableOutbox`.
- Run `npx prisma migrate dev --name queue_rank_and_drop_outbox` + `npx prisma generate`.
- [app/manager/actions.ts](../app/manager/actions.ts) `setQueueOrder`: upsert a rank (= array index) per ordered id.
- [lib/tickets/data.ts](../lib/tickets/data.ts) `getQueueTickets`: load ranks via one `prisma.queueRank.findMany`, apply rank override ahead of the Airtable score fallback (replaces today's reliance on the unwritable 1–5 Airtable rating field).

**Caveat:** B reintroduces a small Postgres read on the queue path (one cheap query) — aligned with CLAUDE.md's "queue order is app-owned state in Postgres," and it touches architecture fork #1. Migration needs `DATABASE_URL`; if no local DB is running, the code lands but the migration must be applied where the DB lives.

## Sequencing & verification
Order: **C → A → D** (pure code), then **B** (migration last).
- `npm run lint` and `npm run build` must pass; no references to deleted files remain.
- Manual: on a ticket — *Request approval* → status `Review`; approve / request-changes render and work; setting `Shipping` without `Approved` is blocked with a message, allowed once `Approved`.
- Manager queue — drag to reorder, refresh, order persists.

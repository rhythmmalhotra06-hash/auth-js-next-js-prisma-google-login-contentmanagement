# Plan: Link Content Management ↔ BlinkLife

## Context

Vishen (the "Vision" stakeholder) can't see what content is being produced, by whom, or how it performs — the core problem this whole repo exists to solve. The Creative Services team is **already adopting BlinkLife** (the personal life-OS) — its one project today, "Mindvalley Revenue," contains tasks like *"Send markdown meeting notes to all teams via BlinkLife."* So BlinkLife is where the team already lives day-to-day.

The goal: push the Content Management portal's work into BlinkLife so that (1) **editors** see their assigned tickets as real tasks in their list, (2) **Vishen** gets a weekly read-only "Content Review" summarizing what shipped and (later) how it performed, and (3) **briefs/decisions** land in BlinkLife's searchable memory.

### Key constraint discovered (drives the phasing)
BlinkLife's only known API is its **MCP endpoint** (`https://api.blinklife.com/api/v1/mcp`, JSON-RPC over HTTP). The bearer token we have is **personal to `rhythm@mindvalley.com`**, and the MCP `create_task`/`update_task` tools **do not expose `assignedTo` or project sharing** — even though the data model has `sharedProjects`/`assignedTo`/`sharedTasks`. So with what we have today we can only write into *one* BlinkLife account.

**Therefore (user decision "decide after a spike"):** build everything against a **single shared "Content Production" project** under the one token now, behind an identity seam, and run a parallel spike to confirm whether a team/assignment API or per-user token grant exists — then upgrade to per-user with zero rework.

## Approach

Mirror the existing, proven Airtable outbound pattern (`lib/airtable/client.ts` + `lib/airtable/sync.ts` + bearer-protected `/api/sync/*` route + `scripts/sync-*.ts` CLI), but talking to BlinkLife's MCP instead of Airtable's REST.

### New module: `lib/blinklife/`

- **`client.ts`** — MCP-over-HTTP client. One `callTool(name, args)` that POSTs JSON-RPC `tools/call` with `Authorization: Bearer ${token}` and `Accept: application/json, text/event-stream`, parses `result.content[0].text` (JSON string), and reuses the **rate-limit + exponential-backoff on 429/5xx** logic copied from [lib/airtable/client.ts:23-50](../lib/airtable/client.ts#L23). Token read via the identity seam below.
- **`identity.ts`** — the upgrade seam. `getToken(employee?)` returns `process.env.BLINKLIFE_TOKEN` today; `getTargetProject(employee?)` returns the shared "Content Production" project for everyone today. Both take the employee so per-user routing slots in later without touching callers.
- **`map.ts`** — pure mappers (mirrors the `mapEmployee`/`mapEventType` style in [lib/airtable/sync.ts:37-92](../lib/airtable/sync.ts#L37)):
  - `ticketToTask(ticket)` → `{ title, description, due_date, due_time, priority }`.
    - **Title** (shared-project MVP): `[${assignee.name}] ${title}` so the editor is visible without per-user routing.
    - **Priority** map (BlinkLife 1=Critical…4=Low) from `priorityScore` buckets (tunable): top quartile→1, then 2/3/4; fall back to `prioStatus` ("To be reviewed by Vishen"→2).
    - **due_date** from `ticket.dueDate`.
    - **description**: creative brief + CTA + event/asset type + a deep link back to `/tickets/{id}` on the portal.
  - `shippedThisWeek(tickets)` → grouping for the Vishen page (by editor, with asset distribution URLs + any `performance` rows).
  - `briefToMemoryContent(ticket)` → structured markdown for `import_profile`.
- **`push.ts`** — the operations (mirrors `syncReference`, all `{ dryRun }`-aware and idempotent):
  - `ensureProject()` — find "Content Production" via `list_projects` or create it; cache its id in `BlinkLifeRef` (kind `project`).
  - `pushTicketTask(ticketId)` — upsert one ticket's task: create if no ref, else `update_task`; when `ticketStatus ∈ {Done, Shipping, Published}` → `complete_task`; when `Won't Do`/`Rejected` → complete/skip. **Only mirrors assigned/in-queue tickets** (skip `New Request`/`Rejected`).
  - `pushAllTickets({ dryRun })` — the reconcile: select tickets where `updatedAt > blinklifeSyncedAt`, loop `pushTicketTask`.
  - `pushVishenReview()` — build a markdown "Content Review — week NN" from our Postgres (shipped assets grouped by editor + performance), `create_page` (or `update_page` if ref exists) with `visibility: PRIVATE` then generate a private link; store page id in `BlinkLifeRef`. *(Note: created in the token-holder's BlinkLife; share the private link with Vishen until per-user lands.)* Optionally also a `create_note` **chart** (bar: assets shipped per editor) for an at-a-glance visual.
  - `pushBriefMemory(ticketId)` — `import_profile` with the structured brief on create; `capture_conversation` with a synthetic exchange on approval decisions.

### New table: `BlinkLifeRef` (Prisma + migration)
Tracks external ids so syncs are idempotent and updatable, without bloating `Ticket`:
```prisma
model BlinkLifeRef {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  kind       String   // 'project' | 'ticket_task' | 'vishen_review_page' | 'brief_memory'
  ticketId   String?  @map("ticket_id") @db.Uuid
  externalId String   @map("external_id")
  syncedAt   DateTime @default(now()) @map("synced_at") @db.Timestamptz
  @@unique([kind, ticketId])
  @@map("blinklife_refs")
}
```
Also add `blinklifeSyncedAt DateTime?` to `Ticket` (mirrors the existing `syncedAt` Airtable column) so the reconcile can diff cheaply.

### Real-time hooks (fire-and-forget, env-gated)
After the DB write in each transition, call `void pushTicketTask(id).catch(logError)` — never block or fail the user action. Guard every call with `if (!process.env.BLINKLIFE_ENABLED) return;` so local dev / missing-token is a clean no-op.
- [app/intake/actions.ts](../app/intake/actions.ts) — after create + auto-assign (~line 115): push task + `pushBriefMemory`.
- [app/tickets/[id]/actions.ts](../app/tickets/[id]/actions.ts) — in `assignTicket` (~L58), `updateTicketStatus` (~L14), `decideApproval` (~L92): push task; on approval, also `pushBriefMemory` (decision).

### Scheduled reconcile (catches anything real-time missed)
- **`app/api/push/blinklife/route.ts`** — bearer-protected exactly like [app/api/sync/reference/route.ts](../app/api/sync/reference/route.ts) (`runtime='nodejs'`, `timingSafeEqual` on `BLINKLIFE_SYNC_SECRET`); `POST` runs `pushAllTickets({ dryRun })`, and on a `?review=true` param also `pushVishenReview()`.
- **`scripts/push-blinklife.ts`** — CLI mirroring [scripts/sync-reference.ts](../scripts/sync-reference.ts) for manual runs + `--dry-run`.
- **Schedule it via Kessel's internal job runner**, not an external curl: per prior note, the deployed app sits behind IAP, so external scheduled curls are blocked without a Google OIDC token. Reconcile every ~15 min; `pushVishenReview` weekly (Monday AM).

### Env vars (add to [.env.example](../.env.example))
```
BLINKLIFE_ENABLED=          # "1" to turn pushes on
BLINKLIFE_MCP_URL=https://api.blinklife.com/api/v1/mcp
BLINKLIFE_TOKEN=            # secret (kessel env secret); personal token for now
BLINKLIFE_SYNC_SECRET=      # bearer for /api/push/blinklife (or reuse SYNC_SECRET)
```
Deploy: `kessel env secret BLINKLIFE_TOKEN=… BLINKLIFE_SYNC_SECRET=…` then `kessel env set BLINKLIFE_ENABLED=1` before `kessel deploy`.

### Parallel spike (the "decide after" track — no code, gating per-user upgrade)
Ask the BlinkLife team (Slack/their docs): (a) does the MCP or REST API support assigning a task to another user / sharing a project programmatically? (b) can we mint per-user tokens (OAuth or service grant) so editors/Vishen get tasks in *their own* accounts? Outcome decides whether Phase 2 = per-user routing (just fill in `identity.ts`) or stays single-project + shared links.

## Critical files
- New: `lib/blinklife/{client,identity,map,push}.ts`, `app/api/push/blinklife/route.ts`, `scripts/push-blinklife.ts`, Prisma migration for `blinklife_refs` + `Ticket.blinklifeSyncedAt`.
- Edit: [app/intake/actions.ts](../app/intake/actions.ts), [app/tickets/[id]/actions.ts](../app/tickets/[id]/actions.ts), [prisma/schema.prisma](../prisma/schema.prisma), [.env.example](../.env.example).
- Reuse/mirror: [lib/airtable/client.ts](../lib/airtable/client.ts) (backoff), [lib/airtable/sync.ts](../lib/airtable/sync.ts) (upsert/dry-run shape), [app/api/sync/reference/route.ts](../app/api/sync/reference/route.ts) (auth), [scripts/sync-reference.ts](../scripts/sync-reference.ts), [lib/employee.ts](../lib/employee.ts) (assignee email/name), [lib/tickets/constants.ts](../lib/tickets/constants.ts) (status enums).

## Verification (end-to-end)
1. `npx prisma migrate dev --name blinklife_refs` then `npx prisma generate` — schema applies, client regenerates to `app/generated/prisma/`.
2. **Dry run:** `npx tsx scripts/push-blinklife.ts --dry-run` — prints mapped tasks; assert title/priority/due_date look right, no writes.
3. **Live single ticket:** assign a real test ticket → confirm a task appears via curl `list_tasks` on the "Content Production" project (right title `[Name] …`, priority, due date, portal link in description).
4. **Status flow:** move ticket Backlog→In Progress→Done → task updates then `complete_task` fires; verify with `list_tasks`. **Idempotency:** run the reconcile twice → no duplicate tasks (one `BlinkLifeRef` per ticket).
5. **Vishen review:** `POST /api/push/blinklife?review=true` → `get_page` confirms the markdown page exists; open its private link; chart note (if built) renders with an insight line.
6. **Memory:** create a ticket → `search` BlinkLife for a brief keyword returns the captured memory.
7. **Gating:** unset `BLINKLIFE_ENABLED` → all hooks no-op, user actions unaffected.

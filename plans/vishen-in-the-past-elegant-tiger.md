# E10 · Editor Tasks — sub-tasks under Creative Requests

## Context

Vishen has been leaving editor instructions on his video and clip records for months. In the
`Vishen Lakhiani Media` base (`appvBtCYdaSrD1y11`), the `🎞️ Clips` table carries a `To Do`
multi-select with exactly four options — **Polish: Trim, Post IG, Post YT, Enact Feedback** —
alongside free-text `Next Step`, `Feedback` and `Notes`. Only **3 clips** ever had `To Do`
populated. The real instructions live in prose:

> "Next step is to trim out the ums, the ahs, the pauses… then get this to Glenn to go on
> YouTube. Also create a vertical version… pass to Glenn to get on Instagram."

That is three tasks, two owners, one text box. Titus has now asked how to turn this into an
actual workflow.

The gap it exposes is general, not Vishen-specific: **`Ticket` is completely flat.** There is no
sub-task, checklist or hierarchy anywhere in the schema (`prisma/schema.prisma:268`). `Asset` rows
are the only 1:N children and they model deliverable files, not work steps. The one prior attempt
at hierarchy — E9.8 multi-asset requests — was deferred. So an editor who is told "do these four
things before this ships" has nowhere to track them, and Titus has no way to see what was asked,
by whom, or how long it has been sitting.

**Outcome:** a lightweight task record that hangs off a Creative Request, owned by one editor,
with its own tiny lifecycle — visible in both Airtable (where the team reviews) and the portal
(where editors work), kept in step by two-way sync.

### Decisions taken (2026-08-20)

| Decision | Choice |
|---|---|
| Scope | **Tickets only.** Sub-tasks under Creative Requests. Not clips, videos or shoots. |
| Data home | **New Airtable table + Postgres two-way sync.** PG is system of record. |
| Creation paths | **Manual** (portal + Airtable) and **promote-task-to-ticket**. No templates, no AI extraction in v1. |
| Blocking | **Advisory only.** An open task never blocks a status transition. |

### Known limitation, accepted

Tickets-only does not reach Vishen's original case end-to-end. His clips do become tickets via the
existing clip→ticket conversion (E8.4), so those are covered. His 341-row `Videos` table
(`tblcqpctTr76RQsQT`) never becomes tickets, so prose feedback there stays unstructured. Extending
`TicketTask` to clips/videos later is an **additive migration** (nullable parent FKs), not a
rewrite — the model below is shaped so that stays true.

---

## Data model

### Airtable — new table `✅ Ticket Tasks` in Creative Services (`appFEFygXo2pRc8AR`)

| Field | Type | Notes |
|---|---|---|
| `Name` | singleLineText | Primary — the task title |
| `🎯 Ticket` | multipleRecordLinks → `tblhrRl8GzsDMv0DD` | Parent, required |
| `Status` | singleSelect | `To Do · In Progress · Blocked · Done · Won't Do` |
| `Assignee` | multipleRecordLinks → `👬 Employees` `tbllP5vRon54L7Ccf` | |
| `Requested By` | multipleRecordLinks → `👬 Employees` | Who asked (Vishen, Titus, …) |
| `Due date` | date | |
| `Order` | number | Manual ordering within a ticket |
| `Notes` | richText | Detail / instructions |
| `Completed At` | dateTime | Stamped on transition to `Done` |
| `Promoted Ticket` | multipleRecordLinks → `tblhrRl8GzsDMv0DD` | Set when promoted into its own request |
| `App Task ID` | singleLineText | Correlation id, app-set (mirrors `App Clip ID` convention) |
| `App Last Modified (sync)` | formula | `DATETIME_FORMAT(LAST_MODIFIED_TIME(),'YYYY-MM-DD HH:mm:ss')` — pull cursor |

On the Prio table, Airtable auto-creates the reverse link. Add two **rollups** there —
`Open Tasks` (count where Status is not Done/Won't Do) and `Tasks Done` — computed in Airtable, so
they need no sync and give the team Airtable-side views for free.

> **Creation caveat:** the API token has failed to create single-select *options* before (see the
> `Team/Service Level` incident). Create this table and its select options **by hand in Airtable**,
> or via `mcp__claude_ai_Airtable__create_table`, then export the schema
> (`Context/export-airtable-schema.js`) and read real `fld…` ids from
> `Context/airtable-schema/creative_services.raw.json`. Never hand-type field ids.

### Prisma — `prisma/schema.prisma`, migration `prisma/migrations/0019_ticket_tasks`

```prisma
model TicketTask {
  id               String    @id @default(cuid())
  ticketId         String
  ticket           Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  title            String
  notes            String?
  status           String    @default("To Do")
  assigneeId       String?
  requesterId      String?
  dueDate          DateTime? @db.Date
  order            Int       @default(0)
  completedAt      DateTime?
  promotedTicketId String?
  airtableId       String?   @unique
  airtablePushedAt DateTime?
  syncedAt         DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([ticketId, order])
  @@index([assigneeId, status])
}
```

`assigneeId` / `requesterId` are `Employee` relations — follow how `Ticket.assigneeId` is declared
(`prisma/schema.prisma:277-281`) including named relations, since `Employee` will now be referenced
twice from this model.

New `lib/tasks/constants.ts`, mirroring the style and the "no server imports" rule of
`lib/tickets/constants.ts`:

```ts
export const TASK_STATUSES = ['To Do', 'In Progress', 'Blocked', 'Done', "Won't Do"] as const;
export const OPEN_TASK_STATUSES = ['To Do', 'In Progress', 'Blocked'] as const;
```

Do **not** reuse `TICKET_STATUSES` — the two axes stay separate, per the standing spec rule.

---

## Sync — the established 7-step transactional recipe

Follow the shoots/social/vishenVideo precedent exactly. Each step names the file to copy from.

1. **`lib/airtable/field-map.ts`** — add `export const TICKET_TASKS = { baseId, tableId, fields, links, status_ } as const`, keyed on real `fld…` ids. Copy the shape of `SHOOTS` (line 77).
2. **`lib/airtable/ticket-task-upsert.ts`** — Airtable record → PG upsert on `airtableId`. Shared by backfill and pull. Copy `shoot-upsert.ts`.
3. **`lib/airtable/ticket-task-backfill.ts`** + **`app/api/sync/backfill-ticket-tasks/route.ts`** — copy `shoot-backfill.ts` and its route. **Must call `seedPullCursor`** (`lib/airtable/pull-core.ts:47`) after the backfill, or the first pull mass-re-asserts every row.
4. **`lib/airtable/pull-ticket-tasks.ts`** — implement `PullDomain`, register in `lib/airtable/pull-registry.ts:25` gated on `ticketTasksArePostgres()`.
5. **`lib/airtable/ticket-task-push-map.ts`** + a `PushHandler` entry `ticketTask` in `lib/airtable/push-registry.ts:186`. Follow `vishenVideoHandler` (line 178) for the `load` / `stampOps` shape; omit nulls in the field payload so a portal write can never clear a value the team set in Airtable.
6. **`lib/tasks/{backend,data.postgres,write.postgres,data}.ts`** — the standard dispatcher pair behind a `TASKS_BACKEND` flag, copying `lib/shoots/`. Ship with the flag defaulting to Airtable, flip after backfill.
7. Every mutation enqueues `AirtableOutbox { entity: 'ticketTask', entityId }` **in the same transaction as the write** (`prisma/schema.prisma:354`).

**Echo-window risk to design around.** `pull-core.ts:11-22` uses a 90-second time-only echo
suppression with last-writer-wins. Task status is the highest-write-frequency field we will have
synced. Mitigate by keeping PG authoritative for portal writes and treating the pull purely as
"pick up team-side Airtable edits" — do not add optimistic client-side retries that re-push the
same row inside the window.

---

## Portal surfaces

Read [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) and load the `artifact-design` skill before writing
any of this UI. Reuse `components/ui/*` primitives (`Button`, `Badge`, `Field`/`Input`/`Select`,
`Icon`, `SearchableSelect`) — no raw hex, no arbitrary Tailwind sizes, no inline `style` for
spacing or colour.

### 1. `components/tickets/TaskPanel.tsx` — the checklist (primary surface)

Renders on `/tickets/[id]` alongside `AssetPanel` and `ApprovalRows` (`app/tickets/[id]/page.tsx`).
Shows tasks ordered by `order`, each row: status control, title, assignee, due date, and an
overflow action. Inline "add task" row at the bottom (title + assignee + due). Reorder by
drag. A task with a `promotedTicketId` shows a link chip to the new request.

### 2. Server actions — `app/tickets/[id]/actions.ts`

Extend the existing file (it already holds `updateTicketStatus`, `assignTicket`, `requestApproval`
et al at line 23). Add `createTicketTask`, `updateTicketTaskStatus`, `assignTicketTask`,
`reorderTicketTasks`, `deleteTicketTask`, `promoteTaskToTicket`. Guard each one the same way the
existing actions are guarded — and note that **API routes guard themselves** here; `await auth()`
being present is not the same as being guarded (`lib/api/guard.ts`).

`updateTicketTaskStatus` stamps `completedAt` on entry to `Done` and clears it on exit.

### 3. `/editor` — "My tasks"

A section beneath the existing queue in `app/editor/page.tsx`: open tasks assigned to the selected
editor, grouped by parent ticket, each linking to `/tickets/[id]`. Reuse the page's existing
`?assignee=` param (line 73) — **do not** try to fix the session-identity gap here; that page picks
the editor from a query param rather than the signed-in user, and changing it is out of scope.

### 4. `QueueTable` — progress affordance

Add a compact `3/5` task-progress indicator. It must come **after** the mandated first five
columns (Title, Priority, Assigned, Ticket Status, Priority Status) — that header is fixed across
every list view. Respect the existing card-reflow behaviour at mobile breakpoints.

### 5. `/manager` — open tasks by editor

An advisory summary near `FunnelCapacity` in `app/manager/page.tsx`: open task count per editor and
the oldest open task age. Purely informational — nothing blocks.

### Promote task → ticket

Reuses the clip→ticket conversion pattern (`app/media/actions.ts:176`) and the existing
`createTicket` path (`app/intake/actions.ts:48`). The new ticket inherits event type, asset type,
official calendar and requester from the **parent** ticket; title = task title, creative brief =
task notes. On success, stamp `promotedTicketId` and link it in Airtable.

**Promotion links, it does not auto-close.** Leave the task in its current status and let a human
close it — silently completing someone's task on their behalf is the kind of thing that erodes
trust in the board.

---

## Files to create / modify

**Create:** `lib/tasks/{constants,backend,data,data.postgres,write.postgres}.ts` ·
`lib/airtable/{ticket-task-upsert,ticket-task-backfill,pull-ticket-tasks,ticket-task-push-map}.ts` ·
`app/api/sync/backfill-ticket-tasks/route.ts` · `components/tickets/TaskPanel.tsx` ·
`prisma/migrations/0019_ticket_tasks/migration.sql`

**Modify:** `prisma/schema.prisma` · `lib/airtable/field-map.ts` ·
`lib/airtable/{pull-registry,push-registry}.ts` · `app/tickets/[id]/{page.tsx,actions.ts}` ·
`app/editor/page.tsx` · `app/manager/page.tsx` · `components/tickets/QueueTable.tsx` ·
`DESIGN_SYSTEM.md` (only if the panel introduces a new pattern)

---

## PRD authoring

Author with the `/prd` skill, matching how E8 and E9 were created — both were `import`ed from a
plan file and carry `imported-from: "plans/<slug>.md"`.

```
/prd import plans/vishen-in-the-past-elegant-tiger.md
```

Scope **epic**, parent `prd/content-production-management.md`, target
`prd/content-production-management/editor-tasks.md`, numbered **E10** (next free; E1–E9 taken).
Epic template sections: Purpose · User Stories · Workflows · Boundaries · Dependencies ·
Success Criteria · Features.

Proposed features:

| # | Feature | Purpose |
|---|---|---|
| E10.1 | Task data layer & two-way sync | Airtable table, Prisma model, the 7-step sync recipe |
| E10.2 | Ticket task panel | The checklist on `/tickets/[id]` |
| E10.3 | Editor "My tasks" | Open tasks on `/editor`, progress in `QueueTable` |
| E10.4 | Promote task to ticket | Escape hatch into a full Creative Request |
| E10.5 | Manager task visibility | Advisory open-task load on `/manager` |

Skill conventions to honour: number in the `index.md` link text and the `# H1` with a middle-dot
separator (`E10 · Editor Tasks`); breadcrumb `> Part of [<Parent>](../content-production-management.md)`;
ISO dates; a section counts as unresolved if it contains `[UNRESOLVED]`.

Also update: the `## Epics` table in `prd/content-production-management.md` (columns
`# | Epic | Purpose | Depends on | Phase`; E10 depends on **E5**, Phase 1), that file's `children:`
array, a row in `prd/index.md`, and the running total line at its foot.

---

## Verification

1. **Schema** — `npx prisma generate`, then apply the migration against the Kessel-managed
   Postgres. Per the standing constraint, the managed DB is reachable only through
   `kessel db` — use `kessel db migrate <file.sql>`, not `prisma migrate deploy`.
2. **Backfill + cursor** — `POST /api/sync/backfill-ticket-tasks`, confirm row counts match
   Airtable, and confirm `SyncState` has a seeded cursor before enabling the pull runner.
3. **Round trip, Airtable → portal** — add a task by hand in Airtable, run
   `POST /api/sync/pull?entity=ticketTask`, confirm it appears on `/tickets/[id]`.
4. **Round trip, portal → Airtable** — tick a task to `Done` in the portal, confirm the outbox
   drains and the Airtable row shows `Done` with `Completed At` stamped. Wait out the 90s echo
   window and confirm the next pull does **not** revert it.
5. **Promotion** — promote a task, confirm the new ticket inherits the parent's taxonomy, that
   `Promoted Ticket` links in Airtable, and that the source task is still open.
6. **Advisory guarantee** — with an open task on a ticket, move that ticket through every status
   including `Shipping`. Nothing may be blocked. `GATED_STATUSES` stays `['Shipping']`, unchanged.
7. **Surfaces** — run the app (`npm run dev`), check `/tickets/[id]`, `/editor`, `/manager` in
   light and dark, and at mobile width confirm `QueueTable` still reflows to cards with the five
   mandated columns intact.
8. `npm run lint` and `npm run build` clean.

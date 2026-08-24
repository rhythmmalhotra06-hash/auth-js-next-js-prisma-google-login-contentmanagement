---
title: 'E10 · Editor Tasks'
slug: 'editor-tasks'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-08-20
updated: 2026-08-20
resolution: 6/7
imported-from: "plans/vishen-in-the-past-elegant-tiger.md"
---

# E10 · Editor Tasks

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Vishen has been leaving editor instructions on his video and clip records for months. In the `Vishen Lakhiani Media` base (`appvBtCYdaSrD1y11`), the `🎞️ Clips` table carries a `To Do` multi-select with exactly four options — **Polish: Trim, Post IG, Post YT, Enact Feedback** — alongside free-text `Next Step`, `Feedback` and `Notes`. Only **3 clips** ever had `To Do` populated. The real instructions live in prose:

> "Next step is to trim out the ums, the ahs, the pauses… then get this to Glenn to go on YouTube. Also create a vertical version… pass to Glenn to get on Instagram."

That is three tasks, two owners, one text box. Titus has now come back asking how to turn this into an actual workflow — with tasks the editors can pick up as part of the workflow, in Airtable and visible in the portal.

The gap it exposes is general, not Vishen-specific: **`Ticket` is completely flat.** There is no sub-task, checklist or hierarchy anywhere in the schema (`prisma/schema.prisma:268`). `Asset` rows are the only 1:N children and they model deliverable files, not work steps. The one prior attempt at hierarchy — E9.8 multi-asset requests — was deferred. So an editor told "do these four things before this ships" has nowhere to track them, and Titus has no way to see what was asked, by whom, or how long it has been sitting.

A task like "trim two seconds off the end" is emphatically **not** a Creative Request: it has no event type, no asset type, no complexity score. Pushing these into the Prio queue would pollute prioritization and skew every delivery metric. This epic therefore introduces a genuinely lightweight second object — a sub-task hanging off a Creative Request, owned by one editor, with its own small lifecycle — rather than stretching `Ticket` to cover both.

**Outcome:** the ask, the owner, and the state of every small unit of work is recorded where the team already reviews (Airtable) and where editors already work (the portal), kept in step by two-way sync.

## User Stories

- **As Vishen (or any requester)**, I want to write the three things I actually want changed on a request as three separate items with owners, so the second and third do not get lost in a paragraph.
- **As an editor**, I want to see the checklist attached to my ticket, tick items off as I finish them, and have that visible to whoever asked — so I am not re-explaining progress in WhatsApp.
- **As an editor**, I want one place that lists every open task assigned to me across all my tickets, so I can see my real workload rather than just my ticket count.
- **As Titus (manager)**, I want to see how many open tasks sit with each editor and how long the oldest has been waiting, so I can spot someone quietly buried.
- **As an editor or manager**, when a "small task" turns out to be real production work, I want to promote it into its own Creative Request without retyping the taxonomy.
- **As a team member who works in Airtable**, I want to add and complete tasks in Airtable and have the portal reflect it — and vice versa — so neither surface is a dead end.

## Workflows

**Create a task (manual — the only creation path in v1)**

1. On `/tickets/[id]`, a task panel sits alongside the asset and approval panels.
2. Anyone with ticket access adds a task: title, assignee, due date, optional notes.
3. The write lands in Postgres and enqueues an `AirtableOutbox` row in the same transaction; the push creates the mirrored Airtable row.
4. The team can equally create the row directly in Airtable; the inbound pull picks it up on its cursor.

**Work a task**

1. The editor opens `/tickets/[id]`, or finds the task in "My tasks" on `/editor`.
2. Status moves through `To Do → In Progress → Blocked → Done` (or `Won't Do`).
3. Entering `Done` stamps `Completed At`; leaving `Done` clears it.
4. Nothing is ever blocked by an open task — see Boundaries.

**Promote a task to a ticket**

1. The actor picks "promote" on a task.
2. A new Creative Request is created reusing the existing intake path, inheriting event type, asset type, official calendar and requester from the **parent** ticket. Title = task title; creative brief = task notes.
3. The task records `promotedTicketId` and links the new request in Airtable.
4. **Promotion links; it does not auto-close.** The task stays in its current status for a human to close — silently completing someone's task on their behalf erodes trust in the board.

**Two-way sync round trip**

1. Portal writes are Postgres-first, drained to Airtable through the outbox.
2. Airtable edits are collected by a pull runner keyed on an `App Last Modified (sync)` formula cursor, with the existing 90-second echo-suppression window and last-writer-wins.

> **Imported note (not part of PRD structure):** the epic follows the established 7-step transactional sync recipe — `field-map.ts` entry, `ticket-task-upsert.ts`, backfill + route (which must call `seedPullCursor`), `pull-ticket-tasks.ts` registered in `pull-registry.ts`, `ticket-task-push-map.ts` plus a `PushHandler` in `push-registry.ts`, a `lib/tasks/*` dispatcher pair behind a `TASKS_BACKEND` flag, and an outbox enqueue in the same transaction as every write. Copy from the shoots/social/vishenVideo precedent. Full file-level detail in `plans/vishen-in-the-past-elegant-tiger.md`.

## Boundaries

**Scope decisions taken 2026-08-20:**

| Decision | Choice |
|---|---|
| Scope | **Tickets only.** Sub-tasks under Creative Requests. Not clips, videos or shoots. |
| Data home | **New Airtable table + Postgres two-way sync.** Postgres is system of record. |
| Creation paths | **Manual** (portal + Airtable) and **promote-task-to-ticket**. |
| Blocking | **Advisory only.** An open task never blocks a status transition. |

**Explicitly out of scope for v1:**

- **Stage-triggered task templates** — auto-spawning "Post IG"/"Post YT" when a clip is approved. This is what Vishen's four `To Do` options encode and is the most obvious follow-up, but it is not v1.
- **AI extraction from feedback prose** — parsing `Next Step` / `Feedback` into discrete proposed tasks. Deferred.
- **Blocking / decision locks.** `GATED_STATUSES` stays `['Shipping']`, unchanged. An open task is informational only. The accepted cost: a task can be ignored and the work ships incomplete.
- **Tasks on clips, videos or shoots.** See the limitation below.
- **Fixing editor identity.** `/editor` selects the editor from a `?assignee=` query param rather than the signed-in session. That gap is real but predates this epic and is not addressed here.

**Known limitation, accepted.** Tickets-only does not reach Vishen's original case end to end. His clips do become tickets via the existing clip→ticket conversion (E8.4), so those are covered. His 341-row `Videos` table (`tblcqpctTr76RQsQT`) never becomes tickets, so prose feedback there stays unstructured. Extending to clips/videos later is an **additive migration** (nullable parent FKs), not a rewrite; the model is shaped to keep that true.

**Standing rules this epic must not break:**

- The mandated first five columns of every list view (Title, Priority, Assigned, Ticket Status, Priority Status) stay fixed — any task-progress indicator comes after them.
- Task status is its **own** axis. It does not reuse `TICKET_STATUSES` or `PRIO_STATUSES`; the two existing axes stay separate.
- The app must never write clip or video statuses it does not own (`APP_MANAGED_VISHEN_STATUSES`). Two production incidents came from getting this wrong.

## Dependencies

- **E1 · Foundation & Data Layer** — the Prisma model, `Employee` relations for assignee/requester, and migration mechanics. New migration `0019_ticket_tasks`.
- **E5 · Lifecycle, Views & Approvals** — the ticket detail surface, role views and the panel composition the task panel plugs into. This is the primary dependency.
- **E6 · Two-Way Sync (outbound)** — the `AirtableOutbox` + `push-registry` machinery the task push reuses.
- **E3 · Intake** — the `createTicket` path reused by promote-to-ticket.
- **E8.4 · Clip → Ticket Conversion** — the conversion pattern promotion copies.
- **External / manual:** the Airtable table `✅ Ticket Tasks` and its single-select options must be created **by hand** (or via MCP) in the Creative Services base, then the schema exported so real `fld…` ids can be read. The API token has previously failed to create select options — see the `Team/Service Level` incident. Never hand-type field ids.
- **Kessel:** the managed Postgres is reachable only through `kessel db`; the migration is applied with `kessel db migrate`, not `prisma migrate deploy`.

## Success Criteria

1. A task created in the portal appears in Airtable, and a task created in Airtable appears in the portal, in both directions, with no field loss.
2. Ticking a task to `Done` in the portal stamps `Completed At`, and surviving the 90-second echo window the next pull does **not** revert it.
3. With one or more open tasks on a ticket, that ticket can still be moved through every status including `Shipping` — nothing is blocked.
4. Promoting a task creates a Creative Request that inherits the parent's event type, asset type, calendar and requester, links back in Airtable, and leaves the source task open.
5. An editor can see every open task assigned to them across tickets in one place on `/editor`.
6. `QueueTable` shows task progress without disturbing the five mandated columns, and still reflows to cards at mobile width.
7. `npm run lint` and `npm run build` pass clean.

[UNRESOLVED] No adoption or behaviour-change target is defined. Criteria 1–7 are correctness gates, not evidence the workflow replaced the prose habit. Needs a measurable bar — e.g. "within N weeks of launch, X% of tickets in active production carry at least one task, and Vishen's `Next Step` prose fields stop accumulating multi-task paragraphs" — plus who checks it and when.

## Features

- **E10.1 · Task data layer & two-way sync** — the `✅ Ticket Tasks` Airtable table, the `TicketTask` Prisma model + migration `0019`, and the 7-step transactional sync recipe. *(extends E1/E6)*
- **E10.2 · Ticket task panel** — the checklist on `/tickets/[id]`: add, assign, due date, reorder, status. *(extends E5)*
- **E10.3 · Editor "My tasks"** — open tasks grouped by parent ticket on `/editor`, plus task progress in `QueueTable`. *(extends E5)*
- **E10.4 · Promote task to ticket** — the escape hatch into a full Creative Request. *(extends E3, E8.4)*
- **E10.5 · Manager task visibility** — advisory open-task load and oldest-task age per editor on `/manager`. *(extends E4/E5)*

Dependency order: E10.1 first and alone — no UI until the data layer and sync round trip are proven. Then E10.2 (the surface that makes it usable), then E10.3. E10.4 and E10.5 follow independently.

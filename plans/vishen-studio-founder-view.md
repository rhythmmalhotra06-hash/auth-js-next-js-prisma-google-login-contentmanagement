# Plan — Vishen's Studio view (founder-first `/studio` rebuild)

> Canonical copy will be saved to `plans/vishen-studio-founder-view.md` in the repo
> on exit from plan mode (per the project's plans-in-repo convention). This file is
> the plan-mode working copy.

## Context

The live `/studio` founder landing treats Vishen like an ops manager: it leads with
a 5-KPI grid, an **editor-capacity leaderboard** (`FunnelCapacity`), and a recently-
shipped table. Per `Context/VishenStudio/STUDIO_VISHEN_VIEW.md`, this is wrong for the
founder. Vishen is the **prioritization sign-off authority** and the **content source**,
not a queue triager. Two documented fears drive the redesign: (1) seeing work with no
priority/owner/due-date erodes his confidence, and (2) "where is the ticket, who is
editing it." The page's emotional job is **trust and control**, not throughput.

We rebuild `/studio` founder-first, reusing the existing Airtable-direct data layer.
Two key findings from exploration: **both "missing fields" the brief flagged already
exist** — Priority Status (`prio_status` = `fldFH3scvUfjnOwhg`, value
`"To be reviewed by Vishen"`) and shoot→ticket linkage (`ShootRow.ticketCount`). So
sign-off and at-risk run on **live data**, no Airtable schema changes / no MCP writes
to the base.

### Decisions locked with the user
- **Full build now** — landing + all expanded views + live writes.
- **Two distinct queues** (separate sub-routes):
  - **Review queue** = records where Prio Status = `"To be reviewed by Vishen"`. Per row: **Approve** (Prio Status → `In Queue`) and **Send back** (writes a note to *V's Notes*, Ticket Status → `In Revision`, Prio Status → `In Queue`). Both clear the item from his review queue.
  - **Priority ranking queue** = the active production queue (all non-Done/non-Won't-Do), with **editable 1–5 stars** writing *Priority ranking (Manual)* (`fldaG3TQINrA1c9X0`, 2-way synced).
- **Remove** `FunnelCapacity` (editor leaderboard) from the founder view entirely.
- **Sub-routes under `/studio`** (server-rendered, deep-linkable, AppShell pattern) — not a client SPA.
- Visual target = `Context/VishenStudio/vishen-studio-REFERENCE.html` (spacing/palette/section order), reimplemented in the portal's stack. **Keep the portal's tokens/fonts** (Bricolage display + Inter, brand `#572280`, violet `#7C3AED`); the sign-off "commit" block is the single saturated gradient element; **no gold** on this view.

---

## Routes (all server components, wrapped in `<AppShell>`, gated by `isAdmin || isFounder`)

| Route | Purpose |
|---|---|
| `/studio` | Founder landing — 6 sections (rewrite of `app/studio/page.tsx`) |
| `/studio/sign-off` | Review queue (full) + filter chips |
| `/studio/ranking` | **New** — Priority ranking queue, editable stars |
| `/studio/launches` | All active launches |
| `/studio/launches/[event]` | Launch drill-down (asset-by-asset) |
| `/studio/at-risk` | At-risk (full) |
| `/studio/shipped` | Recently shipped (full) |

Each sub-route reuses the same auth gate at the top of `app/studio/page.tsx`
(`getAdminAccess()` + `isFounder` + `homeRouteForRoles` redirect) and renders a
back-to-Studio link in the AppShell header area.

---

## Data layer — new `lib/studio/data.ts` (reuses existing functions)

Reuse, do not duplicate:
- `getQueueTickets()` / `getRecentShipped()` — `lib/tickets/data.ts` (active set already carries `prioStatus`, `eventType`, `queueRank`, `priorityScore`, `dueDate`).
- `getTicketMetrics()` + `asOf()` — `lib/metrics/snapshot.ts` (all-time Shipped count, no 9k scan).
- `listShoots()` — `lib/shoots/repository.ts` (`ShootRow.ticketCount`).
- `listMediaSources()` — `lib/media/repository.ts`.

New derived selectors (pure functions over the loaded sets — one parallel fetch in the landing page):

- **`getReviewQueue(active)`** → `active.filter(t => t.prioStatus === 'To be reviewed by Vishen')`.
- **`pulseCounts(active, metrics)`** → per brief §2: In flight = active minus `{Shipping}` (active already excludes Done/Won't Do); Being made now = `In Progress`; Awaiting sign-off = `Review` + `In Revision`; Shipped all-time = `metrics.shipped`.
- **`getLaunches(active, recentShipped)`** → group by `eventType` (records with no `eventType` are excluded here and surfaced in At Risk). Each launch: `{ event, total, todo, prod, rev, ship, due }`. Meter buckets map ticketStatus → ship(`Done`/from recentShipped overlap)/rev(`Review`,`In Revision`,`Approved`)/prod(`In Progress`,`Shipping`)/todo(`Backlog`,`To Do`,`Request on Hold`). **Note:** shipped-per-launch uses the loaded recent-shipped overlap (we never scan the ~9k Done history); flag as "recent" — upgradeable later with a grouped count query.
- **`getAtRisk(active, shoots)`** → founder-decision items only:
  1. **Shoot, no post-prod ticket** — `shoots.filter(s => s.ticketCount === 0 && s.status ∈ {To Film, Done - Filmed})`. Fix → link to the shoot.
  2. **Untagged / unreadable score** — active tickets with no `eventType` **or** no `priorityScore`/`assetType`. Fix → link to ticket.
  3. **Aged past its event** — active tickets with `dueDate < today` and not Done. Fix → link to ticket.
- **`getVishenMedia(media)`** → existing filter (`title`/`guestShow` contains "vishen").

---

## Server actions — new `app/studio/actions.ts` (`'use server'`)

Reuse `updateTicketFields` + `TICKET_FIELD as F` from `lib/repositories/ticket.repository.ts`.
Mirror the `done()`/`revalidatePath` pattern from `app/tickets/[id]/actions.ts`, but
revalidate the studio routes (`/studio`, `/studio/sign-off`, `/studio/ranking`).

- **`approveReview(ticketId)`** → `updateTicketFields(id, { [F.prioStatus]: 'In Queue' })`. Validate against `PRIO_STATUSES`.
- **`sendBackForRevision(ticketId, note)`** → set `{ [F.ticketStatus]: 'In Revision', [F.prioStatus]: 'In Queue', [F.notes]: <append note> }`. Validate statuses; require non-empty note.
- **`setPriorityRank(ticketId, rank)`** → `updateTicketFields(id, { [F.queueRank]: rank })` with `1 ≤ rank ≤ 5`. This is the 2-way-synced "Priority ranking (Manual)" write.

These are the **propose-only commit boundary** — they only ever fire on an explicit
Vishen tap (Approve / Send back / star click). No staged value is written without a tap.

---

## Components — new `components/studio/`

Client components (`'use client'`) where interaction/optimistic UI is needed; everything else server.

- **`SignOffHero.tsx`** (client) — the landing hero. Zero-pending → calm green `.signoff-clear` bar ("Nothing is waiting on you"). Pending → the one saturated `.commit` gradient block; top 3 rows, each with **Approve** + **Send back** (Send back opens an inline note field). Optimistic UI, then calls `approveReview` / `sendBackForRevision`. "Review all" → `/studio/sign-off`.
- **`ReviewQueueTable.tsx`** (client) — full review queue with filter chips (all / tied to event / high score / shoots) + per-row Approve/Send-back. Used by `/studio/sign-off`.
- **`PriorityRanking.tsx`** (client) — active-queue rows with editable `.stars` (1–5); click writes `setPriorityRank` optimistically. Used by `/studio/ranking`.
- **`Pulse.tsx`** (server) — 4 glance cards (reuse `Kpi`/`KpiGrid` or a thin `.pulse-card`). "Awaiting sign-off" → `/studio/sign-off`, "Shipped" → `/studio/shipped`, "Being made now" → `/studio/launches`.
- **`LaunchCard.tsx` + `Meter.tsx`** (server) — launch card with status meter + legend; links to `/studio/launches/[event]`.
- **`LaunchDrill.tsx`** (server) — drill hero (counts + meter) + filter chips + asset rows with stars and live status dots. Literal answer to "where is the ticket, who is editing it."
- **`AtRiskList.tsx`** (server) — red `.risk` block; each row has reason + age + a "Fix" link to the ticket/shoot.
- **`ClipsList.tsx`** (server) — reuse existing "Your content" pattern → `/media/[id]`.
- **`ShippedStrip.tsx`** / shipped table (server).
- **`ProposeFootnote.tsx`** (server) — persistent "Nothing here changes without you." note.

**Styling:** add a Studio block to `app/globals.css` porting the reference's `.commit`,
`.signoff-clear`, `.meter`, `.launch`, `.stars`, `.footnote`, `.drill-hero` (reuse
existing `.chip`/`.fbar`, `.risk`, `.clip`, `.card`, `.sec-head`, `.kpi`). Use existing
CSS variables — do not hardcode hexes. Responsive to mobile, visible focus rings,
`prefers-reduced-motion` honored.

**Nav:** keep `/studio` as the single sidebar entry (`navForRoles`, group `Vishen`);
expanded views are reached via in-page links + AppShell back link. (Optional, low-cost:
add Sign-off / Launches / At-risk as founder-only nav items — decide during build.)

---

## Files

**Rewrite:** `app/studio/page.tsx` (landing, 6 sections, drop `FunnelCapacity`).
**New routes:** `app/studio/{sign-off,ranking,launches,at-risk,shipped}/page.tsx`, `app/studio/launches/[event]/page.tsx`.
**New logic:** `lib/studio/data.ts`, `app/studio/actions.ts`.
**New UI:** `components/studio/*` (above) + Studio CSS block in `app/globals.css`.
**Reused as-is:** `lib/tickets/data.ts`, `lib/metrics/snapshot.ts`, `lib/shoots/repository.ts`, `lib/media/repository.ts`, `lib/repositories/ticket.repository.ts`, `components/ui/{AppShell,Kpi,Badge,TierBadge,Icon}.tsx`, `lib/roles.ts` gating.

---

## Verification (end-to-end)

1. `npm run lint && npm run build` — clean.
2. `npm run dev`, sign in as `rhythm@mindvalley.com` (admin bootstrap) → `/studio`.
3. **Landing:** all 6 sections render from live data; **no** `FunnelCapacity` panel; pulse counts match brief definitions; launches grouped by event with meters; at-risk shows real shoots-without-tickets and untagged items.
4. **Sign-off:** zero-state green bar when no `To be reviewed by Vishen` records; otherwise saturated commit block. **Approve** a row → confirm the Airtable record's Prio Status flips to `In Queue` (check via record / `mcp__claude_ai_Airtable` read). **Send back** with a note → Ticket Status `In Revision`, Prio Status `In Queue`, V's Notes appended.
5. **Ranking:** change a star → confirm *Priority ranking (Manual)* updates in Airtable; UI reflects optimistically and survives reload.
6. **Sub-routes:** `/studio/launches/[event]`, `/studio/at-risk`, `/studio/shipped` deep-link and render; back link returns to `/studio`.
7. **Quality:** mobile layout (≤880px / ≤560px), keyboard focus visible, reduced-motion respected.
8. Confirm a non-founder/non-admin is redirected away by the auth gate.

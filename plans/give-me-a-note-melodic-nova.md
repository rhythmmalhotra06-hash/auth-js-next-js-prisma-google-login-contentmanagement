# Mindvalley Content Studio — Portal Context Note

> **Purpose of this doc:** a self-contained briefing you can paste into a Claude chat project so it understands what this portal is, what it does, and its current status. Written 2026-07-08. It describes shipped behavior, not aspirations.

---

## 1. What it is (in one paragraph)

**Content Studio** is a Next.js (App Router) web app for Mindvalley's merged Creative Services team (Social + Ads + Content). It replaces a fragmented mix of Jira + 4 Airtable bases with **one full-lifecycle system**: request intake → prioritization → production → approval → publish → performance. It is designed to eventually live inside **Blinkwork** (Mindvalley's internal app platform), but is built now as a standalone app. Airtable remains the ops/taxonomy layer the team edits by hand; the app's own system of record is **Postgres**, mirrored two-way with Airtable.

---

## 2. Architecture & stack

- **Frontend/backend:** Next.js App Router + TypeScript + React. Server Actions for writes, a handful of API routes for sync/AI/cron.
- **Data:** Kessel-managed **Postgres** via **Prisma** (custom client at `@/app/generated/prisma/client`, edge-light `PrismaPg` adapter). Airtable is mirrored into Postgres.
- **Auth:** Google Workspace SSO (Auth.js v5), gated to `@mindvalley.com`. Stateless JWT sessions (no DB adapter). Roles resolved by email from the Airtable Employees table. Dev-login bypass exists for local role preview (inert in prod).
- **AI:** Anthropic SDK, model `claude-opus-4-8`, with web-search grounding + structured JSON output. Powers the clip/strategy engine.
- **Notifications:** Slack Web API (outbound, best-effort).
- **Deploy:** **Kessel CLI** (Mindvalley's Vercel-like platform in front of Cloud Run). Auto-deploy on push. `DATABASE_URL` auto-injected at runtime. Service is in `asia-southeast1`, co-located with the DB, and public-with-Google-SSO (IAP was removed 2026-07-03, which is what lets the cron jobs reach the sync endpoints with a bearer token).

### Sync model (Airtable ↔ Postgres)
- **Reference data** (employees, dimensions, event types, asset types, DNA, calendars, authors): **one-way Airtable → PG**, read-only in the app. Daily cron.
- **Tickets:** **two-way PG ↔ Airtable.** Outbound via a **transactional outbox** drainer (every write enqueues a row in-transaction; a drainer pushes to Airtable, with echo-suppression via `airtablePushedAt`). Inbound via a **cursor/watermark pull** with last-writer-wins conflict resolution. Runs every 5 min via GitHub Actions cron (push → pull → link-tickets, in that order).
- **`TICKETS_BACKEND` flag:** the PG-as-system-of-record path is fully built and flips instantly/reversibly between `airtable` (legacy direct) and `postgres` (SoR). The write dispatcher keeps all action files unchanged either way.
- **Media/clips:** discovery pulls from Airtable / Slack / Vishen's "Major Videos"; clips↔tickets bridged on demand.
- Everything is **poll-based** (no inbound Airtable webhooks — blocked by past IAP setup).

---

## 3. Core concepts (the mental model)

- **Two independent status axes** — never merged:
  - `ticket_status` (editor-owned production pipeline): Backlog, To Do, In Progress, Review, In Revision, Approved, Done, Won't Do, Shipping, Request on Hold.
  - `prio_status` (manager-owned triage): New Request, To be reviewed by Vishen, In Queue, Pending Information, Rejected, Assigned.
- **Event Type → Asset Type taxonomy.** Intake picks an Event Type first; the Asset Type list filters to those linked to it; team lead / preferred editor / dimensions / category then auto-fill as **read-only lookups** (not user inputs). Teams own Asset Types, not Event Types.
- **Prioritization = queue, not SLAs.** A blended **priority score** (`urgency + leadtime·complexity`, admin-tunable weights) orders the queue. A manual **1–5 star rating** (`queueRank`, "Priority ranking (Manual)" in Airtable) overrides the computed order. Event tiers (high/mid/soc/low) tint rows.
- **Decision lock:** a ticket can't enter `Shipping` without an approved approval (Ziflow-style gate).
- **Raw/final asset stacking** under one ticket.
- **Mandated 5-column table header everywhere:** Title, Priority, Assigned, Ticket Status, Priority Status.
- **Roles:** Editor, Designer, Manager, Approver, Admin, Executive/CEO, Stakeholder, Agency/External. Untagged signed-in users default to **Stakeholder (read-only)** — rollout-safe. Free external reviewers (stakeholders/agencies) are read/comment-only and unlimited (the reason we're not paying per-seat).

---

## 4. What it does — surfaces by role

**Everyone (any signed-in @mindvalley.com user)**
- `/` — landing + Google sign-in; redirects to your role home.
- `/intake` → `/intake/creative` — the creative request form (Event→Asset→lookup chain). Also `/shoots/new` for filming requests.
- `/stakeholder` — read-only "my requests" board: every request across the team, pre-prod → post-prod status, output location, distribution link, performance (once wired). `?archive=1` for delivered history.
- `/shoots` — pre-production filming queue.

**Editor / Designer** — `/editor`: personal queue with a "Next up" hero (brief/CTA/dimensions), KPIs, priority-ordered `QueueTable`. Update `ticket_status`, attach raw/final assets, link distribution URLs.

**Manager / Approver** — `/manager`: the prioritization board. All-teams queue by score, capacity funnel, editable star-rank + assignee reassignment, approvals, an "approved clips to convert" panel. `/tickets` and `/tickets/[id]` for full ticket detail/edit.

**Executive / Founder (Vishen) + Admin** — `/studio` cockpit and sub-surfaces:
- `/studio/media` — "Your media": everything made for Vishen's channels, who made it, what's live, what needs him.
- `/studio/ranking` — founder sets 1–5 star priority (two-way synced).
- `/studio/sign-off` — review queue of video work awaiting sign-off.
- `/studio/shipped`, `/studio/launches`, `/studio/launches/[event]`, `/studio/shoots` — shipped work, launches in flight, per-launch asset status, founder shoot sign-off.

**Marketing division** — `/social`, `/social/new`: a parallel clip engine backed by the Content & Comms base (long-form media → AI clips → Creatives tickets). Propose-only.

**Admin** — `/admin/sync` (sync health: outbox depth/failures, last push, pull cursor, per-domain breakdown, controls), `/settings/team` (assign roles), `/settings/clip-rules` (AI prompt + brand pillars), `/settings/scoring` (scoring weights + per-person capacity), `/settings/asset-types` (creative DNA/requirements per asset type).

**Intelligence** — `/performance` ("Insights"): at-risk/watch tickets, capacity funnel, ticket metrics, tier badges.

---

## 5. Feature areas in depth

**Intake** — dynamic request form; rejects incomplete requests by enforcing taxonomy; two variants (creative request, shoot request). No priority/assignee on the form (backend-handled).

**Tickets** — the production record. Full lifecycle with status audit trail (`TicketEvent` on every transition), two status axes, approvals, asset panel, auto-assign for unambiguous routing (~20-30% of cases).

**Media → Clip pipeline (Vishen founder videos)** — the newest headline feature:
1. **Link media** (`/media/new`) — paste a YouTube/podcast link featuring Vishen; also auto-ingested via Slack scan and "Major Videos" discovery.
2. **AI clip suggestions** — Anthropic generates a validated **10-section content strategy** (episode titles, hook, thumbnail, pull quotes, show notes, distribution) plus individual Reels clips with hook line, timestamps, rationale, caption, and a **virality score**. Web-search grounding + streamed structured output.
3. **Approve / dismiss / rate** clips.
4. **Convert clip → ticket** — approved clips become production tickets (inline or batch via an Airtable checkbox); land in Vishen's review queue with taxonomy + source download link carried over.
5. **Push back to Vishen's Airtable** — approved clips mirror into Vishen's Clips table + a Major Video row, all **tagged "AI Suggested"** for provenance. Propose-only, diff-guarded, loop-safe. Vishen writes back Approval + a 1–5 Rating; live signals (24h views, released, feedback) sync back in.

**Slack notifications** — (1) **Asset ready**: DM to requester + post to #content-ready when a ticket is Done AND has an asset folder link (deduped, fires once). (2) **Assignment**: DM to editor when assigned. Also a Slack channel scan that harvests YouTube links into the media inbox.

**Shoots** — filming request queue → studio queue → production tickets, with founder sign-off in Studio.

**Performance/metrics** — nightly job scans the full ticket table once and persists lifetime tallies to a Postgres `MetricSnapshot`, so dashboards read one cheap row ("as of …"). The live-ROAS/CTR performance loop (Clarisights/Amplitude/Ahrefs) is the intended differentiator but **not yet wired**.

**Design system** — brand purple `#572280`, gold `#f5b000` (attention only), Plus Jakarta Sans, 8/12px radii, dark-mode first-class. Rich primitive library (`components/ui/*`): Button, Badge, Kpi, MetricCard, Sparkline, FunnelCapacity, Field/Input/Select, SearchableSelect, InsightCard, AppShell, etc. Rules in `DESIGN_SYSTEM.md`: reuse-before-build, tokens only (no raw hex/arbitrary sizes/inline style).

---

## 6. Status snapshot (as of 2026-07-08)

**Live / built**
- All three role boards + founder studio + intake + tickets + shoots + social engine.
- Google SSO, role gating, rollout-safe stakeholder default.
- Airtable reference sync (one-way), ticket two-way sync (outbox + cursor pull), sync-health admin surface.
- PG-as-system-of-record path built and flippable via `TICKETS_BACKEND`.
- Media→clip AI pipeline end to end (link → strategy/clips → approve → convert to ticket → push to Vishen's Airtable, tagged "AI Suggested").
- Slack asset-ready + assignment notifications.
- Metrics snapshot (nightly), scoring/capacity/DNA/roles admin editors.
- Deployed on Kessel (asia-southeast1), cron via GitHub Actions.

**In progress / open**
- **Full portal Postgres migration** — a generalized/polymorphic sync engine (0012 outbox migration) is code-complete; extending two-way sync from tickets to shoots/social/media/config is prepared but not fully rolled out.
- **Performance loop** (live ROAS/CTR per asset) — the intended edge, not yet connected; data source (Hootsuite vs Airbyte/Postiz vs existing Clarisights/Metabase) undecided.
- A couple of manual Airtable/cron steps remain for clip→ticket link reconciliation.

**Intentional constraints / gotchas (important context)**
- Managed Postgres is reachable **only via `kessel db`** — no local `DATABASE_URL` against prod; DDL goes through Prisma migrations against the managed DB.
- `queueRank` is a **1–5 star rating**, not a drag-order position — there's no ordinal reorder field.
- Reference data is **read-only in the app** — edit it in Airtable.
- Never set env/config outside `kessel` commands (overwritten on deploy). `NEXT_PUBLIC_*` are baked at build time.
- BlinkLife integration code was removed (schema drift); it's deferred to the BlinkWork track. Portal integrates with **BlinkWork** (contact: Shafiu), not BlinkLife.

---

## 7. Architecture direction (for longer-term context)

Decided **HYBRID** (2026-06-25): build the workflow surfaces now in this standalone repo (valid under either architecture), and later migrate the *nouns* (Asset, Person, Event, Channel, Metric, Insight) to **Blinkwork brain nodes** + an app manifest, keeping only *workflow state* (tickets, queue, statuses, approvals) app-owned. Airtable becomes a connector, not source of truth. The workflow decisions, prioritization algorithm, and UI mockups stay valid in both worlds.

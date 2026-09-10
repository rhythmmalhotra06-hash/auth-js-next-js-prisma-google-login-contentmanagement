# Mindvalley Content Studio — Portal Context Note

> **Purpose of this doc:** a self-contained briefing you can paste into a Claude chat project so it
> understands what this portal is, what it does, and its current status. **Last updated 2026-09-08**
> (supersedes the 2026-07-08 version). It describes shipped behavior, not aspirations — anything not
> yet built is called out in §7.

---

## 1. What it is (in one paragraph)

**Content Studio** is a Next.js (App Router) web app for Mindvalley's merged Creative Services team
(Social + Ads + Content). It replaces a fragmented mix of Jira + 4 Airtable bases with **one
full-lifecycle system**: request intake → prioritization → production → approval → publish →
performance. It is designed to eventually live inside **BlinkWork** (Mindvalley's internal app
platform), but is built now as a standalone app. Airtable remains the ops/taxonomy layer the team
edits by hand; the app's own system of record is **Postgres**, mirrored two-way with Airtable.

Repo: `ContentManagement` (standalone Next.js app). Deployed on Kessel at
`https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-as.a.run.app`.

---

## 2. Architecture & stack

- **Frontend/backend:** Next.js App Router + TypeScript + React. Server Actions for writes, ~29 API
  routes for sync / AI / cron.
- **Data:** Kessel-managed **Postgres** via **Prisma** (custom client at
  `@/app/generated/prisma/client`, edge-light `PrismaPg` adapter). **41 models**, 22 migrations
  (`0001_init_content_schema` → `0022_dna_review`). Airtable is mirrored into Postgres.
- **Auth:** Google Workspace SSO (Auth.js v5), gated to `@mindvalley.com`. Stateless JWT sessions
  (no DB adapter). Roles resolved by email from the Airtable Employees table. Dev-login bypass
  exists for local role preview (inert in prod).
- **AI:** Anthropic SDK. Model choice varies by surface (Sonnet 5 for most generation, Haiku 4.5 for
  cheap classification, Opus for the heaviest clip strategy pass), with web-search grounding and
  structured JSON output.
- **Video rendering:** a **separate Cloud Run service** (`render-service/`, headless **Remotion** +
  ffmpeg/ffprobe) for E12 auto-editing renders and E13 frame extraction. Never imported by the
  Next.js app — HTTP only, gated by `RENDER_SERVICE_SECRET`. Bundles lazily on first `/render`.
- **Notifications:** Slack Web API (outbound, best-effort).
- **Deploy:** **Kessel CLI** (Mindvalley's Vercel-like platform in front of Cloud Run). Auto-deploy
  on push to `main`. `DATABASE_URL` auto-injected at runtime. Service is in `asia-southeast1`,
  co-located with the DB, and public-with-Google-SSO (IAP was removed 2026-07-03, which is what lets
  the cron jobs reach the sync endpoints with a bearer token).
- **Cron:** GitHub Actions workflows (9 of them) hit bearer-token-protected API routes — ticket
  two-way sync, hourly reference reconcile, hourly media auto-discover, nightly ticket metrics,
  nightly Hootsuite Perch pull, Monday/Wednesday social digests, weekly clip learning, on-demand
  backfills.

### Sync model (Airtable ↔ Postgres)

- **Reference data** (employees, dimensions, event types, asset types, DNA, calendars, authors):
  **one-way Airtable → PG**, read-only in the app. **Hourly** reconcile with orphan self-heal, so
  mid-day taxonomy/roster edits appear within the hour.
- **Tickets:** **two-way PG ↔ Airtable.** Outbound via a **transactional outbox** drainer (every
  write enqueues a row in-transaction; a drainer pushes to Airtable, with echo-suppression via
  `airtablePushedAt`). Inbound via a **cursor/watermark pull** with last-writer-wins. Scheduled via
  GitHub Actions cron (push → pull → link-tickets, in that order) — the schedule *says* every 5 min
  but GitHub throttles it to roughly **3–11 hours** in practice (measured 2026-08-28). Outbound no
  longer waits for it: every app write drains its own outbox immediately via
  `lib/airtable/drain-after.ts`. **Inbound (Airtable → Portal) is still only as fresh as the last
  cron run** — this is the single biggest remaining infrastructure gap.
- **Per-domain backend flags** (`TICKETS_BACKEND`, `SHOOTS_BACKEND`, `SOCIAL_BACKEND`,
  `VISHEN_VIDEOS_BACKEND`, …) flip each domain instantly and reversibly between `airtable` (legacy
  direct) and `postgres` (SoR). A write dispatcher keeps all action files unchanged either way.
  **Prod runs `postgres` for tickets** (and the other domains have migrated behind their own flags:
  `0014_shoots_sor`, `0015_social_sor`, `0016_vishen_videos_sor`, `0017_media_sources_mirror`).
- **Media/clips:** discovery pulls from Airtable / Slack / Vishen's "Major Videos"; clips↔tickets
  bridged on demand.
- Everything is **poll-based** — no inbound Airtable webhooks.

---

## 3. Core concepts (the mental model)

- **Two independent status axes** — never merged:
  - `ticket_status` (editor-owned production pipeline): Backlog, To Do, In Progress, Review, In
    Revision, Final Pass, Feedback Given, Approved, Done, Published, Shipping, Won't Do, Request on
    Hold.
  - `prio_status` (manager-owned triage): New Request, To be reviewed by Vishen, In Queue, Pending
    Information, Rejected, Assigned.
- **Event Type → Asset Type taxonomy.** Intake picks an Event Type first; the Asset Type list
  filters to those linked to it; team lead / preferred editor / dimensions / category then auto-fill
  as **read-only lookups** (not user inputs). Teams own Asset Types, not Event Types.
- **Prioritization = queue, not SLAs.** A blended **priority score**
  (`urgency + leadtime·complexity`, admin-tunable weights) orders the queue, and now also factors
  **whether a due date is real vs. placeholder** (`0021_ticket_date_certainty`). A manual **1–5 star
  rating** (`queueRank`, "Priority ranking (Manual)" in Airtable) overrides the computed order.
  Event tiers (high/mid/soc/low) tint rows. *There is no ordinal drag-order field.*
- **Decision locks** (Ziflow-style gates), two of them:
  1. A ticket can't enter `Shipping` without an approved approval.
  2. **DNA lock (E13):** a `flag`-severity DNA finding blocks Review → Approved. Fail-**closed** on
     a missing review, with a required-note override (dismiss-with-note, or
     approve-anyway-with-a-note). This is the one deliberate exception to "propose, don't act".
- **Raw/final asset stacking** under one ticket.
- **Mandated 5-column table header everywhere:** Title, Priority, Assigned, Ticket Status, Priority
  Status.
- **Roles:** Editor, Designer, Manager, Approver, Admin, Executive/CEO, Stakeholder,
  Agency/External. Untagged signed-in users default to **Stakeholder (read-only)** — rollout-safe.
  Free external reviewers are read/comment-only and unlimited (the reason we're not paying
  per-seat).
- **Propose-only AI.** Every AI capability proposes and a human approves. See
  `context/intelligence-layer.md` for the five capabilities and their build order.

---

## 4. Surfaces by role (live routes)

**Everyone (any signed-in @mindvalley.com user)**
- `/` — landing + Google sign-in; redirects to your role home. `/access-denied` self-heals a stray
  duplicate OAuth callback.
- `/intake` → `/intake/creative` — the creative request form (Event→Asset→lookup chain).
  `/shoots/new` for filming requests.
- `/stakeholder`, `/stakeholder/[id]` — read-only "my requests" board: every request across the
  team, pre-prod → post-prod status, output location, distribution link, performance.
  `?archive=1` for delivered history.
- `/shoots`, `/shoots/[id]` — pre-production filming queue.

**Editor / Designer** — `/editor`: personal queue with a "Next up" hero (brief/CTA/dimensions),
KPIs, priority-ordered `QueueTable`. Update `ticket_status`, attach raw/final assets, link
distribution URLs.

**Manager / Approver** — `/manager`: the prioritization board. All-teams queue by score, capacity
funnel, editable star-rank + assignee reassignment, approvals, an "approved clips to convert" panel.
`/tickets` and `/tickets/[id]` for full ticket detail/edit (this is where the **DNA review panel**
lives).

**Executive / Founder (Vishen) + Admin** — `/studio` cockpit (consolidated to one founder/exec page
2026-07-09) plus `/vishen`, and sub-surfaces:
- `/studio/media` — "Your media": everything made for Vishen's channels, who made it, what's live,
  what needs him. Tabbed hub + calendar.
- `/studio/ranking` — founder sets 1–5 star priority (two-way synced).
- `/studio/sign-off` — review queue of video work awaiting sign-off.
- `/studio/timeline` — masterclass production timeline.
- `/studio/shipped`, `/studio/launches`, `/studio/launches/[event]`, `/studio/shoots`,
  `/studio/shoots/[id]`.

**Media → clip pipeline** — `/media`, `/media/new`, `/media/[id]`. (`/content-engine` is **retired**
and redirects to `/media`.)

**Marketing division** — `/social`, `/social/new`: a parallel clip engine backed by the Content &
Comms base (long-form media → AI clips → Creatives tickets). Propose-only.

**Cover generator** — `/cover-generator`: the ported Clip Cover Generator, wired to clips with
save-back via the Airtable upload-attachment API.

**Performance / Insights** — `/performance` (social numbers, benchmarks, trend, row actions,
7/30-day + custom date range) and `/performance/capacity` (capacity split out onto its own board).

**Admin** — `/admin/sync` (sync health: outbox depth/failures, last push, pull cursor, per-domain
breakdown, controls), `/admin/hootsuite` (OAuth connect), `/settings/team` (roles),
`/settings/clip-rules` (AI prompt + brand pillars), `/settings/scoring` (weights + per-person
capacity), `/settings/asset-types` (creative DNA/requirements per asset type).

---

## 5. Feature areas in depth

**Intake** — dynamic request form; rejects incomplete requests by enforcing taxonomy; two variants
(creative request, shoot request). No priority/assignee on the form (backend-handled). Asset-type
dropdown shows the full title to disambiguate near-duplicates.

**Tickets** — the production record. Full lifecycle with status audit trail (`TicketEvent` on every
transition), two status axes, approvals, asset panel, auto-assign for unambiguous routing (~20–30%
of cases).

**Media → clip pipeline (Vishen founder videos)** — the flagship AI feature:
1. **Link media** (`/media/new`) — paste a YouTube/podcast link; also auto-ingested hourly via Slack
   scan, YouTube channel discovery, and "Major Videos" sync. Title looked up via oEmbed when the
   source arrives without one.
2. **AI clip suggestions** — Anthropic generates a validated **content strategy** (episode titles,
   hook, thumbnail, pull quotes, show notes, distribution) plus individual Reels clips with hook
   line, timestamps, rationale, caption, and a **virality score**. Since 2026-07-27 it also carries
   **Viral Clip Extractor** structure (nuclear hook / verbatim / cold open / edit notes), with
   ranking switched to fight-likelihood while keeping the Controversy / Uncommon Knowledge / Humour
   gates.
3. **Approve / dismiss / rate** clips.
4. **Convert clip → ticket** — approved clips become production tickets (inline or batch via an
   Airtable checkbox); land in Vishen's review queue with taxonomy + source download link carried
   over.
5. **Push back to Vishen's Airtable** — approved clips mirror into Vishen's Clips table + a Major
   Video row, all **tagged "AI Suggested"** for provenance. Propose-only, diff-guarded, loop-safe.
   Vishen writes back Approval + a 1–5 Rating; live signals (24h views, released, feedback) sync
   back in. The app only ever overwrites clip statuses it owns (allowlist: Todo / In progress /
   Apply Feedback) — the team owns the rest of the review workflow.
6. **Learning loop** — Tier 1 distills rules from human feedback ("remember as learning"); Tier 2
   proposes rules weekly from performance signals (`/api/clips/learn`, Monday cron). Rules live in
   `ClipRule`, editable at `/settings/clip-rules`.

**Performance loop (E7) — now built.** `social_metrics` sink + a Studio performance band. Source is
**Hootsuite Perch**, with app-held OAuth and a **nightly Perch pull** (`/api/metrics/perch-pull`,
03:30 UTC) so metrics arrive on their own — no per-user token. Numbers are shown at the level
they're actually true, each account gets its own board, and there are weekly Slack digests (30-day
Monday, 7-day Wednesday). Separately, a nightly job persists lifetime ticket tallies to
`MetricSnapshot` so dashboards read one cheap row ("as of …").

**AI-assisted DNA feedback (E13) — the newest headline feature, shipped 2026-09-07/08.** An AI first
pass reviews a ticket's asset against its asset type's DNA before a human looks. Fires automatically
(best-effort, non-blocking) when `ticketStatus` → `Review`, plus a manual "Re-run". Postgres-native
rulebook (`DnaReviewRule` / `DnaReview` / `DnaReviewFinding`, migration `0022_dna_review`),
generalized from the clip engine's rule-learning loop. **E13.2 gives it real video access** via
frame extraction through the render service; the link resolver scans all four delivery-link fields
and offers a paste box when no usable link exists. UI: `components/tickets/DnaReviewPanel.tsx`.

**Transcript-based auto-editing agent (E12) — scaffolded, not shipped.** EDL brain service (E12.1),
Remotion renderer (E12.2, `render-service/`), DNA records & pilot selection (E12.3), instrumentation
& drift alerting (E12.4) all scaffolded; portal integration (E12.5) deferred. Remotion was locked in
over Premiere/UXP.

**Slack notifications** — (1) **Asset ready**: DM to requester + post to #content-ready when a
ticket is Done AND has an asset folder link (deduped, fires once). (2) **Assignment**: DM to editor
when assigned. Plus the media channel scan that harvests YouTube links into the media inbox. Users
resolve by name (no email scope on the bot).

**Shoots** — filming request queue → studio queue → production tickets, with founder sign-off in
Studio. Note: the "New Prio Ticket" checkbox path is a **live Airtable automation**, not an app
`createTicket` call.

**Design system** — brand purple `#572280`, gold `#f5b000` (attention only), Inter / Plus Jakarta
Sans, 8/12px radii, dark mode first-class. Rich primitive library (`components/ui/*`): Button,
Badge, Kpi, MetricCard, Sparkline, FunnelCapacity, Field/Input/Select, SearchableSelect,
InsightCard, TierBadge, AppShell. Rules in `DESIGN_SYSTEM.md`: reuse-before-build, tokens only (no
raw hex / arbitrary sizes / inline style). Mobile-responsive conventions are documented (overflow-x
clip, breakpoint ladder, QueueTable card reflow).

---

## 6. Status snapshot (2026-09-08)

**Live / built**
- All three role boards + founder Studio + intake + tickets + shoots + social engine + cover
  generator.
- Google SSO, role gating, rollout-safe stakeholder default.
- Airtable reference sync (one-way, hourly, self-healing); ticket two-way sync (outbox + cursor
  pull); sync-health admin surface.
- **Postgres is system of record** for tickets, and shoots/social/Vishen-videos/media have migrated
  behind their own per-domain flags.
- Media→clip AI pipeline end to end, with the Viral Clip Extractor structure and the two-tier
  learning loop.
- **Performance loop live** (Hootsuite Perch → `social_metrics` → Studio band + Performance boards +
  weekly Slack digests).
- **E13 DNA review live** — text/metadata review, real video frame extraction, and the flag-severity
  decision lock.
- Slack asset-ready + assignment notifications; metrics snapshot; scoring/capacity/DNA/roles admin
  editors.
- Deployed on Kessel (`asia-southeast1`), 9 GitHub Actions cron workflows.

**PRD state** (`prd/index.md`, 39 docs, ~77% of sections resolved)
- **Resolved:** E1 Foundation, E8 Clipping Engine (+E8.5 Cover Generator), E11 Prioritisation &
  Content Engine, E13 DNA Feedback.
- **In progress:** E7 Performance Loop (5/7 — built, E13.3 attribution still open).
- **Discovery:** E2–E6 (the original sync/intake/queue/lifecycle epics, built ahead of their PRDs),
  E9.x feedback round 1 (all built), E10 Editor Tasks, E12.x Auto-Editing.
- **Deferred:** E9.8 multi-asset requests (superseded by E11.C), E12.5 portal integration.
- Index is slightly stale: it links `prioritisation-content-engine.md`, which no longer exists.

---

## 7. Open / not yet built (be honest about these)

- **Inbound sync freshness.** GitHub Actions throttles the "every 5 min" ticket pull to 3–11 hours.
  Outbound drains on write; inbound needs a real scheduler (external cron or Kessel scheduler).
- **E10 Editor Tasks** — designed (6/7), **not built**. There is still no sub-task/checklist model
  anywhere in the schema; `Ticket` is flat. Vishen's prose editor instructions ("trim the ums, then
  get it to Glenn for YouTube, also a vertical version") remain untracked work.
- **E12 auto-editing agent** — scaffolded services only; no end-to-end render pilot yet. Portal
  integration deferred.
- **E13.3 performance attribution** — blocked. Only 96 of 8,546 posts are ticket-linked and the
  published-URL field is effectively empty (1 row). The user wants **Composio** investigated (it may
  even replace Hootsuite Perch) before finalizing the join design.
- **Dropbox folder OAuth** — DNA review resolves Dropbox **folder** links (`/scl/fo/`, `/sh/`, 28%
  of ticketed links) in code, but it's inert until all three creds are on the **render service**
  (`auto-editing-render`, never the portal). As of 2026-09-10 the app key + secret are set and
  `DROPBOX_REFRESH_TOKEN` is not, and `dropboxConfigured()` ANDs all three — so behaviour is
  unchanged. `files/list_folder` is user-auth only, so this needs a one-time
  `token_access_type=offline` grant with `files.metadata.read` + `sharing.read` ticked *first*.
  Landing it takes the "Saw the video" KPI from ~56% to ~84% with zero code change.
- **Dropbox Replay — permanently unsupported, not blocked.** Reverses the 2026-09-08 research note.
  The undocumented `/2/reel/*` API is real, but the gating probe run 2026-09-10 with our own
  credentials returned **400, `required scope 'private:files.content.read'`** — a first-party-only
  scope that isn't offerable in the App Console, so no credential we can hold opens it. For the ~5%
  of links that are Replay, paste-a-link is the intended path and the existing UI copy is correct.
  Do not re-open this on the theory that better scopes would fix it.
- **Asset library** — deliberately not built in the app; Rhythm is creating the canonical one in
  Airtable.
- **Airtable webhooks** — never enabled; everything is poll-based.
- **BlinkWork integration** — deferred. Contact is **Shafiu** (+ Moniek). BlinkLife integration code
  was removed 2026-07-02 to fix schema drift.
- **Asset-type economics (E11.A)** — deleted 2026-09-01 after breaking login twice. Not pending
  WIP — gone.

---

## 8. Gotchas that will bite you (important operational context)

- Managed Postgres is reachable **only via `kessel db`** — no local `DATABASE_URL` against prod. DDL
  goes through `kessel db migrate` / Prisma migrations against the managed DB.
- **Never set env/config outside `kessel` commands** (overwritten on deploy). Env/secret changes
  only take effect after a **new commit** forces a rebuild — a same-SHA `kessel deploy` no-ops.
  `NEXT_PUBLIC_*` are baked at build time.
- A manual `kessel deploy` builds **from local disk**, not from git — a dirty tree can ship
  uncommitted WIP. (It caused an outage 2026-08-31. But check git history first: an
  identical-looking 2026-09-01 recurrence was actually a committed regression.)
- `queueRank` is a **1–5 star rating**, not a drag-order position.
- Reference data is **read-only in the app** — edit it in Airtable, then run a reference reconcile
  (prod is `REFERENCE_BACKEND=postgres`, so Airtable taxonomy edits don't appear until a reconcile).
- **API routes guard themselves.** `middleware.ts` skips `/api`, so every route is public unless it
  calls `lib/api/guard.ts`. The presence of `await auth()` is *not* a guard.
- **The Clip Rules prompt in Airtable fully replaces `SYSTEM_PROMPT`** — editing `prompt.ts` alone
  does nothing in prod.
- `STRATEGY_SCHEMA` has a hard **structured-output grammar size limit**; adding clip fields once
  broke all generation for two weeks.
- Airtable scripts must reference fields **by ID**, not name — name-based lookup + a conditional
  payload caused silent data loss on "Requested By".
- **Employees is HR-synced.** Offboarding deletes the row and blanks every "Assigned Creative" link,
  so pulls must never clear an assignee.
- A blank asset-type `Category` silently hides it from the Shoot form (`Category` drives `isVideo`).
- `TEAM_SERVICE_LEVELS` must exactly match the live Airtable single-select — the token can't create
  options.

---

## 9. Architecture direction (longer-term)

Decided **HYBRID** (2026-06-25): build the workflow surfaces now in this standalone repo (valid
under either architecture), and later migrate the *nouns* (Asset, Person, Event, Channel, Metric,
Insight) to **BlinkWork brain nodes** + an app manifest, keeping only *workflow state* (tickets,
queue, statuses, approvals) app-owned. Airtable becomes a connector, not source of truth. Reference
monorepo: `github.com/mindvalley-ai/BlinkWork` (internal, via `gh`) — apps-framework manifest
format, brain-node API, `packages/ui`. The workflow decisions, prioritization algorithm, and UI
mockups (`context/mockups/`) stay valid in both worlds.

---

## 10. Where to look in the repo

| Thing | Path |
|---|---|
| Build spec + rules of engagement | `CLAUDE.md` |
| Design rulebook | `DESIGN_SYSTEM.md`, tokens in `app/globals.css` |
| PRD tree + status table | `prd/index.md`, `prd/content-production-management/` |
| Visual target mockups + clickable demo | `context/mockups/`, `context/mockups/demo.html` |
| AI capability roadmap | `context/intelligence-layer.md` |
| Architecture decisions | `context/decision-log.md`, `context/productization.md` |
| Prioritization algorithm | `context/prioritization-algorithm.md` |
| Airtable schema exports | `context/airtable-schema/` |
| Implementation plans (many) | `plans/` |
| Schema | `prisma/schema.prisma`, migrations in `prisma/migrations/` |
| Render service | `render-service/` |
| Cron | `.github/workflows/` |

**Known base/table IDs:** Creative Services / Prio base `appFEFygXo2pRc8AR` (Prio/Requests
`tblhrRl8GzsDMv0DD`, Creative Asset Type `tblLbcgob2Bxevugy`, Event Type `tblzTFTZ2ttEvi2j1`);
Titus Video Base `appDZnMnJGehbSOo5`; Ads Creative Library `appWYOr2p4RKHf2LR`; Vishen Lakhiani
Media `appvBtCYdaSrD1y11`. The Content & Comms Prio table is a **read-only mirror** — two paths
raise tickets into Creative Services: the portal's `createTicket` and a live "Raise Request"
checkbox automation.

# Content Studio v2 — the pivot: review, product thesis, and prototype

**Status:** plan (nothing built yet). Deliverable of this plan = a clickable HTML prototype + this
document as the proposal. No production code changes until the prototype is walked through with
Vishen, Gareth/Glen and Titus and the decisions in §6 have owners.

**Decisions taken with Rhythm (10 Sep 2026):** greenfield v2 information architecture (current
portal treated as a data source, not a UI to extend) · clickable HTML prototype · walkthrough
audience = Vishen, Gareth/Glen, Titus + team leads/editors (agencies appear as a capability, not
as the audience).

---

## 1. Context — why pivot, and what the review found

The ask: one intelligent system that runs the workflow for every content team (video/editors,
social, banners, email, podcast, shoots), is the repository of everything made, pulls numbers in
real time (Hootsuite, Composio, analytics, Metabase, Braze), lets agencies ideate/create/publish/
request shoots with us, shows managers performance, and teaches the content team what works.
Airtable as a building block for now, Postgres only later. Above all: **the right data flows in
and the system learns.**

The current portal was reviewed end to end (every route, server action, API route, Prisma model,
sync path, integration, and the product docs in `Context/`, `prd/`, `plans/`). The honest picture:

### What is real and working (keep — it is the foundation)
- **Ticket lifecycle spine**: `Ticket` + two status axes + scoring (`lib/tickets/scoring.ts`) +
  capacity/risk (`lib/tickets/intel.ts`) + `QueueTable` with the mandated 5 columns. In daily use.
- **Airtable ↔ Postgres sync engine**: generalized outbox push (`lib/airtable/push.ts`,
  `push-registry.ts`), cursored pull with echo suppression (`pull-core.ts`, `pull-registry.ts`),
  field-id map (`field-map.ts`). Six domains on `*_BACKEND=postgres`. Mature.
- **Two closed, human-gated learning loops**: clip rules (`lib/clipping/learn.ts` → 🧠 Clip Rules,
  weekly cron) and DNA review rules (`lib/dna-review/learn.ts` → `DnaReviewRule`, decision lock on
  Approved). These are the proof that "propose → human approves → behaviour changes" works here.
- **One unattended metrics source**: Hootsuite Perch → `social_metrics` via app-held OAuth
  (`lib/hootsuite/perch.ts`, `lib/metrics/social-perf.ts`). 1,642 rows / 329 posts / 10+ accounts.
- Shoots (two-way), Comms Calendar (read), MOW pack (staged/committed), Cover Generator, Slack
  digests, clip engine (`/media`, `/social`).

### What is broken at the join (the reason the vision can't happen on today's shape)
1. **No production→performance join.** `ticket_airtable_id` is populated on **0 of 1,642** metric
   rows. `assets` has **0 rows**. The published-URL field in Airtable is filled on 1 of 8,546
   posts. The caption-fingerprint matcher (`lib/performance/attribution.ts`) was written and **is
   called from nowhere**. Result: "how did *my* asset do" (Glen's ask) is unanswerable; nothing
   can learn from outcomes; the two learning loops run on human ratings only.
2. **Seven disjoint work nouns** with no shared spine: `Ticket`, `Shoot`, `SocialPost`,
   `MediaSource`/`ClipSuggestion`, `VishenVideo`, `CommsDay`/`MowSlot`, `Asset`. Each got its own
   page, sync path and status vocabulary. Banners/email/podcast have no home at all (banners = one
   link field; email = a calendar lane; podcast = clip-engine input).
3. **Intelligence is two islands + open loops.** Of the 5 capabilities in
   `Context/intelligence-layer.md`, #4 (DNA feedback) is built, #3 (prioritization) has scoring but
   no learning, #1 (performance insight), #2 (brief from what wins) don't exist, #5 is keyword
   matching (`app/api/ask/route.ts`). `TicketEvent` records **only** `ticketStatus` transitions —
   re-rank/assignee/prio changes leave no trace, so there is no signal to learn prioritization from.
4. **Numbers don't flow unattended.** Only Perch is app-owned. Metabase (leads/revenue), Composio
   (IG views, YouTube), Braze (email) reach us only via claude.ai connectors in a human's session
   (decision S6). Zero YouTube rows; `views` on 16/1,642; no email metrics. The scheduler is
   GitHub Actions, which slips **3–11 hours**. Three documented crons don't exist
   (`mow-monday-pack.yml`, DNA Tier-2 learn, pack generation).
5. **Agencies have zero access.** SSO is locked to `@mindvalley.com`; `Agency / External` is a
   role string with no other reference; `/stakeholder` shows *every* request to anyone signed in.
6. **Schema debt**: 9 models with 0 call sites (`Offer`, `DestinationLink`, `CreativeRecord`,
   `Experiment`, `AssetPerformanceSnapshot`, `PerformanceAttribution`, `Approval`, `Performance`,
   `Dna`); `Brief` read-never-written; `Learning.proposed` never set true. Orphan pages
   (`/vishen`, `/tickets`, content-engine redirects), two dead navs, stale README, a hardcoded
   "Synced 2 min ago".
7. **Airtable is still the editing surface** for taxonomy, DNA, clip rules, calendar, MOW message/
   goal — so it cannot be sunset until the app has editors for those nouns. Two live Airtable
   automations *create tickets* (shoot checkbox, Raise Request), so inbound pull can't stop either.

**Conclusion:** the portal is a good *workflow* tool with a broken *learning* spine. The pivot is
not "more pages" — it is to give every piece of content one identity from request to result, make
outcomes flow to that identity automatically, and put one propose→approve knowledge store over it.

---

## 2. Product thesis — Content Studio v2

**One loop for every team: Plan → Make → Publish → Measure → Learn.** Teams differ by *lane*
(video · social · design/banners · email · podcast · shoots), not by workflow shape. The IA is
organised by the loop; lane and role are filters, not sections.

### The content graph (six nouns; keep what exists, add what's missing)

| Noun | Purpose | Built on | Notes |
|---|---|---|---|
| **Work item** | The request → production record. Two status axes, priority, owner, brief, spec. | `Ticket` + `TicketEvent` (+ `Approval`, currently unused) | **Keep `Ticket` as-is; add `lane` enum.** Do NOT go polymorphic-JSON — queue, scoring, push-map and the 5-column mandate all read concrete columns. `Shoot` stays its own table (it's an event). `SocialPost` folds in only after sunset. |
| **Asset** | The repository: every deliverable, versions (raw/final), tabular creative record — copy, transcript, hook, CTA, offer (Gareth's "learning engine, not storage engine"). | `Asset` (0 rows → reshape freely) absorbing `CreativeRecord`; `Ticket.final*`/`folder*` become versions | |
| **Publication** | **NEW, load-bearing.** asset × channel × account × URL/platform_post_id × published_at × campaign tags × utm_content × short code. Created at publish time, so attribution is *by design*. | backfill from `VishenVideo.publishedLink`, `Ticket.final*`, `SocialMetric.publishedUrl`, `DestinationLink` (absorb — it already parses UTM→Offer), and one run of `attributeMetrics()` for history | The missing middle between plan (`CommsDay`) and observation (`SocialMetric`). |
| **Metric observation** | Time-series per publication per source. | `SocialMetric` + `ingestSocialMetrics()` (+ `publicationId` FK) | Sources: Perch (live), YouTube Analytics (app OAuth), Composio (server SDK), Metabase (REST, allowlisted Q31846/Q32044), Braze (REST, per send). |
| **Knowledge** | One propose→approve→apply store for everything learned: rules, insights, weight proposals, weekly learnings. `scope {lane, assetType, channel, owner}`, `evidence`, `confidence`, `active`. | `DnaReviewRule` (richest shape) + `lib/dna-review/learn.ts`; fold in `ClipRule`, `Learning` | Flat schemas only (structured-output grammar limit). |
| **Party / workspace** | Employees, contractors, agencies + members; row-level scoping. | `Employee`, `Contractor`, `AssetType.stakeholderEmails` (existing per-type allowlist) | Invitation-based sign-in for non-mindvalley domains. |

### Attribution by design (the single most important product rule)
Every work item gets a short code (e.g. `MV-4821`). It travels: as `utm_content` on the
destination link, as a Hootsuite tag, in the filename/caption convention, and on the Publication
row created when someone hits **Log publish** (or when Perch/Composio sees a new post whose tag or
URL matches). Metrics then join deterministically. Coverage is shown as a number
("attributed: 61%") on the Measure surface and never faked.

### Learning by design (propose only, cite evidence, sample-size honesty)
Generalize the two working loops into `lib/knowledge/learn.ts`: `distill(one human note) → rule`
and `propose(aggregated signals) → ≤3 proposals landed inactive`. New signal sources:
- **Publication × Metric outcomes** — top/bottom quartile per (lane, asset type, channel), n ≥ 8,
  joined to the creative record (hook/CTA/offer) → asset-DNA and "what's working" insights (cap. #1).
- **Re-rank / reassign / prio events** — widen `TicketEvent` to record them → scoring-weight
  proposals for the existing knobs (cap. #3).
- **Approval override notes + DNA finding reactions** — already flow.
- **Brief generation at intake** (cap. #2) = top performers of that event×asset type + DNA +
  active Knowledge, drafted into the brief field, editable.
One **Knowledge inbox** UI; approved items feed the DNA reviewer, the clip prompt assembly, the
scoring knobs, and the MOW learnings (finally setting `Learning.proposed=true` for AI drafts).

### Data flow (app-owned, scheduled, honest)
The "session-side only" constraint is about the *claude.ai connector*, not the source. Move
Metabase (REST + API key), Composio (server SDK + API key), Braze (REST), YouTube Analytics (channel
OAuth) app-side like Perch, credentials sealed in `external_credentials`, on a **real scheduler**
(Kessel cron or external cron hitting the existing bearer routes) — not GitHub Actions, not a
human's Claude session. Every surface labels absent data ("not connected", "n=3 — too small",
"not attributed") rather than guessing.

### Airtable: building block now → connector → sunset
1. PG canonical for all workflow nouns (6 done; finish comms/MOW). Outbox already behaves as a
   projection (loads current PG state, upserts) — Airtable becomes a read-only mirror.
2. Build app-side editors for what the team still edits in Airtable: taxonomy, DNA text, clip
   rules/knowledge, calendar/day plan, MOW message + goal. Rebuild the two ticket-creating Airtable
   automations app-side.
3. Stop pulls domain by domain (tickets last), run a "Airtable edited after last push" diff
   report before each flip, keep push 30 days, archive bases.
4. Keep the Airtable *connector* pattern only for external bases (Rise Voice's agency base).
   Biggest hidden cost: `Employee.id === airtableId` in ~430 places — identity is the last thing to
   migrate.

### Agencies as first-class collaborators
Agency workspace (Rise Voice, Simplex, Talking Heads, Two Comma PR): submit requests (intake with
brief), request shoots, upload deliverables (versions), see status of *their* items only, comment,
see *their* publications' numbers. Free, unlimited, read/comment + upload — the Ziflow pattern.
**Row scoping ships before the domain opens** (today `/stakeholder` is read-all).

---

## 3. The prototype (what this plan builds)

**Form:** one self-contained clickable HTML file, hash-routed, published as an Artifact (shareable
link) — same approach as `Context/mockups/demo.html`. Realistic data taken from the review (real
lanes, real accounts, 1,642/329, real gaps shown as gaps). Brand per `DESIGN_SYSTEM.md`: primary
`#572280`, gold `#F5B000` at most once per screen, Plus Jakarta Sans, 8/12px radii, light + dark.
Desktop-first, no horizontal body scroll, reflows to ~390px.

**File:** `Context/mockups/v2/content-studio-v2.html` (new folder; keeps the existing mockups
untouched). Publish via Artifact; also note the link in `Context/mockups/README.md` after approval.

**Skills to load before writing:** `artifact-design`, `dataviz` (KPI tiles, sparklines, bars),
`artifact-diagramming` (content-graph + data-flow diagrams).

### Screens (in walkthrough order)

| # | Screen | Who it's for | What it must show |
|---|---|---|---|
| 0 | **State of the portal** | everyone | The honest audit in one page: what's real (green), built-but-unwired (amber), planned-only (grey); the 0/1,642 join; the 3 missing crons; "why we pivot". Sets up the story. |
| 1 | **Today** (role-adaptive home) | Vishen · Glen · Titus toggle | Vishen: the one number (Metabase, brand-labelled), what ships today across lanes, what's blocked on him. Editor (Glen's ask): next up + **24h/7d readout of my last 5 publications**. Lead: lane health, at-risk, capacity. |
| 2 | **Plan → Calendar** | leads, Vishen | Week/month, all lanes as rows (video · social · email · banners · podcast · shoots), two brands, Message of the Week per brand, empty states that name the owner, not-dated tray count. |
| 3 | **Plan → Requests & Shoots** | leads, agencies | Intake (Event Type → Asset Type → lookups, lane auto-derived), shoot requests, agency-originated requests marked as such. |
| 4 | **Make → Queue** | Titus, editors | Mandated 5 columns first; lane tabs; short code column; risk chips; "auto-assigned (single preferred editor)" markers. |
| 5 | **Make → Work item** | editors, leads | Brief **drafted from what wins** (top-3 performers of this event×asset type cited), DNA baseline, spec, sub-tasks, versions (raw/final), DNA review findings, approvals with decision lock, **Log publish** action, linked publications + live metrics. |
| 6 | **Publish → Repository** | Gareth | The library as a table (Gareth's ask): asset, lane, versions, copy/transcript/hook/CTA/offer, publications, 7-day reach/views/leads; filters by lane/asset type/channel/campaign tag; version stack drawer. |
| 7 | **Measure → Performance** | Glen, leads | By lane / channel / owner / campaign tag; per-editor readouts; **attribution coverage %** as a first-class number; the Monday pack (MOW) with committed figures; source badges (Perch ✓, YouTube Analytics ✓, Composio, Metabase ✓, Braze). |
| 8 | **Learn → Insights & Knowledge inbox** | Gareth, Titus, Glen | "What's working" cards with evidence + n; proposals from all loops (clip rule, DNA rule, scoring weight, MOW learning) with approve/edit/reject; active rulebook by lane/asset type; the "AI-drafted" marker Glen asked for. |
| 9 | **Partners** (agency workspace) | shown as capability | Rise Voice view: their requests, shoot request, uploads, status, their numbers only. |
| 10 | **Connections & data health** | Rhythm, Glen | Each source: owned-by-app / session-only / not connected, last pull, rows, freshness; scheduler status; Airtable sunset progress per domain (canonical / mirror / archived). |
| D1 | **Diagram: the content graph** | all | Work item → Asset → Publication → Metric → Knowledge → back into Brief/Queue. |
| D2 | **Diagram: data flow** | all | Sources → app-owned pulls on a scheduler → sink → attribution → surfaces; Airtable as connector. |

Interaction: left nav by loop stage, top role-toggle on Today, lane tabs on Queue/Repository/
Performance, drawers for work item / version stack / proposal evidence. Every fake-able number
carries a source badge; absent data uses the tier-1/tier-2 empty states from `DESIGN_SYSTEM.md`.

---

## 4. After the prototype is validated — build sequence (each step shippable, portal keeps working)

Not part of this plan's execution; recorded so the prototype is honest about what it implies.

1. **Scheduler** — move `ticket-sync`, `perch-metrics`, `clip-learn` (+ the missing MOW pack and
   DNA learn crons) off GitHub Actions onto Kessel cron / external cron hitting existing bearer
   routes. No schema change. Cheap; unblocks trust in every number below.
2. **Publication + `SocialMetric.publicationId`** — new table; backfill from `VishenVideo`,
   `Ticket.final*`, Perch `platformPostId`; run `attributeMetrics()` once; add **Log publish** on
   `ticketStatus → Published`. *This is the step that first makes Ticket × outcome exist as a row.*
3. **Event coverage** — widen `TicketEvent` (`lib/tickets/write.postgres.ts`) to record
   `queueRank`, `assigneeId`, `prioStatus` with field/from/to.
4. **Knowledge** — generalize `DnaReviewRule` → `Knowledge` with `scope`; migrate rows in place;
   mirror `ClipRule` in (keep pushing to Airtable via outbox); one `/learn` inbox replacing
   `/settings/clip-rules` + the DNA rule list; first Publication×Metric proposals.
5. **`Ticket.lane` + Asset reshape** — versions + creative record; write a version whenever
   `final*` changes; banner/email/podcast requests are tickets with a lane.
6. **App-side editors for reference nouns**; `REFERENCE_BACKEND` writes to PG; push via outbox.
7. **Metabase / YouTube Analytics / Composio / Braze pulls** via `ExternalCredential`, keyed to
   Publication by short code / utm_content / URL.
8. **Party + agency scoping** — invitation table; `auth.config.ts` allows mindvalley.com **or**
   invited email; `scopeFilterFor(access)` applied in `getQueueTickets`/`getRecentShipped`;
   untagged non-mindvalley users get `[]` roles. Then open the domain.
9. **Stop pulls** domain by domain after rebuilding the two Airtable automations app-side;
   push-only 30 days; archive.

Delete rather than migrate: `ClipSuggestion`/`ClipStrategy`/`ContentSource` (retired content
engine), `Brief`, `Experiment`, `Performance`, `AssetPerformanceSnapshot`,
`PerformanceAttribution`, `Dna`; orphan pages `/vishen`, `/tickets`, `content-engine/*`, dead
`AppNav`/`Sidebar`, duplicate `ClipApprovalModal`.

---

## 5. Risks to say out loud in the walkthrough

1. **Attribution stays hollow without publish-time discipline.** Backfill fixes history; only a
   Log-publish action / tag convention fixes the future. Hootsuite tags cover 56/329 posts today.
   Don't promise "real-time numbers per asset" until coverage is measured on screen.
2. **Row scoping before opening SSO** — one agency invite today would leak the whole queue.
3. **Two Airtable automations create tickets** — rebuild before pull stops or requests vanish.
4. **Identity is an Airtable recId** (`Employee.id`) — largest refactor; HR sync deletes rows.
5. **YouTube CTR/AVD/retention** (Vishen's 7% benchmark) need YouTube Analytics API with channel
   OAuth — not Composio, not Perch. Plan item for step 7.
6. **Metabase question allowlist stays hardcoded** (31846 leads / 32044 revenue; never 31815;
   sum distinct order_id; filter organic social; name the brand) — the generator faked revenue once.
7. **Single-threaded data ownership** (Live Date has no owner; Ramya contracting) — the calendar
   renders empty when data is missing, and looks broken.
8. **14 Sep MOW commitment** runs on the current portal; the v2 build must not destabilise it.

---

## 6. Decisions that need owners before any build

| # | Decision | Proposed | Owner |
|---|---|---|---|
| P1 | Short-code convention and where it must appear (utm_content, Hootsuite tag, filename) | `MV-####` per work item; mandatory on Log publish | Glen + Gareth |
| P2 | Which lanes ship first as tickets-with-lane | video, social, design/banners; email + podcast next | Titus + Rafi |
| P3 | Scheduler | Kessel cron if available, else external cron → bearer routes | Rhythm |
| P4 | App-side Metabase/Braze/Composio credentials (who owns the keys) | sealed in `external_credentials`, Glen grants | Glen |
| P5 | Agency access model | invitation by email, Google login any domain | Rhythm + InfoSec |
| P6 | Airtable sunset order + date for "no more editing in Airtable" | reference nouns first, tickets last | Titus + Ramya |
| P7 | Event-tier ranking (still open since June) | needed for scoring learning | Moniek |
| P8 | Banner lane taxonomy (E14) | after Rafi 1:1 | Rafi |

---

## 7. Verification (for the prototype)

- Publish the Artifact; open every hash route from the nav and from in-page links (no dead ends).
- Toggle light/dark; confirm one gold element max per screen, no raw off-brand colours.
- Resize to ~390px: no horizontal body scroll; tables scroll inside their container.
- Every number has a source badge; every absent number is a labelled empty state, none invented.
- Role toggle on Today swaps Vishen / editor / lead content.
- Diagrams legible in both themes (inline SVG, currentColor).
- Walk the story: screen 0 → 1 → 5 → 6 → 7 → 8 tells "one identity, outcomes flow, system proposes,
  humans approve" without narration.

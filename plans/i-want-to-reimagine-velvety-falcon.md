# Content Studio v2 — the pivot: review, discovery record, and real-data prototype

**Status:** plan. **Hard rule (Rhythm, 10 Sep 2026): nothing is written in production code until a
prototype built on REAL data is approved by Rhythm.** This plan's only outputs are (1) the product PRD
`prd/content-studio-v2.md` (via the `/prd` protocol, discovery already run below), (2) a static
clickable HTML prototype fed by real Postgres/Airtable exports, published as an Artifact.
The build sequence in §7 is recorded for honesty, not for execution.

Decisions taken with Rhythm on 10 Sep: greenfield v2 information architecture (current portal =
data source, not a UI to extend) · clickable HTML prototype · walkthrough audience Vishen,
Gareth/Glen, Titus + editors · sign-off = Rhythm alone.

---

## 1. Context — why pivot, and what the review found

The ask: one intelligent system that runs the workflow for every content team (video/editors,
social, banners, email, podcast, shoots), is the repository of everything made, pulls numbers in
real time (Hootsuite, Composio, analytics, Metabase, Braze), lets agencies ideate/create/publish/
request shoots with us, shows managers performance, and teaches the content team what works —
**a continuous learning engine.** Airtable as a building block now, Postgres only later.

Full review done (every route, action, API route, model, sync path, integration, and the docs in
`Context/`, `prd/`, `plans/`). Honest picture:

### Real and working (foundation — keep)
- Ticket lifecycle spine: `Ticket` + two status axes + `lib/tickets/scoring.ts` + `intel.ts` +
  `QueueTable` with the mandated 5 columns. 11,143 tickets.
- Airtable ↔ Postgres sync engine: outbox push (`lib/airtable/push.ts`, `push-registry.ts`),
  cursored pull with echo suppression (`pull-core.ts`, `pull-registry.ts`), field-id map. Six
  domains on `*_BACKEND=postgres`.
- Two closed human-gated learning loops: clip rules (`lib/clipping/learn.ts` → 🧠 Clip Rules,
  weekly cron) and DNA review rules (`lib/dna-review/learn.ts` → `DnaReviewRule`, decision lock).
- One unattended metrics source: Hootsuite Perch → `social_metrics` via app-held OAuth
  (`lib/hootsuite/perch.ts`, `lib/metrics/social-perf.ts`). 1,642 rows / 329 posts / 10+ accounts.
- Shoots (two-way), Comms Calendar (read), MOW pack (staged/committed), Cover Generator, Slack
  digests, clip engine.

### Broken at the join (why the vision can't run on today's shape)
1. **No production→performance join.** `ticket_airtable_id` set on 0/1,642 metric rows; `assets`
   0 rows; `lib/performance/attribution.ts` (caption matcher) has no caller.
2. **Seven disjoint work nouns** (`Ticket`, `Shoot`, `SocialPost`, `MediaSource`/`ClipSuggestion`,
   `VishenVideo`, `CommsDay`/`MowSlot`, `Asset`), each with its own page and status vocabulary.
   Banners/email/podcast have no home.
3. **Intelligence = two islands + open loops.** Of the 5 capabilities in
   `Context/intelligence-layer.md`: #4 built, #3 scoring without learning, #1 and #2 absent, #5 a
   keyword stub. `TicketEvent` logs only `ticketStatus` — no re-rank signal exists.
4. **Numbers don't flow unattended.** Metabase/Composio/Braze are session-side claude.ai
   connectors. Scheduler = GitHub Actions slipping 3–11h. Three documented crons don't exist.
5. **Agencies: zero access.** SSO locked to `@mindvalley.com`; `/stakeholder` is read-all.
6. **Schema debt**: 9 models with 0 call sites; `Brief` never written; `Learning.proposed` never
   true; orphan pages, two dead navs, stale README, hardcoded "Synced 2 min ago".
7. **Airtable is still the editing surface** for taxonomy, DNA, rules, calendar, MOW; two live
   Airtable automations create tickets → pulls can't stop yet.

### NEW finding from the worked example (10 Sep) — the views gap is OUR bug
Perch's raw payload carries `post_views`, `likes`, `saved`, `shares`, `comments`,
`ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `post_type`, `collaborators`
(+ invite status) on **869/869 IG rows**; our mapper lifts none of them (`views` column filled on
0). The umbrella plan's "views on 16/1,642, Composio needed" conclusion is wrong for IG — the data
is already in Postgres. Watch time exists on 468 rows (the reels).

---

## 2. The proof point — one record, end to end (real numbers, 10 Sep)

**Airtable 📣 Social `recJ9laDP1uWIXTHe`** (`app9YRZOVeE65fJPA/tblCcrdkHzOakOGnm`): *Pathway::
Manifesting – Stage Talk – Manifest Love* · `11: Released` · posted 9 Sep 23:01 UTC · IG + FB
MV Manifesting · editor **Yuthika Peiris** · Creative ticket **#11057** (`recfmrnlmw9pqbgO3`,
asset type *Pathway Organic – Snippets*, 9×16, event *Social Media Promotion*, source asset
`recllHS6i1jgSoYYY` = a paid Masterclass ad re-cut to organic) · content pillar `💡 Educate` ·
caption, transcript, 1080×1920 cover attached · speaker Jeffrey Allen.

**Postgres `social_metrics`** (Perch, captured 10 Sep): found by URL `instagram.com/reel/DdFYhV8DXTk`,
`platform_post_id 17841400376176964_18092461193412440`, tag `Jeffrey Allen`, `ticket_airtable_id`
NULL. Day-1: views 3,725 · reach 2,835 · ER 1.52% · likes 51 · saves 16 · shares 4 · comments 9 ·
avg watch 8s · total watch 25,379s · collaborators `@mindvalley.manifesting`, `@iamjeffreyallen`
both **`Pending`**.

**Day-1 vs the 21 @mindvalley reels published since 27 Aug (same account, same age):**

| Metric | This reel | Peer median (n=21) | Position |
|---|---|---|---|
| Views | 3,725 | 9,735 | 19th of 21 |
| Reach | 2,835 | ~7,900 | bottom quartile |
| Engagement rate | 1.52% | 1.9% | below |
| Saves | 16 | 31 | below |
| Comments (the gated CTA's own KPI) | 9 | 20 | below |
| **Avg watch time** | **8s** | **5s** (n=15) | **top third** |

**Learnings the engine would propose (each with evidence + n):**
1. *Distribution signal, not edit signal:* both collab invites were Pending at capture → the reel
   reached only @mindvalley's audience. Owner: social team. Certain (in payload).
2. *Edit signal, positive:* 8s avg watch vs 5s median → the re-cut kept viewers. Proposed DNA rule
   for *Pathway Organic Snippets*: "repurposed-ad re-cuts that strip end-card/CTA slate retain above
   baseline" (n=15 with watch time — shown as *watch*, not *rule*, until n≥8 in both cohorts).
3. *Caption signal:* "Comment X" gated-CTA reels get ~40% less day-1 views (median 6.2k vs 10.9k,
   n=8 vs 13) — judge them on comments; this one under-indexed there too. Owner: caption owner.

Conclusion: intelligence from Airtable-mirrored-to-Postgres is feasible today for this asset
class; the prototype can and must run on real numbers.

---

## 3. Discovery record (the `/prd` protocol, run 10 Sep with Rhythm) — DECIDED

| # | Question | Decision |
|---|---|---|
| D1 | PRD scope | **New product PRD `prd/content-studio-v2.md`** superseding `prd/content-production-management.md` (which stays as history, linked). Learning engine, content graph, lanes, agencies, Airtable sunset = its epics. |
| D2 | Units of learning in scope | All four: editor's edit · asset-type DNA · caption/CTA/distribution · campaign/speaker/offer. |
| D3 | First loop that must work end-to-end | **Editor + asset-type DNA.** The others are sequenced epics behind it. |
| D4 | North-star metric | **Depends on the publication's declared goal.** Editors judged on retention/watch time; captions on comments/saves; campaigns on leads/revenue; awareness on reach. |
| D5 | Goal source | Airtable Social *Content Pillar* (`💡 Educate`…) mapped to a goal metric now; a portal Goal field on Publication later. |
| D6 | Readout windows | **24h + 7d, always vs same-account/same-type peers at the same age.** Nothing read before 24h. |
| D7 | Delivery (all four, in this order of build) | Performance band inside the ticket → "My work" page → Slack DM 24h after publish → Monday team digest (folded into MOW/social digest). |
| D8 | Approval of numeric DNA proposals | **Team lead of the asset type activates; editor endorses/disputes** (reaction = Tier-1 signal). Mirrors `AssetType.teamLeads` + `DnaReviewRule` approval. |
| D9 | People comparison | **Never rank people.** Per-editor views private to editor + lead; managers see aggregates by asset type/channel/campaign. |
| D10 | Attribution mechanism | **The system matches, humans confirm only on ambiguity.** Signals in order: URL/platform_post_id (Airtable Social *Published Link*, `VishenVideo.publishedLink`) → caption fingerprint (`lib/performance/attribution.ts`, exists) → transcript overlap (Social *Transcript* vs Perch caption/body) → image similarity (Social cover attachment vs Perch thumbnail). Plus a **Log publish** action in the portal for the future. Not a data-entry discipline on Vidura/Ramya. |
| D11 | Channels v1 | IG (all MV accounts Perch covers) + FB (Perch, clicks only). **v1.1:** YouTube (needs YouTube Analytics channel OAuth — 0 rows today), TikTok, LinkedIn/VL — cannot appear in a real-data prototype until integrated. |
| D12 | Sample floor | **n ≥ 8 same-type posts in both cohorts**; below that the UI shows "collecting (3/8)". |
| D13 | Prototype bar | **Static HTML with real numbers exported from Postgres + Airtable**, baked in as JSON. No backend. Re-export to refresh. |
| D14 | Success criteria (60 days) | ≥ 80% of Released social posts attributed to a ticket within 24h (today ~0%) · ≥ 10 DNA rules approved from numeric proposals with ≤ 30% rejected. |
| D15 | Non-negotiable failure behaviour | Never show a number without source, capture age and n · always distinguish *edit signal* from *distribution signal* · dead tokens ⇒ "not captured", never stale-as-current. |
| D16 | Boundaries v1 | No auto-editing/re-cuts (E12 separate) · no per-post revenue/leads claims (Metabase stays week/campaign level until utm_content-per-post) · no cross-account or cross-brand comparison. **Airtable structure changes ARE allowed** (Goal field, short code). |
| D17 | Rule shape | `statement + rationale + evidence(refs, n, delta) + example + weight + confidence`, scoped to asset type — the `DnaReviewRule` shape. |
| D18 | Lanes in the prototype as real queues | Video · Social (posts + clips) · Email · Podcast · Shoots. **Banners excluded** (E14 held pending Rafi). |
| D19 | Agencies in v2 | See status + performance of own items · submit requests + shoot requests · upload deliverables/versions + comment · sign in with any Google account **by invitation** (row scoping ships first). |
| D20 | Airtable sunset | Domain by domain as each app editor ships, no fixed date; Airtable a read-only mirror throughout, then archived. Reference nouns → calendar/MOW → tickets last. |
| D21 | Ownership of a repurposed publication | **The last ticket that produced the delivered file** (#11057) owns it and gets the readout; source ticket linked as *derived from*; learning attaches to the re-cut's asset type. |
| D22 | Editor identity | `Employee` by email, `assigneeName` snapshot on the ticket as fallback. |
| D23 | Sign-off | **Rhythm** approves the prototype; that approval is the only thing that unlocks code. |

### Still open (carry into the PRD's Open Questions with owners)
- O1 Goal-metric mapping table for each Content Pillar (who decides: Gareth?).
- O2 Short-code convention if/when introduced (`MV-11057`?) and where it must appear (utm_content, Hootsuite tag, filename).
- O3 Confidence threshold and UI for the image/transcript matcher's "ambiguous → confirm" queue; who confirms (social manager?).
- O4 Event-tier ranking (open since June) — needed before scoring learns. Owner Moniek.
- O5 Metabase/Braze/Composio app-side credentials — who owns the keys (Glen?).
- O6 Scheduler choice (Kessel cron vs external) — Rhythm.
- O7 Banner lane taxonomy (E14) — after Rafi 1:1.
- O8 Agency invitation model with InfoSec (PAT sharing blocked for Rise Voice's base).

---

## 4. Product thesis — Content Studio v2 (what the PRD will say)

**One loop for every team: Plan → Make → Publish → Measure → Learn.** Lanes (video · social ·
email · podcast · shoots; banners later) are filters, not sections. Roles adapt the home page.

### The content graph (six nouns)
| Noun | Built on | Rule |
|---|---|---|
| **Work item** | `Ticket` + `TicketEvent` (+`Approval`) | Keep `Ticket`; add `lane`. No polymorphic JSON (queue, scoring, push-map, 5-column mandate read concrete columns). `Shoot` stays its own table. |
| **Asset** (repository) | `Asset` (0 rows → reshape) + `CreativeRecord` | Versions raw/final + tabular creative record: copy, transcript, hook, CTA, offer, cover. |
| **Publication** (NEW) | backfill from Social *Published Link*, `VishenVideo.publishedLink`, Perch `platform_post_id`, matcher | asset × channel × account × URL × published_at × goal × tags × short code × `derivedFrom`. The missing middle between plan and observation. |
| **Metric observation** | `SocialMetric` + `ingestSocialMetrics()` + `publicationId` FK | Lift the full Perch payload (views, saves, shares, watch time, post_type, collaborators). Sources later: YouTube Analytics, Metabase (allowlisted Q31846/Q32044), Braze, Composio. |
| **Knowledge** | `DnaReviewRule` shape + `lib/dna-review/learn.ts`; fold in `ClipRule`, `Learning` | One propose→endorse→approve→apply store, scoped `{lane, assetType, channel, owner}`, flat schema. |
| **Party / workspace** | `Employee`, `Contractor`, `AssetType.stakeholderEmails` | Agencies + members; invitation table; `scopeFilterFor(access)` in every read. |

### The learning engine (first loop = editor + asset-type DNA)
Per publication at 24h and 7d: cohort = same account × same post type × same age; goal from
pillar; readout = the asset's metrics vs cohort median with n, plus *edit signals* (watch time,
retention) separated from *distribution signals* (collab status, reach, posting time). Aggregation
per asset type: top vs bottom quartile on the goal metric, n≥8 both sides → `propose()` ≤3 rules
landed inactive → editor endorses/disputes → team lead activates → rule feeds DNA review at
`Review`, the brief draft at intake, and the clip prompt. Every proposal cites publication ids.

### Data flow
App-owned pulls (Perch today; YouTube Analytics, Metabase REST, Braze REST, Composio SDK later)
with credentials in `external_credentials`, on a real scheduler. Every surface labels absent data.

### Airtable → mirror → connector → archive (D20). Agencies (D19).

---

## 5. The prototype (what gets built on approval of this plan)

**Form:** one static, self-contained, hash-routed HTML file at
`Context/mockups/v2/content-studio-v2.html`, published as an Artifact. **All numbers real**,
exported at build time into an inline JSON block: `kessel db query` (read-only SELECTs, JSON
output) + Airtable MCP reads → JSON in the scratchpad → embedded. Brand per `DESIGN_SYSTEM.md`
(primary `#572280`, gold at most once per screen, Plus Jakarta Sans, 8/12px radii, light + dark),
no horizontal body scroll, reflows to ~390px. Skills to load first: `artifact-design`, `dataviz`,
`artifact-diagramming`.

**Real-data export list (read-only):**
- `social_metrics` latest capture per IG post for all MV accounts: reach, views, ER, likes, saves,
  shares, comments, avg watch, post_type, tags, posted_at, collaborators, caption head, URL.
- Day-1 and day-7 snapshots per post (captured_at − posted_at ∈ {1, 7}).
- 📣 Social records with Published Link + Creative Ticket + Assigned + Content Pillar + Live Date
  (Airtable) → the attributed set; count = attribution coverage %.
- Tickets for those Social records (asset type, event type, dimensions, editor, brief) via PG.
- Editors with ≥1 attributed publication → "My work" data (Yuthika is the worked example).
- Active `DnaReviewRule`s and 🧠 Clip Rules → the Knowledge/rulebook screen; MOW `Learning`s.
- Comms calendar week of 7–13 Sep (Airtable) → Plan screens; shoots board; clip inbox.
- Data-health facts: per-source row counts, last capture, crons that exist vs documented.

**Screens (walkthrough order):**
| # | Screen | Shows |
|---|---|---|
| 0 | State of the portal | The audit: real / built-unwired / planned-only; 0/1,642 join; the views-mapper bug; why pivot. |
| 1 | Today (role toggle Vishen · editor · lead) | Vishen: one number (labelled by brand + source), shipping today, blocked on him. Editor (Yuthika): next up + **24h/7d readouts of her last publications**. Lead: lane health, at-risk, capacity. |
| 2 | Plan → Calendar | Week 7–13 Sep, lanes as rows, two brands, MOW per brand, owner-named empty states, not-dated tray count (221). |
| 3 | Plan → Requests & Shoots | Intake chain; shoot requests; agency-originated marker. |
| 4 | Make → Queue | 5 mandated columns; lane tabs (video/social/email/podcast/shoots); risk chips. |
| 5 | Make → Work item #11057 | Brief; *derived from* source asset; DNA baseline; versions; DNA review; approvals; **Publication** with live day-1 metrics vs cohort; edit vs distribution signals; proposed learning with endorse/dispute. |
| 6 | Publish → Repository | Table: asset, lane, versions, copy/transcript/hook/CTA/offer, publications, 7d metrics; filters; version-stack drawer. |
| 7 | Measure → Performance | By lane/channel/campaign tag; **attribution coverage %**; source badges + freshness; Monday pack. |
| 8 | Learn → Insights & Knowledge inbox | "What's working" with evidence + n; proposals from all loops; endorse/dispute/approve; rulebook by asset type; "AI-drafted" marker. |
| 9 | Partners | Rise Voice workspace: own requests, shoot request, uploads, status, own numbers. |
| 10 | Connections & data health | Per source: owned/session-only/not connected, last pull, rows; scheduler; Airtable sunset progress per domain. |
| D1 | Diagram: content graph | Work item → Asset → Publication → Metric → Knowledge → Brief/Queue. |
| D2 | Diagram: data flow + matcher | Sources → scheduled pulls → sink → multi-signal attribution → surfaces. |

---

## 6. Order of work on approval of this plan (no production code)

1. Write `prd/content-studio-v2.md` (product template, 8 sections) from §3–§4; link it as
   superseding `prd/content-production-management.md`; update `prd/index.md`. Create child epic
   stubs: E-A Content graph & Publication · E-B Continuous learning engine (first loop) · E-C
   Unattended data flow & scheduler · E-D Lanes & v2 IA · E-E Agencies & access · E-F Airtable
   sunset · E-G Caption/distribution loop · E-H Campaign/offer loop.
2. Export the real data (read-only) into the scratchpad as JSON.
3. Build the prototype, publish the Artifact, walk it with Rhythm; iterate until approved.
4. Save memory: "no code until approved real-data prototype"; "Perch payload has views/watch time —
   mapper gap"; "attribution = system matches (URL→caption→transcript→image), humans confirm".

---

## 7. After approval — build sequence (recorded for honesty; each step shippable)

1. Scheduler off GitHub Actions. 2. Lift the full Perch payload into columns (views, saves, shares,
watch time, post_type, collaborators) — pure mapper fix. 3. `Publication` + `SocialMetric.publicationId`;
backfill from Social Published Link + `VishenVideo` + matcher (URL → caption → transcript → image);
Log-publish action. 4. Widen `TicketEvent` (rank/assignee/prio). 5. `Knowledge` generalizing
`DnaReviewRule`; ticket performance band; My work; 24h Slack DM; cohort proposals with n≥8;
endorse/dispute/approve. 6. `Ticket.lane` + Asset reshape. 7. App-side editors for reference nouns.
8. YouTube Analytics OAuth; Metabase/Braze/Composio app-side. 9. Party + invitations + row scoping,
then open SSO. 10. Stop pulls domain by domain after rebuilding the two Airtable automations.
Delete: `ClipSuggestion`/`ClipStrategy`/`ContentSource`, `Brief`, `Experiment`, `Performance`,
`AssetPerformanceSnapshot`, `PerformanceAttribution`, `Dna`; orphan pages and dead navs.

## 8. Risks to say out loud
Attribution coverage is a number on screen, never assumed · row scoping before opening SSO ·
two Airtable automations create tickets · `Employee.id` is an Airtable recId (~430 refs) ·
YouTube CTR/AVD need Analytics API, not Composio/Perch · Metabase allowlist stays hardcoded ·
14 Sep MOW runs on the current portal and must not be destabilised.

## 9. Verification (prototype)
Every hash route reachable from nav and in-page links · light/dark · ≤1 gold element per screen ·
390px no horizontal scroll · every number carries source + capture age + n · the worked example
(#11057 / reel DdFYhV8DXTk / Yuthika) is traceable on screens 5, 6, 7, 8 with the numbers in §2 ·
JSON block regenerates from the export queries without hand edits.

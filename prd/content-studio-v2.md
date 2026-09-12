---
title: 'Content Studio v2'
slug: 'content-studio-v2'
scope: product
status: discovery
parent: null
children:
  - content-studio-v2/content-graph-and-publication.md
  - content-studio-v2/continuous-learning-engine.md
  - content-studio-v2/unattended-data-flow-and-scheduler.md
  - content-studio-v2/lanes-and-v2-ia.md
  - content-studio-v2/agencies-and-access.md
  - content-studio-v2/airtable-sunset.md
  - content-studio-v2/caption-distribution-loop.md
  - content-studio-v2/campaign-offer-loop.md
  - content-studio-v2/team-agents-and-signal-bus.md
created: 2026-09-10
updated: 2026-09-12
resolution: 8/9
supersedes: content-production-management.md
---

# Content Studio v2

> **Supersedes** [Mindvalley Content Production & Management System](content-production-management.md)
> (2026-06) for product direction. That PRD stays as the record of the June decisions; its workflow
> decisions — the event→asset intake chain, the two status axes, the ranked queue, the mandated
> 5-column header — remain valid and are inherited here unchanged.

> **Source of truth for this document:** `plans/i-want-to-reimagine-velvety-falcon.md` — the full
> code review (every route, action, API route, model, sync path, integration) and the `/prd`
> discovery runs with Rhythm on 2026-09-10 (decisions D1–D55, open questions O1–O8), 2026-09-11
> (the org brief D56, persona desks D57–D68, team agents and the missing workflow pieces D69–D84,
> the agent contracts and the as-is map D85–D100) and 2026-09-12 (the twenty decisions that remove
> the developer's guesswork D101–D120, the build slice and its preview environment D121–D129).
> Decision IDs are kept in brackets throughout so every line traces back to a decision. Nothing
> here is a new decision.

> **Hard rule (Rhythm, 2026-09-10):** no production code is written for this product until a
> clickable prototype built on **real** Postgres + Airtable data is approved by Rhythm [D13, D23,
> D27]. This PRD and that prototype are the only permitted outputs until then.

## Problem

The team asked for one intelligent system that runs the workflow for every content team (video
editors, social, banners, email, podcast, shoots), is the repository of everything made, pulls
numbers in from the channels unattended, lets agencies work with us inside it, shows managers
performance, and teaches the content team what works — a **continuous learning engine**. The
current portal cannot become that by extension. A full review on 2026-09-10 found the following.

**What is real and working (the foundation we keep).** A ticket lifecycle spine (`Ticket` + two
status axes + scoring + intel + a `QueueTable` with the mandated 5 columns) holding **11,143
tickets**. An Airtable ↔ Postgres sync engine (outbox push, cursored pull with echo suppression,
field-id map) with six domains on `*_BACKEND=postgres`. Two closed, human-gated learning loops
(clip rules → 🧠 Clip Rules weekly; DNA review rules → `DnaReviewRule` with a decision lock). One
unattended metrics source: Hootsuite Perch → `social_metrics`, **1,642 rows / 329 posts / 10+
accounts**. Shoots (two-way), Comms Calendar (read), MOW pack, Cover Generator, Slack digests, the
clip engine.

**What is broken at the join — why the vision cannot run on today's shape.**

1. **There is no production→performance join.** `ticket_airtable_id` is set on **0 of 1,642**
   metric rows. The `assets` table has **0 rows**. The caption matcher
   (`lib/performance/attribution.ts`) exists and has **no caller**. Nobody can answer "who edited
   this and how did it perform" because the two halves are never connected.
2. **Seven disjoint work nouns** — `Ticket`, `Shoot`, `SocialPost`, `MediaSource`/`ClipSuggestion`,
   `VishenVideo`, `CommsDay`/`MowSlot`, `Asset` — each with its own page and its own status
   vocabulary. Banners, email and podcast have no home at all.
3. **Intelligence is two islands and three open loops.** Of the five capabilities in
   `context/intelligence-layer.md`: #4 (DNA feedback) is built, #3 (prioritisation) scores but never
   learns, #1 (performance insight) and #2 (brief generation) are absent, #5 (conversational) is a
   keyword stub. `TicketEvent` logs only `ticketStatus`, so no re-rank signal exists to learn from.
4. **Numbers do not flow unattended.** Metabase, Composio and Braze are session-side claude.ai
   connectors, usable only while a person is in a chat. The scheduler is GitHub Actions and the
   "every 5 minutes" cron actually fires **3–11 hours** apart. Three crons that are documented do
   not exist.
5. **Agencies have zero access.** SSO is locked to `@mindvalley.com`; the only external surface,
   `/stakeholder`, is read-everything.
6. **Schema debt.** 9 models with 0 call sites; `Brief` is never written; `Learning.proposed` is
   never true; orphan pages, two dead navs, a stale README, a hardcoded "Synced 2 min ago".
7. **Airtable is still the editing surface** for taxonomy, DNA, rules, calendar and MOW, and two
   live Airtable automations create tickets — so inbound pulls cannot be switched off yet.

**The finding that changed the plan (2026-09-10).** The worked example below showed that the
"views gap" is our bug, not a data gap. Perch's raw payload carries `post_views`, `likes`, `saved`,
`shares`, `comments`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `post_type` and
`collaborators` (with invite status) on **869 of 869** Instagram rows. Our mapper lifts none of
them: the `views` column is filled on **0** rows. Watch time exists on 468 rows (the reels). The
earlier conclusion — "views on 16/1,642, Composio needed" — is wrong for IG. The data is already
in Postgres. The intelligence layer is feasible today for this asset class; what is missing is
the join, the scheduler, and a product shape that puts them in one loop.

Why now: the 14 Sep MOW go-live puts the current portal in front of Vishen weekly; every week the
readout runs without a production→performance link is a week the team learns nothing from
what it ships.

## Vision

**One loop for every team: Plan → Make → Publish → Measure → Learn.** Lanes (video · social ·
email · podcast · shoots; banners later) are filters on that loop, not separate sections. Roles
adapt the home page; the loop does not change.

**The content graph — six nouns, one store.**

| Noun | Built on | Rule |
|---|---|---|
| **Work item** | `Ticket` + `TicketEvent` (+ `Approval`) | Keep `Ticket`; add `lane`. No polymorphic JSON — queue, scoring, push-map and the 5-column mandate read concrete columns. `Shoot` stays its own table. |
| **Asset** (the repository) | `Asset` (0 rows → reshape) + `CreativeRecord` | Versions raw/final plus a tabular creative record: copy, transcript, hook, CTA, offer, cover. |
| **Publication** (NEW) | Backfilled from Social *Published Link*, `VishenVideo.publishedLink`, Perch `platform_post_id`, the matcher | asset × channel × account × URL × published_at × goal × tags × short code × `derivedFrom`. The missing middle between plan and observation. |
| **Metric observation** | `SocialMetric` + `ingestSocialMetrics()` + a `publicationId` FK | Lift the full Perch payload. Later sources: YouTube Analytics, Metabase (allowlisted Q31846 / Q32044), Braze, Composio. |
| **Knowledge** | `DnaReviewRule` shape + `lib/dna-review/learn.ts`; fold in `ClipRule`, `Learning` | One propose → endorse → approve → apply store, scoped `{lane, assetType, channel, owner}`, flat schema. |
| **Party / workspace** | `Employee`, `Contractor`, `AssetType.stakeholderEmails` | Agencies and members; an invitation table; `scopeFilterFor(access)` in every read. |

**The system matches, humans approve.** Attribution is not a data-entry discipline imposed on the
social team [D10]: the system links publications to work items by URL, then caption, then
transcript, then image, and asks a human only when the match is ambiguous. Learning is the same
shape: deterministic statistics choose the pattern, the model only phrases it, the editor endorses
or disputes, the team lead activates [D37–D39]. Nothing acts on its own; every proposal cites the
publication ids it came from.

**The proof point — one record, end to end, real numbers (2026-09-10).** Airtable 📣 Social
`recJ9laDP1uWIXTHe`: *Pathway:: Manifesting – Stage Talk – Manifest Love*, `11: Released`, posted 9
Sep 23:01 UTC to IG + FB MV Manifesting, editor **Yuthika Peiris**, Creative ticket **#11057**
(asset type *Pathway Organic – Snippets*, 9×16, event *Social Media Promotion*, source asset a paid
Masterclass ad re-cut to organic), content pillar `💡 Educate`, speaker Jeffrey Allen. Postgres
`social_metrics`, found by URL `instagram.com/reel/DdFYhV8DXTk`
(`platform_post_id 17841400376176964_18092461193412440`), `ticket_airtable_id` NULL. Collaborators
`@mindvalley.manifesting` and `@iamjeffreyallen` both **Pending** at capture.

Day-1 vs the 21 @mindvalley reels published since 27 Aug (same account, same age):

| Metric | This reel | Peer median (n=21) | Position |
|---|---|---|---|
| Views | 3,725 | 9,735 | 19th of 21 |
| Reach | 2,835 | ~7,900 | bottom quartile |
| Engagement rate | 1.52% | 1.9% | below |
| Saves | 16 | 31 | below |
| Comments (the gated CTA's own KPI) | 9 | 20 | below |
| **Avg watch time** | **8s** | **5s** (n=15) | **top third** |

What the engine would propose from this one record, each with evidence and n:

1. *Distribution signal, not edit signal:* both collab invites were Pending at capture, so the reel
   reached only @mindvalley's audience. Owner: social team. Certain (it is in the payload).
2. *Edit signal, positive:* 8s avg watch vs 5s median — the re-cut kept viewers. Candidate DNA rule
   for *Pathway Organic Snippets*: "repurposed-ad re-cuts that strip the end-card/CTA slate retain
   above baseline". Shown as a *watch*, not a *rule*, until n ≥ 8 in both cohorts (n=15 with watch
   time today).
3. *Caption signal:* "Comment X" gated-CTA reels get ~40% fewer day-1 views (median 6.2k vs 10.9k,
   n=8 vs 13) — judge them on comments, where this one also under-indexed. Owner: caption owner.

That is the product: a readout Yuthika sees on her ticket at 24h and 7d, a proposal her team lead
can activate, and a distribution fix routed to the people who own distribution — with nothing
narrated that is not in the data.

## Users

All users sign in with Google. Internal users are `Employee` rows matched by email
(`assigneeName` snapshot on the ticket is the fallback) [D22]; agencies sign in with any Google
account **by invitation** [D19]. Every surface is fully responsive [D30] — phones are assumed for
the Slack-DM → ticket path and for Vishen.

**The org, as briefed by Rhythm on 2026-09-11 — ten personas, ten different jobs** [D56]. The
system is organised as a persona desk per person on top of shared loop screens [D57]; each desk
answers the question in the third column first. Each persona is served by their team's agent
(capability 10, E-I) [D70].

| Person | Role | Their question |
|---|---|---|
| **Vishen** | CEO | Message of the week (two brands); what went out day by day, with owners; how it did ("tell Marwa how that video did"); one number; what we learnt; what is planned next week. He is also the recurring blocker (unrecorded content) and the sign-off for shoots and clips. |
| **Gareth** | Owner of all content going out; leads Titus + team; Nadir reports to him | "What did we do last week, numbers, impact? What are we doing this week that learned from last week? Who's accountable for meditation / newsletter / quest / stage talk of the week? Blockers?" Wants tabular assets + performance = the learning engine, and AI to clip long-form and deliver a **first cut**. |
| **Marisha** | Head of marketing channels; the social team reports to her | Two separate MOWs (MV vs VL); roles → results (her "MIT" system replacing OKRs); an approval lane on clips (`Review - Marisha/Gareth`); gatekeeps budgets and access. |
| **Ramya** | Email (Braze) + all Vishen Lakhiani Media channels via agencies — YouTube = Talking Heads · LinkedIn = Two Comma PR · IG = Rise Voice. Contractor. | Her metric is **active users gained via the week's cadence**, not opens. Agencies already paste publish links; 256 VL assets are undated; the tests scoreboard lives with Rafi. |
| **Glen** (Glen Jason Chittur) | Mindvalley social channels (Hootsuite, 63 accounts; Composio); writes the weekly MOW report by hand | "If efficiency is a recommendation and that's not true it derails everything" — sections he owns and edits; campaign = Hootsuite tag × Metabase UTM; wants sentiment and an editor's "what I'll improve next upload" note; "no team, just two of us". |
| **Titus** | Video team lead; owns editing DNA per asset type | Receive requests, deliver, track the team's tickets and how they did, learn from assets. |
| **Chee** | Design requests lead (Type of Request = Design) | The same as Titus, for design; Thursday photo-collage owner; design has **0 asset types with DNA**; banners (975 rows) carry the only design metrics. |
| **Nadir** | Production: shoots, raw files, post-production tickets, podcast edits | Shoot pipeline, footage hand-off, podcast episodes → clips → first cut. |
| **Editors** (Yuthika Peiris, Jason Roper) | Make | As designed: My work, 24h/7d readouts, endorse/dispute; the concrete persona is Yuthika on #11057. |
| **Agencies** (Rise Voice, Talking Heads, Two Comma PR) | External | Own items only; paste publish links; raise requests and shoot requests. Rise Voice is the reference agency (the 66 published `VL IG: Risevoice` items with no Live Date) [D54]. |

Standing rules that shape every desk: one number is never shown without source, capture age and n
[D15]; nobody is ranked against anyone [D9, D60]; per-editor views are visible only to the editor,
their asset-type leads, admins and manager/approver roles [D50]; every desk has at most one gold
(attention) element and ≤ 6 blocks [D57]; agencies see the same rail pruned to Make · Publish ·
Measure with an "own items only" scope chip [D58].

Also in the system, decided elsewhere and not among D56's ten: **Vidura**, social manager alongside
Glen — a confirmer of proposed publication matches and co-owner of the Social agent [D44, D70];
**Rhythm**, admin — owns the platform, scheduler and sunset, sees "Connections & data health", is
the sole sign-off on the prototype [D23] and the sole builder of slice 1 [D104]; the **Team Lead /
Sub Lead of each asset type**, who activate DNA rules [D42].

[UNRESOLVED] Vidura's place in this list. He is a named confirmer of PROPOSE-tier matches [D44] and
half the Social agent's ownership [D70], which makes him a first-class user of two surfaces — but he
is not one of the ten personas of D56 and has no desk. Either the persona list is ten or it is
eleven; the plan has it both ways — owner: Rhythm (O14).

**Explicitly not target users.** Paid-ad buyers working in Clarisights (paid performance is not
in this loop; per-post revenue is out of v1 [D16]). HR (employees are HR-synced upstream, not
edited here). Finance (no cost, rate or budget data). The general public or anonymous viewers
(there is no public surface). Agencies without an invitation. Nobody gets a leaderboard, in any
role [D9, D50].

## Core Capabilities

### 1. The content graph and Publication

- Six nouns as in the Vision table; `Ticket` stays the work item and gains `lane`; `Shoot` stays a
  separate table; no polymorphic JSON [plan §4].
- **Publication** is the new noun: asset × channel × account × URL × published_at × goal × tags ×
  short code × `derivedFrom`. Backfilled from Airtable Social *Published Link*,
  `VishenVideo.publishedLink`, Perch `platform_post_id`, and the matcher; plus a **Log publish**
  action in the portal for the future [D10].
- **Ownership of a repurposed publication:** the last ticket that produced the delivered file
  (#11057) owns the publication and receives the readout; the source ticket is linked as *derived
  from*; learning attaches to the re-cut's asset type [D21].
- **Asset kinds per lane** [D53]: Email = the send (subject, body, hero, segment, CTA link;
  versions = drafts; publication = the send event). Podcast = the episode (master, transcript, show
  notes) with clips *derived from* it. Social = the post (final cut/image + caption + cover;
  one publication per channel/account). Shoot = a raw footage batch (folder link, shot list) used
  as a source asset.
- `SocialMetric` gains a `publicationId` FK; the mapper lifts the full Perch payload (views, saves,
  shares, watch time, post_type, collaborators) — a pure mapper fix [plan §1, §7.2].
- `TicketEvent` widens to log rank, assignee and prio changes, so a re-rank signal exists [§7.4].

### 2. Attribution tiers [D10, D43–D45, D21]

- Signals, in order: URL / `platform_post_id` → caption fingerprint (`lib/performance/attribution.ts`,
  exists) → transcript overlap (Social *Transcript* vs Perch caption/body) → image similarity
  (Social cover attachment vs Perch thumbnail) [D10].
- Tiers [D43]: **auto-link** on URL/`platform_post_id`; **auto-link** on caption overlap ≥ 80
  normalised characters; **PROPOSE (confirm needed)** on a transcript-only or image-only match;
  **UNMATCHED** otherwise. Confirmed = solid badge; proposed = dotted "likely — confirm".
  **Readouts go out only for confirmed links.**
- Confirmers: the ticket's editor OR the social manager, in a "Confirm publications" inbox and on
  the ticket's performance band; pending confirms are listed in the Monday digest [D44].
- Unticketed posts stay in cohorts as peers, appear in an "Unticketed" list with one-click *create
  ticket retroactively*; coverage % = ticketed ÷ all published, always visible [D45].
- Not a data-entry discipline on Vidura or Ramya [D10].

### 3. The learning engine — first loop: editor + asset-type DNA [D3–D6, D12, D32–D42]

- Units of learning in scope: the editor's edit · asset-type DNA · caption/CTA/distribution ·
  campaign/speaker/offer [D2]. The **first loop that must work end to end is editor + asset-type
  DNA** [D3]; the other two are the sequenced epics E-G and E-H.
- **North star depends on the publication's declared goal** [D4]: editors are judged on
  retention/watch time; captions on comments/saves; campaigns on leads/revenue; awareness on reach.
  Goal source now = Airtable Social *Content Pillar* mapped to a goal metric; later a portal Goal
  field on Publication [D5].
- **Goal map** (Gareth may revise, O1) [D36]: Educate → saves + watch · Inspire/Entertain → shares
  + reach · Convert / gated CTA → comments · Announce → reach · a caption containing `Comment "X"`
  overrides to Convert · unmapped pillar → "goal not set".
- **Readout windows: 24h and 7d**, always vs same-account / same-type peers at the same age;
  nothing is read before 24h [D6]. Snapshot tolerance: Day-1 = first capture 18–36h after
  `posted_at`; Day-7 = 6.5–7.5 days [D35].
- **Cohort** = same account × same post type × same age, last 90 days; asset type is an overlay
  ("and vs 6 other Pathway Organic Snippets"); speaker and campaign are filters, never the base
  cohort [D32].
- **Sample floor n ≥ 8** same-type posts in both cohorts; below that the UI shows "collecting
  (3/8)" [D12]. When the cohort is < 8 the readout still shows the asset's own numbers and falls
  back to same post type across all MV accounts, labelled "(fallback, cross-account)"; **proposals
  never use a fallback cohort** [D33].
- **Metric definitions** [D34]: Views = `post_views`; Reach = `reach`; ER = engagement ÷ reach
  (Perch `engagement_rate`); Value = saved + shares; Conversation = comments; Retention =
  `ig_reels_avg_watch_time` seconds now, % of duration once Publication carries `durationSec`
  (ffprobe on the render service, or typed); seconds compared only within the same post type.
- **Generation** [D37]: deterministic statistics choose the pattern — quartile split on the goal
  metric plus attribute contrast (asset type, hook style, CTA, source = repurposed, speaker, post
  type). Claude only phrases statement and rationale from a template with the numbers fixed
  (`claude-haiku-4-5` as `DISTILL_MODEL`). Numbers can never be invented.
- **Cadence** [D38]: weekly, Sunday night, per asset type, ≤ 3 new proposals, deduplicated against
  active and pending rules.
- **Rule shape** [D17]: `statement + rationale + evidence(refs, n, delta) + example + weight +
  confidence`, scoped to asset type — the `DnaReviewRule` shape. Every proposal cites publication
  ids.
- **Approval** [D8, D39, D42]: the Team Lead OR Sub Lead of the asset type activates (fix the
  mapping so both Airtable fields count); record who activated. Editors endorse or dispute;
  this is advisory — counts and dispute reasons are shown to the lead, who decides regardless. A
  dispute requires a reason and becomes a Tier-1 signal. No veto, no auto-activation.
- **Application** [D40]: active rules apply in DNA review at `Review` and in the brief draft at
  intake (rule + top-3 performers cited, editable). Not the clip prompt and not a My-work checklist
  in v1. (D40 is the decision; the plan's §4 thesis prose also names the clip prompt — D40 wins.)
- **Re-scoring** [D41]: rules are re-scored weekly; if evidence reverses (delta flips sign, n ≥ 8)
  the rule is flagged **"contested"** to the lead — never auto-deactivated.
- **People are never ranked** [D9]: per-editor views are visible to the editor, their asset-type
  leads, admins and any manager/approver role [D50]; managers otherwise see aggregates by asset
  type / channel / campaign. No leaderboard anywhere.
- **Failure behaviour, non-negotiable** [D15]: never show a number without source, capture age and
  n; always distinguish *edit signal* from *distribution signal*; a dead token shows "not captured",
  never stale-as-current.

### 4. Delivery surfaces [D7, D47–D50]

Built in this order [D7]: performance band inside the ticket → "My work" page → 24h Slack DM →
Monday team digest.

- **Ticket performance band:** Publication with live day-1/day-7 metrics vs cohort; edit vs
  distribution signals; proposed learning with endorse/dispute; confirm-publication control when a
  match is proposed [D43, D44].
- **"My work"** [D49]: last 90 days of confirmed publications; day-1 / day-7 columns; goal metric +
  retention; cohort position; proposals awaiting endorse/dispute; deliveries not yet published or
  matched; compare-two-of-my-edits side by side (v1). Visibility per D50.
- **24h Slack DM** [D47]: editor only, exactly 5 lines — title · goal metric vs cohort median (n) ·
  retention vs median · one edit-signal line · one distribution-signal line · link. No adjectives,
  no verdicts. Template mutable per asset type.
- **Monday digest** [D48]: extend the existing social-digest cron — per asset type top/bottom on
  the goal metric, count of new proposals, pending confirms, coverage %. No per-editor numbers.

### 5. Lanes, assets and statuses [D18, D51–D53]

- Lanes shipped as real queues: **Video · Social (posts + clips) · Email · Podcast · Shoots**.
  Banners excluded (E14 held pending Rafi) [D18].
- Email lane reads the 📧 Sends / 📧 Email tables (Content & Comms base); metrics "not connected"
  until Braze. Podcast lane = VL Podcast table + the `media_sources` inbox (episodes → clips);
  performance via YouTube public stats where a link exists [D51].
- **Shared prio/ticket status axes for the unified queue; lane-native status as a secondary chip**
  (Social `11: Released`, Shoot 4-state) until sunset. The 5-column mandate holds across lanes
  [D52].
- Asset kinds per lane as in capability 1 [D53].
- **The missing workflow pieces, now in scope** [D69]: a copy & captions stage on the Publication
  (*Copy draft (editor)* → *Polished (social)* → *Scheduled* → *Live*; editor writes the caption with
  the cut, social polishes) [D75]; scheduling with a channel owner and planned time, and **"went
  live" confirmed automatically by the matcher**, no human tick [D76]; **threads** — one timeline per
  work item and per version merging comments, approvals, status events and agent Signals, the
  decision log Vishen and Gareth asked for [D77]; the **podcast Episode tree** (parent work item,
  six child ticket types, publications on the children) [D79]; **sub-tasks** from a DNA-derived
  standard checklist plus a drafted split of free-text instructions, editor-confirmed [D80]. Detailed
  in E-D. Explicitly out: a localisation lane and a broadcasts/notifications lane [D69].

### 6. Agencies [D19, D54]

- Agencies see status + performance of their own items; submit requests and shoot requests; upload
  deliverables/versions and comment; sign in with any Google account by invitation. **Row scoping
  ships before SSO opens** [D19].
- Reference agency: Rise Voice — the 66 published `VL IG: Risevoice` items with no Live Date; their
  IG posts if Perch covers the VL account [D54].
- Uploads = paste a link as a version (no file hosting in v1). Comments = threaded on the work item
  and on each version, visible to the agency and the internal team on that item, optional timecode
  for video (new `Comment` model). The agency sees its own items with numbers; the cohort only as an
  anonymous account median [D54].

### 7. Unattended data flow [D11, D28, D46 + plan §4]

- App-owned pulls on a real scheduler, credentials in `external_credentials`: Perch today;
  YouTube Analytics, Metabase REST (allowlisted Q31846 / Q32044), Braze REST and Composio SDK later.
  Every surface labels absent data [plan §4, D15].
- Channels v1: IG (all MV accounts Perch covers) + FB (Perch, clicks only). v1.1: YouTube (needs
  YouTube Analytics channel OAuth — 0 rows today), TikTok, LinkedIn/VL — none may appear in a
  real-data prototype until integrated [D11].
- YouTube: public Data API stats (views/likes/comments) via the existing `YOUTUBE_API_KEY` now;
  CTR/AVD shown as "needs YouTube Analytics OAuth" until the follow-up [D28, D46].
- LinkedIn: in the prototype via the Composio connector if an account is connected, else "not
  connected" — never fabricated [D28]; in the product, manual 24h/7d entry with "entered by" shown
  [D46].
- Vishen's "one number" = the real week figure from Metabase (Q31846 leads / Q32044 revenue),
  applying the `scripts/mow-ingest-agent.md` guards (organic-social filter, distinct `order_id`,
  truncation check, name the brand) [D26].

### 8. Airtable sunset [D20]

Domain by domain as each app editor ships, no fixed date; Airtable is a read-only mirror
throughout, then archived. Order: reference nouns → calendar/MOW → tickets last. The two live
Airtable automations that create tickets must be rebuilt before ticket pulls stop [plan §1.7, §7.10].
Airtable structure changes (a Goal field, a short code) are allowed in the meantime [D16].

### 9. Coexistence [D55]

Same app, new information architecture behind a `/v2` prefix plus a feature flag; surfaces move
over one by one; old routes redirect when replaced. MOW and the comms calendar are untouched
through 14 Sep.

### 10. Team agents & the Signal bus [D70–D83]

**One agent per team, all on the same content graph** — Video (Titus) · Social (Glen + Vidura) ·
Email & VL channels (Ramya) · Production (Nadir) · Design (Chee) · Planning (Vishen / Gareth /
Marisha). No agent acts on another team's data directly [D70]. **Agents talk through the graph, not
to each other** [D71]: an agent writes a typed **Signal** on the item (subject node, kind, evidence
with refs · n · delta, confidence, suggested owner, proposed action); other agents subscribe by kind
and lane; every Signal is visible to humans in the item's thread [D77]. There are no hidden
agent-to-agent calls and no per-agent memory outside the graph — each agent reads and writes
Knowledge scoped to its lane plus the shared graph [D83].

**Autonomy at launch** [D72] = observe/compute/post Signals · draft (briefs, captions, report
sections, first cuts, learnings — always "drafted by system", never committed) · nudge (Slack DM /
digest when a Signal needs a decision) · **bookkeeping only**: auto-link publications at the auto
tiers, set Live Date from a pasted publish link, attach the first-day readout to the ticket. **The
trust ladder is fixed for six months: propose-only** on every content, rule or plan decision; the
bookkeeping actions are the sole exception (reversible, logged, no content judgement); the ladder
re-opens per agent × action type in March 2027 at ≥ 80% acceptance over 30 decisions with the lead's
flip [D73]. **Agent quality** = acceptance rate of proposals per action type per 30 days, plus cost
and latency per agent [D74].

**In production** [D82]: no LLM in observe — deterministic SQL/TS over the graph; Haiku phrases
drafts with numbers fixed [D37]; one scheduled runner per agent on the real scheduler (O6); Signals
persisted in a `Signal` table. **In the UI** [D78]: a "Your agent" block on every desk (signals ·
drafts awaiting you · nudges · acceptance · cost); no Agents registry screen and no Ask box in v1;
agent→agent hand-offs are visible inside item threads. The three hand-offs to prove on real data:
Social finding → Video brief change · Production "not filmed" → Planning blocker · Email cadence →
Social day alignment [D81]. Detailed in E-I.

## Boundaries

**Not in v1** [D16 and the decisions cited]:

- No auto-editing or automated re-cuts — that is E12, a separate epic in the superseded PRD.
- No per-post revenue or leads claims; Metabase stays at week/campaign level until a
  `utm_content`-per-post short code exists [D16, O2].
- No cross-account or cross-brand comparison for *learning*. Readouts may fall back to a labelled
  cross-account cohort when n < 8; proposals never do [D16 as refined by D33].
- No ranking of people, no leaderboards, no per-editor numbers in any digest [D9, D48, D50].
- No banner lane — E14 is held until the Rafi 1:1 [D18, O7].
- No YouTube CTR/AVD, TikTok or LinkedIn metrics until each is integrated; the prototype shows
  "needs YouTube Analytics OAuth" / "not connected" rather than a number [D11, D28, D46].
- No file hosting for agency uploads — a pasted link is the version [D54].
- No Airtable seats for agencies; agency access is app-side, by invitation, row-scoped [D19].
- No cross-account proposals; no proposal from a fallback cohort [D33].
- Active rules do not feed the clip prompt or a My-work checklist in v1 [D40].
- No auto-activation and no auto-deactivation of rules; contested rules are flagged, not removed
  [D39, D41].
- No readout before 24h; no readout on a merely *proposed* match [D6, D43].
- No number without source, capture age and n; no stale number shown as current [D15].
- No polymorphic JSON on the work item; `Shoot` is not folded into `Ticket` [plan §4].
- No new UI built on the current portal's IA — the current portal is a data source, not a UI to
  extend; v2 lives behind `/v2` [D55].
- MOW and the comms calendar are not touched through 14 Sep [D55].
- No agent commits content, rules or plans before March 2027; no agent-to-agent calls; no LLM in
  the observe step; no per-agent hidden state; no Ask box or Agents registry screen in v1 [D71–D73,
  D78, D82, D83].
- No localisation lane and no broadcasts/notifications lane [D69].
- No human "went live" tick and no scheduling *from* the portal in v2's first cut [D76].

**Schema, for as long as the live portal and v2 share a database** [D122]:

- **New tables and new *nullable* columns only.** No existing column is ever rewritten.
- One refinement, flagged for Rhythm's call and taken by the build: **a brand-new nullable column
  may be backfilled from that row's own `raw` payload** — nothing the live app reads changes. The
  alternative D122 records, if that is unwelcome, is to compute views and watch time from `raw` at
  read time: zero writes, slower queries.

**Tooling** [D126]: **do not use `/build-feature`.** It is hardwired to a pnpm turborepo — it writes
to `packages/database/prisma/schema.prisma`, `apps/api/src/domains/`, `apps/web/src/` and verifies
with `pnpm turbo build`. This repo is one Next.js app on npm with `prisma/` at the root. Build
against this repo's own conventions: `DESIGN_SYSTEM.md`, `CLAUDE.md`, and the `backend.ts` /
`data.*.ts` / `write.*.ts` dispatch pattern.

**Allowed despite the sunset:** Airtable structure changes needed by v2 (a Goal field on Social, a
short code field) [D16].

**The hard rule, and what changed it.** Through 2026-09-11 the rule was absolute: no production code
until Rhythm approves the real-data prototype [D13, D23, D27] — static HTML with real numbers
exported from Postgres + Airtable and baked in as JSON, no backend, re-export to refresh [D13]; real
names and real numbers, the Artifact private to the sign-off group, editors told first [D24]; ready
Fri 12 Sep with data through 11 Sep [D27]. On **2026-09-12 the ask changed** from "documents only"
to "build it and give me a link to test", and D104 and D121–D125 define the only form that build may
take: **one slice, on a branch, behind a preview URL, with `main` untouched** — see Delivery below.
The constraint the hard rule existed to protect is unchanged and now stated as D121: the team's
portal runs the Message of the Week on Monday 14 Sep and must not move. The full build sequence in
plan §7 remains recorded for honesty and is still not authorised.

## Delivery

How the first code actually ships. This section is about mechanics, not scope; what is in each slice
is in E-B [D127, D128].

**Who and what** [D104]. **Rhythm builds alone.** **Slice 1 = the scheduler + the Perch mapper fix +
`Publication` + the attribution backfill.** It deliberately puts the join *underneath* the portal
that already exists, so that every later surface has real data on the day it is built rather than an
empty table to demo against. D104 says "no new UI"; **D127 then adds the deterministic half of the
intelligence** — the `Signal` table, the seven Signal kinds, and every check that needs no model —
plus the two thin `/v2` surfaces that prove the join is real (`/v2/work-item/[id]` and
`/v2/connections`). D127 is the later decision and governs: the preview link shows **a real Signal on
a real ticket**, not only a coverage number.

**Where it runs** [D121–D125].

| | |
|---|---|
| Branch | **`v2/slice-1-publication`** with an open PR [D121] |
| Deploy | **`kessel preview`** only — it builds *that branch* as its own Cloud Run revision with its own URL [D121] |
| Production | **`main` is not touched.** It auto-deploys to the team's service; nothing about Monday changes [D121] |
| Never | **`kessel deploy`** — it targets production *and builds from local disk*, which caused an outage on 2026-08-31 [plan §6] |
| Routes | everything new lives under **`/v2/...`**, so merging to `main` later is inert for the team: the routes exist, nothing links to them, the allowlist still gates them [D124] |
| Access | every `/v2/*` route gated by **`isV2Allowlisted(email)`** — the same shape as `lib/studio/access.ts`: code default plus a `V2_ALLOWLIST_EMAILS` env override [D123] |
| Env | no new required env var except `V2_ALLOWLIST_EMAILS`, which is inert for production because `main` has no `/v2` route [plan §6] |
| Database | the same Kessel project, so almost certainly the same database as production — **verified before any migration**, which is exactly why the write rule is additive-only [D122, plan §9] |

**One manual step, expected and not a bug** [D125]. `trustHost: true` means the app copes with a new
hostname; **Google OAuth does not** — it matches redirect URIs exactly, and the preview host is new.
The agreed flow: deploy first, hand Rhythm the exact line
`https://<preview-host>/api/auth/callback/google`, and Rhythm or IT adds it to the OAuth client's
authorised redirect URIs. Until then sign-in fails with `redirect_uri_mismatch` — expected. The same
URI then works for every later push to the branch. This project hit the identical thing when the app
moved region.

**Refreshing and ending it** [plan §6]. Push to the branch and run `kessel preview` again — same URL,
new build. To finish: merge the PR and `/v2` lands on the team's URL, still allowlisted and unlinked;
or close it, and the additive migrations drop cleanly.

**Cutover, surface by surface** [D116]. The v2 route goes live behind the flag; the v1 route
redirects **the week after each of that surface's owners has used v2 for a full cycle** — for MOW,
after **Gareth, Glen and Ramya have each committed once from v2**. Both routes read the same tables
throughout, so there is no data fork and no migration moment. Cutover is therefore a consequence of
use, not a date.

**The PRD runs in parallel** [D129]. The nine epics predate D101–D128; a subagent transcribes the
decisions into the right epics **while the build runs**. That is writing, not deciding: `/prd`'s
discovery conversation is not re-run, only its conventions are — template sections, `[UNRESOLVED]`
markers, resolution counts, and `prd/index.md`. The O-table below belongs to Gareth, Glen, Moniek,
Nadir, Rafi and InfoSec, not to this build.

## Success Criteria

Each criterion is phrased so a query or a test can verify it.

**Product outcomes at 60 days from first production release** [D14]:

1. **Attribution coverage ≥ 80%.** Of Social posts reaching `Released` in the window, ≥ 80% have a
   *confirmed* Publication linked to a ticket within 24h of `posted_at`. Baseline today: ~0%
   (`ticket_airtable_id` set on 0/1,642 rows). Measured by the coverage % that is always on screen
   [D45].
2. **≥ 10 DNA rules activated from numeric proposals**, with ≤ 30% of proposals rejected by leads.
   Measured from the Knowledge store: count of rules with `source = numeric proposal` and an
   activation record [D42], over count proposed.

**Behavioural invariants (must hold on every surface, testable by inspection or snapshot tests)**
[D15]:

3. Every displayed number carries source, capture age and n. A number with any of the three missing
   is a bug.
4. Every insight line distinguishes *edit signal* from *distribution signal*; no line mixes them.
5. A source with a dead or missing token renders "not captured" — never the last good value as if
   current.
6. No readout is produced before 24h after `posted_at`, and none for a Publication whose link is
   only *proposed* [D6, D43].
7. No proposal is generated from a cohort with n < 8 in either quartile, or from a fallback
   (cross-account) cohort [D12, D33].
8. No per-editor number appears in the Monday digest; per-editor views are readable only by the
   editor, their asset-type leads, admins and manager/approver roles [D48, D50].
9. Agency reads return only rows the agency owns; a cross-tenant read attempt returns nothing
   [D19, D54].

**Design bar — checkable on every screen** [D31, D30]:

10. Every insight is readable in one line in the order *number · vs what · n · so-what · owner*.
11. Progressive disclosure headline → evidence → raw table on every insight.
12. One signal language: edit = purple, distribution = neutral, data-quality = gold, at most one
    gold element per screen.
13. Skeleton states, hover states, keyboard navigation and dark-mode parity on every screen; fully
    responsive everywhere, reflowing to ~390px with no horizontal body scroll.

**Prototype acceptance (the gate before any code)** [plan §9, D13, D27, D24]:

14. Every hash route is reachable from the nav and from in-page links.
15. Light and dark both render; ≤ 1 gold element per screen; 390px with no horizontal scroll.
16. Every number carries source + capture age + n.
17. The worked example (#11057 / reel `DdFYhV8DXTk` / Yuthika) is traceable on the Work-item,
    Repository, Performance and Insights screens with the exact numbers in the Vision table (views
    3,725; reach 2,835; ER 1.52%; saves 16; shares 4; comments 9; avg watch 8s; total watch
    25,379s; both collaborators Pending).
18. The inline JSON block regenerates from the export queries without hand edits.
19. Vishen's one number is a real Metabase week figure, labelled by brand and source [D26].
20. Rhythm approves — this is the only event that unlocks production code [D23].

## Open Questions

Carried from the discovery record with owners. Listed explicitly so none lurks unstated.

| # | Question | Owner | Blocks |
|---|---|---|---|
| O1 | Goal-metric map (D36) confirmation — Educate → saves + watch, Inspire/Entertain → shares + reach, Convert/gated CTA → comments, Announce → reach. | Gareth | The goal metric used in every readout and proposal (E-B). Until confirmed, D36 is applied as written. |
| O2 | Short-code convention if/when introduced (`MV-11057`?) and where it must appear (`utm_content`, Hootsuite tag, filename). | Rhythm (with Gareth/Glen) | Per-post revenue/leads (E-H); the strongest attribution signal after URL (E-A). |
| O3 | Image-similarity method and threshold for the PROPOSE tier (perceptual hash vs embedding). | Engineering spike | The fourth attribution signal (E-A). The first three signals ship without it. |
| O4 | Event-tier ranking (open since June) — needed before queue scoring can learn. | Moniek | Capability #3 learning; not the first loop. |
| O5 | App-side credentials for Metabase / Braze / Composio — who owns the keys (Glen?). | Glen (to confirm) | Unattended Metabase week figure, email metrics, Composio coverage (E-C, E-H). |
| O6 | Scheduler choice — Kessel cron vs an external scheduler — to replace GitHub Actions (slipping 3–11h). | Rhythm | Everything time-windowed: day-1 capture in 18–36h [D35], the Sunday proposal run [D38], the 24h DM [D47] (E-C). |
| O7 | Banner lane taxonomy (E14). | Rhythm, after the Rafi 1:1 | Adding the sixth lane (E-D). |
| O8 | Agency invitation model with InfoSec — PAT sharing is blocked for Rise Voice's base. | Rhythm with InfoSec | Opening SSO to invited Google accounts (E-E). Row scoping proceeds regardless. |
| O9 | YouTube Analytics channel OAuth timing — who authorises the channel(s), and when. 0 rows today; CTR/AVD show "needs YouTube Analytics OAuth" until done [D28, D46]. | Rhythm (channel owners TBC) | YouTube retention metrics for VL and podcast lanes (E-C, v1.1). |
| O10 | Braze connector authorisation — app-side REST access to send/open/click data for the email lane. Email metrics show "not connected" until then [D51]. | Glen / Rhythm | Email-lane performance (E-C, E-D). |
| O11 | Signal `kind` taxonomy — the closed list agents subscribe on — and the retention period of Signal rows (decision log forever vs archive after N days) [D71, D82]. | TBC (Rhythm) | Subscriptions and the thread as decision log (E-I). |
| O12 | Agent cost budgets — a token/latency ceiling per agent per month and who is paged when exceeded; D74 makes cost visible but sets no budget [D74]. | TBC | Running six scheduled runners in production (E-I, E-C). |
| O13 | Whether a PROPOSE-tier (transcript- or image-only) matcher sighting flips a Publication *Scheduled → Live*, or *Live* waits for the human confirm [D43 vs D76]. | Rhythm with Glen | Went-live automation (E-D) and readout timing (E-B). |
| O14 | Which agent the "Your agent" block represents on an agency desk — D78 puts the block on every desk, D70 defines no agency agent. | Rhythm | Agency desks in the prototype and E-E. |

Two internal tensions in the source plan were resolved in favour of the later, more specific
decision and are recorded here so nobody re-opens them by accident: D40 (rules do not feed the
clip prompt in v1) over the §4 thesis prose; D50 (My-work visibility includes admins and
manager/approver roles) over D9's "editor + lead"; D33's labelled cross-account fallback for
readouts as the refinement of D16's "no cross-account comparison"; D35's 18–36h Day-1 capture
window as the operational reading of D6's "nothing read before 24h" (the *readout* waits for 24h;
the *capture* may land from 18h).

From the 2026-09-11 pass, recorded the same way: the Signal record is the **union** of D71's fields
(confidence, suggested owner, proposed action) and D82's (from/to agents, status, thread_id) — both
are decisions, neither is a subset; D73's ladder re-opens on 30 *decisions* while D74 measures
acceptance over 30 *days* — the PRD uses each where its decision applies; the plan's hand-off 1
figures (−27% views, +52% comments, n=24) and its §2 proof-point figures (~40% fewer views, n=8 vs
13) describe the same gated-CTA contrast on different cohort cuts and must be regenerated from the
export, never hand-reconciled; hand-off 2 counts 15 shoots *To Film* past their date where D67
counts 13 *To Film* in total — the same rule applies.

## Epics

Nine epics. Dependency order: **E-C and E-A first** (the scheduler and Publication unblock
everything), **then E-B**, **then E-D and E-I** (E-I needs Publication, Knowledge and the scheduler,
and lands its Signals in E-D's threads and desks), **then E-E, E-G and E-H** in parallel, with **E-F
running domain by domain throughout**. Nothing starts until the prototype is approved [D23].

| # | Epic | Purpose (one sentence) | Depends on |
|---|---|---|---|
| E-A | [Content graph & Publication](content-studio-v2/content-graph-and-publication.md) | Introduce the `Publication` noun, reshape `Asset`, widen `TicketEvent`, and ship the four-signal attribution matcher with confirm/unticketed inboxes so every published thing links to the work item that made it. | E-C (scheduler for the matcher and capture windows) |
| E-B | [Continuous learning engine — first loop: editor + asset-type DNA](content-studio-v2/continuous-learning-engine.md) | Turn confirmed publications into 24h/7d readouts vs cohort, weekly deterministic proposals (≤ 3 per asset type, n ≥ 8), editor endorse/dispute, lead activation, and rule application in DNA review and the brief draft. | E-A, E-C, O1 |
| E-C | [Unattended data flow & scheduler](content-studio-v2/unattended-data-flow-and-scheduler.md) | Replace GitHub Actions with a real scheduler, lift the full Perch payload, hold credentials app-side, and bring YouTube public stats, Metabase, Braze and Composio in as scheduled pulls with honest "not connected" states. | O5, O6 |
| E-D | [Lanes & the v2 IA](content-studio-v2/lanes-and-v2-ia.md) | Ship the Plan → Make → Publish → Measure → Learn information architecture behind `/v2` with five lanes as real queues, persona desks, the 5-column mandate across lanes, and the missing workflow pieces — copy stage, scheduling & went-live, threads, the podcast Episode tree, sub-tasks [D69, D75–D80]. | E-A (`Ticket.lane`, matcher for *Live*), E-B (the Learn and Measure screens) |
| E-E | [Agencies & access](content-studio-v2/agencies-and-access.md) | Row-scoped workspaces for invited agencies (Rise Voice first) to request, deliver by link, comment, and see their own numbers, then open SSO by invitation. | E-A (Party/workspace, `Comment`), E-D, O8 |
| E-F | [Airtable sunset](content-studio-v2/airtable-sunset.md) | Retire Airtable as the editing surface domain by domain — reference nouns, then calendar/MOW, then tickets — leaving it a read-only mirror and then an archive. | E-D (app-side editors), rebuild of the two ticket-creating automations; runs throughout |
| E-G | [Caption / distribution loop](content-studio-v2/caption-distribution-loop.md) | Run the learning engine's second unit — caption, CTA and distribution signals (collab status, posting time, gated CTA) — owned by the social/caption team rather than the editor. | E-B |
| E-H | [Campaign / offer loop](content-studio-v2/campaign-offer-loop.md) | Run the learning engine's third unit — campaign, speaker and offer against leads/revenue — first at week/campaign level via Metabase, per post only once a short code exists. | E-B, E-C (Metabase app-side), O2, O5 |
| E-I | [Team agents & the Signal bus](content-studio-v2/team-agents-and-signal-bus.md) | One propose-only agent per team (Video · Social · Email & VL · Production · Design · Planning) that observes its slice of the graph deterministically, writes typed Signals other agents subscribe to and humans see in item threads, drafts but never commits, and is measured by acceptance rate, cost and latency [D70–D83]. | E-A (Publication, matcher), E-B (Knowledge store), E-C / O6 (one runner per agent), alongside E-D (threads, desks) |

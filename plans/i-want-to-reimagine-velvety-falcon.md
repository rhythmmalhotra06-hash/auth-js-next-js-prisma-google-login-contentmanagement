# Content Studio v2 — the pivot: review, discovery record, and real-data prototype

**Status:** rev 3 prototype published 11 Sep (link below). **Now building: §6 slice 1 on a `kessel preview` link, `main` untouched.** §5c–§5d hold the agent contracts and the twenty decisions that remove developer guesswork. → https://claude.ai/code/artifact/13a64b57-f2fb-4710-8f3f-0393252ed079 (awaiting Rhythm's approval). PRD written: `prd/content-studio-v2.md` + 8 epics. **Hard rule (Rhythm, 10 Sep 2026): nothing is written in production code until a
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

### Second pass (rounds A–I, same day) — DECIDED

**Prototype**
| # | Decision |
|---|---|
| D24 | **Real names and real numbers**; the Artifact stays private, shared only with the sign-off group; editors told first. |
| D25 | Brands: @mindvalley main IG + all other MV IG accounts Perch covers + FB MV accounts + **Vishen/VL** (Airtable-only; renders mostly as honest empty states — `24h Data` empty on every row). |
| D26 | Vishen's "one number" = **real week figure pulled from Metabase** (Q31846 leads / Q32044 revenue) at export via the connector, applying `scripts/mow-ingest-agent.md` guards (organic-social filter, distinct `order_id`, truncation check, name the brand). Figures only, no prose. |
| D27 | **Deadline: prototype ready Fri 12 Sep**, before the MOW go-live; export uses data through 11 Sep. |
| D28 | YouTube in prototype: **public Data API stats (views/likes/comments) via existing `YOUTUBE_API_KEY`** for VL videos with a YouTube Published Link; CTR/AVD shown as "needs YouTube Analytics OAuth". LinkedIn in prototype: **via Composio connector if a LinkedIn account is connected, else "not connected"** — never fabricated. |
| D29 | Audit screen ("State of the portal") = **appendix reachable from the footer**, not in the main flow. |
| D30 | **Fully responsive everywhere** (not just editor surfaces). |
| D31 | Design bar (checkable): every insight readable in one line — *number · vs what · n · so-what · owner*; progressive disclosure headline → evidence → raw table; one signal language — **edit = purple, distribution = neutral, data-quality = gold (max one per screen)**; skeletons, hover, keyboard nav, dark-mode parity. Build with `artifact-design` + `dataviz` + `artifact-diagramming`. |

**Cohorts, metrics, goals**
| # | Decision |
|---|---|
| D32 | Cohort = **same account × same post type × same age, last 90 days**; asset type is an overlay ("and vs 6 other Pathway Organic Snippets"); speaker/campaign are filters, never the base cohort. |
| D33 | Cohort < 8: readout still shows the asset's numbers and **falls back to same post type across all MV accounts, labelled "(fallback, cross-account)"**. **Proposals never use a fallback cohort** — n≥8 within one account. Boundary D16 is thereby brand-level for readouts, account-level for learning. |
| D34 | Definitions: Views = `post_views`; Reach = `reach`; ER = `engagement ÷ reach` (Perch `engagement_rate`); **Value = saved + shares; Conversation = comments**; **Retention = `ig_reels_avg_watch_time` seconds now, % of duration once Publication carries `durationSec`** (ffprobe on render service, or typed); compare seconds only within the same post type. |
| D35 | Snapshot tolerance: **Day-1 = first capture 18–36h after `posted_at`; Day-7 = 6.5–7.5 days**. |
| D36 | Goal map (Gareth may revise): Educate → saves + watch · Inspire/Entertain → shares + reach · Convert/gated CTA → comments · Announce → reach · caption containing `Comment "X"` overrides to Convert · unmapped pillar → "goal not set". |

**Generation, approval, application**
| # | Decision |
|---|---|
| D37 | **Deterministic stats choose the pattern** (quartile split on goal metric + attribute contrast: asset type, hook style, CTA, source=repurposed, speaker, post type); **Claude only phrases** statement/rationale from a template with numbers fixed (`claude-haiku-4-5`, as `DISTILL_MODEL`). Numbers can never be invented — honours Glen's "the AI never narrates a number". |
| D38 | Cadence: **weekly, Sunday night, per asset type, ≤3 new proposals**, deduped against active + pending. |
| D39 | Endorse/dispute is **advisory**: counts + dispute reasons shown to the lead, who decides regardless; a dispute requires a reason (becomes a Tier-1 signal). No veto, no auto-activation. |
| D40 | Active rules apply in **DNA review at `Review`** and in the **brief draft at intake** (rule + top-3 performers cited, editable). Not the clip prompt, not a My-work checklist (v1). |
| D41 | Rules are **re-scored weekly**; if evidence reverses (delta flips sign, n≥8) the rule is flagged **"contested"** to the lead — never auto-deactivated. |
| D42 | Approver = **Team Lead OR Sub Lead** of the asset type (fix the mapping to include both Airtable fields); record who activated. |

**Attribution**
| # | Decision |
|---|---|
| D43 | Tiers: **auto-link** on URL/`platform_post_id`; **auto-link** on caption overlap ≥80 normalized chars; **PROPOSE (confirm needed)** on transcript- or image-only match; **UNMATCHED** otherwise. Confirmed = solid badge; proposed = dotted "likely — confirm"; **readouts go out only for confirmed links**. |
| D44 | Confirmers: **the ticket's editor OR the social manager**, in a small "Confirm publications" inbox and on the ticket band; pending confirms listed in the Monday digest. |
| D45 | **Unticketed** posts stay in cohorts as peers and appear in an "Unticketed" list with one-click *create ticket retroactively*; coverage % = ticketed ÷ all published, always visible. |
| D46 | YouTube product-side: **public Data API now, Analytics OAuth follow-up**; LinkedIn product-side: **manual 24h/7d entry with "entered by"** shown. |

**Delivery surfaces**
| # | Decision |
|---|---|
| D47 | 24h Slack DM: **editor only**, 5 lines — title · goal metric vs cohort median (n) · retention vs median · one edit-signal line · one distribution-signal line · link. **No adjectives, no verdicts.** Mutable per asset type. |
| D48 | Monday digest: **extend the existing social-digest cron** — per asset type top/bottom on goal metric, new proposals count, pending confirms, coverage %. **No per-editor numbers in the digest.** |
| D49 | "My work": last 90 days of confirmed publications, day-1/day-7 columns, goal metric + retention, cohort position, proposals awaiting endorse/dispute, **deliveries not yet published/matched**, and **compare-two-of-my-edits side by side (v1)**. |
| D50 | "My work" visibility: **the editor, their asset-type leads, admins, and any manager/approver role**. Still no leaderboard anywhere. |

**Lanes, assets, statuses**
| # | Decision |
|---|---|
| D51 | Email lane = **📧 Sends / 📧 Email tables** (Content & Comms base, read at export; metrics "not connected" until Braze). Podcast lane = **VL Podcast table + `media_sources` inbox** (episodes → clips; performance via YouTube public stats where a link exists). |
| D52 | **Shared prio/ticket status axes for the unified queue; lane-native status as a secondary chip** (Social `11: Released`, Shoot 4-state) until sunset. 5-column mandate holds across lanes. |
| D53 | Asset kinds: Email = the send (subject, body, hero, segment, CTA link; versions = drafts; publication = send event) · Podcast = the episode (master, transcript, show notes) with clips *derived from* · Social = the post (final cut/image + caption + cover; publication per channel/account) · Shoot = raw footage batch (folder link, shot list) as a source asset. |

**Agencies**
| # | Decision |
|---|---|
| D54 | Reference agency = **Rise Voice** — the 66 published `VL IG: Risevoice` items with no Live Date; their IG posts if Perch covers the VL account. Uploads = **paste a link as a version** (no file hosting in v1). Comments = **threaded on the work item and on each version**, visible to agency + internal team on that item, optional timecode for video (new `Comment` model). Agency sees **own items with numbers; cohort only as an anonymous account median**. |

**Coexistence**
| # | Decision |
|---|---|
| D55 | **Same app, new IA behind a `/v2` prefix + feature flag**; surfaces move over one by one; old routes redirect when replaced. MOW/comms calendar untouched through 14 Sep. |

### Still open (carry into the PRD's Open Questions with owners)
- O1 Goal-metric map (D36) confirmation — Gareth.
- O2 Short-code convention if/when introduced (`MV-11057`?) and where it must appear (utm_content, Hootsuite tag, filename).
- O3 Image-similarity method/threshold for the PROPOSE tier (perceptual hash vs embedding) — engineering spike.
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

## 5. The prototype — REV 2: persona desks (11 Sep, after Rhythm's org brief)

Rev 1 (published 11 Sep, https://claude.ai/code/artifact/13a64b57-f2fb-4710-8f3f-0393252ed079)
was organised by loop stage with a 3-way role toggle. Rhythm's org brief showed the gap: the
system serves **ten different jobs**, and the transcripts (`Sep Calls/*.docx`) show each person
arrives with a different question. **Rev 2 keeps every rev-1 screen as a shared screen and puts a
persona desk on top of them.** Same file, same URL (redeploy), same real data + a few more exports.

### The org, as briefed (D56)
| Person | Role | Their question |
|---|---|---|
| **Vishen** | CEO | Message of the week (two brands), what went out day by day with owners, how it did ("tell Marwa how that video did"), one number, what we learnt, what's planned next week. He is also the recurring blocker (unrecorded content) and the sign-off for shoots/clips. |
| **Gareth** | Owner of all content going out; leads Titus + team; Nadir reports to him | "What did we do last week, numbers, impact? What are we doing this week that learned from last week? Who's accountable for meditation / newsletter / quest / stage talk of the week? Blockers?" Wants tabular assets + performance = learning engine, and AI to clip long-form and deliver a **first cut**. |
| **Marisha** | Head of marketing channels; social team reports to her | Two separate MOWs (MV vs VL); roles → results (her "MIT" system replacing OKRs); approval lane on clips (`Review - Marisha/Gareth`); gatekeeps budgets/access. |
| **Ramya** | Email (Braze) + all Vishen Lakhiani Media channels via agencies: YouTube = Talking Heads · LinkedIn = Two Comma PR · IG = Rise Voice (formerly Kash/Simplex). Contractor. | Her metric = **active users gained via the week's cadence**, not opens. Agencies already paste publish links; 256 VL assets undated; tests scoreboard lives with Rafi. |
| **Glen** (Glen Jason Chittur — one person) | Mindvalley social channels (Hootsuite 63 accounts, Composio), writes the weekly MOW report by hand | "If efficiency is a recommendation and that's not true it derails everything" → sections he owns and edits; campaign = Hootsuite tag × Metabase UTM; wants sentiment and an editor "what I'll improve next upload" note; "no team, just two of us". |
| **Titus** | Video team lead; owns editing DNA per asset type | Receive requests, deliver, track the team's tickets and how they did, learn from assets. |
| **Chee** | Design requests lead (Type of Request = Design) | Same as Titus for design; Thursday photo-collage owner; design has **0 asset types with DNA**; banners (975 rows) carry the only design metrics. |
| **Nadir** | Production: shoots, raw files, post-production tickets, podcast edits | Shoot pipeline, footage hand-off, podcast episodes → clips → first cut. |
| **Editors** (Yuthika, Jason Roper) | Make | As designed (My work, readouts, endorse/dispute). |
| **Agencies** (Rise Voice, Talking Heads, Two Comma PR) | External | Own items only; paste publish links; raise requests. |

### Decisions taken 11 Sep (D57–D66)
| # | Decision |
|---|---|
| D57 | **Spine = persona desks first, loop screens shared underneath.** A "Viewing as" switcher (10 personas) in the top bar; persona is carried in the hash (`#/desk/gareth`) so walkthrough links are shareable. Each desk ≤ 6 blocks, blocker-first, one gold element. |
| D58 | **Same shared rail for everyone**; agencies see it pruned (Make · Publish · Measure) with a scope chip "own items only"; every desk block deep-links into a shared screen with the persona's filters shown as removable chips. |
| D59 | **Marisha gets her own desk** (two MOWs, review lane, roles → results, channel health by account, agencies, access requests). |
| D60 | **Roles → results** = rows are the weekly slots/roles (MOW owner, newsletter, meditation, quest, stage talk, MV social, VL YT/LI/IG) with owner + this week's goal metric where data exists; undefined results are Marisha-owned empties; **never sortable across people** (D9 holds). |
| D61 | **First cut (Gareth)**: the full propose-only flow on a real podcast clip, marked *mock render*. Anchor = **Jim Kwik podcast** (media source with clips suggested; "Jim Kwik Podcast Reel" tickets carry DNA reviews; Vishen's 8 Sep MOW). "Generate first cut" lives on the work item (video lane, derived from a media source) and per clip in Nadir's podcast inbox; draft shows EDL shape from `lib/auto-editing/schema.ts` (reframe mode, captions, audio), DNA applied (asset-type DNA + clip rules), provenance (dnaVersion, repaired[]); actions **Accept → Final Pass** (real status) · **Reject** with the real taxonomy (reframe / caption_position / caption_timing / audio_grade; `moment_selection` routes to the clip engine, not the agent) · **Retry with feedback**; raw-file download always visible; acceptance rate shown as "collecting — history not persisted". No video is rendered. |
| D62 | **Ramya's desk**: VL channel board (YouTube · LinkedIn · IG with real numbers where they exist) · email cadence this week linked to campaign + MOW, with "Opens/CTR — Braze not connected" and "Active users gained this week — needs a Metabase question · Rafi/Ramya" · her two data chores with counts (256 undated, 1 publish link on 107 released). The Content-vs-Shoot-requests tab split was **not** selected — agencies remain one board with per-agency chips. |
| D63 | **Titus's desk**: team board (per editor, 5 mandated columns, no ranking) · incoming requests to triage with the gold Assign pill · **one combined block per asset type: DNA text + numeric proposals + aggregate readout of the team's delivered work** · first cuts awaiting review. |
| D64 | **Chee's desk**: design queue (Type = Design, 5 columns + designer) · owned empty "Design asset types have no DNA yet — Chee + Vanessa/Haley/Ziga" with first proposed types · Thursday photo-collage slot from the calendar. Banners block **not** selected. |
| D65 | **Nadir's desk**: shoot pipeline (Needs Vishen's review → Approved → To Film → Filmed; KPI cards click-filter) · raw files per shoot as a version stack (link · who · when — labelled "today a single URL field") + post-production ticket trigger · podcast inbox New → Transcribing → Clips suggested → tickets → first cut · blocker block "Vishen has not recorded X" (planned slots with no footage). |
| D66 | **Glen's desk**: his weekly report as editable sections he owns ("drafted by system" → "edited by Glen", numbers locked as tokens the AI never narrates) · campaign table = Hootsuite tag × Metabase utm_source · data chores with counts (102 unticketed, 2 to confirm, publish links missing, 63 vs ~10 accounts covered) · sentiment + editors' "what I'll improve" as honest empties · **the v1 propose-only Social board**: add an idea → approve → raise ticket / shoot request, marked "syncs to 📣 Social". |
| D68 | **Vishen's desk** = the six blocks in §5 "The desks" — built from `VishenCard`, `MediaOverview`, `PipelineFunnel`, `/studio/timeline` and the Monday pack; five numbers + five sentences first, everything else one click down; the only gold is "Waiting on you". |
| D67 | **Vishen's "next week"** = real comms calendar 14–20 Sep (summit LIVE days, 6 emails, 1 LinkedIn post) + next MOW "Be Extraordinary" from the master table, thin days as owned empties. |

### The desks (≤ 6 blocks each; every number carries source · age · n)
**Vishen — the desk, drawn from what we already built for him and what he said (D68)**
Sources: `components/mow/VishenCard.tsx`, `components/studio/media/MediaOverview.tsx`, `PipelineFunnel`, `/studio/timeline`, the Monday pack (`BrandCard`, `DayTable`, `Learnings`, `CommitBar`), `Context/VishenStudio/STUDIO_VISHEN_VIEW.md`, and his relayed words: *"what is the one number… what are the insights and learnings"*, *"Monday, Tuesday… there is an owner for every particular thing and the owner should know how it is performing"*, *"tell me how Marwa's asset did"*, *"too many numbers, I'm not clear what this means"*, CTR vs a fixed 7%, Masterclass 20 days = *"the biggest issue in the company"*. Governing rule (§6 of the umbrella plan): **five numbers and five sentences on the first screen; everything else one click down.**
1. **Waiting on you** — the only gold. Four sources merged into one list: shoots at *New Requests – Needs Vishen's Review* (6), proposed clips collapsed to one row, `VishenVideo.approval = To Review`, tickets at *To be reviewed by Vishen* (2). Rows: kind chip (Shoot sign-off · Clip approval · Video approval · Priority call) · title · amber date pill · `Approve` / `Send back`. Caption *"nothing moves past these until you look"*; empty *"Nothing is waiting on you right now."*; footer *"Set the order instead →"* (ranking).
2. **This week, in two sentences** — two brand cards, deliberately different shapes (VL teal / MV purple): the message, then **The number** with target + provenance (MV: leads 1,125 of 25,000 · Metabase · brand MV; VL: *"No message committed — Ramya"*, *"No target set — Ramya"*; never a zero bar). Sub-caption when no campaign is live: *"the headline falls back to leads."* Footer *"See the whole week →"* (the Monday pack).
3. **Day by day — and how it did** — seven rows Mon→Sun: planned · went live · owner · status (planned / shipped / off plan / missed / blocked — five states, `blocked ≠ missed`) · platforms · day-1 read where attributed. Click a day → the platform read with **CTR vs the fixed 7%** where YouTube exists, *"not reported by this platform"* never 0. Each asset row → its readout: **this is the "tell Marwa how that video did" link.** Caption: *"Planned and went-live count different populations — two facts side by side, not a completion rate."* Beneath: a 4-tile strip — reach/views · engagement · published (live link) · **top performer, named**.
4. **What we learnt** — committed learnings (by Gareth/Glen/Ramya) above staged ones; system drafts wear *"Proposed by the system"*; lever → owner (retention → editor, thumbnail CTR → packaging, destination CTR → message owner). Empty: *"Nothing recorded yet. A learning is what changes next week — the lever and who owns it."*
5. **Next week** — 14–20 Sep from the comms calendar (summit LIVE days, 6 emails, 1 LinkedIn post), next messages from the master table (*Be Extraordinary*, *VL: Podcast – Naveen Jain*), shoots *To Film* (13); thin days as owned empties; **"Not yet recorded"** — planned slots with no footage, since that is his own recurring blocker.
6. **The engine, and who is making it** — one strip: In production · Awaiting sign-off · Ready to publish (click → grid) + *Avg. Requested → Published* + *Most stuck* (*"See where time is going →"*); beneath, the agency scoreboard (Rise Voice · Talking Heads · Two Comma PR · Internal: in flight · editing · live 30d · avg ★). Close with the trust footnote verbatim: **"Nothing changes without you.** Approvals, ratings and clip sign-offs you make here write straight back to Airtable. The team advances everything else — this is your window onto their work, not a second system to maintain."
Dropped from his desk (kept one click down): the five MediaHub tabs, the KPI row except *Awaiting you*, the clips wall, the review grid, ranking, board, calendar.
**Gareth** — his agenda verbatim: Last week numbers & impact · This week, learned from last week (honest empty: no plan item cites a learning yet) · Accountable this week (meditation / newsletter / quest / stage talk — owner + status; two Gareth-owned empties) · Blockers · First cut (D61; 23 sources "Clips Suggested") · Learning-engine health (rules, reviews, proposals, coverage %).
**Marisha** — D59/D60.
**Ramya** — D62 + leads by agency (2CPR 116 / 11 orders; TH; Simplex) + Rafi's test scoreboard as "not in any connected source".
**Glen** — D66.
**Titus** — D63 (+ team capacity totals, no per-person bars).
**Chee** — D64 (+ design deliveries → performance from Perch image posts where any).
**Nadir** — D65 (+ incoming shoot requests with agency marker).
**Yuthika** — existing My work + a "what I'll improve next upload" note (mock write, feeds Glen's block).
**Rise Voice** — own items only: 66 published-undated with "paste publish link / set live date"; my requests; raise a shoot request; my numbers "VL IG account not covered by Perch"; threaded comments per version. Also Talking Heads / Two Comma PR reachable via chips.

### v1 patterns carried forward (from `components/*`, verified)
VishenCard "Waiting on you" blocker-first block · BrandCard two brands deliberately different shapes · DayTable day rows + per-platform reads ("not reported by this platform", never 0) · Learnings staged/committed with "Proposed by the system" · CommitBar naming who can commit ("Gareth, Glen or Ramya can") · two-tier empty states naming the owner (`components/ui/Empty.tsx` strings) · shoots KPI cards that click-filter · clip engine "regenerate with feedback + remember this rule" · QueueTable gold Assign pill · sign-off as a short decision list, not a grid · AskPanel contract "I only propose; you decide" · SocialBoard propose-only numbered statuses.

### Additional real-data exports (read-only) for rev 2
- All open **video + design** tickets with assignee (not just top-80) for Titus/Chee team boards; tickets in `Review` for Marisha's lane.
- `media_sources` with `strategy_json` clips for the Jim Kwik source (titles, timecodes, rationale) + its `Podcast Snippets` tickets and DNA reviews → first-cut draft.
- Shoots with `raw_files`, `production_support`, `requested_by`, `asset_type_ids`, `ticket_ids`, `new_prio_ticket`.
- Comms calendar 14–20 Sep is already exported; add VL videos live 14–20 Sep.
- Employees: Titus/Chee/Nadir/Gareth/Marisha/Glen/Ramya rows (names, roles) for the switcher.

### Screens
Shared (kept from rev 1, gain filter chips): Calendar · Requests & shoots · Queue · Work item · Repository · Confirm publications · Performance · My work · Learn · Partners · Connections · Appendix · Diagrams. **New**: `#/desk/<persona>` ×10 · `#/make/firstcut/<source>/<clip>` · `#/measure/roles` (roles → results).

---

## 5b. REV 3 — team agents that talk to each other, and the missing workflow pieces (11 Sep, second /prd pass)

Discovery run with Rhythm (rounds on missing workflow, agent architecture, autonomy, quality, UI).

### Decisions (D69–D84)
| # | Decision |
|---|---|
| D69 | **Missing workflow pieces now in scope**: copy & captions stage · scheduling & went-live · comment/approval threads (decision log) · podcast end-to-end tree · brief-from-what-wins at intake for every lane · sub-tasks under a ticket (E10). **Out**: localisation lane, broadcasts/notifications lane (PRD mention only). |
| D70 | **One agent per team, all on the same content graph**, coordinated by the shared Knowledge store and a **Signal bus**. Six agents: **Video** (Titus) · **Social** (Glen + Vidura) · **Email & VL channels** (Ramya) · **Production** (Nadir) · **Design** (Chee) · **Planning** (Vishen / Gareth / Marisha — MOW, day-by-day, learnings, next week, roles → results). No agent acts on another team's data directly. |
| D71 | **Agents talk through the graph, not to each other.** An agent writes a typed **Signal** (subject node, kind, evidence with refs · n · delta, confidence, suggested owner, proposed action) on the item; other agents subscribe by kind/lane; humans see every Signal in the item's thread. Fully auditable; no hidden A2A calls. |
| D72 | **Autonomy at launch** = observe/compute/post Signals · draft (briefs, captions, report sections, first cuts, learnings — always "drafted by system", never committed) · nudge (Slack DM/digest when a Signal needs a decision) · **bookkeeping actions only**: auto-link publications at the auto tiers, set Live Date from a pasted publish link, attach a first-day readout to the ticket. |
| D73 | **Trust ladder is fixed for six months: propose-only** on every content, rule or plan decision. D72's bookkeeping actions are the sole exception — reversible, logged, no content judgement. Re-open the ladder (per agent × action type, ≥80% acceptance over 30 decisions, lead flips) in March 2027. |
| D74 | **Agent quality** = acceptance rate of proposals (accepted ÷ accepted+rejected) per action type per 30 days, **and** cost & latency per agent (tokens, seconds to draft). Endorse/dispute counts and outcome-lift were **not** selected as quality measures (they remain learning signals). |
| D75 | **Copy stage**: the **editor writes the caption with the cut; the social manager polishes.** States on the publication: *Copy draft (editor)* → *Polished (social)* → *Scheduled* → *Live*. The caption is part of the creative record. Social agent may draft the caption from what wins; it is marked drafted. |
| D76 | **Scheduling & went-live**: a *Scheduled* state per publication with **channel owner** (Glen · Hootsuite / Ramya · Braze / agency · native / Talking Heads · YouTube) and planned time; **"went live" is confirmed automatically** when Perch/YouTube first sees the post (the matcher) — no human tick. Scheduling *from* the portal is "later". |
| D77 | **Threads**: one timeline per work item and per version — human comments, approvals/sends-back, and agent Signals in one stream, optional timecode. This is the decision log Vishen and Gareth asked for and where agents become visible. |
| D78 | **Agents in the UI** = a **"Your agent" block on every desk** (what it did this week: signals · drafts · nudges; what awaits your decision; acceptance rate; cost). A separate Agents registry screen and an Ask box were **not** selected; agent→agent hand-offs are visible **inside item threads**. |
| D79 | **Podcast** = **Episode parent work item** with children (master edit · YouTube upload + show notes · snippets · carousels · newsletter mention), each with lane, owner, status; publications hang off children. Scaling Wisdom / Jim Kwik becomes one tree of the six ticket types that exist today. |
| D80 | **Sub-tasks** come from two sources: the Video agent splits a lead's/Vishen's free-text instruction into checklist items (drafted, editor confirms), and a **standard checklist per asset type from its DNA** (deterministic; the DNA review checks the same list). Editors may add their own. |
| D81 | **Proactive intelligence to demonstrate on real data**: brief drafted from what wins at intake (every lane) · **24h anomaly nudge** with edit vs distribution separated (Manifest Love: pending collab invites) · **next-week suggestions** for empty slots from what worked in that slot before (thin Tue/Thu–Sun, 14–20 Sep) · **three live cross-agent hand-offs**: Social finding → Video brief change · Production "not filmed" → Planning blocker · Email cadence → Social day alignment. |
| D82 | Agent runtime in production: **no LLM in observe** — deterministic SQL/TS over the graph; **Haiku phrases** drafts with numbers fixed (D37); one scheduled runner per agent on the real scheduler (O6); Signals persisted in a `Signal` table (subject node type/id, lane, kind, evidence JSON, from_agent, to_agents[], status open/acknowledged/acted/dismissed, thread_id). |
| D83 | Memory: each agent reads/writes **Knowledge scoped to its lane** plus the shared graph; nothing is remembered outside the graph (no per-agent hidden state). |
| D84 | PRD: add epic **E-I Team agents & the Signal bus**; extend **E-D Lanes & IA** with copy stage, scheduling/went-live, threads, podcast tree, sub-tasks; extend **E-B** with brief-from-what-wins, anomaly nudge, next-week suggestions; **Users** section lists the ten personas (D56). |

### The six agents — subscribe → observe → emit
| Agent | Subscribes to | Observes (deterministic) | Emits (Signals / drafts) | Decides |
|---|---|---|---|---|
| **Video** | tickets in video/podcast lanes · Publications of its assets · Knowledge(assetType) · Signals from Social (caption/CTA), Production (footage ready) | day-1/7 readouts vs cohort; DNA review; retention patterns n≥8 | proposed DNA rules; brief drafts; first-cut drafts; sub-task checklists; "retention above/below median" | Titus (Team/Sub Lead) |
| **Social** | Perch/Composio metrics · 📣 Social records · Publications · Signals from Video (delivered), Email (cadence day) | matcher tiers; cohorts; gated-CTA / collab / posting-time contrasts; coverage % | attribution links (auto tiers); caption drafts; report sections; "distribution signal: collab pending"; unticketed list | Glen / Vidura |
| **Email & VL channels** | 📧 Emails · comms days · VL Videos · YouTube public · utm leads/orders · Signals from Planning (message), Social (day) | cadence vs message; agency deliveries vs plan; publish-link & Live Date gaps; per-agency leads | "email and social on the same day carry different messages"; chore counts; agency readouts; active-users slot when defined | Ramya |
| **Production** | Shoots · media_sources · raw-file links · Signals from Planning (next-week slots) | pipeline ages; filmed-without-handoff; planned slots without footage | "not yet recorded" blocker → Planning + Vishen's desk; post-production ticket proposals; podcast inbox nudges | Nadir |
| **Design** | design-lane tickets · banners CTR/CVR (later) · Signals from Planning (Thursday slot) | queue ageing (70-day tickets); DNA gap per type | "design asset types have no DNA"; queue-age nudges; banner learnings later | Chee |
| **Planning** | MOW master · comms days · all Signals | day-by-day plan vs live; learnings staged; next-week gaps | the Monday pack draft (staged only); next-week suggestions; roles → results table; "no plan item cites a learning" | Gareth / Glen / Ramya commit; Vishen reads |

### Three hand-offs to show live (real items)
1. **Social → Video**: Signal "gated-CTA reels −27% first-day views, +52% comments (n=24, @mindvalley)" on the Snippets asset type → Video agent's next brief draft for a Snippets ticket cites it → Titus sees it in the brief; thread on ticket #11057.
2. **Production → Planning → Vishen**: 15 shoots still "To Film" with filming dates ≤ 10 Sep → Signal "planned Mon/Tue releases 14–15 Sep have no footage" on the comms days → Planning agent adds the blocker to Vishen's *Next week* and Gareth's *Blockers*.
3. **Email → Social**: Wed 9 Sep newsletter ("What's the one thing you're truly the best in the world at?") and the day's three Pathway reels carry different messages → Signal "email and social on the same day: different messages — by design or not? owner Ramya · Glen" on the comms day; shown as *watch*, not a fault (Ramya's own rule: don't treat it as misalignment).

### Prototype rev 3 changes (same file, same URL)
- **"Your agent" block** on all ten desks (signals this week · drafts awaiting you · nudges sent · acceptance "collecting" · cost "not measured yet").
- **Threads** on the work item (#11057) and on the Jim Kwik reel: one timeline of Airtable status events (real), DNA review findings (real), matcher links (real), agent Signals (derived), and mock human comments clearly marked as sample.
- **Publication states** on the work item: Copy draft → Polished → Scheduled (owner, time) → Live (matcher-confirmed, with the real first-seen time).
- **Sub-tasks** checklist on the work item: DNA-derived standard list for Snippets + a drafted split of the ticket's WHAT TO DO lines (editor confirms).
- **Episode tree** screen `#/make/episode/scaling-wisdom`: the six real Scaling Wisdom ticket types as children under one Episode.
- **Next-week suggestions** on Vishen/Gareth/Glen desks: for each thin day 14–20 Sep, "what worked in this slot before" from real cohorts, marked drafted.
- **24h anomaly nudge** on Yuthika's and Glen's desks (Manifest Love, pending collab invites — the real example).
- Brief-from-what-wins extended to the design lane on the intake screen (cites banner CTR later — shown as "no design DNA yet").

## 5c. REV 4 PLAN — agent contracts with no assumptions, and the as-is workflow map (11 Sep, third /prd pass)

Deliverables (after approval): **`Context/workflows-as-is.md`** (reference: every team's status machine, actors, triggers, automations — cited to code/Airtable) and **one feature section per agent in `prd/content-studio-v2/team-agents-and-signal-bus.md`** using the contract template below. Both are documents only — no code.

### Decisions (D85–D92)
| # | Decision |
|---|---|
| D85 | Docs live in the repo: `Context/workflows-as-is.md` + per-agent feature sections in the E-I epic. Not in the prototype (a Workflows/Agents screen was not selected). |
| D86 | Default thresholds proposed: **anomaly** = goal metric < 50% of the same-age cohort median at day 1 with n≥8 → nudge; **stuck work** = In Progress > 14 days (video) / > 21 days (design) with no status event → blocker Signal. **Left open** (owners): footage-risk threshold — Nadir; attribution-coverage threshold — Glen. |
| D87 | Nudge policy: once per Signal; re-nudge after 3 working days if still open; max 2 re-nudges; everything else bundles into the Monday digest. |
| D88 | Cost ceiling: ≤ $5 per agent per week (Haiku phrasing only; observe is free); hard stop + Signal "budget reached" to Rhythm. |
| D89 | Cadence: Social, Video, Email & VL run **daily after the Perch pull (~04:00 UTC / 12:00 MYT)**; Production and Design **hourly**; Planning **Sunday night** (pack) + **Thursday pre-pass** (next-week suggestions). |
| D90 | Brief-from-what-wins is **auto-filled** into the brief field when Event Type + Asset Type are chosen, marked "drafted by system"; requester edits or clears. |
| D91 | Social agent drafts a caption **only when the editor delivers without one** (transcript + pillar + what wins); social manager polishes. Never overrides an editor's caption. |
| D92 | Slack recipients = owners and leads only (editors, Glen, Vidura, Ramya, Titus, Chee, Nadir, Gareth, Marisha). **Vishen is never paged** — his desk is the channel. |

### The agent contract template (every agent fills every row; "n/a" is an answer, blank is not)
```
Agent · owner · decides
Runs            : cadence (D89) · trigger conditions · what it reads first
Inputs          : exact tables/fields (Postgres · Airtable field ids · APIs), freshness required
Checks          : numbered deterministic rules, each with threshold, n-floor, cohort definition, and the Signal kind it emits
Emits           : Signal kinds (+ subject node type) · drafts (what, where they land, marker) · nudges (who, when, D87)
Subscribes to   : Signal kinds from other agents and what it does with each
Allowed writes  : the bookkeeping list (D72) applicable to it, nothing else
Forbidden       : explicit list (commits, status changes, ranking people, cross-team writes, paging Vishen…)
Human loop      : who accepts/disputes/dismisses each Signal kind; what "accept" changes
Failure         : source down / stale (> 36h) / n too small / budget reached → exact behaviour and label
Quality         : acceptance per action type per 30 days · cost · latency; where shown
Cost            : ≤ $5/week (D88); what counts
```

### Agent contracts (to be written verbatim into the epic; the specifics below are the decisions, not sketches)

**Video agent** · owner Titus (Team/Sub Lead of the asset type) · daily after Perch + on ticket → Review
- Inputs: `tickets` (video/podcast lanes; `ticket_status`, `assignee`, `asset_type`, `creative_brief`, `final_*`), `Publication`/`social_metrics` for its assets (day-1/day-7 snapshots), `asset_types.dna_upstream / dna_requirements`, `DnaReviewRule` (active), `ClipRule` (active), Signals from Social (`learning`, `anomaly`), Production (`footage-ready`).
- Checks: V1 readout per publication at 24h/7d (cohort D32, fallback D33); V2 retention contrast per asset type (top vs bottom quartile on goal metric, n≥8 both) → `learning` proposal ≤3/week (D38); V3 DNA review on → Review (existing `lib/dna-review/generate.ts`), flag-severity gates Approved; V4 stuck work In Progress > 14 days (D86) → `blocker`; V5 sub-task split of brief bullet lines + DNA standard list (D80) → draft on the ticket; V6 first cut only on the human "Generate first cut" click (D61); V7 brief-from-what-wins at intake for video/podcast asset types (D90).
- Emits: `learning` (asset type), `blocker` (ticket), `gap` (asset type without DNA text), drafts: brief, sub-tasks, first cut, proposed DNA rule; nudges: editor 24h readout DM (D47), Titus on proposals.
- Allowed writes: attach readout to ticket; store drafts as drafted; propose `DnaReviewRule` rows inactive. Forbidden: change `ticket_status`/`prio_status`/assignee; activate rules; render/publish video; compare editors.
- Human loop: editor endorses/disputes proposals (D39); Titus/Sub Lead activates (D42); editor accepts/rejects first cut (D61).
- Failure: no Perch capture → readout "not read yet"; n<8 → "collecting (x/8)"; Anthropic error → deterministic findings only (existing behaviour); budget → stop drafting, keep observing.

**Social agent** · owner Glen · Vidura · daily after Perch
- Inputs: `social_metrics` (raw payload incl. `post_views`, `saved`, `shares`, `ig_reels_avg_watch_time`, collaborators), 📣 Social records (`fldTVU4jMZW3JNswX` publish link, `fldZxIaWrFImce9H9` ticket recId, `fldQO9q4bkX3Mi1kj` pillar, caption `fldCpBMCWeGwmyYpx`, transcript `fldyonJXP12e5Sbv8`, cover attachment), Hootsuite tags, Metabase Q31846/Q32044 (session-side until app-side), Signals from Video (`delivered`), Email (`cadence-day`).
- Checks: S1 matcher tiers (D43) → link/propose/unmatched; S2 cohorts + readouts; S3 caption/CTA/collab/posting-time contrasts n≥8 → `learning`; S4 anomaly < 50% median at day 1, n≥8 (D86) → `anomaly` with edit vs distribution separated; S5 coverage chores (thresholds open — Glen) → `chore`; S6 caption draft only when delivery has none (D91); S7 weekly report sections (numbers as locked tokens) → draft for Glen (D66); S8 campaign table Hootsuite tag × utm.
- Emits: `learning`, `anomaly`, `chore`, `watch`; drafts: caption, report sections; nudges: Vidura/Glen on confirms and coverage; editors get the 24h DM via the Video agent.
- Allowed writes: auto-link at auto tiers; attach readouts; create Publication rows from links; nothing on Airtable statuses. Forbidden: change 📣 Social status; schedule/publish; edit an editor's caption; rank editors.
- Human loop: Vidura/Glen confirm PROPOSE-tier matches (D44), approve report sections (edit → "edited by Glen").
- Failure: Perch grant dead → "not captured" on every readout + Signal to Rhythm; unmatched → cohort peer + Unticketed list (D45).

**Email & VL channels agent** · owner Ramya · daily after Perch (YouTube public + utm weekly)
- Inputs: 📧 Emails (Live Date, Stage, Purpose, Type, Campaign/Comms Calendar link), 🗓️ Comms Calendar days (message, goal, phase, emails, social), VL `Videos` (Live Date, Source, Status, Approval, Published Link, 24h Data), YouTube public stats, Metabase leads/orders by `utm_source` (agency tags), Signals from Planning (`message`), Social (`cadence-day`).
- Checks: E1 email without Comms Calendar link / without Live Date → `chore`; E2 email and social on the same day with different messages → `watch` (never a fault — Ramya's rule); E3 VL asset published without Live Date → `chore` (256 today); E4 agency delivery without publish link > 2 days after Live Date → `chore` to the agency; E5 YouTube video first-day/7-day public views vs the channel's own median n≥8 → `learning`/`anomaly`; E6 leads & orders per agency utm weekly → readout; E7 active-users metric: **no check until the Metabase question exists** (slot labelled).
- Emits: `chore`, `watch`, `learning`; drafts: none in v1 (email copy is human); nudges: Ramya, the agency contact (in-portal for agencies; Slack only if they have one).
- Allowed writes: set Live Date from a pasted publish link (D72); create Publication from agency link; attach YouTube readouts. Forbidden: change email stage; send email; touch Braze; write to the agency's base.
- Human loop: Ramya accepts chores; agency confirms links; Rafi defines the active-users question (O).
- Failure: YouTube page unreachable → "not read"; LinkedIn → "manual entry" always; no VL message → owned empty, no Signal spam (one per week).

**Production agent** · owner Nadir · hourly
- Inputs: `shoots` (status, filming_date, raw_files, ticket_ids, new_prio_ticket, requested_by, asset_type_ids), `media_sources` (status, clip counts, error), comms days (planned releases), Signals from Planning (`next-week-slots`), Video (`first-cut-requested`).
- Checks: P1 shoot "To Film" with filming_date < today → `blocker` (threshold open — Nadir); P2 "Done – Filmed" without raw_files link > 2 days → `chore`; P3 filmed without a post-production ticket → propose ticket (via the existing checkbox path, human clicks); P4 planned release day with no linked filmed shoot → `blocker` → Planning; P5 media_source in Error > 24h or New > 48h → `chore`; P6 podcast episode with children missing (no snippets / carousel / newsletter) → `gap` → Video/Design/Email.
- Emits: `blocker`, `chore`, `gap`; drafts: shoot → post-production ticket proposal; nudges: Nadir; Gareth on blockers.
- Allowed writes: none beyond attaching links a human pasted. Forbidden: tick "New Prio Ticket"; approve shoots (Vishen's); change shoot status.
- Human loop: Nadir raises the ticket / adds footage; Vishen approves shoots on his desk.
- Failure: shoots sync stale > 36h → Signal "shoots not synced" to Rhythm; no filming dates → count shown, no blocker.

**Design agent** · owner Chee · hourly
- Inputs: design-lane tickets, asset_types (design, 48) DNA fields, banners CTR/CVR (later), Signals from Planning (`thursday-slot`).
- Checks: G1 stuck > 21 days (D86) → `blocker`; G2 unassigned design request > 24h → `chore` (gold Assign); G3 asset type used ≥5 times in 60 days with no DNA → `gap` to Chee; G4 Thursday collage slot without an item by Tuesday → `watch`; G5 banners: **no check until the banner lane is in scope (E14 held)**.
- Emits: `blocker`, `chore`, `gap`, `watch`; drafts: brief-from-what-wins for design types (cites the brief only until DNA exists); nudges: Chee.
- Allowed writes: attach readouts (image posts from Perch). Forbidden: assign designers; change status; DNA writes.
- Human loop: Chee assigns, writes DNA, accepts gap Signals.
- Failure: no design metrics → learning checks skipped, labelled.

**Planning agent** · owners Gareth · Glen · Ramya commit; Vishen reads · Sunday night + Thursday pre-pass
- Inputs: MOW master (`tbl3NPxLDApiIyobS`), comms days, all Signals, MowWeek/MowSlot/Learning, Metabase figures (ingest route), publications by day.
- Checks: L1 Sunday: generate the pack staged (existing `lib/mow/pack.ts` invariants: staged only, one headline); L2 day-by-day plan vs live (five states); L3 learnings: propose ≤5 from `learning` Signals of the week, `proposed=true`; L4 Thursday: next-week slots with 0–1 items → `suggestion` from slot cohorts (weekday × post type × pillar, n≥3); L5 "no plan item cites a learning" → `watch` to Gareth/Glen; L6 roles → results rows; L7 aggregate blockers from Production/Design/Social into Vishen's *Next week* and Gareth's *Blockers*.
- Emits: `suggestion`, `watch`, pack draft, learnings drafts; nudges: Gareth/Glen/Ramya (commit reminder Sunday 20:00 MYT); **never Vishen** (D92).
- Allowed writes: `*Staged` fields only; `Learning.proposed=true` rows. Forbidden: commit; write MOW message/goal (Airtable owns); narrate a number (D37).
- Human loop: Gareth/Glen/Ramya commit; Glen accepts suggestions into the plan.
- Failure: Metabase figure missing → headline slot "not filled" with the ingest instructions; MOW row absent → owned empty.

### The as-is workflow map — scope (content of `Context/workflows-as-is.md`)
One section per workflow, each as a table **state → next state · actor · trigger · side effects**, plus the cross-team hand-offs and every cron/automation with its real cadence: 1 Creative Services tickets (two axes) · 2 Shoots (+ New Prio Ticket & post-production checkbox automations) · 3 📣 Social board (16 statuses, Raise Request automation, copy stage) · 4 Clip engine + Vishen's Clips (statuses incl. Review – Marisha/Gareth) · 5 VL Videos (numbered lane + Approval) · 6 Comms Calendar + MOW (staged/committed, committers) · 7 DNA review (trigger, decision lock, Tier 1/2) · 8 Auto-editing (accept → Final Pass, reject taxonomy) · 9 Emails (stages, owners; no metrics) · 10 Agencies (how each delivers today) · 11 Notifications & digests · 12 Sync & schedulers (what actually runs, how often). Sourced from the code-constant extraction (in progress) and the transcripts; each row cites its file or Airtable field id. Gaps between the as-is and the v2 desks are listed at the end as the "delta" that the epics close.

### As-is findings (from code constants, 11 Sep) that change the contracts — folded in as D93–D100
| # | Finding (source) | Consequence for the agents / v2 |
|---|---|---|
| D93 | **Tickets have no transition graph.** `updateTicket` accepts any of the 13 `ticket_status` × 6 `prio_status` values from any state; the only enforced edge is the DNA gate on → Approved (`lib/tickets/write.postgres.ts`, `app/tickets/[id]/actions.ts`). `GATED_STATUSES=['Shipping']` is declared and used nowhere. | Agents must not assume ordered stages; "stuck" (D86) is defined on **time since the last `TicketEvent`**, not on a missing transition. The v2 publication states (D75/D76) are the first ordered machine — put them on the Publication, not the ticket. |
| D94 | **`prioStatus`, assignee and `queueRank` changes write no `TicketEvent`** — only `ticketStatus` does. | Prioritisation learning (capability #3) and the Video agent's re-rank signal need the widened event log first (build step 4). Until then the agents observe status only. |
| D95 | **Vishen's `approveContentReview` bypasses the DNA gate** (calls `updateTicket` directly); `requestApproval`/`decideApproval` also bypass it. | The Video agent must emit a `watch` Signal when a ticket reaches Approved with a flag-severity finding still open — and the v2 build closes the bypass. |
| D96 | **The app knows 4 of the 16 📣 Social statuses** (`1: Proposal`, `2: Approved`, `2A. Ticket Raised`, `13: Reject`); `Copy Request`/`Copy Ready`/`Scheduled`/`Released` exist only in Airtable; `SocialBoard` classifies by prefix. Portal-raised tickets use *Video Team – Non Campaign*, checkbox-raised use *Campaign [Events, etc]*. | The Social agent reads the full 16-status vocabulary from the field map (to be added) before any copy-stage or scheduling Signal; the team-service-level divergence is recorded as a defect to fix. |
| D97 | **MowSlot `shipped / missed / blocked` have no writer** — only `planned` is ever set. | The Planning agent is the first writer of those states (bookkeeping, derived from the matcher's "went live"); `blocked ≠ missed` is now real, not a schema comment. |
| D98 | **Emails have no code at all** — no table constant, no stage enum, no read path; `COMMS_DAY.noOfEmails` (a typed number) disagrees with the `emails` link in practice. | The Email & VL agent's first job is to read 📧 Emails (Live Date, Stage, Purpose, Type, Comms Calendar link) via a new field-map block; E1 (email without day link) is the first Signal it can emit. |
| D99 | **"Accept → Final Pass" exists only in the PRD/plan**; `Final Pass` is a live status used for grouping only; acceptance events are in-memory. | The first-cut contract (D61) is honest as written ("mock render, history not persisted"); the build must add the durable `AcceptanceEvent` before any acceptance rate is shown. |
| D100 | **Notification backends disagree**: Airtable path fires "asset ready" on `Done` + folder link; Postgres path fires on any delivery link. Vishen's Clips `Review – Marisha/Gareth → Marisha/Gareth Approved → Done` is human-only in Airtable and invisible to the app (allowlist `Todo / In progress / Apply Feedback`). | Agents read Marisha's approval lane from Airtable status, never write it; the Production/Video agents treat "asset ready" as the Postgres definition (any delivery link). |

### `Context/workflows-as-is.md` — content (the extraction is complete; the doc transcribes it)
Twelve sections, each a table **state → next · actor · trigger · side effects**, cited to file or Airtable field id:
1. **Creative Services tickets** — 13 ticket statuses × 6 prio statuses, no transition graph (D93); intake → `Backlog`/`New Request` (or `To Do` when exactly one active preferred editor); → Review fires DNA review; → Approved gated (flag or missing review, fail-closed) with override note → Tier-1 rule; Vishen's sign-off paths (`approveReview` → prio In Queue; `sendBackForRevision`; `approveContentReview` bypass D95); `queueRank` 1–10 by Vishen; entitlement fails open for design.
2. **Shoots** — 5 statuses; anyone creates; Vishen approves/declines (also ticks `vishenApproved`); any user sets To Film / Done – Filmed; `raiseNewPrioTicket` gated on Asset Library + Event Type → one-shot checkbox reset in the same transaction → Airtable automation creates the post-production ticket (script not in repo).
3. **📣 Social** — 16 live statuses, 4 known to code (D96); clip engine → `1: Proposal`; approve/reject by Marketing division; `raiseSocialRequestAction` → CS ticket (`Non Campaign`) + `2A`; Airtable checkbox `fldrNumf2EpoRetuf` → automation `wflhKn1g3jVmS9jtI` → CS ticket (`Campaign [Events, etc]`); push map deliberately omits raiseRequest/format/type/transcript.
4. **Clip engine** — media_sources `New → Transcribing → Clips Suggested | Error`, `Archived`; clip suggestions `Proposed → Approved | Dismissed`; convert → tickets + mirror to Vishen's Clips (`AI Suggested`, `Todo`); hourly checkbox conversion inherits taxonomy from the parent source; Vishen Clips allowlist (D100); ticket → clip status map (`Backlog/To Do/Hold → Todo`, `In Progress → In progress`, `In Revision → Apply Feedback`).
5. **VL Videos** — Status `1. Idea … 7. Published` never written by the app; Approval `To Review / To Refine / Approved / Rejected / Parked` — app writes `Approved`, `To Refine` only; rating 1–5; `views24h` manual → `social_metrics` (source manual) mirrored only into an empty cell; `liveDate` the only scheduling field written.
6. **Comms Calendar + MOW** — `ensureWeek` on page load; commit/reopen by Gareth/Glen/Ramya only (server-side); staged→committed snapshot in one transaction; learnings `proposed=true` cleared on human edit; MowSlot states unwritten (D97); comms-calendar code read-only except the writable-subset push.
7. **DNA review** — trigger on → Review; lock on → Approved; override (note + `canGovern`); dismiss flag (note + `canGovern` + **not the assigned editor**); Tier 1 (override → active rule; reaction → inactive); Tier 2 aggregates last 50 overrides + 50 reactions per asset type; no cron.
8. **Auto-editing** — decisions accepted/rejected; reject reasons `reframe / caption_position / caption_timing / audio_grade` (+ `moment_selection` routed to the clip engine); rate per asset type reset per DNA version; in-memory only (D99).
9. **Emails** — no code (D98); 📧 Emails stages observed in Airtable: `1: Proposal`, `3: In Progress`, `5. Sent`; purposes Launch / Retention / States; types Invite / Show-up / Sales sequence, Vishen's Newsletter, Other Newsletter.
10. **Agencies today** — Rise Voice files shoot requests *and* posts in the VL base (own base sync blocked by InfoSec); Talking Heads long-form YouTube; Two Comma PR LinkedIn (fills filming date where live date is meant); all paste publish links; briefing is ad hoc records with status `1. Idea … 7. Published`.
11. **Notifications** — asset ready (two definitions, D100), assignment DM, social digests (silent when empty), auto-editing drift DM.
12. **Schedulers** — nine GitHub workflows with real cadences (5-min ticket sync slipping 3–11h; hourly discover/convert/reference; nightly metrics 03:00 and Perch 03:30; Monday clip-learn 03:00, digests Mon/Wed 04:00; manual MOW figures/backfills) + two live Airtable automations + five retired ones still to be disabled.
Closing section: **the delta** — each v2 desk block / agent check mapped to the as-is row it changes, so nothing in v2 is built on an assumed workflow.

## 5d. REV 4 — the twenty decisions that remove the developer's guesswork (12 Sep)

Asked as "what would a developer still have to assume?" and answered. These are binding; anything
not here and not in §3/§5b/§5c is genuinely open (list at the end).

### The graph
| # | Decision |
|---|---|
| D101 | **Publication identity.** One row per **(account × platform post)**. Key = `platform_post_id`, else the normalized URL. A cross-post to Facebook is its **own row**, never a channel array (IG reports reach, FB clicks, TikTok views — summing inflates ~5×). Stories get rows but are **excluded from cohorts** (ephemeral). A Publication with **no asset** is legal — the 100 unticketed posts — and stays a cohort peer. A post deleted from the platform keeps its last observation, flagged *removed from platform*. |
| D102 | **Agency scoping** = union of three: the producer/`Source` field names the agency **OR** an agency member created the record **OR** the item was explicitly shared with them. They never see another agency's items; cohort medians reach them anonymised. Implemented once as `scopeFilterFor(access)` and applied in every read. |
| D109 | **Locales are derived assets.** A DE or ES cut is its own Asset with `derivedFrom → source`, its own ticket and its own publications; it is compared with `@mindvalley.de` peers, never with English, and its learnings attach to its own asset type. **The caption lives on the Publication** (per account, per language) — that is what the editor writes and the social manager polishes; **hook, transcript, offer and CTA live on the Asset**. This resolves the D75 tension the PRD flagged. |
| D113 | **Identity: add `Party` keyed by email; never refactor `Employee.id`.** Party is the person for access, scoping, ownership, agents and threads (email is already how sessions resolve). `Employee` stays exactly as it is — the Airtable mirror, recId primary key, ~430 references untouched — with a Party link. An offboarded employee's Party survives, so their history, authored threads and learnings do not vanish. |
| D119 | **Metric retention.** Keep day-1, day-7 and day-30 snapshots **forever**; thin everything else to weekly after 90 days. Raw Perch payloads are kept on retained rows only (they carry the caption, tags and collaborators the matcher needs). |

### The agents
| # | Decision |
|---|---|
| D103 | **Signal lifecycle.** Natural key = `agent + check id + subject node (+ period)`. A re-run **updates** the open Signal, never duplicates it. A Signal **auto-closes** when its condition stops holding (logged as *resolved by data*). Dismissal requires a reason and suppresses that check on that subject for **30 days**. Agents act as a **system actor**, not an `Employee` row. |
| D120 | **Signal kinds — closed vocabulary of seven**: `learning` (a pattern, n≥8) · `anomaly` (one item far off its cohort) · `blocker` (work cannot proceed) · `chore` (data a human must supply) · `watch` (might be fine, might not) · `gap` (a missing capability — no DNA, no metric source) · `suggestion` (a drafted item for a plan). Adding a kind is a schema change, deliberately. |
| D105 | **Cohort rules**: exclude the post **itself** from its own median · **organic only** (boosted/paid excluded by Hootsuite tag or ad-account origin, so an editor is never measured against spend) · **rolling 90 days** from that post's own publish date · **no median at all under n=3**, not even a fallback. |
| D106 | **Rule lifecycle**: activation is **forward-only** (no retroactive flags on tickets already at Review) · editing an active rule creates **version n+1**, the old version retained so past reviews still cite what they applied · two active rules whose evidence points opposite ways surface as a **conflict** on the asset type for the lead · a **contested** rule nobody acts on for **4 weeks auto-archives** with its evidence. |
| D108 | **Staleness**: always show capture time; **amber after one missed run (>36h)**, **red + "not current" after two (>60h)**. The number stays visible but labelled, and the label propagates into any Signal or Slack DM computed from it. |

### Workflow behaviour
| # | Decision |
|---|---|
| D107 | **Replace the two ticket-creating Airtable automations with a webhook → app endpoint.** The checkboxes stay (the team keeps its habit); the app owns creation, which also fixes a live defect — portal-raised tickets use *Video Team – Non Campaign* while the Airtable script uses *Campaign [Events, etc]*. Idempotent on the source record id. Inbound pull cannot stop until this ships. |
| D111 | **Sub-tasks are advisory**: unchecked items appear as *missing* in the DNA review's deterministic section (where deliverable-completeness already lives), never block a status change, and are **not synced to Airtable**. |
| D112 | **Threads**: notify **@mentions + the item's owner**; entries editable for **15 minutes then immutable**; approvals, sends-back and agent Signals are **never** editable — the thread is the decision log. **No sync** to Airtable record comments. Agencies and internal people see the same thread on shared items. |
| D114 | **Internal visibility = open by default, three exceptions**: per-editor readouts (editor + their asset-type leads + managers/admins, D50) · agency commercial terms (Marisha) · anything inside an agency's scope. `/stakeholder` gets a **real requester filter** with an "All requests" toggle — today it is titled "My requests" and shows the whole company. |
| D110 | **First cut**: pilot is **Podcast Snippets only** (where the DNA gap and the Jim Kwik thread already sit; Vishen's channels stay barred until proven) · output written back to **the ticket's existing Dropbox folder**, no new storage layer · render cost on the app's Kessel project with a **monthly cap** and an alert. |

### Delivery
| # | Decision |
|---|---|
| D104 | **Rhythm builds alone. Slice 1 = scheduler + Perch mapper + `Publication` + attribution backfill — no new UI.** It puts the join underneath the portal that exists, so every later surface has real data on day one. |
| D117 | **Scheduler = an external cron service** (cron-job.org or similar) hitting the existing bearer-gated routes. Zero new infra, minute-level accuracy, works today. Kessel's own scheduler can replace it later without touching app code. |
| D118 | **Backfill everything with a real key, no date floor**: every Perch post (27 Aug onward — all Perch holds), every `VishenVideo` with a published link (185), every Social record with a link, plus caption matches across all released Social records. The repository is useful on day one instead of starting empty. |
| D115 | **Measurement**: stamp `linkedAt` + `linkTier` on every Publication; nightly coverage snapshot; both 60-day numbers shown on **Connections & data health** with the baseline captured the day slice 1 ships. "Within 24h" = `linkedAt − posted_at ≤ 24h`, measured only on posts that have a Social record. Rule acceptance comes from the Knowledge status history. |
| D116 | **Cutover, surface by surface**: the v2 route goes live behind the flag; the v1 route redirects **the week after each of that surface's owners has used v2 for a full cycle** — for MOW, after Gareth, Glen and Ramya have each committed once from v2. Both read the same tables throughout, so no data fork. |

### Still open — with owners (nothing else is assumed)
| # | Question | Owner |
|---|---|---|
| O1 | Goal-metric map (D36) confirmation | Gareth |
| O2 | Short-code convention and where it must appear (utm_content, Hootsuite tag, filename) | Glen + Gareth |
| O3 | Image-similarity method and threshold for the PROPOSE tier | engineering spike |
| O4 | Event-tier ranking (open since June) — blocks prioritisation learning | Moniek |
| O5 | Metabase / Braze / Composio app-side credentials | Glen |
| O7 | Banner lane taxonomy (E14, held) | Rafi |
| O8 | Agency invitation model with InfoSec (PAT sharing blocked for Rise Voice's base) | Rhythm + InfoSec |
| O9 | YouTube Analytics OAuth — the only route to Vishen's 7% CTR benchmark | Glen + Ramya |
| O11 | Footage-risk threshold (how late is "at risk") | Nadir |
| O12 | Attribution-coverage threshold that triggers a chore Signal | Glen |
| O13 | Does a PROPOSE-tier match flip *Scheduled → Live* (D43 vs D76)? | Rhythm |
| O14 | Vidura is a named confirmer and half the Social agent's ownership but is not one of the ten personas | Rhythm |
| O15 | Signal retention period (Signals are cheap; threads are the audit trail) | Rhythm |
| O16 | Second builder, if and when | Rhythm |

## 6. BUILD — slice 1, shipped to a preview link (12 Sep)

The ask changed from "documents only" to **build it and give me a link to test**. The constraint is
unchanged: the team's portal runs the Message of the Week on **Monday 14 Sep** and must not move.

### Environment and rules (D121–D124)
| # | Decision |
|---|---|
| D121 | Work on branch **`v2/slice-1-publication`** with an open PR, deployed via **`kessel preview`** (its own URL). `main` auto-deploys to the team's service and is **not touched**; nothing about Monday changes. |
| D122 | **Write rule** (D-write, from §5d): new tables and new *nullable* columns only. **One refinement, flagged for your call:** a brand-new nullable column may be backfilled from that row's own `raw` payload — nothing the live app reads changes. No existing column is ever rewritten. If you'd rather not write to `social_metrics` at all, the alternative is computing views/watch-time from `raw` at read time: zero writes, slower queries. |
| D123 | Access: every `/v2/*` route gated by `isV2Allowlisted(email)` — the same shape as `lib/studio/access.ts` (code default + `V2_ALLOWLIST_EMAILS` env override). |
| D124 | New surfaces live under **`/v2/...`**, so merging the branch to `main` later is inert for the team — the routes exist, nothing links to them, and the allowlist still gates them. |

### How the preview link actually works (verified against the CLI and the repo, 12 Sep)

1. Branch → PR → `kessel preview` builds **that branch** and deploys it as its own Cloud Run
   revision with its own URL. The team keeps hitting
   `…auth-js-next-js-prisma-google-login-cont-73a7-…-as.a.run.app`, which auto-deploys from `main`.
2. **Never run `kessel deploy` during this work** — it targets production *and builds from local
   disk*, which caused an outage on 2026-08-31. `kessel preview` is the only deploy command here.
3. The preview serves the whole app (same code, same data) **plus** `/v2/*`. No existing page is
   modified, so a visitor sees today's portal until they open a `/v2` route.
4. **Login needs one manual step — D125.** `lib/auth.config.ts:51` sets `trustHost: true`, so the app
   itself copes with a new hostname; Google OAuth does not — it matches redirect URIs exactly, and the
   preview host is new. **Agreed flow:** I deploy first, hand Rhythm the exact line
   `https://<preview-host>/api/auth/callback/google`, and Rhythm (or IT) adds it to the OAuth client's
   authorised redirect URIs. Production auth is untouched, and the same URI keeps working for every
   later push to the branch. Sign-in fails with `redirect_uri_mismatch` until that is done — expected,
   not a bug. This project hit the same thing when the app moved region.
5. **Env vars are project-level, not per-deployment** (`AUTH_URL`, `NEXT_PUBLIC_URL` and every secret
   are shared with production). So this slice introduces **no new required env var** except
   `V2_ALLOWLIST_EMAILS`, which is inert for production because `main` has no `/v2` route.
6. **Database**: same project ⇒ almost certainly the same `js_next_js_prisma_google_login_dev`.
   Verified before any migration; this is why D122 is additive-only.
7. **Refreshing**: push to the branch, run `kessel preview` again — same URL, new build.
8. **Ending it**: merge the PR and `/v2` lands on the team's URL still allowlisted and unlinked; or
   close it, and the two additive migrations drop cleanly.

### D130 — an additive column is not additive if a read path already prefers it (12 Sep)

D122's refinement said a brand-new nullable column may be backfilled from the row's own `raw`
because "nothing the live app reads changes". That was wrong, and it showed up in production
figures the same day. `reachOf()` in `lib/metrics/social-metric-types.ts` is
`views ?? impressions ?? reach` — it *prefers* `views`. Backfilling the column therefore moved
every headline on `/performance` and Vishen's `/studio`: 943 of 1,588 30-day rows changed,
about 1.39x higher (208 → 310, 191 → 241, 301 → 347), and the 30-day total went
20,719,556 → 40,080,031.

**Rhythm's call: revert, restore yesterday's display exactly.** Migration
`0035_revert_views_backfill` nulls precisely what 0032 wrote and nothing else — the 30 TikTok
rows keep their views because they already had them (`pick()` lowercases and strips `_`, so
`video_views` → `videoviews` matched the old key list; Instagram's `post_views` → `postviews`
did not, which is the entire bug). Verified after applying: 30-day total back to 20,719,556,
`views` non-null on 30 rows, watch time still on 933, saves/shares/comments/collaborators still
on 1,702 — those columns stay because no read path prefers any of them.

v2 reads views out of `raw` at query time instead, via `viewsOf()` in
`lib/publications/repository.ts` (every caller must select `raw` beside it). The readouts are
identical — the Manifest Love reel still reads 3,725 — while the pages the team opens on Monday
read what they read yesterday. Nothing is lost: the numbers remain in `raw`, so 0032's UPDATE
restores the column the day a read path stops preferring it.

**The rule, corrected:** additive is about *reads*, not writes. Before backfilling any new
column, grep for every read of that column name — a `??` chain is enough to change a headline.

### Tooling and where the intelligence actually lands (D126–D128)
| # | Decision |
|---|---|
| D126 | **Do not use `/build-feature`.** Verified: `skills/build-feature/SKILL.md` is hardwired to a pnpm turborepo — it writes to `packages/database/prisma/schema.prisma`, `apps/api/src/domains/`, `apps/web/src/` and verifies with `pnpm turbo build`. This repo is one Next.js app on npm with `prisma/` at the root. Build directly against this repo's own conventions: `DESIGN_SYSTEM.md`, `CLAUDE.md`, and the `backend.ts` / `data.*.ts` / `write.*.ts` dispatch pattern. |
| D127 | **Slice 1 includes the deterministic intelligence.** Add the `Signal` table and every check that needs no model — cohort readouts, edit-vs-distribution separation, the gated-CTA / collab / caption-length contrasts at n≥8, and the seven Signal kinds (D120). Pure SQL/TS, already computed in the prototype's `derive.py`. **No Haiku, no Slack, no writes to existing tables** in this slice. The preview link therefore shows a real Signal on a real ticket, not only a coverage number. |
| D128 | **Slice 2 = the Knowledge store + endorse/dispute/activate UI + Haiku phrasing (D37) + the 24h Slack nudge (D47).** This is where the cost ceiling (D88) and the propose-only ladder (D73) first bite. Slice 3 = brief-from-what-wins (cap #2) and prioritisation learning (cap #3, needs the widened `TicketEvent` from D94). First cut (E12) and the conversational layer (cap #5) stay on their own tracks. |

### Intelligence, honestly sequenced
| Capability (`Context/intelligence-layer.md`) | State | Lands in |
|---|---|---|
| #4 AI-assisted DNA feedback | **built and live** (E13 · 16 reviews · decision lock) | — |
| Clip-rule and DNA-rule learning loops | **built and live** | — |
| #1 Performance insight that writes back | blocked on the join | **slice 1** (the join + deterministic contrasts) → **slice 2** (proposals a lead can activate) |
| #2 Brief generation from what wins | needs #1's contrasts + active rules | slice 3 |
| #3 Prioritisation that learns | blocked on `TicketEvent` recording rank / assignee / prio (D94) | slice 3 |
| #5 Conversational layer | emergent once the graph exists | last |
| The six team agents + Signal bus | new | deterministic half in **slice 1**; drafting, nudging and approval in **slice 2** |

### The steps

**1 · Scheduler — added, not swapped.** Point an external cron service at the existing bearer routes
(`/api/sync/push`, `/api/sync/pull`, `/api/metrics/perch-pull`) **alongside** the GitHub workflows.
Both paths are idempotent — `drainOutbox` groups by `(entity, entityId)` and the pull is cursored with
90s echo suppression — so running both is safe and strictly improves freshness for everyone, including
Monday. Retire `.github/workflows/ticket-sync.yml` only after the MOW. *No code.*

**2 · The Perch mapper — the views bug, found in the code.** `pick()` in `lib/hootsuite/perch.ts:185`
normalises keys by lowercasing and stripping `_`, so the Instagram payload's **`post_views`** never
matches the `['views','videoViews','viewCount','plays']` list at line 332. That — not a Hootsuite
limitation — is why `views` is null on all 1,642 rows while `raw` carries the number on 869 of them.
Fix: add `post_views` (plus `video_views`, `plays_count`) to that list; add picks for `saved`, `shares`,
`comments`, `likes`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`; read `post_type` and
`collaborators` from the **structured** path (`details.instagram_metadata`) rather than `flattenLeaves`,
which keeps only the first leaf of an array and would collapse five collaborators into one.
Migration `0032_social_metric_engagement` adds the nullable columns and backfills each row from its own
`raw`. `lib/metrics/social-perf.ts` (`SocialMetricInput`, `ingestSocialMetrics`) carries the new fields.

**3 · `Publication`.** Migration `0033_publication`, per D101: unique on
`(accountRef, coalesce(platformPostId, normalizedUrl))`; nullable `assetRef` / `ticketAirtableId`
(orphans are legal); `channel`, `postType`, `publishedAt`, `goal`, `tags[]`,
`derivedFromPublicationId` (locales and re-cuts, D109), `linkedAt`, `linkTier` (D115),
`removedFromPlatformAt`. Plus `social_metrics.publication_id` — nullable, indexed, FK.

**4 · The matcher.** `lib/performance/attribution.ts` already holds `normalizeFragment`,
`captionFingerprint`, `MIN_FRAGMENT_CHARS = 40` and `MIN_MATCH_CHARS = 80` — and has no caller. Wrap it
in `lib/publications/resolve.ts` implementing D43's tiers: URL / `platform_post_id` → auto ·
caption ≥ 80 shared normalized chars → auto · transcript-only or image-only → **proposed** · else
unmatched. Stamp `linkedAt` + `linkTier` on every link. Backfill per D118 (no date floor) behind a new
bearer route `/api/v2/publications/backfill` using `requireSyncSecret` from `lib/api/guard.ts`.

**5 · The two surfaces that prove it.**
- **`/v2/work-item/[id]`** — the ticket, plus the performance band: its publications, first-day and
  day-7 readouts against the cohort (D105: exclude self · organic only · rolling 90 days · no median
  under n=3), with edit and distribution signals kept apart. The cohort maths is the prototype's
  `derive.py` ported to TypeScript; reads via `getLatestMetrics` in `lib/metrics/social-perf.ts`.
- **`/v2/connections`** — every source with its state, last capture and staleness (D108: amber > 36h,
  red > 60h), plus the two 60-day numbers with the baseline stamped the day this ships (D115).

**5b · `Signal` — the deterministic half of the engine (D127).** Migration `0034_signal`: natural key
`(agent, checkId, subjectType, subjectId, period)` unique (D103), `kind` constrained to the seven of
D120, `evidence` JSON (refs · n · delta), `status` open/acknowledged/dismissed/resolved,
`dismissedReason`, `resolvedBy` (`data` | email), `createdAt`/`updatedAt`. `lib/signals/checks/*.ts`
holds one pure function per check — each takes the graph, returns `SignalInput[]`, and is unit-testable
without a database. `lib/signals/emit.ts` upserts on the natural key, auto-closes a Signal whose
condition no longer holds, and never duplicates. Rendered on the two surfaces below; **no Slack, no
model, no writes outside the `signals` table** in this slice.

**6 · Nightly coverage snapshot** into the existing `MetricSnapshot` table under a new key
`v2_coverage` — additive, nothing else reads it.

### Files
| Change | Path |
|---|---|
| mapper fix + new metric fields | `lib/hootsuite/perch.ts`, `lib/metrics/social-perf.ts` |
| schema + DDL (applied with **`kessel db migrate`**, never `prisma migrate` — the DB is reachable only through Kessel) | `prisma/schema.prisma`, `prisma/migrations/0032_social_metric_engagement/`, `0033_publication/`, `0034_signal/` |
| new | `lib/publications/{resolve,repository}.ts`, `lib/signals/{emit,repository}.ts`, `lib/signals/checks/*.ts`, `lib/v2/access.ts` |
| new routes | `app/v2/work-item/[id]/page.tsx`, `app/v2/connections/page.tsx`, `app/api/v2/publications/backfill/route.ts` |
| reused, not rewritten | `lib/performance/attribution.ts` (the matcher), `lib/api/guard.ts` (bearer), `lib/studio/access.ts` (allowlist pattern), `components/ui/*` (primitives, per `DESIGN_SYSTEM.md`) |

---

### Running in parallel — the PRD catches up (D129)
The nine epics under `prd/content-studio-v2/` predate today's decisions: **none of them contain
D101–D128**. A subagent transcribes them into the right epics while the build runs — this is writing,
not deciding, so `/prd`'s discovery conversation is not re-run; only its conventions are (template
sections, `[UNRESOLVED]` markers, resolution counts, `prd/index.md`). Mapping: D101/D109/D119 → E-A ·
D103/D105/D106/D115/D120/D127/D128 → E-B and E-I · D107/D111/D112/D114 → E-D · D102/D113 → E-E ·
D110 → the E12 reference · D104/D116/D117/D118/D121–D126 → the product PRD's Boundaries and a new
"Delivery" section. O1–O16 become the Open Questions table verbatim, owners included — they belong to
Gareth, Glen, Moniek, Nadir, Rafi and InfoSec, not to this build.

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

## 9. Verification

**Before any migration** — confirm what the preview is actually bound to: `kessel status` on the branch,
and check whether the preview's `DATABASE_URL` is the shared `js_next_js_prisma_google_login_dev`. If it
is (expected), the additive-only rule D122 is what keeps the live portal safe; if Kessel gives the
preview its own database, say so and the backfill seeds it instead.

**Build** — `npm run build`, `npm run lint`, `npm run verify` all green before the PR opens.

**Data**
- `kessel db query "select count(*) from publications"` > 0 after the backfill.
- `views` non-null on ≈ 869 Instagram rows; `avg_watch_seconds` on ≈ 468.
- Existing `social_metrics` columns unchanged — spot-check 20 rows captured before and after.
- Coverage ≈ 55% on `/v2/connections`, with the baseline date stamped.

**Surfaces**
- `/v2/work-item/recfmrnlmw9pqbgO3` reproduces §2's table exactly: 3,725 views vs 9,735 median
  (19th of 21), 8s avg watch vs 5s, both collaborator invites Pending shown as a *distribution* signal,
  not an edit one.
- At least one `learning` Signal exists with real evidence (the gated-CTA contrast, n=24) and one
  `anomaly` Signal on that reel; re-running the checks twice **updates** them rather than duplicating
  (D103's natural key), and a Signal whose condition no longer holds closes itself as *resolved by data*.
- `lib/signals/checks/*.ts` unit-test green without a database (pure functions over fixtures).
- A non-allowlisted `@mindvalley.com` account is refused on `/v2/*`.

**Isolation**
- The team's URL still serves `main`: `kessel status` shows the unchanged production deploy, and the
  live `/tickets/[id]` page renders exactly as before.
- `.github/workflows/*` untouched until after Monday.

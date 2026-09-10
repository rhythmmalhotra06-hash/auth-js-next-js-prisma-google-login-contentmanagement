# 9 Sep meetings → one delivery plan (MOW, social page, banners, ads, clip farm)

## Context

Five meetings on 2026-09-09 (Ramya, Gareth, Moniek, Matt Coates, Glen) converged on one hard
deadline: **Message of the Week runs live in Content Studio, in a new format, Monday 14 September,
08:00 MYT.** Vishen asked in person on Monday 7 Sep. Four of the five feed it; Matt's ads automation
is cleanly separable.

This document is the **umbrella plan across all workstreams**. It does not restate the two build
briefs that already exist — it sits above them, reconciles them, and carries the findings and
decisions neither contains.

### Authoritative sources (all read, not inferred)

| Source | Role |
|---|---|
| `Sep Calls/Handoff/MOW-HANDOFF.md` | **The MOW build brief.** D1–D9 decided. Authoritative for the MOW data model, views and jobs, except where §4 below overrides it. |
| `Sep Calls/Handoff/mow-content-studio-brief.html`, `mow-prototype.html` | Cadence/integrations detail + the visual target for the MOW views. |
| `Sep Calls/Handoff/HANDOFF.md` | **The banner/campaign fan-out brief** → proposed epic **E14**. Discovery complete, five decisions pending owners. |
| `Sep Calls/Handoff/CLAUDE.md` | **Glen's data rules.** Every rule cost real money once. Transcribe into code. |
| `Sep Calls/Handoff/handover-checklist.md`, `message-of-the-week-handoff.md`, `slack-revenue-overlap.md` | Glen's credential/ownership handover + his existing weekly HTML report. |
| `Sep Calls/Handoff/Build_a_Self-Improving_Clip_Farm (1).pdf` | Angus Sewell's guide — Vishen's ask. Evaluated in §5. |
| `Sep Calls/*.docx` | The four Gemini transcripts. |
| Metabase collection **8845 "Social"**, db 35 (`MV BigQuery`), questions **31846** / **32044** | Verified reachable this session. |
| Live `📣 MV Content & Comms` (`app9YRZOVeE65fJPA`) + this repo | Schema verification. |

### The three stakeholder asks, in their own words

- **Vishen** — one portal view, one smart number, day-by-day cadence with named owners, revenue.
- **Gareth** — every asset stored as tabular data (copy, transcript, offer, CTA) *plus* performance,
  so it becomes a learning engine, not just a storage engine.
- **Glen** — every editor gets a 24-hour readout, the "why this worked" logic stays human-editable
  (*"if efficiency is a recommendation and that's not true, it might derail everything"*), and one
  place to work from that isn't Airtable (*"it's very 2022"*).

---

## 0. Revision 2 — the 10 Sep workshop (read this first)

A second workshop happened on **10 Sep** (build session with Ramya). It changed seven things and
added a new surface. `Sep Calls/10 Sep/MOW-HANDOFF-10SEP.md` is **authoritative wherever it
conflicts with anything below**; `comms-calendar-v2.html` is the new surface's visual target.

| # | 9 Sep position | 10 Sep position |
|---|---|---|
| 1 | A date-grain table in the VL base | **No new Airtable tables.** The calendar is a front-end view; the day is derived by grouping assets on `Live Date`. |
| 2 | One MOW, brand as a tag | **One row per brand per week**, rendered side by side. *(Confirms S3.)* |
| 3 | Brand → multiSelect | **Single-select stays.** Two rows, not one row serving two brands. |
| 4 | Calendar is VL-only | **One Comms Calendar, three states** — Main / Vishen's / Mindvalley. |
| 5 | Asset → day → message | **Asset links directly to the message** — a link field on `Videos` plus a Goal lookup, built in the call. |
| 6 | All sources inside Mindvalley bases | **Rise Voice (agency) is a fifth source**, read via creator access on *their* base. InfoSec blocks PAT sharing. |
| 7 | `Videos` is the video table | **`Videos` is the VL content workflow** — LinkedIn, YouTube, community, email. |

### Verified live, 10 Sep afternoon

Re-read from the bases after the handoff was written, because the handoff's own state was captured
that morning:

- **MOW master `tbl3NPxLDApiIyobS`** — 7 records. 6 tagged `Mindalley` *(sic)*, 1 tagged `VL` named
  **"test"** with goal `vcvdsv`. `Goal` is **empty on all 6 real records**. All still present.
- **`Week starting` does not exist.** Confirmed — the table carries only Name, Brand, Goal and the
  Comms Calendar link.
- **But the week is already derivable.** MV messages carry dates through their Comms Calendar link
  (`Expert to Authority` → Sep 7–21, `Meditations & Manifesting` → Sep 1–6); VL messages through the
  `Live Date (from Videos)` lookup. Not in the handoff, and it is what unblocks the build (V2).
- **VL `Videos` `tblcqpctTr76RQsQT`** — 219 rows with a Live Date. The `Message of the week` link
  (`fldHHmhpYShR8BKH3`) and `Goal` lookup (`fldJgpePucy0D5X0a`) exist and resolve; exactly **one**
  asset is linked, to "test". `Published Link` is populated on published LinkedIn/YouTube.
  `24h Data` is **empty on every row**.
- **Correction to the handoff:** the last VL `Live Date` is **22 Sep**, not 19 Sep.
- **F9 — `Live Date` is missing on more than half the VL workflow, and the calendar cannot see any
  of it.** 219 rows have a Live Date; **221 do not**. Of the undated, **66 are already
  `7. Published`** — mostly `VL IG: Risevoice`, the agency source we cannot read yet. So a
  date-grouped calendar renders **none** of 66 live assets. This is the hard number behind the
  handoff's "Live Date has no owner" risk: it is not a tidiness problem, it is a third of published
  VL work being invisible. The "not dated" tray is therefore load-bearing, not a courtesy.

### Corrections to this plan's own earlier findings

- **F5 was wrong about which table dies.** It said to kill `Message of the week copy`
  (`tbl3NPxLDApiIyobS`). That table is now the **master** — do not delete it. The superseded one is
  `tblrxLMH2ncoLaHO5` (Ramya's 9 Sep table). **`lib/airtable/field-map.ts`'s `MESSAGE_OF_WEEK`
  currently points at the wrong table and must be repointed.**
- **F5's "`Brand` must become multiSelect" is reversed.** Single-select stays (change 3 above).
- **S3 is confirmed, not overridden** — one `MowWeek` row per brand per week was already right.
- Phase 0 item **0.3 is superseded**: do not "kill `Message of the week copy`". What remains true
  there is fixing the `Mindalley` spelling **in Airtable, never in app code**, and deleting the
  "test" row.

### Decisions taken on this revision

| # | Decision |
|---|---|
| **V1** | **Both the comms calendar and the Monday pack ship 14 Sep.** Planned as stated; the risk is in §7's scope note, not cut. |
| **V2** | **Derive the week now, and add `Week starting` anyway.** Group by the earliest linked date so the UI is testable today; still add the field so the join becomes exact. A message spanning several weeks (`Expert to Authority` covers three) renders in each with a "spans 3 weeks" marker rather than being guessed into one. |
| **V3** | **Repoint and keep the built pack layer.** `MowWeek` keyed `(weekStart, brand)`, `CommsDay`, the generator and the metrics ingest all survive. Three fixes: repoint `MESSAGE_OF_WEEK`, change `MessageOfWeek.brands String[]` → single `brand`, and join brand rows on the derived/actual week instead of the hardcoded `MOW_BRANDS`. |
| **V5** | **Two messages in one brand-week are clubbed, not de-duplicated.** The one covering more of the week leads it; the rest sit under it as `related`. Real case: `Expert to Authority` (6 days) leads w/c 7 Sep and `Jim Kwik (Mention Expert to Authority)` (Tue only) sits beneath it — they are a campaign message and a beat inside it, not rivals. Only an equal-coverage tie warns. The rule is **coverage, not name-matching**. |
| **V4** | **The comms calendar joins the existing design canvas** — new artboards on the same artifact, built from the live data above. One link, one design system. |

### New surface — `/studio/comms-calendar`

One route, `?brand=main|vl|mv`, three states via a segmented control. **Not** three routes.

- **Grain is the asset, grouped by date in the front end.** No day record anywhere, in either base.
- **Sources:** *Vishen's* → `Videos`, `Vishen's Newsletters`, `Clips` (once dated), `VL Podcast`.
  *Mindvalley* → the comms calendar + its linked Emails and Social. *Main* → both, two lanes per day,
  VL above MV.
- **Empty states are the feature, not a fallback.** Three, each worded differently: *no Live Date*
  (asset exists, undated), *no message committed*, *no goal set*. The gaps are what the meeting is
  about.
- **Never fill one brand's gap with the other's data** — that was Ramya's first reaction to v1.
- **Undated assets are never dropped** — a "not dated" tray with a count.
- **`COMMS_CALENDAR_BACKEND`** flag, default `airtable`, so the surface ships before the reconcile.
- **Read-only.** The portal proposes; humans commit in Airtable. MOW sync stays one-way into the VL
  base.

### Do not build (from the 10 Sep handoff §7)

A day-grain table in either base · an Airtable calendar view · two-way sync on the MOW table · a
replacement for Rafi's test scoreboard (link to it) · an asset library in the app · destination
inference twice — build it once and **run it on VL first**, where `Published Link` is populated and
the MOW link is clean, rather than MV's 96-of-8,546.

### The risk worth naming

Ramya is staying on as a **contractor**, and three of the four things this prototype needs sit with
her — the message population, the goals, the Live Date discipline and the agency workflow. That is
single-threaded through one person mid-transition. **`Live Date` has no owner at all** and is on the
critical path: the calendar renders empty and looks broken when the data is what is missing.

---

---

## 0B. Data readiness — audited against production, 10 Sep

"Do we have everything to pull the numbers and the insights?" **No — roughly a third of it.**
Queried against the live database, not inferred.

### Flowing today, unattended

| Source | State |
|---|---|
| **Hootsuite Perch → `social_metrics`** | **1,642 rows · 329 distinct posts · captured 27 Aug – 10 Sep, refreshed this morning.** App-held OAuth + nightly cron, so it needs nobody. |
| Coverage | Instagram 116 posts · Facebook 106 · TikTok 4. **10+ accounts**, so Glen's 63-account grant is reaching us. |
| Populated | `reach` 1,337 · `engagements` 1,321 · `engagement_rate` 1,337 · `clicks` 305 · `published_url` 1,190 · `platform_post_id` on all 1,642 |
| Tickets | 11,143 rows, fresh · DNA reviews 16, fresh · metric snapshot, fresh · 8 cron workflows scheduled |

### Missing, with the number attached

| Gap | Evidence |
|---|---|
| **View counts** | `views` on **16 of 1,642** rows, `impressions` on **0**. Posts show reach and engagement but no views. (Meta deprecated IG `impressions`; `views` is the survivor — Perch isn't returning it.) |
| **YouTube — entirely** | **Zero YouTube rows.** Glen's report is half YouTube: 7,942 meditation views, 10,994 on the stage talk, CTR against the 7% target, AVD, retention, subscriber lift. None of it exists in our pipeline. |
| **Ticket linkage** | `ticket_airtable_id` on **0 of 1,642**; `vishen_video_id` on 0. "How did *my* asset do" — Glen's specific ask — cannot be answered at all. 1,190 rows carry a URL, so the join is buildable. |
| **Revenue + leads** | No app-side Metabase client at all. Session-only (S6). |
| **Email** | No `📧 Sends` sync. No opens, CTR, CTOR, unsubscribes. |
| **24h read** | `24h Data` empty on every published VL asset — upstream, not ours. |
| **MOW tables** | `comms_days`, `messages_of_week`, `mow_weeks` all **0 rows** — `MOW_BACKEND` still `airtable`. One flag flip plus a reconcile. |

### The free win: campaign tags are already in our database

Perch's payload carries **Hootsuite tags** in `raw.details.tags`, and we store the payload but never
extract them: `Expert to Authority Summit 2026`, `Weekly Masterclass`, `MVU 2027`, `States`, plus
speaker tags (`Vishen`, `Regan Hillyer`, `Ken Honda`, `Paul McKenna`). **56 of 329 posts (17%)
carry at least one.**

This is the exact mechanism Glen's own dashboard groups by — *"on Hootsuite we tag a post depending
on the campaign… MCH August 2026"*. No integration, no credential, no upstream dependency: a column
and a backfill over rows we already hold. Coverage rises on its own as the team tags, and the number
is a concrete nudge to tag consistently.

### Composio — what it does and does not solve

Raised as the route for the numbers, and Glen offered to connect from his side. Being precise,
because it does not cover the YouTube metrics that matter most:

**It can fill:** IG **views** (the gap above — Composio's `INSTAGRAM_GET_IG_MEDIA_INSIGHTS` returns
`views`, `reach`, `saved`, shares, Reels watch-time), the other MV IG accounts, YouTube **views /
likes / comments / channel stats**, TikTok, and history older than Perch's window.

**It cannot fill the YouTube numbers Glen's report leans on.** CTR, AVD, retention and traffic-source
split come from the **YouTube Analytics API**, not the Data API that Composio wraps. Glen's own
handoff is explicit: *"Not available via the Data API at all… only enters the report when a human
pastes the Studio report text in."* So Vishen's fixed 7% CTR benchmark is **not** reachable through
Composio.

**And it cannot run unattended** — it is a claude.ai MCP connector, so no app code and no Kessel cron
can call it. Same constraint that put Metabase session-side (S6). Note the contrast with Perch, which
*does* run unattended because we hold our own OAuth refresh token via `ExternalCredential`.

Two further constraints: **no Hootsuite toolkit exists** in Composio (it is not a Perch replacement),
and IG needs **one OAuth connection per account** — roughly ten for MV.

### Decisions

| # | Decision |
|---|---|
| **W1** | **Extract the Hootsuite campaign tags now.** A column plus a backfill over stored rows. Smallest, most self-contained win available. |
| **W2** | **YouTube splits in two.** (a) views/likes/comments via **Composio**, session-side; (b) CTR / AVD / retention via the **YouTube Analytics API** with channel OAuth, app-side — this is plan item 0.9 and the only route to the 7% benchmark. It also unlocks E15's retention curve. |
| **W3** | **Composio rows route through the existing sink**, `ingestSocialMetrics` with `source: 'composio-ig'` / `'composio-yt'`. `dedupeKeyFor()` already keys on source, so Composio and Perch rows coexist per post. Delivered by the same scheduled agent as the Metabase figures (S6) — one session-side job, two sources. |
| **W4** | **Close the ticket join alongside YouTube.** 1,190 rows carry a URL and `📣 Social` already has the publish-link fields (F3); coverage depends on Glen filling them. |
| **W5** | **Both surfaces still ship Monday**, and **Glen hand-enters the YouTube figures for week one** into the editable blocks — as he does today. Every absent number stays labelled ("not filled", "no target set", "not connected"), never faked. |

---

## 1. Findings that change the briefs

Verified against the live base, the Metabase questions and this repo. **None are in
`MOW-HANDOFF.md` or `HANDOFF.md`.**

### F1 — `CommsCalendar` in this repo mirrors the wrong table

`prisma/schema.prisma:649` defines `CommsCalendar`, but
[lib/airtable/sync.ts:86](lib/airtable/sync.ts#L86) (`mapCommsCalendar`) populates it from
`COMMS_OFFICIAL_CAL` = **`📅 Official Cal` (`tbl3PkmIprAMhU4AI`)** — the campaign calendar, 31
fields, one row per project.

What MOW needs is **`🗓️ Comms Calendar` (`tblUUVMKdSrLVhTx8`)** — 75 fields, **one row per date**,
carrying `Date`, `Message of the week` (`fldsG98VipLb929E9`), `The Goal` (`fldq3xyH9EMuUuFup`),
`Phase`, `Initiative`, links to `📧 Emails`, `📣 Social All Assets`, `🖌️ Feature Banner`,
`🔔 Marketing Notifications`, plus targets/actuals (`Total Daily Revenue`, `TOTAL Target revenue`,
`Lead gen Goal`, `Landing Page sessions`, `Sales`). **Not synced into Postgres at all.** It is
`MowSlot`'s upstream. Do it first.

### F2 — Migration number in the brief is wrong

`MOW-HANDOFF.md` §4 says `0023_mow`. **`0023_asset_type_dna_upstream` already exists.** The MOW
migration is **`0024_mow`**.

### F3 — The publish-link join is unblocked from the app's side

`📣 Social` already has `Instagram Published Link` (`fldTVU4jMZW3JNswX`), `Final Published Link`
(`fldyP6817YNWfiMQR`), and `Creative Request` (`flddCgrgYAcBMFcs9`) with `Ticket Status` /
`Assigned Creative` / `🔗 Asset Link` lookups on the row. The E13.3 blocker in
`Context/portal-overview.md:268` ("96 of 8,546 posts ticket-linked; published-URL field effectively
empty") is a **data-entry gap, not a schema gap**.

### F4 — Email needs no Braze connector for Monday

`📧 Sends` (`tblYzLOjqNHmfuAMp`) already carries `Total Email Sends`, `Opens`, `OR`, `Clicks`,
`CTR`, `CTOR`, `Unique Unsubscribes`, `Unsubscribe rate`, `List Size` per send, linked to
`📧 Email` and `📯 Campaign`. Keep Braze for send *content* (image, copy, segment), which Sends
doesn't carry.

### F5 — Three Message-of-the-Week representations exist right now

`Message of the week` (`tblrxLMH2ncoLaHO5` — Ramya's, built 9 Sep) · `Message of the week copy`
(`tbl3NPxLDApiIyobS` — the one demoed) · plain-text `Message of the week` + `The Goal` columns on
`🗓️ Comms Calendar`, plus the stray `MV MOW TEST (DEL)` (`fldc6CL5Trm9R8kZT`). Thursday's 30
minutes collapses these to one. **Superseded by §0** — `tbl3NPxLDApiIyobS` is the master, `Brand` stays `singleSelect`, and `tblrxLMH2ncoLaHO5` is the table that dies.

### F6 — Two-way on `🗓️ Comms Calendar` means the writable subset, not 75 fields

You chose two-way for `CommsDay`. A constraint, not a preference: **Airtable rejects writes to
formula, rollup, lookup, `createdTime` and `lastModifiedTime` fields.** On this table that rules out
**31** of the 75 (verified by field type against the live base) — `Year`, `End Date`, `Name for Timeline`, `Weekday`, `Day`, `Name of comms`,
`Landing Page Conversion Rate %`, `Show Up Rate`, `SP CR`, `% Achieved Revenue`,
`Lead Gen Target Achieved %`, `FORMATTED DATA FOR AUTOMATION`, `Ad Spend`, every `(from …)` lookup,
`Created`, `Last Modified`.

So the push map covers the **44 genuinely writable fields**, and the ones that matter are all in
it: `Date`, `Message of the week`, `The Goal`, `Phase`, `Core Message`, `Internal Note`, `Score`,
`Target`, `Landing Page sessions`, `Sales`, `Total Daily Revenue`, `Attendees`, `SP Sessions`,
`No. of Emails`, and every link field. Everything else stays read-only because it physically must.
Say this in the UI rather than letting a silent write failure look like a sync bug.

### F7 — Post-level attribution

Explained in full in **§3**, because you asked and it needs more than a bullet.

### F8 — S2's lead target does not exist as a number

Decision S2 defaults a campaign week's headline to **leads against the campaign's own lead goal**.
Verified 2026-09-09: **there is no such number.** On `📅 Official Cal`, `Lead gen Goal`
(`fldQb61pVXu9aMHM3`), `TOTAL Target revenue` and `Actual revenue` are **all empty — including on
`recK9N1ignQfnmD5v`, the Expert to Authority Summit that is live this week.** The lookup onto the
comms calendar is therefore empty on every row.

The real target exists only as **prose** on the day rows' `The Goal`:

> "To achieve 35k leads to expert to authority summit"
> "To achieve 25k leads to expert to authority summit"
> "Launch Jim Kwik's podcast and scale to 50k views by next week"

Handled in `lib/mow/smart-number.ts` by resolving the target in priority order and carrying the
provenance with it: **`numeric`** (the lookup, once populated — the real fix) → **`inferred`**
(parsed from the prose, and the UI must label it as inferred and show the sentence beside it) →
**`none`** (prose only, no comparison, no % achieved). Nothing invents a denominator: a goal with
no parsable number renders "no target set", never `0`.

Added to Phase 0 as **0.11** — someone should populate `Lead gen Goal` on Official Cal, which
retires the inference entirely.

---

## 2. Metabase — how the pack gets its number

You're right that Metabase is linked (`https://claude.ai/directory/metabase`). I used it this
session — pulled 10,000 rows from question 31846 and profiled the UTM columns.

But that connector lives in **a Claude session**, not in the deployed app. The Kessel service has no
path to a claude.ai connector and `.env.example` has no `METABASE_*` entry. So "Metabase is
connected" is true for you and me, and not yet true for `mow-monday-pack` running unattended.

**Decided: session-side now, app-side later.**

- **Now.** A **scheduled cloud agent** (via the `/schedule` skill) runs Sunday night KL with the
  connector attached and `POST`s the figures into a bearer-guarded route
  (`POST /api/mow/metrics/ingest`, `lib/api/guard.ts`). No human in the loop, no new secret, no IT
  request — and it survives you being away, which is the point.
- **In parallel.** Request `METABASE_URL` + API key from IT anyway. When it lands, add
  `lib/metabase/client.ts` hard-allowlisted to questions **31846 / 32044** and swap the source
  underneath. **The page never changes.**

`MowWeek.smartNumber.source` records which path produced the figure (`session:metabase` vs
`app:metabase`), so provenance is on the page and in the audit trail from day one, and the swap is a
one-line change.

Honest caveat to hold: a scheduled agent is more robust than a person but still not the app. Don't
describe it as finished until the credential lands.

---

## 3. Post-level attribution, explained properly

You said you didn't follow this. From the top, no jargon.

### The question Vishen will ask

He looks at Monday's page, sees a reel, and says: *"How much money did that one make?"* Today the
honest answer is *"Instagram made $X across the MCH campaign"* — not per post. Glen is right about
today.

### Why it can't answer that today

Every post that drives revenue sends people to a Mindvalley landing page, which records where the
visitor came from by reading **UTM tags** off the URL. Those tags are what Metabase question 31846
stores. Measured over 10,000 rows (23 May – 9 Sep 2026):

| Tag | Distinct values | What it means today | Examples |
|---|---|---|---|
| `utm_campaign` | 154 | which campaign | `launch_mch_aug_2026`, `evergreen_pathway_be` |
| `utm_source` | 128 | channel + placement | `mv_ig_chatbot_feed`, `vl_youtube_th`, `mv_yt_description` |
| **`utm_content`** | **30** | *placement type only* | `chatbot_feed`, `broadcast`, `description`, `fb` |

Post ten reels in one campaign pointing at the same page and **all ten carry byte-identical UTMs.**
Metabase physically cannot tell them apart. That is the entire problem.

What the problem is **not**:
- Not a PixelMe problem. PixelMe shortens whatever URL you give it and preserves the query string on
  redirect. The UTM lives in the destination URL *before* shortening.
- Not an MCP problem. Nothing needs to read PixelMe programmatically.
- Not a company-level decision. Nothing about the shortener changes.

### The fix, in one sentence

**Make `utm_content` unique per post instead of per placement.**

It's already plumbed end to end — URL → landing page → Metabase → question 31846's output. It's
simply carrying low-value information. Change what goes in it:

```
post → utm_content=rec5Kq2LmN8xYz   (the 📣 Social row's own record id)
     → landing page records it
     → Metabase 31846/32044 group leads + revenue by utm_content
     → portal joins utm_content → 📣 Social row → Creative Request → editor
```

Both ends of that chain already exist. Only the tag in the middle is missing. Nothing gets built,
nothing gets bought.

### What it costs

1. **Generating the tag: free — decided, an Airtable formula on the `📣 Social` row.** It emits the
   complete tagged URL from the row's own record id, so there's no convention to remember, nothing
   to mistype, no AI in the loop. It sits beside `Instagram Published Link`, where the poster is
   already looking.
2. **Using it: one copy-paste per post.** The composer copies the *tagged* URL instead of the plain
   one — the same moment Glen is already being asked to paste the publish link back. That's the only
   real cost.
3. **Confirming the data side: one conversation.** `utm_content` goes from 30 values to thousands.
   Rafi's side should confirm nothing downstream chokes. Expect it to be fine — `utm_source` already
   carries 128 — but ask, don't assume.

### The ceilings that remain

- **ManyChat — checked, and it's a minority.** For "comment WORD for the link" posts the visitor
  never clicks a caption link; ManyChat DMs them one, and a fixed link per funnel loses per-post
  attribution regardless of `utm_content`. **You've confirmed most CTA traffic is links**, so
  coverage is good. The ManyChat slice stays campaign-level via `Manychat Funnels Tracker`
  (`tblw4266Slyd5RpgI` — `Trigger Word`, `Channel`, `Link to CTA`) and should be **labelled
  campaign-level on those specific posts**, not shown blank. Because it's the minority, this work
  moves **out of Phase 4 and into Phase 2** — the cheapest large win after Monday.
- **Link-free posts never attribute.** Pure-awareness reels only ever show reach and engagement.
  Correct, not a gap.
- **Numbers keep moving.** Organic pickup weeks later still credits the original post — the
  behaviour Glen described for Marwa's meditations, and right. A post's revenue is never final, so
  the page shows "as of".
- **Attribution, not causation.** Revenue describes a whole clip; it doesn't say which edit decision
  caused it. That's §5.

### How this relates to handoff D2

D2 says destinations are **inferred** by parsing send/post URLs → UTM → matched to a known `Offer`.
Correct and complementary — but it resolves to **which offer**, not **which post**:

- **D2 (inference)** answers *"where did this asset point?"* — works today, no behaviour change.
- **F7 (`utm_content` per post)** answers *"which asset earned it?"* — needs the copy-paste.

Build D2 first as the handoff says. F7 makes `DestinationLink` resolve to one row instead of a set.

---

## 4. Decisions settled this session

These **override** `MOW-HANDOFF.md` where they conflict.

| # | Decision | Overrides |
|---|---|---|
| **S1** | **Headline smart number is configurable per week** — one value, not a set. | — |
| **S2** | **Campaign weeks default the headline to leads**, against the campaign's own lead goal (35k for Expert to Authority this week). Revenue becomes a driver. Detect a live campaign from `CommsDay` → `📅 Official Cal` / `Initiative`. Non-campaign weeks default from the primary `Offer`. | refines D3 |
| **S3** | **Two parallel MOWs, one per brand.** `MowWeek` is keyed on **(weekStart, brand)** — MV and VL each get their own message, goal and smart number, as Ramya described Marisha wanting. A third brand is just another row. | **overrides D9's "default one"** |
| **S4** | **MOW record owner: any of Gareth, Glen or Ramya may commit.** `committedBy` against a named allowlist; show who committed on the page. | closes open #2 |
| **S5** | **Metabase is revenue truth** (31846 / 32044). Braze appears only labelled **"engaged revenue"**, never in the smart-number slot. Confirm with Rafi *after* Monday, not before. | closes open #3, confirms D4 |
| **S6** | **Metabase: scheduled-cloud-agent ingest now, app-side credential later** (§2). | — |
| **S7** | **`utm_content` per post via an Airtable formula on `📣 Social`** (§3). ManyChat is a minority → **promoted to Phase 2.** | new |
| **S8** | **MOW *and* CommsDay are two-way**, PG system-of-record with outbox drain — on the **writable field subset** (F6). | resolves D9's ambiguity |
| **S9** | **Monday ships: Pack + Week at a glance + My assets.** Learning library and Experiments follow w/c 15 Sep. | confirms §8 |
| **S10** | **The pack lives at `/performance/week`** + a summary card on `/studio`. `/studio` is founder+admin-gated (`lib/studio/guard.ts:8`); Glen, Gareth, Ramya and editors all need to read and edit. | — |
| **S11** | **Delivery is both** — pack on the page, summary to Slack with the headline number, blockers and a link. Reuse the existing best-effort notifier; never make a commit depend on Slack. | confirms §5 |
| **S12** | **Glen's report is absorbed into `/social`, three tabs: Manage · Performance · Clips.** The existing clip engine moves to `/social/clips` unchanged. **Both new tabs ship Monday.** | new |
| **S13** | **Manage = the board** (planned vs released, publish links to fill, campaign tags, missing-data nudges). **Performance = the numbers** (campaign leads/revenue via Hootsuite tag × Metabase UTM, top assets, per-platform, per-account reach). Manage is where work happens; Performance is where it's judged. | new |
| **S14** | **`/social` write access = a named allowlist in settings, admin-editable**, following `lib/studio/access.ts`. Everyone else read-only. | new |
| **S15** | **Dry run: Gareth, Sunday, async** — send him the generated 1–6 Sep pack and ask one question: could this meeting have run in 30 minutes? | confirms §8 |
| **S16** | **Lever → owner is manual for 14 Sep** (free text on the pack). Decide E10's build window after the dry run. | confirms D5, defers open #7 |
| **S17** | **Platform comms = labelled empty state**, no manual entry. Its visible absence is what gets Sadaf's source prioritised. | refines the brief §6 |
| **S18** | **E14 Phase 0 held until after Friday's Rafi 1:1.** He's exploring AI banner tooling independently; seeding a taxonomy he then works around costs more than a week. | new |
| **S19** | **Clip Farm → `/prd` first**, as proposed epic **E15**, after Monday. The Descript-MCP recut spike is PRD input (§5). | new |
| **S20** | **Matt's ads automation runs the moment his view lands**, even if that's Thursday. ~2h, fully specced, keeps a same-day commitment. | new |
| **S21** | **Nothing gives — push through.** Planned as stated; risk flagged in §7, not pre-emptively cut. | — |
| **U1** | **New semantic token `--mv-staged`** for staged-vs-committed. Gold stays for the commit bar alone — "if two things are gold, neither reads as urgent". Fold into `DESIGN_SYSTEM.md` §3 in the same commit. | new |
| **U2** | **One page + Meeting-mode toggle**, not the prototype's separate pack and glance views (they shared ~70% of their content). | overrides prototype |
| **U3** | **Blocker-first card on `/studio`** — what's waiting on Vishen, loudest; then the message and the one number; then a link through. | new |
| **U4** | **Day-by-day is seven table rows, expanding into Glen's full card.** Summary on top, analysis one click down. | reconciles the two artifacts |
| **U5** | **`MOW = this week` · `/social` Performance = across time.** Same tables, different grain. | new |
| **U6** | **`/performance/week/assets` lists every owner's assets**, grouped by owner — no personalisation; it doubles as the meeting roll-up. | overrides prototype |
| **U7** | **Learnings: cap the display, not the data.** Store all committed, render top five by rank, rest behind "show all". | refines the brief's ≤5 |
| **U8** | **A thin week shows the plan, names the gap, and attributes it** — `no publish link recorded · Glen`. Never a zero, never a blank. | new |

### S1's guardrail

A metric that changes weekly risks reproducing the exact *"too many numbers, unclear meaning"*
complaint. Four requirements prevent that:

- **Exactly one headline, enforced.** `smartNumber` is a single `{key, label, value, target, source}`
  — not an array. The picker is a radio, never a multi-select.
- **The others are demoted, not dropped.** `drivers[]` carries the rest, rendered smaller.
- **It defaults, it doesn't ask.** Campaign week → leads (S2); otherwise from the primary `Offer`. A
  human overrides and is never shown a blank choice.
- **Label and source render next to the figure**, so a week-over-week metric change is visible rather
  than silent.

### Still open (do not block; build so either answer works)

Smart number per destination — **Vishen**, before 14 Sep · Composio service account —
**Glen · Shaku** · Platform comms source — **Sadaf** · E10 build window — **Rhythm, after the dry
run** · E14's five decisions — **HANDOFF §7 owners**.

### The attribution ceiling, said out loud before Monday

- **Campaign level — real today.** Hootsuite tag (`MCH Aug 2026`) × Metabase UTM
  (`launch_mch_aug_2026`) → leads + revenue. Glen built this.
- **Asset level — trend, not attribution.** Glen's framing for Marwa is right: four meditations
  released, pickup curve, which assets carried the views. Not "this link earned $X".
- **Post level — achievable, not by Monday** (§3).

Vishen will read "revenue" next to a post as post-level revenue unless told otherwise. Put the
qualifier in the UI next to the figure, not only in the meeting.

---

## 5. The Self-Improving Clip Farm — evaluation

**What it is.** Angus Sewell's guide (13pp, 8 Sep 2026). A creator-scale loop: a local agent directs
edits through **Descript MCP** → you post to TikTok **manually** (he's explicit that API uploads get
flagged) → a **local Playwright collector** captures saves + per-second retention into Postgres →
the agent joins retention drops **to the words spoken at those timestamps** → it **re-cuts, changing
one variable per version**, preserving `parent_clip_id` → repost → compare child against parent →
mark winners `selected_for_distribution` → push winners to Reels/Shorts/LinkedIn. Seven skills:
`clipfarm-editor` → `-posts` → `-collect` → `-analyze` → `-recut` → `-retest` → `-distribute`.

### What we already have

| Clip-farm step | Us today | Gap |
|---|---|---|
| Make ten clips | **E8 clip engine** — transcript → strategy → scored clips → tickets | We stop at *suggestion*; a human edits |
| Agent-directed editing | **E12** (Remotion + EDL brain), scaffolded | Never piloted end to end |
| Post manually | Reality already (Glen, Simplex, agencies) | — aligns with propose-only |
| Collect analytics | **`SocialMetric`** + nightly Perch pull | **No retention curve** — views/reach/engagements only |
| Analyze | **Clip learning loop** (`ClipRule`, Tier 1 + 2) | Steers the *next* clip, never re-cuts *this* one |
| Re-cut | — | **Missing entirely** |
| Distribute winners | — | **Missing entirely** |

Further along than the guide on ingestion, taxonomy, tickets and governance. Behind on exactly two
things.

### The two ideas worth stealing

**1. Variant lineage — `parentClipId` + one changed variable.** The real insight, and almost free.
Our loop learns a *rule* that steers the next clip; it never produces **version 2 of the same clip
with one thing changed** and compares them. Add `parentClipId`, `hypothesis`,
`selectedForDistribution` to `ClipSuggestion` and "hook A vs hook B on the same idea" becomes
answerable — every DNA rule gets evidence instead of assertion.

**2. Retention curve joined to the transcript at the timestamp.** *"Put notable drops beside the
words spoken at those times."* The highest-value analytical move in the document and the only one an
editor can act on. We hold the transcript with timecodes (`ContentSource.transcript`,
`ClipSuggestion.timecode`); we do **not** hold the curve. It comes from the **YouTube Analytics API**
(`audienceRetention`) — Perch doesn't expose it, and Glen's own handoff says YouTube CTR/AVD/retention
is *"manual-paste only"* today. **Same credential unlocks MOW's day-cards and this** (item 0.9).

### What does *not* transfer

- **The local Playwright TikTok collector.** Needs a logged-in browser on one laptop, stores a HAR
  that must never be shared, breaks on any challenge or logout. We have a deployed app, an app-held
  Perch token and 63 connected accounts. Adopting it would fail exactly the resilience test Vishen
  set. **Take the schema idea — `metrics` + `metric_snapshots`, latest vs history — not the
  collector.**
- **Railway Postgres** (we have Kessel) · **TikTok as primary** (MV is IG + YouTube) · **"post
  manually because APIs get flagged"** (true for a solo creator; our manual posting is an org fact,
  not a safety measure).

### The convergence nobody has connected

The guide's editing layer runs on **Descript MCP**. Separately, **Matt and Titus are exploring
editing entirely inside Descript**. Separately again, **E12 chose Remotion** and has never shipped a
pilot. Three independent bets on one problem — and Descript-via-MCP has a real advantage for the
*recut* loop: no render service, no EDL brain, no Dropbox/Replay resolution, and it's the tool
editors already use.

### Decided: PRD first

**Run `/prd` over the PDF plus the existing clip engine before any code** — proposed epic **E15 ·
Clip variant loop** (`E14` and `E15` are both free in `prd/index.md`). Right call: E8 shipped ahead
of its PRD and still sits at "discovery"; E12 was scaffolded without a piloted decision and never
shipped. What the PRD must resolve:

1. **Variant lineage** — does a recut become a new `ClipSuggestion`, a new `Ticket`, or both, and
   does the E13 DNA lock apply to a child?
2. **Retention curve** — YouTube Analytics → `retentionCurve` Json on `SocialMetric`. Shared with
   MOW, so **request the credential regardless of whether E15 is ever built.**
3. **The transcript join** — needs verified `source_segments` (edited in/out ↔ original in/out);
   today that's free text in `ClipSuggestion.timecode`.
4. **Descript-MCP vs Remotion** — carry a real comparison, not a preference. **Run one Descript-MCP
   recut against a real Vishen clip as PRD input.** A day's work that could retire an epic.
5. **Who reviews a machine recut** — and propose-only must hold.

---

## 6. The MOW dashboards — design spec

Built from three inputs, each contributing a different thing:

| Input | Contributes | Do NOT take |
|---|---|---|
| `mow-prototype.html` | **Information architecture** — pack-first, staged→committed, learnings attributed to the lever owner, per-slot briefs | Its styling. It uses `Fraunces` serif, `#FBFAF8` cream, `--radius:14px`, light-only. The repo mandates Plus Jakarta Sans, `bg-bg-muted`, 8/12/16px radii, dark-mode first-class. The handoff itself says match the **information hierarchy, not the markup**. |
| `message-of-the-week.html` (Glen's real report) | **Analytical depth** — planned-vs-actual per day, per-platform splits, CTR against the fixed 7% target, What's working / Needs attention / Recommendations, sentiment with real quotes | Its density on the first screen (see the governing principle below) |
| Ramya's inputs (transcript + `📧 Sends`) | **The email + test dimension** — her result metric is *active users gained per week*, not opens or CTR; email needs a link out to Rafi's live test scoreboard; email and social on the same day are deliberately different messages sharing a destination | — |

### The governing principle

**Vishen's complaint was density, not absence.** Glen's report puts roughly 60 numbers on one
screen; the feedback was *"there are too many numbers, I'm not clear what this means."* So:

> **The first screen is about five numbers and five sentences. Everything else is one click down.**

The brief says the same thing — *"the summary layer sits on top of the raw numbers; the detail is
one click down, never on the first screen."* Nothing analytical is deleted; it moves.

### Surfaces

| Route | Who | What |
|---|---|---|
| `/performance/week` | everyone on the content team | **The pack.** One page, with a **Meeting mode** toggle (U2) that collapses prose and enlarges the day table + smart number for screen-sharing. Replaces the prototype's two separate pack/glance views — they shared ~70% of their content and would have had to be kept in agreement. |
| `/performance/week/assets` | everyone | **All owners' assets** for the week (U6), grouped by owner. No personalisation — it doubles as the meeting's roll-up. |
| `/studio` | Vishen | **Blocker-first card** (U3) at the top: what's waiting on *him*, then the week's message and the one number, then a link through. He's logging into these portals daily right now — ride that. |
| `/social` · Manage · Performance · Clips | Glen, Vidura, allowlist | **`MOW = this week · /social = across time`** (U5). Same tables, different grain: MOW answers "how did week 37 go"; `/social` Performance answers "how is social doing" — campaign-to-date, month, per-account trend, top assets across weeks. No shared week component, no contradiction. |

### `/performance/week` anatomy, top to bottom

1. **Masthead** — `Week 37 · 7–13 September`, generated-at, `N items to commit`, Meeting-mode toggle.
2. **Brand cards, side by side — MV | VL.** Two `MowWeek` rows (S3), each with its message, goal and owner.
3. **THE smart number**, one per brand-week. Label + value + target + **provenance** + source + `as of`.
   A single object, never an array (S1). Drivers render smaller beneath.
4. **Day table, Mon→Sun — seven rows** (U4): day · planned pillar · what shipped · owner · status pill ·
   one line of learning. **Click a row to expand into Glen's card**: per-platform numbers, the CTR
   gauge, and What's working / Needs attention / Recommendations.
5. **Learnings** — every committed learning is stored, the top five by rank render, the rest sit
   behind "show all" (U7). Each carries its **lever → owner** (retention → editor, thumbnail CTR →
   packaging owner, destination click-through → message owner).
6. **Blockers, separate from misses** — upstream, shown so they don't read as editor problems.
7. **Per-owner blocks** — What's working / Needs attention / **What I'm improving in my next upload**
   (Glen's specific ask). Editable only by the named owner or a committer.
8. **Commit bar** — the single gold element on the page.

### Status vocabulary — five states, and `blocked ≠ missed`

The brief is explicit that these are two different things with two colours. Via `Badge` tones:

| State | Tone | Means |
|---|---|---|
| `planned` | neutral | scheduled, not yet due |
| `shipped` / on plan | success | went out as planned |
| `off-plan` | info | something went out, but not the planned pillar |
| `missed` | danger | we didn't ship it (Glen's Friday: *"nothing published at all — not even a substitute"*) |
| `blocked` | warning | **upstream** — no speaker list, content not recorded. Not the editor's failure. |

### One new design token: `--mv-staged`

Staged-vs-committed is the most important novel pattern here — it is the guardrail Glen demanded,
and a staged number that looks committed is worse than no number at all.

But gold is **attention-only** and *"if two things are gold, neither reads as urgent"* — and a pack
has a staged smart number, ~5 staged learnings and N staged briefs. So (U1) add a dedicated
semantic pair to `app/globals.css`: **`--mv-staged` / `-soft` / `-content`**, dark-inverted like
every other token. Gold stays for the commit bar alone.

This is reusable, not a one-off: the DNA review (E13) already has staged findings that currently
borrow warning tones. **Fold the new token into `DESIGN_SYSTEM.md` §3 in the same commit** — the
living-rulebook rule in `CLAUDE.md` requires design decisions not to live only in chat.

### Components — reuse first

**Reuse:** `Kpi`/`KpiGrid`, `MetricCard`/`MetricGrid`, `InsightCard` (its `good`/`warn` tones map
exactly onto What's working / Needs attention), `Badge`, `Sparkline`, `BriefText`, `AppShell`,
`DetailDrawer`, `components/ui/table/*`.

**Genuinely new, and each belongs in `components/ui/` because more than one surface needs it:**

- **`TargetGauge`** — a value against a *fixed* target (CTR vs Vishen's 7%, leads vs the week's
  goal). Must render all three provenances from `lib/mow/smart-number.ts`: `numeric` → `of 35,000`;
  `inferred` → `of ~35,000` plus the prose sentence it was parsed from; `none` → **"no target set"**,
  never a 0% bar.
- **`StagedBlock`** — the staged/committed wrapper: dashed rule + `Staged` badge + `drafted Mon
  08:00` when staged; solid rule + `Committed by Glen` when committed.
- **`DayRow` / `DayDetail`** — the row and its expansion (MOW-specific, so `components/mow/`).

### Data honesty, encoded in the UI rather than remembered

Each of these is a lesson someone already paid for:

- **Braze is "engaged revenue"** — labelled everywhere, never in the headline slot (S5).
- **An inferred target shows as `~`** with its prose sentence available (F8).
- **`as of` on every revenue figure** — late attribution drifts figures upward, so none is final.
- **Sentiment is account-wide, not per-post** — Hootsuite's feed carries no post linkage. Label it.
- **Carousel "views" are slide-swipes**, not rewatches — never compared to a Reel's ratio.
- **The 6,000-vs-1,579 session gap** renders as an `unreconciled` badge, not a number.
- **Weekday is UTC calendar day** — the assumption that once *"moved 3 posts to different days"*.
- **A missing thumbnail is not a broken image** — hatched placeholder plus the reason
  ("composed on a partner account, no Hootsuite record").
- **Missing delivered data names the gap and its owner** (U8) — `no publish link recorded · Glen` —
  so a thin week reads as an action item, not as a broken tool. The planned skeleton always renders
  from the comms calendar, which does have rows.

### The shareable design canvas (for Claude Design)

A multi-artboard canvas, published as an Artifact running Claude Design's editor, so the UI can be
refined visually before it is built in React. Working files live in
`context/mockups/mow-canvas/`; every change re-seeds from them.

**Authored (on disk):**

| Artboard | Frame | What it shows |
|---|---|---|
| `Main.dc.html` | 1440×2160 | The pack. Working controls: Meeting-mode toggle, and click-a-day-row to expand into Glen's full read (per-platform stats, CTR gauge, working / attention / recommendations). |
| `StudioCard.dc.html` | 1000×760 | Vishen's blocker-first card — what's waiting on him, then the message, then the one number per brand. |
| `Assets.dc.html` | 1440×1320 | Every owner's released work with its 24-hour read, grouped by owner. Carries the mandated 5-column header, because it *is* a ticket list. |

**Still to author:** `System.dc.html` (the token + component sheet — the proposed `--mv-staged`
swatches, the five status states, `TargetGauge` in all three provenances, and the honesty
affordances) and `canvas.json` (layout + a `System` page). Then seed, check and publish.

**Everything is real data, deliberately.** The week of 7–13 Sep and its brand messages come from the
live comms calendar; last week's day-by-day numbers are Glen's actual report (91.7K IG on Regan's
Reel, 4.3%/5.1% CTR against the 7% target, the real Friday miss); the 18,240-of-~35,000 headline
shows F8's inferred target with the prose it was parsed from. No invented figures — a mock with
plausible-looking numbers is exactly how a design gets approved and then can't be built.

**Values are lifted, not approximated** — every hex, radius, shadow and type size comes from
`app/globals.css` (`#572280`, `#faf9fc`, `rgba(40,20,60,.12)`, 8/12/16px, the `.kpi` 29px/700
tabular numeral, the `table.list` 11.5px uppercase header). The one new value is the proposed
`--mv-staged` (`#7b6ea8` / `#4b4173` / `#f2f0f9`), offered as a tweak so alternatives can be tried
on the canvas.


### The comms-calendar prototype (V4) — six artboards

Authored onto the **same canvas** as the MOW pack, from the live data above. Settled shape:
**week grain with a month zoom-out**, and a **collapsed "not dated" bar under the grid** whose
count is the nag (F9 makes that count 221, with 66 published).

| Artboard | Frame | Shows |
|---|---|---|
| `CalMain` | 1440×980 | Both lanes, week of 7–13 Sep, real assets. VL above, MV below, per the handoff. |
| `CalVishen` | 1440×900 | VL only — **as it renders today**: one message named "test", one linked asset, and the rest empty. This is the artboard that makes the data problem undeniable. |
| `CalMindvalley` | 1440×900 | MV only — the populated case, so the contrast with `CalVishen` is visible side by side. |
| `CalMonth` | 1440×1040 | The zoom-out. September, where content stops after 22 Sep — the gap a week view hides. |
| `CalEmpty` | 1440×560 | The three empty states side by side, each worded differently: *no Live Date* · *no message committed* · *no goal set*. |
| `CalAsset` | 900×880 | The asset detail — message, goal (lookup, blank today), brand, Live Date, medium/channel, status, source, owner, 24h read, published link. Plus same-message siblings. |

**Real data it renders** (verified live, so the prototype cannot flatter the state of things):

- **VL week:** Mon 7 *A mentor once stopped me mid-sentence* · Tue 8 *Vishen × Jim Kwik* (YouTube,
  published) + *(IG repurpose) MVU Reel* · Wed 9 *Killer whale grandmother* + *Being good at what you
  do* · Thu 10 *I visualised the trophy for years* (the one asset linked to "test") · Fri–Sun nothing.
- **MV week:** Mon 7 *Email 1 — Summit Announcement* + 5 social · Tue 8 five social · Wed 9
  *Vishen's Newsletter* + 3 social · Thu 10 *Email 2 — Vishen's Story* + 6 social · Fri 11 three
  social · Sat/Sun *No Email Day*.
- **Week header:** MV → *Expert to Authority*, goal **not set**; VL → **no message committed**.
  Never borrowed from the other brand.

**Two things the prototype must not do**, both from the handoff and both easy to get wrong:
fill VL's gap with MV's records, and render an empty `24h Data` as `0` rather than "not filled".

### Exporting the artboards as plain HTML for Claude Design

**Why this is a build and not a copy.** The artboards are Design Component format —
`<x-dc>`, `<helmet>`, `{{handlebars}}`, `sc-for` / `sc-if`, and a `class Component extends DCLogic`
that supplies the data. Open one in a browser or paste it anywhere else and it renders nothing.
The canvas artifact also cannot be handed to claude.ai/design directly: import/export between
this preview and claude.ai/design is not a thing the preview does. So the practical route is
**flattening the artboards to standalone HTML** that opens anywhere and can be attached to a
design conversation.

**Deliverable:** ten self-contained files in `context/mockups/mow-canvas/export/`, one per
artboard (`CalMain.html`, `CalVishen.html`, … `MowPack.html`), each with its CSS inlined and its
data baked in.

**The transpiler** — `context/mockups/mow-canvas/build-export.mjs`, run with `node`:

1. Parse `data-props` for prop defaults → `this.props`.
2. Execute the `Component` class in Node against a tiny `DCLogic` shim to get `renderVals()` and
   any initial `this.state`.
3. Expand the template: `{{ dotted.paths }}` in text *and* attribute position, `sc-for` (82 uses),
   `sc-if` (42).
4. Hoist `<helmet>` contents into a real `<head>`; drop `support.js`.
5. Emit a `<header>` carrying the context (below), then the flattened body.

**Interactivity survives** rather than being flattened. Only `Main.dc.html` has state (the
Meeting-mode prop and the open-day). The expander takes a set of hole-paths to force truthy —
`showProse` and `d.open` — so every day's detail block is emitted, marked with a
`data-toggle` attribute and hidden; a ~25-line vanilla-JS footer wires the toggle and the row
expansion. No dependencies, works from `file://`.

**Each file carries its constraints, open questions and data findings**, because Claude Design
will otherwise "improve" the things that are deliberate:

- **Tokens**, as exact values from `app/globals.css` — not approximations to re-derive.
- **The non-negotiables**: gold is attention-only (one element per page); `blocked` ≠ `missed`;
  never a zero (an empty `24h Data` reads "not filled", an empty denominator renders blank);
  never borrow one brand's message or goal to fill the other's gap; the three empty states are the
  feature, not a fallback.
- **The data findings** that explain why the views look sparse: 221 VL assets undated against 219
  dated with 66 of the undated already published (F9); `Goal` empty on all 6 real MOW records;
  the live `Mindalley` misspelling; the `test` row; nothing dated past 22 Sep.
- **What is still open** — the three questions pinned on each canvas page.

**Re-runnable.** The `.dc.html` artboards stay the source of truth; the export is generated, so a
canvas edit and a re-run keep the two in step. Never hand-edit a file under `export/`.

### The 5-column mandate does not apply to day cards

`DESIGN_SYSTEM.md` §0.3 mandates Title · Priority · Assigned · Ticket Status · Priority Status as
the first five columns of every **list/table view**. The day-by-day table is a calendar, not a
ticket list, so it is out of scope — stated here so nobody "fixes" it later.
`/performance/week/assets` *does* list tickets, and complies.

---

## 6B. The design handoff — authoritative for all UI

Claude Design returned a full pass on 10 Sep:
`Sep Calls/10 Sep/design_handoff_comms_calendar/` — `README.md` (the spec),
`Comms Calendar - Hierarchy.dc.html` (twelve artboards), `screenshots/`, and
`reference_export/` (my pre-redesign exports, for comparison).

**It supersedes §6's visual detail.** §6 remains right about *what* the surfaces are and why;
the handoff is right about *how they look*. Where they differ, the handoff wins.

### Decisions

| # | Decision |
|---|---|
| **X1** | **Week calendar is `1a` — day-rows, two brand columns.** Days are rows, brands are columns. Titles get 13px on one or two lines instead of 11.5px on five; nothing truncates; the "+5 social" collapse can be dropped in the Vishen lane. Week becomes a schedule, Month keeps the calendar shape — a deliberate split, not an inconsistency. |
| **X2** | **Build the component sheet (`3a`) first.** The handoff is emphatic that the recurring faults are *component* problems appearing as page problems, which is why the same four recurred on every surface. Everything else assembles from it. |
| **X3** | **Lane weighting is `6c` option C** — equal lanes, volume declared by a 6px bar in the lane header. Sizing the lanes 6fr/21fr would say Vishen's brand *matters less*, which is the opposite of the point, and the grid would reflow weekly so nothing is comparable. |
| **X4** | **Everything ships thin on Monday** — the full seven-step order attempted. Planned as stated; risk in the note below rather than pre-emptively cut. |

### The four faults it found in what I shipped — fold into `3a` (X5)

All four are component-level, which is exactly the handoff's argument:

1. **A real rendering bug.** My exported pack wraps `<tr>` in `<div data-toggle="open">` inside
   `<tbody>`. Browsers hoist the div out of the table, so **the expanded day reads never rendered
   where the markup implied.** `2a` replaces it with a CSS grid and a `grid-column:1 / -1`
   expansion row. My `build-export.mjs` has the same bug.
2. **VL is purple on two surfaces.** Teal on the calendar, Mindvalley purple on `/performance/week`
   and Vishen's card — where the two brand pills were byte-identical. The two-lane argument
   collapses the moment you leave the calendar. `vishen-*` tokens everywhere a VL entity is named.
3. **Eleven empty-state phrasings** across five files for three conditions. Collapses to **nine
   canonical strings in two tiers**: tier 1 names who closes it, tier 2 is "this is fine" and must
   not look like a gap. Never a dashed box in light mode — it reads as a component that failed.
4. **Three literal-zero violations I shipped** — `0 Posts` at 22px, a full progress track with a
   target marker at 0% fill, and `width:0px` month bars with blank labels. All three break the rule
   §6 states.

### Tooling decision: no PRD, no build skill, no sprint (10 Sep)

Asked whether `/prd`, `/build-feature` or `/sprint` should plan this. **None of them.**

- **`/prd` — no.** The design handoff already *is* the spec: exact tokens, twelve artboards, a
  build order, and its own definition-of-done checklist. `MOW-HANDOFF-10SEP.md` covers the data
  model and jobs. Writing a PRD now spends the remaining build time producing a fourth document
  that restates three existing ones. Revisit for **E15** (clip variant loop), where it *is* the
  right call — that epic has no spec at all.
- **`/build-feature` — no.** Verified: its frontmatter allows only `pnpm turbo build`,
  `pnpm --filter *`, and its body targets `apps/api` (9×), `apps/web`, `apps/admin`,
  `packages/ui`. This repo is npm, single Next.js app, no workspaces. It would fight the repo at
  every step.
- **`/sprint` — not a planning skill.** It is a git workflow wrapper (branch / commit / PR). It
  does point at a real risk though, below.

Neither skill is registered anyway — `skills/` holds the markdown but there is no `.claude/skills/`,
so both would be manual reads rather than slash commands.

**The real risk `/sprint` surfaces: 25 uncommitted files sitting on `main`.** Schema changes, three
applied migrations, the new component layer, `DESIGN_SYSTEM.md`. This repo has a precedent — a
manual `kessel deploy` builds from **local disk**, and a dirty tree shipped uncommitted WIP and
caused an outage on 2026-08-31. Commit before the next deploy, on a branch rather than `main`.

### Remaining build order — the working checklist

| # | Artboard | Surface | State |
|---|---|---|---|
| 1 | `3a` | Component layer + tokens + `/settings/components` | ✅ **done** |
| 2 | `6a` | Dark theme — role values over the same components | ✅ **done** (incl. the real contrast bug) |
| 3 | `1a` | Week calendar, three brand states, `/studio/comms-calendar` | ✅ **done** — `08413a4` |
| 3b | — | **Reader correctness fix** (§6C) | ✅ **done** — `a86b6eb`, verified live |
| 4 | `2a` | Monday pack at `/performance/week` | ✅ **read layer done** — `da7d00a`. Commit bar + learnings still to come |
| 5 | `5a` `5b` | Month · asset detail | ✅ **done** — `49cd7a1`, rendered against live data |
| 5b | — | **Data-flow audit + `npm run doctor`** (§6D) | ✅ **done** — `4b869a1`. 294 ids, 0 errors, 1 warning |
| 6 | `4a` `5c` | Assets table · Vishen's card | ✅ **done** — `bb26776` |
| 7 | `6b` | Not-dated tray | ✅ **done** — data existed after all; 204 assets listed |

Definition of done is the handoff's own checklist — no literal `0` anywhere, at most one gold
element per screen, red only on `missed`, VL teal on every surface, nine canonical empty strings,
every tier-1 gap naming an owner, undated assets reachable from every view, both themes passing
contrast, and paging past 22 Sep stating the boundary.

### A third data state the design names, which the schema should carry

`test` and `vcvdsv` are **neither filled nor empty** — present but meaningless. They render as the
real value plus a `placeholder value` chip and one line of explanation. **Never rewrite the value.**
Same for the `Mindalley` misspelling (`misspelled upstream`) and the channel value `Soc` sitting in
a Priority field. This matches the code rule already in `lib/mow/derive-week.ts`: recognise, never
normalise.

> **Scope note.** Four surfaces plus a component layer, a dark theme and a tray, in three days,
> alongside Friday's Rafi meeting and the Sunday dry run. Planned as stated (X4). If something does
> not land I would expect it to be `6b` the tray (it needs Airtable rows that don't exist yet) and
> `6a` dark mode. The two I would protect are `3a` and `1a`: the component sheet because skipping it
> reintroduces all four faults per page, and the calendar because it is the only surface whose data
> is real and whose owner is seeding it tomorrow.

---

## 6C. The first live run — three defects, and the reordered build

### Context

`1a` shipped verified against real record *shapes* but never against the live API — there was no
token locally. Given one on 10 Sep, the reader was run once against the live bases. It **worked**:
all 14 field references resolved, both lanes populated, no crash, no fabricated zero. It also
exposed three defects that shape-based tests structurally could not catch, because every one of
them is about **choosing between multiple real rows** rather than about parsing one.

All three share a root cause worth stating plainly: **the calendar reader reimplemented what
`resolveBrandsForWeek()` ([lib/mow/pack.ts:76](lib/mow/pack.ts#L76)) already solves.** The V5
coverage rule is built, tested and correct. `assembleWeek()` just isn't calling it.

| # | Live data | What the reader displayed | Why |
|---|---|---|---|
| **D1** | MV w/c 7 Sep carries **2 messages and 3 goals** — `Expert to Authority` (35k on Mon 7, 25k on Wed 9–Sun 13) and `Jim Kwik` (Tue 8 only) | "Expert to Authority / 25k", Jim Kwik silently dropped | `mvMessage ??=` / `mvGoal ??=` take whichever row Airtable returns first. Non-deterministic *and* lossy — it hides a real day's content, the exact failure V5 was written to prevent |
| **D2** | **Zero** VL assets in w/c 7 Sep link to any message. The single linked asset in the whole base (1 of 238 dated) is dated **16 Sep** | "test / vcvdsv" as this week's VL message | `[...msgById.values()].find(m => m.brand === 'VL')` picks the first VL row in the table regardless of week |
| **D3** | VL is dated through **30 Sep**, with a sparse tail (23, 26, 30 — nothing on 24, 25, 27–29) | boundary strip said 30 Sep correctly, but `5a`'s spec is written around 22 Sep | Ramya seeded more dates after the handoff was captured. Undated count also moved 221 → **204** (66 published, unchanged) |

**D2 is the serious one.** Vishen's own lane claimed a message he never committed, on the surface
built for him. It is precisely the fault the handoff names — *never borrow or invent one brand's
message* — arriving through a different door than expected.

### Decisions

| # | Decision |
|---|---|
| **Y1** | **Extract the coverage rule, don't duplicate it.** Pull the primary/related sort out of `resolveBrandsForWeek` into a pure `lib/mow/coverage.ts`, taking `{key, name, goal, daysInWeek}[]` and returning `{primary, related, warnings}`. Both the Postgres resolver and the Airtable calendar call it. Fixing D1/D2 by writing a *second* selection rule is how the two surfaces start disagreeing. |
| **Y2** | **Placeholders suppress to the tier-1 gap, they do not display.** `test` and `vcvdsv` render as `No message committed — Ramya`, identical to true absence. **Reverses `3a`'s `PlaceholderValue` treatment for message and goal** — the handoff itself flagged it as needing confirmation before going in front of a viewer, and it does not. The value is still never rewritten; it is simply not shown. `messageIsPlaceholder` / `goalIsPlaceholder` stay on the shape and drive a `warnings` entry, so the junk is visible to whoever can fix it without being visible to Vishen. `PlaceholderValue` itself stays for `4a`'s `Soc`-in-a-Priority-field case; if `4a` does not land, delete it. |
| **Y3** | **The month boundary is computed, never a constant.** `5a`'s "post-22-Sep days come off red, one marker on 23" is stale — the tail is now sparse through 30 Sep, so there is no single boundary date any more. The design's *intent* survives intact and is what to implement: undated future days are **provisional, never red**, each keeps its own cell, and the sentence sits in a strip **beneath** the grid. The strip states the two real facts instead of one invented one: *"VL: 3 assets dated after 22 Sep · 204 with no Live Date at all."* A reader can still point at 24 Sep. |
| **Y4** | **The Monday pack (`2a`) moves ahead of Month and Asset detail.** It is the surface Vishen asked for and the one the 08:00 meeting runs from; Month and Asset detail are navigation around a calendar that already works. If anything slips it should be the zoom-out, not the pack. |
| **Y5** | **The pack reads hybrid: Airtable for the message and goal, Postgres for the staged→committed prose.** `MOW_BACKEND` stays `airtable` and needs no flip — the `0024_mow` tables are live in prod and hold the app-owned workflow state (staged/committed learnings, `committedBy`, the headline override). This is the split `CLAUDE.md`'s architecture note already mandates: reference data upstream, workflow state app-side. No reconcile on the critical path. |

### 3b · The reader fix (blocks both 4 and 5)

1. **`lib/mow/coverage.ts`** — the extracted pure resolver (Y1). `resolveBrandsForWeek` calls it and
   loses its inline sort; behaviour and its 24 existing checks are unchanged.
2. **MV lane** — group the comms-day rows by `Message of the week` text, count days in the week,
   pick by coverage: `Expert to Authority` (6 days) leads, `Jim Kwik` (1 day) becomes `related`.
   Then group *within* the primary by `The Goal`: 25k (5 days) leads, 35k (1 day) does not.
   **A message carrying two different goals in one week is itself the finding** — emit a warning
   naming both and their dates rather than choosing silently.
3. **VL lane** — resolve the message from the assets *dated into this week*, via their
   `Message of the week` link. Zero linked assets → `message: null`. Never scan the table.
4. **`spanNote` gets filled.** Currently hardcoded `null`. Widen the comms-day fetch from one week
   to a **five-week window** (one `filterByFormula`, same cost) so a message's true range is known:
   `Expert to Authority` renders "spans 7–21 Sep". The same window is what `5a` reads, so Month
   inherits its fetch rather than adding one.
5. **`BrandWeekHeader` gains `related: {name, days}[]`** — rendered under the primary message, small.
   Tuesday's Jim Kwik beat stops being invisible.

### 4 · `2a` the Monday pack — `/performance/week`

Per §6's anatomy and §6B's corrections. The three that are non-negotiable because each is a fault
already found: a **CSS grid with `grid-column: 1 / -1`** for the day expansion (never `<div>`
wrapping `<tr>` — that was a real rendering bug, and `build-export.mjs` still has it), **VL teal on
every surface** including the brand cards, and the **commit bar as the only gold element**.

What it can honestly show on Monday, given §0B's audit:

| Band | Source | State |
|---|---|---|
| Message + goal per brand | Airtable, via the Y1 resolver | **real** — MV 25k inferred from prose, VL a named gap |
| Headline number | none app-side | `BigNumber` renders the tier-1 gap, **never a zero** |
| Planned vs shipped, 7 rows | comms-days + VL `Live Date`/status | **real** |
| Per-platform reach/engagement | `social_metrics`, 329 posts | **real in aggregate**; per-asset impossible (`ticket_airtable_id` on 0 rows) |
| YouTube · revenue · leads | — | labelled absent; Glen hand-enters week one (W5) |
| Learnings, per-owner prose | Postgres `0024_mow` tables (Y5) | staged→committed, human-written |

### Two further traps, found in production while building `2a`

Neither is in any handoff, and both would have produced a wrong number in front of Vishen.

| # | Finding | Consequence |
|---|---|---|
| **Y6** | **`social_metrics` holds 5.0 capture rows per post** — 1,642 rows over 329 posts, because the nightly cron re-captures each one. A naive `sum(reach)` inflates by ~5×. Every figure now comes from the latest capture per post via `distinct on`. | Same class of error as Glen's `SELECT DISTINCT order_id` rule, which has inflated a revenue figure twice — once by $6,261. His rule was about revenue; this is the same shape in the social table. |
| **Y7** | **The platforms do not report the same metrics.** Verified on live w/c 7 Sep rows: Instagram returns reach + engagements and **no clicks**; Facebook returns clicks and **neither** reach nor engagements; TikTok returns reach alone. | A cross-platform "week reach" is an Instagram figure wearing a total's clothes. `week-pack.ts` deliberately has **no** cross-platform total, and the page states what each platform reports once at screen level. Do not add one. |
| **Y8** | **`planned` and `delivered` count different populations.** Perch watches 10+ connected accounts including the regional ones (`mindvalley.de`, `mindvalleyenespanol`, `mindvalleybookclub`); the comms calendar plans a much smaller named set. Mon 7 Sep is **7 planned against 19 delivered**. | Presented as two facts side by side, never a ratio — as planned-vs-actual it would read as a 271% completion rate. The one sound comparison is the weak one: a planned day where nothing at all went out. |

Also worth recording: the publish date is `raw.details.created_at`, **epoch seconds**, present on all
1,642 rows. `captured_at` is when the cron ran, so it is useless for bucketing a post to the day it
went out — which is what the day table needs.

### Verification for 3b and 4

`npx tsc --noEmit && npm run lint && npm run build`, plus the four existing suites
(`verify-derive`, `verify-smart`, `verify-tags`, `verify-calendar`) — all must stay green;
`verify-calendar`'s 24 checks cover the shapes the refactor moves.

New checks, each written against the live rows the run above returned, so they fail today and pass
after the fix:

1. **D1** — w/c 7 Sep MV resolves primary `Expert to Authority` with goal `25k`, `related` carries
   `Jim Kwik` at 1 day, and a warning names both the 35k and 25k goals with their dates.
2. **D2** — w/c 7 Sep VL resolves `message: null`. w/c **14 Sep** resolves the linked asset's
   message, and per Y2 still renders `No message committed` because that message is `test`.
3. **D3** — the boundary strip states 3 assets after 22 Sep and 204 undated; no day cell after
   22 Sep is red; every day 23–30 is individually addressable in the DOM.
4. **Y2** — grep the built surfaces: `vcvdsv` and `test` appear in no rendered header.
5. **One gold element per screen** — grep for `bg-gold`/`border-gold` per page; the calendar's is
   the missing-goal strip, the pack's is the commit bar.
6. **Live re-run** of both surfaces against the API before deploy, not only against fixtures — that
   is what caught all three of these.

> **Credential note.** The token used for this run was pasted into a chat transcript, and
> InfoSec's own position (§0, change 6) is that developer PATs are not shared. **Rotate it**, and
> put the replacement in Kessel as a secret (`kessel env secret AIRTABLE_TOKEN=…`) rather than in a
> local file. It was passed inline for the run and written to no file in the repo.

---

## 6D. Data-flow and access audit — measured 10 Sep, before step 6

### Context

Asked before continuing to `4a`/`5c`: *is data actually flowing, and do we have access to
everything?* Audited against live systems rather than reasoned about — Airtable schemas, the
managed Postgres, GitHub Actions run history, Kessel env, and the OAuth credential table.

Verdict: **the pipelines are healthy; the risks are one silent bug, one cadence, and the fact that
nothing built this week is deployed.** Detail below, because the useful part is the numbers.

### What is flowing

| Source | State | Age when measured |
|---|---|---|
| Airtable → PG reference (`employees` 215, `asset_types` 226, `event_types` 63) | ✅ | 1h 48m |
| `tickets` — 11,143 rows | ✅ | 1h 20m |
| `social_metrics` — 1,642 rows / 329 posts | ✅ | 6h 47m (nightly Perch) |
| All 9 scheduled workflows | ✅ every recent run `success` | — |
| Hootsuite OAuth | ✅ refreshing (`last_error` null, `updated_at` today) | access token expires hourly by design |
| **294 of 296 Airtable field ids** | ✅ resolve against live schemas | — |
| Prod secrets: `AIRTABLE_TOKEN`, `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SYNC_SECRET`, `YOUTUBE_API_KEY`, Google OAuth | ✅ all set | — |
| `COMMS_CALENDAR_BACKEND` / `MOW_BACKEND` unset → default `airtable` | ✅ correct for Monday | — |

`comms_days`, `messages_of_week` and `mow_weeks` are **0 rows, and that is correct** — both Monday
surfaces read Airtable directly. Nothing is waiting on a reconcile.

### The four real problems

**Z-A · Two dead field ids, failing silently.** `ASSET_TYPES.fields.loadWeight`
(`fld7d85oMy4ELYmDi`) and `.effortNorm` (`fldKEQQQnkQK9XL3q`) **do not exist** on the live
`🛎️ Asset Type` table. They are read by [sync.ts:135](lib/airtable/sync.ts#L135) and
[repository.ts:84](lib/scoring-config/repository.ts#L84).

This is the project's worst failure mode: **a dead id does not error.** The REST API omits the key,
so the value is `undefined`, and every surface here is deliberately built to render absence
honestly — so a dead id renders as "not set", indistinguishable from a real data gap, on pages
whose whole job is showing real data gaps. Confirmed downstream: `asset_types.load_weight` and
`.effort_norm` are **null on all 226 rows**.

The table is a **synced** table (it carries `Sync Source`), and Airtable does not allow app-managed
fields on one — so these ids could not have survived a sync rebuild. Related trap already recorded
in memory: the same table hides a second `EMPLOYEES` roster behind Stakeholder/Team Lead.

**Z-B · The same dimension is inert from the other side too.** `EVENT_TYPES.fields.loadWeight`
*does* resolve — and is **empty on all 63 rows**. So `loadWeightFor()` and `capacityFor()` return
defaults for everything: the load/capacity weighting in prioritisation is currently a no-op. Two
different causes, one identical outcome, and neither is visible anywhere.

**Z-C · Scheduled sync is throttled ~4.7× slower than declared.** Measured from run history, not
from the cron line. `reference-sync.yml` declares `0 * * * *` (hourly); actual gaps between runs
were **4.7h, 5.1h, 4.6h, 2.4h**. `ticket-sync.yml` is the same shape. Every run succeeds — this is
cadence, not failure, and it matches the warning already written into the workflow file.

**This does not affect Monday.** Both new surfaces read Airtable live, so Ramya's Friday seeding
appears immediately. It *does* affect `REFERENCE_BACKEND=postgres` consumers — the queue and intake
surfaces — where an Airtable taxonomy edit can take ~5 hours to land.

**Z-D · Nothing built this week is deployed.** All 11 commits sit on `mow-monday-14sep`; Kessel
deploys from `main`, which is still at `6bf5dca`. The deployed app is healthy
(`…cont-73a7-jdtcvngavq-as.a.run.app` returns 200) but has none of the calendar, pack, month or
asset detail.

### Where we genuinely lack access

| Gap | Reality |
|---|---|
| **Metabase** | No `METABASE_*` in Kessel. Leads and revenue are unreachable from app code — the headline number's provenance. S6's session-side agent remains the only path. |
| **YouTube Analytics** | `YOUTUBE_API_KEY` **is** set, but a Data API key only reaches views/likes/comments. CTR, AVD and retention need channel OAuth, so **Vishen's fixed 7% CTR benchmark is still unreachable** and Glen hand-enters it (W5). |
| **Perch refresh token** | Single-holder and rotates, so the bus factor is one — and a revoked token would surface only at the 03:30 UTC run, as a quiet empty pull. |

### Decisions

| # | Decision |
|---|---|
| **Z1** | **Deploy after step 6**, not now. Noted risk, accepted: the first production deploy then lands Friday/Saturday with no slack, so any deploy-only surprise (region, OAuth host, a `NEXT_PUBLIC_*` needing a rebuild) has one day of margin. Mitigated by Z2 covering deploy-readiness and by prod env already being verified above. |
| **Z2** | **Make all of this one command: `npm run doctor`.** The audit above took a dozen ad-hoc queries; it needs to be repeatable on Sunday night by someone who is tired. `scripts/doctor-airtable.mts` (written during this audit, 296 ids in one pass) becomes the first of four checks. |
| **Z3** | **Remove the two dead references and state the default explicitly.** Changes no behaviour — they already resolve to null and fall back — but stops the field map claiming to read something that does not exist. Deliberately NOT repointed to `Importance`/`Complexity`/`Hours`, which do exist: that would change queue ranking for every ticket three days before a founder demo, and would revive work already dropped (see the asset-type-economics memory). |
| **Z4** | **Z-B is documented, not fixed.** `Load Weight` being empty on all 63 event types is a data-entry gap owned upstream, not a code bug. `doctor` reports it as a warning so it stops being invisible; filling it is Ramya's or Jai's call after Monday. |

### What `npm run doctor` checks

One command, four checks, exits non-zero on anything that would render as a false data gap:

1. **Airtable ids** — every `tbl`/`fld` in `lib/airtable/field-map.ts` against live base schemas
   (`scripts/doctor-airtable.mts`, already written). Needs `schema.bases:read` on the token.
2. **Postgres freshness** — row count and age per synced table, warning past a per-table threshold
   (reference 12h, tickets 12h, social 36h). Runs through `kessel db query`, since the managed
   Postgres is unreachable any other way.
3. **Credentials** — `external_credentials` expiry and `last_error`, plus which expected Kessel env
   keys are absent (`METABASE_*` should report as a *known* gap, not a surprise).
4. **Reference emptiness** — fields whose id resolves but which are empty on every row (Z-B). This
   is the check that would have caught Z-A and Z-B as one class instead of two accidents.

Critical files: `scripts/doctor-airtable.mts` (exists), a new `scripts/doctor.mts` orchestrating
the four, `package.json` (`doctor` script), and the two-line deletion in
`lib/airtable/field-map.ts` plus its readers in `lib/airtable/sync.ts` and
`lib/scoring-config/repository.ts`.

### Verification

- `npm run doctor` exits 0 on a healthy system and non-zero with the offending ids named. Re-run it
  after the Z3 deletion and confirm the count drops from 296 ids / 2 problems to 294 / 0.
- `npx tsc --noEmit && npm run lint && npm run build` clean; `npm run verify` still 5 suites green.
- Confirm the Z3 change is behaviour-neutral: `capacityFor()` and `loadWeightFor()` return the same
  values before and after, since both inputs were already null.
- Re-run `doctor` immediately **after** the step-6 deploy, against production — the point of Z2 is
  that a deploy is when ids and env most plausibly diverge.

---

## 7. Phasing

> **Scope risk, restated after Revision 2.** Monday now carries a whole extra surface. The list:
> `/studio/comms-calendar` with three brand states, `CommsDay` + MOW two-way sync, three MOW views,
> `/social` with three tabs, the ingest agent, the Slack post and a Sunday dry run — in **two and a
> half days**, across Friday's Rafi meeting and the vendor Loom, and with the calendar's own data
> still landing from Ramya on the 11th. You've chosen both (V1), so it is planned as stated.
>
> If Saturday goes badly, the order to give is: **two-way push maps** (invisible to Vishen on
> Monday) → **`/social` Manage tab** (Glen still owes requirements) → **the pack's per-owner briefs**.
> The comms calendar's empty states and the pack's day table are the last things to cut, because
> they are what the two audiences actually asked for.
>
> The honest alternative, if Friday looks tight, is the 9 Sep brief's own fallback: **the pack as a
> Slack post on Monday, pages the week after**. It was written as "the cheapest test of whether the
> meeting gets shorter", and it is still true.

### Phase 0 — decisions and unblocks (Wed 9 → Thu 10 Sep, no app code)

| # | Item | Owner | By |
|---|---|---|---|
| 0.1 | Request `METABASE_URL` + API key from IT — **not blocking** (§2 ships agent-side first) | Rhythm → IT | Wed 9 |
| 0.2 | Stand up the **scheduled cloud agent** for the weekly Metabase ingest (`/schedule`) | Rhythm | Fri 11 |
| ~~0.3~~ | **SUPERSEDED by §0.** The workshop happened. What remains: add `Week starting` + the smart-number fields to `tbl3NPxLDApiIyobS`, fix `Mindalley` → `Mindvalley` **in Airtable**, delete the "test" row. | Ramya | Fri 11 |
| 0.4 | Backfill all September `🗓️ Comms Calendar` entries | Glen | Thu 10 |
| 0.5 | Re-enable the message-of-the-day auto-tag automation + test records | Glen | Thu 10 |
| 0.6 | Fill `Instagram Published Link` / `Final Published Link` on every released row, all platforms | Glen | ongoing |
| 0.7 | Glen's Instagram + new YouTube into Hootsuite, via Marisha | Gareth | Fri 11 |
| 0.8 | Glen sends: 2 MD files, HTML artifact, Metabase report link, dashboard project access, **and the `/social` requirements he committed to** | Glen | Thu 10 |
| 0.9 | **YouTube Analytics API credential** — unlocks MOW day-cards *and* E15 retention | Rhythm → IT | Fri 11 |
| 0.10 | Ask Rafi about 6,000 email sessions vs <2,000 on the test scoreboard | Ramya | before Mon |
| 0.11 | Populate `Lead gen Goal` + `TOTAL Target revenue` on 📅 Official Cal (empty on every record, incl. this week's summit — see F8) | Ramya · Jai | before Mon |

Thursday's workshop is 12:30–13:00 KL, not the hour asked for, and the vendor-portal tech
walkthrough starts at 13:00. **Spend it on the schema decision only.**

### Phase 1 — Monday (Wed 9 → Sun 13 Sep) · **P0**

**Two surfaces ship (V1): the comms calendar and the Monday pack.** Build the calendar to
`MOW-HANDOFF-10SEP.md` and §0; build the pack to `MOW-HANDOFF.md` as amended by §0 and §6.

**1.0 · `/studio/comms-calendar` — new, and first in the 10 Sep sequencing.** One route,
`?brand=main|vl|mv`, reading Airtable directly behind `COMMS_CALENDAR_BACKEND=airtable`. Asset
grain, grouped by `Live Date` in the front end. **Build the three empty states before the populated
path** — that is what today's data actually gives you, and per §0 they are the feature. Reuse the
existing Airtable REST layer (`lib/airtable/rest.ts`, `returnFieldsByFieldId=true`) and hard-code
every id from §0; never resolve a table or field by name.

**Build to `MOW-HANDOFF.md` for the pack.** Its §4 data model (`MowWeek`, `MowSlot`, `Offer`, `DestinationLink`,
`AssetPerformanceSnapshot`, `PerformanceAttribution`, `CreativeRecord`, `Learning`, `Brief`,
`Experiment`), §5 jobs and §7 views are authoritative except where §4 above overrides. Deltas:

**✅ 1.1 · `CommsDay` — DONE.** Mirrors `🗓️ Comms Calendar` (`tblUUVMKdSrLVhTx8`) by field ID
(`COMMS_DAY` in `lib/airtable/field-map.ts`), with `comms-day-upsert.ts`,
`comms-day-push-map.ts` (writable subset + a `assertNoReadOnlyFields` guard) and
`pull-comms-days.ts`, registered in both registries behind a new `MOW_BACKEND` flag that defaults
to `airtable`. `CommsCalendar` → `OfficialCalCC` renamed (code-only; the table keeps
`@@map("comms_calendars")` and its 206 rows).

**✅ 1.2 · Migration `0024_mow` — APPLIED to the managed DB.** 13 tables live, including
`uq_mow_weeks_week_brand` (S3). Verified by applying all 23 migrations to a scratch Postgres and
diffing against the schema: zero MOW-related drift. Six pre-existing drift items from
0008/0011/0014/0022 remain and were deliberately left alone.

**⚠️ Repoint before continuing (V3).** `MESSAGE_OF_WEEK` in `lib/airtable/field-map.ts` points at
`tblrxLMH2ncoLaHO5`; the master is **`tbl3NPxLDApiIyobS`** (Name `fldNGE5u4OhCV1CQE`, Brand
`fld3eGQEIbiZ1kWDp`, Goal `fld1kb123Ha0FI2yh`, Comms Calendar link `fldFUiQFmoz96tnEz`). Change
`MessageOfWeek.brands String[]` → a single `brand String`. Have the pack join brand rows on the
derived week (V2) rather than the hardcoded `MOW_BRANDS` constant in `lib/mow/pack.ts`.

**✅ Also done:** `lib/mow/smart-number.ts` (the one-headline resolver + F8's target provenance),
`lib/mow/week.ts` (UTC-day week math), `lib/mow/pack.ts` (generator, propose-only, idempotent),
`POST /api/mow/pack/generate`, `POST /api/mow/metrics/ingest`. Verified end-to-end against the real
7–13 Sep week — 55 checks including propose-only survival, idempotency, and the guard returning 401.

**1.3 · Two-way sync for MOW + `CommsDay`** (S8) on the **writable subset only** (F6). Reuse the
existing outbox pattern — `AirtableOutbox`, `lib/airtable/push-map.ts`, `lib/airtable/drain-after.ts`
— and echo-suppression via `airtablePushedAt`. Do **not** invent a second pattern. Surface which
fields are read-only in the UI so a rejected write never looks like a sync bug. Note the standing
constraint: **inbound is throttled 3–11h by GitHub Actions**, so an Airtable edit may take hours to
appear — show "as of", don't pretend it's live.

**1.4 · The dashboards — build to §6B.** The Claude Design handoff is back and authoritative;
follow its build order, starting with the component sheet (X2). §6 still explains *why* each
surface exists; §6B governs how it looks.

**1.4b · Implementation.** `/performance/week` (one page + Meeting mode, U2),
`/performance/week/assets` (all owners, U6), the `/studio` blocker-first card (U3). Add the
`--mv-staged` token and the three new primitives (`TargetGauge`, `StagedBlock`, `DayRow`/`DayDetail`)
— and update `DESIGN_SYSTEM.md` in the same commit (U1). Add the nav entries to
`navForRoles`'s existing **Intelligence** group in `lib/roles.ts`, alongside `/performance`.

**1.5 · `/social` — three tabs** (S12, S13, S14). Move the clip engine to `/social/clips` with a
redirect from the old route (the `/content-engine` → `/media` precedent). **Manage**: planned vs
released this week, publish links to fill, campaign tags, missing-data nudges. **Performance**:
Glen's report — campaign leads/revenue (Hootsuite tag × Metabase UTM), top assets, per-platform,
per-account reach. Write access via a named allowlist in settings, admin-editable.

**1.6 · Jobs.** `mow-monday-pack` (Mon 08:00 MYT) + `POST /api/mow/pack/generate` triggered Sunday
night as the fallback, because Actions cron slips 3–11h. Slack summary with headline + blockers +
link (S11). Every route calls `lib/api/guard.ts` — `middleware.ts` skips `/api`, and `await auth()`
alone is not a guard.

**1.7 · Email band reads `📧 Sends`** (F4), not Braze.

**Glen's rules from `Sep Calls/Handoff/CLAUDE.md`, transcribed as comments beside every query:**
never question 31815 (returns $80,076 where 32044 returns $422,722, and $0 for a campaign that
converted 16 times) · always `SELECT DISTINCT order_id` (double-counting has inflated figures twice,
once by $6,261, once enough to flip a YoY sign) · never sum the two revenue reports · organic social
only · net revenue stays "pending verification" · revenue backfills upward, so show "as of".

**The AI never narrates a number.** Figures render; prose lives in staged→committed human fields,
copying the `DnaReview*` / `ClipRule` staging pattern. That was Glen's condition.

**Also adopt from handoff §8:** seed the weeks of **1 Sep and 7 Sep by hand** before wiring
pipelines, and run the **Sunday async dry run with Gareth** (S15).

**Out of Phase 1, as labelled empty states:** sentiment (Glen still tuning 23/77), per-post revenue,
office wall display, Composio service account, platform comms (S17), Learning library, Experiments.
Lever→owner is free text (S16).

### Phase 2 — deepen (w/c 15 Sep)

- **2.1** `DestinationLink` inference at scale + human-link queue; match-rate report.
- **2.2** Publish-link → ticket join (F3) — finishes E13.3; the 24-hour readout lands on the
  editor's own ticket, so *"an editor never has to come to Glen and ask what happened to my video."*
- **2.3** **`utm_content` per post** (S7) — promoted from Phase 4. One conversation with Rafi's side
  on cardinality first. ManyChat-CTA posts labelled campaign-level, not blank.
- **2.4** Learning library · Experiments · `CreativeRecord` backfill (Ramya's newsletter archive
  first) — Gareth's tabular data.
- **2.5** App-side Metabase swap once IT delivers · Braze for send content · sentiment once Glen
  signs off · YouTube retention into day-cards.
- **2.6** Every number carries its attribution source. Braze = "engaged revenue" (S5). Funnel rows
  stay "unreconciled" until Rafi closes the session gap.

### Phase 3 — the learning engine (late Sep)

Per-owner "My assets" deepening · route confirmed learnings into the existing `DnaReviewRule` loop
rather than a second rules system (handoff D7) · E10 decision (S16).

### Phase 4 — the rest (Oct)

**E15 · Clip variant loop** — PRD first (§5, S19). ManyChat trigger-word attribution for the
minority that needs it. Composio as a **coverage supplement** to Perch, not a replacement — it is
unreachable from deployed app code.

---

## 8. Parallel tracks

### T1 · Matt / ads ticket automation — **the moment his view lands** (S20)

~2h, blocks nothing, fully specced.

**Matt first:** duplicate the funnel assets view (private, shared); add `Raw File URL`, `Due Date`,
`Event Type`, `Asset Type`; sync Event Type + Asset Type from Creative Services into
`appWYOr2p4RKHf2LR`; link test records; send the view link.

**Then the script:** fires on `Status = Raise Ticket` (he chose status over checkbox — latency risk
flagged and accepted). Requires `Brief/Notes` **and** `Due Date`; `Raw File URL` optional. Add an
automated `ticket raised date` as the did-it-run check. Carry `Program` + `Funnel URL`. **Field IDs
only** — the "Requested By" silent-data-loss precedent.

Dropped: Shoot Requests → Asset Requests linking. **Flag:** two funnel bases with heavy duplication
(Vishen's and Moniek's); Matt was told to use Vishen's — right for today, but one owner and one base
is needed. One line to Moniek so it's on record.

### T2 · Banners / campaign fan-out → **epic E14**, Phase 0 held to after Friday (S18)

`Sep Calls/Handoff/HANDOFF.md` is the brief; **E14 and E15 are both free in `prd/index.md`**. Two
independently shippable halves: **A** request-side fan-out (Official Planning Calendar → Event Type
→ Asset Types → staging → human commit) and **B** delivery-side Dropbox back-link. *B is the one
people feel daily.*

**Keep the Friday Rafi 1:1.** Rafi, Chee Ling and Rish held a banner meeting last week nobody
mentioned; Rafi built the stories engine with Abishek without Marta and half the features don't work
because she can't upload video; he is currently exploring AI banner tooling. Friday is
requirements-gathering, not a demo. Lead with HANDOFF §7's five decisions — chiefly **move all banner
DNA types onto the single Creative Services asset-type building block.**

Nothing populated before then (S18). When it starts: AI-populate design asset types + DNA in
`tblLbcgob2Bxevugy` and **populate `Category`** — a blank one silently hides the type from the Shoot
form. Then Vanessa/Haley/Ziga review, then Jaideep/Wendy tag Event Types.

Already agreed with Moniek: changes send an **FYI Slack notification**, not auto-suggestions.
**Unowned and load-bearing: the Official Planning Calendar has had no owner since Ramya left, and its
base/table IDs are not in `context/airtable-schema/` yet.**

### T3 · Vendor portal — adoption, not build

Gareth walked through and approved two pending spend requests live (*"this is the information I
need"*). Open: Jill Friday · Shitish Loom · the vendor-portal Loom (overdue behind the detail-page
uplift Moniek likes) · **@-mention notifications in the decision log, half-built.**

### T4 · Capacity — the actual constraint

Glen and Gareth both volunteered. **Glen** wants to build his own reporting interface — sound
reasoning, but it's the Rafi pattern again; the answer given was right: **code together in this
repo.** `/social` (S12) is the surface that makes that concrete. Needs the $100 Claude tier (he asks
Marisha, backed by his prototype), plus VS Code + repo + skills (he hit a 404; correct repo sent).
**Gareth** wants a 1-hour paired session; out Thursday filming Marissa Peer + Vishen. **Neither helps
before Monday — don't let onboarding eat the pre-Monday window.**

---

## 9. Data integrity — flag before any number reaches Vishen

1. **6,000 vs <2,000.** Ramya's report shows ~6,300 clicks / 6,000 sessions to `/meditations`; the
   test scoreboard shows ~1,579. Rafi investigating. Show funnel rows **"unreconciled"** until
   closed; neither number is authoritative.
2. **Braze `$33.9K` / `$85K` is engaged revenue** (S5). Labelled always; never the smart number.
3. **Sentiment (23/77) is still being tuned by Glen** — do not surface comment themes yet.
4. **Blocked ≠ missed.** Two statuses, two colours (upstream: no speaker list · vs Fri newsletter).
5. **Test dashboard timing.** Ramya first saw the scoreboard *after* the email went out. If tests
   appear retroactively, email→test linking will have gaps.
6. **One editor's name in the 1 Sep quest-snippet slot is unverified** — seed as "Editor TBC".
7. **Name garbling** — check every name before anything leaves your hands: Vishen →
   "Vision/Vishan/Bish"; Ramya → "Rama/Marva"; Marwa → "Marva/Mara"; Moniek → "Monique"; Chee Ling →
   "Chiling"; Ziga → "Xygarathma"; Composio → "Composia"; Hootsuite → "Hootswuite"; Kessel →
   "Kessle"; Zuber → "Juber"; Jai → "Jib/Jep/Jedi".

---

## 10. Critical files

| Purpose | Path |
|---|---|
| Airtable field IDs — add `COMMS_DAY`, `MESSAGE_OF_WEEK` | `lib/airtable/field-map.ts` |
| Reference mappers — rename `mapCommsCalendar`, add new | `lib/airtable/sync.ts` |
| Pull registration | `lib/airtable/pull-registry.ts` |
| Push map + outbox drain (reuse, don't reinvent) | `lib/airtable/push-map.ts`, `lib/airtable/drain-after.ts`, `AirtableOutbox` |
| Schema — handoff §4 models + `CommsDay` | `prisma/schema.prisma` → `0024_mow` |
| Staged/committed pattern to copy | `DnaReview*`, `ClipRule` |
| Delivered metrics (already nightly) | `prisma/schema.prisma:847`, `lib/hootsuite/perch.ts` |
| Comms calendar (new, ships first) | `app/studio/comms-calendar/**`, `lib/comms-calendar/*` |
| Its backend flag | `lib/comms-calendar/backend.ts` (`COMMS_CALENDAR_BACKEND`, default `airtable`) |
| Airtable ids for it — hard-code, never resolve by name | §0 + `Sep Calls/10 Sep/MOW-HANDOFF-10SEP.md` §1 |
| Its visual target | `Sep Calls/10 Sep/comms-calendar-v2.html` |
| Pack + views | `app/performance/week/**` (page, `actions.ts`) |
| MOW components | `components/mow/*` (DayRow, DayDetail, BrandCard, LearningList, OwnerBlock, CommitBar) |
| New shared primitives | `components/ui/TargetGauge.tsx`, `components/ui/StagedBlock.tsx` |
| The `--mv-staged` token + rulebook | `app/globals.css`, `DESIGN_SYSTEM.md` §3 (same commit) |
| Nav entry — existing Intelligence group | `lib/roles.ts` (`navForRoles`) |
| Vishen's blocker card | `app/studio/page.tsx` |
| Generator + headline resolver (built) | `lib/mow/pack.ts`, `lib/mow/smart-number.ts`, `lib/mow/week.ts` |
| Design references (read, don't port) | `Sep Calls/Handoff/mow-prototype.html`, `message-of-the-week.html` |
| Social three tabs; clip engine moves | `app/social/**` → `app/social/clips` |
| Access allowlist pattern to follow | `lib/studio/access.ts` |
| Every route must call the guard | `lib/api/guard.ts` |
| Glen's data rules, to transcribe | `Sep Calls/Handoff/CLAUDE.md` |
| Visual target | `Sep Calls/Handoff/mow-prototype.html` |
| Cron | `.github/workflows/mow-*.yml` |
| UI primitives + rules | `components/ui/*`, `DESIGN_SYSTEM.md` |

## 11. Verification

1. `npx prisma generate && npm run build && npm run lint` clean.
2. Migrate via `kessel db migrate` — prod Postgres is reachable **only** through `kessel db`.
3. Reference pull: confirm `CommsDay` row count matches September in Airtable by querying the base
   directly (`list_records_for_table` on `tblUUVMKdSrLVhTx8`), not by trusting the sync's own count.
4. **Two-way, both directions:** edit a MOW field in the portal → confirm it lands in Airtable and
   that `airtablePushedAt` suppresses the echo. Edit in Airtable → confirm it arrives on the next
   pull. Attempt a write to a formula/lookup field → confirm it is refused **before** it reaches
   Airtable, with a clear message (F6).
5. Seed weeks of 1 Sep and 7 Sep by hand; confirm the model holds two real weeks, including a
   summit-override week and two brands per week (S3).
6. `POST /api/mow/pack/generate` for w/c 8 Sep; confirm two `MowWeek` rows (MV, VL), slots split
   email/social, headline defaulting to **leads** because a campaign is live (S2), and that a rerun
   never overwrites a committed value.
7. `POST /api/mow/metrics/ingest` rejects an unauthenticated call and stamps
   `source = session:metabase`. Cross-check the week's revenue against Glen's own curated report — if
   they disagree, the query is wrong, not the report.
8. Load `/performance/week` and `/social` as an editor, Glen and Vishen (dev-login harness). Confirm
   role scoping, that only Gareth/Glen/Ramya can commit the pack, that only the `/social` allowlist
   can write, that changing the headline metric persists and relabels, and that every unpopulated
   section renders a labelled empty state rather than a zero.
9. Confirm `/social` redirects the old clip-engine route and nothing 404s.
9b. **Design-system compliance** (the §6 build): no raw hex, no arbitrary Tailwind sizes, no inline
    `style` except genuinely dynamic values. Toggle dark mode on every new surface and confirm the
    `--mv-staged` token inverts. Confirm exactly **one** gold element per page (the commit bar).
9c. **The honesty checks — each is a lesson already paid for.** An `inferred` target renders `~` and
    exposes its prose sentence; a `none` target renders "no target set" and **no** progress bar;
    every revenue figure carries `as of`; Braze is labelled "engaged revenue" and is never the
    headline; a day with no publish link says `no publish link recorded · Glen` rather than `0`;
    sentiment is labelled account-wide; a missing thumbnail is a hatched placeholder with a reason.
9d. Expand a day row and confirm Glen's analysis renders — per-platform split, CTR against the fixed
    7% target, and What's working / Needs attention / Recommendations.
9e. Confirm `blocked` and `missed` are visually distinct, and that Meeting mode collapses prose.
10. Mobile reflow per documented conventions. Deploy by push to `main`; env/secret changes need a
    **new commit** to take effect.
11. **Comms calendar acceptance (10 Sep handoff §6)** — every one of these is checkable against
    today's live data, which is the point of them:
    a. Renders honestly with one VL message named "test", one linked asset, and a populated MV lane —
       no crash, no fabricated zeroes, and **all three empty states visible somewhere**.
    b. **Undated assets are not dropped** — they appear in a "not dated" tray with a count.
    c. `24h Data` is empty on every VL asset: it must render "not filled", never `0`. A percentage
       over an empty denominator renders blank, never `NaN` or `0%`.
    d. The dirty record `MV: Be Extraordinary VL: Podcast - Naveen Jain` renders without breaking
       brand grouping.
    e. The brand toggle switches lanes **without refetching the month**.
    f. Every displayed value traces to a field id — no name-based lookup anywhere.
    g. A multi-week message (`Expert to Authority`, Sep 7–21) appears in each week it spans, marked
       as spanning (V2), never silently assigned to one.
12. **After Ramya seeds two weeks** (7 and 14 Sep, with goals): both weeks show in the VL lane and
    the goal reaches every asset in the week via lookup — typed once, not per asset.
13. **The real test (S15):** regenerate the 1–6 Sep pack, send it to Gareth Sunday, and ask whether
    that meeting could have run in 30 minutes.

## 12. This week

| Day | |
|---|---|
| **Wed 9** | Metabase + YouTube Analytics IT requests. Start `CommsDay` (F1) + `0024_mow`. Matt's view → T1 script whenever it lands. |
| **Thu 10** | ✅ Ramya build session done — MOW synced into the VL base, `Videos`→MOW link + Goal lookup built. Repoint `MESSAGE_OF_WEEK` (V3). Start `/studio/comms-calendar` empty states. |
| **Fri 11** | Rafi 1:1 (banners/E14). Jill walkthrough. Vendor Loom. **Ramya seeds two weeks of VL messages + goals, adds `Week starting`, fixes `Mindalley`, deletes "test".** Calendar populated path. |
| **Sat 12** | Calendar artboards onto the canvas (V4). My assets. `/social` three tabs. `mow-monday-pack` → Slack. |
| **Sun 13** | Generate the 1–6 Sep pack, **send to Gareth async**. Generate w/c 14 Sep pack Sunday night KL. |
| **Mon 14** | **08:00 MYT — pack fires. Meeting runs from Content Studio.** |
| **Tue 15** | Moniek check-in. |
| **w/c 15** | Phase 2 (incl. `utm_content` per post). `/prd` for E15 + the Descript-MCP recut spike as its input. Gareth paired build. Glen setup hour. E14 Phase 0 if Friday went well. |

## 13. Scope boundary

You own the system and the overview. You do not own vendor negotiations (finance), test
implementation (Rafi and Shubam), revenue targets (Jai), or social publishing discipline (Glen).
Today's calls had you nudging on all four — keep it as flagging-and-enabling in writing.

Two asks route through Marisha and are **not yours to make**: Glen's $100 Claude tier (Glen asks) and
Vishen's Instagram access for Hootsuite (Gareth asks).

Also not yours: **Glen's git remote.** 16 commits sit on `main` with no remote, on his iCloud
Desktop; his checklist is explicit it must not be your personal GitHub. And the **Perch refresh token
rotates** — two people cannot hold it, so a new owner runs `npm run perch:auth` themselves.

Still unnamed after today: **the Official Planning Calendar's owner** (T2), and **the platform-comms
source** (S17).

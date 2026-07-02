# Vishen's Media — "what's getting posted for his channels" section

## Context

Vishen's recurring gap (documented in `context/VishenStudio/STUDIO_VISHEN_VIEW.md` and
`CLAUDE.md` §1): he **cannot see what is being produced for his channels, by whom, or how it
performed.** His content is spread across agencies (Simplex Media, Talking Heads, Two Comma PR)
and internal producers, on many channels (YouTube, LinkedIn, Instagram, email), with no single
place that answers *"what's live, who made it, how did it do, and what's waiting on me."*

**The unlock:** the base the user linked — Vishen's own **Videos** table
(`appvBtCYdaSrD1y11` / `tblcqpctTr76RQsQT`, **341 rows**) — already answers all of those questions
natively and **the team already maintains it by hand.** The portal currently wires in only two
other tables from that base (Major Videos + Clips, via `lib/media/`); the Videos table — the
complete cross-channel log of everything Vishen posts — is not read yet. This plan reads it
directly as a standalone source and builds a founder-facing "Vishen's Media" section around it.

This is distinct from (and simpler than) the existing `plans/jul1-2026-vishen-end-to-end-view.md`,
which reconstructs Vishen's output from Creative Services *tickets* via a not-yet-existing
"Request from Vishen" flag. The Videos table needs **no new tagging and no team behavior change** —
it's a ready-made source of truth.

**Decisions taken with the user:**
1. **Deliverable now = a clickable wireframe Artifact**, powered by the real Videos-table
   structure, so the flow can be seen/felt before any React is written.
2. **Data source = the Videos table, standalone** — read directly; lives alongside (not merged
   with) the ticket/clip pipeline.
3. **Interaction = Approve + rate write-back** — Vishen approves/rates/adds performance notes in
   the portal, written back to the Videos table (like the existing two-way clip sync). Designed
   now; **built as Phase 2** (the wireframe simulates it).

---

## The data map — what comes from where

Every field below is on the **Videos** table (`tblcqpctTr76RQsQT`). IDs verified live via the
Airtable MCP.

| Panel / column | Videos field | Field ID | Notes |
|---|---|---|---|
| Title | Name | `fldKDeSFvDMcbQ1cD` | primary |
| **Made by** (agency accountability) | Source | `fldxt25kQecgDdQvR` | Vishen · Simplex Media · Simplex (by Vishen) · Talking Heads · Two Comma PR · Will · Ramya · Academy · Membership |
| **Channel / format** | Medium | `fld7DTNjp6neU9bUH` | Video Long/Short · LinkedIn · Insta Writing/Image · Email · Talk · Ad/Trailer |
| **Pipeline stage** | Status | `fldGv5rhXeoIHUxBN` | 1 Idea → 2 Confirmed → 3 To Shoot → 4 Filmed → 5 In Editing → 6 Published (+ Rejected / Repurpose / Parked) |
| **Waiting on Vishen?** | Approval | `fldGvNhEyTN1rfd9O` | To Review → To Refine → Approved / Rejected / Parked |
| **Live link** | Published Link | `fldrym088lQmqfhGg` | 171/341 rows already populated |
| **Live date** | Live Date | `fldbdCEjsTMrQYRN7` | |
| **Quality** | Rating | `fldgWdIcUe2Lu5ykj` | 1–5 stars |
| Shot style | Format | `fldZbtkXqwBbIceX2` | Studio · Selfie · Clip · Straight to Cam · Carousel · Humor |
| Promotes | Product | `fld3SylS2Nf9fEZtx` | Brand · States · Events · Summit · Membership… |
| Topic tags | 🌳 Topics | `fldhOVlT7zuYWjVEk` | linked records |
| Added / changed | Created Date / Modified | `fldioPdB0I9FjjKhu` / `fldirV7fXg8q7VuVg` | |
| **Channel chip** (derived) | — | — | derive platform from the Published Link domain (linkedin.com → LinkedIn, youtube → YouTube, etc.), refined by Medium |
| **24h performance** (Phase 2) | *new long-text field* | — | add "24h Data" per `plans/jul1-2026-meetings-plan.md` §B1; manual now, Postiz/Hootsuite later |

Base `appvBtCYdaSrD1y11` is already registered as `BASES.vishenContent` in
`lib/airtable/field-map.ts` — only the Videos table itself needs adding.

---

## The wireframe (the clickable Artifact — deliverable #1)

Single self-contained HTML page, brand tokens copied from `context/mockups/studio-redesign.html`
(purple `#572280`, gold accent, Inter, 8/12/16 radii, dark-mode toggle). Reuses the topbar /
zone / card / kpi / btn CSS and the strong structure of the existing `vishen-tracker.html`, but
**re-pointed at the Videos-table columns** and seeded with ~12 real rows sampled from the live
table (real titles like the "VL Youtube Talking Heads —" series and the LinkedIn "LIVE:" posts).

**Top bar:** "Content Portal · Vishen's Media" — subtitle "Everything made for your channels —
who made it, what's live, and what's waiting on you."

**Controls (make it genuinely clickable):**
- **Made-by** chips: All · Simplex Media · Talking Heads · Two Comma PR · Internal (filters table).
- **Channel** chips: All · YouTube · LinkedIn · Instagram · Email (derived from Published Link).
- **Time**: Last 30 days · This year · All time.

**Zones (top to bottom) — ordered around trust & control, per `STUDIO_VISHEN_VIEW.md`:**

1. **"Waiting on you"** — the hero. Rows where **Approval = To Review**. One-tap **Approve** /
   **Send back** / **star rating** per row (Phase-2 write-back; simulated in the mock). This is
   the demarcation Vishen asked for — *only his items surface here, not the whole review pile.*
   Zero-pending → calm "Nothing is waiting on you" bar.
2. **Pulse KPIs** (glance, clickable to filter): In production · In editing · Published this month ·
   Awaiting your sign-off · Avg rating. Counts are Status/Approval rollups over the table.
3. **Made-by scoreboard** — agency accountability strip: one card per Source (Simplex Media,
   Talking Heads, Two Comma PR, Internal) showing *in-flight / published-this-month / avg rating.*
   This is the literal answer to "who is producing my content" and surfaces a lagging agency at a
   glance.
4. **The pipeline / tracker table (core)** — one row per video. Leads with the mandated columns
   adapted to this source (**Title · Rating · Made by · Status · Approval**), then **Channel ·
   Live link · Live date**. Rows clickable → drawer.
5. **Published & performing** — rows at Status = Published with a live link: Channel · live link ·
   live date · (Phase-2) 24h views/engagement · Rating. The "what went out and how it did" payoff.
6. **Detail drawer** (row click): lifecycle timeline (Idea → Confirmed → To Shoot → Filmed →
   In Editing → Published), Made-by, Channel, live link, Topics, and a performance card
   (Phase-2 24h data + sparkline).
7. **Trust footnote:** "Nothing changes without you" (reuse studio-redesign line).

Publish as an Artifact (favicon 🎬) → shareable link for Vishen / Marisha / the team.
**Before writing it, load the `artifact-design` skill** (per repo rule
`use-design-skill-for-design-changes`) and honor `DESIGN_SYSTEM.md` tokens.

---

## Who maintains what (so the section stays alive)

The section is only as good as the discipline behind the table. The wireframe makes each owner's
job visible:

| Data | Owner | Action to maintain | Cadence |
|---|---|---|---|
| **Source** (who made it) | Producer / Gareth | Tag each video with the agency/producer at intake | On create |
| **Status** pipeline | Producers + agencies | Advance Idea → … → Published as work moves | Continuous |
| **Published Link + Live Date** | Whoever posts (Social / agency) | Paste the live URL + date on release | On publish |
| **Approval** | **Vishen** (in portal, Phase 2) | Approve / Send back / rate — writes back to the table | Per sign-off |
| **Rating** | Vishen | 1–5 stars on published work | Per item |
| **24h performance** (Phase 2) | Paul + team → then automated | Enter 24h numbers (manual) → Postiz/Hootsuite auto-fill | 24h post-publish |

**Key point for the flow:** everything except Approval/Rating is *already* maintained by the team
in Airtable today. The portal is a read view over their existing habit; the only *new* human action
is Vishen's approve/rate (Phase 2 write-back), which replaces him being pinged ad-hoc.

---

## How this solves the team's issues with Vishen

- **"What's being produced, by whom?"** → the Made-by scoreboard + the Source column give
  per-agency visibility Vishen has never had in one place.
- **"Where is it, who's editing it?"** → the Status pipeline column + lifecycle drawer answer this
  per item, live.
- **"Don't dump everything into my queue"** (Jul 1 mtg, review demarcation) → the "Waiting on you"
  hero shows **only Approval = To Review** items, not the whole review pile. Clean Vishen-vs-team split.
- **"How did it perform?"** → Published & performing zone + (Phase 2) 24h data closes the loop the
  DAM never does.
- **Agency accountability** → a slow agency (e.g. Simplex Media with 6 stuck in editing) is
  visible instead of buried in a 341-row grid.
- **No new process** → runs on the table the team already keeps; adoption cost is near zero.

---

## Phase 2 — React build (after the wireframe is approved)

Follows the existing field-map → repository → selector → UI pattern (same as `lib/media/`):

1. **Register the table** in `lib/airtable/field-map.ts` — add a `VISHEN_VIDEOS` export under
   `BASES.vishenContent` with the field IDs from the data map above (mirror the `MAJOR_VIDEOS`
   block shape).
2. **Repository** `lib/media/vishen-videos.ts` — `VishenVideo` type + `mapVishenVideo` +
   `listVishenVideos(limit)` (read-only; excludes Rejected; newest-first by Live/Created date),
   using the existing rate-limited client `lib/airtable/rest.ts` (`listRecords`/`listAll`).
   Add `deriveChannel(publishedLink, medium)` helper.
3. **Selectors** for the zones: `waitingOnVishen()` (Approval = To Review), `bySource()`
   (scoreboard rollup), `published()` (Status = Published + link). Load in `lib/studio/data.ts`
   alongside `loadStudio()`.
4. **UI** — a new `/studio/media` page (or a zone on the `/studio` landing) reusing
   `Kpi`/`Badge`/`Sparkline`/table primitives per `DESIGN_SYSTEM.md` and the mandated header.
   Component in `components/studio/VishenMedia*.tsx`.
5. **Write-back (Approve + rate)** — mirror the existing two-way pattern in `lib/media/vishen-sync.ts`:
   a server action does a diff-guarded `updateRecord` to the Videos table's Approval
   (`fldGvNhEyTN1rfd9O`) and Rating (`fldgWdIcUe2Lu5ykj`) fields. Requires the app's Airtable PAT
   to have **read+write on `appvBtCYdaSrD1y11`** (confirmed granted 2026-06-30 per
   `vishen-media-clip-pipeline` memory). Loop-safe: only the portal writes these two fields; no
   inbound automation touches them.
6. **24h performance field** — add long-text "24h Data" to the Videos table per
   `plans/jul1-2026-meetings-plan.md` §B1; render manual entry now, wire Postiz/Hootsuite later
   (`plans/jul1-2026-postiz-performance.md`).

---

## Verification

- **Wireframe:** open the HTML in a browser — confirm Made-by / Channel / Time filters and KPI
  clicks filter the tracker; a row opens the lifecycle+performance drawer; the "Waiting on you"
  Approve/rate flow moves an item out of the queue (simulated); dark mode works. Publish as an
  Artifact and share the link.
- **Phase 2:** `npm run dev` → the section reads live Videos rows (spot-check counts against the
  Airtable grid: 341 total, ~171 with links); an Approve/rate action round-trips to the Videos
  record (verify via Airtable MCP); `npm run lint` + `npm run build` clean. No test runner exists.

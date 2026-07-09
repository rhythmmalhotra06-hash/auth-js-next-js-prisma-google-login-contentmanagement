# Vishen's Studio — cleanup + calendar hub

## Context

Vishen's founder studio has two surfaces today:

- **`/studio`** (`app/studio/page.tsx` → `StudioBody`) — a bento landing (pipeline funnel, media→clips, sign-off, launches, shipped). It has grown busy.
- **`/studio/media`** (`app/studio/media/page.tsx` → `components/studio/VishenMediaBoard.tsx`) — "Vishen's all media sources": a KPI row, a "waiting on your sign-off" hero, a by-producer scoreboard, producer/channel/time filters, a big "every video" table, and a lifecycle detail drawer. Vishen's own words: **"too many things."**

He needs one place to see **everything made for his channels** — Vishen's LinkedIn, YouTube, Instagram, the three agencies (Simplex Media, Simplex by Vishen, Talking Heads, Two Comma PR) and what each is shipping, his important clips, and Mindvalley items flagged for his review — and to do three jobs there: **catch up, approve, and plan ahead.** There is no calendar view anywhere in the repo today.

**Outcome:** a cleaned-up landing + a tabbed media hub whose default is a **3-section status hub**, with an **overall month-grid calendar** and a **clips & suggestions** lens. Deliver a **clickable HTML mockup first** (for sign-off on the concept), then build it in React. This plan covers both phases; Phase A (mock) is what we execute immediately after approval.

## Decisions locked with Vishen

- **Calendar = month grid** (not swimlanes). Each day holds content chips; click a record → detail drawer. **Group/color by agency (`source`)** — that's the reliable tag today; channel (derived from the published-link domain) is a secondary chip, not the primary axis. **Filters: status, month, agency/channel** (+ producer).
- **Structure = tabs on `/studio/media`.** Cleans up "too many things" by splitting the dense board into focused lenses.
- **Job = catch up + approve + plan**, realized as a status-keyed hub + calendar + clips.

## Design direction

Inherit the existing system exactly — this is not a restyle. Tokens, chrome, and interaction feel come from `context/mockups/studio-redesign.html` and `app/globals.css`: purple `--brand` `#572280`, gold `--gold` `#f5b000` (one attention element per screen, reserved for "needs you"), Plus Jakarta Sans, 8/12/16px radii, `#atmo` radial atmosphere, sticky blurred topbar, `.rise` staggered reveals, first-class dark mode via `[data-theme="dark"]`. Semantic color encodes **status** (production/review/ready/published) as pills; **agency** gets its own categorical dot palette. The mock is a single self-contained file (no external fonts/CDN — CSP-safe), reusing the class vocabulary already ported into `globals.css`.

## Surface 1 — `/studio` landing, cleaned up

Trim to a founder cockpit answering "what needs me, and what's the shape of things":
- **Hero + tally** (unchanged pattern).
- **Pipeline ribbon** — the 4-stage funnel (In production · Awaiting your sign-off · Ready to publish · Published), each linking into the media hub filtered to that status.
- **Needs you now** — the single gold band: shoots + clips awaiting sign-off (the highest-value block, kept prominent).
- **This month peek** — a compact strip of the next ~7–10 scheduled/live items, linking to the Calendar tab. (New; replaces some of the lower-value bento cards.)
- Demote launches/shipped to slim strips with "see all →".

## Surface 2 — `/studio/media` becomes the hub (tabbed)

One header, three tabs (segmented control, `.chips`/`.segmented` pattern):

**Tab 1 · Overview (default) — the 3-section status hub**
- **Needs you** — `waitingOnVishen()` sign-offs + proposed clips + Mindvalley "review now" items. Inline Approve / Send back / rate. Gold accent.
- **In motion** — everything not yet live (production/filmed/editing/scheduled), grouped by **agency** with per-agency counts (reuse `byProducer()` rollup). Answers "what are the agencies doing."
- **Live** — recently published with rating + 24h performance (reuse `publishedVideos()`).
- A compact "this month" calendar preview at the top linking into Tab 2.

**Tab 2 · Calendar — month grid**
- Standard month grid (Mon–Sun), prev/next month nav, "Today".
- Each day cell holds content chips colored by **agency**; a gold ⚑ marks items needing Vishen. Undated in-flight items live in a "No date yet" rail beside the grid so nothing is hidden.
- **Filters:** status (production/review/ready/published), month, agency, channel.
- Click a chip/record → the existing lifecycle **detail drawer** (Idea→Published timeline + details + 24h perf), reused verbatim.

**Tab 3 · Clips & suggestions**
- Proposed clips with virality score (approve/dismiss), AI-suggested clips + major videos (the "AI Suggested" provenance), grouped by source media. Reuses the clip-card vocabulary (`.clip`/`.clipgrid`).

The current dense "every video" table is preserved as an optional **Board** view inside Overview (or a 4th tab) for power browsing, keeping the founder-board columns it already uses (Title · Rating · Made by · Status · Sign-off · Channel · Live link · Live date). Note: the CLAUDE.md 5-column mandate governs *team* list views; this specialized founder board already deviates by precedent, so we keep its existing columns.

## Data grounding (no new backend needed for the mock; minimal for the build)

All of this maps onto data that already exists (`lib/media/vishen-videos.ts`):
- Records: `VishenVideo` — `name, source (agency), medium, format, product, status, stage, approval, publishedLink, channel (derived), liveDate, rating, views24h`.
- Calendar date = `liveDate`; items without one → "No date yet" rail.
- Agencies = `AGENCIES` const; `producerBucket()` rolls the rest to "Internal".
- "Needs you" = `waitingOnVishen()` (`approval === 'To Review'`) + proposed clips (`listClipsByStatus('Proposed')`).
- Writes already exist: `approveVideo`, `sendBackVideo`, `rateVideo`, `saveViews24h` in `app/studio/media/actions.ts` → `updateVishenVideo`.
- **[VERIFY at build]** the Mindvalley "review now" tag — confirm whether it's expressible via the existing `approval='To Review'` axis or needs a dedicated Airtable field. For the mock, represent it with the To-Review axis.

## Phase A — clickable HTML mockup (execute first)

Create **`context/mockups/vishen-hub.html`** — one self-contained file (inline tokens copied from `studio-redesign.html`, dark-mode toggle, `.rise` reveals, realistic Vishen sample data). It renders:
1. The cleaned `/studio` landing, and
2. The tabbed `/studio/media` hub (Overview / Calendar / Clips) with working tab switching, calendar month nav + filters, and a working detail drawer.

This is the sign-off artifact. Also surface it as an Artifact link for easy review.

## Phase B — React build (after mock approval)

- **`app/studio/media/page.tsx`** — introduce the tab shell; keep `loadVishenVideos()` as the data load, pass to the hub.
- **New components (under `components/studio/`)**: `MediaHub.tsx` (tab shell, client), `MediaCalendar.tsx` (month grid + filters + agency palette, reusing `DetailDrawer` + the existing `VideoDetail`), `MediaOverview.tsx` (3 status sections), `ClipsPanel.tsx`.
- **Refactor** `VishenMediaBoard.tsx` into the reusable pieces (the table becomes the Board view; the sign-off hero/scoreboard move into `MediaOverview`). Reuse `Kpi`, `Badge`/`TicketStatusBadge`, `DetailDrawer`, `Icon` (`calendar` glyph already exists), `SearchableSelect`, `Button`, and the `.st-*`/`.clip*` classes.
- **Landing** — trim `StudioBody` in `app/studio/page.tsx`; add the "this month" peek from `loadStudio()` data (already loads `listMediaSources`, `listShoots`, and can add the Vishen videos already fetched).
- Clip data via existing `listClipsByStatus` / `listClipSuggestions` (`lib/media/repository.ts`) and `app/vishen/actions.ts`.

## Verification

- **Mock:** open `context/mockups/vishen-hub.html` in a browser (and as an Artifact). Confirm: tab switching; month grid renders with agency-colored chips + gold "needs you" markers; the "No date yet" rail shows undated items; filters (status/month/agency) narrow the grid; clicking a record opens the drawer with the lifecycle timeline; dark-mode toggle works; no horizontal page scroll; keyboard focus visible. Match against `studio-redesign.html` for chrome/spacing fidelity.
- **Build:** `npm run dev`, sign in, visit `/studio` and `/studio/media`; drive Approve / Send back / rate on a To-Review item and confirm the write-back + revalidation (use the `verify` skill / a Playwright dev-login pass). `npm run lint` + `npm run build` clean.

---

# v2.1 — design-quality pass (2026-07-08)

## Context

Phase B shipped and deployed, but against **live volumes** it reads as a wall, not a designed
surface (user: "horrible design"). Root cause: the hub components render **unbounded lists** —
the Overview "Needs you" band stacks all **14** sign-offs inside one full-bleed saturated-purple
gradient block, and "In motion" dumps **57** items under Internal + **29** under Simplex in ragged,
uncapped columns. Gold is overused (every "In editing" badge is gold, plus the giant purple block),
breaking "one focal accent, keep everything else quiet." The Calendar has the same latent bug — its
"No date yet" rail would list ~80 undated items. Decisions locked with the user: **summary cockpit**
for Overview, and **hub + a light landing polish**.

## Fixes

**1. Overview = summary cockpit** — `components/studio/media/MediaOverview.tsx`
- **Needs you:** drop the full-bleed brand→violet gradient. Use a calm `bg-surface` card with a
  single **gold left rail** (the one accent), gold eyebrow, count, and a **"Show all N"** inline
  toggle. Sort soonest-live-date first; render top **5** by default. Rows are tidy — title · `AgencyChip`
  · stage `Badge` · Approve / Send back. Move the star rating off the row into the drawer.
- **In motion:** replace the unbounded agency lanes with a compact **agency scoreboard** — one card
  per agency (colored dot + name + *in flight* / *in editing* / *live · 30d* / *avg ★*), computed by
  grouping `rows` (reuse the `byProducer` shape from `lib/media/vishen-videos.ts` for inFlight/avg;
  add in-editing inline). Clicking a card jumps to the **Board** filtered to that agency.
- **Live & performing:** keep the 6-card grid (already capped) — it's the one section that reads well.

**2. Cross-tab preset** — `MediaHub.tsx` + `MediaBoard.tsx`
- `MediaHub` holds `boardAgency` state; the scoreboard card sets it and switches to the Board tab.
  `MediaBoard` accepts an `initialAgency` prop (remount via `key={boardAgency}` so the preset applies).

**3. Calendar rail cap** — `MediaCalendar.tsx`
- Give the "No date yet" rail a fixed `max-h` with internal scroll + count header (prevents the
  ~80-item wall). Day cells keep the existing 3-chip + "+N" cap.

**4. Color calm** — `components/studio/media/shared.tsx`
- Remap `STAGE_TONE.editing` from `'warning'` (gold) to `'neutral'` so lists stop shouting; gold is
  reserved for the single Needs-you accent. (Sign-off "To Review" badge in the Board stays gold — it's
  meaningful there and off the Overview.)

**5. Landing polish** — `app/studio/page.tsx` (light pass, no restructure)
- Tighten the sparse sign-off band (graceful "Untitled shoot / no details" state), and align the
  section eyebrows/heading rhythm + spacing with the new hub. Keep the bento structure.

## Verify

Rebuild + dev-login fetch `/studio/media` (curl csrf → `/api/auth/callback/dev` as
`rhythm@mindvalley.com` roles=Admin): confirm **Needs you** shows ≤5 rows + a "Show all 14" toggle in a
calm card (no full purple block); **In motion** is a per-agency scoreboard (no 40-item dump); clicking an
agency lands on Board filtered to it; the Calendar "No date yet" rail scrolls within a capped height; no
gold stage badges in the lists. `npm run lint` + `npm run build` clean. Final visual check by the user on
the deployed dev service.

---

# v2.2 — Clips tab: master–detail, grouped by source video (2026-07-09)

## Context

The **Clips & suggestions** tab renders ~100 clips as one flat grid of big purple-gradient cards (57
proposed + ~40 approved) — a wall, too cluttered ("Vishen won't like this"). Fix (locked with user):
**group clips by the source "main" video** and use a **master–detail** layout, with proposed vs approved
behind a **toggle** so only one set shows at a time.

## Design — rebuild `components/studio/media/ClipsPanel.tsx` (props unchanged)

- **Status toggle** (segmented): `Awaiting you (N) | Approved (N)` — one set at a time; proposed default.
- **Master–detail**:
  - **Left rail** — scrollable list of source videos for the active set. Group the active clips by
    `mediaSourceId`, name via `sourceNames` ("Other / unlinked" fallback), sort by clip-count desc. Each
    row: 🎬 title (truncate) + clip-count badge; selected row highlighted (brand tint + left accent).
  - **Right panel** — the selected video's clips as **calm cards** (surface + gold left-rail, **no purple
    gradient cap** — borrow the `ClipSummaryCard` treatment from `components/vishen/ClipBoard.tsx`): hook
    line, virality pill, format/timestamp, clamped caption; for the proposed set inline **Approve /
    Dismiss**, for approved set a read-only "Approved" state.
- Selection defaults to the first video and stays valid as Approve/Dismiss shrink/empty groups.
- Reuse the existing `onApprove` / `onDismiss` optimistic handlers from `MediaHub` (no `MediaHub` change;
  the tab pip already tracks `proposed.length`). Responsive: left rail stacks above the detail on mobile.

## Verify

Build + `tsc` clean; the tab is client-rendered so confirm structurally, then eyeball on deploy: toggle
switches sets; left rail lists videos with counts; picking a video shows only its clips; Approve/Dismiss
removes a clip and updates the count; no 100-card wall; calm cards (no purple gradient). `npm run lint` +
`npm run build` clean.

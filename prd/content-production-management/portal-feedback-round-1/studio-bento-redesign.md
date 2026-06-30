---
title: 'Studio bento redesign'
slug: 'studio-bento-redesign'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-30
updated: 2026-06-30
resolution: 7/7
build-status: built
build-date: 2026-06-30
build-log: .builds/studio-bento-redesign.build.md
---

# E9.9 · Studio bento redesign

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

The Studio page (`app/studio/page.tsx`) is Vishen's founder cockpit. Today it's a single long
vertical scroll, so the at-a-glance "how is the engine doing / what needs me" read is weak — you
have to scroll to assemble the picture. We redesign it into a **bento grid** led by an **engine
pipeline funnel**, so the whole state of content production is visible above the fold and the
work that needs Vishen sits as a fixed focal column. Direction was chosen by the user from an
interactive HTML mock (`context/mockups/studio-redesign.html`, the "Bento + engine" variant).
Outcome: a scannable founder cockpit where every overview number is a doorway into the matching
filtered ticket grid.

## Behavior

Studio renders as a CSS-grid bento (desktop ≥920px), top to bottom:

1. **Engine / pipeline funnel** (full-width hero, top) — four stages with big tabular counts and
   arrow connectors: **Media → clips · In production · Awaiting sign-off · Shipped**. Brand
   top-accent; the *Awaiting sign-off* lane carries the gold attention accent. Each stage is a link.
2. **Media → clips** (large, left) + **Awaiting your sign-off** (tall focal column, right) — the
   sign-off column stacks the clip review hero (`SignOffHero`) and shoot sign-off (`ShootSignOff`),
   spanning the media + pulse rows.
3. **The pulse** — four KPI cards (In flight · Being made now · Awaiting sign-off · Shipped),
   each clickable; *Awaiting sign-off* uses the gold `attention` tone.
4. **Flowing to your launches** (wide) + **Recently shipped** (strip).
5. **Propose-only** footnote.

Below 920px the grid collapses to a single column in the order: funnel → media → sign-off →
pulse → launches → shipped → footnote. Light and dark are both supported via existing tokens.

**Clickable overview → filtered grid.** Clicking a pulse KPI or funnel stage opens the relevant
existing ticket grid **pre-filtered**:

| Card / stage | Destination |
|---|---|
| In flight | `/studio/launches` |
| Being made now | `/studio/launches?ticketStatus=In Progress` |
| Awaiting sign-off | `/studio/sign-off` |
| Shipped | `/studio/shipped` |
| Funnel: Media → clips | `/vishen` |

## Rules & Logic

- **"Grid view" = the existing `QueueTable`** with its standard filters — not a new card view.
- **Pre-filter mechanism:** `QueueTable` gains an additive optional prop
  `initialFilters?: Partial<Record<Dim, string>>` that seeds its `sel` state on mount; default
  `{}` preserves today's behavior for every other caller. `/studio/launches` reads `searchParams`
  (`ticketStatus`, and the existing dims) and passes them through. Filter values must be the exact
  canonical strings from `lib/tickets/constants.ts` (e.g. `In Progress`, `Review`).
- **Funnel counts derive from existing selectors** — no new data source:
  Media→clips = count of Vishen media with suggested clips (`getVishenMedia` + `clipsByMedia`);
  In production = `pulseCounts().inProduction`; Awaiting = `pulseCounts().awaiting`;
  Shipped = `pulseCounts().shippedAll`.
- **Gold is attention-only** (CLAUDE.md). Only the *Awaiting sign-off* KPI/lane uses it.
- Layout is pure CSS grid (`grid-template-areas`) added to the studio section of
  `app/globals.css`; the funnel ports the mock's `.st-funnel`/`.st-lane` styles. Existing studio
  components (`SignOffHero`, `ShootSignOff`, `LaunchCard`, `ClipsList`, `Pulse`, `AddVishenMedia`,
  `ProposeFootnote`) are re-placed into grid zones, not rewritten.

## Data

No data-model or Airtable changes. All inputs already exist:
- `lib/studio/data.ts`: `loadStudio`, `pulseCounts` → `{ inFlight, inProduction, awaiting, shippedAll, asOf }`,
  `getVishenMedia`, `getLaunches`, `getReviewQueue`, `getPendingShoots`.
- `getClipsByIds` → `clipsByMedia` for the media→clips count.
- `lib/tickets/constants.ts`: `TICKET_STATUSES` / `PRIO_STATUSES` for filter values.

## Failure Modes

- **Empty states:** zero media, zero pending sign-off, zero launches, or null metrics each render
  the existing empty/`—` states inside their zone; the grid must not collapse awkwardly when a
  zone is empty (zones keep their grid area; show a quiet empty message).
- **Funnel count missing** (e.g. metrics not yet synced): show `—`, not `0`, and keep `asOf`'s
  "awaiting first sync" wording.
- **Unknown/blank `ticketStatus` param** on `/studio/launches`: ignore it (no filter applied),
  never error.
- **`initialFilters` regression risk:** because it's a shared component, default must be a no-op;
  verify other `QueueTable` callers (`/manager`, `/editor`, `/studio/ranking`, `/studio/shipped`,
  `/stakeholder`) are visually unchanged.
- **Narrow screens:** no horizontal page scroll; tall sign-off column must not leave a large gap
  (stretch it / let its card grow, as proven in the mock).

## Acceptance Criteria

1. `/studio` renders the bento grid: funnel hero on top, media + tall sign-off column, pulse,
   launches + shipped, footnote — in both light and dark, with no horizontal scroll.
2. The funnel shows four stages with correct counts derived from existing selectors; the Awaiting
   lane is gold; stages are links to the destinations above.
3. All four pulse KPIs are clickable and land on the correct grid; "Being made now" arrives with
   the grid **filtered to In Progress**; Awaiting → `/studio/sign-off`.
4. `QueueTable` accepts `initialFilters`; with no prop, every existing page behaves exactly as before.
5. Responsive collapse ≤920px follows the defined single-column order.
6. `npm run build` and `npm run lint` pass clean.

## Open Questions

None blocking. Possible later polish: extend pre-filtering to the other pulse cards' exact status
sets (In flight is multi-status), and add a real "Media → clips" pipeline view as a dedicated
destination instead of `/vishen`.

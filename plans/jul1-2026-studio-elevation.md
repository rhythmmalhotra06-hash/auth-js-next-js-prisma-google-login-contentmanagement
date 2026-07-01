# Elevate the Vishen Studio to match the shared prototype (+ shoots)

## Context

The live **Studio** (`app/studio/page.tsx` + `components/studio/*`, styled via `.st-*` in `app/globals.css`, data from `lib/studio/data.ts`) already covers ~85% of `context/mockups/studio-redesign.html`: a 3-lane funnel, media→clips, **shoots sign-off** (`ShootSignOff` approve/decline + `ShootsToFilm` fallback + `/studio/shoots` grid), pulse KPIs, launches, recently-shipped, governance footnote.

But it predates the **vishen-tracker prototype + brief we're now sharing** (`context/mockups/vishen-tracker.html`, `vishen-tracker-manual.html`, `vishen-view-brief.html`). The gap is the entire **published → performance** half. This plan adapts those pieces into the Studio and lifts the visual to the brief's treatment, keeping **shoots first-class** (they matter to Vishen).

## What we adapt from the prototype

1. **Lifecycle pipeline ribbon** — evolve `PipelineFunnel.tsx` (today: media→clips, in production, awaiting sign-off) into the prototype's **4 colour-coded stages: In production → Awaiting sign-off → Ready to publish → Published**. Adds the missing *Ready to publish* + *Published* stages and the learnable colour language (violet / gold / blue / green) that repeats in pills + table. Keep media→clips as its own lead zone.
2. **"Live & performing" band (NEW)** — total **views** + avg engagement + published count + top performer. Studio has no performance surface today; this is the biggest gap. Source = `social_metrics` (manual now, Postiz later) per `plans/jul1-2026-postiz-performance.md`. **Views + engagement** (impressions retired by Meta Apr-2025).
3. **End-to-end thread + detail drawer (NEW)** — per-request table leading with the mandated 5 columns (Title, Priority, Assigned, Ticket status, Priority status) + **Channel · Live link · Published · Views · Engagement**, and a drawer with the **lifecycle timeline + performance card**. New Studio zone or `/studio/delivered`; reuse `ContentReviewQueue` / `ReviewQueueTable` table patterns.
4. **Publish + log-numbers actions** — "Add live link → mark published" and manual "log the numbers," reusing existing ticket fields (`TICKETS.fields.publishedAt`, `outputLink`) + `social_metrics` — no new Airtable field.
5. **Filters** — channel chips, **time filter incl. "This year"** (Vishen's recurring "what did we publish last year?"), asset-type.

## Shoots — keep & elevate (important to Vishen)

`ShootSignOff.tsx` / `ShootsToFilm.tsx` already surface title, format, filming date, location, brief + approve/decline. Keep them in the "Awaiting you" hero; **elevate the styling** to the brief (date/location as chips, refined rows), and **link a shoot to the ticket it becomes** (`ShootRow.ticketIds`) so Vishen can follow a shoot through to the published asset. Shoots also read as a stage feeding the ribbon.

## Visual elevation

Lift the `.st-*` classes to the prototype/brief treatment: ribbon top-accent colour language, **compact numbers** (75.2K), the saturated performance band, refined pills + tighter type scale, the detail drawer. Target parity with `studio-redesign.html` once updated.

## Approach

- **Step 1 — mockup (now, shareable):** update `context/mockups/studio-redesign.html` into the unified elevated target — add the 4-stage ribbon (incl. Published), the performance band, the thread + drawer, filters, and elevated shoots. This is the fast, shareable artifact and the spec for the React work.
- **Step 2 — React port:** extend `PipelineFunnel` → ribbon; new `PerformanceBand` + `Thread`/`Drawer` components; elevate `ShootSignOff`; add a `social_metrics` join selector in `lib/studio/data.ts`; wire the publish/log actions in `app/studio/actions.ts`.

Critical files: `app/studio/page.tsx`, `components/studio/{PipelineFunnel,Pulse,ShootSignOff,ShootsToFilm,ContentReviewQueue}.tsx`, `app/globals.css` (`.st-*`), `lib/studio/data.ts`, `app/studio/actions.ts`, `context/mockups/studio-redesign.html`.

## Verification

- Step 1: open the updated `studio-redesign.html` — ribbon shows 4 stages incl. Published, performance band + thread + drawer render, shoots elevated, filters work.
- Step 2: `npm run dev` → `/studio` — ribbon + band render from `social_metrics` (manual entries), shoots still approve/decline, "This year" filter works, publish→log-numbers flow round-trips.

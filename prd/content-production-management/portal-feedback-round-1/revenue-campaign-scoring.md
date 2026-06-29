---
title: 'Revenue + campaign scoring'
slug: 'revenue-campaign-scoring'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/revenue-campaign-scoring.build.md
---

# E9.5 · Revenue + campaign scoring

> **As-built note (Jun 29):** code analysis found the live Airtable `SCORE` formula
> already includes **Event Revenue** (+ importance + complexity) and is marked "do not
> edit manually". So revenue was NOT re-derived app-side (would double-count). Instead
> the build adds an **app-side deadline + campaign urgency layer** blended on top of the
> normalized SCORE in `getQueueTickets` (new `weights.campaign` knob; reuses
> `dueProximityNorm`; adds `campaignProximityNorm`). The live queue now sorts and shows
> the blended 0–100 priority; manual rank still overrides. SCORE itself is untouched.

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Monique: "the prioritization algorithm will rank based on this… it sees revenue automatically from which item you are selecting — if people select the summit or a mastery it will be prioritized over something else that has lower revenue." Gareth: "it is revenue and deadline… and the campaign." The current scorer ([lib/tickets/scoring.ts](../../../lib/tickets/scoring.ts)) uses due-proximity + event-tier + variants + effort, but has no explicit revenue input and ignores the linked campaign calendar's dates. This feature adds revenue-tier and campaign-calendar awareness.

## Behavior

1. **Revenue from the real field, bucketed.** Read the Event Type table's existing **"Average revenue"** currency field (`fld9G6n7iKtYlUZ0o` on `tblzTFTZ2ttEvi2j1`) — confirmed present, no new field. Bucket each event type's average revenue into **high / medium / low** and map those buckets to a 0–1 `revenueNorm` input (e.g. high=1.0, med=0.6, low=0.3). Bucket thresholds live in the scoring admin config so they're tunable; surface the resulting bucket per event type in [components/settings/ScoringConfigEditor.tsx](../../../components/settings/ScoringConfigEditor.tsx). (The legacy name-pattern `tierNorm` heuristic remains only as a fallback when an event type has no average-revenue value.)
2. **Campaign proximity as a separate weighted term.** When a ticket links an `OfficialCalendar` (`officialCalendarId`), add a **distinct** campaign-proximity term to the score — proximity to the campaign `startDate`/`endDate` window — with its **own weight** (`w_campaign`) in the admin config, alongside (not replacing) the existing due-date-proximity term. Extend `computePriorityScore` inputs in [lib/tickets/scoring.ts](../../../lib/tickets/scoring.ts) and populate average-revenue + calendar dates where the score is computed in [lib/tickets/data.ts](../../../lib/tickets/data.ts).

## Rules & Logic

- Revenue derives from the **real "Average revenue" field**, bucketed; bucket thresholds + the high/med/low→norm mapping are admin-editable. Name-pattern heuristic is fallback only.
- The campaign term is **additive and independently weighted** (`w_campaign`) — it does not override the due-date term; a ticket with no linked calendar simply scores 0 on the campaign term (no regression).
- All weights (incl. `w_campaign`) stay in the existing admin config so the mix is tunable without code changes.

## Data

- Event Type **"Average revenue"** currency field `fld9G6n7iKtYlUZ0o` (existing — confirmed). Existing `tierNorm` (`fldT7qw1xr1B6zMeR`), `loadWeight` (`fldXPpMwgvKWcRwF5`). `OfficialCalendar.startDate`/`endDate` (existing).
- New scoring-config knobs (in the existing `⚙️ Scoring Config` admin store): `w_campaign` (weight), revenue bucket thresholds, and the high/med/low→norm mapping. No new event-type field needed.

## Failure Modes

- **No tierNorm + no recognizable event name** → default tier (current behavior).
- **Calendar linked but dates missing** → ignore the campaign term, use `dueDate`.
- Config read failure → fall back to hardcoded `DEFAULTS` (existing behavior).

## Acceptance Criteria

- A ticket on a high-average-revenue event type ranks above an otherwise-identical low-revenue ticket.
- A ticket linked to a near-deadline campaign ranks above an identical ticket with no campaign link (campaign term contributes independently).
- The scoring admin UI shows each event type's revenue bucket and the editable thresholds + `w_campaign`, and edits persist.

## Open Questions

**Resolved (Jun 29):** Revenue comes from the Event Type **"Average revenue"** field, bucketed **high/med/low** → 0–1 (no new field). Campaign proximity is a **separate, independently weighted** term (`w_campaign`) added to the due-date term, not an override.

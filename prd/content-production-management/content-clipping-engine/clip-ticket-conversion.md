---
title: 'Clip → Ticket Conversion'
slug: 'clip-ticket-conversion'
scope: feature
status: discovery
parent: content-production-management/content-clipping-engine.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 6/7
---

# Clip → Ticket Conversion

> Part of [AI Content Clipping Engine](../content-clipping-engine.md)

## Purpose

Turn the Reels clips a clipper selects into real production tickets in the existing queue — in one batch action, without re-typing taxonomy per clip — so selected clips flow into the existing Vishen approval gate within hours.

## Behavior

1. On the Strategy Viewer the clipper multi-selects clips and hits **"Create tickets."**
2. A single lightweight step (`components/clipping/ClipApprovalModal.tsx`) captures the **shared taxonomy once** — reusing E3 reference data (`lib/intake/data.ts`): **Event Type, Asset Type (filtered by Event Type), Official Calendar, Due Date** — applied to all selected clips.
3. The `convertClipToTicket` (batch) server action loops the selected clips through the **existing `createTicket()`** (`app/intake/actions.ts`), creating N tickets; each `ClipSuggestion` gets `status='approved'` + its `ticketId`. Unselected clips remain `proposed`.

## Rules & Logic

- **Auto-derived per clip:** `title` (clip hook line, truncated ≤40 chars), `creativeBrief` (rationale + caption + hook + timestamp range), `typeOfRequest='Video'`, `teamServiceLevel='Social Media Video'` (editable), `sourceLinks` (source URL + timestamp range for provenance), `requesterId` (session → Employee).
- **User-selected (shared across the batch):** Event Type, Asset Type, Official Calendar, Due Date — the 4 fields that can't be safely auto-derived.
- **Do not fork `createTicket()`** — feed it a fully valid input so the required-taxonomy + prioritization-scoring invariant (E3/E4) holds; scoring + auto-assignment run automatically.
- **Approval reuses the existing flow:** tickets land at `prioStatus='New Request'` (the `createTicket()` default) → existing Vishen review gate (`prioStatus='To be reviewed by Vishen'`, E5). No new approval surface.

## Data

- Reads `ClipSuggestion` (the selected clips) + reference data (event/asset types, calendars, service levels).
- Writes `Ticket` rows (via `createTicket()`), `TicketEvent` (first transition, by `createTicket()`), and updates `ClipSuggestion.status` + `ticketId`.

## Failure Modes

- A clip fails validation (e.g. title empties after truncation) → that clip is skipped with a per-clip error; the rest of the batch still succeeds.
- No session→Employee mapping → block with a clear message (requester is required).
- Asset Type not linked to the chosen Event Type → the modal filters it out (can't be selected), mirroring intake.
- Partial batch failure → report which clips converted and which didn't; converted ones stay `approved`.

## Acceptance Criteria

- Selecting clips → modal asks only Event/Asset/Calendar/Due → creates N tickets that appear in `/tickets` and the `/manager` queue, ranked (scoring ran).
- Each converted `ClipSuggestion` shows `status='approved'` + `ticketId`; `sourceLinks` carries the clip provenance.
- Created tickets sit at `prioStatus='New Request'` and enter the existing Vishen review gate.

## Open Questions

- Should the batch allow per-clip overrides of the shared Due Date / Asset Type, or is one shared set per batch enough for v1? (Plan assumes shared.)
- Default Event Type / Asset Type for Reels (e.g. "Social Media Promotion" + a short-form social asset type) to pre-select and cut clicks further — confirm the live taxonomy values.

---
prd: 'content-production-management/portal-feedback-round-1/revenue-campaign-scoring.md'
feature: 'E9.5 · Revenue + campaign scoring'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 3
total_steps: 3
---

# Build Log: E9.5 · Revenue + campaign scoring

## Approved Plan

Finding: the live Airtable SCORE formula already includes Event Revenue (+ importance +
complexity) and is "do not edit". It excludes deadline & campaign. So E9.5 = an APP-SIDE
urgency layer on top of SCORE (no formula edit, no revenue double-count).

- **Step 1** — config: add `weights.campaign` (default 0.5) to config.ts + read `w_campaign` in repository.ts (default fallback; no Airtable row required).
- **Step 2** — scoring.ts: `campaignProximityNorm(start,end,now,window)` + `blendQueueScore({scoreNorm,dueNorm,campaignNorm}, cfg)`.
- **Step 3** — getQueueTickets: load campaign windows (OFFICIAL_CALENDARS start/end), min-max normalize SCORE → scoreNorm, compute dueNorm + campaignNorm, blend, sort by queueRank ?? blended, display the blended 0–100 value so the number matches the order.

Only getQueueTickets changes; getMyRequests/getRecentShipped keep raw SCORE.
Verify: lint + build + manual.

## Progress

- [x] Step 1: Config knob (weights.campaign / w_campaign)
- [x] Step 2: scoring helpers (campaignProximityNorm, blendQueueScore)
- [x] Step 3: blend + sort in getQueueTickets

## Result

Files modified: 4 (`lib/scoring-config/config.ts`, `lib/scoring-config/repository.ts`, `lib/tickets/scoring.ts`, `lib/tickets/data.ts`)
Verification: `npm run lint` clean (only pre-existing `_drop` warnings), `npm run build` passes.
As-built note: revenue was NOT re-derived (the Airtable SCORE formula already includes
Event Revenue + importance + complexity, and is "do not edit"). We added an app-side
deadline + campaign urgency layer blended on top of the normalized SCORE; the live queue
now sorts and displays the blended 0–100 priority. `w_campaign` defaults to 0.5 (tunable
once a row is added to the ⚙️ Scoring Config table).

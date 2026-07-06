# Plan: Resolve PRD Success Criteria (+ fold in context-folder resolutions)

## Context

The product PRD at `prd/content-production-management.md` was imported from `CLAUDE.md`
and sat at low resolution — `Success Criteria` was completely empty, and several
sections carried trailing `[UNRESOLVED]` markers. The user added a `context/` folder
(decision-log, prioritization-algorithm, README) that resolves several of those gaps
without further guessing.

In discovery, the user made two calls on success metrics:
- **North-star = End-to-end throughput** (full intake→publish→performance cycles run in-tool).
- **Only committed formal criterion = Manager efficiency (≤5 min/day).**

This plan updates the PRD file only — it is a documentation/discovery edit, no code.

## Changes (single file: `prd/content-production-management.md`)

### 1. Success Criteria — resolve (was empty)

Write three tiers:

- **North-star — End-to-end throughput** (user's choice):
  - *Ship gate (MVP done):* ≥1 real request completes the full lifecycle
    (Requested → Prioritized → Assigned → In Production → In Review → Approved →
    Published → Performance Tracked) entirely in-tool, every transition recorded as a
    `ticket_events` row, no step tracked in Jira/Slack/hand-kept Airtable.
  - *30-day target (proposed, adjustable):* ≥10 tickets reach Performance Tracked in-tool.
- **Committed operational criterion — Manager efficiency** (user's choice):
  - Managers spend ≤5 min/day confirming queue order (the Hackathon claim).
  - Queue-override rate (manual `queue_rank` changes vs algorithm order) trends down
    week-over-week as trust in the urgency×complexity scoring grows.
- **Tracked but NOT gated** (kept so they aren't lost): adoption % via intake,
  performance-link coverage %, stakeholder weekly-active + status-ping reduction.
- Append `[UNRESOLVED]` only on the two genuinely-open measurement details: the exact
  30-day throughput number, and how manager 5-min/day is instrumented (session time vs
  self-report).

### 2. Vision — close its trailing gap

The Vision section's trailing `[UNRESOLVED]` (no success metric) is now answered by the
throughput north-star — replace it with a one-line pointer to Success Criteria.

### 3. Boundaries — resolve the scope-fence gap

Fold in the Phase 1 fence from `context/decision-log.md` + `context/README.md`:
no predictive capacity modeling, no auto-rebalancing across editors, no SLA timers
(queue model replaces SLAs by design). Replace the trailing `[UNRESOLVED]`.

### 4. Open Questions — tighten to the 4 explicit open decisions

Replace the partial list with the decision-log's "NOT yet settled" set: event-tier
ranking [Moniek], performance-metrics home (Prio table vs Asset Library) [team], Brain
table names + stable key [team], and the prio/ticket/shoot status enum values
(from live schema export). Keep the Blinkwork SSO / employee-mapping gap from the README.

### 5. Frontmatter

Recompute `resolution:` (expected ~6/8 after this pass — remaining: Users partial on
access-control which depends on the open Blinkwork SSO question, and Epics which needs a
Phase 5 decomposition pass). Bump `updated:` to today. Update `prd/index.md` row to match.

## Out of scope (next steps, not this plan)

- **Epics decomposition** (Phase 5) — structure the 7 first-tasks into formal epics with
  dependency ordering. This is the natural next discovery step.
- Running `context/export-airtable-schema.js` to reconcile `[VERIFY]` fields — gated on
  being ready to do sync work, not on this PRD edit.

## Verification

- Re-read `prd/content-production-management.md`; confirm no stray `[UNRESOLVED]` remain
  except the two intentional measurement-detail markers + Users + Epics.
- Confirm the `resolution:` count in frontmatter matches the actual count of
  marker-free sections, and `prd/index.md` shows the same.
- `/prd status` would list only the intended remaining gaps.

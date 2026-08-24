---
title: 'Performance Loop'
slug: 'performance-loop'
scope: epic
status: in-progress
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-08-20
resolution: 5/7
phase: 1
---

# Performance Loop

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> **Pulled into Phase 1** (was Phase 2). Manual entry and connector-fed numbers write the
> same table through the same code path, so there was nothing left to defer: the sink is the
> feature, the automated source is an upgrade to it.

## Purpose

Close the differentiator loop: every published asset carries the numbers it earned, so "who
edited this AND how did it perform" is answered in one place.

## Decisions (resolved 2026-08-20)

**Source — Hootsuite Perch via the claude.ai connector.** `https://mcp.hootsuite.com/perch`
is a live remote MCP server (OAuth 2.1 + DCR at `platform.hootsuite.com`, scopes `offline` +
`analytics:read`). Hootsuite already holds the platform tokens, so this path skips Meta App
Review and the TikTok audit entirely — which was the schedule risk in the Postiz plan.
Postiz (`plans/jul1-2026-postiz-performance.md`) remains the documented fallback, unbuilt.

**No app-side OAuth for now.** The app stores no Hootsuite credential; a human-initiated
connector session POSTs to the ingest route (`docs/perch-pull-runbook.md`). `offline` is a
supported scope, so adding a stored refresh token + cron later is additive.

**Metrics home — a dedicated `social_metrics` table keyed to the published URL.** This
settles the long-open "Prio table vs Asset Library" question: neither. The only identifier
that exists on both sides of the join today is the permalink, and `model Performance` is
asset-FK'd and unused. Workflow state stays app-owned; this is app-owned too.

**Metric set — store every metric, show the best available.** Glen asked for impressions +
engagement rate; Meta deprecated IG `impressions` in Apr 2025 and the Studio mockups say
views. All metric columns are nullable, and the band labels what it actually counted
("Total reach" vs "Total views") plus how many posts contributed. No source is forced into
another's vocabulary.

## Workflows

1. **Automated-ish pull** — a connector session pulls per-post numbers →
   `POST /api/metrics/social` (bearer `SYNC_SECRET`) → `social_metrics`, matched to a video
   by normalized permalink. Idempotent per (source, post, window, captured day).
2. **Manual entry** — Studio drawer → Performance panel (views / impressions / eng %,
   accepts `75.2k`). Writes `source: 'manual'` through the same `ingestSocialMetrics`.
3. **Read** — the Studio "Live & performing" band totals the primary metric, averages
   engagement, and names the top performer; each published card shows its own line.

## Boundaries

- Reference/ops data stays Airtable's. The app mirrors a readable summary into the
  free-text "24h Data" field **only when it is empty** — a note the team wrote by hand is
  never overwritten (same decision-lock rule as clip statuses).
- Unmatched rows are stored and counted, never dropped: a drifted permalink must be
  visible, not silent.
- No cron and no stored Hootsuite token in this phase.

## Dependencies

E5 (published assets to attach numbers to). No longer blocked on anyone: the Hootsuite
access question that sat with Glen is resolved by the connector.

## Success Criteria

- Every published video with a live link either shows numbers or is counted in "N posts
  still need numbers" — no silent blanks.
- Re-running a pull the same day does not change row counts (dedupe holds).
- ≥10 tickets/posts reach Performance Tracked within 30 days of the first real pull.
- Tracked, not gated: performance-link coverage %.

## Features

- `social_metrics` table + `SocialMetric` model (migration `0018_social_metrics`).
- `lib/metrics/social-perf.ts` — ingest, permalink matching, latest-per-video read;
  `lib/metrics/social-metric-types.ts` — the server-free parse/summarize half.
- `POST /api/metrics/social` — bearer-guarded ingest (`requireSyncSecret`).
- Studio "Live & performing" band + per-card numbers + drawer Performance panel.
- `docs/perch-pull-runbook.md` — the connector pull, and how to read its response.

## Open

- **Capability spike still owed** (`context/hootsuite-perch-capabilities.md`): does Perch
  report per-post rows with a post id/permalink, or profile-level only? Does it see
  natively-posted content? This decides whether attribution is exact or fuzzy.
- Engagement-rate definition parity with Glen/Marisha (whose denominator?).
- Whether the stakeholder read-only view gets the same band (Studio first, by decision).

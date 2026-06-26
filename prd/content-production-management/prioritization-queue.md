---
title: 'Prioritization & Queue'
slug: 'prioritization-queue'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
---

# Prioritization & Queue

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Implement the scoring function per `context/prioritization-algorithm.md` (seed weights, normalization, lead-time adjustment, tie-breaks: due date → event tier → FIFO), compute `priority_score`, support manager drag-to-reorder of `queue_rank` (which overrides `priority_score` for display order when set), and auto-assign only the ~20–30% unambiguous cases. Phase 1 is manual-assisted — the score gets order ~80% right so managers adjust only the edges.

**Scoring inputs (post 26 Jun, `Context/MoreContext/CLAUDE.md` §5):** `urgency × complexity`, weighted by **Event Type** + **Asset Type** complexity, plus a **strategic-value input** — a founder-priority signal Vishen controls. If Event Type or Asset Type tags are missing the score is wrong, so tagging is mandatory at intake.

**Learning prioritization (E12, Phase 3, propose-only):** later, the score weights are refined from observed outcomes (manual re-ranks, due-date slips, per-editor cycle time). Proposed weight changes are surfaced for Vishen/manager confirmation — never auto-applied. This keeps the Phase-1 manual-assisted decision intact while improving the assist over time.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E3 (needs tickets carrying complete taxonomy + due_date). Reads the event-tier mapping — an open decision owned by Moniek. The **strategic-value weighting** and final **Vishen sign-off** on the scoring logic are open (owner: Vishen). No predictive capacity, no auto-rebalancing, no SLA timers (Phase 1 scope fence). Feeds the future [Learning Prioritization](learning-prioritization.md) epic (E12).

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

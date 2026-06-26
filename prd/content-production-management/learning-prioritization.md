---
title: 'Learning Prioritization'
slug: 'learning-prioritization'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 1/7
phase: 3
imported-from: "Context/MoreContext/CLAUDE.md"
---

# E12 · Learning Prioritization

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> Intelligence-layer capability **#6** (augments prioritize). **Phase 3.** Propose-only. Makes the Phase-1 manual-assisted assist better each week without taking the authority from the manager.

## Purpose

Observe the signals the manual queue already generates and propose better score weights:
- which tickets got manually re-ranked (and in which direction)
- which slipped their due dates
- which editors clear which asset_types fastest (cycle time per type per person)

Output: *proposed* weight adjustments — e.g. "your manual reorders consistently push event-tier above due-date; suggest raising `w_event`." Also capacity-aware **assignment suggestions** for the ~20–30% unambiguous cases (cycle-time history + current load + asset-type preferred_editor).

**Propose-commit handoff (`Context/MoreContext/CLAUDE.md` §7):** never auto-applied — Vishen / the manager confirms each change. This respects the Phase-1 "manual-assisted, automation is an assist not the authority" decision and the OODA loop the team already works in. A capability may graduate from propose-only to auto-with-undo along a dated trust ladder, but only after it is demonstrably right.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E4 (the scoring function + `priority_score`/`queue_rank` signals to learn from) and E7 (outcomes/metrics must flow back — gated on the Content & Comms matching key, owner: Rhythm / Matt). Strategic-value weighting + final scoring sign-off owned by Vishen.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

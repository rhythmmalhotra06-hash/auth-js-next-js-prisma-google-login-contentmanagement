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

Implement the `urgency × complexity` scoring function per `context/prioritization-algorithm.md` (seed weights, normalization, lead-time adjustment, tie-breaks: due date → event tier → FIFO), compute `priority_score`, support manager drag-to-reorder of `queue_rank` (which overrides `priority_score` for display order when set), and auto-assign only the ~20–30% unambiguous cases. Phase 1 is manual-assisted — the score gets order ~80% right so managers adjust only the edges.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E3 (needs tickets carrying complete taxonomy + due_date). Reads the event-tier mapping — an open decision owned by Moniek. No predictive capacity, no auto-rebalancing, no SLA timers (Phase 1 scope fence).

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

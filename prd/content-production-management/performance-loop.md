---
title: 'Performance Loop'
slug: 'performance-loop'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
phase: 3
---

# Performance Loop

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> **Deferred to Phase 3.** The Phase 1 ship gate ends at Published; this epic closes the lifecycle to Performance Tracked afterward. It is the intelligence layer's capability #5 (`Context/MoreContext/CLAUDE.md` §6).

## Purpose

Close the differentiator loop: attach metrics to published assets and surface them in the stakeholder view so "who edited this AND how did it perform" is answered in one place. Per the 26 Jun decision (`Context/MoreContext/CLAUDE.md` §3), metrics are **looked up** from an external **Content & Comms** base via a shared matching key — *not hand-entered*. The connectors behind Content & Comms (Clarisights, Amplitude, Ahrefs) are already connected at Mindvalley.

On top of the raw display, the **propose-only performance insight** surface correlates asset *attributes* (event_type, asset_type, dimension, audience, positioning) with metrics to surface what works — e.g. "9×16 cold-audience Masterclass trailers outperform the asset-type average by ~40%." Start with simple grouped aggregates and sample-size guardrails (don't present a 2-asset segment as a trend); a model is only needed once free-text attributes are factored in. These insights feed brief generation (E9) and learning prioritization (E12).

Whether metrics live on the Prio table vs Asset Library is an open team decision (currently modeled library-side in `schema.sql`); whether they aggregate across placements is open (owner: Rhythm / Moniek).

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E5 (published assets must exist to attach metrics to). **The single unlock is the Content & Comms base URL + shared matching key** (owner: Rhythm / Matt) — without it metrics can't flow and neither this epic nor E12 (learning prioritization) can function. Phase 3 — deferred per product decision; do not build in Phase 1.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

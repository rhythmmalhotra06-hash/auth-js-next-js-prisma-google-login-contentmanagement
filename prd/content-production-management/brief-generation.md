---
title: 'Brief Generation'
slug: 'brief-generation'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 1/7
phase: 1
imported-from: "Context/MoreContext/CLAUDE.md"
---

# E9 · Brief Generation

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> Intelligence-layer capability **#2** (augments intake). **Phase 1** — pulled forward by the 26 Jun "high-octane / 50×" decision. Propose-only.

## Purpose

When a request comes in, draft the creative brief from evidence so the human starts from a draft, not a blank page (the Uplifted/Storyteq "what worked → what to make next" pattern). On intake of e.g. "Masterclass trailer, cold":

1. Pull top-performing past assets of that event_type × asset_type (from the performance loop, E7).
2. Pull the asset type's DNA (requirements + feedback standards).
3. Pull relevant Brain nodes (Insight, Rule, Product spec, Customer Avatar).
4. Draft a brief grounded in all three — references, angle, hook timing, CTA.

**Propose-commit handoff (`Context/MoreContext/CLAUDE.md` §7):** the draft lands in a **staging field** (`brief_ai_draft`); the manager edits and **commits** it to the live `brief` field. The AI never writes the live brief, and downstream automation fires only off the live field. The 50× comes from collapsing drafting time, not deciding time — a 30-minute brief becomes a 30-second approve. Cite the evidence (assets/metrics/nodes) the draft drew from; no unsourced assertions.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E3 (intake form + the `brief_ai_draft` staging column on the request). Uses E7 performance insights when available, and degrades gracefully (DNA + Brain only) before metrics flow. Reads the asset-type DNA (two-way synced — owner: Matt) and Brain nodes (table names TBD — owner: Garrett).

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

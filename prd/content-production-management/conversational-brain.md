---
title: 'Conversational Brain'
slug: 'conversational-brain'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 1/7
phase: 2
imported-from: "Context/MoreContext/CLAUDE.md"
---

# E11 · Conversational Brain

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> Intelligence-layer capability **#4** (augments all, read-only). **Phase 2.** The only capability with **no commit step** — it writes nothing.

## Purpose

A natural-language second way into the same data the portal surfaces. An operator asks in side-chat or Claude Code:
- "what's blocking the Summit launch?"
- "draft 3 social cutdowns from the Quest shoot"
- "which editor has capacity for a VSSL this week?"
- "what did the last 5 Masterclass trailers average on CTR?"

The portal stays the structured surface; natural language is the second entry point over the same records. **Read-only — no propose, no commit.** Cite the records each answer draws from.

> **Hybrid-model note:** under the Phase-1 Postgres model this is a query layer over the app database. It reaches full value at the **Blinkwork-on-Brain migration**, where event_types, assets, people, and performance live as brain nodes (Asset, Metric/KPI, Person, Channel, Event) and the capability largely falls out of modeling on the brain (`Context/productization.md`).

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E1 (data layer) + E5 (lifecycle/records to query). Full value depends on the Brain migration (nouns as brain nodes) — forward-looking under the hybrid model.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

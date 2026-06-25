---
title: 'Two-Way Sync (outbound)'
slug: 'two-way-sync'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
---

# Two-Way Sync (outbound)

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Wire the outbound half of sync: push transactional writes (tickets, assets, approvals, shoots) from Postgres back to Airtable, batched ≤10 records/request with exponential backoff on 429, idempotent via `airtable_id`. Postgres is primary for this data; Airtable receives the mirror. Built last, after inbound reads (E2) are stable.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E5 (transactional data must be stable and complete before pushing back). E1/E2 for schema + `airtable_id` provenance. Hard constraint: Airtable ~5 req/sec + monthly caps.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

---
title: 'Reference Sync (inbound)'
slug: 'reference-sync'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
---

# Reference Sync (inbound)

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Build the one-way Airtable→Postgres sync for reference data (employees, dimensions, event_types, asset_types, dna) via webhook + nightly reconcile, upsert-on-`airtable_id`. Includes running `context/export-airtable-schema.js` and reconciling every `[VERIFY]` field name and enum in `schema.sql` against the live bases before any sync runs. Reference data is read-only in the app — edited in Airtable, synced down.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E1 (Prisma models + database must exist). Provides the reference data that E3 (intake lookups), E4 (event-tier), and E5 read. Constrained by Airtable's ~5 req/sec limit + monthly caps.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

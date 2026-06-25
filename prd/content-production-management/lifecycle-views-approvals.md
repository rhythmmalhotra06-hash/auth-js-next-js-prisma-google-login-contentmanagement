---
title: 'Lifecycle, Views & Approvals'
slug: 'lifecycle-views-approvals'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
---

# Lifecycle, Views & Approvals

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Implement the lifecycle state machine (Requested → Prioritized → Assigned → In Production → In Review → Approved → Published) writing a `ticket_events` row per transition; the three role views (Editor/Designer, Manager, Stakeholder/Agency) with the mandated 5-column header (Title, Priority, Assigned, Ticket Status, Priority Status); approvals with decision-locks that block the next state transition; asset version-stacking (raw vs final under one logical asset); and the distribution-URL link to the social calendar. Stakeholder/agency access is free and read/comment-only (no paid seat).

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E3 (tickets). Runs in parallel with E4. Feeds E6 (outbound sync) and E7 (performance). Status enum values (`prio_status`, `ticket_status`) are an open decision — resolved from the live schema export.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

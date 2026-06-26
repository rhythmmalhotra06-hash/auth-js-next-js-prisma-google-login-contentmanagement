---
title: 'Intake'
slug: 'intake'
scope: epic
status: discovery
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 2/7
---

# Intake

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Build the intake form with the settled conditional chain: Event Type first → filters the Asset Type list → auto-fills Team Lead and Preferred Editor as read-only lookups from the asset type → auto-suggests Dimensions → then Title, Creative Brief, CTA, Positioning, Audience (cold/warm), Due Date. Priority and Assignee are NOT on the form. Enforce required taxonomy at submit — missing tags produce wrong priority scores.

**Taxonomy additions (post 26 Jun, `Context/MoreContext/CLAUDE.md` §8):** the Event/Asset Type lists now carry the **Social = film** unification and the new **Video / Build Process-Document / Social Media Clips** category cuts. These are list additions to the existing spine, not new primary axes. [VERIFY] against the live bases.

**AI brief generation (E9, propose-only) plugs in here.** On a new request, the system drafts the creative brief into a **staging field** (`brief_ai_draft`) from top-performing past assets + the asset-type DNA + relevant Brain nodes; the requestor/manager edits and **commits** it to the live `brief` field. The form never auto-fills the live brief — this is the propose-commit handoff (`Context/MoreContext/CLAUDE.md` §7): the AI proposes, a human commits, and downstream automation only ever fires off the live field.

## User Stories

[UNRESOLVED]

## Workflows

[UNRESOLVED]

## Boundaries

[UNRESOLVED]

## Dependencies

E1 (tickets table) and E2 (event_types, asset_types, dimensions, and employee lookups must be synced down first). Two form variants exist (Ads Creative, Pathway Organic) — [VERIFY] against `appDZnMnJGehbSOo5`.

## Success Criteria

[UNRESOLVED]

## Features

[UNRESOLVED]

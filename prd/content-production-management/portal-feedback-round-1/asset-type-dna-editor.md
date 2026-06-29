---
title: 'Asset-type DNA editor'
slug: 'asset-type-dna-editor'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/asset-type-dna-editor.build.md
---

# E9.7 · Asset-type DNA editor

> **As-built note (Jun 29):** storage pivoted from Postgres to **Airtable fields on the
> app-owned Creative Services Asset Type table** (`tblLbcgob2Bxevugy`) — the app is
> Airtable-direct, so the Postgres `Dna` path was fragile. New fields: DNA / Requirements
> (`fldogRGYGUJq6rHIX`), Feedback Standards (`fldhlP1atHGC6diSS`), DNA Updated By
> (`fldb3LMpdlPikEVKf`). Editor at `/settings/asset-types`; edit auth = admin (all) or the
> asset type's team lead (own), re-checked server-side.

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Monique called this "step one… everything lies moving forward on asset type and event type — these asset types need to have a DNA assigned to them as well with the rules." Rhythm's intent: "give the team enough access front end to be able to make these changes themselves, like giving them an admin panel so that you can append the rules." The `Dna` model exists in Prisma (`requirements`, `feedbackStandards`) and `AssetType.dnaId` exists but is unpopulated; Airtable sync was deferred because the Airtable DNA field is free-text in a different base. Chosen approach: an **app-native editor**, DNA stored app-side.

## Behavior

1. A new admin panel at **`/settings/asset-types`** ([app/settings/asset-types/page.tsx](../../../app/settings/asset-types/page.tsx)) listing asset types.
2. Per asset type: edit DNA `requirements` + `feedbackStandards`; view (read-only) team lead, preferred editor, linked event types, and dimensions.
3. A `components/settings/AssetTypeEditor.tsx` component mirroring the pattern of [components/settings/ScoringConfigEditor.tsx](../../../components/settings/ScoringConfigEditor.tsx).
4. A `lib/asset-types/` repository with `updateDna(assetTypeId, { requirements, feedbackStandards })` that writes the Postgres `Dna` row and links `AssetType.dnaId`.

## Rules & Logic

- **App-native storage** — DNA lives in Postgres `Dna`; this feature does not round-trip to the Airtable Ads-Creative-Library DNA base.
- **DNA only** — per-clip-type *generation* rules stay in the existing `/settings/clip-rules`; this panel owns DNA (`requirements`, `feedbackStandards`) plus read-only reference fields.
- **Access: admins + team leads.** Admins (via `getAdminAccess()`, [lib/admin/access.ts](../../../lib/admin/access.ts)) can edit DNA for **any** asset type. A **team lead** can edit DNA **only for asset types where they are the team lead** (`AssetTypeTeamLead`); they see others read-only. Nav entry added in [lib/roles.ts](../../../lib/roles.ts) for both.
- Reference fields (team lead, preferred editor, dimensions, event-type links) remain **read-only** here — they are edited in Airtable per the sync rules (CLAUDE.md §8); this panel only owns DNA.

## Data

- Prisma `Dna` (`requirements`, `feedbackStandards`) + `AssetType.dnaId` (existing, currently unpopulated). This feature populates them.

## Failure Modes

- **Asset type with no DNA yet** → create a `Dna` row on first save and link it.
- **Concurrent edits** → last-write-wins with an updated-by/updated-at stamp (mirror the clip-rules audit pattern).

## Acceptance Criteria

- Editing DNA for an asset type in `/settings/asset-types` persists to the `Dna` row and links `AssetType.dnaId`.
- Reload shows the saved DNA.
- An admin can edit any asset type's DNA; a team lead can edit only their own asset types and sees the rest read-only; users with neither role cannot reach the panel.

## Open Questions

**Resolved (Jun 29):** Panel covers **DNA only** (clip-type generation rules stay in `/settings/clip-rules`). Editable by **admins (all) + team leads (only asset types they lead)**. Whether DNA `requirements` should feed the clip-generation prompt is **deferred to a later round** (phase 2 of this feature), not part of this build.

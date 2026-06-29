---
prd: 'content-production-management/portal-feedback-round-1/asset-type-dna-editor.md'
feature: 'E9.7 · Asset-type DNA editor'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 6
total_steps: 6
---

# Build Log: E9.7 · Asset-type DNA editor

## Approved Plan

Storage pivot (Jun 29): DNA lives as **Airtable fields on the Creative Services Asset
Type table** (Airtable-direct, consistent with the app) — NOT Postgres. Live fields:
- DNA / Requirements (multilineText) = fldogRGYGUJq6rHIX
- Feedback Standards (multilineText) = fldhlP1atHGC6diSS
- DNA Updated By (singleLineText) = fldb3LMpdlPikEVKf

Access: admins edit all; an asset type's team lead edits only their own; managers/admins
get the nav entry; team leads can reach via link. Reference fields (team lead / preferred
editor / dimensions / event types) shown read-only.

- **Step 1** — field-map: add dnaRequirements, feedbackStandards, dnaUpdatedBy to ASSET_TYPES.fields.
- **Step 2** — lib/asset-types/repository.ts: listAssetTypeDna() + updateAssetTypeDna().
- **Step 3** — app/settings/asset-types/actions.ts: guarded saveAssetTypeDna (admin OR lead-of-row).
- **Step 4** — components/settings/AssetTypeEditor.tsx (client, mirrors ScoringConfigEditor).
- **Step 5** — app/settings/asset-types/page.tsx: guard + load + render.
- **Step 6** — nav: add /settings/asset-types for admins + managers.

Verify: lint + build + manual.

## Progress

- [x] Step 1: field-map entries
- [x] Step 2: repository (list + update)
- [x] Step 3: guarded server action
- [x] Step 4: editor component
- [x] Step 5: page
- [x] Step 6: nav entry

## Result

Files created: 4 (`lib/asset-types/repository.ts`, `app/settings/asset-types/actions.ts`,
`components/settings/AssetTypeEditor.tsx`, `app/settings/asset-types/page.tsx`).
Files modified: 2 (`lib/airtable/field-map.ts`, `lib/roles.ts`).
Live Airtable fields created via MCP on the Asset Type table: DNA / Requirements
(fldogRGYGUJq6rHIX), Feedback Standards (fldhlP1atHGC6diSS), DNA Updated By (fldb3LMpdlPikEVKf).
Verification: `npm run lint` clean, `npm run build` passes, /settings/asset-types route registered.
As-built note: DNA stored as Airtable fields on the app-owned Asset Type table (not Postgres),
matching the Airtable-direct architecture. Edit auth re-checked server-side (admin OR team lead
of that asset type).

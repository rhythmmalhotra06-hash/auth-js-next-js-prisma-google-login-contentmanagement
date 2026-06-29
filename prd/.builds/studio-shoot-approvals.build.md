---
prd: 'content-production-management/portal-feedback-round-1/studio-shoot-approvals.md'
feature: 'E9.2 · Shoot approvals in Studio'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 4
total_steps: 4
---

# Build Log: E9.2 · Shoot approvals in Studio

## Approved Plan

Surface shoots awaiting Vishen's sign-off inside `/studio` with Approve / Decline actions.
Mapped to this repo (Airtable-direct + server actions + studio client components).

- **Step 1** — `lib/shoots/repository.ts`: add `updateShoot(id, fields)` over `updateRecord`.
- **Step 2** — `lib/studio/data.ts`: add `shoots` to `StudioData`, fetch `listShoots()` in `loadStudio()`, add `getPendingShoots()` selector + `ShootSignOffItem` mapper.
- **Step 3** — `app/studio/actions.ts`: `approveShoot(id)` (status → Approved + tick checkbox), `declineShoot(id, note?)` (status → Cancelled + optional note), add `/shoots` to revalidate.
- **Step 4** — `components/studio/ShootSignOff.tsx` (new client) + `app/studio/page.tsx` section.

No schema/Airtable-field changes; existing fields only. Verify: lint + build + manual.

## Progress

- [x] Step 1: Repository write path (`updateShoot`)
- [x] Step 2: Studio data — surface pending shoots
- [x] Step 3: Server actions (approve/decline)
- [x] Step 4: Client UI + studio page section

## Result

Files created: 1 (`components/studio/ShootSignOff.tsx`)
Files modified: 4 (`lib/shoots/repository.ts`, `lib/studio/data.ts`, `app/studio/actions.ts`, `app/studio/page.tsx`)
Verification: `npm run lint` clean (no new warnings), `npm run build` passes.

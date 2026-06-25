---
title: 'Foundation & Data Layer'
slug: 'foundation-data-layer'
scope: epic
status: resolved
parent: content-production-management.md
children: []
created: 2026-06-25
updated: 2026-06-25
resolution: 7/7
build-status: built
build-date: 2026-06-25
---

# Foundation & Data Layer

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Stand up the application's data layer and auth foundation: translate the full `schema.sql` into `prisma/schema.prisma` (all reference + transactional tables), migrate against the project database (local dev uses a `DATABASE_URL` in `.env`; deployed on Kessel, `DATABASE_URL` is auto-injected by the managed Postgres and must not be set by hand — same Prisma migrations either way), and scaffold Blinkwork-compatible auth that maps an authenticated identity to the `employees` table rather than the generic `users` table. Every other epic builds on this.

## User Stories

- **As a developer**, I can run one migration and get the complete schema (all 15 tables) so I can start building any downstream epic without first defining its models.
- **As a downstream epic (E2–E7)**, I can import fully-typed Prisma models from the generated client so my queries are type-safe end to end.
- **As the system**, when a person authenticates I resolve their identity to an `employees` row (matched by email) so every ticket/approval/event can be attributed to a real employee, and so swapping GitHub OAuth for Blinkwork SSO later changes only the provider, not the data model.
- **As a developer**, when an authenticated user has no matching `employees` row, the app degrades gracefully (no crash) and the unmapped state is observable, so missing-employee cases surface early.

## Workflows

**1. Schema translation & migration**
1. Translate every table in `schema.sql` into `prisma/schema.prisma`: the 6 reference tables (`employees`, `dimensions`, `event_types`, `dna`, `asset_types`, `asset_type_dimensions`), the 7 transactional tables (`tickets`, `ticket_events`, `approvals`, `shoots`, `shoot_tickets`, `assets`, `performance`).
2. Preserve `airtable_id` (unique) + `synced_at` provenance columns on every mirrored table; preserve all FKs and the three `tickets` indexes (`idx_tickets_queue`, `idx_tickets_assignee`, `idx_tickets_status`).
3. IDs use Postgres-native `gen_random_uuid()` via `@default(dbgenerated(...))` — drop the `uuid-ossp` extension.
4. Run `npx prisma migrate dev --name init_content_schema`; `npx prisma generate` emits the client to `app/generated/prisma/` (non-standard path — preserved).

**2. Employee mapping on auth**
1. User signs in via the existing GitHub provider (dev placeholder).
2. A helper (e.g. `lib/employee.ts`) resolves the session's email to an `employees` row and returns it (or null).
3. App code uses the resolved `employee.id` for attribution; the raw Auth.js `User` stays purely for session/identity.

## Boundaries

**In scope:**
- Full `schema.sql` → Prisma translation (all 15 tables) + one init migration.
- `User → employees` mapping layer (match by email), graceful null handling.
- Keep template's GitHub OAuth, `PrismaPg` edge adapter, and `app/generated/prisma/` client path.

**Explicitly out of scope (owned elsewhere):**
- Real Blinkwork SSO — open question; placeholder only here.
- `[VERIFY]` field-name / enum reconciliation — that's E2 (amends via follow-up migration).
- Any Airtable sync (read or write) — E2 / E6.
- The two SQL views — NOT ported; built as app-side Prisma queries in E4/E5. `schema.sql` views remain reference docs only.
- Seeding real reference data — arrives via E2 sync.

## Dependencies

None — this is the root epic. E2–E7 all depend on it. Note the repo's non-standard Prisma setup (generated client at `app/generated/prisma/`, edge-light `PrismaPg` adapter) must be preserved.

## Success Criteria

- `npx prisma migrate dev` applies cleanly from an empty database; `npx prisma generate` produces typed models for all 15 tables.
- `npm run build` and `npx tsc --noEmit` pass with the new models imported.
- An authenticated session resolves to an `employees` row by email when one exists, and returns null (no crash) when it doesn't.
- All `airtable_id` columns are unique-indexed and FKs match `schema.sql` (verifiable via `prisma migrate diff` against the SQL, allowing the intentional uuid/extension change).

## Features

1. **`prisma/schema.prisma` — full content schema** — all 15 models with FKs, unique `airtable_id`, indexes, `gen_random_uuid()` defaults.
2. **Init migration** — `init_content_schema` generated and applied.
3. **Employee-mapping helper** — `lib/employee.ts` (or similar): `getEmployeeForSession()` matching session email → `employees`, returning `Employee | null`.
4. **Auth wiring touch-up** — ensure `lib/auth.ts` session exposes email; document the SSO-swap seam.

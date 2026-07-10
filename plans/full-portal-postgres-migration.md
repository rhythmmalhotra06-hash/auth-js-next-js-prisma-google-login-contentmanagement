# Migrate the full portal onto Postgres (two-way Airtable sync)

## Context

The team merged Social/Ads/Content and Vishen/Muley set the direction (Jul 1 2026): rebuild the
portal on **Postgres, not Airtable** — Airtable is ~5 req/s, the Prio table exceeds 10k rows, and
the portal needs real joins/transactions. The non-negotiable constraint: **two-way sync** — the
team keeps editing in Airtable, the portal is fast on Postgres, and the two stay in step within
seconds (CLAUDE.md §2/§8).

**Tickets are already fully migrated** and are the template. The complete loop exists and is proven:
Prisma model with echo-suppression → backfill → PG read → PG write + outbox enqueue → outbound
drainer (PG→Airtable) → inbound pull (Airtable→PG, last-writer-wins) → Kessel cron, gated behind
`TICKETS_BACKEND`. See [plans/postgres-sor-two-way-sync.md](postgres-sor-two-way-sync.md).

**This plan** applies that loop to every remaining Airtable-direct domain. Decided with the user:
**two-way sync for all domains**, scope = **reference/config, shoots, social, media/Vishen** (+ the
metrics job). Outcome: no portal surface reads Airtable at request time; Airtable becomes a synced
mirror the team can still edit.

> ⚠️ **This plan was adversarially audited against the code (2026-07-07).** The "reuse the ticket
> pattern" framing is real but the reusable *infrastructure* mostly **does not exist yet** — the
> ticket path is hardcoded ticket-shaped. Read **§Corrected assumptions** and **§Required manual
> Airtable steps** below before estimating; they are the difference between "copy a file" and the
> actual work.

### Current coupling (verified 2026-07-07)

| Domain | Today | PG model? |
|---|---|---|
| Tickets, TicketEvents, notify | **PG (done)** — `TICKETS_BACKEND` dispatcher | yes |
| Content Engine clips (AI engine) | **PG (done)** — `lib/clipping/data.ts` | yes (`ClipStrategy`/`ClipSuggestion`, **no `airtableId`**) |
| Reference (employees, event/asset types, dimensions, authors, official calendars) | Airtable-direct reads; **mirrored one-way to PG** by `syncReference()` | yes |
| **Auth / roles** (every gated request) | **Airtable-direct** `findEmployeeByEmail` | Employee model exists but **lacks `roles`/`capacity`** |
| **Contractors** | Airtable-direct, **not synced** | **no model** |
| Scoring config, clip-rules | Airtable-direct **live-read** (not mirrored) | **no models** |
| Intake reference | Airtable **live** read (`lib/airtable/reference-live.ts`) | uses reference models |
| Shoots | Airtable-direct (`lib/shoots/repository.ts`) | `Shoot`/`ShootTicket` exist but **dormant, no `airtablePushedAt`** |
| Social | Airtable-direct (`lib/social/repository.ts`, Content & Comms base) | **no model** |
| Media/Vishen | Airtable-direct + **own cross-base push + native Airtable sync** | **no model** |
| Metrics refresh | scans Airtable tickets directly | writes `MetricSnapshot` |
| DNA | `Dna` model exists but **dormant** (never synced) | orphaned |

---

## Corrected assumptions (what the audit changed)

1. **The sync engine is NOT reusable as-is — generalizing it is the bulk of Phase 0.**
   - `AirtableOutbox` has a `ticketId @db.Uuid` FK, `op` only ever `'upsert'`, and targets only the
     Prio table. Needs a **polymorphic outbox** — `(entity, recordId, op)` where `recordId` is a
     **string** (cross-base recIds aren't our uuids) and `op` supports delete.
   - `drainOutbox()` hardcodes ticket relations + `TICKETS.baseId/tableId`; `ticketToAirtableFields()`
     is a hand-written per-field mapper. Each domain needs its own `include` shape + `xToAirtableFields`
     mapper + a **target-table dispatcher**.
   - `pull.ts` is **ticket-literal**: the cursor field name `{App Last Modified (sync)}`, the
     `DATETIME_PARSE(…,'YYYY-MM-DD HH:mm:ss')` format, and the fixed-width-string cursor sort are
     inlined. Parameterize field name + parse format per domain.
2. **Reference is NOT uniformly mirrored.** `syncReference()` covers only Employees, Dimensions,
   EventTypes, AssetTypes (+joins), OfficialCalendars, Authors. **Contractors, DNA, scoring config,
   clip-rules, shoots, and the Content & Comms calendar are NOT synced.**
3. **Auth/roles is a request-time Airtable dependency** and the plan omitted it — the single
   most-hit Airtable call. The `Employee` model has **no `roles` and no `capacity`** columns (both
   exist in the Airtable field-map), so migrating auth means schema + sync changes, not a read swap.
4. **Media/Vishen already has an independent write path.** `lib/media/vishen-sync.ts` pushes to two
   bases (Major Videos + Vishen Clips) gated by a **separate `VISHEN_SYNC_ENABLED` flag**, with
   diff-guarding + "AI Suggested" tagging as its echo-suppression, and inbound is handled by
   **Airtable's native two-way sync** into `(Sync)` mirror tables. A generic drainer would
   **double-write and ping-pong** against this. Phase 4 must reconcile, not just "add the loop."
5. **`ClipSuggestion` has two unlinked representations** — the PG AI-engine model (no `airtableId`)
   and the Airtable "Clip Suggestions" surface (`lib/media/repository.ts`). Must be reconciled.
6. **Cross-base link fields can't be written** (field-map notes). Social's "Creative Request" and the
   Content & Comms 🎯 Prio are read-only synced mirrors; the app stores a plain recId string
   (`creativeTicketId`), not a link. Social write-back is not a normal link push.

---

## The per-domain pattern (still the template — just build the missing pieces first)

Per domain, once Phase 0 has generalized the engine:

1. **Prisma model** with `airtableId @unique` + **`airtablePushedAt`** (only `Ticket` has the latter
   today — every migrated model needs it or echo-suppression is impossible). Migrate via
   **`kessel db migrate`**.
2. **Backfill** Airtable→PG, reusing the two-pass upsert shape of
   [lib/airtable/ticket-upsert.ts](lib/airtable/ticket-upsert.ts) / [lib/airtable/sync.ts](lib/airtable/sync.ts).
3. **Read dispatcher** — `lib/<domain>/data.postgres.ts` + `.airtable` + a `<DOMAIN>_BACKEND` flag,
   exposing reference FKs as **Airtable recIds** (via `airtableId`) so pickers/link fields keep working.
4. **Write layer** — `lib/<domain>/write.postgres.ts`: one `$transaction` → PG row + audit event +
   **polymorphic outbox enqueue**.
5. **Outbound drainer** — register the domain in the generalized drainer with its mapper + target table.
6. **Inbound pull** — **requires a manual Airtable cursor field first** (see below); register field
   name + parse format.
7. **Kessel crons** for push/pull; **flip the flag** after the verification gate.

---

## Required manual Airtable steps (do these per domain — easy to miss, silent failures)

The inbound pull needs a cursor field on each table **matching the ticket format** — a *formula*
`DATETIME_FORMAT(LAST_MODIFIED_TIME(),'YYYY-MM-DD HH:mm:ss')` (UTC), watching **all** fields. Audit:

| Table | Cursor field today | Action |
|---|---|---|
| Tickets (Prio) | ✅ "App Last Modified (sync)" | done |
| Shoots | ❌ none | **create** |
| Social | ❌ none | **create** |
| Media Sources | ❌ none | **create** |
| Clip Suggestions | ❌ none | **create** |
| Major Videos | ❌ none | **create** (+ cross-base, see Phase 4) |
| Scoring Config | ❌ none | **create** |
| Vishen Videos | ⚠️ "Modified" (native ISO) | reuse but pull must parse ISO, not the formatted string |
| Clip Rules | ⚠️ "Last Modified" (raw `LAST_MODIFIED_TIME()`) | reuse but parse native, not the formatted string |

Precedent that these manual steps bite: `CLIPS_SYNC` already requires "App Clip ID" to be enabled in
the Airtable sync's field set or `ticket-links.ts` reconcile is a silent no-op (field-map notes).
Also: `SHOOTS` filters use a field **name** (`'Filming Status'`) not an ID and the platforms field
has a live typo (`"Platfom"`) — name-based `filterByFormula` breaks on rename.

---

## ✅ Phase 0 — status (code-complete 2026-07-07; migration PREPARED, not applied)

- Deleted the 7 `… 2.ts` Finder-copy duplicates + the stray agent plan file; consolidated the plan
  to `plans/full-portal-postgres-migration.md`.
- **Polymorphic outbox:** `AirtableOutbox` → `(entity, entityId?, op)` (schema + migration
  `prisma/migrations/0012_polymorphic_outbox/migration.sql`, **additive/order-independent, NOT yet
  applied via `kessel db migrate`**). New [lib/airtable/push-registry.ts](lib/airtable/push-registry.ts)
  holds per-domain `PushHandler`s (ticket handler moved out of push.ts); [lib/airtable/push.ts](lib/airtable/push.ts)
  now groups by `(entity, entityId)` and dispatches by handler, with a legacy `entityId ?? ticketId`
  fallback for pre-0012 rows. Ticket enqueues in [lib/tickets/write.postgres.ts](lib/tickets/write.postgres.ts)
  now write `{ entity: 'ticket', entityId }`.
- **Parameterized pull:** [lib/airtable/pull-core.ts](lib/airtable/pull-core.ts) `runPull(domain)` owns
  cursor read/fetch/advance/save; [lib/airtable/pull.ts](lib/airtable/pull.ts) is now the ticket
  `PullDomain` (echo/conflict logic unchanged). [lib/airtable/pull-registry.ts](lib/airtable/pull-registry.ts)
  lists runners; `POST /api/sync/pull` loops them (+ `?entity=` filter).
- **Health:** [lib/sync/health.ts](lib/sync/health.ts) is entity-aware (per-domain outbox depth +
  entity/entityId error rows); `/admin/sync` shows an "Outbox by domain" table.
- **Build gate green:** `prisma validate` + `prisma generate` + `tsc --noEmit` + `lint` + `next build`
  all clean. **Not deployed.** Next: apply 0012 via `kessel db migrate`, deploy, confirm tickets still
  sync both ways (no behavior change expected), then start Phase 1.

## Phase 0 — Generalize the sync engine + housekeeping (the real foundation)

- **Delete the `… 2.ts` Finder-copy duplicates** in `lib/tickets/` + `lib/notify/` (untracked, not
  imported) and the stray `plans/what-do-we-have-mighty-giraffe*.md` files.
- **Polymorphic outbox:** migrate `AirtableOutbox` → `(entity, recordId String, op)` + a push
  registry mapping `entity → { baseId, tableId, include, mapper }`. Extend
  [lib/airtable/push.ts](lib/airtable/push.ts) to dispatch by entity.
- **Parameterize the pull:** lift the cursor field name + parse format + base/table out of
  [lib/airtable/pull.ts](lib/airtable/pull.ts) into per-domain config; keep echo-suppression +
  last-writer-wins generic. Handle both formatted-string and native lastModifiedTime formats.
- Extend `POST /api/sync/{push,pull}` to loop registered entities; extend `/admin/sync`
  ([lib/sync/health.ts](lib/sync/health.ts)) to report **per-domain** outbox depth + cursor lag.
- `/simplify` this shared engine before building on it.

## ✅ Phase 1a — status (code-complete 2026-07-08; migration 0013 PREPARED, not applied)

Scope refinement (aligns with "keep Airtable authoritative"): reference **and** config use
**read-PG / write-Airtable** — no outbox/pull for these; `syncReference` mirrors Airtable→PG and
settings pages keep writing Airtable. `Dna` model kept **dormant** (unused, no clean source; DNA
text lives on AssetType). Full outbox two-way for config is a later hardening step if needed.

- **Schema** (`prisma/schema.prisma`) + migration `prisma/migrations/0013_reference_config_mirror/migration.sql`
  (all ADDITIVE, **not applied**): `Employee.roles`/`.capacity`; `EventType.loadWeight`/`.tierNorm`;
  `AssetType.fullName`/`.creativeCategory`/`.loadWeight`/`.effortNorm`/`.dnaRequirements`/`.feedbackStandards`/`.dnaUpdatedBy`;
  new models `Contractor`, `ScoringConfigKnob` (`scoring_config`), `ClipRule` (`clip_rules`).
- **syncReference** ([lib/airtable/sync.ts](lib/airtable/sync.ts)) extended: new mappers
  `mapContractor`/`mapScoringKnob`/`mapClipRule`, `numVal`/`selectNames` helpers, employee roles+capacity,
  type scoring fields, and upserts for the 3 new tables. `SyncReport.counts` extended. Added optional
  `createdTime` to the client `AirtableRecord` type (already present at runtime).
- **Build gate GREEN** (validate/generate/tsc/lint/build). Nothing deployed; no reads switched yet.

## ✅ Phase 1b — status (code-complete 2026-07-09; build gate GREEN; flag defaults airtable)

Added `REFERENCE_BACKEND` ([lib/reference/backend.ts](lib/reference/backend.ts), airtable|postgres,
default airtable) and PG-backed reads behind it, each exposing `airtableId` as `id` so recId-based
pickers/link fields/gating keep working. Dispatch is in-function with a **lazy `await import('@/lib/prisma')`**
in the PG branch (keeps Prisma out of any client bundle):
- **Auth hot path + lists** — [lib/repositories/employee.repository.ts](lib/repositories/employee.repository.ts)
  `load()` dispatches; `updateEmployeeRoles` writes Airtable and mirrors the change into PG when on
  postgres (immediate gating reflect).
- **Contractors** — [lib/repositories/contractor.repository.ts](lib/repositories/contractor.repository.ts).
- **Scoring config** — [lib/scoring-config/repository.ts](lib/scoring-config/repository.ts)
  `getScoringConfig` → new `fetchConfigPg()` reads all 5 sources from PG; shared `applyGlobalKnob`.
  Admin editor list reads (`listGlobalRows`/`listEventTypeRows`/`listAssetTypeRows`) + writes stay Airtable.
- **Clip rules** — [lib/clip-rules/repository.ts](lib/clip-rules/repository.ts) `listClipRules` PG variant; writes stay Airtable.
- **Asset-type DNA read** — [lib/asset-types/repository.ts](lib/asset-types/repository.ts) `listAssetTypeDna` PG variant (joins resolve names); `getAssetTypeLeadIds` + writes stay Airtable.
- **Intake reference** — [lib/reference/intake.postgres.ts](lib/reference/intake.postgres.ts) `getPgIntakeReference`, dispatched from [lib/intake/data.ts](lib/intake/data.ts). **INTERIM:** shoots still read from Airtable here (not mirrored until Phase 2).

**Not flipped / not deployed.** To activate later: apply 0013 → `POST /api/sync/reference` (backfill the
mirror) → set `REFERENCE_BACKEND=postgres` in a preview → `/verify` reads match Airtable → prod.
Ensure `reference-sync` cron cadence is adequate once flipped.

## Phase 1 — Reference, auth & config (highest impact; auth is on the hot path)

- **Auth/roles → PG (do first).** Add **`roles` (string[]) and `capacity` (int)** to the `Employee`
  model; extend `syncReference()` to populate them; swap `findEmployeeByEmail`
  ([lib/repositories/employee.repository.ts](lib/repositories/employee.repository.ts)) to Prisma.
  This removes an Airtable read from **every gated request** (via `getEmployeeForSession` →
  guards). Keep `lib/roles.ts` `ROLES` hand-synced with the Airtable multi-select. Mind the
  `NODE_ENV≠production` dev-role override in `lib/admin/access.ts` (behaves differently in prod).
- **Contractors → PG.** No model today and **not synced**, yet the already-migrated ticket
  assignee-picker (`data.postgres.ts` → `listActiveContractorRecords`) still hits Airtable. Add a
  `Contractor` model + sync, then swap the read.
- **Swap remaining reference reads to Prisma:** `reference.repository.ts`,
  [lib/asset-types/repository.ts](lib/asset-types/repository.ts), and
  [lib/intake/data.ts](lib/intake/data.ts) (replace the live read in `reference-live.ts`, still
  returning recIds for link fields). Keep taxonomy **edit-in-Airtable** (read PG, write Airtable;
  `syncReference` mirrors back) per CLAUDE.md §8.
- **Scoring config + clip-rules (app-owned) → two-way.** Add `ScoringConfig` + `ClipRule` models +
  the full loop so settings pages write PG and mirror out. Clip Rules already has a usable cursor;
  **Scoring Config needs one created.** Also mirror the **Content & Comms calendar**
  (`COMMS_OFFICIAL_CAL`) that `/social/new` reads.
- **DNA:** decide now — either wire `Dna` into `syncReference` (if any surface needs it) or delete
  the dormant model to avoid the drift that broke this project before.

## 🟡 Phase 2 — Shoots (IN PROGRESS; full PG system-of-record, per user 2026-07-09)

Decision: transactional domains (Shoots, then Social/Media) get **full PG-SoR** (PG write + outbox
push + inbound pull), not the read-mirror model — exercises the Phase 0 engine. Link fields
(requester/authors/event types/asset-library/tickets) stored as Airtable **recId arrays** on the
Shoot (the shoot's own state is authoritative; drainer pushes them back as link arrays) — avoids
modeling every cross-base relationship.

- ✅ **2a (2026-07-09):** remodeled `Shoot` (full ShootRow fields + link recId arrays + `airtablePushedAt`);
  migration `0014_shoots_sor` (ADDITIVE, reuses `location`/`notes` cols, **prepared not applied**);
  [lib/airtable/shoot-upsert.ts](lib/airtable/shoot-upsert.ts) (backfill+pull mapper);
  [lib/airtable/shoot-backfill.ts](lib/airtable/shoot-backfill.ts) + `POST /api/sync/backfill-shoots`.
- ✅ **2b (2026-07-09):** `SHOOTS_BACKEND` flag ([lib/shoots/backend.ts](lib/shoots/backend.ts), default airtable) +
  [lib/shoots/data.postgres.ts](lib/shoots/data.postgres.ts); `listShoots`/`getShoot` in
  [lib/shoots/repository.ts](lib/shoots/repository.ts) dispatch (lazy PG import). Exposes shoot PG uuid
  as `id`, links as recIds. Build gate GREEN.
- ✅ **2c (2026-07-09):** the write path. `ShootPatch`/`CreateShootInput` moved to
  [lib/shoots/constants.ts](lib/shoots/constants.ts); `updateShoot` callers
  ([app/shoots/actions.ts](app/shoots/actions.ts), [app/studio/actions.ts](app/studio/actions.ts))
  refactored off Airtable-field-id patches onto typed `ShootPatch`. New
  [lib/shoots/write.postgres.ts](lib/shoots/write.postgres.ts) (create/update → PG + `airtableOutbox`
  entity `shoot`); [lib/shoots/repository.ts](lib/shoots/repository.ts) create/update dispatch (lazy PG
  import) with a `patchToAirtableFields` translator for the Airtable path. Registered `shoot` `PushHandler`
  ([lib/airtable/push-registry.ts](lib/airtable/push-registry.ts)) + [lib/airtable/shoot-push-map.ts](lib/airtable/shoot-push-map.ts)
  (writes link recId arrays). Added `assetTypeIds` to the model + migration + upsert to round-trip the
  create-time asset-type link. Shoot `PullDomain` ([lib/airtable/pull-shoots.ts](lib/airtable/pull-shoots.ts))
  written but **left UNREGISTERED** in [pull-registry.ts](lib/airtable/pull-registry.ts) (commented) until
  the manual cursor field exists — else the shared /api/sync/pull would full-rescan + re-import echoes.
  **MANUAL AIRTABLE STEP:** create "App Last Modified (sync)" formula on 📺 Shoots (`tblcZ8OIxfgnlUowC`)
  = DATETIME_FORMAT(LAST_MODIFIED_TIME(),'YYYY-MM-DD HH:mm:ss'), set its id in `SHOOTS.fields.lastModified`,
  then uncomment the shoot runner.
- ✅ **2d (2026-07-09):** New-Prio-Ticket automation — the drainer writes the `newPrioTicket` checkbox
  back to Airtable (in shoot-push-map), so the automation still fires under SHOOTS_BACKEND=postgres
  (verify on cutover). Intake shoots picker ([lib/reference/intake.postgres.ts](lib/reference/intake.postgres.ts))
  now reads from PG (interim Airtable read removed). **Build gate GREEN.**

**To activate later:** apply 0014 → create the Airtable cursor field + set its id + register the shoot
pull → `POST /api/sync/backfill-shoots` → set `SHOOTS_BACKEND=postgres` in preview → `/verify`
(create/edit shoot in portal → Airtable updates; edit in Airtable → PG updates; New-Prio-Ticket fires) → prod.

### Original Phase 2 notes

- Add `airtablePushedAt` to `Shoot`; backfill; `data.postgres`/`write.postgres` + `SHOOTS_BACKEND`;
  register drainer mapper; **create the Shoots cursor field**; pull.
- **Gotcha:** the live **"New Prio Ticket" Airtable automation** raises a Prio ticket when the
  checkbox is ticked (memory `shoots-new-prio-ticket-automation`). Once the drainer writes that
  checkbox back, verify it still fires — or replicate in-app via `createTicketRow`.

## ✅ Phase 3 — Social (DONE, code-complete 2026-07-09; full PG-SoR; build GREEN; not deployed)

- **Models + migration `0015_social_sor`** (additive, prepared): `SocialPost` (app-managed fields;
  `creativeTicketId` = cross-base ticket recId as **text**; `officialCalId` = same-base calendar recId)
  + `CommsCalendar` (reference mirror for the /social/new picker).
- **Backfill:** [lib/airtable/social-upsert.ts](lib/airtable/social-upsert.ts) +
  [social-backfill.ts](lib/airtable/social-backfill.ts) (engine-origin rows only) + `POST /api/sync/backfill-social`.
  `syncReference` extended to mirror `CommsCalendar`.
- **Reads:** `SOCIAL_BACKEND` flag ([lib/social/backend.ts](lib/social/backend.ts)) +
  [lib/social/data.postgres.ts](lib/social/data.postgres.ts); `listSocialSuggestions`/`getSocialSuggestion`/`listCommsCalendarEntries`
  dispatch in [lib/social/repository.ts](lib/social/repository.ts). Suggestions expose PG uuid as `id`;
  calendar exposes recId as `id`. `getSocialTicketStates` stays Airtable (cross-base ticket status read).
- **Writes:** [lib/social/write.postgres.ts](lib/social/write.postgres.ts) (create/status/markRaised → PG + outbox `social`);
  registered `social` PushHandler + [social-push-map.ts](lib/airtable/social-push-map.ts) (only app-managed
  fields; leaves the board's manual columns untouched).
- **Pull:** [lib/airtable/pull-social.ts](lib/airtable/pull-social.ts) — **engine-origin filter applied on every
  pass** (the Social table also holds the team's manual rows). Cursor field "App Last Modified (sync)"
  `fldyYNCIzWdMNtys5` created via MCP. Registered in [pull-registry.ts](lib/airtable/pull-registry.ts),
  **gated on `SOCIAL_BACKEND=postgres`**. Generalized `runPull`/`PullDomain.buildFilter(since|null)` so a
  domain can constrain the first/full pass (tickets+shoots return undefined when no cursor).

**To activate later:** apply 0015 → `POST /api/sync/reference` (comms calendar) + `POST /api/sync/backfill-social`
→ set `SOCIAL_BACKEND=postgres` in preview → `/verify` → prod.

### Original Phase 3 notes

- New `SocialPost` model (Content & Comms base `app9YRZOVeE65fJPA`); backfill; loop; **create the
  Social cursor field**.
- **Cross-base write limit:** the "Creative Request" link and 🎯 Prio are read-only mirrors — store
  the Creative Services ticket as a **recId string** (or a real FK to `Ticket` on the PG side only),
  not an Airtable link. Social still raises tickets via `createTicket` (memory
  `content-comms-prio-is-synced`); only the Social board migrates.

## ✅ Phase 4 — Media / Vishen (DONE, code-complete 2026-07-09; build GREEN; not deployed)

Scoped with user: **Vishen Videos → full PG-SoR; Media Sources → read-mirror; Clip Suggestions
DEFERRED** (entangled with the in-flight feedback-loop PR + cross-base `vishen-sync`; not touched).

- **Vishen Videos (SoR, `VISHEN_VIDEOS_BACKEND`):** model `VishenVideo` + migration `0016_vishen_videos_sor`;
  [vishen-video-upsert](lib/airtable/vishen-video-upsert.ts) + [backfill](lib/airtable/vishen-video-backfill.ts)
  + `/api/sync/backfill-vishen-videos`; PG read+write in [lib/media/vishen-videos.postgres.ts](lib/media/vishen-videos.postgres.ts)
  (list + approval/rating/views24h write → PG + outbox `vishenVideo`), dispatched from
  [lib/media/vishen-videos.ts](lib/media/vishen-videos.ts). Push handler + [vishen-video-push-map](lib/airtable/vishen-video-push-map.ts)
  writes **only the 3 app-managed fields, omitting nulls** (team-maintained table — never clear their values).
  Pull [pull-vishen-videos](lib/airtable/pull-vishen-videos.ts) (excludes Rejected), gated on the flag.
  Cursor field `fld4wVqxMStdAyNAg` created via MCP.
- **Media Sources (read-mirror, `MEDIA_BACKEND`):** model `MediaSource` + migration `0017_media_sources_mirror`
  (no outbox); [media-source-upsert](lib/airtable/media-source-upsert.ts) + [backfill](lib/airtable/media-source-backfill.ts)
  + route; PG reads in [lib/media/media-sources.postgres.ts](lib/media/media-sources.postgres.ts) (list/get/findByUrl/existing*)
  dispatched from [lib/media/repository.ts](lib/media/repository.ts). **Writes stay Airtable** (create/update +
  the `vishen-sync` cross-base fan-out UNCHANGED) with a **write-through upsert** to PG for immediate read
  freshness. Pull [pull-media-sources](lib/airtable/pull-media-sources.ts) is a plain incremental upsert
  (Airtable is SoR — no echo/conflict), gated on the flag. Cursor field `fld1y92PoEPpLKb0j` created via MCP.
- **Clip Suggestions:** untouched (Airtable). The PG `ClipSuggestion` (content engine) and Airtable "Clip
  Suggestions" remain separate/unlinked — reconcile in a later dedicated pass after the feedback-loop PR lands.

**To activate:** apply 0016/0017 → backfill (`/api/sync/backfill-vishen-videos`, `/api/sync/backfill-media-sources`)
→ set `VISHEN_VIDEOS_BACKEND=postgres` and/or `MEDIA_BACKEND=postgres` in preview → `/verify` → prod.

### Original Phase 4 notes

- New models: `MediaSource`, `VishenVideo`, `MajorVideo`. **Reconcile the ClipSuggestion split** —
  unify the PG AI-engine `ClipSuggestion` (add `airtableId`) with the Airtable Clip Suggestions
  surface, or keep them separate with an explicit link; pick one source per UI surface.
- **Do NOT let the generic drainer own the Vishen cross-base push.** `lib/media/vishen-sync.ts`
  already pushes to Major Videos + Vishen Clips (flag `VISHEN_SYNC_ENABLED`) and inbound is
  **Airtable native two-way sync** into `(Sync)` mirror tables. Options: (a) keep `vishen-sync` as
  the sole push path and only migrate the app-owned Media Sources read/write to PG, or (b) fully
  replace the native sync — larger, riskier. Recommend (a). Ensure the diff-guard / "AI Suggested"
  approval-gate semantics survive; the drainer's 90s echo window does **not** coordinate with them.

## ✅ Phase 5 — Metrics (DONE 2026-07-09); dead-path removal deferred

- `refreshTicketMetrics` ([lib/metrics/snapshot.ts](lib/metrics/snapshot.ts)) now tallies from **Postgres
  via `groupBy`** when `TICKETS_BACKEND=postgres` (cheap; no ~10k Airtable scan), else the Airtable scan.
  Gated on the ticket flag so it's correct in both modes.
- **Dead-path removal is intentionally NOT done** — the `*.airtable.ts` impls + Airtable repos are the
  instant rollback during the bake window. Remove only after every `<DOMAIN>_BACKEND` flag is flipped
  and verified in prod.

---

## 🚀 Cutover runbook (all code + migrations PREPARED; nothing deployed as of 2026-07-09)

Migrations `0012`–`0017` are hand-written SQL, all additive, none applied. All `*_BACKEND` flags default
`airtable`. Recommended order — one domain at a time, verify before the next:

1. **Deploy the code** (flags still `airtable` → zero behavior change; the gated pulls/reads stay off).
2. **Apply migrations** via `kessel db migrate` (in order): 0012 outbox → 0013 reference/config →
   0014 shoots → 0015 social → 0016 vishen videos → 0017 media sources.
3. **Backfill + verify per domain, then flip its flag in a preview:**
   - Reference/config: `POST /api/sync/reference` → `REFERENCE_BACKEND=postgres` → check auth/roles, intake, scoring, clip-rules read correctly.
   - Shoots: `POST /api/sync/backfill-shoots` → `SHOOTS_BACKEND=postgres` → create/edit a shoot both ways; confirm New-Prio-Ticket automation fires.
   - Social: `POST /api/sync/backfill-social` (+ reference for comms cal) → `SOCIAL_BACKEND=postgres`.
   - Vishen Videos: `POST /api/sync/backfill-vishen-videos` → `VISHEN_VIDEOS_BACKEND=postgres`.
   - Media Sources: `POST /api/sync/backfill-media-sources` → `MEDIA_BACKEND=postgres`.
   - Tickets: `POST /api/sync/backfill-tickets?all=true` → `TICKETS_BACKEND=postgres` (also flips metrics to PG).
4. Each flag flip auto-activates that domain's gated pull on the shared `/api/sync/pull` cron.
   `AIRTABLE_PUSH_ENABLED=true` (already set) drives the shared drainer for all SoR domains.
5. `/verify` per domain (portal edit → Airtable; Airtable edit → PG; no ping-pong; `/admin/sync` healthy).
6. After bake: remove the dead `*.airtable.ts` read impls; reconcile the deferred Clip Suggestions split.

### Original Phase 5 notes

- Rewrite `refreshTicketMetrics` ([lib/metrics/snapshot.ts](lib/metrics/snapshot.ts)) to a cheap PG
  `groupBy` over `tickets` instead of scanning ~10k Airtable rows.
- After each flag flips and bakes, the `*.airtable.ts` impls + Airtable repos become dead code —
  keep them through the bake (instant rollback), then remove. `syncReference()` stays as the
  reference bridge.

---

## Development process (per phase — the real guard against errors)

Safety comes from the **flag-gated, phase-by-phase rollout**, not a scaffolding skill. **Do NOT use
`/prd`** (requirements are settled — this plan is the spec) or **`/build-feature`** (targets the
BlinkWork monorepo, not this app — memory `build-feature-skill-wrong-repo`). Per phase:

1. Implement behind its own `<DOMAIN>_BACKEND` flag (default `airtable` — prod unchanged until flip).
2. **Build gate before any DB change:** `prisma validate` + `tsc --noEmit` + `next build` clean, then
   apply schema via **`kessel db migrate`** (managed DB uses Kessel-native raw-SQL history, not
   `_prisma_migrations`; local Prisma can't reach it — use a placeholder `DATABASE_URL`). Schema must
   match live DB before the flip — DB/deploy drift is the exact failure that broke this project before.
3. **`/code-review`** on the diff (echo-suppression, last-writer-wins, recId→uuid resolution are
   easy to get subtly wrong).
4. **`/verify`** — drive the real flow end-to-end, not just types/tests.
5. Flip the flag only after the verification gate passes; keep it reversible.

## Verification gate (per domain, before flipping its flag)

1. Backfill Airtable→PG; diff PG reads vs Airtable reads for parity (counts + spot-check rows).
2. Flip `<DOMAIN>_BACKEND=postgres` in a preview/deploy.
3. Edit in the **portal** → Airtable record updates within a drain cycle (formula fields untouched,
   no 400s).
4. Edit in **Airtable** → PG updates within a pull cycle, with an audit event and **no ping-pong**.
5. `/admin/sync` shows the domain's outbox depth + cursor lag healthy.

## Env flags to set/verify

`AIRTABLE_PUSH_ENABLED=true` (drainer is **off by default**), `VISHEN_SYNC_ENABLED` (default on —
coordinate with Phase 4), `SYNC_SECRET` (sync route auth), `ADMIN_BOOTSTRAP_EMAILS`, and one
`<DOMAIN>_BACKEND` flag per domain.

## Representative files

- **New per domain:** `lib/<domain>/data.postgres.ts`, `write.postgres.ts`, `backend.ts`,
  `lib/airtable/<domain>-upsert.ts`, a push-registry entry + mapper.
- **Schema:** add `roles`/`capacity` to `Employee`; add `Contractor`, `ScoringConfig`, `ClipRule`,
  `MediaSource`, `VishenVideo`, `MajorVideo`, `SocialPost`; add `airtableId`/`airtablePushedAt` where
  missing (`Shoot`, `ClipSuggestion`); resolve/remove dormant `Dna`. Migrate via `kessel db migrate`.
- **Generalize:** `AirtableOutbox` model, [lib/airtable/push.ts](lib/airtable/push.ts),
  [lib/airtable/pull.ts](lib/airtable/pull.ts), `app/api/sync/{push,pull}/route.ts`,
  [lib/sync/health.ts](lib/sync/health.ts).
- **Auth swap:** [lib/repositories/employee.repository.ts](lib/repositories/employee.repository.ts),
  [lib/employee.ts](lib/employee.ts), [lib/airtable/sync.ts](lib/airtable/sync.ts).
- **Metrics:** [lib/metrics/snapshot.ts](lib/metrics/snapshot.ts) → Prisma.
- **Cleanup:** delete the `… 2.ts` duplicates + stray agent plan files.

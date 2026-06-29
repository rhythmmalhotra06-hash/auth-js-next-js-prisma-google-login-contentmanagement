# Admin-editable capacity & scoring config

## Context

Today the "Editor capacity" insight on [/performance](../app/performance/page.tsx) is driven by a hardcoded assumption: **4 active tickets = 100% capacity**, applied identically to every editor and counting a week-long VSSL edit the same as a 20-minute social cut. The `4` is a magic number copy-pasted across three files, and the priority-scoring model in [lib/tickets/scoring.ts](../lib/tickets/scoring.ts) is similarly frozen in code — its event-tier ranking is literally flagged `[CONFIRM with Moniek]`. None of it can be tuned without a code change and redeploy.

This plan gives an Admin a front-end panel (`/settings/scoring`) to make the capacity and scoring logic **smarter and self-serve**:
- Set a **per-editor capacity**, with a global default.
- Set a **load weight per Event Type / Asset Type** so capacity reflects real effort (a VSSL counts as more than a social cut).
- Tune the **priority-score weights** and the **per-event-type tier ranking** that decide queue order.
- Tune the **thresholds and risk windows** (amber/red bands, "at capacity" warning window).

Config persists to **Airtable** (the same pattern as the existing Clip Rules admin feature) and feeds straight back into the live calculations — no redeploy. Every default is seeded to today's exact behavior, so the change is a no-op until an admin touches it.

## Decisions (confirmed with user)

1. **Scope** — capacity/load model **and** the priority-scoring weights in `scoring.ts`.
2. **Capacity model** — **weighted by type**: each ticket consumes a load weight from its event/asset type; editor utilization = Σ weights ÷ that editor's capacity.
3. **Storage** — **Airtable**, mirroring the Clip Rules pattern. Weights/capacity live as fields on existing reference tables; global knobs in a small new config table. Editable from the app admin panel (writes back to Airtable); admins may also edit directly in Airtable.

## Reuse — existing patterns to mirror, not reinvent

| Need | Reuse |
|------|-------|
| Admin gate | `getAdminAccess()` → `{ isAdmin }` in [lib/admin/access.ts](../lib/admin/access.ts); access wrapper like [lib/clip-rules/access.ts](../lib/clip-rules/access.ts) |
| Airtable-backed config repository | [lib/clip-rules/repository.ts](../lib/clip-rules/repository.ts) (typed rows, `listAll`/`updateRecord`, field-map, module cache + bust) |
| Server actions | [app/settings/actions.ts](../app/settings/actions.ts) + [app/settings/team/actions.ts](../app/settings/team/actions.ts) (`guard()` → admin check → `updateRecord` → `revalidatePath`) |
| Admin editor UI | [components/settings/ClipRulesEditor.tsx](../components/settings/ClipRulesEditor.tsx) & [components/settings/TeamRolesEditor.tsx](../components/settings/TeamRolesEditor.tsx) (`useTransition`, inline save, filter/search, `canEdit` prop) |
| People list (capacity rows) | `getEligibleAssignees()` in [lib/tickets/data.ts](../lib/tickets/data.ts) (Creatives + Contractors, with id+name) |
| Event/Asset type lists | `getLiveIntakeReference()` in [lib/airtable/reference-live.ts](../lib/airtable/reference-live.ts) (cached, recId-keyed, active-filtered) |
| Score recompute | `recomputeAllScores()` in [lib/tickets/score-service.ts](../lib/tickets/score-service.ts) |
| Nav entry | `navForRoles()` in [lib/roles.ts](../lib/roles.ts) (Admin group) |

## Data model (Airtable)

**New fields on existing tables** (add in Airtable; map in [lib/airtable/field-map.ts](../lib/airtable/field-map.ts)):
- **Event Type** (`tblzTFTZ2ttEvi2j1`): `Load Weight` (number, default 1), `Tier Norm` (number 0–1, replaces the name-pattern heuristic).
- **Asset Type** (`tblLbcgob2Bxevugy`): `Load Weight` (number, default 1), `Effort Norm` (number 0–1, feeds complexity).
- **Employees** (`tbllP5vRon54L7Ccf`): `Capacity` (number; blank = global default).
- **Contractors** (`tblRhzXG5vea37rYr`): `Capacity` (number; blank = global default) — assignees can be contractors too.

**New global-config table** `⚙️ Scoring Config` — key→number rows (mirrors the tiny Clip-Rules table shape). Add a `SCORING_CONFIG` entry to `field-map.ts`. Seed keys (values = today's behavior):
`default_capacity=4`, `w_due=0.5`, `w_event=0.5`, `w_effort=0.3`, `w_variants=0.2`, `w_shoot=0.5`, `leadtime_factor=0.2`, `amber_pct=75`, `red_pct=100`, `risk_capacity_days=4`, `due_proximity_window_days=30`.

> **Seeding:** populate the new Event-Type `Tier Norm` from the current `TIER_PATTERNS` in scoring.ts (Mastery/Summit/MBU/Festival → 1.0; Masterclass/Academy/Membership & Social/Pathway/Campaign/Ads → 0.7; States → 0.4; else 0.5). Asset `Effort Norm` seeds to 0.5; all `Load Weight` to 1. Done once via Airtable MCP/UI, not in code.

## New code

**`lib/scoring-config/repository.ts`** — single typed reader `getScoringConfig()`, cached (module cache + TTL like reference-live, busted on write). Returns:
```ts
interface ScoringConfig {
  defaultCapacity: number;
  weights: { due; event; effort; variants; shoot };
  leadtimeFactor: number;
  amberPct: number; redPct: number;          // % of capacity for bar colour
  riskCapacityDays: number;                   // "at capacity" risk window
  dueProximityWindowDays: number;
  capacityByName: Map<string, number>;        // editor/contractor name → capacity
  loadWeightByEventType: Map<string, number>; // by name (matches QueueTicket.eventType)
  loadWeightByAssetType: Map<string, number>;
  tierByEventType: Map<string, number>;
  effortByAssetType: Map<string, number>;
}
```
Keying load weights by **name** matches `QueueTicket.eventType`/`assetType` (already resolved names). Capacity keyed by name to match `loadMap`'s assignee-name keys. Every lookup falls back to the documented default when blank — preserving current behavior.

**`lib/scoring-config/access.ts`** — `getScoringConfigAccess()` → `{ email, canEdit: isAdmin }` (copy of clip-rules access).

**`app/settings/scoring/page.tsx`** — admin-gated (redirect non-admins via `getAdminAccess()`), wrapped in `AppShell`. Renders `ScoringConfigEditor` with `canEdit`, current config, and the Event/Asset/people lists.

**`app/settings/scoring/actions.ts`** — admin-guarded server actions: `setGlobalValue(key, number)`, `setTypeLoadWeight(kind, recId, number)`, `setTypeTier(recId, number)`, `setAssetEffort(recId, number)`, `setEditorCapacity(kind, recId, number)`, `recompute()` → `recomputeAllScores()`. Each validates, writes via `updateRecord`, busts the config cache, `revalidatePath('/settings/scoring')` + `revalidatePath('/performance')`.

**`components/settings/ScoringConfigEditor.tsx`** — client component, `useTransition`, four sections:
1. **Editor capacity** — global default input + searchable per-editor override list (reuse `getEligibleAssignees()` shape and TeamRolesEditor's filter/search).
2. **Complexity / load weights** — Event Types (load weight + tier 0–1) and Asset Types (load weight + effort 0–1).
3. **Priority weights** — the 5 weights + lead-time factor, with helper text explaining the `urgency + leadtime·complexity` formula.
4. **Thresholds & windows** — amber %, red %, risk-capacity days, due-proximity window. Plus a **"Recompute scores now"** button.

## Refactors — feed config into the live calc

Each call site keeps today's numbers as the fallback default, so nothing changes until config is set.

- **[lib/tickets/intel.ts](../lib/tickets/intel.ts)** — `loadMap(tickets, cfg)` becomes **weighted** (adds the ticket's `loadWeightByEventType`/`AssetType` instead of `+1`). `riskOf(t, load, cfg, capacityForName)` replaces the literal `>= 4` / `<= 4` with `capacityForName(t.assignee)` and `cfg.riskCapacityDays`.
- **[components/ui/FunnelCapacity.tsx](../components/ui/FunnelCapacity.tsx)** — accept a `cfg` prop; `pct = load / capacityFor(name)`, colour bands from `cfg.amberPct`/`redPct`, label `{load}/{cap}`.
- **[app/performance/page.tsx](../app/performance/page.tsx)** — fetch `getScoringConfig()` alongside tickets; team utilization = Σ weighted load ÷ Σ editor capacities × 100; editor-view "of N capacity" uses that editor's capacity. Pass `cfg` to `FunnelCapacity`, `loadMap`, `riskOf`.
- **[components/tickets/QueueTable.tsx](../components/tickets/QueueTable.tsx)** — pass `cfg` into the `riskOf` call used for the row risk badge.
- **[lib/tickets/scoring.ts](../lib/tickets/scoring.ts)** — `scoreTicket(inputs, cfg)`: take `weights`, `leadtimeFactor`, and resolve `eventTierNorm`/`effortNorm` from `cfg` (by name) instead of the hardcoded `WEIGHTS`/`TIER_PATTERNS`. Keep current constants as the exported defaults so existing callers/tests still pass with no config.
- **[lib/tickets/score-service.ts](../lib/tickets/score-service.ts)** — load `getScoringConfig()` once per run and pass into `scoreTicket`; resolve tier/effort by the event/asset type name it already selects.

- **[lib/roles.ts](../lib/roles.ts)** — add an Admin-group nav item: `{ href: '/settings/scoring', label: 'Capacity & scoring', icon: 'sliders', group: 'Admin' }`.

## Known limitation (call out, don't silently absorb)

Capacity/utilization is computed **at render from live Airtable reads**, so capacity, weight, and threshold edits take effect **immediately** on reload. Priority **weight** edits, however, change `priorityScore` which is persisted to **Postgres** and read back onto the queue via the existing sync path — so they require the admin to hit **"Recompute scores now"**, and surfacing the new score on the Airtable-read queue depends on the existing (separate) score-push path. This plan wires recompute; it does **not** add a new Postgres→Airtable score push. Flag this in the panel's helper text.

## Verification

1. `npm run build` && `npm run lint` — clean.
2. `npm run dev`, sign in as `rhythm@mindvalley.com` (bootstrap admin). Confirm **Capacity & scoring** appears in the Admin nav; non-admin is redirected.
3. **Capacity:** set global default to `2`, save → reload `/performance` → team utilization and per-editor bars reflect `/2`; an editor with 2 active tickets shows red. Set one editor's override to `6` → that editor's bar rescales.
4. **Weight:** set a VSSL/heavy Event Type `Load Weight` to `3` → an editor holding one such ticket jumps toward capacity; the "at capacity" risk flag fires within the configured window.
5. **Thresholds:** set `amber_pct=50` → bars turn amber sooner.
6. **Priority:** change `w_due` to `0.9`, click **Recompute scores now** → `prisma studio` shows updated `priorityScore`s favouring due-soon tickets.
7. Confirm a fresh Airtable base with all new fields blank reproduces **today's exact** numbers (defaults intact).

# Editable clip-generation prompt + rules (Airtable backend, admin portal frontend)

## Context

The "AI suggests clips" feature (the thing rendered at `blinklife.com/vishen/p/...`) is driven
entirely by this repo. The logic is a single structured-output call to `claude-opus-4-8` over a
podcast transcript ([lib/clipping/generate.ts](lib/clipping/generate.ts)), steered by a **frozen
system prompt** hardcoded at [lib/clipping/prompt.ts:8](lib/clipping/prompt.ts#L8) (`SYSTEM_PROMPT`)
plus `DEFAULT_BRAND_PILLARS` ([prompt.ts:5](lib/clipping/prompt.ts#L5)). It's read at
[generate.ts:78](lib/clipping/generate.ts#L78). Today, improving the prompt means editing that file
and redeploying — only an engineer can do it.

**Goal:** let Vishen / the team improve the clip logic *without a deploy*. Per the decisions:
- **Backend = Airtable** — a new "Rules" table is the source of truth for the prompt.
- **Frontend = admin portal page** — a `/settings/clip-rules` screen where people edit it.
- **Shape = base prompt + appendable rules** — keep the current spec as an editable base, and add a
  growing list of "rules / learnings" appended to it at generation time.
- **Clip type is a single-select dimension** — today everything is Instagram Reels, but in future
  we'll have other short-form **content forms** (Stage Talk, Shorts, other reel formats). Rules are
  scoped to a clip type so each form can have its own learnings; "All" rules apply to every type.

The code reads the active config from Airtable at generation time (cached, with the existing
hardcoded constants as a safe fallback), so the deployed engine always picks up the latest rules.

## Design overview

```
Admin (Vishen/team) ─edits─▶ Portal /settings/clip-rules ─server action─▶ Airtable "🧠 Clip Rules" table
                                                                                  │
generateStrategy() ◀── getClipEngineConfig(clipType) (cached ~60s, falls back to code) ─┘
   system = base prompt + appended active rules WHERE Clip Type ∈ { All, <requested type> }
```

## 1. Airtable backend — new "🧠 Clip Rules" table

Create one table in the **Creative Services base `appFEFygXo2pRc8AR`** (same base as Media Sources /
Clip Suggestions). One table holds the base prompt, brand pillars, and the appendable rules,
distinguished by `Kind`. Fields:

| Field | Type | Purpose |
|-------|------|---------|
| `Name` | single line (primary) | short label (e.g. "Base prompt", "Prefer contrarian-take clips") |
| `Kind` | single select: `Base Prompt` \| `Brand Pillars` \| `Rule` | row role |
| `Clip Type` | **single select**: `All` \| `Reel` \| `Stage Talk` \| `Short` (extensible) | which content form the row applies to |
| `Content` | long text | the prompt text / pillar list / rule text |
| `Active` | checkbox | included in composition when true |
| `Order` | number | ordering of appended rules |
| `Section` | single select: `General` \| `Clips` \| `Thumbnail` \| `Titles` \| `Distribution` | optional: which output section the rule targets |
| `Note` | long text | why this learning was added (history/context) |
| `Updated By` | single line | email from session, set on every write |
| `Updated At` | last-modified time | Airtable auto |

> **Two distinct axes — keep them separate.** `Clip Type` = the content *form* (Reel / Stage Talk /
> Short …) — the new single-select the team will grow. `Section` = which part of the generated
> strategy a rule nudges. A rule can be e.g. `Clip Type = Stage Talk`, `Section = Clips`.

Seed rows: one `Base Prompt` (`Clip Type = All`) pre-filled with the current `SYSTEM_PROMPT`, one
`Brand Pillars` (`Clip Type = All`) with `DEFAULT_BRAND_PILLARS`. Table created during implementation
via the Airtable MCP tools (`create_table` / `create_field`) or by hand — capture the resulting
table/field/option IDs for the field map. **No new env vars** (reuses `AIRTABLE_TOKEN`).

**Composition rule** (in code, for a requested `clipType`, default `Reel`):
`system = <active Base Prompt.Content>` + a trailing block
`"\n\nAdditional rules and learnings (always apply):\n- <rule1>\n- <rule2>…"` built from active
`Rule` rows where `Clip Type ∈ {All, clipType}`, sorted by `Order`. `brandPillars` default = active
`Brand Pillars` row Content.

## 2. Code — read config from Airtable (with fallback)

**New `lib/clipping/config.ts`** — `getClipEngineConfig(clipType = 'Reel'): Promise<{ systemPrompt: string; brandPillars: string }>`:
- Reads all Clip Rules rows via the existing REST client (`listAll` from [lib/airtable/rest.ts](lib/airtable/rest.ts)).
- Filters `Rule` rows to `Clip Type ∈ {All, clipType}`, composes system prompt + pillars per above.
- **In-module cache with ~60s TTL** (keyed by `clipType`) so we don't hit Airtable every generation.
- **Falls back to the code constants** (`SYSTEM_PROMPT`, `DEFAULT_BRAND_PILLARS`) on any
  `AirtableResult` error or empty result — generation must never break if Airtable is down. This is
  why the constants stay in [prompt.ts](lib/clipping/prompt.ts) as the canonical default/seed.

**Define the clip-type enum once** in `lib/clipping/clip-types.ts` (e.g. `CLIP_TYPES = ['Reel', 'Stage Talk', 'Short'] as const`) so the Airtable single-select, the config filter, and any future UI selector share one source of truth.

**New `lib/clip-rules/repository.ts`** — typed read/write mirroring [lib/media/repository.ts](lib/media/repository.ts):
`listClipRules()`, `createClipRule(input)`, `updateClipRule(id, patch)`, `setRuleActive(id, bool)`.

**`lib/airtable/field-map.ts`** — add a `CLIP_RULES` export `{ baseId, tableId, fields, kind_, clipType_, section_ }`
following the existing `MEDIA_SOURCES` / `CLIP_SUGGESTIONS` shape.

**Refactor [lib/clipping/generate.ts](lib/clipping/generate.ts):**
- `generateStrategy` gains an optional `clipType` (default `'Reel'`); first line
  `const { systemPrompt, brandPillars } = await getClipEngineConfig(clipType);`
- Pass `systemPrompt` to `system:` ([generate.ts:78](lib/clipping/generate.ts#L78)) instead of the imported constant.
- Thread the dynamic `brandPillars` default into `buildUserMessage` and `buildResearchPrompt` (add a
  `defaultBrandPillars` param to both in [prompt.ts](lib/clipping/prompt.ts); they currently fall back to the
  hardcoded `DEFAULT_BRAND_PILLARS` at [prompt.ts:39](lib/clipping/prompt.ts#L39) and [:57](lib/clipping/prompt.ts#L57)).
- Per-request `ctx.brandPillars` still overrides the default — no behaviour change. The two callers
  ([app/api/media/[id]/suggest/route.ts](app/api/media/[id]/suggest/route.ts),
  [app/api/content-engine/generate/route.ts](app/api/content-engine/generate/route.ts)) keep working;
  `clipType` defaults to `Reel`, matching today's behaviour. Wiring a clip-type selector into the
  "Suggest clips" UI is a **future extension** once more types exist — out of scope for this pass.

Note: the system prompt is currently frozen to keep the Anthropic prompt cache warm. Making it
dynamic means the cache resets the first time after an edit, then stays warm again (config is cached
in-process, edits are infrequent) — an acceptable trade for editability.

## 3. Frontend — admin portal page

**New route `app/settings/clip-rules/page.tsx`** (server component): wraps `AppShell`, fetches rows
via `listClipRules()`, renders `<ClipRulesEditor>`. Reuse the form/styling pattern from
[components/media/MediaLinkForm.tsx](components/media/MediaLinkForm.tsx) (`inputCls` token,
useState + async server-action handler, in-page success/error message).

**New `components/settings/ClipRulesEditor.tsx`** (client component):
- Base-prompt `<textarea>` + Save; brand-pillars input + Save.
- **Rules grouped by `Clip Type`** (All, Reel, Stage Talk, …) so it's clear which form each rule
  governs. Each rule row: Content + Section + Active toggle + edit. An "+ Add rule / learning" form
  with a **Clip Type single-select** (from `CLIP_TYPES`), Section, Content, Note.
- Deactivating (not deleting) preserves the learning trail.

**New `app/settings/actions.ts`** (`"use server"`): `updateBasePrompt`, `updateBrandPillars`,
`addClipRule`, `updateClipRule`, `setRuleActive`. Each resolves the editor's email via
`getEmployeeForSession()` ([lib/employee.ts](lib/employee.ts)) → writes `Updated By`, then
`revalidatePath('/settings/clip-rules')`.

**Nav:** add a "Clip Rules" (or "Settings") item with a ⚙ icon to
[components/ui/Sidebar.tsx](components/ui/Sidebar.tsx).

## 4. Access control (stopgap)

The portal has **no role-gating yet** ("real role-gating arrives with Blinkwork SSO"), so this page
would be editable by anyone signed in. Add a lightweight **email allowlist** guard in both the page
and the server actions: a `CLIP_RULES_ADMINS` env var (comma-separated emails, set via
`kessel env set`); non-allowlisted users see read-only. Stopgap until Blinkwork SSO roles.

## Files to create / modify

**Create:**
- `lib/clipping/clip-types.ts` — `CLIP_TYPES` enum (shared source of truth)
- `lib/clipping/config.ts` — `getClipEngineConfig(clipType)` (filter + compose + cache + fallback)
- `lib/clip-rules/repository.ts` — typed Airtable read/write
- `app/settings/clip-rules/page.tsx` — admin page
- `components/settings/ClipRulesEditor.tsx` — editor UI
- `app/settings/actions.ts` — server actions

**Modify:**
- `lib/clipping/generate.ts` — `clipType` param; read config instead of constants
- `lib/clipping/prompt.ts` — add `defaultBrandPillars` param to `buildUserMessage` / `buildResearchPrompt`; keep constants as fallback/seed
- `lib/airtable/field-map.ts` — add `CLIP_RULES` mapping
- `components/ui/Sidebar.tsx` — add nav item

**Airtable (one-time setup):** create the "🧠 Clip Rules" table (with the `Clip Type` single select)
+ seed Base Prompt / Brand Pillars rows.

## Verification

1. **Fallback first:** before the Airtable table exists, run a generation — `getClipEngineConfig()`
   must fall back to the code constants and produce identical output to today.
2. Create the table + seed rows; reload `/settings/clip-rules` and confirm the base prompt + pillars
   render, and rules are grouped by Clip Type.
3. **Round-trip (type-scoped):** add a rule under `Clip Type = Reel` (e.g. "Always include one
   contrarian-take clip"), Save, trigger "Suggest clips" (defaults to Reel) on a Media Source, and
   confirm the new rule visibly influenced output. Add a `Stage Talk`-scoped rule and confirm it does
   NOT appear in a Reel generation (proves type-scoping). Optionally log the composed system prompt
   in dev.
4. Toggle a rule inactive → regenerate → confirm it no longer applies (after the ~60s cache TTL).
5. Confirm provenance: edited rows show the editor's email in `Updated By`.
6. `npm run build` + `npm run lint` clean.

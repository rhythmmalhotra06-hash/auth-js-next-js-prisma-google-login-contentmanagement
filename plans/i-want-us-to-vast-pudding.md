# Intelligent clip-agent feedback loop

## Context

Today the clip agent (`lib/clipping/*`, model `claude-opus-4-8`) turns a transcript into a
10-section content strategy. When you **re-run** clips the only lever surfaced is a transcript
paste box — if generation fails it just says *"paste the transcript instead."* There is no way to
tell the agent *what was wrong* with the last run, and nothing you say is remembered.

Yet the plumbing for memory already exists: the system prompt is composed at run time from the
**🧠 Clip Rules** table (`Base Prompt` + `Brand Pillars` + appended `Rule`/learning rows, scoped by
clip type) via `getClipEngineConfig` in [config.ts](lib/clipping/config.ts). That table **is** the
agent's memory — it's just only editable by admins in Settings today, and disconnected from the
generation surface. Separately, real outcome signals (Rating, Released, Feedback, "24 Data") already
flow into the read-only `CLIPS_SYNC` mirror but **nothing reads them**.

**Goal:** add a feedback box to the re-run flow, plus a "remember this as a learning" checkbox that
writes into the Clip Rules memory the agent reads on every future run — and close the loop a second
way by letting the agent propose learnings from clips that actually performed.

**Decisions (confirmed with user):** loop depth = **AI-distilled learning + outcome loop**; scope =
**ask each time** (per-clip-type or All); who can teach = **anyone who can re-run** (bypass the admin
guard, keep it auditable); surfaces = **both** the Vishen Media page and the standalone Content Engine.

## Design — a two-tier learning loop

**Tier 1 — fast/manual (you teach it):** feedback box + "remember" checkbox on re-run. Feedback
steers *this* run; if "remember" is checked, an AI pass distills it into a durable, generalizable
rule and appends it to the Clip Rules memory. Immediate effect on the next generation.

**Tier 2 — slow/automatic (it learns from outcomes):** a scheduled job reads the Rating/Released/
Feedback signals from `CLIPS_SYNC`, asks the agent to propose 2–3 generalizable learnings from what
performed well vs poorly, and writes them as **inactive "Proposed" rules**. An admin approves them in
Settings (propose→human-approves, per the CLAUDE.md intelligence-layer principle). Approved proposals
become live memory exactly like Tier-1 learnings.

Both tiers write the same `ClipRule` rows, so there is one memory, one editor, one audit trail.

---

## Tier 1 — per-run feedback + remember-as-learning

### 1. Inject feedback into the prompt (transient, this run only)
`lib/clipping/prompt.ts` — `buildUserMessage` gains an optional `feedback` param, injected as a
labelled block (e.g. `--- EDITOR FEEDBACK (steer this run) ---`) before the transcript, so it never
gets confused with source text. Keep it a distinct block; do not fold into brand pillars.

`lib/clipping/generate.ts` — `generateStrategy(..., opts)` opts gain `feedback?: string`; pass it to
`buildUserMessage`. No schema change.

### 2. Distill feedback into a durable rule (the "intelligent" part)
New helper `distillFeedbackToRule(feedback, clipType, existingRules)` in a new
`lib/clipping/learn.ts`:
- One cheap, fast Anthropic call (use `claude-haiku-4-5`, add a `DISTILL_MODEL` constant next to
  `CLIP_MODEL` in [anthropic.ts](lib/clipping/anthropic.ts)) with a structured-output schema
  `{ rule: string, section: enum, skip: boolean }`.
- Prompt: "Rewrite this editor feedback as ONE crisp, generalizable clip-generation rule. Drop
  anything specific to this episode/transcript. If it's purely one-off and not worth remembering,
  set skip=true." Pass the current active rules so it won't duplicate an existing one.
- Returns the distilled rule (or a skip signal the UI reports back).

### 3. Persist the learning (bypassing the admin guard, but auditable)
- Reuse `createClipRule` in [clip-rules/repository.ts](lib/clip-rules/repository.ts#L140) — no
  schema change; it already sets `kind='Rule'`, `active:true`, and accepts `clipType`, `section`,
  `note`, `updatedBy`.
- Set `note = "Learned from clip feedback — <date>"`, `updatedBy = <user email>` for the audit trail.
- **Do NOT route through `app/settings/actions.ts::addRule`** — that is admin-gated
  (`getClipRulesAccess`). Instead call `createClipRule` directly from the generation API routes
  (below), using the session email. This is the deliberate widening of who can teach; it stays
  reversible because every learning is attributed and toggle-able in the Settings editor.

### 4. Wire the API routes
Both routes already call `generateStrategy` and can accept the extra body fields:
- `app/api/media/[id]/suggest/route.ts` — read `feedback?: string`, `remember?: boolean`,
  `rememberScope?: 'All'|clipType` from the body; pass `feedback` into `generateStrategy`; if
  `remember`, after a successful generation call `distillFeedbackToRule` then `createClipRule`
  (scope = `rememberScope || clipType`). Return the saved/ skipped rule text so the UI can confirm.
- `app/api/content-engine/generate/route.ts` — same additions.
- Failures to save a learning must **not** fail the generation — best-effort, surfaced as a
  non-blocking note in the response.

### 5. UI — both surfaces
Reuse the existing inline form conventions in these files (raw
`<textarea>` / `<input type="checkbox" className="h-4 w-4 accent-brand">` / `.btn` — there is no
`Checkbox` primitive; `Field.tsx` has a `Textarea` if we prefer it, but match the file's local style).

- `components/media/MediaDetailClient.tsx` — extend the shared `controls` block
  ([lines 92-146](components/media/MediaDetailClient.tsx#L92-L146)):
  - Add a **Feedback** textarea ("What should change? e.g. clips too long, too salesy, miss the
    emotional beats"). Most prominent in the "Not quite right? Re-run clips" card.
  - Add a **"Remember this as a learning"** checkbox with an adjacent **scope select**
    `[ this clip type ▾ | All ]` (default = current clip type) — satisfies "ask each time".
  - Send `feedback`, `remember`, `rememberScope` in the `suggest()` POST body
    ([line 65](components/media/MediaDetailClient.tsx#L65)).
  - After the run, show a small confirmation: *"Saved as a learning: '…' — manage in Settings"* (or
    *"Noted for this run; nothing worth remembering"* on skip).
- `components/clipping/ClipEngineForm.tsx` — mirror the same feedback box + checkbox + scope select.

Also relax the re-run copy so transcript reads as truly optional and feedback is the primary
"steer it" lever.

---

## Tier 2 — outcome loop (propose → approve)

### 1. Prerequisite: map the signal fields
[field-map.ts CLIPS_SYNC](lib/airtable/field-map.ts#L530) currently exposes only `App Clip ID` + the
ticket link. Add field IDs for **Rating, Released, Feedback, "24 Data"** (verify live against base
`creativeServices`, table `tblRXoSfDBFnpYk7G`) and confirm those fields are enabled in the Airtable
sync's field set (same caveat as `App Clip ID` at [field-map.ts:528](lib/airtable/field-map.ts#L528)).

### 2. Read the signals
New `lib/media/clip-signals.ts`: `listRatedClips()` over `CLIPS_SYNC` returning
`{ appClipId, rating, released, feedback }[]`, filtered to rows that carry a rating or feedback.

### 3. Propose learnings on a schedule
- New endpoint `app/api/clips/learn/route.ts` (Node runtime), protected by `SYNC_SECRET` like the
  other sync endpoints. It: reads rated clips → splits high vs low performers → calls a
  `proposeLearnings(highs, lows, existingRules)` helper in `lib/clipping/learn.ts` (Anthropic,
  structured output, told NOT to duplicate existing active or already-proposed rules) → writes each
  proposal via `createClipRule` with **`active: false`**, `section` set, and
  `note = "Proposed from performance — <evidence summary>"`.
- Schedule it as a Kessel cron (weekly), consistent with the existing sync crons (see the sync
  scheduling notes in memory / `plans/`). Manual "Propose learnings now" button optional.

### 4. Approve in Settings
`components/settings/ClipRulesEditor.tsx` — add a **"Proposed learnings (from performance)"** section
listing `active:false` rules whose `note` starts with "Proposed from performance", each with
**Approve** (→ `setRuleActive(id, true)`, already exists) and **Dismiss** (leave inactive / a future
archive flag). No new write path needed — reuses `setRuleActive` in
[settings/actions.ts](app/settings/actions.ts#L30).

---

## Files

**Modify**
- [lib/clipping/prompt.ts](lib/clipping/prompt.ts) — `feedback` block in `buildUserMessage`
- [lib/clipping/generate.ts](lib/clipping/generate.ts) — thread `feedback` through opts
- [lib/clipping/anthropic.ts](lib/clipping/anthropic.ts) — add `DISTILL_MODEL`
- [app/api/media/[id]/suggest/route.ts](app/api/media/[id]/suggest/route.ts) — feedback/remember/scope + persist
- [app/api/content-engine/generate/route.ts](app/api/content-engine/generate/route.ts) — same
- [components/media/MediaDetailClient.tsx](components/media/MediaDetailClient.tsx) — feedback box + checkbox + scope + confirmation
- [components/clipping/ClipEngineForm.tsx](components/clipping/ClipEngineForm.tsx) — same UI
- [lib/airtable/field-map.ts](lib/airtable/field-map.ts) — CLIPS_SYNC signal field IDs
- [components/settings/ClipRulesEditor.tsx](components/settings/ClipRulesEditor.tsx) — proposed-learnings section

**Create**
- `lib/clipping/learn.ts` — `distillFeedbackToRule` + `proposeLearnings`
- `lib/media/clip-signals.ts` — read Rating/Released/Feedback from CLIPS_SYNC
- `app/api/clips/learn/route.ts` — scheduled outcome-loop endpoint

**Reuse (no change):** `createClipRule` / `updateClipRule` / `listClipRules`
([clip-rules/repository.ts](lib/clip-rules/repository.ts)), `getClipEngineConfig`
([config.ts](lib/clipping/config.ts)) — it already picks up new active rules within its 60s cache;
`setRuleActive` ([settings/actions.ts](app/settings/actions.ts#L30)).

## Verification

- **Tier-1 steer:** on a Media source with clips, open "Re-run clips", type feedback ("keep under
  45s, less salesy"), leave remember off, re-run → confirm the block reaches the model (log the
  composed user message in dev) and output reflects it. Transcript left blank still reuses the stored
  one (no "add a transcript" error).
- **Tier-1 memory:** re-run with remember on (scope = Reel) → confirm a new active `Rule` row appears
  in `/settings/clip-rules` attributed to your email; then generate a *fresh* source and confirm
  `getClipEngineConfig` includes the new rule (bust the 60s cache) and the model honors it.
- **Distillation quality:** feed a messy one-off note → confirm it's rewritten into a general rule,
  and a purely transcript-specific note is `skip`ped (reported, not saved).
- **Permissions:** confirm a non-admin editor can save a learning from the Media page (guard bypass
  works) while `/settings/clip-rules` stays admin-only.
- **Tier-2:** with CLIPS_SYNC signal fields mapped, POST `/api/clips/learn` with `SYNC_SECRET` →
  confirm inactive "Proposed from performance" rules appear in Settings with evidence notes; approve
  one → it becomes active and shows up in the next generation.
- `npm run lint` + `npm run build`.

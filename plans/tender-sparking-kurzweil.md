# Clip suggestions: encode Viral Clip Extractor rules + fix timestamp drift

## Context

Two asks against the Content Clipping Engine (the shared `generateStrategy` pipeline behind
Vishen media clips, the paste/upload content-engine form, and the social "generate clip
suggestions" button):

1. **Encode the "Viral Clip Extractor" editorial framework as clip-suggestion rules.** The
   framework (three gates, save/share optimization, storytelling weighting, a gold-standard
   reference, and scope limits) currently lives only in a shared HTML doc. The live Airtable
   🧠 Clip Rules table already has an active Base Prompt that names the three virality drivers
   but (a) only requires **one** driver and (b) is missing the save/share, storytelling,
   gold-standard, and anti-pattern guidance. There are **no `Rule` records yet**.

2. **Fix timestamp drift.** AI-suggested clip/social timestamps don't match the real video.
   **Root cause (confirmed):** every transcript ingestion path flattens the transcript to bare
   space-joined text and strips all timing before it reaches the model, so the model *invents*
   plausible `mm:ss` values. There is zero validation that returned timestamps exist in the
   transcript. Both the media and social paths share the same generation code, so one fix covers
   both.

### Decisions (from the user)
- **Gate strictness:** all three gates *preferred, not mandatory* — prefer/rank clips hitting all
  three highest; allow standout 1–2 gate clips through *with a note* on which gates they hit/miss.
- **Output depth:** *prompt rules only* — no schema or UI changes. New criteria surface through the
  existing `rationale` / `viralityScore` fields.
- **Timestamp guard:** feed the model a *timestamped* transcript, then *snap* any returned time to
  the nearest real transcript segment boundary.

### Key operational fact
Deployed env has `REFERENCE_BACKEND=postgres`: the app **reads** clip rules from the Postgres
`ClipRule` mirror, while rule **writes** (`createClipRule`) go to **Airtable**. New rules therefore
only take effect in production once the reference sync mirrors them into Postgres.

---

## Task 1 — Add the editorial rules (data, not code)

Add discrete `Rule` records to the 🧠 Clip Rules table (base `appFEFygXo2pRc8AR`, table
`tblNTRNmpQyIusmEU`), `Kind = Rule`, `Clip Type = All`, `Section = Clips`, `Active = true`, with
ascending `Order`. `config.compose()` (`lib/clipping/config.ts:31-38`) appends active rules under
"Additional rules and learnings (always apply):", so no code change is needed for them to take effect.
These layer cleanly on the existing Base Prompt (its "label the driver(s)" + "at least one" floor
stays; the new gate rule adds the preference on top).

Rules to create (final wording refined at implementation):

1. **Gate preference (strictness).** Strongly prefer clips that hit all three gates — Controversy,
   Uncommon Knowledge, Humor — and rank those highest. A clip may still be suggested on only one or
   two gates *if exceptional*; when it is, explicitly note which gates it hits and which it misses.
2. **Optimize for saves & shares first.** Prioritize save-worthy (actionable, quotable, named
   frameworks, specific data tied to a story) and share-worthy ("send this to a friend") moments
   over comment-bait. Rage-inducing-but-shallow comment-bait is lower-tier. Never prioritize
   fight-likelihood over save/share potential.
3. **Storytelling weighting.** Weight narrative arc (Setup → Tension → Resolution) above pure
   opinion. Favor personal stories with specific details (a dollar amount, a name, a physical
   measurement, a time period); insider betrayal (speaker contradicts their own field); named
   frameworks that give language to a felt-but-unnamed experience; confessions / self-deprecating
   admissions from credible people. Abstract opinion without a story anchor ranks lower unless the
   concept itself is novel enough to be the hook.
4. **Gold-standard calibration.** Calibrate against the "chasing the forward gap is like chasing the
   horizon" type of clip: it ranks high because it names a universal feeling (high save/share) even
   though its fight-likelihood is lower than a hustle-culture attack.
5. **Scope limits / anti-patterns.** Don't rank clips by how informative or well-argued they are;
   don't pick clips that repeat conventional wisdom without an uncommon angle; scan the *full*
   transcript before ranking (never stop at the first strong moment); extract fresh from the source
   every time (don't pattern-match to a prior report); captions punchy, no hashtag spam, end on a
   hook question or provocation.

### How to apply
- **Preferred:** add via `/settings/clip-rules` (Admin editor → "Add a rule / learning"), which calls
  `addRule` → `createClipRule` (`lib/clip-rules/repository.ts:142`). Editor: `components/settings/ClipRulesEditor.tsx`.
- **Or programmatically:** `create_records_for_table` on the table above (Kind/Clip Type/Section/
  Active/Order/Content fields per `lib/airtable/field-map.ts:350-371`).
- **Then (required for prod):** run the clip-rules reference sync so the Postgres `ClipRule` mirror
  picks them up (reads go through `listClipRulesPg`, `lib/clip-rules/repository.ts:70-91`). Verify the
  rules appear via `/settings/clip-rules` on the deployed app before considering it done.

*(No change to the "prompt rules only" decision: leave `STRATEGY_SCHEMA` / `ReelsClip` and all UI
untouched.)*

---

## Task 2 — Fix timestamp drift (code)

Make real timestamps survive ingestion → reach the model → be snapped on output. Files:

**1. Preserve per-segment timing at ingestion**
- `lib/clipping/supadata.ts` — stop forcing plain text: drop `&text=true` (line 64) so Supadata
  returns segments; in `contentToText` (lines 15-22) keep each segment's `offset`/`duration` and emit
  a timestamped line (`[MM:SS] text`). Verify the Supadata plan returns segment offsets in this mode.
- `lib/clipping/transcript.ts` — in `segmentsToText` (138-146) and `parseTimedText` (164-172), retain
  each cue's start offset instead of `.join(' ')`; `normalizeTranscript` (91-105) must keep timing when
  producing the timestamped form. YouTube timedtext already carries `start`/`dur` — just stop discarding it.
- Produce **two artifacts** from ingestion: (a) the timestamped transcript string for the prompt, and
  (b) a structured segment index `Array<{ seconds: number; text: string }>` used for snapping.

**2. Feed the timestamped transcript to the model**
- `lib/clipping/prompt.ts` `buildUserMessage` (line 70) — insert the timestamped transcript between
  the TRANSCRIPT markers. Add an instruction (and update `schema.ts:179-180` field descriptions +
  the Airtable Base Prompt / fallback `SYSTEM_PROMPT`) to **reuse only timestamps present in the
  transcript — never invent times**.

**3. Snap/validate returned timestamps**
- In `lib/clipping/generate.ts` after `validateStrategy` (~line 117), or inside `validateStrategy`
  (`lib/clipping/schema.ts:251`), parse each `reelsClips[].timestampStart/End` to seconds and snap to
  the nearest segment boundary from the ingestion index, then reformat to `MM:SS`. Apply the same snap
  to `youtubeHook.chapterMarkers`/`cutIns` and `showNotes.timestamps` (secondary; reelsClips is the
  priority since it feeds both clips and social).
- Thread the segment index into `generateStrategy` (extend `GenerateOptions`, `generate.ts:7-13`) so
  the snap step has it.

**4. Graceful fallback for un-timed sources**
- Pasted/uploaded transcripts may have no timestamps. When the segment index is empty, skip snapping
  and keep current behavior, but mark the timecodes as approximate (or omit) rather than presenting
  fabricated times as exact. No downstream change: social still joins into `timecode`, media still
  writes `timestampStart/End` — both consume the corrected `reelsClips`.

---

## Verification

**Task 1**
- Deployed `/settings/clip-rules` shows the 5 new active rules (confirms Airtable→Postgres mirror ran).
- Run a real generation (Clips page "Suggest clips" on a Vishen media video) and confirm suggested
  clips reflect save/share + storytelling emphasis and note gate coverage.

**Task 2**
- Pick a YouTube video with captions; run `/api/content-engine/generate` (or the Clips "Suggest"
  button) and assert **every** returned `timestampStart/End` exists in the ingestion segment index
  (add a temporary log of any snap corrections).
- Spot-check 2–3 clips' start times against the actual video — they should land on the real moment.
- Run `/api/social/suggest` and confirm the `timecode` strings map to real moments.
- Confirm the snap step logs corrections when the model drifts (proves the guard is active), and that
  a pasted un-timed transcript degrades gracefully (no fabricated exact times).

## Rollout
- Task 1 is data + a sync run (no deploy). Task 2 is a code change → commit + push to `main`
  (auto-deploys), then run the Task 2 verification against the deployed app.

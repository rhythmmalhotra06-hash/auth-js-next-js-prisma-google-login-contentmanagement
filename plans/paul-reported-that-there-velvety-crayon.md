# Fix: clip generation fails with "compiled grammar is too large"

## Context

Paul reported clip generation is broken. It is — and it has been since **2026-07-27**.

The exact error, recovered from the `Error` column of 📺 Media Sources (`tblBQhM2Blqa7uNZX`):

```
400 {"type":"error","error":{"type":"invalid_request_error",
"message":"The compiled grammar is too large, which would cause performance
issues. Simplify your tool schemas or reduce the number of strict tools."}}
```

Three failed runs, all identical, all Paul's:

| Date | Source | request_id |
|---|---|---|
| 2026-07-27 | Become a Master Storyteller | `req_011CdW1HG1dKiebNuvuYYDWG` |
| 2026-08-04 | (untitled YouTube) | `req_011CdhD1fB9jDgXWENfzr9SN` |
| 2026-08-10 | Kash Podcast — Law Of Resonance | `req_011CdtZZ5doQZuQFottaYpJf` |

**Root cause.** [generate.ts:91](lib/clipping/generate.ts#L91) sends `STRATEGY_SCHEMA`
as `output_config.format.json_schema`. Structured outputs compile that schema into a
constrained-decoding grammar, and the grammar now exceeds Anthropic's size cap. The
request is rejected at validation time — before any generation happens, which is why
re-running produces the byte-identical error rather than anything transient.

The trigger is commit `e1da2c6` ("integrate Viral Clip Extractor structure"), authored
**Mon Jul 27 2026** — the same day as the first failure. It grew the `reelsClips` item
object from **7 required properties to 16** ([schema.ts:213-230](lib/clipping/schema.ts#L213-L230))
and added a 7-value enum. Grammar size is driven by structural complexity (property
count per object, nesting, alternation), so that one change is what pushed it over.

Two things follow that shape the fix:

- **Field `description` strings do not affect grammar size** — they are not constraints.
  Shortening the (very long) descriptions in `STRATEGY_SCHEMA` would achieve nothing.
- The cap is undocumented publicly and there is **no `ANTHROPIC_API_KEY` in local `.env`**,
  so we cannot binary-search the exact limit before shipping. The plan therefore pairs a
  size reduction with a fallback that cannot fail, and logs which one carried the request.

**Blast radius.** All three generation surfaces share `generateStrategy`, so `/media`,
`/content-engine`, and `/social` are all dead. Because the routes return HTTP 200 with
`{ok:false}` ([suggest/route.ts:114](app/api/media/[id]/suggest/route.ts#L114)), this never
tripped any HTTP-level monitoring — it sat broken for two weeks until Paul said something.

---

## Approach

Shrink the compiled grammar, and make a grammar-size rejection non-fatal if the shrink
turns out to be insufficient. No downstream consumer changes: `validateStrategy` backfills
the legacy field shape, so all UI, Airtable, and brief-composition code is untouched.

### 1. Slim the `reelsClips` item — [lib/clipping/schema.ts](lib/clipping/schema.ts)

16 → 12 required properties, losing no information:

- **Three gate booleans → one `gates` array.**
  `gateControversy` / `gateUncommonKnowledge` / `gateHumour` become
  `gates: { type: 'array', items: { type: 'string', enum: [...VIRALITY_GATES] } }`.
  This matches how Airtable already models it — `Virality Gates` (`flddia08JHB6jUqTF`)
  is a `multipleSelects`, and [repository.ts:427](lib/media/repository.ts#L427) already
  rebuilds exactly this array from the three booleans on write.
- **Drop `hookLine`.** Redundant since `e1da2c6`:
  [repository.ts:442](lib/media/repository.ts#L442) writes
  `[CF.hookLine]: c.nuclearHookTitle || c.hookLine`, and the field-map comment already
  calls it "Nuclear Hook Title (≤8 words) on generation".
- **Drop `format`.** Still rendered in the UI, but
  [clip-mirror.ts:72](lib/media/clip-mirror.ts#L72) already defaults it
  (`c.format ?? 'talking_head'`); do the same in `validateStrategy` and remove the enum
  from the generation schema.

Keep `nuclearHookTitle`, `descriptiveTitle`, `timestampStart/End`, `viralMechanism`,
`rationale`, `coldOpen`, `caption`, `verbatimExtract`, `editNotes`, `viralityScore` — all
are read by [MediaDetailClient.tsx](components/media/MediaDetailClient.tsx),
[ClipBoard.tsx](components/vishen/ClipBoard.tsx), and
[clip-brief.ts](lib/clipping/clip-brief.ts).

Do **not** remove whole sections from `STRATEGY_SCHEMA`. I checked: all eleven are
rendered by [StrategyDetail.tsx](components/media/StrategyDetail.tsx) and
[StrategyView.tsx](components/clipping/StrategyView.tsx).

### 2. Keep the TS surface stable — `validateStrategy` in the same file

Extend the existing normalization loop ([schema.ts:320-329](lib/clipping/schema.ts#L320-L329))
to derive the legacy fields from the new ones, so nothing downstream changes:

```ts
const g = Array.isArray(c.gates) ? c.gates : [];
c.gateControversy       = g.includes('Controversy');
c.gateUncommonKnowledge = g.includes('Uncommon Knowledge');
c.gateHumour            = g.includes('Humour');
c.hookLine ??= c.nuclearHookTitle || '';
c.format   ??= 'talking_head';
```

Keep `gateControversy`/`gateUncommonKnowledge`/`gateHumour`/`hookLine`/`format` on the
`ReelsClip` interface (already optional) — they stay populated, just derived rather than
generated. `gates` is additive.

### 3. Update the prompt — [lib/clipping/prompt.ts:23](lib/clipping/prompt.ts#L23)

That line instructs the model to "Set gateControversy / gateUncommonKnowledge /
gateHumour accordingly". Rewrite to describe the `gates` array. Also drop the `hookLine`
instruction. Note `SYSTEM_PROMPT` is overridable from the 🧠 Clip Rules Airtable table via
[config.ts](lib/clipping/config.ts) — check whether a stored override also names the old
fields, and update it if so.

### 4. Safety net: degrade instead of dying — [lib/clipping/generate.ts:85-102](lib/clipping/generate.ts#L85-L102)

Wrap the structured call so a grammar-size rejection retries once **without**
`output_config`, appending a "return only JSON matching this shape" instruction to the
user message and letting the already-lenient `validateStrategy` handle the result.

```ts
// Structured outputs compile the schema to a decoding grammar with an undocumented
// size cap. If we're over it, fall back to prompt-guided JSON rather than failing the
// run — validateStrategy is lenient by design. Logged so we know the schema needs work.
if (isGrammarTooLarge(e)) {
  console.warn('[clip-gen] schema over grammar cap — falling back to unconstrained JSON');
  return await streamUnconstrained();
}
```

Match on `e.status === 400 && /compiled grammar is too large/i.test(raw)`. This is what
guarantees Paul is unblocked even if step 1 does not shrink far enough; the `console.warn`
is how we find out (visible in `kessel runtime-logs`).

### 5. Stop leaking raw SDK errors — [lib/clipping/anthropic.ts:49-51](lib/clipping/anthropic.ts#L49-L51)

`friendlyAnthropicError` returns `null` for a plain 400, so `generate.ts` rethrows the raw
`400 {"type":"error",...}` blob — which is precisely the wall of JSON Paul was looking at.
Add a `case 400` returning a plain sentence ("AI generation was rejected by the API — this
has been logged; an admin needs to look at it."), keeping the full error in `console.error`
and the Airtable `Error` column for us.

---

## Files

| File | Change |
|---|---|
| [lib/clipping/schema.ts](lib/clipping/schema.ts) | Slim `reelsClips` item; add `VIRALITY_GATES`; derive legacy fields in `validateStrategy` |
| [lib/clipping/prompt.ts](lib/clipping/prompt.ts) | Describe `gates` array; drop `hookLine` instruction |
| [lib/clipping/generate.ts](lib/clipping/generate.ts) | Grammar-size fallback + warn log |
| [lib/clipping/anthropic.ts](lib/clipping/anthropic.ts) | Friendly message for 400 |

No changes needed in `lib/media/repository.ts`, `app/media/actions.ts`,
`lib/clipping/clip-brief.ts`, `components/media/MediaDetailClient.tsx`, or
`components/vishen/ClipBoard.tsx` — they read the derived booleans, which stay populated.

---

## Verification

1. `npm run build` — catches any `ReelsClip` type fallout.
2. Deploy: `kessel deploy` (session is expired — `kessel login --api-url
   https://kesselrun-be-jdtcvngavq-as.a.run.app` first). Deploys from git, not the working
   tree, so commit first.
3. Re-run Paul's three failures from `/media` — the two titled ones are
   `https://youtu.be/z3yjfV4NVgc` and `https://www.youtube.com/watch?v=P-BQ-AGS0ck`.
   Expect Status to move `Transcribing → Clips Suggested` with 5–8 clip rows created,
   and the `Error` column cleared.
4. `kessel runtime-logs --since 30m | grep clip-gen` — **if the fallback warning appears,
   step 1 did not shrink enough.** Generation still works, but escalate to splitting
   `generateStrategy` into two parallel structured calls (clips + episode metadata), which
   halves each grammar and has the side benefit that a metadata failure no longer costs
   the editor their clips.
5. Confirm in Airtable that a new clip row has `Virality Gates` populated (proves the
   array → multi-select path works end-to-end) alongside Cold Open / Verbatim / Edit Notes.

## Out of scope

- The three generation routes returning **HTTP 200 on failure** is why nobody noticed for
  two weeks. Worth a separate look, but changing it now risks the client error UX.
- The 9 untracked `* 2.ts` / `* 2.tsx` macOS copy artifacts are dead weight (byte-identical,
  imported nowhere) but are type-checked by `tsc` via `tsconfig.json`. Separate cleanup.

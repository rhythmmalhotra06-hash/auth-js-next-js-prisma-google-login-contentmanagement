---
title: 'Generation Pipeline'
slug: 'generation-pipeline'
scope: feature
status: discovery
parent: content-production-management/content-clipping-engine.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 6/7
---

# Generation Pipeline

> Part of [AI Content Clipping Engine](../content-clipping-engine.md)

## Purpose

The core engine: turn a normalized transcript + context into the full 10-section viral content strategy via Claude (`claude-opus-4-8`), and persist it. Everything else in E8 feeds into or renders the output of this feature.

## Behavior

`POST /api/content-engine/generate` — `export const runtime='nodejs'`, `export const maxDuration=300`.

1. Create `ContentSource` (transcript + context) + `ClipStrategy` with `status='generating'`.
2. **Phase A (optional, when web-search toggle on):** an unstructured `client.messages.create` turn with `tools:[{type:"web_search_20260209", name:"web_search"}]` + adaptive thinking; loop while `stop_reason==='pause_turn'`. Researches current trends / SEO keywords / hashtags.
3. **Phase B:** `client.messages.stream({ model:"claude-opus-4-8", max_tokens:16000, thinking:{type:"adaptive"}, output_config:{format:{type:"json_schema", schema}} , messages })` → `await stream.finalMessage()`.
4. Parse + validate the JSON, write `ClipStrategy.output` + one `ClipSuggestion` row per Reels clip, set `status='complete'`, return `{ strategyId }`.

`lib/clipping/`: `anthropic.ts` (singleton client), `prompt.ts` (Vishen's skill spec verbatim + default brand pillars), `schema.ts` (json_schema + TS types), `generate.ts` (the two-phase orchestration), `data.ts` (queries).

## Rules & Logic

- **Web search and structured output never share a turn** — Phase A is free-form tool-use; Phase B is the strict JSON emit consuming that conversation. If web search is off, Phase B runs alone.
- **System prompt is frozen** (no interpolated timestamps) for prompt-cache friendliness; transcript + context go in the user turn.
- **Counts/ranges are validated in TS after `finalMessage()`**, not by schema (structured outputs ignore `min/max`): virality score 1–10, 5–8 clips, 3 titles, 5 pull quotes, 5 title tests.
- Every schema object sets `additionalProperties:false`; `enum` for `format` and `platform`.

## Data

- **`ClipStrategy`**: `contentSourceId`, `model`, `status` (`generating|complete|error`), `error?`, `output` (Json — full 10-section strategy), `usedWebSearch` (Bool), `createdAt`.
- **`ClipSuggestion`** (derived from `output.reelsClips`): `clipStrategyId`, `index`, `title`, `timestampStart`, `timestampEnd`, `rationale`, `caption?`, `hookLine?`, `format?`, `platform?`, `viralityScore?`, `status` (`proposed|approved|dismissed`), `ticketId?`.
- **`ContentSource`** holds the transcript + context (owned by Transcript Ingestion; written here).

## Failure Modes

- Generation throws (API error, refusal) → `status='error'`, message stored, detail view shows the error + a retry action.
- Long latency (web search + ~12k output) → `maxDuration=300` + streaming prevents HTTP timeout to Claude.
- Malformed / short JSON or failed count-range validation → reject and surface a clear error (optionally one automatic retry of Phase B).
- Missing `ANTHROPIC_API_KEY` → explicit config error, not a silent failure.

## Acceptance Criteria

- Paste the Kiara King transcript → all 10 sections present, `reelsClips` has 5–8 clips each with a 1–10 score, `ClipStrategy.status='complete'`, `ClipSuggestion` rows created.
- Web-search toggle **off** → still produces valid 10-section JSON (Phase B alone).
- The route runs on the Node runtime (not edge); `npm run build` clean.

## Open Questions

- Cost ceiling per generation (web-search turn + ~12k output tokens) — do we cap or warn above a threshold?
- Do we stream generation progress to the UI, or show a spinner and redirect on completion (MVP)?
- Auto-retry policy when schema/count validation fails — one silent retry, or surface immediately?

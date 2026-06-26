# AI Content Clipping Engine — Implementation Plan

## Context

Vishen (CEO) wants the team to "put the Kiara King podcast into Claude and Claude tells you what to clip" by end of June. He shared a skill spec that turns a long-form transcript into a complete **10-section viral content strategy** (titles, thumbnails, YouTube hook, Instagram Reels moments, pull quotes, show notes, distribution plan, title split-tests).

This plan adds that capability to the existing ContentManagement portal (Next.js App Router + Postgres + Prisma, no LLM integration today). It is the first concrete build of the "propose → human approves" intelligence layer described in `context/intelligence-layer.md`.

**Decisions locked with the user:**
- **Scope:** Clip engine only (the generator + save/history). Engagement learning loop is later.
- **Integration:** Wired into tickets/assets — the generated Instagram Reels clips become **proposed Tickets** in the production queue (propose → approve), reusing the existing `createTicket()` invariant.
- **Transcript input:** Paste text + file upload (.txt/.vtt/.srt) + best-effort YouTube URL fetch with graceful fallback.
- **Model:** `claude-opus-4-8` via the official `@anthropic-ai/sdk`, adaptive thinking, web-search server tool for SEO/trend grounding, streaming for the long output.

---

## Architecture

```
Transcript (paste | .txt/.vtt/.srt | YouTube URL)
   → normalize to plain text (lib/clipping/transcript.ts)
   → POST /api/content-engine/generate  (Node runtime, maxDuration 300)
        Phase A: web_search research turn (unstructured, trends/SEO/hashtags)   [optional]
        Phase B: structured-output call → 10-section strategy JSON (streamed)
   → persist ContentSource + ClipStrategy + ClipSuggestion rows
   → /content-engine/[id]  renders the 10 sections
        → "Convert to ticket" on a Reels clip → approval modal → createTicket()
```

Two-phase Claude call is deliberate: the web-search server tool and `output_config.format` (structured outputs) must **not** share a turn. Phase A does free-form tool-use research (handle `pause_turn`); Phase B consumes that conversation and emits the strict JSON. If web search is skipped (toggle/cost), Phase B runs alone.

---

## Data model (new migration `0005_content_clipping_engine`)

Add three models to `prisma/schema.prisma` (UUID PKs, snake_case `@@map`, matching existing style). Client output stays `app/generated/prisma`, `runtime = nodejs`.

- **`ContentSource`** — one transcript + its context.
  - `id`, `title`, `sourceType` (`paste|file|youtube`), `sourceUrl?`, `guestName?`, `guestAudience?`, `brandPillars?` (text; defaults applied if blank), `transcript` (`@db.Text`), `createdById?` (→ Employee), `createdAt`.
- **`ClipStrategy`** — one generation run.
  - `id`, `contentSourceId` (→ ContentSource, cascade), `model`, `status` (`generating|complete|error`), `error?`, `output` (`Json` — the full 10-section strategy), `usedWebSearch` (Bool), `createdAt`. Relation: `clips ClipSuggestion[]`.
- **`ClipSuggestion`** — the Reels clips, broken out for propose→approve→ticket tracking.
  - `id`, `clipStrategyId` (→ ClipStrategy, cascade), `index`, `title`, `timestampStart`, `timestampEnd`, `rationale`, `caption?`, `hookLine?`, `format?`, `platform?`, `viralityScore?` (Int), `status` (`proposed|approved|dismissed`), `ticketId?` (→ Ticket, SetNull).

Add inverse relation `ClipSuggestion[]` on `Ticket` (or keep the FK one-directional via `ticketId` only — one-directional is enough and avoids touching the hot `Ticket` model heavily; add a named relation field for clarity).

The other 9 sections live in `ClipStrategy.output` JSON (no need to normalize them — they are rendered, not converted).

---

## Anthropic integration (`lib/clipping/`)

- **`anthropic.ts`** — singleton `new Anthropic()` (reads `ANTHROPIC_API_KEY`). Node runtime only.
- **`prompt.ts`** — the system prompt, taken verbatim from Vishen's shared skill spec ("You transform a podcast transcript into a complete viral content strategy…"), plus default brand pillars (manifestation, personal growth, consciousness, entrepreneurship, transformation) injected when the form leaves them blank. Keep the system prompt **frozen** (no interpolated timestamps) so it stays cache-friendly; transcript/context go in the user turn.
- **`schema.ts`** — the structured-output JSON schema + TS types. Top-level object, `additionalProperties:false` on every object, `required` listing all 10 keys:
  - `episodeTitles` (array of 3: `{ format: enum[curiosity|bold|story], title, description }`), `episodeDescriptionShort` (string), `episodeDescriptionLong` (string), `youtubeTags` (string[]),
  - `thumbnailStrategy` `{ primaryConcept{background,textOverlay,expression,palette,composition}, abVariant, textOverlayOptions[], emotionalTrigger }`,
  - `youtubeHook` `{ hookScript, cutIns[], chapterMarkers[{timestamp,label}] }`,
  - `reelsClips` (array, 5–8: `{ timestampStart, timestampEnd, rationale, caption, hookLine, format: enum[talking_head|quote_card|broll_overlay], viralityScore: integer }`),
  - `pullQuotes` (array of 5: `{ quote, visualTreatment }`),
  - `showNotes` `{ timestamps[], keyInsights[], guestBio }`,
  - `distributionPlan` (array: `{ platform: enum[youtube|spotify|instagram|linkedin|x|tiktok], sequence, timing, crossPromoHook }`),
  - `youtubeTitleTests` (array of 5: `{ title, predictedCtrRank: integer, rationale }`).
  - Counts/ranges (1–10 score, 5–8 clips) are **described in field descriptions, not enforced by schema** (structured outputs ignore min/max) and validated in TS after `finalMessage()`.
- **`generate.ts`** — `generateStrategy(transcript, ctx, { webSearch }): Promise<Strategy>`.
  - Phase A (if `webSearch`): `client.messages.create` with `tools: [{type:"web_search_20260209", name:"web_search"}]`, `thinking:{type:"adaptive"}`, loop on `pause_turn`.
  - Phase B: `client.messages.stream({ model:"claude-opus-4-8", max_tokens:16000, thinking:{type:"adaptive"}, output_config:{format:{type:"json_schema", schema}}, messages })` → `await stream.finalMessage()`. Streaming avoids HTTP timeouts on the long output.
  - Parse, validate counts/ranges, return typed object.
- **`transcript.ts`** — `normalizeTranscript(input)`: strip `.vtt`/`.srt` cue numbers + timestamps to plain text; pass `.txt`/paste through. `fetchYouTubeTranscript(url)`: best-effort via `youtubei.js` (fallback `youtube-transcript`), ~10s timeout, **typed failure** on no-captions / age-/region-locked / bot-block → UI routes user to paste. Never generate from an empty transcript.
- **`data.ts`** — query helpers for strategy list + detail.

---

## Routes, server actions, UI

- **`app/api/content-engine/generate/route.ts`** — `POST`, `export const runtime='nodejs'`, `export const maxDuration=300`. Creates `ContentSource` + `ClipStrategy(status:generating)`, runs `generateStrategy`, writes `output` + `ClipSuggestion` rows + `status:complete` (or `error`), returns `{ strategyId }`.
- **`app/content-engine/actions.ts`** — server actions:
  - `fetchYouTube(url)` → transcript text or typed error (for the form's URL tab).
  - `convertClipToTicket(input)` → builds a valid `CreateTicketInput` and calls the **existing** `createTicket()` from `app/intake/actions.ts` (do not fork it); on success sets `ClipSuggestion.status='approved'`, `ticketId`. Auto-derive: `title` (clip hook, truncated ≤40), `creativeBrief` (rationale + caption + hook + timestamp), `typeOfRequest='Video'`, `teamServiceLevel='Social Media Video'` (default, editable), `sourceLinks` (source URL + timestamp range for provenance), `requesterId` from session→Employee. **User selects:** Event Type, Asset Type (filtered by Event Type), Official Calendar, Due Date.
- **`app/content-engine/page.tsx`** — landing: "New strategy" + history list (reuse Tailwind list patterns from `app/tickets`).
- **`app/content-engine/new/page.tsx`** + **`components/clipping/ClipEngineForm.tsx`** — tabs (Paste / Upload / YouTube URL) + context fields (title, guest, audience, brand pillars w/ defaults) + web-search toggle. Submits to the generate route, shows a loading state, redirects to detail.
- **`app/content-engine/[id]/page.tsx`** + **`components/clipping/StrategyView.tsx`** — renders all 10 sections with clear headers; the Reels-clips section shows per-clip cards with virality score and a "Convert to ticket" button (disabled/badged once `approved`).
- **`components/clipping/ClipApprovalModal.tsx`** — reuses reference data from `lib/intake/data.ts` (`eventTypes`, `assetTypes` w/ Event→Asset filter, `officialCalendars`, `teamServiceLevels`); asks only the 4 non-derivable fields; calls `convertClipToTicket`.
- **`components/AppNav.tsx`** — add "Content Engine" nav link.

Brand: primary `#572280`, gold `#F5B000` accent only, existing Tailwind conventions.

---

## Dependencies & config

- `npm i @anthropic-ai/sdk youtubei.js` (and optionally `youtube-transcript` as secondary fallback). All three are new.
- `.env` / `.env.example`: add `ANTHROPIC_API_KEY`.
- Deploy: `kessel env secret ANTHROPIC_API_KEY=…` **before** `kessel deploy` (do not set via any non-kessel path). `DATABASE_URL` stays auto-injected.
- Run `npx prisma migrate dev --name content_clipping_engine` then `npx prisma generate`.

---

## Build order

1. Schema + migration + `prisma generate`.
2. `lib/clipping/` (anthropic, prompt, schema, transcript, generate) — unit-runnable in isolation.
3. Generate route + form + detail view (end-to-end with paste input first).
4. File upload + YouTube fetch with fallback.
5. Clip → ticket approval modal + `convertClipToTicket` (reusing `createTicket`).
6. Nav link, polish, brand styling.

---

## Verification (end-to-end)

1. `ANTHROPIC_API_KEY` set locally; `npm run dev`.
2. Paste the Kiara King transcript (priority content) → generate → confirm all 10 sections render and `reelsClips` has 5–8 scored clips. Check `ClipStrategy.status='complete'` and `ClipSuggestion` rows in `npx prisma studio`.
3. Toggle web search off → regenerate → confirm it still produces valid JSON (Phase B alone).
4. Upload a `.vtt`/`.srt` → confirm timestamps stripped and a clean strategy.
5. YouTube URL: success path returns transcript; a captions-disabled video returns the typed error and the UI routes to paste (no empty-transcript generation).
6. "Convert to ticket" on a clip → modal asks Event/Asset/Calendar/Due → creates a ticket; verify it appears in `/tickets` and `/manager` queue ranked (scoring ran), `ClipSuggestion.status='approved'` with `ticketId` set, and `sourceLinks` carries the clip provenance.
7. `npm run build` clean; confirm the generate route is Node runtime (not edge).

---

## Risks / notes

- **YouTube fetch in production** runs from a fixed Cloud Run IP (Kessel) — expect scraping to be blocked more often than local. Manual paste/upload is the reliable primary path; URL fetch is a convenience. A real fix (paid transcript/STT API) is out of scope.
- **Generation latency** (web search + 10 sections) can be 1–3 min — hence the Node route with `maxDuration=300` and streaming, not a server action.
- **Structured-output limits**: counts/ranges aren't schema-enforced; validate in TS.
- Reuse `createTicket()` unchanged so the required-taxonomy + scoring invariant can't drift.

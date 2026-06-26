---
title: 'AI Content Clipping Engine'
slug: 'content-clipping-engine'
scope: epic
status: resolved
parent: content-production-management.md
children:
  - content-production-management/content-clipping-engine/generation-pipeline.md
  - content-production-management/content-clipping-engine/transcript-ingestion.md
  - content-production-management/content-clipping-engine/strategy-viewer.md
  - content-production-management/content-clipping-engine/clip-ticket-conversion.md
created: 2026-06-26
updated: 2026-06-26
resolution: 7/7
imported-from: "plans/ai-content-clipping-engine.md"
---

# E8 · AI Content Clipping Engine

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

Vishen (CEO) wants the team to "put the Kiara King podcast into Claude and Claude tells you what to clip" by end of June 2026. He shared a skill spec that turns a long-form transcript (podcast, interview, speech) into a complete **10-section viral content strategy**: episode titles + descriptions + YouTube tags, thumbnail strategy, a 60-second YouTube hook + chapter markers, 5–8 Instagram Reels moments with virality scores, pull quotes, show notes, a platform-by-platform distribution plan, and YouTube title split-tests.

This is the first concrete build of the "propose → human approves" intelligence layer described in `context/intelligence-layer.md`. It adds Claude (`claude-opus-4-8`) to the portal for the first time and links AI output directly into the production workflow: the generated Instagram Reels clips become **proposed Tickets** in the existing queue (propose → approve), reusing E3 Intake's `createTicket()` invariant so the required-taxonomy + prioritization-scoring rules can't drift.

Scope for the end-of-June build is the **generator + save/history + clip→ticket conversion only**. The engagement learning loop (logging per-shot performance and feeding it back) is explicitly deferred to a later phase.

## User Stories

**Users:**

- **Clipper** (primary operator — one of the ~3 top clippers in the WA group). Pastes/uploads a transcript, runs the engine, reviews the 10-section strategy, and decides which Reels clips are worth producing. Cares about speed and not re-entering taxonomy per clip. Hands are on the keyboard for the whole generate→select→create step.
- **Vishen** (approver). Does **not** touch the engine. Reviews the tickets the clipper created through the existing priority-review gate and approves/rejects what gets produced.
- **Manager** (existing role). Handles queue ranking/assignment for clip-created tickets exactly as for any other ticket — no special path.

**Anti-users / non-goals:** the engine is not a self-publish tool and not a Vishen-facing tool. Clips never become production work automatically — a clipper must select them, and Vishen must approve via the existing flow.

**Stories:**

- As a **clipper**, I paste a transcript and get a ranked set of clip suggestions (with virality scores) so I don't decide what to clip manually.
- As a **clipper**, I mark the clips I want to produce (e.g. the top 3) and the system creates production tickets for them in one action — without me re-typing taxonomy for each clip.
- As a **clipper**, the clips I don't pick are left as suggestions (dismissable), not created.
- As **Vishen**, clip-created tickets land in my existing review queue so I approve what gets produced, identical to any other request — no separate approval surface to learn.

## Workflows

**Generation pipeline** (`POST /api/content-engine/generate`, Node runtime, `maxDuration=300`):

1. User supplies a transcript via one of three input paths (Paste / file upload `.txt|.vtt|.srt` / YouTube URL) plus context (title, guest, audience, brand pillars — defaults applied if blank) and an optional web-search toggle.
2. `lib/clipping/transcript.ts` normalizes input to plain text (strips `.vtt`/`.srt` cue numbers + timestamps; YouTube via best-effort `youtubei.js` fetch with typed-failure fallback to paste).
3. **Phase A (optional):** an unstructured `web_search_20260209` tool-use turn researches current trends/SEO/hashtags (loop on `pause_turn`).
4. **Phase B:** a streamed structured-output call (`output_config.format` json_schema, `claude-opus-4-8`, adaptive thinking, `max_tokens 16000`) emits the 10-section strategy JSON. Web search and structured output are kept in separate turns by design.
5. Persist `ContentSource` + `ClipStrategy` (full JSON in `output`) + one `ClipSuggestion` row per Reels clip; counts/ranges validated in TS after `finalMessage()`.

**View & select:** `/content-engine/[id]` renders all 10 sections; each Reels-clip card shows its virality score and a **selection checkbox**. The clipper multi-selects the clips worth producing (e.g. the top 3) and triggers a single **"Create tickets"** batch action.

**Batch clip → ticket (clipper-driven):** the batch action opens one lightweight step that captures the **shared taxonomy once** — reusing E3 intake reference data (`lib/intake/data.ts`) — for the 4 non-derivable fields: **Event Type, Asset Type (filtered by Event Type), Official Calendar, Due Date**, applied to all selected clips. Per-clip fields are auto-derived: `title` (clip hook, ≤40 chars), `creativeBrief` (rationale + caption + hook + timestamp), `typeOfRequest='Video'`, `teamServiceLevel='Social Media Video'` (editable), `sourceLinks` (source URL + timestamp for provenance), `requesterId` (session→Employee). The system loops the selected clips through the existing `createTicket()` unchanged, creating N tickets; each `ClipSuggestion` gets `status='approved'` + its `ticketId`. Unselected clips stay `proposed` (dismissable).

**Approval = the existing flow.** Clip-created tickets enter at `prioStatus='New Request'` (the `createTicket()` default) and flow into the existing **Vishen review gate** (`prioStatus='To be reviewed by Vishen'`) handled by E5 — no new approval surface is built. From there they rank/assign/produce like any other ticket.

## Boundaries

- **In scope:** transcript→strategy generation, save/history, and clip→ticket conversion. **Out of scope (this phase):** the engagement learning loop, per-shot performance logging, and the monthly "what's working" analysis.
- **YouTube fetch is best-effort, not a dependency.** Production runs from a fixed Cloud Run IP (Kessel) where scraping is often blocked; paste/upload is the reliable primary path. A captions-disabled/age-/region-locked video returns a typed error that routes the user to paste — never generate from an empty transcript. A real fix (paid transcript/STT API) is out of scope.
- **Structured-output limits:** `min/max`/count constraints are not schema-enforced (1–10 score, 5–8 clips) — validate in TS.
- **Anthropic web_fetch is not used for transcript acquisition** (it only fetches URLs already in the conversation); web search is for research enrichment only.
- **Do not fork `createTicket()`** — the clip→ticket path must feed it a fully valid input so the required-taxonomy + scoring invariant holds.

## Dependencies

- **E1 Foundation & Data Layer** (built) — Prisma setup, `Ticket`/`Employee`/`AssetType`/`EventType`/`OfficialCalendar` models.
- **E3 Intake** — reuses `createTicket()` (`app/intake/actions.ts`) and reference-data loader (`lib/intake/data.ts`).
- **E4 Prioritization** — converted tickets run through existing scoring/auto-assignment.
- New deps: `@anthropic-ai/sdk`, `youtubei.js` (optional `youtube-transcript` fallback).
- New env: `ANTHROPIC_API_KEY` — set via `kessel env secret` before deploy; `DATABASE_URL` stays auto-injected.
- New schema (migration `0005_content_clipping_engine`): `ContentSource`, `ClipStrategy`, `ClipSuggestion`.

## Success Criteria

Verification path (end-to-end): paste the Kiara King transcript → all 10 sections render, `reelsClips` has 5–8 scored clips, `ClipStrategy.status='complete'`; web-search toggle off still yields valid JSON; `.vtt`/`.srt` upload strips timestamps; a captions-disabled YouTube URL returns a typed error (no empty-transcript generation); "Convert to ticket" creates a ticket that appears ranked in `/tickets` and `/manager` with `ClipSuggestion.status='approved'` + provenance in `sourceLinks`; `npm run build` clean; generate route is Node (not edge).

**Measurable targets:**

- **Speed (the core win — never miss another Kiara King window).** From "long-form content is available" to "selected clips are tickets submitted for Vishen review" takes **a few hours, not days**. Target: **< ~4 hours** end-to-end, of which the engine's own generate step is **minutes** (single transcript → full 10-section strategy). The point is a clipper can jump on a hot collab the same day, not next week.
- **Trust in the picks (acceptance rate).** Of the engine's suggested Reels clips, what fraction do clippers actually select to produce. Target: **≥ 3 of the top 5 suggestions selected on a typical transcript (~60%)**. Sustained **< ~40%** acceptance is the signal the virality-scoring rubric needs tuning. Tracked via `ClipSuggestion.status` (`approved` vs `dismissed`/`proposed`).

**Launch criteria (end of June 2026):** Kiara King podcast and Romania speech each run through the engine and produce selected, approved tickets end-to-end; the paste path works reliably; clip→ticket conversion lands tickets in the existing Vishen review queue. (Engagement-based metrics — published-clip performance, followers per collab clip — depend on the deferred engagement loop and are out of scope for this epic.)

## Features

Four child features (a shared schema/migration `0005_content_clipping_engine` — `ContentSource`, `ClipStrategy`, `ClipSuggestion` — is the foundation all four sit on):

1. **[Generation Pipeline](content-clipping-engine/generation-pipeline.md)** — the two-phase Claude call (web-search research → structured 10-section JSON), `lib/clipping/`, the `/api/content-engine/generate` route, persistence. *The core engine.*
2. **[Transcript Ingestion](content-clipping-engine/transcript-ingestion.md)** — paste + `.txt`/`.vtt`/`.srt` upload + best-effort YouTube fetch with typed fallback. *Feeds the pipeline.*
3. **[Strategy Viewer](content-clipping-engine/strategy-viewer.md)** — input form, history list, the 10-section detail render with per-clip selection. *Depends on Generation Pipeline.*
4. **[Clip → Ticket Conversion](content-clipping-engine/clip-ticket-conversion.md)** — batch select → shared-taxonomy step → loop `createTicket()` → existing Vishen gate. *Depends on Strategy Viewer + E3.*

**Dependency order:** schema → (1 + 2 in parallel) → 3 → 4.

**v1 cut for the 4-day build:** paste path first; the two additive pieces to drop if time runs short are the **YouTube fetch** (within Transcript Ingestion) and the **web-search enrichment turn** (Phase A of Generation Pipeline) — neither blocks the core generate→select→ticket loop.

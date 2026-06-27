# Vishen Media → Clip Suggestion Pipeline

## Context

Vishen appears on a steady stream of external podcasts / YouTube interviews. Today there's no
single place to capture those links, and the clip engine only runs as a one-off "paste a transcript"
tool. We want a **persistent intake list** of new Vishen media that the existing clip engine
processes into suggested clips — so the team stops hunting for content and instead works a queue of
"here's a new video, here are the clips worth cutting."

This reuses the engine we already built (`lib/clipping/` — transcript → 10-section viral strategy →
ranked Reels clips → convert to production ticket) and fits the in-flight **Airtable-direct pivot**
(`plans/airtable-direct-pivot.md`): no new Postgres tables — links and results live in Airtable, the
app reads/writes Airtable directly.

**Scope decisions (confirmed with user):**
- **Discovery:** manual submit *and* auto-discover. **Auto-detect of Vishen's own YouTube channel
  uploads ships in v1** (Phase 1); guest-mention search is a later phase.
- **Submit surfaces:** portal form *and* direct-in-Airtable *and* Slack.
- **Trigger:** *clip generation* is button / on-submit (a person clicks "Suggest clips"). The
  auto-detect job only *adds inbox rows* (Status `New`) — it does not auto-spend tokens on clipping.
- **Results storage:** a linked **Clip Suggestions** child table (one row per clip), not a JSON blob.
- **Source scope:** YouTube only to start.

---

## Architecture

```
Submit a Vishen YouTube link
  ├─ Portal form  (app/media/new)          ─┐
  ├─ Directly in Airtable (add a row)       │
  ├─ Auto-detect job (Vishen's channel)     ├─►  📺 Media Sources table (the inbox)
  └─ Slack share (Phase 2)                 ─┘       status: New  (deduped on Source URL)
                                                       │  click "Suggest clips" (button)
                                                       ▼
        lib/clipping: fetchYouTubeTranscript → generateStrategy (Anthropic, existing)
                                                       │
                                                       ▼
        write one row per clip → 🎬 Clip Suggestions table (linked to the Media Source)
        store full 10-section strategy JSON on the Media Source row
                                                       │  review in portal
                                                       ▼
        "Convert to ticket" → existing Airtable ticket create (Prio Requests table)
```

The clip engine logic is **unchanged** — we only swap its storage from Postgres
(`ContentSource`/`ClipStrategy`/`ClipSuggestion`) to the two new Airtable tables, consistent with the
pivot's "Content-Engine becomes stateless / Airtable-direct" rule.

---

## New Airtable tables (Creative Services base `appFEFygXo2pRc8AR`)

Create via the Airtable MCP (`create_table`/`create_field`), then capture the returned `tbl…`/`fld…`
IDs into `lib/airtable/field-map.ts` (the single field-id source — same pattern as the existing
`TICKETS`, `EMPLOYEES`, etc. blocks). **Do not hardcode field names anywhere but the map.**

### 📺 Media Sources (the inbox) — new table
| Field | Type | Notes |
|-------|------|-------|
| Title | singleLineText (primary) | video title; auto-filled from YouTube when fetched |
| Source URL | url | the YouTube link (v1: YouTube only) |
| Platform | singleSelect | `YouTube` now; room for Spotify/Apple later |
| Status | singleSelect | `New` · `Transcribing` · `Clips Suggested` · `Error` · `Archived` |
| Guest / Show | singleLineText | optional context for the prompt |
| Audience | singleSelect | `Cold` · `Warm` (feeds the prompt) |
| Submitted By | link → 👬 Employees | resolved from session on portal submit; blank for Airtable-direct |
| Submitted Via | singleSelect | `Portal` · `Airtable` · `Slack` · `Auto-discover` |
| Strategy JSON | longText | full 10-section strategy output (provenance / re-render) |
| Used Web Search | checkbox | mirrors the engine toggle |
| Error | longText | failure reason when Status = `Error` |
| Clip Suggestions | link → 🎬 Clip Suggestions | reverse link |
| Created | createdTime | |

### 🎬 Clip Suggestions (one row per clip) — new table
| Field | Type | Notes |
|-------|------|-------|
| Name | formula or singleLineText (primary) | e.g. hook line / "Clip {index}" |
| Media Source | link → 📺 Media Sources | parent |
| Index | number | order within the strategy |
| Timestamp Start / End | singleLineText | `mm:ss` from the engine |
| Hook Line | singleLineText | |
| Rationale | longText | why this clip |
| Caption | longText | suggested caption |
| Format | singleSelect | `talking_head` · `quote_card` · `broll_overlay` |
| Virality Score | number | 1–10 (validated in TS, not by Airtable) |
| Status | singleSelect | `Proposed` · `Approved` · `Dismissed` (mirrors existing clip statuses) |
| Ticket | link → 🎯 Prio Requests (`tblhrRl8GzsDMv0DD`) | set when converted to a ticket |

These two tables replace the Postgres `ContentSource`/`ClipStrategy`/`ClipSuggestion` for this
workflow. Direct-in-Airtable submission "just works" once the Media Sources table exists — a person
adds a row with a URL and the portal's "Suggest clips" button picks it up.

---

## Code changes (reuse first — minimal new code)

### Reuse unchanged
- `lib/clipping/transcript.ts` — `fetchYouTubeTranscript(url)` (+ `normalizeTranscript`), incl. the
  typed `TranscriptFetchError` fallback.
- `lib/clipping/generate.ts` — `generateStrategy(transcript, ctx, { webSearch })`.
- `lib/clipping/{schema,prompt,anthropic}.ts` — prompt, JSON schema, validation, Anthropic client.
- `lib/airtable/rest.ts` / `client.ts` — rate-limited REST client (≤5 req/s, 429 backoff, batch ≤10).
- `lib/airtable/field-map.ts` — extend with the two new table blocks.
- The Airtable-direct **ticket create** (the pivot's `createTicket` against the Prio table) for clip→ticket.

### New: `lib/media/repository.ts` (Airtable-direct, repository pattern per the pivot)
- `listMediaSources(filter?)` — read inbox rows (filter by Status), map `fld…` → a `MediaSource` type.
- `getMediaSource(id)` / `createMediaSource(input)` / `updateMediaSource(id, patch)`.
- `createClipSuggestions(mediaSourceId, clips[])` — batch-create child rows (≤10/req).
- `listClipSuggestions(mediaSourceId)` / `updateClipSuggestion(id, patch)`.

### New: `app/media/actions.ts` (server actions)
- `submitMediaLink({ url, title?, guest?, audience? })` — validate URL → `createMediaSource` with
  Status `New`, Submitted Via `Portal`, Submitted By = session employee.
- `suggestClips(mediaSourceId)` — the **button**: set Status `Transcribing` →
  `fetchYouTubeTranscript` → `generateStrategy` → write `Strategy JSON` + batch `createClipSuggestions`
  → Status `Clips Suggested` (or `Error` + message on failure). Long-running → run via a Node-runtime
  **route** (`app/api/media/[id]/suggest/route.ts`, `runtime='nodejs'`, `maxDuration=300`,
  streaming), not a plain server action, mirroring `app/api/content-engine/generate/route.ts`.
- `convertClipsToTickets(input)` — port the existing
  [app/content-engine/actions.ts:65](app/content-engine/actions.ts#L65) logic, but read clip rows from
  the Airtable Clip Suggestions table and create tickets via the Airtable ticket create; on success set
  the clip's Status `Approved` and link the `Ticket`. Keep the same derivation helpers (`brief`,
  `ticketTitle`) and the same 4 human-selected fields (Event Type, Asset Type, Official Calendar, Due).

### New: UI (reuse `components/clipping/` patterns + brand `#572280`/gold accent)
- `app/media/page.tsx` — the inbox: list Media Sources with Status, submitted-by, clip count; "Submit
  link" button. Reuse the Tailwind list patterns from `app/tickets`.
- `app/media/new/page.tsx` + `components/media/MediaLinkForm.tsx` — URL + optional context fields.
- `app/media/[id]/page.tsx` — source detail: rendered strategy + clip cards (reuse
  `components/clipping/StrategyView.tsx`), per-clip "Convert to ticket" reusing
  `components/clipping/ClipApprovalModal.tsx`.
- `components/AppNav.tsx` — add a "Media" nav link.

---

## Phases

1. **Core loop + channel auto-detect (v1):**
   - create the two Airtable tables, extend `field-map.ts`, build `lib/media/repository.ts`, the submit
     form, the `suggest` route, the detail/clip view, and clip→ticket. This satisfies "portal +
     Airtable" intake.
   - **Auto-detect job** — `app/api/media/discover/route.ts` (Node runtime): query the **YouTube Data
     API** for Vishen's own channel uploads (`playlistItems` on the channel's uploads playlist —
     cheap, 1 quota unit/page, no false positives), upsert each into 📺 Media Sources with Submitted
     Via `Auto-discover`, **deduped on Source URL** (skip if a row with that URL exists). Driven by a
     **Kessel scheduled job** (e.g. hourly). Because the Cloud Run service is IAP-gated, the scheduler
     must call it with a **Google OIDC token** (see memory: `deployed-app-behind-iap`); the route also
     checks a shared secret header as a second gate. **Build confirm:** Vishen's exact channel ID /
     uploads-playlist ID before wiring (don't guess it).
   - The job only adds `New` rows — a human still clicks "Suggest clips," so auto-detect never spends
     Anthropic tokens on its own.
2. **Slack intake:** a Slack action/slash-command (or shared-link listener in a channel) → server
   endpoint → `createMediaSource` with Submitted Via `Slack`. Uses the Slack MCP/bot wiring; the row
   then flows through the same "Suggest clips" button.
3. **Guest-mention auto-discover:** extend the discover job with YouTube *search* queries for videos
   where Vishen is a guest on other channels (noisier, needs human triage; higher API quota). Same
   `New`-row-then-confirm flow. Deferred because relevance filtering is the fuzzy part.

---

## Dependencies & config
- No new npm deps for Phase 1 (`@anthropic-ai/sdk`, `youtubei.js` already present; YouTube Data API is
  a plain REST call — no SDK needed).
- `ANTHROPIC_API_KEY` and `AIRTABLE_API_KEY` (read+write) already configured via `kessel env secret`.
- **v1 adds:** `YOUTUBE_API_KEY` (YouTube Data API v3) + a `DISCOVER_SHARED_SECRET` — both via
  `kessel env secret`; a **Kessel scheduled job** hitting `/api/media/discover` with a Google OIDC
  token (IAP) + the shared-secret header.
- No Prisma migration — this workflow is Airtable-direct.

---

## Verification (end-to-end, Phase 1)
1. Create the two tables via MCP; confirm `tbl…`/`fld…` IDs and paste into `field-map.ts`.
2. `npm run dev`. Portal: submit a real Vishen YouTube URL → a row appears in 📺 Media Sources
   (Status `New`); cross-check via Airtable MCP `list_records_for_table`.
3. Add a second row **directly in Airtable** (URL only) → it shows in the portal inbox.
4. Click "Suggest clips" on a row → Status moves `Transcribing` → `Clips Suggested`; 5–8 rows appear
   in 🎬 Clip Suggestions linked to the source; `Strategy JSON` populated. Verify in Airtable MCP.
5. Captions-disabled video → Status `Error` with the typed fallback message; no empty generation.
6. "Convert to ticket" on a clip → a row appears in the Prio Requests table
   (`tblhrRl8GzsDMv0DD`), the clip's Status = `Approved` and `Ticket` link set; confirm it shows in
   `/manager` queue (scored). Cross-check via MCP.
7. **Auto-detect:** hit `/api/media/discover` (locally with the shared secret) → new uploads from
   Vishen's channel appear as `New` rows with Submitted Via `Auto-discover`; run it twice and confirm
   **no duplicates** (URL dedupe). On the deployed app, confirm the Kessel scheduled job invokes it
   with a valid OIDC token (not blocked by IAP).
8. `npm run build` clean; confirm the suggest + discover routes are Node runtime (not edge).

## Risks / notes
- **YouTube fetch from Cloud Run's fixed IP is blocked more often than local** (existing known risk
  from the clip-engine plan). Manual paste remains the reliable fallback — keep a paste option on the
  detail view for sources where auto-fetch fails.
- **Generation latency 1–3 min** → Node route, `maxDuration=300`, streaming (not a server action).
- **Rate limit (5 req/s) + >10k Prio rows** — filter clip→ticket reads, batch writes ≤10, reuse the
  client's pacing/backoff.
- **Auto-discover relevance** (Phase 3): YouTube search will surface false positives; keep a `New`
  triage status so a human confirms before "Suggest clips" spends tokens.

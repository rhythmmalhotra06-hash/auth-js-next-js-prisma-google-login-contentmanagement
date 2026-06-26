---
title: 'Transcript Ingestion'
slug: 'transcript-ingestion'
scope: feature
status: discovery
parent: content-production-management/content-clipping-engine.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 6/7
---

# Transcript Ingestion

> Part of [AI Content Clipping Engine](../content-clipping-engine.md)

## Purpose

Get a clean plain-text transcript into the engine from any of three sources — pasted text, an uploaded file, or a YouTube URL — so the Generation Pipeline always receives normalized input.

## Behavior

`lib/clipping/transcript.ts`:

- **Paste:** textarea → passed through as-is.
- **File upload (`.txt`/`.vtt`/`.srt`):** `normalizeTranscript()` strips `.vtt`/`.srt` cue numbers + timestamp lines, leaving plain spoken text; `.txt` passes through.
- **YouTube URL:** `fetchYouTubeTranscript(url)` — best-effort via `youtubei.js` (optional `youtube-transcript` secondary), ~10s timeout, run in the Node-runtime path. On success returns plain text; on failure returns a **typed error**.

Exposed to the form via a `fetchYouTube(url)` server action (for the URL tab) so the user sees the fetched transcript (or the error) before generating.

## Rules & Logic

- The three input methods all converge to one normalized plain-text string before reaching the Generation Pipeline.
- YouTube fetch is **best-effort, never a hard dependency** — paste/upload is the reliable primary path.
- Anthropic `web_fetch` is **not** used for transcript acquisition (it only fetches URLs already in the conversation and can't extract JS-rendered YouTube captions).
- Never hand an empty/near-empty transcript to generation.

## Data

- Writes `ContentSource`: `title`, `sourceType` (`paste|file|youtube`), `sourceUrl?`, `guestName?`, `guestAudience?`, `brandPillars?` (defaults applied if blank), `transcript` (`@db.Text`), `createdById?`.

## Failure Modes

- **No captions / age- / region-locked / bot-blocked YouTube** → typed error → UI message routes the user to paste/upload. ("Couldn't fetch captions — captions may be disabled, the video age/region-restricted, or YouTube may be blocking automated access. Paste the transcript or upload a .txt/.vtt/.srt instead.")
- **Production Cloud Run fixed IP (Kessel)** → expect YouTube scraping blocked more often than in local dev; manual input is the production-primary path.
- **Malformed subtitle file** → fall back to treating it as raw text; never crash generation.

## Acceptance Criteria

- Paste path produces a clean transcript that generates a valid strategy.
- `.vtt`/`.srt` upload strips timestamps/cue numbers → clean spoken text.
- A captions-disabled YouTube URL returns the typed error and routes to paste (no empty-transcript generation).
- A captioned YouTube URL (local/dev) returns usable transcript text.

## Open Questions

- Is a paid transcript/STT API worth adding later if YouTube fetch proves too unreliable in production? (Out of scope this phase.)
- Max transcript size / token guardrail before generation (warn vs hard-limit)?

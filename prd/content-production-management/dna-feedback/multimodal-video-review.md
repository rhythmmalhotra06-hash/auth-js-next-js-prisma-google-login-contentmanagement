---
title: 'Multimodal Video Review'
slug: 'multimodal-video-review'
scope: feature
status: discovery
parent: content-production-management/dna-feedback.md
children: []
created: 2026-09-02
updated: 2026-09-07
resolution: 6/7
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# E13.2 · Multimodal Video Review

> Part of [E13 · AI-Assisted DNA Feedback](../dna-feedback.md)

> **Built and verified against real production data, 2026-09-07.** The plan below was
> written before implementation; several open questions are now resolved empirically
> rather than by discussion — see the "Confirmed" notes inline and Open Questions.

## Purpose

[E13.1](text-review-rule-learning.md)'s review can only judge wording and metadata — it has no
access to what's actually on screen. This feature adds real video access: frame extraction feeding
the same review pipeline evidence it currently can't have (visual composition, on-screen text,
cut/hook timing) — the "hook lands at 0:06; DNA requires ≤0:03" class of finding
`context/intelligence-layer.md` capability #4 originally described but couldn't build without a
multimodal pipeline. That pipeline is the internal `/watch` skill's + BlinkLife Recorder's proven
pattern (frame extraction → multimodal Claude call), ported here rather than designed from scratch.

**Scope narrowed during implementation: frames only, no transcript, v1.** Adding transcription
means adding this codebase's first non-Anthropic AI provider (Deepgram or equivalent) plus a new
credential — a real decision that shouldn't get bundled silently into a frame-extraction feature.
Frame-based findings alone already deliver real value E13.1 categorically couldn't (see the real
example under Acceptance Criteria) — see Open Questions for what transcription would need.

## Behavior

1. The main app resolves the ticket's deliverable link, in order: `final9x16` → `final16x9` →
   `final4x5` (`lib/dna-review/generate.ts::resolveTicketVideoUrl`). **Confirmed scoped to
   Dropbox-hosted deliverables only** — YouTube-sourced tickets already get transcript-only
   enrichment via the existing `lib/clipping/transcript.ts` path in E13.1's text review; extending
   frame extraction to YouTube would need `yt-dlp` as a new render-service dependency, out of scope.
2. The main app calls `POST /extract-frames` on `render-service/` (reused, not a new Kessel
   service — confirmed the right call, see Rules & Logic) with `{ videoUrl }`. That endpoint:
   downloads the file (guarded at 500MB), runs `ffprobe` for duration, computes the frame budget
   from BlinkLife's auto-scaled table (≤30s→30 … >10min→100, capped), runs one `ffmpeg` pass
   (`fps=1/interval` + `scale` to fit 1024px longest-edge preserving aspect ratio), and returns
   frames base64-inline — nothing persisted to any bucket.
3. `lib/dna-review/generate.ts::runVisualDnaReview()` sends the frames as multimodal content
   blocks (each preceded by a `Frame at mm:ss:` text label) alongside the same brief/DNA/rulebook
   context E13.1 already composes, to a **separate visual schema and system prompt**
   (`VISUAL_FINDINGS_SCHEMA`/`VISUAL_SYSTEM_PROMPT`) that allows `dimension: 'visual'|'timing'` and
   an optional `timestampMs` per finding — `DnaReviewFinding.timestampMs` gets populated for the
   first time.
4. This is opt-in, not automatic: an explicit "👁️ Review with visuals" button on the ticket's DNA
   review panel, with an inline cost/time estimate the founder/editor must confirm before it fires
   — never folded into E13.1's automatic status-change trigger.
5. Each click writes a **new** `DnaReview` row (`triggeredBy: 'manual', usedFrames: true`) rather
   than mutating the prior one — review history is immutable, one row per run, and
   `getLatestDnaReview()`'s existing `orderBy: createdAt desc` naturally makes the newest (and thus
   the decision-lock-relevant) review the visual one once it completes.

## Rules & Logic

- **Reuse `render-service/`, don't stand up a third Kessel service — confirmed the right call.**
  It already solved "the main app's `node:lts-alpine` image can't support ffmpeg" for Remotion
  rendering; adding `/extract-frames` needed zero new system dependencies (ffmpeg was already in
  the Dockerfile) and only Node's built-in `fetch` for downloads. No `render-service` scope-creep
  concern survived contact with the actual build — it was a small, clean addition.
- **Dropbox download needs no API/OAuth — confirmed empirically against real production links.**
  "Anyone with the link" share URLs (`https://www.dropbox.com/scl/fi/...?rlkey=...&dl=0`) redirect
  cleanly to a direct-download CDN URL when `dl=0` is rewritten to `dl=1`, verified by fetching real
  bytes (confirmed valid MP4 via file-magic and image-decoding the extracted frames) from a live
  production ticket's attached video. `render-service`'s `toDirectDownloadUrl()` does the rewrite;
  non-Dropbox URLs pass through unchanged.
- **Frames are ephemeral — confirmed as designed, with one honest gap.** Base64 inline in the HTTP
  response, fed to one LLM call, then discarded — sidesteps needing a storage layer entirely.
  **Deviation from the original plan:** frame extraction is NOT idempotent/cached across
  re-triggers — each "Review with visuals" click re-downloads and re-extracts from scratch (no
  `framesJson`-style persistence exists to reuse). Re-running twice costs full frame-extraction time
  + cost twice, not once. Acceptable for v1 given the no-storage design, but worth naming rather
  than silently dropping the idempotency claim the original plan made.
- **Cost/latency means opt-in, not automatic — confirmed necessary.** A real 60-frame call against
  an 87-second video used ~48K input tokens in testing — meaningfully more expensive than E13.1's
  text-only review, and the button's upfront estimate is the only place this cost is surfaced.
- **`max_tokens` needs real headroom for a multimodal response — discovered in testing, fixed.**
  A 60-frame review with `max_tokens: 2000` silently hit `stop_reason: 'max_tokens'`: the
  schema-constrained decoder closed the JSON validly but with the summary consuming the whole
  budget and zero findings — **not an error**, so it wasn't caught until the output was inspected
  by hand. Fixed two ways: raised to `max_tokens: 4096`, and the system prompt now explicitly caps
  `summary` to one sentence so budget goes to findings. `runVisualDnaReview()` also now checks
  `stop_reason === 'max_tokens'` explicitly and returns a real error rather than accepting
  whatever the decoder happened to close with — this exact failure mode should never be silent again.

## Data

Extends E13.1's `DnaReview` model — `usedFrames`, `frameSourceUrl`, `frameCount` are populated;
`costMicros` is **not** populated yet (no cost computation implemented this pass — `resp.usage`
token counts are available if this becomes worth adding precisely, deferred as a nice-to-have, not
blocking). `usedTranscript`/`transcriptSourceUrl` stay `false`/`null` — no transcript in this scope.
`DnaReviewFinding.timestampMs` is populated when the model grounds a finding in a specific frame
(observed: often null even for visual/timing findings, when the finding compares content across
the whole video rather than one moment — expected, not a bug). No new tables; see
[Technical Design](technical-design.md) for the full schema.

## Failure Modes

**Oversized/unreachable source:** `render-service` guards downloads at 500MB (aborts mid-stream if
exceeded) and surfaces `ffprobe`/`ffmpeg` failures as a structured `{ok:false, error}` response;
`lib/dna-review/frames.ts` retries only 429/502/503 (not a 4xx, which represents a standing
condition like a dead link) and gives up after 2 retries with a real error message shown in the
panel. **`max_tokens` exhaustion:** now caught explicitly (see Rules & Logic) rather than silently
producing an empty review.

[UNRESOLVED] Not yet exercised against a real failure: an actually-expired or password-protected
Dropbox link (only "anyone with link, not yet expired" has been tested), and a source file that
fails ffprobe (corrupt/non-video content behind a `.mp4`-looking URL). Worth doing once a real one
surfaces rather than fabricating a test case.

## Acceptance Criteria

- `render-service`'s `/extract-frames` endpoint round-trips a real Dropbox link — **verified**: a
  real production ticket's attached 9x16 video (87s) produced 60 frames, each a valid decodable
  JPEG (confirmed via file-magic + image decode), matching the auto-scaled budget table.
- A resulting `DnaReview` has `usedFrames: true` with real, evidence-grounded findings the
  text-only path could not produce — **verified**: a real run against a real ticket flagged the
  video running over its stated target length, caught content past the point the provided script
  covered, and confirmed two specific requested caption corrections were actually applied on
  screen — genuine content-vs-brief comparison, not generic commentary.
- The "Review with visuals" action shows a cost/time estimate before the founder/editor commits —
  **verified** via a real browser click-through (Playwright), including the full click →
  confirm → "Watching…" → "✓ Visual review included" flow.
- Re-running on an unchanged recording reuses extracted frames, not re-extracting — **not met**,
  see the idempotency deviation noted in Rules & Logic.

## Open Questions

- ~~**render-service scope creep.**~~ Resolved — confirmed fine, see Rules & Logic.
- ~~**Dropbox download mechanism.**~~ Resolved empirically — no OAuth needed, see Rules & Logic.
- **Transcription provider.** Still fully open and now explicitly deferred out of this feature's
  scope (see Purpose) rather than silently dropped — Deepgram remains the candidate (matching
  BlinkLife's own choice) but isn't integrated anywhere in this repo, and adding it means this
  codebase's first non-Anthropic AI provider + a new credential, which deserves its own sign-off
  conversation rather than riding in on a frame-extraction feature.
- **Frame-extraction idempotency/caching.** Not built this pass (see Rules & Logic's deviation
  note) — worth a real design pass if repeated re-runs on the same recording become a real cost
  pattern, rather than assuming it's needed pre-emptively.
- **Cost tracking (`costMicros`).** Deferred — `resp.usage` gives real token counts if/when this is
  worth computing precisely; not blocking anything today.

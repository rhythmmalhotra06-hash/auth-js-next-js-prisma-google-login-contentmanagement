---
title: 'Multimodal Video Review'
slug: 'multimodal-video-review'
scope: feature
status: discovery
parent: content-production-management/dna-feedback.md
children: []
created: 2026-09-02
updated: 2026-09-02
resolution: 6/7
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# E13.2 · Multimodal Video Review

> Part of [E13 · AI-Assisted DNA Feedback](../dna-feedback.md)

## Purpose

[E13.1](text-review-rule-learning.md)'s review can only judge wording and metadata — it has no
access to what's actually on screen. This feature adds real video access: frame extraction and
transcription, feeding the same review pipeline evidence it currently can't have (visual
composition, on-screen text, cut/hook timing) — the "hook lands at 0:06; DNA requires ≤0:03" class
of finding `context/intelligence-layer.md` capability #4 originally described but couldn't build
without a multimodal pipeline. That pipeline is the internal `/watch` skill's + BlinkLife
Recorder's proven pattern (frame extraction + transcript → multimodal Claude call), ported here
rather than designed from scratch.

## Behavior

1. The main app resolves the ticket's deliverable link(s) (`final16x9`/`final9x16`/`final4x5`, or
   `sourceLinks`) — Dropbox share links today, or opportunistically a YouTube URL.
2. Transcript: YouTube-sourced tickets reuse `lib/clipping/transcript.ts`'s existing
   `fetchSupadataTranscript`/`fetchYouTubeTranscript` unchanged. Dropbox-hosted video needs a new
   transcript path (Deepgram, per BlinkLife's own choice of backend).
3. The main app calls a new `POST /extract-frames` endpoint on `render-service/` (reused rather
   than a new Kessel service — it already runs `ffmpeg` for Remotion, E12.2) with the video URL +
   duration. That endpoint downloads the file, extracts frames on the same auto-scaled budget
   BlinkLife uses (≤30s→30 frames … >10min→100 frames, capped), resizes to 1024px JPEG@0.85, and
   returns them base64-inline — not persisted to any bucket.
4. `lib/dna-review/generate.ts` (from E13.1) sends frames as multimodal content blocks alongside
   the transcript and rulebook to the review model. `DnaReviewFinding.timestampMs` gets populated
   for the first time, anchoring findings to a specific moment in the video.
5. This is opt-in, not automatic: an explicit "Review with visuals" action on the ticket's DNA
   review panel, gated by a cost estimate shown upfront (~$0.28-0.30/review per BlinkLife's own
   numbers) — not folded into E13.1's automatic status-change trigger.

## Rules & Logic

- **Reuse `render-service/`, don't stand up a third Kessel service.** It already solved "the main
  app's `node:lts-alpine` image can't support ffmpeg" for Remotion rendering — this feature adds an
  endpoint, not a new deployable.
- **Frames are ephemeral.** Base64 inline in the HTTP response, fed to one LLM call, then
  discarded — sidesteps `render-service/server.mjs`'s own unresolved "no storage layer yet" gap
  rather than requiring one to be built first.
- **Cost/latency means opt-in, not automatic.** Same reasoning BlinkLife itself landed on for its
  own multimodal review button — avoids needing a cost dashboard for v1.
- **Idempotent on frame extraction.** Re-running a review on the same recording should reuse
  already-extracted frames where the underlying video hasn't changed, only re-running the LLM call
  — mirrors BlinkLife's own idempotency contract for its "Review with visuals" button.

## Data

Extends E13.1's `DnaReview` model — `usedFrames`, `frameSourceUrl`, `frameCount`, `costMicros` —
and `DnaReviewFinding.timestampMs`. No new tables; see [Technical Design](technical-design.md) for
the full schema. New non-schema dependency: a Deepgram (or equivalent) transcription integration,
not currently present anywhere in this repo.

## Failure Modes

[UNRESOLVED] Not enumerated in the source plan beyond naming the two big open risks (Dropbox
download mechanism, Deepgram as a brand-new dependency) — see Open Questions. Specifically
undefined: what the founder/editor sees if `render-service`'s ffmpeg invocation fails, if the
Dropbox link can't be fetched (private/expired share link), or if transcription fails but frames
succeed (partial review vs. full failure). BlinkLife's own PRD enumerates a fairly complete
failure-mode table for its equivalent feature (`ffmpeg-missing`, `extraction-failed`, below-credit,
etc.) — that table is a strong template to adapt rather than write from scratch, but hasn't been
done yet.

## Acceptance Criteria

- `render-service`'s `/extract-frames` endpoint round-trips a real Dropbox test link and a real
  YouTube link.
- Frame counts match the auto-scaled budget table for a range of test video durations.
- A resulting `DnaReview` has `usedFrames: true` with at least one `timestampMs`-anchored finding
  that the text-only path (E13.1) could not have produced.
- The "Review with visuals" action shows an accurate cost estimate before the founder/editor
  commits, and re-running on an unchanged recording doesn't re-extract frames.

## Open Questions

- **render-service scope creep.** Confirm the team is fine folding frame-extraction into the
  Remotion-rendering service vs. standing up a cleaner, separate service. Recommended for
  pragmatism in the source plan, not a forced call.
- **Dropbox download mechanism.** Are the existing share links "anyone with link" (fetchable via
  direct HTTP with `?dl=1`) or do they need real Dropbox API OAuth? Materially changes this
  feature's scope — unconfirmed.
- **Transcription provider.** Deepgram is the candidate (matching BlinkLife's own choice) but isn't
  integrated anywhere in this repo yet — a new dependency and credential, not yet signed off.

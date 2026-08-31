---
title: 'UXP Executor'
slug: 'uxp-executor'
scope: feature
status: discovery
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-08-31
resolution: 5/7
---

# E12.2 · UXP Executor

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

## Purpose

The deterministic renderer half of the brain/executor split (see
[E12.1](edl-brain-service.md)). A UXP plugin inside the editor's Adobe Premiere that receives an
EDL and applies it — builds the sequence, reframes, captions, exports. It translates EDL →
Premiere; it never talks to Claude and holds no API key.

**Consequence to state plainly:** because render is local-in-Premiere, v1 is an **editor-assist
agent, not a headless render farm.** Throughput is bounded by editor-workstation availability —
there is no overnight server batch in v1. True headless scale (an ffmpeg worker reusing the same
EDL) is an explicit v2 path, which is why the EDL is renderer-agnostic from day one.

## Behavior

1. Receive an EDL (JSON) from the brain (E12.1) for one clip.
2. Build the sequence: set in/out on the timeline.
3. Apply the crop/keyframe reframe to 9:16 per the EDL's `reframe` block.
4. Build caption objects at the font/position/timing the EDL specifies.
5. Export the draft to the human review queue.
6. On failure: retry up to N times, then flag the clip into the queue with the error rather than
   dropping it.

## Rules & Logic

**Never talks to Claude.** The executor is a thin translator, not a decision-maker — every choice
it renders was already decided by the brain and encoded in the EDL. If the EDL is wrong, the fix
is in E12.1, not here.

**Prefers local media, falls back to the signed URL.** Local render uses the editor's
already-present media where available (the "both" model) — the plugin prefers the local file if
the source is already on disk, falling back to fetching the windowed range from the GCS signed URL
otherwise.

## Data

Consumes the same EDL contract defined in [E12.1's Data section](edl-brain-service.md#data) — this
feature owns no separate data contract; only the *translator* changes if a v2 renderer (ffmpeg) is
added later, never the EDL shape.

## Failure Modes

**Per-clip render failure** (plugin crash mid-render, partial output, timestamp misread,
large-file timeout): retry up to **N** times; on exhaustion, flag the clip to the review queue with
the error — never silently drop it. Batch continues; one bad clip never fails the others (partial
delivery is fine). [UNRESOLVED] The exact failure taxonomy here (crash vs partial output vs
timestamp misread vs large-file timeout) was named but not enumerated with concrete handling per
type — to be done with Jason during the Claude-integrations side project.

## Acceptance Criteria

[UNRESOLVED] Same gap as E12.1: no criterion isolates render fidelity specifically (e.g. "reframe
keyframes and caption placement match the EDL's spec, verified against DNA's structured fields,
without manual touch-up, for ≥X% of drafts"). Only the blended pipeline-wide first-pass acceptance
rate (E12.4) exists today.

## Open Questions

- **UXP fidelity, unconfirmed:** can UXP actually apply programmatic crop keyframes + caption
  objects at the fidelity DNA requires? Must be validated in the technical design's day-1 spike
  before anything else is built on top of it.
- **Windowed fetch vs whole-file:** confirm whether Premiere/UXP can read a windowed range from
  the GCS signed URL, or requires the whole source file. If the latter, document it as a known
  cost (multi-hour, multi-camera sources are tens of GB).

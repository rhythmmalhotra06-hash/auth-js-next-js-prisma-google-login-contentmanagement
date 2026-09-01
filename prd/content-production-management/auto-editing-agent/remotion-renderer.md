---
title: 'Remotion Renderer'
slug: 'remotion-renderer'
scope: feature
status: discovery
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-09-01
resolution: 5/7
---

# E12.2 · Remotion Renderer

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

> **Renamed 2026-09-01 (was "UXP Executor").** The original plan rendered EDLs via a UXP
> plugin inside Adobe Premiere on the editor's own machine — a real purchase (Gareth
> acquiring/testing a plugin) and two unconfirmed feasibility questions (can UXP even do
> programmatic crop keyframes and captions; windowed vs. whole-file source reads) sitting
> on the critical path before anything could render at all. Replaced with **Remotion**
> (React/Node video rendering) after review: it removes the acquisition dependency
> entirely, runs headless on the same infrastructure this portal already deploys to
> (no editor workstation involved), and is written in the same language as the rest of
> this repo. This is the deliberate pull-forward of what the original tech design called
> the "v2 headless path" into v1 — see the technical design doc's rewritten section 0.

## Purpose

The deterministic renderer half of the brain/executor split (see
[E12.1](edl-brain-service.md)). A Remotion composition takes an EDL (E12.1's output) as
input props and renders the actual draft video: applies the crop/reframe keyframes,
burns in captions at the DNA's exact font/position/timing, normalizes audio to the
target LUFS. Runs headlessly — a Node process (`@remotion/renderer`), not a plugin
distributed to anyone's machine.

**Consequence to state plainly (supersedes the original v1/v2 split):** because render
is headless and server-side from day one, this agent is **not bounded by editor-
workstation availability** the way the Premiere plan was. Throughput is a compute/queue
question, not a "whoever has Premiere open" question — the "no overnight server batch in
v1" limitation in the original PRD no longer applies.

## Behavior

1. Receive an EDL (JSON) from the brain (E12.1) for one clip, triggered by the assigned
   editor clicking "Generate first cut" on the ticket (manual, per the epic's decided
   flow — never automatic).
2. Fetch the source media (GCS, per the EDL's `source_uri` + `in`/`out`).
3. Render a Remotion composition parameterized by the EDL: crop/reframe per
   `reframe.keyframes`, caption components per `captions[]` (font/weight/size/position
   from the DNA's structured fields, already enforced by E12.1's validation — the
   renderer trusts the EDL, it does not re-validate DNA constraints), audio loudness
   normalized to `audio.target_lufs`.
4. Export the draft MP4 to the review surface (ticket detail page + the dedicated
   auto-editing page — still to be built).
5. On failure: retry up to N times, then flag the clip into the review surface with the
   error rather than dropping it — same failure contract as the original plan.

## Rules & Logic

**Never talks to Claude.** Same principle as the original plan: the renderer is a
translator, not a decision-maker. Every choice it renders was already decided by the
brain and encoded in the EDL. If the EDL is wrong, the fix is in E12.1, not here.

**Reads GCS directly — no "local vs. signed-URL" branching.** The original plan needed a
"prefers local file, falls back to signed URL" rule because Premiere ran on an editor's
machine that might already have the source on disk. A headless renderer has no local
copy ever — it always reads from GCS (signed URL or direct access, whichever this
repo's existing GCS integration pattern uses). Simpler by construction.

## Data

Consumes the same EDL contract defined in [E12.1's Data section](edl-brain-service.md#data)
— this feature owns no separate data contract; the EDL is renderer-agnostic by design
(technical design doc), which is exactly what made this swap possible without touching
E12.1 at all.

## Failure Modes

**Per-clip render failure** (Remotion/ffmpeg error, corrupt source segment, timeout on a
long clip): retry up to **N** times; on exhaustion, flag the clip to the review surface
with the error — never silently drop it. Batch continues; one bad clip never fails the
others (partial delivery is fine). [UNRESOLVED] The exact failure taxonomy (render
timeout vs. codec/format issue vs. GCS read failure) isn't enumerated yet — worth doing
once the first real failures are observed rather than guessing categories in advance.

## Acceptance Criteria

[UNRESOLVED] Same gap as E12.1: no criterion isolates render fidelity specifically (e.g.
"reframe and caption placement match the EDL's spec, verified against the DNA's
structured fields, without manual touch-up, for ≥X% of drafts"). Only the blended
pipeline-wide first-pass acceptance rate (E12.4) exists today.

## Open Questions

- **Deploy footprint, not feasibility.** Remotion's crop/caption/audio capabilities are
  well-documented and not in serious doubt (unlike the old UXP fidelity question) — the
  real open item is packaging: `@remotion/renderer` needs a headless Chromium + ffmpeg
  toolchain, and this repo's Dockerfile builds on `node:lts-alpine`, which is a genuinely
  awkward base for headless Chromium (missing shared libs Alpine doesn't ship). Needs a
  Dockerfile change (likely a `node:lts` slim/bullseye-based image, or Remotion's own
  documented Docker recipe) before this can build in Kessel's pipeline — confirm this
  before writing renderer code, not after.
- **New production dependency.** `remotion` + `@remotion/renderer` aren't installed yet —
  a real addition to `package.json`, not a config change. Flagged for sign-off per the
  same standard as any other new production dependency.
- **Where render actually runs.** As part of the existing Cloud Run service (this
  portal), or a separate Cloud Run Job/service dedicated to rendering? A single request
  spawning a headless-Chromium render inside the same process serving web traffic is a
  real resource-contention question worth deciding deliberately.

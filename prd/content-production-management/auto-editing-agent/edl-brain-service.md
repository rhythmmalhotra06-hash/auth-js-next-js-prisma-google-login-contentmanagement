---
title: 'EDL Brain Service'
slug: 'edl-brain-service'
scope: feature
status: discovery
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-08-31
resolution: 5/7
---

# E12.1 · EDL Brain Service

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

## Purpose

**Claude does not render video.** It produces an **Edit Decision List (EDL)** — a structured
description of the cut. A deterministic renderer (E12.2, the UXP executor) applies it. This is the
"brain" half of the split: a Claude Code agent service (TypeScript) that decides *what* the edit
should be. It reads DNA, slices the transcript to the relevant window, calls Claude per clip,
emits the EDL, and logs instrumentation. It holds the API key; the executor never talks to Claude.

## Behavior

**One call per clip, not per source.** E8 (the clip engine) has already chosen the moments, so
each call needs only that clip's transcript slice + the asset type's DNA — never the full
30k-word transcript. This keeps each call cheap, fast, parallelizable, and independently
retryable.

- **Model:** Claude Sonnet (`claude-sonnet-4-6`) — strong enough for structured edit-decision
  reasoning, fast/cheap enough for per-clip volume. Re-evaluate if reasoning depth proves
  insufficient on hard reframes.
- **Input per call:** the clip window (in/out + transcript slice), the three DNA layers
  (structured fields, NL brief, gold-clip reference descriptor — see E12.3), the target channel
  (drives risk tier), and the renderer's capabilities (so it never emits something Premiere can't
  do).
- **Output:** strict EDL JSON, no prose. System prompt must enforce JSON-only; parse defensively
  (strip fences, validate schema) before use.
- **Precedence enforced in the prompt AND in code:** structured fields are hard constraints —
  after Claude returns, the brain *validates* the EDL against them (e.g. caption font, safe-area
  pixels) and rejects/repairs any violation. Claude is asked to honor them; code guarantees them.
  Never trust the model to self-enforce a hard constraint.

## Rules & Logic

**DNA precedence, read not owned here.** The brain reads the per-asset-type DNA record (owned by
E12.3) — three layers with fixed precedence when they conflict:

1. **Structured fields** (font, safe-area pixels, loudness/LUF targets, aspect ratio) = **hard
   constraints, never violated.**
2. **Natural-language brief** = **fills gaps** the structured fields don't cover (intent, feel).
3. **Gold reference clip** = **style tiebreaker**, imitated only where fields and brief are both
   silent.

## Data

**Edit Decision List — the brain↔renderer contract (renderer-agnostic):**

```jsonc
{
  "clip_id": "rec...",              // links back to the Airtable clip record
  "source_uri": "gs://.../talk.mov",// canonical cloud source
  "in": 1342.50,                    // seconds
  "out": 1377.25,
  "aspect": "9:16",
  "reframe": {                      // speaker-centered crop over time
    "mode": "speaker_track",        // or "static"
    "keyframes": [ { "t": 0.0, "x": 0.31, "y": 0.0, "w": 0.38, "h": 1.0 } ]
  },
  "captions": [
    { "t_in": 0.4, "t_out": 2.1, "text": "...", "font": "MV Sans",
      "weight": 700, "size_px": 48, "x": 0.5, "y": 0.78, "safe_area": "ig_reel_v2" }
  ],
  "audio": { "target_lufs": -14.0, "normalize": true },
  "dna_version": "podcast@2026-06-28",  // which DNA produced this (drift tracking)
  "render_target": "premiere_uxp"       // v2 may set "ffmpeg"
}
```

This same JSON drives the UXP plugin (E12.2) now and an ffmpeg worker later — only the
*translator* changes, never the brain.

**Source media access:** canonical source lives in GCS; the brain passes the renderer a **signed
URL** + in/out so it reads only the windowed range it needs. [UNRESOLVED] Whether Premiere's UXP
plugin can actually fetch a windowed range, or needs the whole file, is unconfirmed — see E12.2's
Open Questions; document as a known cost if the whole-file requirement holds.

## Failure Modes

**EDL validation failure** — Claude returns malformed or constraint-violating JSON: repair if
trivial (e.g. re-clamp to safe area), else re-call once, else flag to the review queue with the
error. Never silently drop a requested clip; one bad clip never fails the others (partial delivery
is fine).

## Acceptance Criteria

[UNRESOLVED] The original doc defined only a whole-pipeline acceptance bar (first-pass acceptance
rate, ~70% gate — see E12.4), which blends this component's decision quality with E12.2's render
fidelity and the human reviewer's judgment. There is no criterion isolating the brain's own job —
e.g. "EDL passes structured-field validation on first attempt for ≥X% of calls," independent of
whether the executor renders it well or a human likes the result. Worth deciding whether that's
worth measuring separately, or whether the blended pipeline number is the only one that matters in
practice.

## Open Questions

- **Model re-evaluation trigger** — re-evaluate Sonnet if reasoning depth proves insufficient on
  hard reframes; no defined threshold for when that call gets made.
- **Base-prompt improvement** — does the clip-engine base prompt need Gareth's estimated ~10% of
  granular editing detail before feeding this agent? Not yet attempted.
- **MCP contract** — payload, auth, return path, large-file/timeout handling for how this service
  is dispatched from the portal (E12.5) — explicitly deferred to Rhythm + Jason at build time.

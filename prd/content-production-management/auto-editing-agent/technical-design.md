---
title: 'Auto-Editing Agent — Technical Design'
slug: 'auto-editing-agent-techdesign'
scope: technical-design
status: resolved
parent: content-production-management/auto-editing-agent.md
created: 2026-06-30
updated: 2026-08-31
---

# Auto-Editing Agent — Technical Design

> Companion to [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md) and its
> children ([E12.1 EDL Brain Service](edl-brain-service.md),
> [E12.2 UXP Executor](uxp-executor.md), [E12.3 DNA & Pilot Selection](dna-pilot-selection.md)).
> The PRDs answer *what/why*; this answers *how we build it*.

## 0. The one fact that shapes everything

**Claude does not render video.** It produces an **Edit Decision List (EDL)** — a structured
description of the cut. A deterministic renderer applies it. In v1 that renderer is a **UXP
plugin inside the editor's Adobe Premiere**. This splits the system cleanly:

- **Brain** (decides the edit, E12.1): a Claude Code agent service, TypeScript. Reads DNA, slices
  transcript, calls Claude per clip, emits EDL, logs instrumentation. Holds the API key.
- **Executor** (applies the edit, E12.2): a UXP plugin in Premiere on the editor's machine.
  Receives EDL, builds the sequence, reframes, captions, exports. Translates EDL → Premiere; never
  talks to Claude.

Consequence to state plainly: because render is local-in-Premiere, **v1 is an editor-assist agent,
not a headless render farm.** Throughput is bounded by editor-workstation availability — there is
no overnight server batch in v1. True headless scale is a v2 path (ffmpeg worker) that reuses the
*same EDL*, which is why the EDL is renderer-agnostic from day one.

## 1. Architecture

```
                    ┌─────────────────────────────────────────┐
                    │  BRAIN  — Claude Code agent (TypeScript)  │
                    │                                           │
 Clip engine  ───▶  │  1. receive clip suggestions              │
 (timestamps, hooks)│     (in/out, hook, caption, rationale)    │
                    │  2. fetch DNA for asset type (Airtable)   │
 Airtable DNA ───▶  │  3. slice transcript to clip window       │
 (fields/brief/gold)│  4. Claude call PER CLIP → EDL JSON       │ ──▶ Anthropic API
                    │  5. validate EDL against hard constraints │      (Sonnet)
 GCS source   ───▶  │  6. dispatch EDL to plugin                │
 (signed URL)       │  7. log instrumentation + acceptance      │ ──▶ Airtable + Slack
                    └──────────────────┬────────────────────────┘
                                       │ EDL (JSON) per clip
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  EXECUTOR — UXP plugin inside Premiere     │
                    │  (editor's machine, local media)          │
                    │  • EDL → sequence (in/out on timeline)    │
                    │  • crop/keyframe reframe to 9:16           │
                    │  • caption objects (font/pos from EDL)    │
                    │  • export draft → review queue            │
                    │  • on failure: retry N, then flag queue   │
                    └─────────────────────────────────────────┘
```

**Why this topology:** the brain stays server/agent-side so the API key, DNA access, and
instrumentation never live on a client; the executor is a thin translator where the media and
Premiere already are (local), avoiding moving tens-of-GB files to a server to render.

## 2. The Claude call (the heart of it)

**One call per clip, not per source.** The clip engine has already chosen the moments, so each
call needs only that clip's transcript slice + the asset type's DNA — never the full 30k-word
transcript. Benefits: fits context easily, cheap, parallelizable, independently retryable.

- **Model:** Claude Sonnet (`claude-sonnet-4-6`) — strong enough for structured edit-decision
  reasoning, fast/cheap enough for per-clip volume. Re-evaluate if reasoning depth proves
  insufficient on hard reframes.
- **Input per call:** clip window (in/out + transcript slice), the three DNA layers (structured
  fields, NL brief, gold-clip reference descriptor), target channel (risk tier), and the renderer
  capabilities (so it never emits something Premiere can't do).
- **Output:** strict EDL JSON, no prose. System prompt must enforce JSON-only; parse defensively
  (strip fences, validate schema) before use.
- **Precedence enforced in the prompt AND in code:** structured fields are hard constraints — after
  Claude returns, the brain *validates* the EDL against the structured fields (e.g. caption font,
  safe-area pixels) and rejects/repairs any violation. Claude is asked to honor them; code
  guarantees them. Never trust the model to self-enforce a hard constraint.

## 3. Data contracts

### 3.1 Edit Decision List (renderer-agnostic — the brain↔renderer contract)

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

This same JSON drives the UXP plugin now and an ffmpeg worker later. Only the *translator*
changes, never the brain.

### 3.2 DNA record (Airtable — to be built for pilot types first, see E12.3)

Per asset type, three layers (precedence: fields > brief > gold):
- **Structured fields** (hard constraints): caption font/weight/size, safe-area spec id, target
  LUFS, aspect ratio.
- **NL brief** (gap-filler): free text intent/feel. Seeded from the existing clip-rules base
  prompt.
- **Gold reference** (style tiebreaker): link/descriptor of an exemplar clip.
- **Metadata:** `dna_version` (timestamp), `dna_last_updated_by`.

Exact `fld...` IDs are assigned when the records are created (pilot types only for v1). Schema
lives in Airtable; the brain reads via the Airtable MCP / API.

### 3.3 Source media access

Canonical source in **GCS**; brain passes the renderer a **signed URL** + in/out so the plugin
reads only what it needs. Local render uses the editor's already-present media where available
(the "both" model) — plugin prefers local file if the source is already on disk, falls back to
signed-URL fetch of the windowed range otherwise. (Confirm the windowed-fetch capability during
the spike; if Premiere needs the whole file, document that as a known cost.)

## 4. Failure handling

- **Per-clip render failure:** retry up to **N** times; on exhaustion, **flag the clip to the
  review queue** with the error — never silently drop. Batch continues; one bad clip never fails
  the others (partial delivery is fine).
- **EDL validation failure** (Claude returns malformed or constraint-violating JSON): repair if
  trivial (re-clamp to safe area), else re-call once, else flag.
- **Drift signal** (first-pass acceptance dropping, per pilot type since last `dna_version`
  change): Slack DM to owner + creatives channel post; owner has **24h**, else escalate.
  [UNRESOLVED per E12.4] the escalation target was Gareth when Rhythm was sole owner during the
  pilot; not re-confirmed now that Titus owns post-launch. Agent keeps running either way
  (auto-pause = v2).
- **Stale DNA on shipped clips** (DNA version changes): flag affected clips for human re-edit, log
  the gap. No auto-re-render.

## 5. Repo & runtime

- **Language:** TypeScript throughout — matches the portal (Next.js) and Claude Code repo; UXP
  plugins are JS/TS, so brain and executor share a language.
- **Structure (proposed):**
  - `/agent` — Claude Code orchestration service (DNA fetch, transcript slice, Claude calls, EDL
    emit, instrumentation) — E12.1
  - `/uxp-plugin` — Premiere UXP executor (EDL → sequence → export) — E12.2
  - `/shared` — EDL types, DNA types, validation (single source of truth for the contract)
- **Deploy:** brain runs as part of the existing Cloud Run deployment / Claude Code agent; plugin
  distributed to editor machines via UXP.
- **Instrumentation sink:** Airtable (per-clip acceptance result, reject reason from the taxonomy,
  time-to-draft, time-to-shippable) + Slack for alerts — see E12.4.

## 6. Build sequence

**Spike (day 1, proves the riskiest assumption): one pilot asset type, one real source, ONE clip,
end-to-end.**
Manually pick a clip window → brain calls Claude with that type's DNA → EDL → UXP plugin renders
it in Premiere → eyeball it against DNA. This proves the entire chain works and produces an
on-brand cut *before* any infrastructure for scale. Thin vertical slice, not a horizontal layer.

Then, in order:
1. Harden the EDL schema + shared validation from spike learnings.
2. Build DNA records for the 2–3 pilot types (E12.3 — Gareth/Titus select; ≥1 Vishen-owned to
   exercise the 70% gate).
3. Brain (E12.1): wire clip-engine suggestions in (replace manual window pick), batch per-clip
   calls, EDL validation + constraint enforcement.
4. UXP plugin (E12.2): retry/flag failure path, caption + reframe fidelity, draft export to queue.
5. Instrumentation (E12.4): acceptance result + reject taxonomy + two time metrics + drift signal
   → Airtable/Slack.
6. Measure acceptance per pilot type; only when a Vishen-owned type clears ~70% does the agent
   serve that channel.
7. Portal integration (E12.5, ticket checkbox → MCP dispatch) — only after standalone proof.

## 7. Open implementation items (don't block the spike)

- Confirm UXP can apply programmatic crop keyframes + caption objects at the fidelity DNA
  requires (validate in spike) — see E12.2 Open Questions.
- Confirm windowed signed-URL read vs whole-file requirement for Premiere.
- MCP contract for the portal→agent dispatch (payload/auth/return) — define at step 7, see E12.5.
- Cost model: per-clip Sonnet call × expected daily volume.
- v2 candidates: ffmpeg headless renderer (reuses EDL), auto-pause circuit-breaker, review-throughput
  batching.

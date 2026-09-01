---
title: 'Auto-Editing Agent — Technical Design'
slug: 'auto-editing-agent-techdesign'
scope: technical-design
status: resolved
parent: content-production-management/auto-editing-agent.md
created: 2026-06-30
updated: 2026-09-01
---

# Auto-Editing Agent — Technical Design

> Companion to [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md) and its
> children ([E12.1 EDL Brain Service](edl-brain-service.md),
> [E12.2 Remotion Renderer](remotion-renderer.md), [E12.3 DNA & Pilot Selection](dna-pilot-selection.md)).
> The PRDs answer *what/why*; this answers *how we build it*.

> **Rewritten 2026-09-01 for the Remotion renderer decision** (was a UXP plugin inside Adobe
> Premiere). Sections 0, 1, 5, 6, 7 changed materially; sections 2–4 are mostly unaffected since
> the brain's job and the EDL contract were already renderer-agnostic by design.

## 0. The one fact that shapes everything

**Claude does not render video.** It produces an **Edit Decision List (EDL)** — a structured
description of the cut. A deterministic renderer applies it. In v1 that renderer is **Remotion**
(headless React/Node video rendering). This splits the system cleanly:

- **Brain** (decides the edit, E12.1): a Claude Code agent service, TypeScript. Reads DNA, slices
  transcript, calls Claude per clip, emits EDL, logs instrumentation. Holds the API key.
- **Executor** (applies the edit, E12.2): a Remotion render service, headless, running server-side.
  Receives EDL, builds the composition, reframes, captions, exports. Translates EDL → rendered MP4;
  never talks to Claude.

**Consequence to state plainly (this is the thing that changed):** because render is headless and
server-side from day one, this is **not bounded by editor-workstation availability** the way a
Premiere plugin would be — there's no "whoever has Premiere open" constraint, and no plugin
purchase/acquisition sitting on the critical path. What was originally scoped as a v2 path (a
headless renderer reusing the same EDL) is v1 from the start; the EDL was already designed
renderer-agnostic, which is exactly what made this swap possible without touching E12.1 at all.

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
 GCS source   ───▶  │  6. dispatch EDL to renderer               │
 (signed URL)       │  7. log instrumentation + acceptance      │ ──▶ Airtable + Slack
                    └──────────────────┬────────────────────────┘
                                       │ EDL (JSON) per clip
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  EXECUTOR — Remotion render service        │
                    │  (headless, server-side, no local media)  │
                    │  • EDL → composition (in/out on timeline) │
                    │  • crop/keyframe reframe to 9:16           │
                    │  • caption components (font/pos from EDL) │
                    │  • export draft → review surface           │
                    │  • on failure: retry N, then flag surface  │
                    └─────────────────────────────────────────┘
```

**Why this topology:** the brain stays server/agent-side so the API key, DNA access, and
instrumentation never live on a client; the executor is a headless renderer that reads directly
from GCS — no "local vs. remote media" branching, since there is no local/editor-machine leg at
all anymore.

## 2. The Claude call (the heart of it)

**One call per clip, not per source.** The clip engine has already chosen the moments, so each
call needs only that clip's transcript slice + the asset type's DNA — never the full 30k-word
transcript. Benefits: fits context easily, cheap, parallelizable, independently retryable.

- **Model:** Claude Sonnet (`claude-sonnet-5` as of build time — the original spec named
  `claude-sonnet-4-6`, since superseded) — strong enough for structured edit-decision reasoning,
  fast/cheap enough for per-clip volume. Re-evaluate if reasoning depth proves insufficient on hard
  reframes.
- **Input per call:** clip window (in/out + transcript slice), the three DNA layers (structured
  fields, NL brief, gold-clip reference descriptor), target channel (risk tier), and the renderer
  capabilities (so it never emits something Remotion can't do — crop keyframes, text-overlay
  captions, loudness normalization; nothing beyond that in v1).
- **Output:** strict EDL JSON, no prose. System prompt must enforce JSON-only; parse defensively
  (strip fences, validate schema) before use.
- **Precedence enforced in the prompt AND in code:** structured fields are hard constraints — after
  Claude returns, the brain *validates* the EDL against the structured fields (e.g. caption font,
  safe-area pixels) and rejects/repairs any violation. Claude is asked to honor them; code
  guarantees them. Never trust the model to self-enforce a hard constraint.

**Status: built.** `lib/auto-editing/{schema,dna,prompt,generate}.ts` and
`app/api/auto-editing/generate/route.ts` implement this exactly, against a stub DNA record pending
E12.3's real pilot selection.

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
  "render_target": "remotion"           // the only value today; kept for future renderer swaps
}
```

This JSON is the full brain↔renderer contract — the reason swapping Premiere/UXP for Remotion
required zero changes to E12.1 or this schema. Only the *translator* (E12.2) changed.

### 3.2 DNA record (Airtable — to be built for pilot types first, see E12.3)

Per asset type, three layers (precedence: fields > brief > gold):
- **Structured fields** (hard constraints): caption font/weight/size, safe-area spec id, target
  LUFS, aspect ratio.
- **NL brief** (gap-filler): free text intent/feel. Seeded from the existing clip-rules base
  prompt.
- **Gold reference** (style tiebreaker): link/descriptor of an exemplar clip.
- **Metadata:** `dna_version` (timestamp), `dna_last_updated_by`.

Exact `fld...` IDs are assigned when the records are created (pilot types only for v1). Schema
lives in Airtable; the brain reads via the Airtable MCP / API. **Status: stubbed** —
`lib/auto-editing/dna.ts` ships a placeholder `STUB_PILOT_DNA` pending E12.3.

### 3.3 Source media access

Canonical source in **GCS**; brain passes the renderer a **signed URL** + in/out. Because the
renderer is headless (no editor's machine involved), there is no "local file vs. signed URL"
branching the original Premiere plan needed — Remotion always reads from GCS, every time. Simpler
by construction, and removes one of the two feasibility questions the UXP plan carried.

## 4. Failure handling

- **Per-clip render failure:** retry up to **N** times; on exhaustion, **flag the clip to the
  review surface** with the error — never silently drop. Batch continues; one bad clip never fails
  the others (partial delivery is fine).
- **EDL validation failure** (Claude returns malformed or constraint-violating JSON): repair if
  trivial (re-clamp to safe area), else re-call once, else flag. **Status: built** —
  `lib/auto-editing/generate.ts` implements exactly this (`retried` flag on the result).
- **Drift signal** (first-pass acceptance dropping, per pilot type since last `dna_version`
  change): Slack DM to owner + creatives channel post; owner has **24h**, else escalate.
  [UNRESOLVED per E12.4] the escalation target was Gareth when Rhythm was sole owner during the
  pilot; not re-confirmed now that Titus owns post-launch. Agent keeps running either way
  (auto-pause = v2). **Status: built** — `lib/auto-editing/instrumentation.ts` computes the rate
  and fires the real Slack alert; the escalation *target* is still the open question above, not
  the mechanism.
- **Stale DNA on shipped clips** (DNA version changes): flag affected clips for human re-edit, log
  the gap. No auto-re-render.

## 5. Repo & runtime

- **Language:** TypeScript throughout — matches the portal (Next.js) and Claude Code repo. Remotion
  compositions are React/TypeScript, so brain and executor share a language even more directly
  than the UXP plan did (UXP plugins are JS/TS but a distinct runtime/packaging model; Remotion
  runs as a normal Node process).
- **Structure:**
  - `lib/auto-editing/` — brain: DNA fetch, transcript slicing, Claude calls, EDL emit,
    instrumentation (E12.1, E12.4) — **built**.
  - `lib/auto-editing/render/` (proposed) — Remotion composition + render invocation (E12.2) —
    **not yet built**.
  - EDL/DNA types already live in `lib/auto-editing/schema.ts` / `dna.ts` — the single source of
    truth for the contract; the renderer imports these rather than redefining them.
- **Deploy — the open item that actually matters now:** `@remotion/renderer` needs headless
  Chromium + ffmpeg. This repo's Dockerfile builds on `node:lts-alpine`, which does not ship the
  shared libraries Chromium needs — **this will not build as-is.** Before writing renderer code,
  confirm one of: (a) switch the Dockerfile's runtime stage to a Debian-based Node image (Remotion
  publishes a documented Docker recipe), or (b) render in a separate Cloud Run service/job with its
  own Dockerfile, keeping the portal's existing Alpine image untouched. Also decide whether render
  runs inside the same Cloud Run service that serves web traffic, or a dedicated service/job — a
  Chromium render is real CPU/memory contention against request-serving.
- **New production dependency:** `remotion` + `@remotion/renderer` are not installed. Flagged for
  explicit sign-off before `npm install`, same as any other new production dependency.
- **Instrumentation sink:** Airtable (per-clip acceptance result, reject reason from the taxonomy,
  time-to-draft, time-to-shippable) + Slack for alerts — see E12.4. **Status: partially built** —
  the computation and Slack alerting are live; the durable Airtable/Postgres sink is still an
  in-memory placeholder (see E12.4).

## 6. Build sequence

**Spike (proves the riskiest assumption, now a packaging/deploy question, not a fidelity
question): one pilot asset type, one real source, ONE clip, end-to-end, rendered in a real Kessel
deploy.**
Manually pick a clip window → brain calls Claude with that type's DNA → EDL → Remotion renders it
headlessly → eyeball it against DNA. The Docker/Chromium packaging decision above must be resolved
*before* this spike can run at all — that is now the actual gating step, not editor-side fidelity
questions the old UXP plan carried.

Then, in order:
1. Resolve the Docker/Chromium packaging decision (§5) and get one Remotion render succeeding in a
   real Kessel deploy.
2. Harden the EDL schema + shared validation from spike learnings.
3. Build DNA records for the 2–3 pilot types (E12.3 — Gareth/Titus select; ≥1 Vishen-owned to
   exercise the 70% gate).
4. Brain (E12.1) — **already built**: wire clip-engine suggestions in (replace the manual
   test-route input), batch per-clip calls.
5. Remotion renderer (E12.2): composition build-out (crop/reframe, captions, audio normalize),
   retry/flag failure path, draft export to the review surface.
6. Review surface: the "Generate first cut" trigger on the ticket, the accept/reject
   (feedback+retry vs. ignore)/download-raw UI, and the dedicated auto-editing page — not scoped
   in a PRD yet, needed before step 7 can be measured with real human decisions.
7. Instrumentation (E12.4) — **already built** (mechanism); durable sink still pending.
8. Measure acceptance per pilot type; only when a Vishen-owned type clears ~70% does the agent
   serve that channel.
9. Portal integration (E12.5) — the checkbox/MCP-dispatch model in that doc is stale; the actual
   decided flow (manual per-ticket trigger, no MCP dispatch) needs writing up before this step,
   not after.

## 7. Open implementation items (don't block the spike)

- **Docker/Chromium packaging for Remotion** — the actual current blocker; see §5. Confirm before
  writing renderer code.
- **Where render runs** — same Cloud Run service as the portal, or a separate service/job.
- Cost model: per-clip Sonnet call × expected daily volume, plus Remotion render compute/memory
  per clip (headless Chromium is not free).
- Durable instrumentation sink (Airtable or Postgres) — see E12.4; currently in-memory only.
- v2 candidates: auto-pause circuit-breaker, review-throughput batching.

---
title: 'Strategy Viewer'
slug: 'strategy-viewer'
scope: feature
status: discovery
parent: content-production-management/content-clipping-engine.md
children: []
created: 2026-06-26
updated: 2026-06-26
resolution: 5/7
---

# Strategy Viewer

> Part of [AI Content Clipping Engine](../content-clipping-engine.md)

## Purpose

The clipper-facing surface: submit a transcript + context, browse past runs, and read the generated 10-section strategy — with per-clip selection so the clipper can mark which Reels clips to produce.

## Behavior

- **`app/content-engine/page.tsx`** — landing: "New strategy" + history list of past `ClipStrategy` runs (reuse Tailwind list patterns from `app/tickets`).
- **`app/content-engine/new/page.tsx`** + **`components/clipping/ClipEngineForm.tsx`** — tabs (Paste / Upload / YouTube URL) + context fields (title, guest, audience, brand pillars with defaults) + web-search toggle. Submits to the generate route, shows a loading state, redirects to detail on completion.
- **`app/content-engine/[id]/page.tsx`** + **`components/clipping/StrategyView.tsx`** — renders all 10 sections under clear headers. The Reels-clips section shows per-clip cards with virality score, timestamps, caption, hook line, format, and a **selection checkbox**; a batch **"Create tickets"** button reflects the current selection count. Clips already converted show an `approved` badge with a link to the ticket.

## Rules & Logic

- Brand styling: primary `#572280`, gold `#F5B000` for accent/attention only; existing Tailwind conventions; dark-mode aware.
- The 10 sections render from `ClipStrategy.output` (JSON); the selectable clip cards render from `ClipSuggestion` rows (so selection state persists).
- While `status='generating'`, the detail view shows progress; on `status='error'`, it shows the error + retry.

## Data

- Reads `ClipStrategy` (+ `output`) and its `ClipSuggestion[]`; reads `ContentSource` for header context (title, guest, source link). Selection state lives on `ClipSuggestion.status`.

## Failure Modes

- Strategy still generating → loading state, not a blank/empty render.
- Strategy errored → surfaced error + retry, never a half-rendered strategy.
- Empty/odd sections from the model → render defensively (skip missing optional fields).

## Acceptance Criteria

- All 10 sections render legibly for a real generated strategy.
- Reels-clip cards show score + metadata and a working multi-select; the "Create tickets" action reflects selection.
- History list shows past runs and links to their detail views.

## Open Questions

[UNRESOLVED] Export/share of a strategy (PDF / copy-to-clipboard / share link) — needed for v1 or deferred? How are the non-clip sections (titles, thumbnails, distribution plan) actioned by the team — copy-paste, or do any of them also need a downstream hook beyond rendering?

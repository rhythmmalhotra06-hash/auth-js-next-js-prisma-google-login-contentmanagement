---
title: 'DNA Records & Pilot Selection'
slug: 'dna-pilot-selection'
scope: feature
status: discovery
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-08-31
resolution: 6/7
---

# E12.3 · DNA Records & Pilot Selection

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

## Purpose

"Follow the DNA" is how the agent (E12.1) knows what "on-brand" means for a given asset type. This
feature is the DNA record itself — its schema and precedence — plus the decision to build it for a
small pilot set rather than waiting on the full asset-type audit.

**Dependency handling — pilot-first, not sequential.** DNA records don't exist yet, and the
~54–98 creative asset types are mid-audit (Gareth/Titus/KJ). Rather than block the agent until the
full audit lands, v1 builds against **2–3 pilot asset types** with DNA ready first. Building the
agent against real types is also a forcing function that tells the audit what DNA records must
contain — the dependency becomes parallel and bidirectional, not a hard sequential block.

## Behavior

Per asset type, three layers, precedence fixed when they conflict:

1. **Structured fields** (hard constraints, never violated): caption font/weight/size, safe-area
   spec id, target LUFS, aspect ratio.
2. **NL brief** (gap-filler): free text intent/feel. Seeded from the existing clip-rules base
   prompt already in the creative-studio Airtable.
3. **Gold reference** (style tiebreaker): link/descriptor of an exemplar clip, imitated only where
   fields and brief are both silent.

The brain (E12.1) reads this record per call; this feature owns writing and maintaining it, not
consuming it.

## Rules & Logic

**Safe areas are versioned, never hard-coded.** Instagram/TikTok safe areas shift as the platforms
change their UI, so the structured-field spec must be updatable without a code change — a
`dna_version` on the record (see Data) is what lets drift tracking (E12.4) isolate a DNA change
from an agent regression.

**The clip-engine base prompt is the NL layer's starting point**, not a fresh write — Gareth
estimates ~10% improvement available from adding granular editing detail on top of it. Not yet
attempted (see Open Questions).

## Data

**DNA record (Airtable — to be built for pilot types first):**
- **Structured fields** (hard constraints): caption font/weight/size, safe-area spec id, target
  LUFS, aspect ratio.
- **NL brief** (gap-filler): free text intent/feel, seeded from the clip-rules base prompt.
- **Gold reference** (style tiebreaker): link/descriptor of an exemplar clip.
- **Metadata:** `dna_version` (timestamp), `dna_last_updated_by`.

Exact Airtable `fld...` IDs are assigned when the records are created (pilot types only for v1).

## Failure Modes

**Stale DNA on already-shipped clips.** When DNA changes (e.g. Instagram updates safe areas),
clips produced under the old rules are now off-spec. Mitigation: flag affected clips for human
re-edit and log the gap — no silent auto-re-render. The log also surfaces if DNA is changing too
often, which would itself be a signal something upstream (the audit, or the safe-area spec source)
is unstable.

## Acceptance Criteria

[UNRESOLVED] No definition yet of what "DNA record done" means concretely for a pilot type —
e.g. all three layers populated and reviewed by the asset type's team lead, or some lighter bar.
Blocked on the pilot selection below being made first.

## Open Questions

- **Pilot asset-type selection — still open.** Gareth/Titus to pick 2–3 from the audit; guidance
  is to span the risk spectrum, with at least one Vishen-owned type so the pilot actually exercises
  E12.4's high-risk acceptance gate rather than only easy cases. Not yet decided as of 2026-08-31.
- **Base-prompt improvement** — does the NL brief layer need Gareth's estimated ~10% of granular
  editing detail before the pilot DNA records are built? Not yet attempted.

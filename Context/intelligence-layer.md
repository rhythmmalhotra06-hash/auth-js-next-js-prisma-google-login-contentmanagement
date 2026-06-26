# Intelligence layer — the smarter path

> **Updated 26 Jun 2026.** Reconciled to `Context/MoreContext/CLAUDE.md` §6, which
> is authoritative. The model grew from **five to six** capabilities: the
> **content engine** was added as the only one that *originates* assets (the
> other five *augment* the workflow). The numbering below follows MoreContext.

> How the content system gets smart. Every capability here is **propose →
> human approves**, never silent automation. This matches the meeting decisions
> (managers stay in the loop; automation is a "first layer") and Blinkwork's
> trust-ladder model (the agent earns autonomy along a dated ladder; it does not
> assume it).

The six capabilities (one originates, five augment):

| # | Capability | Originates / Augments | Phase |
|---|------------|-----------------------|-------|
| 1 | Content engine | Originates | **P1** |
| 2 | Brief generation | Augments (intake) | **P1** |
| 3 | DNA feedback | Augments (produce) | P2 |
| 4 | Conversational brain | Augments (all, read-only) | P2 |
| 5 | Performance loop | Augments (measure) | P3 |
| 6 | Learning prioritization | Augments (prioritize) | P3 |

They compound in a loop, with the content engine feeding the front door:

```
  [1] Content engine ──▶ candidate requests
        │
        ▼
        ┌─────────────────────────────────────────────┐
        ▼                                             │
  [5] Performance loop ──▶ [2] Brief generation ──▶ better assets
        ▲                                             │
        │                                             ▼
  [3] DNA feedback ◀── assets produced ── [6] Learning prioritization
        │
        └──▶ [4] Conversational brain sits across all of it
```

Build order is **dependency-driven, not preference**: **P1** (content engine +
brief generation) needs only the model + already-connected data, so it ships
first — this is where the "50×" energy lands cleanly. **P2** (DNA feedback,
conversational brain) is useful early but not on the critical path. **P3**
(performance loop + learning prioritization) can't function until metrics flow
back from Content & Comms — the single unlock is the Content & Comms matching
key.

> **Section numbering note:** the detailed sections below predate the renumber
> and are kept for their descriptions. Their headings map to the authoritative
> table as: §1 Performance loop → **#5**, §2 Brief generation → **#2**,
> §3 Prioritization that learns → **#6**, §4 DNA feedback → **#3**,
> §5 Conversational layer → **#4**. The content engine (**#1**) is described in
> §0 directly below.

---

## 0. Content engine (the originating capability)

**New as the sixth capability (`Context/MoreContext/CLAUDE.md` §6, §8).** Unlike
the other five, it runs *before* a request exists — it manufactures candidate
request rows rather than augmenting one. It is the front door for free
founder-channel content: raw founder uploads (podcasts, talks, long-form video)
in, proposed scripts / clips / candidate requests out.

Propose-commit: the engine drops candidate rows into a staging surface; a human
**picks which become requests**. Nothing enters the live queue until promoted.
Shipped as epic **E8** (resolved) — see
`prd/content-production-management/content-clipping-engine.md`. This is where the
"watch a 2-hour podcast and find the clips" → "review 15 proposed clips" 50×
lands.

---

## 1. Performance loop that writes back

**Today:** the stakeholder view *displays* CTR/ROAS per published asset.
**Smarter:** correlate asset *attributes* with performance to surface what works.

Inputs already present in the schema:
- asset → event_type, asset_type, dimensions, audience (cold/warm), positioning
- performance → CTR, ROAS, etc. (from Clarisights / Amplitude, keyed per asset)

Output: ranked insights, e.g. "9x16 cold-audience Masterclass trailers with a
transformation angle outperform the asset-type average by ~40%." Surfaced in:
- the asset library (a "what's working" panel)
- intake (when this asset type is requested, show historical winners)

Why this is the edge: the research found Bynder/Brandfolder store the final cut
but never connect it to ROAS — this is the Performance-DAM gap, and Mindvalley
already has the ad-data connectors (Clarisights, Amplitude, Ahrefs) to close it.

Implementation note: start with simple grouped aggregates (attribute → avg
metric, with sample-size guardrails so a 2-asset segment isn't presented as a
trend). A model isn't required for v1; it's required when you want free-text
attributes (positioning, brief language) factored in.

---

## 2. Brief generation from what wins

**Today:** Titus hand-writes every creative brief — flagged as unsustainable.
**Smarter:** when a request comes in, draft the brief from evidence.

On intake of "Masterclass trailer, cold":
1. Pull top-performing past assets of that event_type × asset_type (from #1).
2. Pull the asset_type's DNA (requirements + feedback standards).
3. Pull relevant brain nodes (Insight: "calm as strength"; Rule: "never say
   'unlock'"; Product spec; Customer Avatar).
4. Draft a brief grounded in all three — references, angle, hook timing, CTA.

This is the Uplifted/Storyteq "what worked → what to make next" pattern. The
draft lands in the request for a human to edit and approve — it removes the
blank-page tax, not the human judgment.

---

## 3. Prioritization that learns

**Today:** `urgency × complexity` with hand-set seed weights (see
prioritization-algorithm.md).
**Smarter:** observe the signals the manual queue already generates:
- which tickets got manually re-ranked (and in which direction)
- which slipped their due dates
- which editors clear which asset_types fastest (cycle time per type per person)

Output: *proposed* weight adjustments — "your manual reorders consistently push
event-tier above due-date; suggest raising w_event." Never auto-applied. This
respects the Phase-1 "manual-assisted" decision while making the assist better
each week (the OODA loop the team already works in).

Capacity-aware assignment suggestions (also propose-only): given cycle-time
history + current load + asset_type preferred_editor, suggest who should take a
ticket — covering the ~20-30% unambiguous cases the meetings identified, leaving
the rest for manager triage.

---

## 4. AI-assisted DNA feedback (Phase 2)

**The deferred meeting item:** the system feeding back a video/design against
its DNA automatically.
**Smarter:** a first-pass review before a human looks. With the asset, its DNA
standards, and a multimodal model: "hook lands at 0:06; DNA requires ≤0:03",
"aspect ratio matches 9x16 spec", "CTA card present". This is Frame.io's
frame-accurate feedback made *evaluative*. Surfaced as review notes the editor
sees; a human still approves. Strictly Phase 2 — depends on a multimodal review
pipeline.

---

## 5. Conversational layer over the brain

**The Blinkwork-native capability.** Because event_types, assets, people, and
performance live as brain nodes (Asset, Metric/KPI, Person, Channel, Event), an
operator can ask in the side-chat or Claude Code:
- "what's blocking the Summit launch?"
- "draft 3 social cutdowns from the Quest shoot"
- "which editor has capacity for a VSSL this week?"
- "what did the last 5 Masterclass trailers average on CTR?"

The portal stays the structured surface; natural language is the second way in,
over the same data. This is not a separate feature to build — it falls out of
modeling the system on the brain (see productization.md).

---

## Guardrails for all six

- **Propose, don't act.** Every output is a draft/suggestion a human accepts.
- **Cite the evidence.** Insights and briefs reference the assets/metrics/nodes
  they came from — no unsourced assertions (mirrors the brain's "decisions-first,
  drill into docs" principle).
- **Sample-size honesty.** Don't present a 2-asset pattern as a trend.
- **Earn autonomy.** A capability can graduate from propose-only to
  auto-with-undo along a dated trust ladder, per Blinkwork's model — but only
  after it's demonstrably right.

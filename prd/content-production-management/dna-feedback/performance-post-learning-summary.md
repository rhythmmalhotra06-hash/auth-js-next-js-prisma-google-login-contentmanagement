---
title: 'Performance-Driven Post-Learning Summary'
slug: 'performance-post-learning-summary'
scope: feature
status: discovery
parent: content-production-management/dna-feedback.md
children: []
created: 2026-09-02
updated: 2026-09-02
resolution: 6/7
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# E13.3 · Performance-Driven Post-Learning Summary

> Part of [E13 · AI-Assisted DNA Feedback](../dna-feedback.md)

## Purpose

Learning shouldn't be scoped to the clip engine alone, or to explicit human review. This feature
closes the loop `context/intelligence-layer.md` describes between capability #1 (performance
insight — "9x16 cold-audience Masterclass trailers... outperform the asset-type average by ~40%")
and capability #4 (DNA feedback): real published-post performance, correlated with *what kind of
content it was* (not just raw numbers), becomes a third signal source for the same learned
rulebook [E13.1](text-review-rule-learning.md) introduced — alongside approver feedback and editor
reactions to AI findings.

Today's Performance page already computes per-account rollups and has a single-post,
human-triggered "Teach the engine" action — but it writes straight to `ClipRule` (clip-generation
steering) with no aggregation by content attributes and no connection to DNA. This feature adds
the aggregate, content-attribute-aware summary and wires it into the DNA rulebook, without
disturbing the existing clip-rule path.

## Behavior

1. **Auto-attribution.** When `SocialMetric` rows are ingested, a best-effort match against
   `Asset.distributionUrl` (in addition to the existing manual "Attach to ticket" action and
   `vishenVideoId` resolution) links a published post to the ticket that produced it — addressing
   the "often near-zero attribution" gap in today's data.
2. **Content-attribute join.** Once attributed, `SocialMetric` rows join through to
   `Ticket.assetTypeId`/`positioning`/`audience` — a join that doesn't exist in application code
   today.
3. **Grouped insights.** Attributed rows are grouped by `(assetTypeId × positioning × audience)`;
   a group only surfaces once it clears a minimum sample size (≥3 attributed posts) — "don't
   present a 2-asset segment as a trend," the same sample-size-honesty rule
   `intelligence-layer.md` names explicitly for capability #1.
4. **Post-learning summary panel.** A new panel on the Performance page shows "What's working"
   cards per qualifying group, template-composed (not LLM-narrated in v1) — e.g. "{assetType} ·
   {positioning} · {audience}: {n} posts, engagement {pct}% vs. account median."
5. **Add to DNA rulebook.** Each card has an action that writes a `DnaReviewRule` proposal
   (inactive, pending approval) scoped to that group's asset type — landing in the same approval
   queue E13.1 built in Settings → Asset Types.
6. **Tier-2 cron extension.** The existing weekly rule-proposal cron (E13.1) additionally pulls
   qualifying groups from this feature as another evidence source, so a single proposed rule can
   cite either "3 approvers flagged this" or "6 published posts of this type outperform by 40%."

## Rules & Logic

- **The attribution gap is the real blocker, not the summary logic.** Auto-matching on
  `distributionUrl` is deterministic URL matching — no LLM, no hallucination risk — and is a
  prerequisite, not an optional nice-to-have, for this feature to surface anything meaningful.
- **Sample-size honesty enforced, not just recommended.** A group below the floor is withheld
  entirely, not shown with a caveat — matching capability #1's own build note.
- **Template output, not LLM narration, for v1.** Capability #1's own scoping note: "a model isn't
  required for v1; it's required when you want free-text attributes... factored in." An LLM
  narration pass is a natural v1.1, not a v1 requirement.
- **Honest about coverage.** The panel states attribution coverage explicitly (e.g. "12 of 340
  posts attributed to a ticket") rather than implying full coverage — attribution will likely never
  reach 100% (agency-run accounts, posts predating the field, off-platform shares).
- **`proposeLearningFromPost()`'s existing single-post → `ClipRule` path is untouched.** This
  feature adds an aggregate, DNA-scoped sibling; it does not replace the existing clip-learning
  action.

## Data

Reads existing `SocialMetric`, `Ticket`, `AssetType` — no schema changes to those. Writes
`DnaReviewRule` (E13.1's schema, see [Technical Design](technical-design.md)) via the same
repository E13.1 introduces. New application-code join function
(`lib/performance/attribution.ts::attributedMetrics()`) — no such join exists today; `Ticket`↔
`SocialMetric` currently only connects via a bare, non-relational `ticketAirtableId` text field.

## Failure Modes

[UNRESOLVED] Not enumerated in the source plan. Specifically undefined: what happens when
`distributionUrl` auto-matching produces an ambiguous or many-to-one match (e.g. the same URL
reused across multiple assets), and whether a mis-attribution silently pollutes a content-attribute
group or is filtered out somehow. Worth defining once real ingestion data is inspected rather than
guessed in advance.

## Acceptance Criteria

- The `Asset.distributionUrl`↔`SocialMetric.publishedUrl` auto-match measurably raises the
  attributed-row count against real data (vs. today's near-zero baseline).
- `computeContentInsights()` withholds a group below the sample-size floor (tested with 1-2 posts)
  and surfaces one at/above it (tested with 3+ posts).
- "Add to DNA rulebook" writes an inactive `DnaReviewRule` that appears in the Settings →
  Asset Types approval queue introduced by E13.1.

## Open Questions

- **Attribution coverage, honestly.** Even with the auto-match, a meaningful share of published
  posts will likely stay unattributed indefinitely — this is a permanent UI honesty requirement,
  not a bug to eventually fix to zero.
- **Grouping granularity.** `(assetTypeId × positioning × audience)` is the proposed v1 grouping;
  should `Dimension`/aspect ratio be a fourth key from the start, or added once real data shows
  whether it's a meaningful split? More keys means smaller, noisier groups given the sample-size
  floor — a real trade-off, not decided yet.

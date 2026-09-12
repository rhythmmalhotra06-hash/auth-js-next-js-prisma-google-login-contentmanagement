---
title: 'E-H · Campaign / offer loop'
slug: 'campaign-offer-loop'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 4/7
---

# E-H · Campaign / offer loop

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (decisions D2, D4, D9,
> D16, D26, D32; open O2, O5). Sequenced behind E-B and E-C; the last of the three learning loops. No
> code until the real-data prototype is approved [D23].

## Purpose

The third unit of learning [D2]: **campaign, speaker and offer** judged on leads and revenue [D4].
Today Vishen's Monday number is assembled from Metabase by hand in a chat session; nothing connects a
week's leads or revenue to the content that ran that week, and nothing may connect them per post
until each post carries a unique `utm_content` short code [D16, O2]. This epic starts where the data
allows — week and campaign level, from the allowlisted Metabase questions (Q31846 leads, Q32044
revenue) pulled by the app [D26] — and moves to per-publication attribution only when the short code
exists.

## User Stories

**Vishen (founder) — one number, with what ran.** The Monday figure per brand (labelled by brand and
source, guards applied) sits beside the list of publications that went out that week, by campaign
tag and speaker. He can see that Manifesting ran 4 organic reels and 1 masterclass promo in the
week the leads number moved; the app does not tell him one caused the other.

**Gareth (content lead) — campaign and speaker as filters.** In Measure he filters the goal-metric
readouts by campaign tag or speaker (Jeffrey Allen) as overlays on the same-account × same-post-type
cohort [D32]; speaker and campaign are never the base cohort.

**Glen (data) — no per-post revenue claim.** Any surface that would attribute revenue or leads to a
single publication is blocked until the short code exists and appears in `utm_content`; until then
the label reads "week / campaign level" [D16].

## Workflows

Week/campaign level: the E-C Metabase pull lands the week figure per brand; Measure shows it beside
the week's publications grouped by campaign tag and speaker, with source, capture time and the guard
results (organic-social filter, distinct `order_id`, truncation check) [D26]. Learning at this level
reuses the E-B engine with campaign/speaker/offer as the attribute contrast on the goal metric that
Perch can measure (reach, comments, saves), not on revenue.

[UNRESOLVED] Per-publication attribution is undecided end to end: the short-code convention
(`MV-11057`?) and where it must appear (`utm_content`, Hootsuite tag, filename) is O2; whether
Metabase can return leads/revenue split by `utm_content` for the allowlisted questions, or new
questions must be allowlisted, is not in the plan; and the "offer" attribute (which offer a
publication promotes) has no source field in Airtable Social or on the ticket today.

## Boundaries

- No per-post revenue or leads claims until a short code exists and is present in `utm_content`
  [D16, O2].
- Metabase reads are limited to the allowlisted Q31846 / Q32044 [D26]; the allowlist stays
  hardcoded (plan §8).
- Figures only, no prose, on Vishen's number [D26]; no narrated causation between a publication and
  a revenue movement.
- Speaker and campaign are filters, never the base cohort [D32]; no cross-brand comparison [D16].
- No new URL shortener or third-party tracking product (a post-level tag, not new infrastructure).
- Paid-ad performance (Clarisights) is out of scope.

## Dependencies

- **E-C** — Metabase REST pull app-side with credentials (O5) on the scheduler (O6).
- **E-B** — the engine, cohorts and Knowledge store.
- **E-A** — Publication carrying campaign tags, speaker and (later) `shortCode`.
- O2 — short-code convention; O5 — key ownership.
- Airtable structure change: a short code field on Social if the tag must originate there [D16].

## Success Criteria

[UNRESOLVED] The plan defines no target for this loop. The one testable statement it does make is a
prohibition: 0 surfaces attribute leads or revenue to a single publication before its `shortCode` is
present in `utm_content` (snapshot/route test). Targets for campaign-level rules or attribution
coverage of `utm_content` are to be set with Rhythm, Gareth and Glen once O2 is decided.

## Features

[UNRESOLVED] Beyond (1) Measure showing the app-pulled week figure beside the week's publications by
campaign tag and speaker, and (2) campaign/speaker as overlay filters, the breakdown waits on O2
(short code), the Metabase question shape for `utm_content`, and an "offer" source field.

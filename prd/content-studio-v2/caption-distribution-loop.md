---
title: 'E-G · Caption / distribution loop'
slug: 'caption-distribution-loop'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 4/7
---

# E-G · Caption / distribution loop

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§2 learnings 1 and 3;
> decisions D2, D4, D9, D15, D36, D37, D47). Sequenced behind E-B; reuses its engine. No code until
> the real-data prototype is approved [D23].

## Purpose

The second unit of learning [D2]: what the **caption, CTA and distribution** did to a publication,
as distinct from what the edit did. The worked example already shows both signals: the reel reached
only @mindvalley's audience because both collab invites were still Pending at capture (a distribution
fact, owner: social team), and "Comment X" gated-CTA reels get ~40% fewer day-1 views (median 6.2k
vs 10.9k, n=8 vs 13) so they must be judged on comments (a caption fact, owner: caption owner). E-B
must already separate these lines so the editor is never blamed for them [D15]; this epic routes
them to the people who own them and learns from them.

## User Stories

**Vidura (social manager) — the distribution line is his.** The distribution-signal line from the
worked example ("both collab invites Pending at capture; reach 2,835 vs ~7,900 median") arrives on
his surface, not only on Yuthika's, with the collaborator handles and their invite status from the
Perch payload.

**The caption owner — judged on the right metric.** A gated-CTA caption (`Comment "X"`) flips the
goal to Convert [D36]; the readout shows comments 9 vs 20 (n=21) as the headline, and views as
context, with the note that gated-CTA reels run ~40% lower on day-1 views (n=8 vs 13).

**Gareth (content lead) — caption patterns by asset type and channel.** Aggregates: which CTA
styles and hook styles sit in the top vs bottom quartile on the goal metric, with n, never by
person [D9].

## Workflows

Reuses the E-B engine (cohort D32, goal map D36, deterministic split + template phrasing D37,
weekly ≤ 3 proposals D38, endorse/dispute/activate D39/D42, re-score D41) with the attribute
contrast restricted to caption and distribution attributes: CTA style (gated / open / none), hook
style, posting time, collaborator count and invite status, cross-posting (IG + FB). Proposals are
scoped `{lane: social, channel, owner: caption/social}` in the Knowledge store rather than to an
asset type.

[UNRESOLVED] The plan does not define who the "caption owner" is as a data field (the Airtable
Social record has an editor, not a caption author), where distribution-owner proposals surface
(the Learn inbox has no social-team lane yet), who activates a caption/distribution rule (the
asset-type Team Lead mapping in D42 does not fit a channel-scoped rule), or which delivery surface
carries the distribution line to the social team (the 24h DM is editor-only per D47).

## Boundaries

- A distribution or caption signal is never presented as an edit signal, and never in the same
  line [D15].
- No per-person numbers for caption owners or social managers; aggregates only [D9].
- Same sample floor and no fallback cohorts for proposals [D12, D33]; same "numbers never
  invented" rule [D37].
- The editor-only 24h DM does not grow extra lines for distribution owners [D47]; a distribution
  delivery is a separate surface.
- No cross-account or cross-brand comparison [D16].

## Dependencies

- **E-B** shipped and running for at least one full cohort window (90 days of confirmed
  publications) so caption/distribution splits have n ≥ 8.
- **E-A** Publication carrying caption text, collaborators and invite status (from the Perch mapper
  lift in E-C), posting time and cross-post links.
- **E-C** mapper lift of `collaborators` (+ invite status) and `post_type`.
- O1 goal-map confirmation (the gated-CTA override is part of D36).

## Success Criteria

[UNRESOLVED] The plan sets no numeric target for this loop (D14 covers attribution coverage and
asset-type DNA rules only). Candidates to confirm with Rhythm/Gareth: number of caption/distribution
rules activated in 60 days; share of publications with a Pending collaborator at day-1 capture that
is resolved (accepted) by day-7 after the signal is routed; rejection rate ≤ 30% as in D14.

## Features

[UNRESOLVED] Depends on the Workflows gap: at minimum a distribution-owner surface, a
caption/channel scope for proposals with its own approver, and the attribute extractors (CTA style,
hook style, posting time, collaborator status). Not broken down until the owner and approver
questions are answered.

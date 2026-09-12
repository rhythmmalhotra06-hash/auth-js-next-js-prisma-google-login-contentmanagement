---
title: 'E-B · Continuous learning engine — first loop: editor + asset-type DNA'
slug: 'continuous-learning-engine'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-11
resolution: 6/7
---

# E-B · Continuous learning engine — first loop: editor + asset-type DNA

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§2, §4; decisions
> D2–D9, D12, D14, D15, D17, D32–D42, D47–D50). This is the most fully decided epic in the plan;
> the sections below write those decisions out. **Extended 2026-09-11** with the proactive
> intelligence of §5b D81 (brief-from-what-wins at intake for every lane, the 24h anomaly nudge,
> next-week suggestions); the extension re-opened Features (see the marker there), so the epic
> returns to `discovery`. No code until the real-data prototype is approved [D23].

## Purpose

Close the loop that the current portal only half-runs. Two human-gated learning loops exist (clip
rules, DNA review rules) but neither reads performance; capability #1 (performance insight) is
absent. This epic takes every **confirmed** Publication (E-A), reads it at 24h and 7d against its
cohort, shows the editor a readout that separates what the *edit* did from what *distribution* did,
and once a week turns the asset type's quartiles into ≤ 3 proposed DNA rules that the team lead can
activate. The first unit of learning is **the editor's edit + asset-type DNA** [D3]; caption/CTA/
distribution (E-G) and campaign/speaker/offer (E-H) reuse this engine afterwards.

## User Stories

**Yuthika (editor) — the 24h DM.** 24h after reel `DdFYhV8DXTk` is confirmed, she gets a Slack DM
of exactly five lines: title · saves 16 vs cohort median 31 (n=21) · avg watch 8s vs 5s (n=15) · one
edit-signal line ("retention above median") · one distribution-signal line ("both collab invites
Pending at capture") · a link to the ticket. No adjectives, no verdict [D47].

**Yuthika — the ticket band.** On #11057 she sees day-1 and day-7 columns vs the same-account ×
same-post-type cohort, each number with source (Perch), capture age and n; the goal metric is saves
+ watch because the pillar is `💡 Educate` [D36]. Under it, a proposal for *Pathway Organic –
Snippets* awaits her endorse or dispute; a dispute requires a reason [D39].

**Yuthika — My work.** Her last 90 days of confirmed publications, day-1/day-7, goal metric +
retention, cohort position, proposals awaiting her reaction, deliveries not yet published or matched,
and a side-by-side of two of her edits [D49]. Nobody else's numbers are on the page.

**Titus (team lead) — the Monday approval pass.** On Monday he opens the Learn inbox: ≤ 3 new
proposals per asset type generated Sunday night, each with statement, rationale, evidence (refs, n,
delta), example, and the editors' endorse/dispute counts with dispute reasons. He activates or
rejects; the system records who activated. A rule flagged *contested* (evidence reversed, n ≥ 8)
is waiting for his decision too — the system never deactivated it [D38, D39, D41, D42].

**Gareth (content lead) — aggregates only.** By asset type and channel: top and bottom on the goal
metric, proposal counts, coverage %. No names [D9, D48].

**A new editor on a small asset type.** The readout shows her numbers with "collecting (3/8)"; the
cohort falls back to same post type across all MV accounts, labelled "(fallback, cross-account)".
No proposal is generated for her asset type until n ≥ 8 within one account [D12, D33].

**Glen (social) — the 24h anomaly nudge lands on the right desk.** When Manifest Love's day-1
capture shows both collab invites still Pending, the distribution half of the anomaly reaches Glen,
not only Yuthika; the edit half (8s vs 5s watch) stays on hers. Neither desk sees the other's line
as its own fault [D15, D81].

**Anyone raising a request, in any lane — a brief drafted from what wins.** At intake the brief
draft cites the active rules for the asset type plus its top-3 performers, editable; a design
request shows "no design DNA yet — Chee + Vanessa/Haley/Ziga" instead of an invented rule [D40,
D64, D81].

**Vishen, Gareth, Glen — next week's thin days come with a suggestion.** For each thin day 14–20 Sep
the desk shows "what worked in this slot before" from real cohorts, marked drafted; no slot is filled
by a machine [D67, D81].

## Workflows

**1. Readout per confirmed Publication** [D6, D32–D36]
- Trigger: a Day-1 capture (first capture 18–36h after `posted_at`) and a Day-7 capture (6.5–7.5
  days) [D35]. Nothing is read before 24h [D6].
- Cohort = same account × same post type × same age, last 90 days. Asset type is an overlay ("and
  vs 6 other Pathway Organic Snippets"); speaker and campaign are filters, never the base cohort
  [D32].
- Goal from the Airtable Social *Content Pillar* via the goal map [D5, D36]: Educate → saves +
  watch · Inspire/Entertain → shares + reach · Convert/gated CTA → comments · Announce → reach ·
  caption containing `Comment "X"` overrides to Convert · unmapped → "goal not set".
- Metrics [D34]: Views = `post_views`; Reach = `reach`; ER = engagement ÷ reach; Value = saved +
  shares; Conversation = comments; Retention = `ig_reels_avg_watch_time` seconds (percent of
  duration once Publication has `durationSec`); seconds compared only within the same post type.
- Output = the asset's metrics vs cohort median with n, plus *edit signals* (watch time, retention)
  separated from *distribution signals* (collab status, reach, posting time) [D15].
- Cohort < 8: show the asset's numbers, fall back to same post type across all MV accounts labelled
  "(fallback, cross-account)" [D33]; label "collecting (k/8)" [D12].

**2. Proposal generation — Sunday night, per asset type** [D37, D38, D12, D33]
- Cohort for learning: within one account, n ≥ 8 in both the top and bottom quartile of the goal
  metric. Never a fallback cohort.
- Deterministic step: quartile split on the goal metric, then attribute contrast across asset type,
  hook style, CTA, source = repurposed, speaker, post type. Numbers are fixed here.
- Phrasing step: Claude (`claude-haiku-4-5` as `DISTILL_MODEL`) fills statement and rationale from
  a template with the numbers already inserted. It cannot introduce a number.
- ≤ 3 new proposals per asset type per week, deduplicated against active and pending rules.
- Rule shape [D17]: `statement + rationale + evidence(refs, n, delta) + example + weight +
  confidence`, scoped to asset type; every proposal cites the publication ids it was computed from.
- Proposals land **inactive** in the Knowledge store (the `DnaReviewRule` shape, generalised).

**3. Endorse / dispute → activate** [D8, D39, D42]
- Editors on the asset type endorse or dispute each proposal; a dispute requires a reason and is
  stored as a Tier-1 signal. Reactions are advisory.
- The Team Lead OR Sub Lead of the asset type activates or rejects; the mapping must include both
  Airtable fields; the activator is recorded. No veto by editors, no auto-activation.

**4. Application** [D40]
- Active rules apply in DNA review at `Review` and in the brief draft at intake (rule + top-3
  performers cited, editable). Not the clip prompt, not a My-work checklist, in v1.

**5. Weekly re-score** [D41]
- Every active rule is re-scored against the last 90 days. If the delta flips sign with n ≥ 8, the
  rule is flagged *contested* to the lead. Never auto-deactivated.

**6. Delivery, built in this order** [D7]
1. Performance band inside the ticket (readout + proposal endorse/dispute + confirm control).
2. "My work" page [D49], visible to the editor, their asset-type leads, admins and manager/approver
   roles [D50].
3. 24h Slack DM to the editor only, 5 lines, template mutable per asset type [D47].
4. Monday digest: extend the existing social-digest cron with per-asset-type top/bottom on the goal
   metric, new-proposal count, pending confirms, coverage %; no per-editor numbers [D48].

**7. Proactive intelligence on the same engine** [D81] — three outputs, all propose-only [D72, D73],
all emitted as Signals/drafts by the lane's agent (E-I):
- **Brief-from-what-wins at intake, every lane.** The D40 application extended from the video lane
  to all lanes: the intake form's brief draft cites the asset type's active rules and top-3
  performers (by the goal metric, same cohort rules as workflow 1) plus any subscribed Signal from
  another lane (e.g. the Social agent's gated-CTA contrast on Snippets). Lanes without DNA render the
  owned empty, never a fabricated rule.
- **24h anomaly nudge, edit vs distribution separated.** At the Day-1 capture the readout is split
  into its edit lines and its distribution lines [D15]; the edit lines go to the editor (the D47 DM),
  the distribution lines go to the distribution owner (social manager / channel owner) as a nudge.
  The Manifest Love reel is the worked example: "both collab invites Pending at capture" → Glen;
  "8s vs 5s avg watch" → Yuthika.
- **Next-week suggestions for empty slots.** For each thin day in the coming comms week (14–20 Sep:
  Tue, Thu–Sun), the Planning agent drafts "what worked in this slot before" from real cohorts,
  marked drafted; a human fills the slot or leaves it an owned empty [D67].

## Boundaries

- Never rank people; no leaderboard anywhere; per-editor views only per D50 [D9].
- Never show a number without source, capture age and n; never mix edit and distribution signals in
  one line; dead token ⇒ "not captured" [D15].
- No readout before 24h; no readout on a proposed (unconfirmed) link [D6, D43].
- No proposal from n < 8 in either quartile, or from a fallback cohort [D12, D33].
- No cross-account or cross-brand learning [D16]; readouts may fall back cross-account only with
  the label [D33].
- The model never chooses the pattern and never produces a number [D37].
- No auto-activation, no auto-deactivation, no editor veto [D39, D41].
- Rules do not feed the clip prompt or a My-work checklist in v1 [D40].
- No adjectives or verdicts in the DM [D47]; no per-editor numbers in the digest [D48].
- Retention in seconds is compared only within the same post type until `durationSec` exists [D34].
- Channels: IG + FB (Perch) in v1; YouTube/TikTok/LinkedIn readouts only once integrated [D11].

## Dependencies

- **E-A** — confirmed Publications with `publicationId` on metric rows; ownership per D21.
- **E-C** — a scheduler that reliably lands the 18–36h and 6.5–7.5-day captures, the Sunday-night
  proposal run and the 24h DM; the Perch mapper fix so views/saves/shares/watch time/post_type/
  collaborators exist as columns.
- **O1** — Gareth's confirmation of the goal map; D36 is applied as written until then.
- The existing `DnaReviewRule` + `lib/dna-review/learn.ts` (generalised into the Knowledge store),
  the existing social-digest cron, the existing Slack DM path (E9.4).
- `AssetType` Team Lead and Sub Lead fields from Airtable (mapping fix in D42).
- `DISTILL_MODEL` = `claude-haiku-4-5` configured server-side.
- **E-I** — the Signal table, the lane agents that emit the anomaly nudge and next-week suggestions,
  and the subscribed cross-lane Signals cited in brief drafts [D81, D82].
- The comms calendar (Airtable 🗓️, read) for the coming week's slots [D67].

## Success Criteria

- ≥ 10 DNA rules activated from numeric proposals within 60 days of release, with ≤ 30% of
  proposals rejected by leads [D14].
- On the worked example, the day-1 readout for #11057 reproduces: views 3,725 vs 9,735 (n=21);
  reach 2,835 vs ~7,900; ER 1.52% vs 1.9%; saves 16 vs 31; comments 9 vs 20; avg watch 8s vs 5s
  (n=15); one distribution line about both collaborators Pending.
- 100% of displayed numbers carry source, capture age and n (snapshot test on every surface).
- 0 proposals generated with n < 8 in either quartile, or from a fallback cohort (query on the
  Knowledge store's evidence field).
- 0 numbers in any proposal statement/rationale that do not appear in its evidence (string check
  at generation time; a mismatch fails the run).
- The 24h DM is exactly 5 lines, contains no adjective from a maintained blocklist, and is sent
  only to the ticket's editor.
- The Monday digest contains no employee name in a metric row.
- Every active rule has an activator recorded; every contested flag has a reversing delta with n ≥ 8.
- On the Manifest Love reel the Day-1 anomaly produces two nudges: the distribution line ("both
  collab invites Pending") to the social manager and the edit line ("8s vs 5s avg watch") to the
  editor; no nudge contains a line of the other kind (test over the nudge payloads) [D81].
- Every intake in every lane renders a brief draft section; for an asset type with 0 active rules
  it renders the owned empty and 0 rule text (snapshot over all lanes) [D81].
- For each thin day 14–20 Sep the suggestion cites ≥ 1 real publication id and is labelled drafted;
  0 comms-day slots are written by the system (query) [D67, D81].

## Features

In build order [D7]:

1. Cohort + goal-map service (D32–D36) with fallback labelling (D33) and "collecting (k/8)" (D12).
2. Ticket performance band (readout, edit vs distribution signals, proposal endorse/dispute).
3. Knowledge store: generalise `DnaReviewRule`; fold in `ClipRule` and `Learning`; scope
   `{lane, assetType, channel, owner}`; record activator.
4. Sunday proposal generator (deterministic split + template phrasing, ≤ 3, deduped).
5. Endorse/dispute with required dispute reason; Team Lead OR Sub Lead activation (mapping fix).
6. "My work" page incl. compare-two-of-my-edits and unpublished/unmatched deliveries (D49, D50).
7. 24h Slack DM (5 lines, per-asset-type template) (D47).
8. Monday digest extension (D48).
9. Rule application in DNA review at `Review` and in the intake brief draft (D40).
10. Weekly re-score + *contested* flag (D41).
11. **Brief-from-what-wins at intake for every lane** — extend feature 9's brief draft to all lanes;
    active rules + top-3 performers + subscribed cross-lane Signals; owned empty where a lane has no
    DNA (design first) (D40, D64, D81).
12. **24h anomaly nudge** — split the Day-1 readout into edit and distribution lines; route edit
    lines to the editor via the D47 DM and distribution lines to the distribution owner as a
    separate nudge; Manifest Love as the fixture (D15, D81).
13. **Next-week suggestions** — for each thin comms-day slot in the coming week, a drafted "what
    worked in this slot before" from real cohorts, on the Vishen / Gareth / Glen desks (D67, D81).

[UNRESOLVED] Two definitions D81 leaves open: (a) what counts as an *anomaly* at 24h — a
deterministic flag (collab Pending, "not reported by this platform") is clear, but the numeric
threshold that makes a below-median goal metric nudge-worthy (bottom quartile? below median with
n ≥ 8?) is not decided; (b) the *slot cohort* for next-week suggestions — which of weekday × lane ×
brand × account × post type define "this slot", and whether the n ≥ 8 floor of D12 applies before
a suggestion may be drafted.

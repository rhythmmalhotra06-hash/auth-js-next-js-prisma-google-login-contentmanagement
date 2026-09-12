---
title: 'E-B · Continuous learning engine — first loop: editor + asset-type DNA'
slug: 'continuous-learning-engine'
scope: epic
status: resolved
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-12
resolution: 7/7
---

# E-B · Continuous learning engine — first loop: editor + asset-type DNA

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§2, §4; decisions
> D2–D9, D12, D14, D15, D17, D32–D42, D47–D50). This is the most fully decided epic in the plan;
> the sections below write those decisions out. **Extended 2026-09-11** with the proactive
> intelligence of §5b D81 (brief-from-what-wins at intake for every lane, the 24h anomaly nudge,
> next-week suggestions); the extension re-opened Features, so the epic returned to `discovery`.
> No code until the real-data prototype is approved [D23].

> **Extended 2026-09-12** with the rev-4 decisions (plan §5d, §6): **D105** cohort rules, **D106**
> rule lifecycle, **D115** measurement, **D127** the deterministic half of the engine in slice 1,
> **D128** what slice 2 carries. Transcription only — no new decisions [D129]. The two definitions
> the Features marker left open on 2026-09-11 are **now answered** by decisions taken in §5c: the
> anomaly threshold by **D86** and the slot cohort by the Planning agent's check **L4**, so Features
> returns to resolved and the epic to `resolved` (7/7).

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
- **The four cohort rules that make a median honest** [D105], applied everywhere a cohort is
  computed — readouts, proposals, anomalies, slot suggestions, agent checks (E-I):
  1. **Exclude the post itself** from its own median. A post is never part of the number it is
     being compared against.
  2. **Organic only.** Boosted and paid posts are excluded, identified by Hootsuite tag or
     ad-account origin, so an editor is never measured against spend.
  3. **Rolling 90 days from that post's own publish date** — not from today, so a readout computed
     later does not silently change its own peer set.
  4. **No median at all under n = 3**, not even a fallback cohort. Below three peers the surface
     shows the asset's own numbers and "collecting (k/8)", never a comparison [D12, D33].
  The n ≥ 8 floor of D12/D33 continues to govern *proposals*; n ≥ 3 is the floor below which **no
  median is shown at all**.
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
- **Activation is forward-only** [D106]: activating a rule never flags tickets already at `Review`.
  A rule applies from its activation timestamp onward, so no editor's finished work is retroactively
  marked non-compliant.

**5. Rule lifecycle** [D106, D41] — four behaviours, all of them non-destructive:
- **Forward-only activation** (above).
- **Editing an active rule creates version n+1**, and the old version is retained. Past DNA reviews
  keep citing the version they actually applied, so a review from three weeks ago still reads as it
  did when the editor received it.
- **Two active rules whose evidence points opposite ways surface as a conflict** on the asset type,
  for the lead to resolve. The system does not pick a winner and does not suppress either rule.
- **Weekly re-score** [D41]: every active rule is re-scored against the last 90 days; if the delta
  flips sign with n ≥ 8 the rule is flagged *contested* to the lead. It is never auto-deactivated —
  but a **contested rule nobody acts on for 4 weeks auto-archives, carrying its evidence with it**
  [D106]. Archiving is the one automatic state change in the lifecycle: it removes the rule from
  application without deleting it or its history, and it happens only after four weeks of a human
  seeing the contested flag and doing nothing.

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

**8. Measuring the engine itself** [D115] — the success criteria below are not estimates; each is a
query over columns this epic and E-A write.

- Every Publication is stamped with **`linkedAt` and `linkTier`** when it is linked (E-A, D115).
- A **nightly coverage snapshot** records, per account and per lane, posts published, posts linked,
  and the split by tier. It lands in the existing `MetricSnapshot` table under the key `v2_coverage`
  — additive, nothing else reads it [plan §6.6].
- **"Within 24h" is defined as `linkedAt − posted_at ≤ 24h`**, measured **only on posts that have a
  Social record**. A post with no Social record was never ticketed work, so counting it would
  measure the social team's record-keeping rather than the matcher [D115].
- The **two 60-day numbers** of D14 — attribution coverage ≥ 80% within 24h, and ≥ 10 rules
  activated from numeric proposals with ≤ 30% rejected — are displayed on **Connections & data
  health** (E-C), with the **baseline captured the day slice 1 ships** so that improvement is
  measured from a stamped starting point, not from memory [D115].
- **Rule acceptance comes from the Knowledge store's status history** — proposed → endorsed/disputed
  → activated/rejected → contested/archived — not from a separate counter [D115, D106].

**9. What lands when** [D127, D128] — this epic ships in two slices, and the split is by *what needs
a model*, not by surface.

| | Contents | Constraints |
|---|---|---|
| **Slice 1** | The **deterministic half**: cohort maths (workflow 1 with D105's four rules), edit-vs-distribution separation, the gated-CTA / collab / caption-length contrasts at n ≥ 8, the `Signal` table and the seven Signal kinds (E-I, D120), the coverage snapshot. Pure SQL/TS — it is the prototype's `derive.py` ported to TypeScript. | **No Haiku, no Slack, no writes to existing tables** [D127]. The preview link therefore shows a real Signal on a real ticket, not only a coverage number. |
| **Slice 2** | The **Knowledge store**, the endorse / dispute / activate UI, **Haiku phrasing** [D37] and the **24h Slack nudge** [D47]. | This is where the cost ceiling [D88] and the propose-only ladder [D73] first bite [D128]. |
| Slice 3 | Brief-from-what-wins (capability #2) and prioritisation learning (capability #3, which needs the widened `TicketEvent` of D94) [D128]. | First cut (E12) and the conversational layer (capability #5) stay on their own tracks. |

## Boundaries

- Never rank people; no leaderboard anywhere; per-editor views only per D50 [D9].
- Never show a number without source, capture age and n; never mix edit and distribution signals in
  one line; dead token ⇒ "not captured" [D15].
- No readout before 24h; no readout on a proposed (unconfirmed) link [D6, D43].
- No proposal from n < 8 in either quartile, or from a fallback cohort [D12, D33].
- **No median under n = 3**, anywhere, fallback included; no post in its own cohort; no paid or
  boosted post in an organic cohort; no cohort window measured from today rather than from the
  post's own publish date [D105].
- **No retroactive rule application** — activating a rule never flags work already at `Review`
  [D106]. No rule is edited in place: an edit is version n+1 and the old version is retained [D106].
- No automatic resolution of a rule conflict, and no auto-deactivation. The single automatic state
  change is the 4-week auto-archive of an unattended *contested* rule [D106, D41].
- **Slice 1 runs no model and sends no Slack**, and writes to no existing table [D127, D122].
- No cross-account or cross-brand learning [D16]; readouts may fall back cross-account only with
  the label [D33].
- The model never chooses the pattern and never produces a number [D37].
- No auto-activation, no auto-deactivation, no editor veto [D39, D41].
- Rules do not feed the clip prompt or a My-work checklist in v1 [D40].
- No adjectives or verdicts in the DM [D47]; no per-editor numbers in the digest [D48].
- Retention in seconds is compared only within the same post type until `durationSec` exists [D34].
- Channels: IG + FB (Perch) in v1; YouTube/TikTok/LinkedIn readouts only once integrated [D11].

## Dependencies

- **E-A** — confirmed Publications with `publicationId` on metric rows; ownership per D21; the
  `linkedAt` / `linkTier` stamps every measurement in workflow 8 reads [D115]; the D101 identity
  rules (cross-posts as separate rows, stories excluded, orphans as peers) that decide what a cohort
  contains; the D119 retention set, which is why day-1/7/30 evidence can still be re-read years
  later while a rule is re-scored.
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
- **Cohort integrity** [D105]: 0 cohorts contain their own subject; 0 cohorts contain a post tagged
  boosted/paid or originating from an ad account; every cohort's window starts 90 days before its
  subject's `posted_at`; 0 medians rendered with n < 3 (query over rendered readouts).
- **Lifecycle integrity** [D106]: 0 tickets already at `Review` gain a flag from a rule activated
  after they got there; every edited rule has a retained predecessor version and every past review
  cites the version it applied; every asset type with two opposed active rules shows a conflict;
  every rule *contested* for > 4 weeks with no human action is archived with its evidence attached,
  and 0 rules are deactivated any other way.
- **Measurement is queryable, not asserted** [D115]: `linkedAt` and `linkTier` are non-null on 100%
  of linked Publications; the nightly `v2_coverage` snapshot exists for every day since slice 1
  shipped; the baseline row carries the ship date; the "within 24h" figure recomputes from
  `linkedAt − posted_at ≤ 24h` over posts with a Social record and matches what Connections shows.
- **Slice 1 is model-free** [D127]: token count of the slice-1 checks is 0 on every run; 0 Slack
  messages are sent by slice-1 code; a diff of tables written by slice 1 contains only `publications`,
  `signals`, the new nullable `social_metrics` columns and `MetricSnapshot` [D122].

## Features

In build order [D7]. Features 1 and 14 are **slice 1** (deterministic, no model, no Slack); features
3, 5, 7 are **slice 2**; features 9 and 11 are **slice 3** [D127, D128].

1. Cohort + goal-map service (D32–D36) with D105's four cohort rules, fallback labelling (D33),
   "collecting (k/8)" (D12) and no median under n = 3 (D105).
2. Ticket performance band (readout, edit vs distribution signals, proposal endorse/dispute).
3. Knowledge store: generalise `DnaReviewRule`; fold in `ClipRule` and `Learning`; scope
   `{lane, assetType, channel, owner}`; record activator.
4. Sunday proposal generator (deterministic split + template phrasing, ≤ 3, deduped).
5. Endorse/dispute with required dispute reason; Team Lead OR Sub Lead activation (mapping fix).
6. "My work" page incl. compare-two-of-my-edits and unpublished/unmatched deliveries (D49, D50).
7. 24h Slack DM (5 lines, per-asset-type template) (D47).
8. Monday digest extension (D48).
9. Rule application in DNA review at `Review` and in the intake brief draft (D40).
10. Weekly re-score + *contested* flag (D41), rule versioning (edit → version n+1, predecessors
    retained), conflict surfacing on the asset type, and the 4-week auto-archive of an unattended
    contested rule (D106).
11. **Brief-from-what-wins at intake for every lane** — extend feature 9's brief draft to all lanes;
    active rules + top-3 performers + subscribed cross-lane Signals; owned empty where a lane has no
    DNA (design first) (D40, D64, D81).
12. **24h anomaly nudge** — split the Day-1 readout into edit and distribution lines; route edit
    lines to the editor via the D47 DM and distribution lines to the distribution owner as a
    separate nudge; Manifest Love as the fixture (D15, D81).
13. **Next-week suggestions** — for each thin comms-day slot in the coming week, a drafted "what
    worked in this slot before" from real cohorts, on the Vishen / Gareth / Glen desks (D67, D81).
14. **Measurement plumbing** — `linkedAt` / `linkTier` read paths, the nightly `v2_coverage`
    snapshot, the stamped baseline, and the two 60-day numbers rendered on Connections & data health
    (D115).

**The two definitions the 2026-09-11 marker left open are now answered**, both by decisions in plan
§5c, so this section is resolved:

- **(a) What counts as an anomaly at 24h.** **D86**: the goal metric is **below 50% of the same-age
  cohort median at day 1, with n ≥ 8** → nudge. The deterministic flags (collab invites Pending,
  "not reported by this platform") continue to fire regardless of the numeric test, as distribution
  or data-quality lines rather than anomalies.
- **(b) The slot cohort for next-week suggestions.** The Planning agent's check **L4** (plan §5c):
  a slot is **weekday × post type × pillar**, and the floor for drafting a suggestion is **n ≥ 3**,
  not the n ≥ 8 of D12 — consistent with D105, which forbids a median under n = 3 but does not
  require eight. Suggestions are drafts for a human to accept, not proposals into the Knowledge
  store, which is why they sit at the lower floor.

---
title: 'E-I · Team agents & the Signal bus'
slug: 'team-agents-and-signal-bus'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-11
updated: 2026-09-12
resolution: 5/7
---

# E-I · Team agents & the Signal bus

> Part of [Content Studio v2](../content-studio-v2.md)

> Created 2026-09-11 from `plans/i-want-to-reimagine-velvety-falcon.md` §5 (D56) and §5b (D69–D84,
> the six-agent table, the three hand-offs, the rev-3 prototype changes). Decision IDs are kept in
> brackets so every line traces to a decision; nothing here is a new decision. No code until the
> real-data prototype is approved by Rhythm [D23]; the prototype rev 3 *is* this epic on real data.

> **Extended 2026-09-12** with plan §5c and §5d: **D85–D92** (thresholds, nudge policy, cost
> ceiling, cadence, recipients), the **six agent contracts** written out as Features under the
> twelve-row contract template, the as-is findings **D93–D100** that change what the contracts may
> assume, **D103** Signal lifecycle and **D120** the closed vocabulary of seven Signal kinds.
> Transcription only — no new decisions [D129]. The deterministic half of this epic — the `Signal`
> table, the seven kinds, and every check that needs no model — ships in **slice 1**; drafting,
> nudging and approval in **slice 2** [D127, D128].

## Purpose

Every content team now has a system that can see its own work and its own numbers (E-A, E-B) — but
the finding that matters most usually belongs to a *different* team. The pending collab invites on
the Manifest Love reel are a distribution fact the social team owns, and an edit fact the video team
needs to stop being blamed for; a shoot Vishen has not recorded is a production fact that becomes a
planning blocker two desks away; the Wednesday newsletter and the Wednesday reels carrying different
messages is a fact nobody sees because email and social look at different tables. Today those
hand-offs happen in Slack, by memory, or not at all.

**One agent per team, all on the same content graph** [D70]: **Video** (Titus) · **Social** (Glen +
Vidura) · **Email & VL channels** (Ramya) · **Production** (Nadir) · **Design** (Chee) ·
**Planning** (Vishen / Gareth / Marisha — MOW, day-by-day, learnings, next week, roles → results).
Each agent observes only its team's part of the graph and never acts on another team's data
directly [D70].

**Agents talk through the graph, not to each other** [D71]. An agent that finds something writes a
typed **Signal** on the item it is about; other agents subscribe to Signals by kind and lane; every
human sees every Signal in the item's thread [D77]. Why through the graph rather than agent-to-agent
calls: the hand-off is then *a record on the item* — auditable, visible to the people who own the
item, and answerable ("acted" / "dismissed") — instead of a hidden message between two processes.
Coordination state lives in two shared places only: the Knowledge store (E-B) and the Signal table
[D70, D82, D83]. There is no per-agent memory outside the graph [D83].

What the agents are allowed to do is fixed for six months: **propose only** on every content, rule
or plan decision, with a short, reversible bookkeeping exception [D72, D73]. What makes an agent good
is fixed too: the acceptance rate of its proposals, and its cost and latency [D74].

## User Stories

One story per persona in the org brief [D56], naming what their team's agent does for them
(six-agent table, plan §5b).

**Vishen (CEO) — reads the Planning agent, decides nothing new.** His desk's *Next week* shows the
Production agent's blocker "planned Mon/Tue releases 14–15 Sep have no footage" the moment 15 shoots
are still *To Film* past their filming date — his own recurring blocker, surfaced before Monday, not
after [D81 hand-off 2, D65]. Every draft on his desk wears "drafted by system"; nothing on it was
committed by a machine [D72].

**Gareth (owner of all content going out).** The Planning agent drafts the Monday pack (staged only;
Gareth, Glen or Ramya commit) and writes the honest empty "no plan item cites a learning yet" until
one does [D70, D72]. Its *Blockers* block carries the Production agent's not-filmed Signal. The Video
agent's first-cut drafts (E12 flow, propose-only) appear for review with acceptance rate shown as
"collecting" [D61].

**Marisha (head of marketing channels).** The Planning agent keeps two MOWs (MV, VL) apart, fills the
roles → results table (slot · owner · this week's goal metric where data exists; undefined results
are her owned empties, never sortable across people) [D60], and nudges her review lane when a clip
waits at `Review - Marisha/Gareth` [D72].

**Ramya (email + all VL channels via agencies).** The Email & VL channels agent compares the week's
email cadence with the MOW message, counts her two data chores (256 undated VL assets · 1 publish
link on 107 released), sets Live Date automatically when an agency pastes a publish link
(bookkeeping, D72), and emits "email and social on the same day carry different messages" as a
*watch* on the comms day — by her own rule never as a fault [D81 hand-off 3]. Her "active users
gained" slot renders "needs a Metabase question · Rafi/Ramya" until it is defined [D62].

**Glen (Mindvalley social channels, writes the weekly report by hand).** The Social agent runs the
matcher tiers and auto-links publications at the auto tiers [D43, D72], computes cohorts and the
gated-CTA / collab / posting-time contrasts, drafts his report sections as locked-number tokens he
edits ("drafted by system" → "edited by Glen") [D66], keeps the unticketed list and coverage % [D45],
and emits "distribution signal: collab pending" so the editor is not judged on it [D15].

**Titus (video team lead, owns DNA per asset type).** The Video agent computes day-1/7 readouts vs
cohort for his team's publications, proposes DNA rules at n ≥ 8 (E-B), drafts briefs at intake
citing what wins — including the Social agent's gated-CTA finding on the Snippets asset type — and
drafts first cuts and sub-task checklists [D80, D81 hand-off 1]. He activates or rejects; the agent
never activates [D42, D73].

**Chee (design requests lead).** The Design agent nudges on queue ageing (70-day tickets) and emits
the owned empty "design asset types have no DNA yet — Chee + Vanessa/Haley/Ziga" with first proposed
types; banner CTR/CVR learnings come later, once the banner lane exists [D64, O7].

**Nadir (production: shoots, raw files, post-production, podcast).** The Production agent watches
pipeline ages, flags filmed-without-handoff and planned slots without footage, proposes
post-production tickets when raw files land, and nudges the podcast inbox New → Transcribing →
Clips suggested → tickets → first cut [D65]. Its not-filmed Signal is what reaches Vishen and Gareth.

**Editors (Yuthika Peiris, Jason Roper).** The Video agent attaches the day-1 readout to the ticket
(bookkeeping, D72), sends the 24h DM with edit and distribution lines separated [D47], and drafts a
sub-task checklist from the lead's free-text instruction plus the asset type's DNA — the editor
confirms it [D80]. Her "what I'll improve next upload" note feeds Glen's block as a human line, not an
agent one [D66].

**Agencies (Rise Voice, Talking Heads, Two Comma PR).** No agent of their own. The Email & VL
channels agent's bookkeeping on their items (Live Date set from a pasted publish link) and its
Signals about their items (publish-link gap, delivery vs plan) are visible in the item threads they
can see — own items only, cohort as an anonymous account median [D54, D58]. Which agent the "Your
agent" block shows on an agency desk is open — see Features.

## Workflows

**1. The loop every agent runs: observe → Signal → subscribe → draft → human decides** [D70–D72,
D82]

1. **Observe** — one scheduled runner per agent (on the real scheduler, O6) executes deterministic
   SQL/TS over the graph: readouts vs cohort, matcher tiers, pipeline ages, plan vs live. **No LLM in
   observe** [D82]. Every observation must satisfy the invariants of D15: source, capture age and n.
2. **Signal** — when an observation crosses the team's rule (e.g. n ≥ 8 contrast, filming date past,
   Live Date missing), the agent writes a Signal row on the subject node (below). The Signal is
   appended to the item's thread [D77] and is visible to every human who can see the item.
3. **Subscribe** — other agents pick up Signals by `kind` and `lane` on their next run. Subscription
   is a read of the Signal table; there is no call from one agent to another [D71].
4. **Draft** — where a Signal calls for content, the agent drafts it (brief, caption, report section,
   first cut, learning, checklist, next-week suggestion). Numbers are fixed by the deterministic step;
   `claude-haiku-4-5` (`DISTILL_MODEL`) only phrases the template around them [D37, D82]. Every draft
   is labelled **"drafted by system"** and is never committed [D72].
5. **Nudge** — if a Signal needs a decision, the agent sends a Slack DM or folds it into the digest
   (the existing paths, D47/D48) naming the suggested owner [D72].
6. **Human decides** — the owner acknowledges, acts (accept / edit / commit) or dismisses in the
   thread; the Signal's `status` moves accordingly and the decision is what feeds acceptance rate
   [D74].

**2. The Signal record** [D71, D82] — the union of the two decisions, persisted in a `Signal` table:

| Field | Meaning |
|---|---|
| `subject_type`, `subject_id` | the graph node it is about — Ticket, Publication, Asset, AssetType, Shoot, MediaSource, CommsDay |
| `lane` | video · social · email · podcast · shoots · design · planning |
| `kind` | typed; what subscribers filter on |
| `evidence` (JSON) | `refs[]` (publication/ticket ids), `n`, `delta`, source + capture age per number |
| `confidence` | from the deterministic step, never phrased |
| `suggested_owner` | Employee or role (e.g. "caption owner", "Ramya · Glen") |
| `proposed_action` | what accepting it would do (change the brief · add a blocker · set a watch) |
| `from_agent`, `to_agents[]` | emitter and intended subscribers |
| `status` | `open` → `acknowledged` → `acted` \| `dismissed` \| `resolved` [D103] |
| `thread_id` | the work-item or version thread it is appended to [D77] |
| `dismissed_reason` | required on dismissal; suppresses that check on that subject for 30 days [D103] |
| `resolved_by` | `data` (the condition stopped holding) or the email of the person who acted [D103] |

**2b. The seven Signal kinds — a closed vocabulary** [D120]. Subscribers filter on `kind`, so the
list is deliberately short and adding one is a schema change, not a configuration change.

| Kind | Means | Typical subject |
|---|---|---|
| `learning` | a pattern, n ≥ 8 | AssetType, Channel |
| `anomaly` | one item far off its cohort | Publication, Ticket |
| `blocker` | work cannot proceed | Ticket, Shoot, CommsDay |
| `chore` | data a human must supply | Ticket, Publication, VL asset, email |
| `watch` | might be fine, might not | CommsDay, AssetType |
| `gap` | a missing capability — no DNA, no metric source | AssetType, Channel |
| `suggestion` | a drafted item for a plan | CommsDay slot |

This replaces the descriptive names the three hand-offs used before the vocabulary was closed: the
gated-CTA contrast is a `learning`, the planned-slot-without-footage is a `blocker`, and the
message-alignment finding is a `watch`. What used to distinguish them — *which* check fired — is
carried by `check_id` in the natural key below, not by inventing a kind.

**2c. Signal lifecycle** [D103]:

- **Natural key = `agent + check id + subject node (+ period)`.** A re-run **updates** the open
  Signal; it never creates a second one. Running the checks twice in a row leaves the same number of
  rows, with a newer `updated_at`.
- **A Signal auto-closes when its condition stops holding**, logged as *resolved by data*
  (`resolved_by = data`). Nobody has to tidy up a Signal that fixed itself — the collab invite was
  accepted, the raw files were pasted, the shoot was filmed.
- **Dismissal requires a reason**, and dismissing **suppresses that check on that subject for 30
  days**. This is what stops an agent re-raising something a human has already judged not worth
  acting on, without silencing the check everywhere.
- **Agents act as a system actor**, not as an `Employee` row [D103]. No agent write is ever
  attributed to a person, and offboarding a person never orphans or reassigns agent history.

**3. The three hand-offs — worked examples on real items** [D81, plan §5b]

*Social → Video (finding → brief).* The Social agent's Sunday run contrasts gated-CTA reels vs the
rest on @mindvalley (n=24): first-day views −27%, comments +52%. It writes a Signal of kind
**`learning`** (check S3) on the **Pathway Organic – Snippets** asset type, `to_agents: [video]`,
suggested owner: caption owner, proposed action: cite in brief. The Video agent's next brief draft
for a Snippets ticket cites it under "what wins" (rule + top-3 performers, editable, D40). Titus
sees it in the brief; the Signal and the brief draft both sit in the thread on ticket #11057.

*Production → Planning → Vishen (footage gap → blocker).* The Production agent finds 15 shoots still
*To Film* with filming dates ≤ 10 Sep. It writes a Signal of kind **`blocker`** (check P4) on
the comms days 14–15 Sep, `to_agents: [planning]`, owner Nadir → Vishen. The Planning agent's run
adds the blocker to Vishen's *Next week* ("Not yet recorded") and to Gareth's *Blockers*; nothing is
rescheduled by a machine.

*Email → Social (message alignment watch).* The Email & VL agent compares Wed 9 Sep's newsletter
("What's the one thing you're truly the best in the world at?") with the day's three Pathway reels
and finds different messages. It writes a Signal of kind **`watch`** (check E2) on the comms day,
`to_agents: [social, planning]`, owner "Ramya · Glen" — by Ramya's own
rule this is not a misalignment until a human says so. The Social agent shows it on Glen's desk; the
Planning agent lists it under the day; nobody's report calls it a fault.

**4. Autonomy at launch** [D72] — three verbs and one exception:

- **Observe / compute / post Signals** — always.
- **Draft** — briefs, captions, report sections, first cuts, learnings, checklists, next-week
  suggestions; always "drafted by system", never committed.
- **Nudge** — Slack DM or digest when a Signal needs a decision.
- **Bookkeeping actions only**, taken without asking: auto-link publications at the auto tiers (URL /
  `platform_post_id`, caption overlap ≥ 80 chars — D43); set Live Date from a pasted publish link;
  attach the first-day readout to the ticket. Each is reversible, logged as a `TicketEvent`/Signal,
  and involves no content judgement.

**5. The trust ladder** [D73] — **fixed for six months: propose-only** on every content, rule or plan
decision. The bookkeeping actions in D72 are the sole exception. The ladder re-opens in **March
2027**, per agent × action type, only where (a) acceptance ≥ 80% over the last 30 decisions and
(b) the owning lead flips the switch. Until then no configuration, flag or per-user setting can
grant an agent more autonomy.

**6. Agent quality** [D74] — two measures, both per agent, both visible on the "Your agent" block:

- **Acceptance rate** = accepted ÷ (accepted + rejected), per action type (brief · caption · rule
  proposal · report section · first cut · checklist · suggestion · nudge), rolling 30 days.
  Dismissed-without-reason counts as rejected; open/acknowledged counts in neither.
- **Cost and latency** = tokens spent and seconds from Signal to draft, per agent per run.

Endorse/dispute counts and outcome lift are *learning* signals (E-B), not quality measures [D74].

**7. Cadence — when each runner fires** [D89]:

| Agents | Cadence |
|---|---|
| Social, Video, Email & VL channels | **daily, after the Perch pull** (~04:00 UTC / 12:00 MYT) — they have nothing new to say before the day's capture lands |
| Production, Design | **hourly** — their subjects are pipeline ages and unassigned work, which change through the day |
| Planning | **Sunday night** (the Monday pack) + a **Thursday pre-pass** (next-week suggestions, while there is still time to fill a slot) |

**8. Default thresholds** [D86] — the two that are decided, stated once here and reused by every
contract:

- **Anomaly**: goal metric **< 50% of the same-age cohort median at day 1, with n ≥ 8** → nudge.
- **Stuck work**: In Progress **> 14 days (video) / > 21 days (design)** with **no status event** →
  `blocker`. Note D93: tickets have no transition graph, so "stuck" is defined on **time since the
  last `TicketEvent`**, never on a missing transition.

Two thresholds are deliberately left to their owners and are marked in Features: the footage-risk
threshold (Nadir, O11) and the attribution-coverage threshold (Glen, O12) [D86].

**9. Nudge policy** [D87] — the same for every agent, so no agent can become the noisy one:

- **Once per Signal.**
- **Re-nudge after 3 working days if it is still open**, at most **2 re-nudges**.
- **Everything else bundles into the Monday digest** [D48].

**10. Recipients** [D92]: Slack goes to **owners and leads only** — editors, Glen, Vidura, Ramya,
Titus, Chee, Nadir, Gareth, Marisha. **Vishen is never paged; his desk is the channel.** An agent
that computes something for Vishen writes it to his desk and stops there.

**11. Cost ceiling** [D88]: **≤ $5 per agent per week.** Only Haiku phrasing counts — the observe
step is deterministic and free [D82]. On reaching the ceiling the agent **hard-stops drafting**,
keeps observing and emitting Signals, and emits a `gap` Signal "budget reached" to **Rhythm**.

**12. What the as-is map forbids the contracts from assuming** [D93–D100]. Each of these is a fact
about the system as it runs today, and each changes a contract:

| # | As-is fact | Consequence for the agents |
|---|---|---|
| D93 | Tickets have **no transition graph** — `updateTicket` accepts any of the 13 ticket statuses × 6 prio statuses from any state; the only enforced edge is the DNA gate on → Approved. `GATED_STATUSES=['Shipping']` is declared and used nowhere. | Agents must not assume ordered stages. "Stuck" is time since the last `TicketEvent` [D86]. The v2 publication states [D75, D76] are the **first ordered machine** and live on the **Publication**, not the ticket. |
| D94 | `prioStatus`, assignee and `queueRank` changes **write no `TicketEvent`**; only `ticketStatus` does. | Prioritisation learning and the Video agent's re-rank signal need the widened event log first. Until it exists the agents observe **status only** [D128, slice 3]. |
| D95 | Vishen's `approveContentReview` **bypasses the DNA gate**, as do `requestApproval` / `decideApproval`. | The Video agent emits a `watch` when a ticket reaches Approved with a flag-severity finding still open; the v2 build closes the bypass. |
| D96 | The app knows **4 of the 16 📣 Social statuses**; `Copy Request` / `Copy Ready` / `Scheduled` / `Released` exist only in Airtable. Portal-raised tickets use *Video Team – Non Campaign*, checkbox-raised use *Campaign [Events, etc]*. | The Social agent reads the **full 16-status vocabulary from the field map** before emitting any copy-stage or scheduling Signal. The team-service-level divergence is a defect, fixed by D107 (E-D). |
| D97 | `MowSlot` `shipped / missed / blocked` **have no writer** — only `planned` is ever set. | The Planning agent is the **first writer** of those states, as bookkeeping derived from the matcher's "went live". `blocked ≠ missed` becomes real rather than a schema comment. |
| D98 | **Emails have no code at all** — no table constant, no stage enum, no read path; `COMMS_DAY.noOfEmails` disagrees with the `emails` link in practice. | The Email & VL agent's **first job** is to read 📧 Emails through a new field-map block; check E1 is the first Signal it can emit. |
| D99 | **"Accept → Final Pass" exists only in the PRD/plan.** `Final Pass` is a live status used for grouping; acceptance events are in-memory. | The first-cut contract is honest as written ("mock render, history not persisted"); a durable `AcceptanceEvent` must exist **before any acceptance rate is shown** [D74]. |
| D100 | **Notification backends disagree** — the Airtable path fires "asset ready" on `Done` + folder link, the Postgres path on any delivery link. Vishen's Clips `Review – Marisha/Gareth → … → Done` is human-only in Airtable and invisible to the app. | Agents **read** Marisha's approval lane from Airtable status and **never write it**; Production and Video treat "asset ready" as the **Postgres** definition (any delivery link). |

[UNRESOLVED] Signal retention — whether Signal rows are kept forever as part of the decision log or
archived after N days. D103 settles the lifecycle (update, auto-close, 30-day dismissal suppression)
but not how long a closed Signal is kept; the plan notes only that "Signals are cheap; threads are
the audit trail" — owner: Rhythm (O15).

## Boundaries

- **No agent-to-agent calls.** Coordination is only through Signal rows and the Knowledge store; a
  runner never invokes another runner [D71].
- **No hidden state.** Each agent reads/writes Knowledge scoped to its lane plus the shared graph;
  nothing is remembered anywhere else — no per-agent memory file, vector store or scratch table
  [D83].
- **No LLM in observe.** Observation is deterministic SQL/TS; the model phrases only, with numbers
  fixed, and never chooses the pattern [D37, D82].
- **No commits by agents** on content, rules or plans for six months (to March 2027): no activated
  rule, no committed learning, no published caption, no scheduled post, no re-ranked queue, no
  reassigned ticket [D73]. Bookkeeping per D72 is the only autonomous write.
- **No action on another team's data.** The Social agent does not write on a video ticket; it writes
  a Signal the Video agent may read [D70].
- **No ranking of people** — no agent output orders, scores or compares editors, designers or agency
  staff; aggregates by asset type / channel / campaign only [D9, D60].
- **No Ask box and no Agents registry screen in v1.** Agents appear as a "Your agent" block on each
  desk and as Signals inside item threads — nowhere else [D78].
- **No number without source, capture age and n; edit and distribution signals never mixed in one
  line; dead token ⇒ "not captured"** [D15] — applies to every Signal and every draft.
- **No first-cut render** is produced by the agent in v1; the first-cut draft is EDL-shaped and marked
  *mock render* [D61].
- **No new Signal kind without a schema change.** The vocabulary is the seven of D120; a check that
  does not fit one of them is a check that has not been thought through [D120].
- **No duplicate Signals.** A re-run updates the open row on the natural key; a Signal whose
  condition no longer holds closes itself as *resolved by data* [D103].
- **No dismissal without a reason**, and a dismissal suppresses that check on that subject for 30
  days — an agent may not re-raise it sooner [D103].
- **No agent writes as a person.** Agents are a system actor, never an `Employee` row [D103].
- **Vishen is never paged** by any agent, on any channel, for any Signal [D92].
- **No more than one nudge per Signal plus two re-nudges**; everything else waits for the Monday
  digest [D87].
- **No drafting past $5 per agent per week** — the agent hard-stops and says so [D88].
- **No acceptance rate is displayed before durable acceptance events exist** — today they are
  in-memory [D99].
- **No agent writes Marisha's clip approval lane** or any other Airtable-only human workflow [D100].
- Out of scope entirely: a localisation lane and a broadcasts/notifications lane [D69].

## Dependencies

- **E-A** — `Publication` with `publicationId` on metric rows and the matcher tiers (the Social
  agent's observe step and the auto-link bookkeeping) [D43].
- **E-B** — the Knowledge store generalising `DnaReviewRule` (what agents read and propose into), the
  cohort + goal-map service, the 24h DM and Monday-digest paths that carry nudges [D47, D48].
- **E-C** — one scheduled runner per agent on a real scheduler at the D89 cadences; the current
  GitHub Actions cron (3–11h slip) cannot land day-1 windows or Sunday runs [D82]. O6 is closed:
  the scheduler is an **external cron service** hitting the existing bearer-gated routes, added
  **alongside** GitHub Actions rather than swapped for it [D117].
- **D99** — a durable `AcceptanceEvent` before any acceptance rate is displayed; today acceptance is
  in-memory.
- **Signal table** — new in this epic; migration owned here.
- **E-D** — threads (one timeline per work item and per version, D77) as the surface every Signal is
  appended to; the persona desks that host the "Your agent" block [D57, D78]; the `Comment` model
  from D54 for the human half of a thread.
- `DISTILL_MODEL` = `claude-haiku-4-5` server-side [D37]; token/latency accounting per run [D74].
- Real-data prototype rev 3 approved by Rhythm [D23]; its derived data (`derive.py` over
  `proto_data.json`) is the fixture for the three hand-offs.

## Success Criteria

Phrased so a query or test can verify each.

1. **Acceptance rate visible.** For every agent, the "Your agent" block renders acceptance =
   accepted ÷ (accepted + rejected) per action type over the trailing 30 days, and the figure equals
   a query over Signal/draft statuses for that agent and window; "collecting" appears when the
   denominator is < 1 [D74].
2. **Cost and latency visible.** Every agent run records tokens and seconds-to-draft; the block shows
   both for the trailing 30 days; a run with either missing fails the run [D74].
3. **The three hand-offs are observable in item threads.** On the prototype fixtures and later in
   production data: the Snippets asset-type Signal and the citing brief draft both appear in ticket
   #11057's thread; the not-filmed Signal appears on comms days 14–15 Sep and in Vishen's *Next week*
   and Gareth's *Blockers*; the message-alignment Signal appears on the 9 Sep comms day with
   confidence *watch* and owner "Ramya · Glen" [D81].
4. **Zero unlogged actions.** Every write by an agent — Signal, draft, nudge, bookkeeping — has a row
   (Signal or `TicketEvent`) with `from_agent` set; a diff of agent-authored writes against those
   rows is empty (audit query, run nightly).
5. **Propose-only holds.** 0 rows where an agent activated a rule, committed a learning, changed a
   status other than the three bookkeeping actions, or altered `queue_rank`/assignee, before
   2027-03-01 [D73].
6. **No LLM in observe.** The observe step has no model call (static check on the runner code path;
   token count of the observe phase is 0 on every run) [D82].
7. **No hidden state.** Each agent's reads and writes touch only the graph tables, the Knowledge
   store and the Signal table (allowlist check in the runner) [D83].
8. **Every Signal carries evidence.** 0 Signals with empty `refs`, missing `n` or a number in the
   phrased text absent from `evidence` (string check at draft time, as in E-B) [D15, D37].
9. **Every draft is labelled.** 100% of agent drafts render "drafted by system" until a human edits
   or commits them (snapshot test) [D72].
10. **Nothing ranks people.** No agent output contains a per-person ordering (test over the
    roles → results table and every desk block) [D9, D60].
11. **Signals are idempotent.** Running an agent's checks twice over unchanged data leaves the row
    count unchanged and only `updated_at` newer; 0 pairs of rows share
    `(agent, check_id, subject_type, subject_id, period)` [D103].
12. **Signals close themselves.** For a fixture where a condition is made to stop holding, the
    Signal moves to `resolved` with `resolved_by = data` on the next run, with no human action
    [D103].
13. **Dismissal is reasoned and respected.** 0 dismissed Signals have an empty reason; 0 Signals are
    re-raised for the same check and subject within 30 days of a dismissal [D103].
14. **The vocabulary is closed.** 0 Signal rows carry a `kind` outside the seven of D120 (database
    constraint, not application validation).
15. **Nobody pages Vishen.** 0 Slack messages addressed to Vishen originate from an agent [D92].
16. **Nudge volume is bounded.** No open Signal produces more than 3 DMs in its lifetime (1 + 2
    re-nudges), and none sooner than 3 working days apart [D87].
17. **Cost stays under the ceiling.** Weekly Haiku spend per agent ≤ $5; on reaching it the agent
    stops drafting, keeps observing, and a `gap` Signal "budget reached" reaches Rhythm [D88].
18. **Cadence holds.** Social / Video / Email & VL run after the Perch pull; Production and Design
    hourly; Planning Sunday night and Thursday — verified from run logs against D89.

## Features

In dependency order.

1. **Signal table + one scheduled runner per agent** — migration on the D103 natural key
   `(agent, check_id, subject_type, subject_id, period)`, `kind` constrained to the seven of D120,
   `from_agent`/`to_agents[]`, the status machine including auto-close as *resolved by data*, thread
   append, run accounting (tokens, seconds) [D82, D74, D103, D120]. **Slice 1**, together with every
   check below that needs no model [D127].

### Features 2–7 · The six agent contracts

Each contract fills **every row** of the twelve-row template of plan §5c — "n/a" is an answer,
blank is not. The specifics are decisions, not sketches: where a row is open it carries an
`[UNRESOLVED]` marker with its owner rather than a guess.

#### Feature 2 · Social agent

| | |
|---|---|
| **Agent · owner · decides** | Social agent · owners **Glen** and **Vidura** · they decide every proposal it makes [D70]. First to build, because hand-off 1 starts here. |
| **Runs** | **Daily, after the Perch pull** (~04:00 UTC / 12:00 MYT) [D89]. Reads the day's new captures first, then the publications they belong to. |
| **Inputs** | `social_metrics` including the raw payload (`post_views`, `saved`, `shares`, `comments`, `likes`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `post_type`, `collaborators` + invite status); 📣 Social records — publish link `fldTVU4jMZW3JNswX`, ticket recId `fldZxIaWrFImce9H9`, pillar `fldQO9q4bkX3Mi1kj`, caption `fldCpBMCWeGwmyYpx`, transcript `fldyonJXP12e5Sbv8`, cover attachment — read through the **full 16-status vocabulary** from the field map, not the 4 statuses the app knows today [D96]; Hootsuite tags; Metabase Q31846 / Q32044 (session-side until app-side, O5). Freshness required: a Perch capture inside 36h, else the staleness label travels with every number it emits [D108]. |
| **Checks** | **S1** matcher tiers → auto-link / propose / unmatched [D43]. **S2** cohorts and readouts, cohort per D32 with D105's four rules (exclude self · organic only · rolling 90 days from the subject's own publish date · no median under n = 3). **S3** caption / CTA / collab / posting-time contrasts, **n ≥ 8** → `learning`. **S4** anomaly: goal metric **< 50% of the same-age cohort median at day 1, n ≥ 8** → `anomaly`, with **edit and distribution separated** [D86, D15]. **S5** coverage chores → `chore`. **S6** caption draft **only when the delivery has none** [D91]. **S7** weekly report sections with numbers as locked tokens → draft for Glen [D66]. **S8** campaign table = Hootsuite tag × utm. |
| **Emits** | Kinds: `learning` (AssetType), `anomaly` (Publication), `chore` (Publication / account), `watch` (AssetType) [D120]. Drafts: caption (on the Publication, marked "drafted by system"), report sections (on Glen's report, "drafted by system" → "edited by Glen"). Nudges: Vidura and Glen on pending confirms and coverage, per D87 (once, then ≤ 2 re-nudges at 3 working days, else the Monday digest). The editors' 24h DM is sent by the **Video** agent, not this one [D47]. |
| **Subscribes to** | `delivered` events from Video (a new publication to match) and `cadence-day` from Email & VL (to set the day context for S3's posting-time contrast). It reads them from the Signal table on its next run; it never calls another agent [D71]. |
| **Allowed writes** | Auto-link publications at the **auto tiers only** (URL / `platform_post_id`, caption ≥ 80 normalised chars), stamping `linkedAt` + `linkTier` [D43, D72, D115]; create Publication rows from links; attach readouts. Nothing else. |
| **Forbidden** | Changing any 📣 Social status; scheduling or publishing; editing an editor's caption [D91]; ranking editors [D9]; writing on a video ticket [D70]; paging Vishen [D92]. |
| **Human loop** | Vidura or Glen **confirm PROPOSE-tier matches** [D44] — accepting sets the link to confirmed and releases the readout. Glen **approves report sections**; his edit flips the marker to "edited by Glen" [D66]. `chore` Signals are accepted by whoever owns the missing data; dismissal needs a reason and suppresses for 30 days [D103]. |
| **Failure** | Perch grant dead → **"not captured"** on every readout plus a Signal to Rhythm [D15]. Capture older than 36h → amber "last captured …"; older than 60h → red "not current", and the label propagates into every Signal and DM computed from it [D108]. n < 8 → "collecting (k/8)", no proposal; n < 3 → no median at all [D12, D105]. Unmatched → the post stays a cohort peer and appears in the Unticketed list [D45, D101]. Budget reached → stop drafting captions and report sections, keep matching and observing [D88]. |
| **Quality** | Acceptance per action type (match confirm · caption · report section · learning proposal) over rolling 30 days, plus cost and latency per run; shown on Glen's and Vidura's "Your agent" block [D74, D78]. Acceptance is displayed only once durable acceptance events exist [D99]. |
| **Cost** | ≤ **$5/week** [D88]. Only Haiku phrasing of captions, report sections and proposal statements counts; S1–S5 and S8 are deterministic and free [D82]. |

[UNRESOLVED] S5's threshold — the attribution-coverage level below which a `chore` Signal fires —
owner: Glen (O12).

#### Feature 3 · Video agent

| | |
|---|---|
| **Agent · owner · decides** | Video agent · owner **Titus** (Team Lead **or** Sub Lead of the asset type) · the lead decides every rule proposal [D42, D70]. |
| **Runs** | **Daily, after the Perch pull** [D89], **and** on a ticket reaching `Review` (the DNA-review trigger that already exists). Reads its lanes' tickets first, then the publications of their assets. |
| **Inputs** | `tickets` in the video and podcast lanes (`ticket_status`, `assignee`, `asset_type`, `creative_brief`, `final_*`); `Publication` + `social_metrics` for its assets (day-1 and day-7 snapshots); `asset_types.dna_upstream` / `dna_requirements`; active `DnaReviewRule` and `ClipRule`; Signals from Social (`learning`, `anomaly`) and Production (footage ready). Freshness: same 36h rule [D108]. |
| **Checks** | **V1** readout per publication at 24h and 7d, cohort per D32 + D105, fallback per D33. **V2** retention contrast per asset type — top vs bottom quartile on the goal metric, **n ≥ 8 both sides** → `learning` proposal, **≤ 3 per asset type per week** [D38]. **V3** DNA review on → `Review` (the existing `lib/dna-review/generate.ts`); flag severity gates Approved — and because `approveContentReview` bypasses that gate today, a ticket reaching Approved with an open flag-severity finding emits a `watch` [D95]. **V4** stuck work: In Progress **> 14 days** with **no `TicketEvent`** → `blocker` [D86, D93]. **V5** sub-task split of brief bullet lines + the DNA standard list → draft on the ticket [D80]. **V6** first cut **only on the human "Generate first cut" click** [D61] — pilot **Podcast Snippets only**, output written back to the ticket's **existing Dropbox folder**, render cost on the app's Kessel project under a **monthly cap with an alert** [D110]. **V7** brief-from-what-wins at intake for video and podcast asset types, **auto-filled** when Event Type + Asset Type are chosen and marked "drafted by system"; the requester edits or clears it [D90]. |
| **Emits** | Kinds: `learning` (AssetType), `blocker` (Ticket), `gap` (AssetType with no DNA text), `anomaly` (Publication), `watch` (Ticket, for the D95 bypass) [D120]. Drafts: brief, sub-tasks, first cut, proposed `DnaReviewRule` rows (inactive). Nudges: the **editor's 24h readout DM** [D47] and Titus on new proposals, both under D87. |
| **Subscribes to** | Social's `learning` (cites it in the next brief draft for that asset type — hand-off 1) and `anomaly` (separates the distribution half out of the editor's DM); Production's footage-ready (unblocks a waiting ticket). |
| **Allowed writes** | Attach the readout to the ticket; store drafts as drafts; propose `DnaReviewRule` rows **inactive** [D72]. |
| **Forbidden** | Changing `ticket_status`, `prio_status` or assignee; activating a rule; rendering or publishing video; comparing editors [D9]; paging Vishen [D92]. |
| **Human loop** | The editor **endorses or disputes** a proposal, a dispute requiring a reason [D39]; **Titus or the Sub Lead activates** it [D42] — activation is forward-only [D106]. The editor **accepts or rejects a first cut** with the real reject taxonomy [D61]. The editor confirms the sub-task split [D80]. |
| **Failure** | No Perch capture → the readout reads "not read yet". n < 8 → "collecting (k/8)". Anthropic error → deterministic findings only (the existing DNA-review behaviour). Budget reached → stop drafting, keep observing [D88]. Stale source → D108's amber/red label on every number, propagated into the DM. |
| **Quality** | Acceptance per action type (rule proposal · brief · sub-tasks · first cut) over 30 days, plus cost and latency; on Titus's "Your agent" block [D74]. First-cut acceptance shows "collecting — history not persisted" until the durable `AcceptanceEvent` exists [D99]. |
| **Cost** | ≤ **$5/week** [D88]; Haiku phrasing of proposals, briefs and sub-task splits only. Render cost for V6 is **not** agent token cost — it has its own monthly cap and alert [D110]. |

#### Feature 4 · Production agent

| | |
|---|---|
| **Agent · owner · decides** | Production agent · owner **Nadir** · Nadir raises tickets and adds footage; **Vishen approves shoots on his own desk** [D70]. |
| **Runs** | **Hourly** [D89] — its subjects are ages and gaps that move through the day. Reads shoots first, then media sources, then the coming comms days. |
| **Inputs** | `shoots` (status, `filming_date`, `raw_files`, `ticket_ids`, `new_prio_ticket`, `requested_by`, `asset_type_ids`); `media_sources` (status, clip counts, error); comms days (planned releases); Signals from Planning (next-week slots) and Video (first-cut requested). |
| **Checks** | **P1** shoot *To Film* with `filming_date` < today → `blocker`. **P2** *Done – Filmed* without a `raw_files` link for **> 2 days** → `chore`. **P3** filmed without a post-production ticket → **propose** the ticket via the existing checkbox path — **a human clicks it** [D93, plan §5c]. **P4** a planned release day with no linked filmed shoot → `blocker` → Planning (hand-off 2). **P5** `media_source` in Error **> 24h** or New **> 48h** → `chore`. **P6** a podcast episode whose children are missing (no snippets / carousel / newsletter) → `gap` → Video / Design / Email [D79]. |
| **Emits** | Kinds: `blocker` (Shoot, CommsDay), `chore` (Shoot, MediaSource), `gap` (Episode work item) [D120]. Drafts: a post-production ticket proposal. Nudges: Nadir; Gareth on blockers — never Vishen, who reads them on his desk instead [D92]. |
| **Subscribes to** | Planning's `suggestion` / next-week slots (to test them against footage — the input to P4) and Video's first-cut-requested (to surface the source footage). |
| **Allowed writes** | **None beyond attaching links a human pasted** [D72]. |
| **Forbidden** | Ticking "New Prio Ticket"; approving or declining shoots (Vishen's, and Vishen is never paged for them); changing any shoot status [D72, D92]. |
| **Human loop** | Nadir raises the proposed ticket or adds the footage link, and accepts or dismisses each `chore` with a reason [D103]; Vishen approves shoots on his desk [D65]. |
| **Failure** | Shoots sync stale **> 36h** → a Signal "shoots not synced" to Rhythm, and every age it reports carries the staleness label [D108]. No filming dates → the count is shown, **no blocker is raised** (a missing date is not evidence of lateness). Budget reached → no drafting; observation continues [D88]. |
| **Quality** | Acceptance per action type (post-production ticket proposal · blocker · chore) over 30 days, plus cost and latency; on Nadir's "Your agent" block [D74]. |
| **Cost** | ≤ **$5/week** [D88] — nearly all of this agent is deterministic; only the ticket-proposal phrasing costs anything. |

[UNRESOLVED] P1's threshold — how late a *To Film* shoot must be before it counts as at risk —
owner: Nadir (O11, D86).

#### Feature 5 · Planning agent

| | |
|---|---|
| **Agent · owner · decides** | Planning agent · **Gareth, Glen and Ramya commit**; **Vishen reads** [D70]. It is the only agent whose subject is the plan rather than an item. |
| **Runs** | **Sunday night** (the Monday pack) and a **Thursday pre-pass** (next-week suggestions) [D89]. Reads all open Signals first, then the week's plan. |
| **Inputs** | The MOW master table (`tbl3NPxLDApiIyobS`); comms days; **all** Signals; `MowWeek` / `MowSlot` / `Learning`; Metabase figures via the ingest route; publications by day. |
| **Checks** | **L1** Sunday: generate the pack **staged only**, one headline, honouring the existing `lib/mow/pack.ts` invariants. **L2** day-by-day plan vs live, five states — planned / shipped / off plan / missed / blocked, with `blocked ≠ missed`; this agent is the **first writer** of `MowSlot`'s shipped/missed/blocked, derived from the matcher's "went live" [D97]. **L3** learnings: propose **≤ 5** from the week's `learning` Signals, `proposed = true`. **L4** Thursday: next-week slots with 0–1 items → `suggestion` from slot cohorts (**weekday × post type × pillar, n ≥ 3**). **L5** "no plan item cites a learning" → `watch` to Gareth and Glen. **L6** roles → results rows. **L7** aggregate blockers from Production, Design and Social into Vishen's *Next week* and Gareth's *Blockers*. |
| **Emits** | Kinds: `suggestion` (CommsDay slot), `watch` (plan), plus the blockers it relays [D120]. Drafts: the Monday pack (staged), learnings. Nudges: Gareth / Glen / Ramya — a commit reminder **Sunday 20:00 MYT**; **never Vishen** [D92]. |
| **Subscribes to** | Every kind from every agent — it is the aggregator: `blocker` → Vishen's *Next week* and Gareth's *Blockers*; `learning` → L3's staged learnings; `watch` → the day it sits on. |
| **Allowed writes** | **`*Staged` fields only**, and `Learning.proposed = true` rows [D72]. The MowSlot state writes of L2 are bookkeeping derived from the matcher, not judgements. |
| **Forbidden** | Committing anything; writing the MOW message or goal (Airtable owns them); narrating a number [D37]; ranking people on the roles → results table [D9, D60]; paging Vishen [D92]. |
| **Human loop** | Gareth, Glen or Ramya **commit** the pack (server-side, only these three); Glen **accepts suggestions** into the plan [D66]. Accepting a suggestion fills the slot; nothing fills itself. |
| **Failure** | A missing Metabase figure → the headline slot reads **"not filled"** with the ingest instructions, never a zero and never last week's number [D15]. An absent MOW row → an owned empty naming its owner. Budget reached → the pack is not drafted; the staged skeleton and the Signals still appear [D88]. |
| **Quality** | Acceptance per action type (pack section · learning · suggestion) over 30 days, plus cost and latency; on the Planning desks' "Your agent" block [D74]. |
| **Cost** | ≤ **$5/week** [D88] — two runs a week, Haiku phrasing of pack sections and learnings only. |

#### Feature 6 · Email & VL channels agent

| | |
|---|---|
| **Agent · owner · decides** | Email & VL channels agent · owner **Ramya** · she accepts the chores; the agency confirms its own links [D70]. |
| **Runs** | **Daily, after the Perch pull**; YouTube public stats and utm figures **weekly** [D89]. Its **first job** is simply to read 📧 Emails — there is no email code at all today [D98]. |
| **Inputs** | 📧 Emails (Live Date, Stage, Purpose, Type, Campaign / Comms Calendar link) through a **new field-map block** [D98]; 🗓️ Comms Calendar days (message, goal, phase, emails, social); VL `Videos` (Live Date, Source, Status, Approval, Published Link, 24h Data); YouTube public stats; Metabase leads and orders by `utm_source` (agency tags); Signals from Planning (message) and Social (cadence day). |
| **Checks** | **E1** an email with no Comms Calendar link or no Live Date → `chore` (the first Signal this agent can emit at all). **E2** email and social on the same day carrying **different messages** → `watch`, **never a fault** — Ramya's own rule. **E3** a VL asset published without a Live Date → `chore` (256 today). **E4** an agency delivery with no publish link **> 2 days** after Live Date → `chore` to the agency. **E5** a YouTube video's first-day / 7-day public views vs **the channel's own median, n ≥ 8** → `learning` or `anomaly`. **E6** leads and orders per agency utm, weekly → readout. **E7** the active-users metric: **no check until the Metabase question exists** — the slot is labelled, not guessed. |
| **Emits** | Kinds: `chore` (email, VL asset, agency delivery), `watch` (CommsDay), `learning` / `anomaly` (VL channel) [D120]. Drafts: **none in v1** — email copy is human. Nudges: Ramya, and the agency contact in-portal (Slack only if they have one), under D87. |
| **Subscribes to** | Planning's message-of-the-week Signal (the input to E2) and Social's cadence-day Signal (which day carries what). |
| **Allowed writes** | Set **Live Date from a pasted publish link**; create a Publication from an agency link; attach YouTube readouts [D72]. |
| **Forbidden** | Changing an email's stage; sending an email; touching Braze; writing into an agency's own Airtable base [D72]. |
| **Human loop** | Ramya accepts chores; the agency confirms its links; **Rafi defines the active-users question** before E7 can exist (O5 for the credentials it would need). |
| **Failure** | A YouTube page unreachable → "not read". LinkedIn → **"manual entry" always**, with "entered by" [D46]. No VL message → an owned empty and **at most one Signal per week**, never repeated spam. Braze not connected → email metrics read "not connected" [D51]. Budget reached → nothing to stop, since it drafts nothing [D88]. |
| **Quality** | Acceptance per action type (chore · watch · learning) over 30 days, plus cost and latency; on Ramya's "Your agent" block [D74]. |
| **Cost** | ≤ **$5/week** [D88]; effectively near zero in v1 — it drafts nothing. |

#### Feature 7 · Design agent

| | |
|---|---|
| **Agent · owner · decides** | Design agent · owner **Chee** · Chee assigns, writes the DNA, and accepts the gap Signals [D70]. |
| **Runs** | **Hourly** [D89]. Reads the design queue first. |
| **Inputs** | Design-lane tickets; the 48 design `asset_types` and their DNA fields; banner CTR / CVR **later**; Signals from Planning (the Thursday slot). |
| **Checks** | **G1** stuck **> 21 days** with no `TicketEvent` → `blocker` [D86, D93]. **G2** an unassigned design request **> 24h** → `chore` (the gold Assign pill). **G3** an asset type used **≥ 5 times in 60 days with no DNA** → `gap` to Chee. **G4** the Thursday collage slot with no item **by Tuesday** → `watch`. **G5** banners: **no check until the banner lane is in scope** (E14 held, O7). |
| **Emits** | Kinds: `blocker` (Ticket), `chore` (Ticket), `gap` (AssetType), `watch` (CommsDay) [D120]. Drafts: brief-from-what-wins for design types — citing **the brief only** until DNA exists, never an invented rule [D90]. Nudges: Chee, under D87. |
| **Subscribes to** | Planning's Thursday-slot Signal (the input to G4). |
| **Allowed writes** | Attach readouts for image posts Perch covers. Nothing else [D72]. |
| **Forbidden** | Assigning designers; changing status; writing DNA [D72]. |
| **Human loop** | Chee assigns the request, writes the DNA a `gap` asks for, and accepts or dismisses each Signal with a reason [D103]. |
| **Failure** | No design metrics → the learning checks are **skipped and labelled**, not approximated [D15]. Budget reached → no brief drafts; queue observation continues [D88]. |
| **Quality** | Acceptance per action type (gap · chore · blocker · brief) over 30 days, plus cost and latency; on Chee's "Your agent" block [D74]. |
| **Cost** | ≤ **$5/week** [D88]; brief phrasing only. |

### Features 8–10 · Surfaces

8. **"Your agent" desk block** on every desk — this week's signals · drafts awaiting you · nudges
   sent · acceptance per action type · cost & latency; deep-links into the item threads [D78].
9. **Threads integration** — Signals rendered in the work-item and version timeline alongside human
   comments, approvals/sends-back and status events, with acknowledge / act / **dismiss (reason
   required)** controls [D77, D103].
10. **Nudges** — Slack DM / digest delivery for Signals awaiting a decision, naming the suggested
    owner, reusing the D47/D48 paths, under the D87 policy (once · re-nudge after 3 working days ·
    max 2 · everything else bundles into the Monday digest) and the D92 recipient list (**never
    Vishen**).

[UNRESOLVED] Which agent the "Your agent" block represents on an agency desk — D78 puts the block on
every desk while D70 defines no agency agent, and the §5d open list does not carry the question
forward; the Email & VL channels agent scoped to the agency's own items is the implied answer but is
not decided — owner: Rhythm.

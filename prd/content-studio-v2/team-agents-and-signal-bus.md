---
title: 'E-I · Team agents & the Signal bus'
slug: 'team-agents-and-signal-bus'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-11
updated: 2026-09-11
resolution: 4/7
---

# E-I · Team agents & the Signal bus

> Part of [Content Studio v2](../content-studio-v2.md)

> Created 2026-09-11 from `plans/i-want-to-reimagine-velvety-falcon.md` §5 (D56) and §5b (D69–D84,
> the six-agent table, the three hand-offs, the rev-3 prototype changes). Decision IDs are kept in
> brackets so every line traces to a decision; nothing here is a new decision. No code until the
> real-data prototype is approved by Rhythm [D23]; the prototype rev 3 *is* this epic on real data.

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
| `status` | `open` → `acknowledged` → `acted` \| `dismissed` |
| `thread_id` | the work-item or version thread it is appended to [D77] |

**3. The three hand-offs — worked examples on real items** [D81, plan §5b]

*Social → Video (finding → brief).* The Social agent's Sunday run contrasts gated-CTA reels vs the
rest on @mindvalley (n=24): first-day views −27%, comments +52%. It writes a Signal of kind
*caption/CTA contrast* on the **Pathway Organic – Snippets** asset type, `to_agents: [video]`,
suggested owner: caption owner, proposed action: cite in brief. The Video agent's next brief draft
for a Snippets ticket cites it under "what wins" (rule + top-3 performers, editable, D40). Titus
sees it in the brief; the Signal and the brief draft both sit in the thread on ticket #11057.

*Production → Planning → Vishen (footage gap → blocker).* The Production agent finds 15 shoots still
*To Film* with filming dates ≤ 10 Sep. It writes a Signal of kind *planned slot without footage* on
the comms days 14–15 Sep, `to_agents: [planning]`, owner Nadir → Vishen. The Planning agent's run
adds the blocker to Vishen's *Next week* ("Not yet recorded") and to Gareth's *Blockers*; nothing is
rescheduled by a machine.

*Email → Social (message alignment watch).* The Email & VL agent compares Wed 9 Sep's newsletter
("What's the one thing you're truly the best in the world at?") with the day's three Pathway reels
and finds different messages. It writes a Signal of kind *message alignment* on the comms day,
`to_agents: [social, planning]`, owner "Ramya · Glen", confidence marked *watch* — by Ramya's own
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

[UNRESOLVED] The `kind` taxonomy for Signals (the closed list subscribers filter on — the three
hand-offs imply *caption/CTA contrast*, *planned slot without footage*, *message alignment*, plus
*distribution: collab pending*, *retention vs median*, *queue ageing*, *DNA gap*, *unticketed*,
*publish-link gap*, but no list is decided), and the retention period of Signal rows (kept forever
as decision log, or archived after N days) are not in the plan.

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
- Out of scope entirely: a localisation lane and a broadcasts/notifications lane [D69].

## Dependencies

- **E-A** — `Publication` with `publicationId` on metric rows and the matcher tiers (the Social
  agent's observe step and the auto-link bookkeeping) [D43].
- **E-B** — the Knowledge store generalising `DnaReviewRule` (what agents read and propose into), the
  cohort + goal-map service, the 24h DM and Monday-digest paths that carry nudges [D47, D48].
- **E-C / O6** — one scheduled runner per agent on a real scheduler; the current GitHub Actions
  cron (3–11h slip) cannot land day-1 windows or Sunday runs [D82].
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

[UNRESOLVED] Who owns each agent's cost budget (a token/latency ceiling per agent per month, and
who is paged when it is exceeded) — the plan makes cost visible but sets no budget and names no
owner.

## Features

In dependency order.

1. **Signal table + one scheduled runner per agent** — migration, `from_agent`/`to_agents[]`,
   status machine, thread append, run accounting (tokens, seconds) [D82, D74].
2. **Social agent** (Glen + Vidura) — matcher tiers and auto-link bookkeeping, cohorts, gated-CTA /
   collab / posting-time contrasts, coverage % and unticketed list, caption drafts, report-section
   drafts [D43, D45, D66, D75]. First, because hand-off 1 starts here.
3. **Video agent** (Titus) — day-1/7 readouts attached to tickets, DNA proposals at n ≥ 8 (E-B), brief
   drafts citing what wins incl. subscribed Social Signals, sub-task checklists from free text +
   DNA, first-cut drafts (mock render) [D40, D61, D80].
4. **Production agent** (Nadir) — pipeline ages, filmed-without-handoff, planned-slot-without-footage
   Signals, post-production ticket proposals, podcast inbox nudges [D65].
5. **Planning agent** (Vishen / Gareth / Marisha) — consumes all Signals; drafts the Monday pack
   (staged only), next-week suggestions (E-B), roles → results, "no plan item cites a learning";
   surfaces Production blockers on Vishen's and Gareth's desks [D60, D67, D70].
6. **Email & VL channels agent** (Ramya) — cadence vs message, agency deliveries vs plan,
   publish-link / Live Date gaps with Live-Date bookkeeping, per-agency leads, message-alignment
   watch [D62, D72].
7. **Design agent** (Chee) — queue-age nudges, DNA-gap Signal per design type; banner learnings once
   the banner lane exists [D64, O7].
8. **"Your agent" desk block** on every desk — this week's signals · drafts awaiting you · nudges
   sent · acceptance per action type · cost & latency; deep-links into the item threads [D78].
9. **Threads integration** — Signals rendered in the work-item and version timeline alongside human
   comments, approvals/sends-back and status events, with acknowledge / act / dismiss controls
   [D77].
10. **Nudges** — Slack DM / digest delivery for Signals awaiting a decision, naming the suggested
    owner, reusing the D47/D48 paths.

[UNRESOLVED] Which agent the "Your agent" block represents on an agency desk (D78 says every desk;
D70 defines no agency agent — the Email & VL channels agent scoped to the agency's own items is the
implied answer but is not decided), and the nudge policy (how often one open Signal may re-nudge,
and whether nudges batch into the digest after the first DM).

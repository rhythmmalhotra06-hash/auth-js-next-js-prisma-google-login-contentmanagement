---
title: 'E-D · Lanes & the v2 IA'
slug: 'lanes-and-v2-ia'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-11
resolution: 6/7
---

# E-D · Lanes & the v2 IA

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.2, §4 thesis, §5
> screens 0–10, §9; decisions D18, D25, D29–D31, D51–D53, D55). **Extended 2026-09-11** with the
> missing workflow pieces from §5b (D69, D75–D80): copy stage, scheduling & went-live, threads, the
> podcast Episode tree, sub-tasks. No code until the real-data prototype is approved [D23]; the
> prototype *is* this IA, on real data.

## Purpose

Replace seven disjoint work nouns with seven pages and seven status vocabularies — and no home at
all for banners, email or podcast — with one information architecture: **Plan → Make → Publish →
Measure → Learn**, where lanes are filters and roles adapt the home page. The current portal is a
data source, not a UI to extend; v2 ships behind `/v2` and a feature flag, moving one surface at a
time, with old routes redirecting when replaced [D55].

## User Stories

**Vishen — Today.** One number per brand, labelled by brand and source; what ships today; what is
blocked on him. VL/Vishen rows render honest empty states where there is no data [D25, D26].

**Yuthika (editor) — Today.** Next up, then the 24h/7d readouts of her last publications, in one
screen; the queue behind it shows Title, Priority, Assigned, Ticket Status, Priority Status first,
whatever the lane.

**Titus (team lead) — Today.** Lane health, at-risk items, capacity; a queue with lane tabs
(video / social / email / podcast / shoots) and risk chips.

**A social producer — Plan.** The week as a calendar, lanes as rows, two brands, MOW per brand,
owner-named empty states, and the not-dated tray count (221 at export) [prototype screen 2].

**An email producer — a lane at last.** A send from 📧 Sends appears as a work item in the Email
lane with the shared status axes and the send's own state as a chip [D51, D52].

**Anyone — Repository.** One table: asset, lane, versions, copy/transcript/hook/CTA/offer,
publications, 7d metrics; filters; a version-stack drawer [screen 6].

**Anyone with a question about the data — State of the portal.** The audit (real / built-unwired /
planned-only, the 0/1,642 join, the views-mapper bug) is reachable from the footer, not in the main
flow [D29].

**Yuthika (editor) — the caption ships with the cut.** She writes the caption as part of the creative
record when she delivers; the publication sits at *Copy draft (editor)* until Glen or Vidura polish
it [D75]. Her ticket carries a sub-task checklist: the standard list for *Pathway Organic – Snippets*
from its DNA plus a drafted split of the lead's WHAT TO DO lines, which she confirms or edits [D80].

**Glen (social manager) — polish, schedule, and never tick "live".** He moves a publication to
*Polished*, sets *Scheduled* with himself as channel owner (Hootsuite) and a planned time; *Live* is
set for him when Perch first sees the post [D75, D76].

**Vishen and Gareth — the decision log.** On any work item, one timeline shows who approved, who
sent back, what the DNA review found, when the matcher linked the post, and what the agents
signalled — the record they asked for [D77].

**Nadir — one episode, six tickets.** *Scaling Wisdom* is one Episode work item with children —
master edit · YouTube upload + show notes · snippets · carousels · newsletter mention — each with
its own lane, owner and status; publications hang off the children [D79].

## Workflows

**Navigation.** Five top-level stages, each a hash route in the prototype and a `/v2/...` route in
the product, all reachable from nav and in-page links [plan §9]:

| Stage | Screens (prototype numbering) |
|---|---|
| Today | 1 — role toggle Vishen · editor · lead |
| Plan | 2 — Calendar (week, lanes as rows, two brands, MOW per brand, not-dated tray) · 3 — Requests & Shoots (intake chain, shoot requests, agency-originated marker) |
| Make | 4 — Queue (5 mandated columns, lane tabs, risk chips) · 5 — Work item (brief, *derived from*, DNA baseline, versions, DNA review, approvals, Publication band with day-1 metrics vs cohort, edit vs distribution, proposed learning) |
| Publish | 6 — Repository (table, filters, version-stack drawer) |
| Measure | 7 — Performance (by lane/channel/campaign tag, attribution coverage %, source badges + freshness, Monday pack) |
| Learn | 8 — Insights & Knowledge inbox ("what's working" with evidence + n, proposals from all loops, endorse/dispute/approve, rulebook by asset type, "AI-drafted" marker) |
| Partners | 9 — agency workspace (E-E) |
| Connections | 10 — data health (E-C) |
| Appendix | 0 — State of the portal, footer link only [D29] |

**Lanes as real queues** [D18]: Video · Social (posts + clips) · Email · Podcast · Shoots. Banners
excluded (E14 held). `Ticket.lane` is a concrete column [plan §4].

**Statuses** [D52]: the shared prio/ticket status axes drive the unified queue; the lane-native
status (Social `11: Released`, Shoot 4-state) is a secondary chip until sunset. The 5-column
mandate — Title, Priority, Assigned, Ticket Status, Priority Status — holds on every list in every
lane.

**Lane sources** [D51, D53]: Email reads 📧 Sends / 📧 Email (Content & Comms base); metrics "not
connected" until Braze. Podcast = VL Podcast table + `media_sources` inbox, episodes → clips,
performance via YouTube public stats where a link exists. Asset kinds per lane per D53.

**Coexistence** [D55]: `/v2` prefix + feature flag; surfaces move over one at a time; old routes
redirect when replaced; MOW and the comms calendar untouched through 14 Sep.

**Design bar on every screen** [D30, D31]: fully responsive to ~390px with no horizontal body
scroll; every insight readable in one line (*number · vs what · n · so-what · owner*); headline →
evidence → raw table; edit = purple, distribution = neutral, data-quality = gold (≤ 1 per screen);
skeletons, hover, keyboard nav, dark-mode parity. Brand per `DESIGN_SYSTEM.md`.

**Copy & captions stage** [D75]: the **editor writes the caption with the cut; the social manager
polishes.** States live on the Publication: *Copy draft (editor)* → *Polished (social)* →
*Scheduled* → *Live*. The caption is part of the creative record (E-A `CreativeRecord`), so a
caption change is a version, not a lost edit. The Social agent may draft the caption from what wins;
the draft is marked "drafted by system" and stays a draft until the editor or social manager takes it
(E-I, D72).

**Scheduling & went-live** [D76]: *Scheduled* carries a **channel owner** — Glen · Hootsuite / Ramya
· Braze / agency · native / Talking Heads · YouTube — and a planned time. **"Went live" is confirmed
automatically** when Perch or YouTube first sees the post: the matcher (E-A, D43) sets *Live* and
records the real first-seen time; there is no human tick. Scheduling *from* the portal (pushing to
Hootsuite/Braze) is later and out of this epic.

**Threads** [D77]: **one timeline per work item and one per version.** Human comments, approvals and
sends-back, lane status events (real Airtable status changes while the mirror runs), DNA review
findings, matcher links and agent Signals (E-I) appear in one stream, oldest to newest, with an
optional timecode on any entry for video. This is the decision log; agents become visible only here
and on the "Your agent" desk block [D78]. The `Comment` model from D54 is the human entry type;
agency-visible threads are row-scoped per E-E.

**Podcast Episode tree** [D79]: an **Episode is a parent work item** whose children are the six
ticket types that exist today for Scaling Wisdom / Jim Kwik — master edit · YouTube upload + show
notes · snippets · carousels · newsletter mention — each child with its own `lane`, owner and both
status axes; publications hang off the children, never off the parent. The parent shows a roll-up
(children by status), the tree screen is `#/make/episode/<slug>` in the prototype and a `/v2/make/
episode/<id>` route in the product. The parent is raised from Nadir's podcast inbox when a media
source reaches *Clips suggested* [D65].

**Sub-tasks under a ticket** [D80, E10]: two sources, both editable by the editor. (a) A **standard
checklist per asset type derived from its DNA** — deterministic, and the DNA review at `Review`
checks the same list. (b) The Video agent **splits a lead's or Vishen's free-text instruction** into
checklist items, marked drafted; the editor confirms before they count. Editors may add their own
items. Sub-tasks do not change the ticket's status axes.

[UNRESOLVED] The email lane is decided at the level of source tables and asset kinds (D51, D53) and
the copy stage names the *editor* and *social manager* as the two copy roles (D75), but not as an
email workflow: how a 📧 Send enters the queue (who raises it, which status-axis values apply on
creation, who is the assignee), and who holds the *Copy draft* / *Polished* roles for an email send.
Whether Shoots keep their existing board or join the unified queue as a tab is not in the plan.
D76 auto-confirms *Live* on first sighting by the matcher, but D43 puts transcript- and image-only
matches at the PROPOSE tier — whether a PROPOSE-tier sighting flips *Scheduled → Live* or waits for
the confirm is not decided.

## Boundaries

- No banner lane in v1 [D18, O7].
- Not an extension of the current portal's IA; no new surface on the old routes [D55].
- MOW and the comms calendar are not touched through 14 Sep [D55].
- `Shoot` stays its own table; no polymorphic JSON on `Ticket` [plan §4].
- The audit screen is an appendix from the footer, never in the main flow [D29].
- No cover-stats row on the landing page (standing rule from the current portal).
- Cross-brand views exist only as filters; no cross-brand comparison of numbers [D16].
- **No localisation lane and no broadcasts/notifications lane** — explicitly out of v2; this
  mention is the whole of their scope [D69].
- No scheduling *from* the portal in this epic (no push to Hootsuite/Braze); *Scheduled* records
  owner and time only [D76].
- No human "went live" tick; *Live* is set by the matcher or not at all [D76].
- Publications attach to Episode children, never to the Episode parent [D79].
- Agent Signals in threads are read-only entries; nothing in a thread is committed by an agent
  [D72, D77].

## Dependencies

- **E-A** — `Ticket.lane`, the Asset reshape, Publication (for screens 5, 6, 7).
- **E-B** — readouts and proposals (screens 1 editor view, 5, 7, 8).
- **E-C** — source badges, freshness and the Connections screen (screens 7, 10).
- Approval of the real-data prototype by Rhythm [D23]; the prototype's export list (plan §5) is the
  data contract for these screens.
- `DESIGN_SYSTEM.md` and `app/globals.css` tokens; the `artifact-design`, `dataviz`,
  `artifact-diagramming` skills for the prototype [D31].
- **E-A** matcher for the automatic *Live* transition [D76]; `CreativeRecord` for the caption [D75];
  the `Comment` model (D54) for thread entries.
- **E-I** — the Signal table and runners whose Signals render in threads and whose caption/checklist
  drafts appear at the copy stage and on the ticket [D72, D77, D80].
- The superseded PRD's **E10 · Editor Tasks** (sub-tasks under tickets) — D80 reuses its shape.

## Success Criteria

- Every list view in every lane starts with Title, Priority, Assigned, Ticket Status, Priority
  Status (component test over all lane tabs).
- Five lanes selectable as queues; each Ticket has a non-null `lane`; 0 tickets unreachable from
  the unified queue.
- Every screen passes the design bar: ≤ 1 gold element; no horizontal scroll at 390px; light and
  dark render; every insight line has the five parts (checklist per screen, prototype §9).
- Every old route that is replaced returns a redirect to its `/v2` equivalent; unreplaced routes
  are unchanged (route test).
- MOW and comms-calendar routes produce identical output before and after the `/v2` flag is enabled
  up to 14 Sep.
- The worked example (#11057) is reachable on screens 5, 6, 7 and 8 with the numbers from the
  product PRD's Vision table.
- Every Publication has exactly one copy state from {Copy draft, Polished, Scheduled, Live}; a
  transition to *Live* has a matcher link id and a first-seen time, and 0 *Live* rows were set by a
  user action (query) [D75, D76].
- Every *Scheduled* Publication has a non-null channel owner and planned time (query) [D76].
- Every work item and every version has a thread; the thread for #11057 shows its status events,
  DNA review findings, matcher link and agent Signals in one chronological stream (snapshot) [D77].
- `#/make/episode/scaling-wisdom` renders one Episode with six children, each carrying lane, owner
  and both status axes; 0 publications attached to the parent (query) [D79].
- On #11057 the sub-task list contains the DNA-derived standard items for *Pathway Organic –
  Snippets* plus drafted items marked "drafted by system" until confirmed; the DNA review at
  `Review` evaluates the same standard list (test) [D80].

## Features

1. `/v2` shell: nav, hash/route structure, feature flag, redirect table.
2. Today — role-adapted home (Vishen / editor / lead).
3. Plan — Calendar (lanes × days, two brands, MOW per brand, not-dated tray).
4. Plan — Requests & Shoots (intake chain inherited from the June PRD, shoot requests,
   agency-originated marker).
5. Make — Queue with lane tabs, 5 mandated columns, risk chips, lane-native chip.
6. Make — Work item page incl. Publication band (E-A/E-B components).
7. Publish — Repository table + version-stack drawer.
8. Measure — Performance by lane/channel/campaign with coverage % and source badges.
9. Learn — Insights & Knowledge inbox + rulebook by asset type.
10. Email lane and Podcast lane adapters (after the Workflows gap above is closed).
11. State-of-the-portal appendix (footer).
12. Copy stage — Publication states *Copy draft → Polished → Scheduled → Live*, caption on the
    creative record, "drafted by system" marker on agent captions [D75].
13. Scheduling & went-live — channel owner + planned time on *Scheduled*; matcher-driven *Live*
    with first-seen time; no manual tick [D76].
14. Threads — work-item and version timelines merging comments, approvals/sends-back, status
    events, DNA findings, matcher links and Signals; optional timecode [D77].
15. Podcast Episode tree — parent work item, six child types, roll-up, `#/make/episode/<slug>` →
    `/v2/make/episode/<id>` [D79].
16. Sub-tasks — DNA-derived standard checklist per asset type + drafted split of free-text
    instructions with editor confirm; editor-added items; DNA review checks the same list [D80].

---
title: 'E-F · Airtable sunset'
slug: 'airtable-sunset'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 6/7
---

# E-F · Airtable sunset

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.7, §4 "Airtable →
> mirror → connector → archive", §7.7, §7.10, §8; decisions D16, D20, D55). Runs domain by domain
> throughout the other epics. No code until the real-data prototype is approved [D23].

## Purpose

Airtable is still the editing surface for taxonomy, DNA, rules, calendar and MOW, and two live
Airtable automations create tickets — so inbound pulls cannot stop and every domain has two places
where truth can be edited. This epic retires Airtable **domain by domain as each app editor ships**,
with no fixed date: each domain moves Airtable to a read-only mirror, then a connector, then an
archive. Order: reference nouns → calendar/MOW → tickets last [D20].

## User Stories

**Titus (team lead) — edit the asset type where he works.** He changes the Team Lead / Sub Lead or
the DNA baseline of *Pathway Organic – Snippets* in the app; Airtable's copy is read-only and shows
the same value after the next push.

**A social producer — the calendar in one place.** The comms calendar and the MOW slots are edited
in Plan → Calendar; the Airtable 📅 / 🗓️ tables mirror them read-only. Not before 14 Sep [D55].

**Rhythm (admin) — the progress bar.** The Connections screen shows sunset progress per domain:
*app editor shipped → pull stopped → Airtable read-only → archived*, with the date of each step.

**Vidura (social) — the raise-request checkbox still works.** The two Airtable automations that
create tickets (the Raise Request checkbox in Content & Comms Prio; the Shoots "New Prio Ticket"
checkbox) are rebuilt as app actions before the tickets domain stops pulling — nothing he does today
silently stops creating a ticket.

## Workflows

**Per domain, in order** [D20]:
1. The app editor for the domain ships (E-D for reference nouns, calendar, MOW; the ticket surfaces
   already exist).
2. Inbound pull for that domain stops; outbound push continues so Airtable stays a faithful mirror.
3. The Airtable table is locked read-only for the team; the Connections screen records the date.
4. When no reader depends on the mirror, the table is archived.

**Domain order** [D20]: reference nouns (asset types, event types, dimensions, DNA, rules) →
calendar / MOW → tickets last.

**Precondition for the tickets domain** [plan §1.7, §7.10]: rebuild the two ticket-creating Airtable
automations as app actions first.

**Allowed during the sunset** [D16]: Airtable structure changes v2 needs (a Goal field on Social, a
short code field).

**Cleanup at the end** [plan §7]: delete `ClipSuggestion`/`ClipStrategy`/`ContentSource`, `Brief`,
`Experiment`, `Performance`, `AssetPerformanceSnapshot`, `PerformanceAttribution`, `Dna`; remove
orphan pages and the two dead navs; fix the stale README and the hardcoded "Synced 2 min ago".

[UNRESOLVED] Two migrations the plan names but does not specify: (a) `Employee.id` is an Airtable
recId with ~430 references — the plan flags it as a risk without deciding whether ids are kept,
aliased or migrated; (b) the exact app-side replacements for the two ticket-creating automations
(trigger, fields written, who is notified). Also unaddressed: the employees table is HR-synced
upstream, so "app editor ships" does not apply to it in the same way as to other reference nouns.

## Boundaries

- No fixed sunset date; a domain moves only when its app editor has shipped [D20].
- Airtable is never edited *and* mirrored for the same domain at once — each domain has exactly one
  writable home at any time.
- Nothing about MOW or the comms calendar changes through 14 Sep [D55].
- No domain stops pulling while an Airtable automation still writes into it.
- Archiving is the last step and only when the Connections screen shows zero readers of the mirror.

## Dependencies

- **E-D** — app editors for reference nouns, calendar and MOW.
- **E-A** — Publication and Asset must not depend on Airtable-only fields once their domain stops
  pulling (Published Link, Transcript, cover are read from the mirror until then).
- The existing sync engine (outbox push, cursored pull, field-id map) stays in place for the mirror
  phase.
- Rebuild of the two Airtable automations (Raise Request checkbox; Shoots New Prio Ticket).

## Success Criteria

- Per domain, four dated milestones recorded on the Connections screen; 0 domains in the state
  "app editor shipped, pull still running" for more than one release cycle.
- After a domain's pull stops, 0 inbound sync runs for that domain (sync log query) and 0 divergent
  rows between app and mirror after push (reconcile report).
- 0 tickets created by Airtable automations after the tickets domain stops pulling, and 100% of the
  former checkbox paths create a ticket through the app action (count before/after over one week).
- The 9 zero-call-site models are deleted; `npx prisma validate` and `npm run build` pass; no route
  references an orphan page.
- Airtable tables for retired domains are read-only for every collaborator (permission check).

## Features

1. Sunset progress tracker on the Connections screen (four milestones per domain).
2. Reference-noun editors in the app (asset types incl. Team Lead / Sub Lead and DNA, event types,
   dimensions, rules) + stop pulls for those domains.
3. Calendar / MOW editors in the app (after 14 Sep) + stop pulls.
4. Rebuild the two ticket-creating Airtable automations as app actions.
5. Stop ticket pulls; Airtable tickets read-only.
6. Schema cleanup: delete the 9 dead models, orphan pages, dead navs; fix README and the sync
   label.
7. Archive retired tables.

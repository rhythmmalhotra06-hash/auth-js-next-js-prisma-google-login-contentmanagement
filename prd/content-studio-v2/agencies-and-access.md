---
title: 'E-E · Agencies & access'
slug: 'agencies-and-access'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-12
resolution: 5/7
---

# E-E · Agencies & access

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.5, §4 Party/
> workspace, §5 screen 9, §7.9, §8; decisions D19, D22, D54; open O8). No code until the real-data
> prototype is approved [D23].

> **Extended 2026-09-12** with the rev-4 identity and scoping decisions (plan §5d): **D102** the
> scoping predicate, **D113** `Party` keyed by email alongside `Employee`. Transcription only — no
> new decisions [D129].

## Purpose

Agencies have zero access today: SSO is locked to `@mindvalley.com` and the only external surface,
`/stakeholder`, reads everything. This epic gives an invited agency a row-scoped workspace in the
same app — see the status and numbers of their own items, submit requests and shoot requests,
deliver by pasting a link as a version, comment on the item and on versions — and then opens sign-in
to any Google account **by invitation**. Row scoping ships first; SSO opens after [D19].

## User Stories

**Rise Voice (reference agency) — own items only.** Their producer signs in with the agency's Google
account and sees the 66 published `VL IG: Risevoice` items with no Live Date, each with status and,
where Perch covers the VL account, its own numbers. The cohort appears only as an anonymous account
median [D54].

**Rise Voice — deliver a version.** They paste a Dropbox/Drive link as a new version on the work
item; the internal team sees it stacked under the asset. No file is uploaded to us [D54].

**Rise Voice — comment with a timecode.** On version 3 they leave "0:42 — the lower third clips the
speaker's name"; the thread is visible to the agency and the internal team on that item only [D54].

**Rise Voice — request a shoot.** They submit a shoot request through the same intake chain
(event type → asset type → lookups); the item carries an agency-originated marker in Plan → Requests
& Shoots.

**Titus (team lead) — one queue.** Agency-originated items sit in the same lane queues with the same
5 columns; the marker tells him where they came from.

**Rhythm (admin) — invitations.** He invites an agency by Google account; the invitation defines
which workspace (party) they belong to; every read passes through `scopeFilterFor(access)`.

## Workflows

**1. Party / workspace noun** [plan §4, D113]: an invitation table maps a Google account → party →
scope; `scopeFilterFor(access)` is applied in every read.

**Identity: add `Party` keyed by email; never refactor `Employee.id`** [D113]. Party is the person
for **access, scoping, ownership, agents and threads** — email is already how sessions resolve, so
it is the key that actually works across internal staff, contractors and agency members.
`Employee` **stays exactly as it is**: the Airtable mirror, `recId` as primary key, ~430 references
untouched, with a **link** to its Party. Refactoring `Employee.id` was considered and rejected — the
blast radius is the whole codebase, and the benefit is obtainable with one new table.

The reason this is not merely a schema convenience: **employees are HR-synced, and offboarding
deletes the row**. An offboarded employee's **Party survives**, so their history, the threads they
authored and the learnings they produced do not vanish with their employment [D113].

**2. Row scoping first, then SSO** [D19, plan §8]: all agency-visible queries filter by party before
any external account can log in.

**2b. The scoping predicate — a union of three** [D102]. An agency sees an item if **any** of:

1. the item's **producer / `Source` field names the agency**; **or**
2. an **agency member created** the record; **or**
3. the item was **explicitly shared** with them.

Nothing else. They **never** see another agency's items, and **cohort medians reach them
anonymised** — the number without the neighbours' names. The predicate is implemented **once**, as
`scopeFilterFor(access)`, and applied in **every** read; it is not re-derived per screen, because a
predicate written twice is a predicate that will disagree with itself.

**3. Agency actions** [D19, D54]:
- See status + performance of own items; cohort as anonymous account median only.
- Submit requests and shoot requests via the intake chain; items marked agency-originated.
- Upload = paste a link as a version.
- Comment = threaded on the work item and on each version, optional timecode for video, visible to
  the agency and the internal team on that item (new `Comment` model).

**4. Sign-in** [D19]: any Google account, by invitation only.

[UNRESOLVED] The invitation model itself is still open with InfoSec: how invitations are issued,
expire and are revoked. PAT sharing for Rise Voice's Airtable base is blocked, so the Airtable route
is closed; the app-side route is not specified beyond "by invitation" — owner: Rhythm with InfoSec
(O8). (The half of this marker that asked whether an agency member is a `Contractor` row or a new
party-member record **is now answered**: they are a **Party** keyed by email [D113].)

## Boundaries

- No file hosting; a version is a link [D54].
- No Airtable seats or Airtable access for agencies [D19, O8].
- An agency never sees another party's items, per-editor numbers, or the cohort beyond an
  anonymous account median [D54, D9, D102].
- **The scoping predicate is written once** and applied in every read; no screen may re-derive its
  own version of it [D102].
- **`Employee.id` is never refactored** — Party is added beside it, not in place of it [D113].
- No Party is deleted when its Employee row is removed by the HR sync; history survives
  offboarding [D113].
- Internal visibility is open by default; an agency's scope and per-editor readouts are two of its
  only three exceptions [D114].
- No cross-account proposals or learning exposed to agencies [D33].
- SSO does not open before row scoping is proven [D19, plan §8].
- No timecode comments outside video items; frame-accurate review tooling is not in scope.

## Dependencies

- **E-A** — Party/workspace noun, `Comment` model, versions on `Asset`.
- **E-D** — the Partners screen (prototype 9) and the agency-originated marker on Requests & Shoots.
- **E-C** — Perch coverage of the VL account for agency numbers; otherwise honest empty states.
- O8 — invitation model with InfoSec.
- Auth.js configuration currently domain-locked to `@mindvalley.com` (`lib/auth.ts`).

## Success Criteria

- A cross-tenant read test (agency A requesting agency B's items, an internal item, or another
  editor's My work) returns 0 rows on every agency-reachable endpoint.
- Rise Voice can see 100% of its 66 `VL IG: Risevoice` items and 0 items of any other party.
- Every agency-visible metric row is labelled with source, capture age and n, and cohort values
  render only as the anonymous account median.
- Every agency-originated item carries the marker and appears in the correct lane queue with the 5
  mandated columns.
- Versions pasted by an agency appear stacked under the asset with author and timestamp; comments
  with a timecode round-trip the timecode.
- **The predicate is one function** [D102]: a static check finds exactly one implementation of
  `scopeFilterFor(access)`, and every agency-reachable read passes through it; each of the three
  branches (producer field · created-by · explicitly shared) has a test that returns the item, and
  an item matching none of them returns nothing.
- **Cohort anonymity** [D102]: every cohort value an agency can read is a median with no account,
  item or person named.
- **Party holds identity** [D113]: every session resolves to a Party by email; `Employee.id` appears
  in no new foreign key; deleting an `Employee` row (the HR-sync offboarding path) leaves its Party,
  its authored thread entries and its learnings intact (test on a simulated offboard).

[UNRESOLVED] The plan sets no adoption or turnaround target for agencies (e.g. share of Rise Voice
deliveries submitted through the workspace within 60 days); the criteria above are correctness
gates only.

## Features

1. **`Party` model keyed by email** + a link from `Employee` (whose `id` is untouched) + the
   invitation table + `scopeFilterFor(access)`, implementing D102's three-branch predicate, applied
   in every read [D102, D113].
2. Cross-tenant read test suite (gate for opening SSO).
3. Partners screen: own items, status, own numbers, anonymous account median.
4. Agency request + shoot request via the intake chain with the agency-originated marker.
5. Link-as-version upload on the work item.
6. `Comment` model: threaded on item and version, optional timecode.
7. Open Auth.js to invited Google accounts (after O8 and feature 2).

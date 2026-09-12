---
title: 'E-E · Agencies & access'
slug: 'agencies-and-access'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 5/7
---

# E-E · Agencies & access

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.5, §4 Party/
> workspace, §5 screen 9, §7.9, §8; decisions D19, D22, D54; open O8). No code until the real-data
> prototype is approved [D23].

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

**1. Party / workspace noun** [plan §4]: built on `Employee`, `Contractor`, and
`AssetType.stakeholderEmails`; an invitation table maps a Google account → party → scope;
`scopeFilterFor(access)` is applied in every read.

**2. Row scoping first, then SSO** [D19, plan §8]: all agency-visible queries filter by party before
any external account can log in.

**3. Agency actions** [D19, D54]:
- See status + performance of own items; cohort as anonymous account median only.
- Submit requests and shoot requests via the intake chain; items marked agency-originated.
- Upload = paste a link as a version.
- Comment = threaded on the work item and on each version, optional timecode for video, visible to
  the agency and the internal team on that item (new `Comment` model).

**4. Sign-in** [D19]: any Google account, by invitation only.

[UNRESOLVED] The invitation model itself is open with InfoSec (O8): how invitations are issued,
expire and are revoked, and whether an agency member's identity is a `Contractor` row or a new
party-member record. PAT sharing for Rise Voice's Airtable base is blocked, so the Airtable route is
closed; the app-side route is not yet specified beyond "by invitation".

## Boundaries

- No file hosting; a version is a link [D54].
- No Airtable seats or Airtable access for agencies [D19, O8].
- An agency never sees another party's items, per-editor numbers, or the cohort beyond an
  anonymous account median [D54, D9].
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

[UNRESOLVED] The plan sets no adoption or turnaround target for agencies (e.g. share of Rise Voice
deliveries submitted through the workspace within 60 days); the criteria above are correctness
gates only.

## Features

1. Party / workspace model + invitation table + `scopeFilterFor(access)` in every read.
2. Cross-tenant read test suite (gate for opening SSO).
3. Partners screen: own items, status, own numbers, anonymous account median.
4. Agency request + shoot request via the intake chain with the agency-originated marker.
5. Link-as-version upload on the work item.
6. `Comment` model: threaded on item and version, optional timecode.
7. Open Auth.js to invited Google accounts (after O8 and feature 2).

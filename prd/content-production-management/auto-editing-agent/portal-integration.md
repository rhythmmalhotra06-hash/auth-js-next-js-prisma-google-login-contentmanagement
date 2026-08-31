---
title: 'Portal Integration'
slug: 'portal-integration'
scope: feature
status: deferred
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-08-31
resolution: 3/7
---

# E12.5 · Portal Integration

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

> **Deferred, not scoped.** Built only after [E12.1](edl-brain-service.md)–[E12.4](instrumentation-drift-alerting.md)
> clear the standalone acceptance gate (see the epic's Success Criteria). Everything below is a
> target description, not a build-ready spec — most sections are intentionally left open until
> that gate clears and this feature is actually picked up.

## Purpose

Surface the agent in the content studio portal so dispatching a clip to it is a normal part of an
editor's workflow, not a side channel: editors see clips linked to a source, raise a ticket from a
clip, and a checkbox on the ticket sends it to the agent.

## Behavior

A checkbox on the ticket ("send to agent for editing") dispatches to the agent via MCP; the agent
edits and returns raw files into the review queue. The portal is the existing Next.js deployment
on Cloud Run; the repo can be shared/duplicated so Gareth and Jason can build alongside.

## Rules & Logic

[UNRESOLVED] Beyond the standalone-gate rule already covered in Behavior/Purpose, no rules are
defined yet — e.g. does the checkbox appear for every ticket, or only for tickets whose asset type
has a pilot DNA record (E12.3)? Dispatching to an asset type with no DNA record would have nothing
to check the EDL against.

## Data

[UNRESOLVED] The MCP contract — payload, auth, return path, large-file/timeout handling — is
explicitly deferred to Rhythm + Jason at build time. No schema exists yet.

## Failure Modes

[UNRESOLVED] To be enumerated with Jason during the Claude-integrations side project. The only
fixed principle carried over from the rest of the epic: draft render failures must fail loudly
into the queue, never silently drop a requested clip.

## Acceptance Criteria

[UNRESOLVED] Not defined — this feature doesn't start until the epic's standalone gate clears, at
which point it should get its own criteria (e.g. dispatch latency, MCP failure rate) rather than
inheriting E12.4's first-pass acceptance number, which measures the agent, not the integration.

## Open Questions

- **MCP contract** — payload, auth, return path, large-file handling (Rhythm + Jason, at build).
- **Draft storage & re-entry** — physical storage of rendered drafts and how they re-enter the
  portal's review queue.
- **Scope of the checkbox** — every ticket, or only pilot-asset-type tickets with DNA in place?

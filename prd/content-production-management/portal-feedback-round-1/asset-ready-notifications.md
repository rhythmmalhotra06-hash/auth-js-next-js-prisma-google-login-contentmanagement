---
title: 'Asset-ready notifications'
slug: 'asset-ready-notifications'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/asset-ready-notifications.build.md
---

# E9.4 · Asset-ready notifications

> **As-built note (Jun 29):** trigger = a **final** asset link attached (`addAsset` kind
> 'final'). Dedupe uses a **checkbox** "Asset Ready Notified" (`fld1STKbdnsSc4ovK`) — the
> dateTime field the API rejected was dropped. Channel #content-ready = `C0BDFM1SNDV`
> (env `SLACK_CONTENT_READY_CHANNEL_ID`, with that id as code fallback). Editor DM fires on
> manual assign + E9.6 auto-assign. Deploy needs bot scopes `chat:write` + `users:read.email`
> and the bot in the channel.

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Glenn's main pain over the last weeks: "visibility on what's being worked on and… notifying me when the asset is ready so that I can then prep my things on my end — thumbnail, copy — and then publish it." No notification system exists today. Chosen channel: **Slack DM** (a bot token is already configured in the repo, used by the slack-scan crawler).

## Behavior

1. New `lib/notify/slack.ts` with three best-effort senders, all using the existing `SLACK_BOT_TOKEN`:
   - `notifyRequesterAssetReady(ticket)` — **DM the requester** when the asset is ready.
   - `notifyEditorAssigned(ticket)` — **DM the assignee** when a ticket is assigned/auto-assigned to them.
   - `postAssetReadyToChannel(ticket)` — **post to the dedicated `#content-ready` channel** when an asset is ready.
2. Each resolves the relevant Slack user by email (`users.lookupByEmail`) and sends title + asset link + portal deep-link.
3. **Trigger = asset link attached.** The requester DM + the `#content-ready` channel post both fire when the editor **drops the asset/distribution link** on the ticket (the concrete "it's ready" signal), independent of the exact `ticket_status`. The editor DM fires on the **assignment** write path (intake auto-assign in E9.6, and manager assign/reassign).
4. Best-effort: each sender is wrapped in try/catch; failures are logged and never block the underlying write.

## Rules & Logic

- **Never blocks the write** — the Airtable write is the source of truth; the notification is a side effect.
- Fire the ready notifications **once** — when the asset link transitions from empty→present (guard on the transition, not the current state), so re-saving a ticket that already has a link does not re-notify. Use a `notifiedAt` stamp on the ticket to dedupe.
- The assignment DM fires once per assignee change (don't re-DM if the assignee is unchanged).
- Requester / assignee emails come from the ticket's requester / assignee linkage (already resolved in the ticket data layer).

## Data

- Uses `SLACK_BOT_TOKEN` (existing Kessel secret).
- New env: `SLACK_CONTENT_READY_CHANNEL_ID` for the dedicated **`#content-ready`** channel (channel must be created and the bot invited; set the ID via `kessel env set` before deploy).
- New ticket field `notifiedAt` (dateTime) to dedupe the ready notification across re-saves — live-base field on Prio Requests + field-map entry.

## Failure Modes

- **Requester not found in Slack** → log + skip (e.g. external requesters); do not error.
- **Slack API error / rate limit** → log + skip; the status write already succeeded.
- **Missing asset link at transition** → still notify with status, omit the link.

## Acceptance Criteria

- Dropping the asset link on a ticket sends the requester a Slack DM and posts to `#content-ready`, each with title + link.
- Assigning (or auto-assigning) a ticket DMs the assignee.
- A Slack failure leaves the underlying write intact and is logged.
- Re-saving a ticket that already has an asset link does not re-notify (guarded by `notifiedAt`).

## Open Questions

**Resolved (Jun 29):** Trigger is **asset link attached** (empty→present), not a specific `ticket_status`. Notify the **requester (DM)**, the **assignee on assignment (DM)**, and the **`#content-ready` channel (post)**. Dedupe with a `notifiedAt` ticket field. *(Dependency: create the `#content-ready` Slack channel + set `SLACK_CONTENT_READY_CHANNEL_ID`.)*

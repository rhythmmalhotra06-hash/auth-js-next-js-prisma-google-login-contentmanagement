---
prd: 'content-production-management/portal-feedback-round-1/asset-ready-notifications.md'
feature: 'E9.4 · Asset-ready notifications'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 4
total_steps: 4
---

# Build Log: E9.4 · Asset-ready notifications

## Approved Plan

Slack notifications via the existing bot token. Channel #content-ready = C0BDFM1SNDV.
Dedupe via a checkbox (not dateTime, which the API rejected): "Asset Ready Notified" =
fld1STKbdnsSc4ovK on Prio Requests.

Triggers (asset link attached = a FINAL asset URL is added):
- Requester DM + #content-ready channel post on first final asset (guarded by the checkbox).
- Editor DM on assignment (manual assignTicket + E9.6 auto-assign at create).

- **Step 1** — field-map: TICKETS.fields.assetReadyNotified.
- **Step 2** — lib/notify/slack.ts: low-level send (users.lookupByEmail, DM, channel post); best-effort.
- **Step 3** — lib/notify/triggers.ts: maybeNotifyAssetReady(ticketId, url) + notifyAssignment(ticketId, editorRecId); resolve emails from Employees.
- **Step 4** — wire into addAsset (final), assignTicket, createTicket (auto-assign).

Env: SLACK_CONTENT_READY_CHANNEL_ID (falls back to C0BDFM1SNDV). Verify: lint + build.

## Progress

- [x] Step 1: field-map assetReadyNotified
- [x] Step 2: slack low-level sender
- [x] Step 3: trigger orchestrators
- [x] Step 4: wire into asset/assign/create paths

## Result

Files created: 2 (`lib/notify/slack.ts`, `lib/notify/triggers.ts`).
Files modified: 3 (`lib/airtable/field-map.ts`, `app/tickets/[id]/actions.ts`, `app/intake/actions.ts`).
Live Airtable field: "Asset Ready Notified" checkbox (fld1STKbdnsSc4ovK) on Prio Requests.
Verification: `npm run lint` clean, `npm run build` passes.

## Deploy prerequisites (not code)
- Set `SLACK_CONTENT_READY_CHANNEL_ID=C0BDFM1SNDV` via `kessel env set` (code falls back to this id).
- Bot scopes required: `chat:write` (DMs + channel post) and `users:read.email` (email→user lookup).
- The bot must be a member of #content-ready (C0BDFM1SNDV).


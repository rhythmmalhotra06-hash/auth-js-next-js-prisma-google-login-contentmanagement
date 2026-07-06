# Wire up Slack automations with the current token — no scope change

## Context

You handed over the `contentportal` bot token and want the automations working, but
**you cannot change the bot's scopes.** Current scopes: `app_mentions:read, chat:write,
users:read`. The Slack code (E9.4 notifications) is already fully built and wired into real
flows — the only blocker was that it resolves people by **email**, which needs the
`users:read.email` scope we don't have.

**Live validation (done during planning):**
- `chat.postMessage` → works (`chat:write`). Channel posts + DMs-by-user-ID are fine.
- `users.lookupByEmail` → `missing_scope` (needs `users:read.email`). **Email lookup is out.**
- `users.list` → **works** with `users:read`, returns `id` / `real_name` / `display_name`
  (email omitted). **So we can resolve a Slack user by name instead of email.**
- `conversations.history` (media intake) → `missing_scope`. Intake stays off — genuinely
  needs `channels:history`, which we can't add. No change there; it already no-ops (501).

**The fix:** swap the email-based user lookup for a **name-based** one. Everything else in
[lib/notify/triggers.ts](lib/notify/triggers.ts) already fetches the employee's name, so the
change is contained to the resolver in [lib/notify/slack.ts](lib/notify/slack.ts).

What ships after this:
- **Assignment DM** — assign a ticket → editor gets a DM ([app/tickets/[id]/actions.ts:42](app/tickets/[id]/actions.ts#L42), [app/intake/actions.ts:94](app/intake/actions.ts#L94)).
- **Asset-ready** — attach a final asset link → requester DM **+** post to `#content-ready` ([app/tickets/[id]/actions.ts:80](app/tickets/[id]/actions.ts#L80)).

## Plan

### 1. Add a name-based user resolver — [lib/notify/slack.ts](lib/notify/slack.ts)
- Add `userIdByName(name)`: call `users.list` once, build a normalized map from
  `real_name`, `display_name`, and `name` → user id (lowercase, trimmed, collapse spaces).
  Cache the map in a module-level variable so repeated notifications don't refetch.
- Add `dmByPerson({ name, email }, text)` that DMs by resolved user id via the existing
  `chat.postMessage` path. Keep `dmByEmail` (harmless; returns null under current scopes) so
  the code still upgrades cleanly if `users:read.email` is ever granted — try email first,
  fall back to name.
- Stays **best-effort**: unresolved name → skip silently (channel post still lands for
  asset-ready), never throws, never blocks the ticket write.

### 2. Thread the name through — [lib/notify/triggers.ts](lib/notify/triggers.ts)
- `employeeContact()` already returns `{ name, email }`. Change the two `dmByEmail(email, …)`
  calls (requester in `maybeNotifyAssetReady`, editor in `notifyAssignment`) to
  `dmByPerson({ name, email }, …)`. No other logic changes; the asset-ready channel post and
  the "Asset Ready Notified" dedupe are untouched.

### 3. Config + deploy
```bash
kessel env secret SLACK_BOT_TOKEN=xoxb-…            # the current token
# Only if #content-ready is NOT the code default C0BDFM1SNDV:
# kessel env set SLACK_CONTENT_READY_CHANNEL_ID=<id>
kessel deploy
```
- **Invite the bot to `#content-ready`**: `/invite @contentportal` (needed for `chat:write`).
- Confirm `C0BDFM1SNDV` ([lib/notify/slack.ts:14](lib/notify/slack.ts#L14)) is `#content-ready`.
- Do **not** set `SLACK_MEDIA_CHANNEL_ID` — intake stays off (blocked on `channels:history`).

## Tradeoffs / notes
- **Name matching is fuzzy.** It matches Airtable employee names against Slack real/display
  names. Clean matches (e.g. "Vishen Lakhiani") work; nicknames or blank Slack names won't
  resolve → that person gets no DM, but the asset-ready **channel post still lands**.
  Assignment is DM-only, so an unresolved editor gets nothing (acceptable under best-effort;
  we can add a channel fallback later if it proves lossy).
- **Security:** the token was pasted in chat. You can regenerate it in the app's OAuth page
  (that reissues the token **without** touching scopes) and re-run the `kessel env secret`
  line — worth doing, not a blocker.

## Verification
- **Resolver sanity (local, read-only):** confirm `users.list` maps a known employee name to
  an id (already verified for "Vishen Lakhiani").
- **Assignment DM:** assign a ticket to an editor whose name matches their Slack name → DM arrives.
- **Asset-ready:** attach a **final** asset link → requester DM (if name resolves) **and** a
  post in `#content-ready`. Re-saving must not re-notify (Asset Ready Notified checkbox).
- **Intake:** `/api/media/slack-scan` still returns 501 "not configured" — expected; the
  hourly cron's `|| echo` keeps green.
- `kessel runtime-logs --since 15m` — watch for `[notify]` best-effort errors.

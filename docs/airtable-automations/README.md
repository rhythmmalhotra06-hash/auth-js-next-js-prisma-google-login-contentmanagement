# Inbound sync — Airtable Automations (Vishen's base → portal)

These two scripts are the **inbound** half of the two-way sync
(see [`plans/vishen-two-way-sync.md`](../../plans/vishen-two-way-sync.md)). They run as Airtable
Automation "Run a script" actions **inside Vishen's content base** (`appvBtCYdaSrD1y11`) and write
into the Creative Services base (`appFEFygXo2pRc8AR`) via the Airtable REST API. Running
Airtable→Airtable is deliberate: it sidesteps the IAP gate on the portal, so changes reflect
near-instantly without any OIDC/relay infrastructure.

The **outbound** half (portal → Vishen's base) lives in app code (`lib/media/vishen-sync.ts`) and
runs on every portal mutation.

## Why there's no infinite loop
- Automations live **only in Vishen's base**, so when the app writes to Vishen's base it does **not**
  trigger a write back into the app — there's no automation on the app side.
- Every write on **both** sides is **diff-guarded**: it compares against the current value and writes
  only changed fields. An equal-value write is skipped, so even the create→stamp step settles in one pass.
- `App Clip ID` marks app-originated clips; the clips automation skips them so generated clips
  aren't re-imported.

## Setup (do this once, in Vishen's base)

1. **Create a Personal Access Token** (https://airtable.com/create/tokens) — dedicated, least-privilege:
   - Scopes: `data.records:read`, `data.records:write`.
   - Access: the Creative Services base (`appFEFygXo2pRc8AR`) **and** Vishen's base (`appvBtCYdaSrD1y11`).
   - ⚠️ This token is stored in the automation's input config and is visible to base collaborators.
     Do **not** reuse the broad app token; use this scoped one.

2. **Automation 1 — Major Videos → Media Sources**
   - Trigger: *When a record is created or updated* on **Major Videos**.
   - Action: *Run a script* → paste [`major-videos-to-media-sources.js`](major-videos-to-media-sources.js).
   - Input variables: `recordId` = trigger record id · `apiKey` = the PAT.

3. **Automation 2 — Clips → Clip Suggestions**
   - Trigger: *When a record is created or updated* on **Clips**.
   - Action: *Run a script* → paste [`vishen-clips-to-clip-suggestions.js`](vishen-clips-to-clip-suggestions.js).
   - Input variables: `recordId` = trigger record id · `apiKey` = the PAT.

4. Turn both automations **on** and run each once with a test record.

## Field references (kept in sync with `lib/airtable/field-map.ts`)
- Media Sources correlation key: **Source Record ID** = the Major Video's record id.
- Clip Suggestions ⇄ Vishen Clips correlation: **Vishen Clip ID** (app side) / **App Clip ID** (Vishen side).
- Status map (Vishen → app): `Todo→Proposed`, `In progress→Approved`, `Done→Approved`.
- The scripts reference fields by **name**; if a field is renamed in Airtable, update the script.

## Backstop
The hourly `POST /api/media/sync-major-videos` job still runs as a safety net (idempotent upsert on
Source Record ID) in case an automation is disabled or errors. The automations are primary for
near-instant; the cron just catches anything missed.

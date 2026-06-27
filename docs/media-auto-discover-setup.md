# Auto-discover & Slack intake — setup

The Vishen media pipeline can auto-add new media to the 📺 Media Sources inbox from two sources:
- **YouTube channel** uploads → `POST /api/media/discover`
- **Slack channel** links → `POST /api/media/slack-scan`

It can also create tickets straight from Airtable:
- **Clip checkbox → ticket** → `POST /api/clips/convert` (see "Airtable checkbox → ticket" below)

All are deployed; they just need a **scheduler** to call them on a cadence. This requires Kessel-UI or
Google-Cloud access — it cannot be done from the Kessel CLI (no schedule command) and a plain external
cron is **blocked by IAP**.

## What the endpoints do

- `discover` queries Vishen's YouTube channel uploads.
- `slack-scan` reads a designated Slack channel (outbound, via the Slack Web API) for shared YouTube links.

Both insert new videos into 📺 Media Sources as `New` rows (`Submitted Via = Auto-discover` / `Slack`),
**deduped on Source URL**, and only *add rows* — they never run the clip engine, so they never spend
Anthropic tokens. A human still clicks "Suggest clips" in the portal.
Each returns JSON: `{ ok, scanned, added, failed }`.

## Two gates (both required)

1. **IAP (Google OIDC).** The Cloud Run service is IAP-gated, so the caller must send a Google-issued
   OIDC identity token: `Authorization: Bearer <oidc-token>`. Without it the request never reaches the
   app. (See the `deployed-app-behind-iap` note.)
2. **Shared secret.** The routes also check a header `x-discover-secret`, whose value is the Kessel env
   secret `DISCOVER_SHARED_SECRET` (already set; retrieve it from whoever holds it / the Kessel env —
   **do not commit it to this repo**).

## Config already in place (Kessel env)

| Key | Type | Value |
|-----|------|-------|
| `YOUTUBE_API_KEY` | secret | set |
| `DISCOVER_SHARED_SECRET` | secret | set (use as the `x-discover-secret` header) |
| `VISHEN_YT_CHANNEL_ID` | plain | `UCgAvK6yXl3BtasS9mS0kefQ` |
| `SLACK_BOT_TOKEN` | secret | **not set yet** (Slack intake) |
| `SLACK_MEDIA_CHANNEL_ID` | plain | **not set yet** (Slack intake) |

Endpoint base URL:
`https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-uc.a.run.app`

---

## Option A — Google Cloud Scheduler (recommended)

Needs GCP project access + a service account allowed through IAP. Run by whoever has console/gcloud.

1. **Service account** (or reuse one) allowed past IAP — grant `roles/iap.httpsResourceAccessor` on the
   IAP-secured resource.
2. **Create the job(s)** (hourly shown; one per endpoint, or one that hits both):

   ```bash
   gcloud scheduler jobs create http vishen-media-discover \
     --location=us-central1 \
     --schedule="0 * * * *" \
     --uri="https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-uc.a.run.app/api/media/discover" \
     --http-method=POST \
     --oidc-service-account-email="<SA>@<PROJECT>.iam.gserviceaccount.com" \
     --oidc-token-audience="<IAP_OAUTH_CLIENT_ID>" \
     --headers="x-discover-secret=<DISCOVER_SHARED_SECRET value>"
   ```

   - `--oidc-token-audience` must be the **IAP OAuth client ID** of the backend (Cloud Console → Security
     → Identity-Aware Proxy → the service → OAuth client). This is what makes the token pass IAP.
   - For Slack, create a second job with `--uri=.../api/media/slack-scan`.

3. **Test now:** `gcloud scheduler jobs run vishen-media-discover --location=us-central1`

## Option B — Kessel UI (if Kessel exposes scheduled jobs)

If the Kessel dashboard has a "Scheduled jobs / Cron" section, create one targeting the same URL(s) +
`POST`, with the IAP token handled by Kessel's service identity and the `x-discover-secret` header set.
(Scheduling is not available via the Kessel CLI.)

## Option C — GitHub Actions (workflow already in the repo)

`.github/workflows/media-auto-discover.yml` runs hourly (and on manual dispatch), mints a Google OIDC
token via **Workload Identity Federation**, and POSTs both `/api/media/discover` and
`/api/media/slack-scan`. It needs GCP to provision a WIF pool/provider + a service account with
`roles/iap.httpsResourceAccessor` — the same GCP access as Option A. Then set these **repo secrets**
(Settings → Secrets and variables → Actions):

| Secret | What |
|--------|------|
| `WIF_PROVIDER` | `projects/N/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| `WIF_SERVICE_ACCOUNT` | the SA email allowed past IAP |
| `IAP_OAUTH_CLIENT_ID` | backend IAP OAuth client ID (the OIDC **audience**) |
| `DISCOVER_SHARED_SECRET` | same value as the Kessel env secret |

Optional repo **variable** `DISCOVER_BASE_URL` overrides the service URL. Trigger a manual run from the
Actions tab to test.

---

## Slack intake (Phase 2) — channel scan

Because the app is IAP-gated, an inbound Slack slash-command/webhook would be blocked. Instead
`POST /api/media/slack-scan` reads a designated channel **outbound** via the Slack Web API and harvests
YouTube links into the inbox (`Submitted Via = Slack`), deduped on URL. It's invoked by the same
scheduler as discover (the Cloud Scheduler job and/or the GitHub Actions workflow already call it).

Setup:
1. Create a Slack app + bot with `channels:history` (public) and/or `groups:history` (private) scopes;
   install it and **invite the bot to the channel** people will drop links in.
2. Set Kessel env: `kessel env secret SLACK_BOT_TOKEN=xoxb-…` and
   `kessel env set SLACK_MEDIA_CHANNEL_ID=C0XXXXXXX` (the channel ID), then `kessel deploy`.
3. Until both are set the route returns `501` (the GitHub Actions workflow tolerates this and skips).

---

## Airtable checkbox → ticket — clip convert

Lets the team create a ticket from a clip **without opening the portal**: tick a box in Airtable
and the next cron run converts it. Because the app is IAP-gated (an inbound Airtable automation
can't clear IAP), this is **polled**, not a webhook — the ticket appears within the cron interval
(hourly by default), not instantly.

**How it works** (`POST /api/clips/convert`, same dual-gate auth as the others):
1. Scans 🎬 Clip Suggestions for rows where **Create Ticket** = checked and Status ≠ Dismissed.
2. Groups them by parent 📺 Media Source and, for each, creates one Prio Request ticket per clip via
   the same `createTicket()` invariant the portal uses (title = hook line, brief = hook/rationale/
   caption/clip range).
3. Links the new ticket back to the clip, flips the clip's Status to **Approved**, and **unticks**
   the box so it won't re-fire.
4. Returns JSON: `{ ok, scanned, created, failed }`.

**Taxonomy is inherited from the Media Source** (there's no modal in Airtable). Set these on the
📺 Media Sources row once; every clip's ticket reuses them:

| Media Source field | Required? | Used for |
|--------------------|-----------|----------|
| **Ticket Event Type** (link) | yes | ticket Event Type |
| **Ticket Asset Type** (link) | yes | ticket Asset Type |
| **Ticket Official Calendar** (link) | no | ticket Official Calendar |
| **Ticket Due Date** (date) | no | ticket due date (falls back to today + 7 days) |
| **Submitted By** (link → Employees) | requester | ticket "Requested By" |

If a source is missing the two required links or a requester, its clips are reported in `failed`
and stay ticked (they retry next run). The requester falls back to the optional Kessel env var
`DEFAULT_TICKET_REQUESTER_ID` (an Employee recId) when **Submitted By** is empty — useful for
auto-discovered sources that have no submitter.

The hourly GitHub Actions workflow already calls this endpoint alongside discover/slack-scan. To skip
the wait, the `/media` inbox has a **Convert checked now** button that runs the same conversion on demand.

## Verify it works

- Run a job once (Option A step 3, the UI "Run now", or the GH Actions manual dispatch).
- Expected: new `New` rows in 📺 Media Sources with the right `Submitted Via`; run twice and confirm
  **no duplicates** (URL dedupe).
- App logs: `kessel runtime-logs --since 10m` should show the POSTs.
- Then a human opens `/media`, picks a row, and clicks **Suggest clips**.

## Cadence

Hourly is fine (discover is ~1 YouTube quota unit/run; slack-scan is one Slack call). Daily is plenty if
uploads/links are infrequent.

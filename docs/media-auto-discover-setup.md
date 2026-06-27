# Auto-discover schedule — setup

The Vishen media pipeline can auto-add new YouTube uploads to the 📺 Media Sources inbox.
The code is deployed (`POST /api/media/discover`); it just needs a **scheduler** to call it on a
cadence. This step requires Kessel-UI or Google-Cloud access — it cannot be done from the Kessel CLI
(no schedule command) and a plain external cron will be **blocked by IAP**.

## What the endpoint does

`POST /api/media/discover` → queries Vishen's YouTube channel uploads, and inserts any new videos into
the 📺 Media Sources table as `New` rows (`Submitted Via = Auto-discover`), **deduped on Source URL**.
It only *adds rows* — it never runs the clip engine, so it never spends Anthropic tokens. A human still
clicks "Suggest clips" in the portal.

Returns JSON: `{ ok, scanned, added, failed }`.

## Two gates (both required)

1. **IAP (Google OIDC).** The Cloud Run service is IAP-gated, so the caller must send a Google-issued
   OIDC identity token: `Authorization: Bearer <oidc-token>`. Without it the request never reaches the
   app. (See the `deployed-app-behind-iap` note.)
2. **Shared secret.** The route also checks a header `x-discover-secret`, whose value is the Kessel env
   secret `DISCOVER_SHARED_SECRET` (already set; retrieve it from whoever holds it / the Kessel env —
   **do not commit it to this repo**).

## Config already in place (Kessel env)

| Key | Type | Value |
|-----|------|-------|
| `YOUTUBE_API_KEY` | secret | set |
| `DISCOVER_SHARED_SECRET` | secret | set (use as the `x-discover-secret` header) |
| `VISHEN_YT_CHANNEL_ID` | plain | `UCgAvK6yXl3BtasS9mS0kefQ` |

Endpoint URL:
`https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-uc.a.run.app/api/media/discover`

---

## Option A — Google Cloud Scheduler (recommended)

Needs GCP project access + a service account allowed through IAP. Run by whoever has console/gcloud.

1. **Service account** (or reuse one) that is allowed past IAP — grant it
   `roles/iap.httpsResourceAccessor` on the IAP-secured resource.
2. **Create the scheduled job** (hourly shown; adjust cron as desired):

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
   - Put the real secret in `--headers` (Cloud Scheduler stores it; not committed here).

3. **Test now:** `gcloud scheduler jobs run vishen-media-discover --location=us-central1`

## Option B — Kessel UI (if Kessel exposes scheduled jobs)

If the Kessel dashboard has a "Scheduled jobs / Cron" section (Settings), create one targeting the same
URL + `POST`, with the IAP token handled by Kessel's own service identity and the `x-discover-secret`
header set to the secret value. (Scheduling is not available via the Kessel CLI.)

## Option C — GitHub Actions fallback (only if A/B aren't available)

A scheduled workflow can mint a Google OIDC token via **Workload Identity Federation** and curl the
endpoint. This still requires GCP to provision: a WIF pool/provider, a service account with
`roles/iap.httpsResourceAccessor`, and the IAP OAuth client ID — i.e. the same GCP access as Option A.
Without those it cannot pass IAP. Scaffold on request.

---

## Verify it works

- Run the job once (Option A step 3, or the UI "Run now").
- Expected: new `New` rows in 📺 Media Sources with `Submitted Via = Auto-discover`; run it twice and
  confirm **no duplicates** (URL dedupe).
- App logs: `kessel runtime-logs --since 10m` should show the POST to `/api/media/discover`.
- Then a human opens `/media`, picks a row, and clicks **Suggest clips**.

## Cadence

Hourly is fine (cheap: ~1 YouTube quota unit/run). Daily is plenty if uploads are infrequent.

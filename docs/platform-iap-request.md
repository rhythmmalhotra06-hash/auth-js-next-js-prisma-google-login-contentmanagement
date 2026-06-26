# Platform-team request: IAP access to schedule the reference sync

**Status:** open — blocking automated scheduling of the Airtable reference sync.

## Background

The app needs a nightly automated call to its own `POST /api/sync/reference`
endpoint (one-way Airtable → Postgres pull of reference data). The deployed
Cloud Run service is behind Google **IAP**, so an external scheduler (e.g. GitHub
Actions) is rejected at the IAP layer (`401 Invalid IAP credentials`) before
reaching the app — even though the endpoint already enforces a `SYNC_SECRET`
bearer token as a second factor.

Confirmed blockers:
- `kessel job` does not apply — this is a Cloud Run **Service**, not a Job.
- The Kessel CLI has no native cron/scheduler.
- No GCP Console access on our side to configure IAP / Cloud Scheduler / WIF.

The GitHub Actions scaffold is ready at
[.github/workflows/reference-sync.yml](../.github/workflows/reference-sync.yml)
(schedule commented out, manual-dispatch only). Repo already has the
`SYNC_SECRET` secret and `APP_URL` variable configured.

---

## Message to send the platform / Kessel team

> **Subject: IAP access to schedule a sync job for the Content Management app**
>
> Hi team — I have a Kessel-deployed Next.js app (Cloud Run **Service**) that
> needs a nightly automated call to one of its own endpoints, and it's behind
> IAP, so an external scheduler can't reach it. I'd like your help enabling that.
>
> **Service details**
> - Kessel project: `auth-js-next-js-prisma-google-login-ContentManagement`
>   (project id `73a72afa-3d8f-40a4-afda-d4c038010760`)
> - Cloud Run service: `auth-js-next-js-prisma-google-login-cont-73a7`
> - URL: `https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-uc.a.run.app`
> - Endpoint to call: `POST /api/sync/reference` (pulls reference data from
>   Airtable; idempotent, read-only externally). It already requires a
>   `SYNC_SECRET` bearer token as a second factor — IAP is the only thing
>   blocking us.
>
> **What I need — whichever is easier on your side:**
>
> 1. **Cloud Scheduler (preferred — fully GCP-native, nothing leaves GCP):** a
>    Cloud Scheduler cron job (e.g. daily 02:00) that POSTs to the endpoint above
>    with an **OIDC token** from a service account that has the **IAP-secured Web
>    App User** role on this service. If you set this up, I don't need any
>    credentials at all.
>
> 2. **Or, so I can run it from GitHub Actions:** a service account with the
>    **IAP-secured Web App User** role on this service, **plus the IAP OAuth
>    client ID** (the token audience). Ideally wired via **Workload Identity
>    Federation** for GitHub repo
>    `rhythmmalhotra06-hash/auth-js-next-js-prisma-google-login-contentmanagement`
>    (so no long-lived key). A SA JSON key works too if WIF isn't available.
>
> Happy to hop on a quick call. Thanks!

---

## After they respond

- **If they pick option 1 (Cloud Scheduler):** nothing more to do — the schedule
  runs entirely in GCP.
- **If they pick option 2 (GitHub Actions):** add the IAP client ID as repo var
  `IAP_AUDIENCE` and the SA key as secret `GCP_SA_KEY` (or confirm WIF), then
  add a `google-github-actions/auth` step to mint an ID token, send it as the
  `Authorization` header, and uncomment the `schedule:` trigger in the workflow.

---

# Second request: managed-DB connection for the one-time backfill

**Status:** open — blocking the historical ticket/asset backfill.

Separate from scheduling, we need to run the **one-time** historical migration
(`scripts/migrate-history.ts` — live Airtable pull, ~10.4k tickets + ~15k assets)
directly against the managed Postgres. It can't go through the IAP-gated HTTP
endpoint, and the local CLI only sees `localhost`. Reference data is already
seeded in the managed DB; only `tickets`/`assets` remain empty.

> **Ask:** a connection to the managed Postgres for a one-off run — either a
> short-lived **Cloud SQL Auth Proxy** session, or a temporary direct
> `DATABASE_URL` (host/port/db/user/password) scoped to my account. Instance:
> `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`,
> database `js_next_js_prisma_google_login_dev`. I only need it long enough to
> run the backfill once (it's idempotent, so re-runs are safe).

Once I have it, see the runbook below. No long-lived credential is required.

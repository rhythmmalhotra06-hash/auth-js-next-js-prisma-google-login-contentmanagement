# Platform-team request: co-locate the app in the DB's region (asia-southeast1)

**Status:** open — the app and its database are in different GCP regions, and
the cross-region latency is the root cause of the recurring timeouts / 503-OOM
issues.

## Background

The deployed Cloud Run service runs in **us-central1**, but its managed Postgres
is a shared Cloud SQL instance in **asia-southeast1**. Every database round trip
therefore crosses the Pacific (~150–180ms RTT). For a Prisma workload that makes
several queries per request, that latency compounds and is what drove the recent
app-level workarounds (streaming backfill, bulk reference-join rebuild) — those
reduced the number of round trips but can't fix the per-trip latency floor.

The proper fix is **co-location**: run the app in `asia-southeast1`, next to the
database. The DB can't move — it's a shared instance serving all Mindvalley
Kessel apps.

Confirmed blockers on our side:
- The **Kessel CLI has no region control** — there is no `--region` flag on
  `kessel init`, `kessel deploy`, or `kessel run`. Region was defaulted to
  us-central1 at project creation.
- **No GCP Console access** on our side to move/recreate the Cloud Run service.

---

## Service details

- Kessel project: `auth-js-next-js-prisma-google-login-ContentManagement`
  (project id `73a72afa-3d8f-40a4-afda-d4c038010760`)
- Cloud Run service: `auth-js-next-js-prisma-google-login-cont-73a7`
- **Current region:** `us-central1`
- **Target region:** `asia-southeast1` (to match the DB)
- URL: `https://auth-js-next-js-prisma-google-login-cont-73a7-jdtcvngavq-as.a.run.app`
- DB instance: `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`,
  database `js_next_js_prisma_google_login_dev`

---

## Message to send the platform / Kessel team

> **Subject: Move the Content Management app to asia-southeast1 (co-locate with its DB)**
>
> Hi team — my Kessel-deployed Next.js app is in **us-central1**, but its managed
> Postgres is the shared Cloud SQL instance in **asia-southeast1**. Every query
> crosses regions (~150–180ms RTT), which is causing request timeouts and the
> occasional 503/OOM on data-heavy pages. I'd like the app **redeployed in
> asia-southeast1** so it sits next to the DB. The Kessel CLI doesn't expose a
> region flag and I don't have GCP Console access, so I need your help.
>
> **Service details**
> - Kessel project: `auth-js-next-js-prisma-google-login-ContentManagement`
>   (project id `73a72afa-3d8f-40a4-afda-d4c038010760`)
> - Cloud Run service: `auth-js-next-js-prisma-google-login-cont-73a7`
> - Current region: `us-central1` → target: `asia-southeast1`
> - DB: `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`,
>   database `js_next_js_prisma_google_login_dev`
>
> **What I'm hoping for:** keep the same project, database, and (ideally) the
> same URL — just relocate the running service to asia-southeast1.
>
> **A few questions so I know what to expect:**
> 1. Is region selectable on Kessel at all, or fixed per project?
> 2. Can it be changed in place, or does it require recreating the project? If
>    recreating — can the existing shared DB stay attached, and can the URL be
>    preserved?
> 3. Any expected downtime during the move?
>
> Happy to hop on a quick call. Thanks!

---

## After they respond

- **If the region is changed in place (same URL):** just verify — run
  `kessel status` and confirm `Region: asia-southeast1`, then load a data-heavy
  view (queue / prioritization board) and confirm it responds sub-second.
- **If the URL changes** (new project/service): update the follow-ups that
  depend on the old URL —
  - OAuth **callback/redirect URLs** (Google sign-in) for the new domain,
  - the `APP_URL` var,
  - the **IAP** configuration referenced in
    [platform-iap-request.md](platform-iap-request.md) (the scheduled sync
    targets this service's URL).

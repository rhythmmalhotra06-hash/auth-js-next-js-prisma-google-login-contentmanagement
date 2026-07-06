# Co-locate the app in the DB's region (asia-southeast1)

## Context

The deployed app and its database sit in different GCP regions, and every
Prisma query pays the cross-region round trip:

- **App:** Cloud Run service in **us-central1** (`auth-js-next-js-prisma-google-login-cont-73a7`, URL `…-uc.a.run.app`).
- **DB:** shared Cloud SQL instance in **asia-southeast1** — `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`.

us-central1 ↔ asia-southeast1 is ~150–180ms RTT. For chatty Prisma workloads
that latency compounds per round trip and is the root cause behind the recent
"cross-region fix" / 503-OOM / streaming-backfill commits (#49, #51) — those
were app-level band-aids, not a fix for the latency floor.

**The proper fix is co-location.** The DB can't move (it's a shared instance
serving all Mindvalley Kessel apps), so the app must move to asia-southeast1.

**Blocker:** the Kessel CLI exposes **no region control** — verified there is no
`--region` flag on `init`, `deploy`, or `run`. Region was defaulted to
us-central1 at project creation and is platform-controlled. There's no GCP
Console access on our side. So this is a platform-team ask, exactly like the
existing IAP request. (Decided with user: platform-team request, not a
disruptive re-init that would mint a new project/URL and detach from the DB.)

## Deliverable

Create `docs/platform-region-request.md` — a ready-to-send request modeled on
the existing [docs/platform-iap-request.md](../Documents/GithubDev/ContentManagement/docs/platform-iap-request.md),
so it can be pasted into Slack/email to the Kessel/platform team.

### Content of the doc

- **Status / Background:** app in us-central1, shared DB in asia-southeast1;
  cross-region latency causing timeouts/OOM; CLI has no region flag; no GCP
  Console access.
- **Service details** (copy exact identifiers from `kessel status`):
  - Kessel project: `auth-js-next-js-prisma-google-login-ContentManagement`
    (id `73a72afa-3d8f-40a4-afda-d4c038010760`)
  - Cloud Run service: `auth-js-next-js-prisma-google-login-cont-73a7`
  - Current region: `us-central1`
  - DB instance: `mv-ai-gateway:asia-southeast1:cloudsql-asse1-mv-kessel-apps-fccf1fe4`,
    database `js_next_js_prisma_google_login_dev`
- **The ask:** redeploy/recreate this project's Cloud Run service in
  **asia-southeast1**, co-located with the shared Cloud SQL instance, keeping
  the same project, database, and (ideally) URL. If a new URL is unavoidable,
  note the follow-ups that break: OAuth callback URLs, `APP_URL` var, and the
  IAP config from the other open request.
- **Questions to surface to them:** Is region selectable at all on Kessel, or
  fixed per project? Can it be changed in place, or does it require a
  new project (and if so can the shared DB stay attached)? Any expected
  downtime / URL change?

## Files

- **New:** `docs/platform-region-request.md` (the request doc + paste-ready message).
- No application code changes — this is an infrastructure/platform action.

## Verification

- Nothing to run now (the move is executed by the platform team).
- **After they act:** run `kessel status` and confirm `Region: asia-southeast1`.
  Then load a data-heavy view (e.g. the queue/prioritization board) and confirm
  the previously slow/timeout-prone pages respond sub-second — the cross-region
  latency floor should be gone.
- If the URL changed, re-check OAuth sign-in and update `APP_URL` accordingly.

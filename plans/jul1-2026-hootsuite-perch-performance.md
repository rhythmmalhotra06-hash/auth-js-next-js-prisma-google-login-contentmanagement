# Hootsuite Perch → the performance loop (Phase 2 of the Vishen view)

> ⚠️ **Source superseded (Jul 1):** the chosen source is now **Postiz (open-source)** —
> see `plans/jul1-2026-postiz-performance.md`. This doc is kept for the Hootsuite context
> and the reusable **hybrid attribution** + **IG-first** decisions, which still hold.
> Also note: Meta deprecated the IG `impressions` metric (2025-04-21) → all sources return **views**.

## Context

The Vishen end-to-end view (`plans/jul1-2026-vishen-end-to-end-view.md`, mock at `context/mockups/vishen-tracker.html`) shows each request through to **published + how it performed**. The performance half was the product's long-standing gap. It is now **unblocked**: Glen shared Hootsuite's MCP-connector doc — **Perch** (`https://mcp.hootsuite.com/perch`, *social publishing and analytics*, OAuth/DCR) is the impressions + engagement source. See [[performance-loop-data-source]].

**Decisions locked with the user (Jul 1):**
- **Attribution = hybrid.** Match by **published URL now**, migrate to native **Hootsuite post IDs later** — store both keys so the switch is seamless.
- **Scope = IG-first.** Instagram only for v1 (Vishen Lakhiani IG + Mindvalley IG), metrics = **impressions + engagement rate** (not views). YouTube/LinkedIn later.

**What already exists to build on:**
- `performance` table + `model Performance` in [prisma/schema.prisma:392](prisma/schema.prisma#L392) — but it's `asset_id`-FK'd to `assets` and unused; our tracker is ticket-keyed, so we add a purpose-built table rather than force-fit it.
- Cron pattern to copy: bearer-secret POST, `runtime='nodejs'`, `maxDuration=300`, `SYNC_SECRET` — [app/api/metrics/refresh/route.ts](app/api/metrics/refresh/route.ts) + `refreshTicketMetrics()` in [lib/metrics/snapshot.ts](lib/metrics/snapshot.ts).
- The mock's `markPublished(id, url)` flow — the production "add live link → mark published" action is where the published URL enters the system.

---

## Step 0 — Spike first (the feasibility gate)

Before building anything, **connect Perch and confirm two unknowns** — both determine whether the plan holds:

1. **Programmatic access.** The doc describes Perch as an *interactive* MCP custom connector (browser OAuth/DCR). Our ingestion is a headless cron — confirm the non-interactive path: a storable **refresh token / service credential**, or an MCP client we can call server-side. If neither exists, fall back to Hootsuite's REST Analytics API with an OAuth app (the old "blocked on Glenn" path).
2. **Can Perch resolve a post by public URL?** The hybrid "URL now" leg depends on it. If Perch only keys by internal post ID, then **URL-matching is not viable** and we must move the post-ID leg forward (publish-through-Hootsuite becomes required sooner). Test with a known live IG post.

Also confirm with Glenn/Marisha that the org's Hootsuite plan includes **Perch analytics** access.

Output of the spike: a one-pager answering the above → confirms or revises Steps 1–4.

### Step 0 handoff — connect Perch (Glen)  ⏳ WAITING ON GLEN

> **Status:** message sent to Glen. Resume Steps 1–4 once he reports back the URL-lookup answer.

**What I need from Glen:**
1. Confirm our Hootsuite plan includes **Perch / analytics** access.
2. Either add rhythm as a Hootsuite user with analytics access to **Vishen Lakhiani IG + Mindvalley IG**, or sign in live during the connect flow (it needs a Hootsuite login).

**Connect Perch** (in the Claude account we'll run this from — rhythm@mindvalley.com; Glen just authenticates with the Hootsuite login when prompted):
1. Claude → **Settings → Connectors**
2. **Add custom connector**
3. Name: `Hootsuite Perch`
4. URL: `https://mcp.hootsuite.com/perch`
5. Transport (if asked): **Remote HTTP** / **Streamable HTTP**
6. Complete the **Hootsuite OAuth** sign-in + approve permissions
7. Confirm **Connected** and tools appear (enable pop-ups — sign-in opens in one)

**The two go/no-go tests, run once connected:**
1. Returns IG analytics at all? — *"Show recent Instagram performance for Vishen Lakhiani and Mindvalley — impressions and engagement rate."*
2. **Make-or-break — lookup by public URL?** (paste a real live IG post link) — *"For this Instagram post [URL], what were the impressions and engagement rate? Can you look up a post by its public URL, or only by a Hootsuite post ID?"*

**Report back:** (a) plan includes Perch analytics? (b) did test #2 return numbers **from the URL**? (c) any error.

**Decision:** URL works → hybrid "URL now" is GO, build Steps 1–4. URL fails (post-ID only) → team publishes through Hootsuite to capture the post ID; rework the attribution step (Step 2) before building.

---

## Step 1 — Data model (app-owned, time-series)

New Postgres table `social_metrics` (Prisma model `SocialMetric`) — a time-series so we can show trend/sparkline, not just a latest value:

```
social_metrics(
  id uuid pk,
  ticket_airtable_id text,        -- the Creative Services ticket (join key to the tracker)
  published_url      text,        -- Phase-A key (the pasted live link)
  hootsuite_post_id  text,        -- Phase-B key (native, exact)
  channel            text,        -- 'Vishen Lakhiani IG' | 'Mindvalley IG'
  impressions        bigint,
  engagement_rate    numeric,     -- percent
  captured_at        timestamptz default now(),
  source             text         -- 'hootsuite:perch'
)
```
- Keep **published URL app-side** (here), so we add **no new Airtable field** for the link. Reuse the existing Airtable `publishedAt` ("📅 Published Date", `TICKETS.fields.publishedAt`) for the published date; the URL + metrics live in Postgres.
- Index on `(ticket_airtable_id, captured_at)` and on `published_url`.

---

## Step 2 — Capture the published URL (extends the mock flow)

Production version of `markPublished`: a server action that, when the team adds a live link on a "Ready to release" item —
1. writes the URL + channel into `social_metrics` (a seed row, metrics null), keyed by `ticket_airtable_id`;
2. sets Airtable `publishedAt` and flips `ticketStatus` → Done/Shipping (reuse existing fields, per [lib/social/repository.ts](lib/social/repository.ts) + `TICKETS.fields`);
3. cross-system: if the item came from a Content & Comms Social row, flip the linked Creative ticket too ([[content-comms-prio-is-synced]]).

Until the first Perch capture lands, the view shows the **"pending… ~24h"** state already mocked.

---

## Step 3 — Ingestion cron (mirror the metrics/refresh pattern)

New route `app/api/metrics/social/route.ts`, copying [app/api/metrics/refresh/route.ts](app/api/metrics/refresh/route.ts) (bearer `SYNC_SECRET`, `runtime='nodejs'`, `maxDuration=300`). Logic in `lib/metrics/social-perf.ts`:
- Read seed rows from `social_metrics` still awaiting metrics (IG only for v1).
- For each, ask Perch for impressions + engagement — **by `hootsuite_post_id` if present, else by `published_url`** (the hybrid key).
- Upsert a new time-series row (append captured_at); backfill `hootsuite_post_id` when Perch returns it, so future pulls use the exact key.
- Batch + backoff politely.

**Scheduling:** the deployed app is IAP-gated, so an external scheduler needs a Google OIDC token — see [[metrics-snapshot-iap-cron]] / [[deployed-app-behind-iap]]. Reuse whatever mechanism the nightly `metrics/refresh` ends up using.

---

## Step 4 — Surface in the view

- Add a selector in `lib/studio/data.ts` (alongside the Vishen-request selectors) that joins the latest `social_metrics` per ticket into the tracker rows.
- React port reads impressions + engagement + the time-series for the drawer sparkline. The mock (`vishen-tracker.html`) is the visual target — performance card labelled "via Hootsuite," pending state, top-performer band.

---

## Open questions / dependencies

1. **Perch programmatic + URL-lookup capability** — resolved by Step 0; gates the whole approach.
2. **Hootsuite plan access** — confirm with Glenn/Marisha.
3. **IAP scheduling** for the new cron.
4. **Engagement-rate definition** — confirm Perch's engagement metric matches how the team reports it (Glen: they report engagement rate + impressions, never views).

## Verification

- Step 0 spike: connect Perch, pull metrics for one known IG post by URL and by ID.
- End-to-end: mark a test item published with a real IG URL → seed row created → run `POST /api/metrics/social` → confirm impressions + engagement land in `social_metrics` → appear on the ticket in the tracker with a trend sparkline.
- Confirm the "pending ~24h" state shows before the first capture and clears after.

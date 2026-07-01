# Vishen view + performance loop (Postiz) — build now, one Phase 1

> Supersedes the **source choice** in `plans/jul1-2026-hootsuite-perch-performance.md` (Hootsuite → Postiz)
> and pulls the performance loop **into the initial build** (no separate deferred Phase 2).
> The view build itself is scoped in `plans/jul1-2026-vishen-end-to-end-view.md`.

## Context

Because the performance source is now an **open-source, self-hosted tool (Postiz)** — free, no per-seat/plan gate, data owned locally — there's no reason to defer it. We build the full loop now.

**Why building now carries no risk of rework:** manual entry and Postiz auto-entry write to the **same `social_metrics` table** and render through the **same UI**. So the loop is *useful on day one* (team logs numbers by hand — already mocked in `context/mockups/vishen-tracker-manual.html`) and **upgrades to automated with zero rework** once Postiz + the Meta app connection is live. Same schema, same components, one build.

**Findings that shape it:**
- **`impressions` is gone.** Meta deprecated the IG `impressions` metric on **2025-04-21** → universal **`views`**. Every source (Postiz, Hootsuite, direct Graph API) now returns **views + engagement/reach**, not impressions. Report **views + engagement rate**; flag to Glen/Marisha.
- Carry-over decisions: **hybrid attribution** (match by URL now, exact post-id later) and **IG-first** (Vishen Lakhiani IG + Mindvalley IG).

## Two tracks, run in parallel

**Track A — app code (build now, nothing blocks it):**
1. **Data model** — `social_metrics` / Prisma `SocialMetric` (existing `model Performance` is asset-FK'd + unused, so add rather than force-fit; mirror [prisma/schema.prisma](prisma/schema.prisma)): `ticket_airtable_id`, `published_url` (Phase-A key), `platform_post_id` (Phase-B key), `channel`, **`views`**, `engagement_rate`, `captured_at`, `source` (`'manual'` | `'postiz'`). Index `(ticket_airtable_id, captured_at)` + `published_url`.
2. **Publish + manual-entry actions** — production of the mock flows: "mark published" writes a seed row + sets Airtable `publishedAt` + flips `ticketStatus` (reuse existing fields in [lib/social/repository.ts](lib/social/repository.ts) / `TICKETS.fields` — no new Airtable field); "log numbers" writes a `source='manual'` row. Cross-system flip for Content&Comms-origin rows ([[content-comms-prio-is-synced]]).
3. **Ingestion adapter** — `app/api/metrics/social/route.ts` mirroring [app/api/metrics/refresh/route.ts](app/api/metrics/refresh/route.ts) (bearer `SYNC_SECRET`, `runtime='nodejs'`, `maxDuration=300`), logic in `lib/metrics/social-perf.ts`: pull Postiz's analytics REST API → match seeds **by `platform_post_id` if known, else `published_url`** → upsert time-series (`source='postiz'`, backfill `platform_post_id`). Written now against Postiz's documented API; goes live when Track B lands. Schedule minding IAP ([[metrics-snapshot-iap-cron]]).
4. **Surface** — selector in [lib/studio/data.ts](lib/studio/data.ts) joins latest `social_metrics` per ticket into the tracker; React port reads views + engagement, drawer trend from the time-series. Visual target = the mocks. Ship the whole Vishen view per `plans/jul1-2026-vishen-end-to-end-view.md`.

**Track B — the gated connection (start in parallel; only this has lead time):**
- Self-host **Postiz** (Docker; small VM or a Kessel service); confirm the analytics API returns per-post **views + engagement + reach** for connected IG accounts.
- **Meta developer app** + connect **Vishen Lakhiani IG + Mindvalley IG** (Business/Creator, linked to FB Pages) with `instagram_basic` + `instagram_manage_insights`. **App Review lead time is the only real schedule risk.**

Until Track B is live, the loop runs on **manual entry** — no gap in the product.

## Open items

- **Metric wording** (views vs impressions) → Glen/Marisha reporting-standard call.
- **Postiz hosting** (Kessel vs standalone VM); **Meta App Review** lead time; **IAP scheduling** for the cron.

## Verification

- App code (now): mark a test item published → seed row; log numbers manually → `source='manual'` row shows on the ticket + in the reach/engagement band + drawer.
- Once Track B lands: run `POST /api/metrics/social` → a known IG post's views + engagement upsert as `source='postiz'` and replace/augment the manual value on the same ticket — no UI change.

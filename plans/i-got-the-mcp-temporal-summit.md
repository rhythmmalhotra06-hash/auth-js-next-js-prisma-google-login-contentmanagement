# Hootsuite Perch → performance loop (connector-sourced, Studio-first)

## Context

The performance loop — every published asset carrying live numbers — is the product's stated
differentiator (PRD **E7**, `prd/content-production-management/performance-loop.md`) and is the
largest unbuilt feature. There is no `SocialMetric` table, no ingest route, and `model Performance`
in `prisma/schema.prisma` is dead code. The stakeholder and Studio surfaces show placeholders.

The blocker was always the data source. That blocker is gone: Hootsuite's **Perch MCP server is
live** and probed working.

```
POST https://mcp.hootsuite.com/perch
→ 401  www-authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/perch"

https://platform.hootsuite.com/.well-known/oauth-authorization-server
→ authorization_endpoint /oauth2/auth · token_endpoint /oauth2/token
  registration_endpoint  /oauth2/register        (open dynamic client registration)
  scopes_supported       ["offline", "analytics:read"]
  code_challenge_methods ["S256"]
```

Three conclusions:
1. **It works.** Live MCP over streamable HTTP with standard OAuth 2.1 + DCR — exactly what the
   claude.ai connector flow consumes. `/nest` is live too; `/lumen` redirects to Talkwalker's own MCP.
2. **`analytics:read` is the only data scope on this resource** — read-only analytics, which is
   precisely the leg we need. Perch publicly advertises impressions, engagement, clicks and
   follower growth, plus "top posts by impressions".
3. **`offline` is supported**, so a stored refresh token could drive a cron later. We are *not*
   building that now (decision below), but it means automating later is a small delta, not a rewrite.

**Decisions taken for this round:**
- **Source = the claude.ai Perch connector, not app-side OAuth.** No OAuth code, no token storage,
  no Meta App Review, no TikTok audit — Hootsuite already holds the platform tokens. The app gets a
  *sink*; Claude (or a person) is the *source*.
- **Store every metric, show the best available.** Glen asked for impressions + engagement rate;
  Meta killed IG `impressions` in Apr 2025 and `studio-redesign.html` says views. All columns
  nullable ends the argument instead of relitigating it.
- **First surface = the Studio "Live & performing" band** (`plans/jul1-2026-studio-elevation.md`,
  `context/mockups/studio-redesign.html` L433-506). Highest visibility to Vishen, and
  `VishenVideo.publishedLink` already exists as the join key.
- Postiz (`plans/jul1-2026-postiz-performance.md`) stays the documented fallback, unbuilt.

**Outcome:** a structured metrics table with one ingest path that manual entry, a Claude-connector
pull, and (later) an automated adapter all write through identically — and the Studio band reading
from it.

---

## Phase 0 — Perch capability spike (blocking, needs an interactive session)

The Perch tool list is behind auth, so it cannot be read from here. **This session is
non-interactive and the Hootsuite connector is not authorized** — you must add it in
claude.ai → Settings → Connectors first (paste `https://mcp.hootsuite.com/perch`, sign in to the
Hootsuite workspace; authorization is one-time).

Then, in an interactive session, run and record:
- `tools/list` — exact tool names + parameter schemas.
- One analytics call per connected profile (Vishen Lakhiani IG, Mindvalley IG at minimum).

Write findings to **`context/hootsuite-perch-capabilities.md`**, answering:
1. **Per-post or profile-only?** Does any tool return a row per post, and does that row carry a
   stable **post id** and/or the **public permalink**? This decides whether attribution is exact or
   fuzzy — the single biggest unknown.
2. **Does it cover natively-posted content**, or only posts Hootsuite published? (The open question
   from the AskUserQuestion round — verify, don't assume.)
3. **Which metric names come back**, and whether `impressions` is populated on IG or null.
4. **Date-range parameters** and any window semantics (24h / 30d / lifetime).
5. Whether the org's plan actually entitles Perch analytics (an entitlement error here is the one
   outcome that sends us back to Postiz).

Phase 1–3 below are independent of the answers and can start in parallel; Phase 4 depends on them.

---

## Phase 1 — `SocialMetric` table

`prisma/schema.prisma` — add alongside the existing models (do **not** force-fit `model Performance`;
it is asset-FK'd and unused, per `plans/jul1-2026-postiz-performance.md`):

```prisma
model SocialMetric {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  // keys, most precise first
  platformPostId   String?  @map("platform_post_id")
  publishedUrl     String?  @map("published_url")
  vishenVideoId    String?  @map("vishen_video_id")
  ticketAirtableId String?  @map("ticket_airtable_id")
  channel          String?
  // metrics — all nullable; store what the source gives
  impressions      Int?
  views            Int?
  reach            Int?
  engagements      Int?
  engagementRate   Decimal? @map("engagement_rate") @db.Decimal(6, 3)
  clicks           Int?
  // provenance
  windowDays       Int?     @map("window_days")
  capturedAt       DateTime @map("captured_at")
  source           String   // 'manual' | 'hootsuite:perch'
  enteredBy        String?  @map("entered_by")
  raw              Json?
  dedupeKey        String   @unique @map("dedupe_key")

  @@index([publishedUrl, capturedAt])
  @@index([vishenVideoId, capturedAt])
  @@index([ticketAirtableId, capturedAt])
  @@map("social_metrics")
}
```

`dedupeKey` = `` `${source}:${platformPostId ?? publishedUrl}:${windowDays ?? 'life'}:${YYYY-MM-DD}` ``
— upsert on it so re-running a pull the same day updates instead of duplicating.

**Migration:** this project has **no `_prisma_migrations`** — DDL goes in as raw SQL through
`kessel db migrate <file.sql>` (see `plans/full-portal-postgres-migration.md` and the
`0008_metric_snapshots` precedent), then `npx prisma generate`. Do not run `prisma migrate deploy`.

---

## Phase 2 — the ingest path (one door for every source)

**`lib/metrics/social-perf.ts`** (new) — mirrors the shape of `lib/metrics/snapshot.ts`:
- `type SocialMetricInput` — the fields above minus `id`/`dedupeKey`, with `source` required.
- `ingestSocialMetrics(rows: SocialMetricInput[]): { upserted, matched, unmatched }` —
  normalizes the URL (strip query/trailing slash), resolves the owner in this order:
  `platformPostId` → `publishedUrl` → explicit `vishenVideoId`/`ticketAirtableId`; computes
  `dedupeKey`; batch `upsert`. `channel` comes from the caller — the manual action passes the
  video's already-derived `channel` (`deriveChannel(publishedLink, medium)`,
  `lib/media/vishen-videos.ts:92`), so there is no second channel vocabulary here.
  Rows that match nothing are still stored (with `vishenVideoId = null`) and counted as `unmatched`
  so a bad permalink is visible instead of silently dropped.
- `getLatestMetrics(videoIds: string[])` — latest row per video (window-aware), for the read side.
- `summarizeBand(rows)` — Σ impressions, Σ views, avg engagement rate, published count, top
  performer. Primary tile = impressions when any row has it, else views, and the **label follows the
  data** ("Total reach" vs "Total views") so the two mockup generations both stay honest.

**`app/api/metrics/social/route.ts`** (new) — `POST`, Bearer `SYNC_SECRET`, `runtime = 'nodejs'`,
`dynamic = 'force-dynamic'`, `maxDuration = 300`; body `{ rows: SocialMetricInput[] }`; returns the
ingest counts. This is what a Claude-connector pull POSTs to.

**While here:** the `SYNC_SECRET` bearer check is copy-pasted inline across nine `app/api/sync/*`
routes plus `metrics/refresh` and `clips/learn`. Add **`requireSyncSecret(req)`** to
`lib/api/guard.ts` (next to the existing `requireSession` / `requireDiscoverSecret`, keeping the
`timingSafeEqual` + fail-closed-on-unset behaviour) and use it in the new route. Do not refactor the
existing ten routes in this change — note it as follow-up.

---

## Phase 3 — Studio "Live & performing" band + manual entry

- **Read:** join `getLatestMetrics()` into the Studio data loader (`lib/studio/data.ts`) and render
  the band + per-thread columns (`Channel · Live link · Published · Views/Impressions · Engagement`)
  and the drawer performance card, per `context/mockups/studio-redesign.html` L433-506.
  Show "N posts still need numbers" for videos with a `publishedLink` and no metric row.
- **Write:** the drawer's editable fields (`views`/`impressions` accepting `75.2k`, engagement %)
  post through a session-guarded server action that calls the *same* `ingestSocialMetrics` with
  `source: 'manual'`, `enteredBy: session.email`. Manual and connector rows are then
  indistinguishable downstream.
- **Keep Airtable populated:** continue writing the existing free-text `views24h` ("24h Data") field
  via `lib/airtable/vishen-video-push-map.ts` so the team's Airtable views don't go dark. The
  structured table supersedes it for the app, not for them.
- **Styling:** load the `artifact-design` skill first and build only from `components/ui/*`
  primitives + `--mv-*` token utilities (`Kpi`, `MetricCard`, `Sparkline` all already exist) — no raw
  hex, no arbitrary Tailwind sizes, per `DESIGN_SYSTEM.md`.

---

## Phase 4 — the connector runbook (replaces a cron, for now)

`docs/perch-pull-runbook.md` (new): a copy-pasteable prompt that, in a session with the Perch
connector authorized, pulls the last 30 days per profile and POSTs the normalized rows to
`/api/metrics/social`. Include the exact tool calls discovered in Phase 0 and the JSON shape.

Explicitly **not built this round:** app-side OAuth (`/api/hootsuite/connect` + DCR/PKCE +
encrypted refresh token) and a `perch-metrics.yml` GitHub Actions schedule. Because `offline` is a
supported scope and the sink already exists, that's an additive change later — the schedulers here
are GitHub Actions with `vars.APP_URL` + `secrets.SYNC_SECRET`, and the app is public (no IAP) since
the region move, so a plain bearer curl works when we want it.

---

## Phase 5 — record the decisions

- `prd/content-production-management/performance-loop.md` — resolve the source decision (Perch via
  connector; Postiz as fallback) and the metric set; move E7 off `discovery`.
- `context/decision-log.md` — add: metrics live in their own `social_metrics` table keyed to the
  published URL (settles the long-open "Prio table vs Asset Library" question), and store-all /
  show-best-available for impressions vs views.
- Mark `plans/jul1-2026-hootsuite-perch-performance.md` as **un**-superseded-in-part (its Step 0
  human block is now cleared) and note in `plans/jul1-2026-postiz-performance.md` that Postiz is the
  fallback, not the chosen source.
- Memory: update `performance-loop-data-source` (connector-sourced sink built; no app OAuth) and
  add a note that the Perch resource exposes only `offline` + `analytics:read`.

---

## Status — built 2026-08-20

Phases 1–5 are **code-complete and verified locally**; Phase 0 is the one thing that
needs you (it can't be done headlessly).

| Phase | State |
|-------|-------|
| 0 · Perch capability spike | ⏳ **needs an interactive session** — authorize the connector, then record `context/hootsuite-perch-capabilities.md` |
| 1 · `social_metrics` table | ✅ `SocialMetric` model + `prisma/migrations/0018_social_metrics/migration.sql` (**not yet applied to the managed DB** — `kessel status` returns a network error, so it needs a live `kessel login`) |
| 2 · ingest path | ✅ `lib/metrics/social-perf.ts` + `lib/metrics/social-metric-types.ts` + `POST /api/metrics/social` + `requireSyncSecret()` in `lib/api/guard.ts` |
| 3 · Studio band + manual entry | ✅ band, per-card numbers, drawer Performance panel, `saveVideoMetrics` action |
| 4 · connector runbook | ✅ `docs/perch-pull-runbook.md` |
| 5 · decisions recorded | ✅ PRD E7 (→ Phase 1, `in-progress`, 5/7), parent PRD, `context/decision-log.md`, both older plans re-headed, memory |

**Two things changed from the plan as written**, both for correctness:

1. **The pure helpers live in their own module.** `lib/metrics/social-metric-types.ts`
   holds the row shapes + parse/summarize/format; `social-perf.ts` keeps the prisma
   half and re-exports it. The Studio drawer and overview are client components, and
   importing the prisma-backed module from them pulled `pg` → node `tls`/`net` into the
   browser bundle and failed the build. Client code must import the types module.
2. **`normalizeUrl` lowercases the host but preserves the path.** Instagram shortcodes
   and YouTube ids are case-sensitive, so lowercasing the whole URL would let
   `/p/AbC` and `/p/abc` — two different posts — collide on one dedupe key.

Smaller calls made while building:
- The response distinguishes **`skipped`** (bad input → `400`) from **`writeErrors`**
  (DB failure → `500`); an empty write with errors used to read as `ok: true`.
- The band reports **`primaryFrom`** ("2 of 3 posts"). It totals impressions *or* views,
  never a mix, so a partial set must not look like a total.
- Manual entry mirrors into Airtable's free-text "24h Data" **only when it is empty** —
  the team's hand-written note is theirs (same decision-lock rule as clip statuses).

## Left for you

1. **Authorize the Perch connector** and run the Phase 0 spike. Everything downstream
   is built, but until this runs we don't know whether attribution is per-post or
   channel-level.
2. **Apply the migration** to the managed DB: `kessel login`, then
   `kessel db migrate prisma/migrations/0018_social_metrics/migration.sql`, then deploy.
   Nothing else needs a new secret — `SYNC_SECRET` already exists.

## Verification — what was actually run

A local Postgres was available, so this ran end-to-end against a scratch database
(`content_mgmt_verify`, dropped afterwards) rather than being desk-checked.

1. **Endpoint reachability** ✅ `POST https://mcp.hootsuite.com/perch` → `401` with the
   protected-resource header; the OAuth metadata documents DCR + `analytics:read`.
2. **Phase 0** ⏳ not runnable headlessly — the connector needs interactive OAuth.
3. **Migration SQL** ✅ applied to a fresh DB, then diffed column-by-column and
   index-by-index against what `prisma db push` generates from the schema — identical.
   This matters because prod applies the `.sql` file, not `db push`.
4. **Pure helpers** ✅ 25 assertions over `normalizeUrl` / `parseCount` / `parseRate` /
   `summarizeBand` / `formatCount`, including that `/p/AbC` and `/p/abc` do *not*
   collide, `"lots"` parses to `null` rather than `0`, and impressions-plus-views sets
   report impressions only.
5. **Auth** ✅ no header → `401`; wrong secret → `401`; malformed body → `400`;
   bad `source` → `400` naming the row index.
6. **Ingest** ✅ three rows (two real permalinks — one with a tracking param, one
   `http://www.` — plus one junk URL) → `{upserted: 3, matched: 2, unmatched: 1}`.
   Two further identical POSTs left the row count at 3 (dedupe holds); a
   case-different shortcode correctly created a 4th row.
7. **Failure modes** ✅ DB unreachable → `500 ok:false` with the error listed, not a
   silent success; all-rows-unusable → `400`; empty batch → `200`.
8. **Studio UI** ✅ driven with Playwright + the dev-login harness. Band renders
   `Total reach 83k · impressions · 2 of 3 posts`, `Avg engagement 4.25%`,
   `Published 3`, `Top performer 71k · The 6 Phase Meditation launch cut`; the
   unnumbered card shows "No numbers yet" and the nudge counts it. Screenshots in the
   session scratchpad.
9. **Manual entry** ✅ typed `75.2k` + `6.2` in the drawer → `social_metrics` row with
   `views: 75200`, `engagement_rate: 6.200`, `window_days: 1`,
   `entered_by: rhythm@mindvalley.com`, matched to the video; `vishenVideo` outbox row
   queued for the Airtable push. Re-saving different numbers the same day updated in
   place (still one row).
10. **Non-clobber rule** ✅ with a hand-written "24h Data" note present, a second save
    left the note untouched while still updating the structured row.
11. `npm run build` ✅ and `npm run lint` ✅ (no new warnings).

## Risks

- **Attribution is the real risk, not the API.** If Perch reports profile-level only, or has no data
  for natively-posted content, the per-post band degrades to channel aggregates. Phase 0 answers this
  before any UI work is spent.
- **Entitlement.** Perch is a paid product; the workspace must include analytics access, and the
  authorizing user needs it on the Vishen Lakhiani + Mindvalley IG profiles.
- **`impressions` may be null on IG** (Meta deprecation). Mitigated by design, not by hope.

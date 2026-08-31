# Hootsuite Perch — what the MCP server actually exposes

Recorded 2026-08-24 from a live `tools/list` against `https://mcp.hootsuite.com/perch`.
This is the capability spike that `plans/i-got-the-mcp-temporal-summit.md` (Phase 0) owed.

**Headline: analytics is a five-step discovery pipeline, not a "get post metrics" call.**
The adapter written before this spike guessed a flat `getPostAnalytics(startDate, endDate)`
shape and would have found nothing. `lib/hootsuite/perch.ts` was rewritten against the real
surface.

## Two servers behind one URL

Tool names arrive namespaced, and the prefix matters:

| prefix | purpose |
|---|---|
| `create-mcp-http-service_` | publishing — drafts, publish, media upload, content library |
| `perch-analytics-mcp-server_` | **analytics — the only part we use** |

**Trap:** `get_entitled_workspaces` exists on *both*, returning **different shapes**:

- publishing → `{ organizationId, organizationName }`
- analytics → `{ tenantId, tenantType, tenantUUID }`

Resolve tools by suffix *and* prefer the `perch-analytics` prefix. Taking the publishing
one yields a `workspaceScope` every analytics call rejects.

## The analytics pipeline

```
get_entitled_workspaces          → workspaceScope { tenantId, tenantType, tenantUUID }
  └─ list_providers(scope)       → providers [{ dataService, dataType }]
       ├─ search_sources(scope, providers)          → sources (profiles/pages/accounts)
       └─ search_metrics(scope, [{ providers }])    → metrics [{ identifier{id,provider},
            │                                            label, description, dataFormat }]
            └─ query_analytics([{ metricId, sourceIds, timeRange{since,until}, … }])
```

Every tool except `get_entitled_workspaces` requires `workspaceScope`, passed back verbatim.

### Metric shapes — this is the important distinction

| `dataFormat` | behaviour | use |
|---|---|---|
| `TIMESERIES` | totals + data points + optional `breakdown` slices; `resolution` defaults to `AGGREGATED`, or `DAILY`/`WEEKLY`/`MONTHLY` | profile-level trends |
| `MULTIPART` | **paginated entries** — `limit` default 25, max 100, optional `sort`, opaque `pagination_token` | **per-post rows; this is what the performance loop needs** |
| `LIFETIME` | latest value only | followers etc. |
| `NO_AGGREGATION` | not summable over a range | — |

`search_metrics` has two modes: **discovery** (`providers` + optional `query` → compact list)
and **hydration** (`metricIds` → full detail incl. `sort_fields`, where a field is usable as
`query_analytics.sort.field` only when `sortable: true`).

### Time range

`timeRange: { since, until }`, ISO `YYYY-MM-DD`, both inclusive, within the **last 25 months**,
`until` not in the future. Equal dates query a single day.

### Batching

`query_analytics` and `search_metrics` take a **batch** of independent queries, and
**partial failure is normal** — some entries succeed while others carry an error. Treat
per-query status individually rather than failing the whole pull.

## Confirmed by the first live pull (2026-08-26)

Entries ARE per-post. Real envelope:

```json
{ "results": [ { "metric": { "id": "outbound_engagement", "provider": {…} },
                 "entries": [ { "unique_id": "17841400376176964_18101391116631588",
                                "source_id": "17841400376176964",
                                "timestamp": "2026-08-26T23:01:38Z",
                                "details": { "auto_tags": [], "content": { "body": "…" } } } ] } ] }
```

- **`unique_id` (`<sourceId>_<postId>`) is the per-post key.** Stable, so it's what we store
  as `platformPostId`.
- **The identifier is on the entry; the numbers are nested under `details`.** An extractor
  requiring both on one object matches nothing — this is exactly what returned 0 rows.
- `timestamp` is the post's publish time, not a capture time.
- This workspace's providers are all `socialprofile/*`: `CROSSPLATFORM`, `FACEBOOKPAGE`,
  `INSTAGRAMBUSINESS`, `PINTEREST`, `THREADS`, `TIKTOKBUSINESS`, `YOUTUBECHANNEL`. Two
  workspaces are entitled. `CROSSPLATFORM` carries the useful per-post metrics
  (`Posts table` → `outbound_engagement`, `Top posts` → `top_posts`).
- `search_sources` returns `[{ provider, sources: [] }, …]` — a provider with no connected
  profile comes back with an empty array rather than being omitted.

### Rate limits are real

Calling `search_sources` once per provider triggered **HTTP 429** partway through, which
also killed the second workspace's `list_providers`. Both `search_sources` and
`search_metrics` accept arrays, so all providers now go in one call each. Pacing plus
Retry-After backoff was added to the MCP client, but **reducing call count is the actual
fix** — pacing alone still throttled.

## Still unknown after this spike

- **Whether an entry carries a public permalink.** It definitely carries a post id
  (`unique_id`), but that is a platform media id, not a URL — and our records join on the
  published URL (`VishenVideo.publishedLink`). If no permalink appears, rows will land
  `unmatched` and we need a second join strategy (matching `details.content.body` against
  the clip caption is the likely candidate). The 300-char preview truncated before reaching
  the rest of `details`, so the diagnostic preview is now 2500 chars.
- Which metrics this workspace is actually entitled to, and whether `impressions` is
  populated on Instagram or only `views` (Meta deprecated IG impressions Apr 2025).
- Whether analytics covers natively-posted content or only posts Hootsuite published.

## Notes for later

- Publishing tools exist and are usable (`create_draft`, `publish_post`, `request_media_upload`).
  We deliberately do **not** touch them: the grant we request is `analytics:read`, and the
  portal has no business publishing on anyone's behalf.
- `get_recommended_times` could inform scheduling suggestions in Studio one day.
- `search_content_library_assets` overlaps with the asset-library question — but that is
  being built in Airtable, so leave it alone.

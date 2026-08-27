# Pulling performance numbers from Hootsuite Perch

How live social numbers get into the portal.

**The normal path is automatic** and needs nothing from this document: an admin connects
Hootsuite once at **`/admin/hootsuite`**, and `.github/workflows/perch-metrics.yml` pulls
nightly into `social_metrics`. The app holds its own grant (see `lib/hootsuite/oauth.ts`).

This runbook covers the **manual/connector pull** — still useful for a one-off backfill, for
pulling a window the cron doesn't cover, or when the app-held grant is broken and you need
numbers today. It posts to the same door, `POST /api/metrics/social`.

Decision and rationale: `plans/i-got-the-mcp-temporal-summit.md`.

---

## One-time setup

1. **Authorize the connector.** For the automated path you want `/admin/hootsuite` →
   **Connect Hootsuite** instead of this step. For a connector-driven pull: claude.ai →
   Settings → Connectors → add a custom connector with URL
   `https://mcp.hootsuite.com/perch`. Sign in to the Hootsuite workspace when prompted;
   authorization is one-time and survives sessions.
   - The server is a standard remote MCP: OAuth 2.1 + dynamic client registration at
     `https://platform.hootsuite.com`, scopes `offline` + `analytics:read`.
   - Perch is a **paid** Hootsuite product. If authorization returns an entitlement
     error, the workspace plan doesn't include analytics — that's a Glen/Marisha
     conversation, not a code problem.
   - The authorizing user needs analytics access to the profiles we care about
     (Vishen Lakhiani IG, Mindvalley IG at minimum).
2. **Have `SYNC_SECRET` and the app URL to hand.** Same secret the sync workflows use
   (GitHub repo secret `SYNC_SECRET`, repo var `APP_URL`).

## Capability check (do this first, once)

Before trusting any number, record what Perch can actually tell us in
`context/hootsuite-perch-capabilities.md`:

- `tools/list` — the exact tool names and parameters.
- One analytics call per connected profile.
- **The question that matters:** does a result row carry a stable **post id** and/or the
  **public permalink**? If it only reports profile-level totals, per-post attribution
  isn't possible and the band degrades to channel aggregates.
- Does it cover natively-posted content, or only posts Hootsuite published?
- Is `impressions` populated on Instagram, or only `views`? (Meta deprecated IG
  impressions in Apr 2025.)

## The pull

In a session with the connector authorized:

> Using the Hootsuite Perch connector, pull performance for the last 30 days for the
> Vishen Lakhiani and Mindvalley Instagram profiles, per post. For each post give me
> the public permalink, the platform post id if available, impressions, views,
> engagement rate as a percent, and clicks. Then POST them to
> `$APP_URL/api/metrics/social` as `{"rows":[...]}` with
> `Authorization: Bearer $SYNC_SECRET`, `source: "hootsuite:perch"`, and
> `windowDays: 30`. Report the response counts back to me.

Row shape (every metric optional — send what Perch actually returned, omit the rest;
never send `0` for "unknown"):

```json
{
  "source": "hootsuite:perch",
  "publishedUrl": "https://www.instagram.com/p/ABC123/",
  "platformPostId": "17912...",
  "channel": "Instagram",
  "impressions": 71000,
  "views": null,
  "engagementRate": 5.1,
  "clicks": 240,
  "windowDays": 30,
  "capturedAt": "2026-08-20T00:00:00Z"
}
```

## Reading the response

```json
{ "ok": true, "upserted": 42, "matched": 38, "unmatched": 4,
  "skipped": 0, "writeErrors": 0, "errors": [] }
```

- **`matched`** — tied to a known video via permalink. These show up in the Studio
  "Live & performing" band immediately.
- **`unmatched`** — stored, but the permalink matches no `VishenVideo.publishedLink`.
  Expect some: posts we never tracked, or a link the team pasted differently. A high
  count means the Airtable links and the real permalinks have drifted — worth a look,
  not an outage. Nothing is dropped silently.
- **`skipped`** — rejected before any write: no usable key, or no metric values at all.
- **`writeErrors`** — failed *at* the write. Our problem, not the payload's.

Status codes say whose problem it is, so a script can branch on them:

| code | meaning |
|------|---------|
| `200` + `ok:true` | at least one row landed (check `errors` for a partial batch) |
| `400` | every row was unusable input — fix the payload |
| `401` | bad or missing `SYNC_SECRET` |
| `500` | rows were fine, the database write failed — retry |

Re-running the same day is safe: rows are keyed by `(source, post, window, captured
day)` and update in place, so three identical POSTs leave **one** row.

Verified end-to-end against a scratch Postgres (2026-08-24): six POSTed rows across two
identical batches left exactly three rows, a later POST for the same post overwrote its
numbers, and every row matched its video by permalink despite `www.`/query/trailing-slash
differences from what Airtable holds. Two normalization traps are covered by unit tests
because both silently corrupt matching:

- **Case is preserved in the path** — `/p/AbC` and `/p/abc` are different Instagram posts.
- **`?v=` is preserved on YouTube URLs** — stripping the whole query string collapsed every
  `youtube.com/watch?v=...` onto the single key `youtube.com/watch`, i.e. one key for the
  entire channel. Tracking params (`t`, `si`, `feature`, `utm_*`, `igshid`) are still dropped.

## Relationship to the automated pull

Superseded as the primary path — the cron and the app-held token now exist (shipped
2026-08-24): an admin-only connect route doing DCR + PKCE with the refresh token sealed at
rest, plus `.github/workflows/perch-metrics.yml` → `POST /api/metrics/perch-pull` nightly at
03:30 UTC over a 1-day and a 30-day window. `/admin/hootsuite` also has a **Pull metrics
now** button that runs exactly what the cron runs.

A connector pull as described above remains valid and safe alongside it: both write through
`ingestSocialMetrics` with `source: 'hootsuite:perch'`, and dedupe is keyed by
(source, post, window, captured day) — so a manual pull for a window the cron already
covered updates those rows rather than duplicating them.

## Manual entry (the fallback that always works)

Studio → open any published video → **Performance** panel in the drawer. Views /
impressions / engagement %, accepting `75.2k` as well as `75200`. That writes a
`source: 'manual'` row through the same code path, so the band totals it identically.

It also mirrors a readable summary into Airtable's free-text "24h Data" field — but
**only when that field is still empty**, so a note the team wrote by hand is never
overwritten.

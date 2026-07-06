# Fix: Auto-discover should skip YouTube Shorts (long-form only)

## Context

The Vishen media pipeline has an **Auto-discover** job that polls Vishen's YouTube
channel and adds new uploads to the 📺 Media Sources inbox (Status "New",
Submitted Via "Auto-discover"). The user reports it is surfacing **YouTube Shorts**,
but Auto-discover should only pull **long-form content** (podcasts/talks that are
worth clipping) — Shorts are already short-form and don't need the clip engine.

**Root cause:** discovery reads the channel's *uploads* playlist, which mixes
Shorts and long-form, and applies **no duration/type filter anywhere**. Every
upload becomes a Media Source row.

- [app/api/media/discover/route.ts](app/api/media/discover/route.ts) — the whole
  feature. Line 30 calls `recentUploads(channelId)`; lines 42–52 loop over every
  upload, dedupe on URL only, and call `createMediaSource(... submittedVia: 'Auto-discover')`.
- [lib/media/youtube.ts:47](lib/media/youtube.ts#L47) — `recentUploads()` requests
  `playlistItems?part=snippet` only. It never fetches `contentDetails.duration`,
  so nothing downstream can tell a Short from a long-form video.

The YouTube Data API has no official `isShort` flag. **Decision (user-confirmed):
filter by duration** — all Shorts are ≤180s (the current Shorts cap), so dropping
uploads at/under a threshold reliably excludes them with negligible risk of
dropping genuine long-form (Vishen's long-form runs many minutes).

## Change

### 1. `lib/media/youtube.ts` — fetch durations and expose them

- Add `durationSeconds: number | null` to the `YouTubeUpload` interface.
- Add a helper to parse ISO-8601 durations (e.g. `PT1H2M30S`, `PT48S`) to seconds:
  ```ts
  export function parseIsoDuration(iso: string): number | null {
    const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return null;
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  }
  ```
- In `recentUploads()`, after collecting the playlist video ids, make **one**
  `videos?part=contentDetails&id=<comma-joined ids>&key=...` call (≤50 ids → 1
  quota unit — cheap) and merge `contentDetails.duration` onto each upload as
  `durationSeconds`. Keep the videos in playlist order.

### 2. `app/api/media/discover/route.ts` — drop Shorts before creating rows

- Read a threshold: `const minSec = Number(process.env.DISCOVER_MIN_DURATION_SECONDS) || 180;`
- In the loop, skip uploads whose `durationSeconds` is non-null and `<= minSec`
  (treat unknown/null duration as "keep" so an API hiccup never silently drops
  everything). Count skipped items.
- Add `skipped` (count of Shorts filtered) to the JSON response so the cron output
  is legible, e.g. `{ ok, scanned, added, skipped, failed }`.

Default threshold 180s excludes all Shorts; `DISCOVER_MIN_DURATION_SECONDS` env
override lets ops tune it without a code change (set via `kessel env set` if desired).

## Files
- [lib/media/youtube.ts](lib/media/youtube.ts) — interface field, `parseIsoDuration`, contentDetails fetch in `recentUploads`.
- [app/api/media/discover/route.ts](app/api/media/discover/route.ts) — duration filter + `skipped` in response.

No schema, Airtable field-map, or cron changes needed. `existingSourceUrls`/dedupe
logic is untouched.

## Verification

1. **Unit-level sanity:** `parseIsoDuration('PT48S')` → 48, `parseIsoDuration('PT1H2M30S')` → 3750, `parseIsoDuration('PT12M')` → 720.
2. **End-to-end (local):** with `YOUTUBE_API_KEY` + `VISHEN_YT_CHANNEL_ID` set,
   `npm run dev` then `curl -s localhost:3000/api/media/discover | jq` (or with the
   `x-discover-secret` header if `DISCOVER_SHARED_SECRET` is set). Confirm the
   response reports a `skipped` count > 0 when the channel has recent Shorts, and
   that only long-form URLs land as new Media Sources. Because dedupe skips
   already-seen URLs, verify against a channel state with a fresh Short, or
   temporarily inspect the pre-create list.
3. **Confirm no long-form loss:** spot-check that a known long-form upload (>3 min)
   is still added.
4. `npm run lint` clean.

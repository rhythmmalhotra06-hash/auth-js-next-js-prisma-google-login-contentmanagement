# Fix: visual DNA review can't open real deliverables (the 500MB cap)

## Context

Testing the shipped `/performance/reviews` work, "Review with visuals" failed with **"This video is
over the 500MB limit for visual review."** That is not an edge case — measured against the four
tickets offered as test candidates, the delivery links are:

| Ticket | Size | `accept-ranges` |
|---|---|---|
| Vishen – Rapid Fire reel | 568 MB | bytes |
| Be Extraordinary Masterclass | 3,507 MB | bytes |
| Silva Masterclass | 3,734 MB | bytes |
| Scaling Wisdom Ep. 1 | 9,967 MB | bytes |

**Every one exceeds the cap.** The team delivers masters, not web-sized files, so visual review is
currently unusable on the very tickets it was meant for — a much bigger blocker than the Dropbox
folder gap (which is the *other* 28%).

**Why the cap exists, and why raising it can't work.** `render-service/server.mjs:114` says it
outright: Cloud Run's `/tmp` is a RAM-backed tmpfs, so the download ceiling is a *memory* ceiling on
the same heap the 2026-09-07 OOM crashes exhausted. You cannot stage a 10GB file in RAM at any
container size this service will plausibly get. The download-then-extract design is the problem, not
the number.

**The fix, already verified end-to-end.** Every link advertises `accept-ranges: bytes`, so ffmpeg can
seek into the file over HTTP and read only the bytes each frame needs. Measured against the 10GB
Scaling Wisdom master, with no download at all:

- `ffprobe` read its duration (3,925s) in **2.6s**
- single-frame seek+decode at t=30s / 1200s / 3600s: **5.9s / 5.0s / 7.2s** — flat regardless of depth,
  which is the proof that range seeking (not a sequential read) is happening
- 8 seeks in parallel: **16s total**, ~2s per frame effective

So the cap disappears not by being raised but by becoming irrelevant: the source is never stored.

**Decision taken:** long videos get **front-weighted** sampling rather than uniform. Most DNA rules
judge the opening — hook timing, captions, safe area — and one frame every 39 seconds across a
65-minute master answers the wrong question.

## Approach — `render-service/server.mjs`

**1. Teach `sniffSource` to report two more things it already knows.** It returns
`{ head, contentType, contentDisposition, totalBytes }` today. Add:
- `resolvedUrl` (`resp.url` after `redirect: 'follow'`) — Dropbox `dl=1` redirects to a
  `dl.dropboxusercontent.com` signed URL. Resolving once and handing *that* to ffmpeg avoids
  re-walking the redirect chain on every one of ~60 seeks.
- `rangeSupported` (`resp.status === 206`) — the sniff already sends `Range: bytes=0-N`, so this is
  free. It is also already load-bearing: the code aborts when a server ignores Range and answers 200
  with the full body.

**2. Route between two extraction paths** in `handleExtractFrames`:

- **Remote-seek (new, the default for real deliverables):** used when `rangeSupported` and the source
  is large. Nothing is written to `/tmp` except the JPEGs.
- **Download (existing, kept):** used when Range is *not* honored, or when `totalBytes` is small
  (≤ ~150MB). For a 50MB file one download plus local seeks beats 30 network round-trips, and this
  keeps the currently-working path intact rather than betting everything on the new one. The 500MB
  cap stays *on this path only*, where it is a genuine memory guard.

Keep `assertVideoSource`'s magic-byte validation on both paths — it is what turns an HTML review page,
a folder `.zip` or an empty share into a precise message instead of an ffprobe stack trace. Only the
`totalBytes > MAX_DOWNLOAD_BYTES` branch becomes path-specific.

**3. Remote extraction.** `ffprobe` the resolved URL for duration (2.6s even on 10GB), then run the
frame seeks with a small concurrency pool:

```
ffmpeg -nostdin -loglevel error -ss <t> -i <resolvedUrl> -frames:v 1 \
  -vf "scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease" \
  -q:v 3 <workDir>/frame_<nnnn>.jpg
```

`-ss` **before** `-i` is the whole trick — input seeking issues a range request; putting it after
decodes from zero. Concurrency **8** (measured: 16s for 8 frames); worth tuning, but keep it modest
because Dropbox may throttle a burst. Reuse the existing `runCommand` helper and the existing
`workDir` + base64 response shape, so the client contract in `lib/dna-review/frames.ts` does not
change at all.

**Budget note:** `frames.ts:124` caps the call at `AbortSignal.timeout(180_000)`. At ~2s/frame
effective, ~60 frames ≈ 120s — inside the budget but not by much, which is the second reason for
front-weighting rather than uniform-100.

**4. Front-weighted schedule** — replace `frameBudgetFor(durationSec)` (a count) with
`frameScheduleFor(durationSec)` returning explicit timestamps:

- **≤ 180s: unchanged.** Uniform, existing 30/40/60 budget. Front-weighting a 45-second reel is
  meaningless, and short-form is where most tickets live — do not disturb it.
- **> 180s: front-weighted,** total capped at ~60 frames:
  - `0–120s` every 4s (30 frames) — the hook/caption/safe-area window the rulebook actually judges
  - `120–600s` every 60s (8 frames)
  - `600s–end` spread evenly over the remaining budget (~22 frames) — enough to confirm the whole
    thing was delivered and nothing breaks late

For the 65-minute master that is ~56 frames, half of them in the first two minutes. `timestampMs`
already flows through to `DnaReviewFinding`, so findings stay citable as "0:06" exactly as now.

**5. Error copy** — `lib/dna-review/frames.ts`: `source_too_large` stops being a normal outcome, so
its message should stop naming 500MB as a general limit and describe the real remaining case (a host
that won't do range requests). Keep the code — the download path can still raise it.

## Built — and two corrections testing forced (2026-09-09)

Implemented in `render-service/server.mjs` + `lib/dna-review/frames.ts`. Both were found by
running the real production links, not by reading code:

**1. The resolved Dropbox URL is single-use.** The plan had `sniffSource` return `resp.url` (the
post-redirect signed `dl.dropboxusercontent.com/cd/0/get/...` URL) so the ~60 seeks wouldn't each
re-walk the redirect. That URL **403s on the second consumer** — the first request burns the token,
so the very first ffprobe failed. Fix: hand ffmpeg the pre-redirect `dl=1` URL and let it follow the
redirect itself, minting its own token per seek. Costs one extra request per frame; it is the only
form that works. `sniffSource` now carries a comment saying why `resp.url` is deliberately not
returned, so nobody "optimises" it back.

**2. The three-bucket schedule was wrong at the short end.** `0-120s` dense + `120-600s` every 60s
+ proportional tail gave a 4.7-minute video **30 frames in its first two minutes and 3 for the
remaining 2.7**. Replaced with two buckets: dense first two minutes, then the remaining budget
spread evenly across everything after. One rule, sane at both ends.

**Measured after the fix** (local service, real production links):

| Source | Duration | Frames | First 2 min | Tail gap | Wall clock |
|---|---|---|---|---|---|
| Scaling Wisdom, 10GB | 65 min | 60 | 30 | 127s | 106s |
| Be Extraordinary, 3.5GB | 56 min | 60 | 30 | — | 113s |
| Vishen Rapid Fire, 568MB | 4.7 min | 60 | 30 | 5.4s | 78s |
| small public mp4 (download path) | 10s | 30 | uniform | 0.3s | 1s |

All inside the client's 180s abort. `replay.dropbox.com` still fails with its own specific message,
and the small file still goes down the staging path unchanged.

## Deliberately not in this change

- **The Dropbox *folder* path** (the other 28%) is still blocked on credentials, and its resolution
  goes through `sharing/get_shared_link_file`, a content endpoint that streams bytes rather than
  handing back a range-seekable public URL. Making folders work for multi-GB files needs either
  ffmpeg `-headers` carrying the Dropbox auth, or `files/get_temporary_link`. Out of scope here; the
  `e.size <= MAX_DOWNLOAD_BYTES` filter at `server.mjs:526` and its `oversize` message at `:593`
  stay as they are until that path is actually live.
- The Remotion `/render` path, which has its own download and its own reasons.

## Verification

- `node --check render-service/server.mjs`; `npm run typecheck` from `render-service/`; portal
  `tsc`/lint/build clean (the client contract shouldn't change, so the portal ideally needs no edit
  beyond the error string).
- **The four real tickets above**, after redeploying render-service from `render-service/`. All four
  must produce frames. The 10GB Scaling Wisdom master is the one that matters — it is the worst case
  and it is real.
- **Regression on the path that already worked:** a small bare `/scl/fi/` file (≤150MB) must still go
  down the download path and behave exactly as before.
- **Honest failure preserved:** a `replay.dropbox.com` link and a frame.io link must still fail with
  their specific messages and the paste-a-link box, not a generic error.
- **Watch memory during a 10GB run:** `kessel runtime-logs --since 10m` from `render-service/` must
  show no `heap out of memory` and no restart cycle. This is the whole point of the change — if RAM
  still spikes, something is buffering that shouldn't be.
- **Wall clock:** confirm a long-form run completes inside the 180s client timeout, and check the
  resulting `DnaReview` has `usedFrames: true` with frame-anchored `timestampMs` findings clustered
  in the opening window.
- Then re-check the *Saw the video* KPI on `/performance/reviews` — it read 14% (1 of 7) and this is
  the change that should move it.

---

## Still open (carried forward, unchanged)

- **Dropbox folder credentials** — user-run: create the app, enable `files.metadata.read` +
  `sharing.read` *before* minting the token, offline grant for a refresh token, set the three secrets
  from `render-service/`, redeploy. Unlocks the folder 28%. (See git history of this file for the
  step-by-step, or the Dropbox memory note.)
- **92 tickets at `Review` with no DNA review** — each needs a review or an override note to be
  approved. A one-off text-only backfill would clear it; not yet decided.
- **E13.3 attribution — on hold** pending the Hootsuite conversation. Question to bring: can Perch
  report on the other ~10 MV Instagram profiles (it currently returns only `source.name =
  "mindvalley"`), and can it go back before 2026-07-28? A yes makes the Composio track unnecessary.
- **The caption-rewriting process question** with Content & Comms — the ceiling on attribution, and
  not an engineering problem.

## Appendix — E13.3 findings worth not re-deriving

`SocialMetric.raw` already carries what the PRD thought was missing: `raw.details.source_link`
(943/943 rows), `raw.details.content.body` — the published caption (650 rows) — and
`raw.details.platform_id`. The ticket side carries the same copy in `SocialPost.captions`
(`fldCpBMCWeGwmyYpx`). **The join key is caption text, not a URL.** Honest match yield today is
**three** posts (a first `ilike` survey said six and was wrong); the gap is the team rewriting copy
before posting.

Second dead premise: the PRD groups by `(assetTypeId × positioning × audience)`, but `positioning`
and `audience` are populated on **zero** of 11,121 tickets and nothing writes them —
`lib/dna-review/generate.ts` feeds "(blank)" to the reviewer every run. Decided: group by **asset
type × event type**, and wire both fields into intake per CLAUDE.md §4.

Composio: real Instagram/Meta/YouTube/TikTok post data, but **no Hootsuite toolkit at all**, one OAuth
per IG account, and unreachable from app code or cron — a coverage tool, never a Perch replacement.

Shipped already (commit `4f847b8`): `/performance/reviews` plus `lib/performance/attribution.ts`
(inert, no caller). The `pull-social.ts` filter widening that attribution needs was deliberately
**not** shipped — it would put team-owned Content & Comms rows on the push path for no benefit while
E13.3 is parked. Two cleanups owed when it resumes: `attribution.ts`'s `captionFromRaw()` duplicates
the better `fromRaw()` at `lib/metrics/social-perf.ts:338`, and `social-perf.ts:402` counts
`attributed` from `vishenVideoId` only.

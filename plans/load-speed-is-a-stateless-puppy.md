# Load speed — the whole app, and the Monday pack in particular

## Context

Every page feels slow. Three exploration passes over the code plus a look at production logs
found the cost is layered, and the biggest layer is not in the code at all:

**1. Production is cold-starting constantly, and cold starts are catastrophically slow.**
`kessel runtime-logs --since 3h` shows ~35 distinct `✓ Ready in …` lines — an instance boot
roughly every 5 minutes — with startup times of **4–5s at best and 21s, 28s, 35s, 41s, 66s,
218s, 401s, 418s at worst**. A 401-second boot is seven minutes before the first byte. Anyone
who opens the app after a few minutes' idle hits one of these. Kessel gives no CLI knob for
min-instances / CPU / memory (`CLAUDE.md` §Deployment: "Resources are web-UI only"), and Rhythm
does not have that UI → this needs a request to the Kessel team (§1 below). Every cold start also
empties every in-process TTL cache, so the first page after one pays the cold Airtable bill too.

**2. Airtable requests are fully serialized, app-wide.** `lib/airtable/rest.ts:29-54` is a
module-global `RequestQueue` whose `drain()` does `await task()` — one request in flight for the
entire process, 200ms floor between them, shared across all bases. Every `Promise.all` over
Airtable reads in the repo (e.g. `lib/comms-calendar/data.airtable.ts:92`, `social-posts.ts:214`)
is therefore sequential, and the comments claiming otherwise are wrong. From asia-southeast1 to
Airtable's US API each request is ~0.4–0.8s, so a page costs K × (0.2s + RTT) where K is its
request count. The 5 req/s limit is *per base* and the code uses two bases, so ~10 req/s of
budget is thrown away.

**3. Nothing is memoized per request.** `React.cache()` appears nowhere. `AppShell`
(`components/ui/AppShell.tsx:24`) calls `getAdminAccess()`, and so does every route guard
(`requireStudioAccess`, `guardRoute`, …), so most pages run `auth()` 4× and the employee lookup
2× per render. The lookup itself (`lib/repositories/employee.repository.ts:69-73`) is an
unfiltered `employee.findMany` filtered in JS.

**4. The Monday-pack / comms-calendar readers repeat full-table scans.** The week reader has a
60s field-limited memo for the ~442-row VL Videos table (`data.airtable.ts:61-78` — "asking for
all of it took 4.4s of a 5.5s page"), but `month.ts:105`, `not-dated.ts:83` and
`asset.ts:231` each re-do the same 5-page scan with **all fields and no cache**. `getSocialPosts`
runs after the main `Promise.all`, not inside it. `week-pack.ts:237-244` does `ensureWeek` twice
sequentially (4 round trips) then `getWeekState`. Both Perch queries (`week-pack.ts:146`,
`social-posts.ts:126`) are `distinct on` scans of all of `social_metrics` with jsonb extraction per
row and no supporting index; `perchByCaption` has no date bound at all and re-runs on every load.

**5. Nothing is measured.** No `console.time`, `performance.now` or Server-Timing anywhere.
The numbers in code comments were measured by hand once and thrown away.

**Goal:** the pack, the calendar and the common shell should paint in well under a second when
warm, and a cold instance should be rare and fast. User has confirmed a few minutes of staleness
on Airtable-sourced data is acceptable. Scope agreed: global levers + the Monday-pack path; the
`/studio` landing and `getIntakeReferenceData` fan-outs are noted for a follow-up, not this pass.

---

## 1. Infrastructure — request to the Kessel team (not code, do first)

Paste to the Kessel team (Slack). Nothing in the repo can set these.

> Service `auth-js-next-js-prisma-google-login-cont-73a7` (asia-southeast1). Runtime logs show
> ~35 container starts in 3h with `Ready in` times from 4s up to 401s/418s — the app is
> scaling to zero constantly and starting very slowly. Please set:
> - **min instances = 1** (it's an internal tool used in a daily 08:00 MYT meeting)
> - **startup CPU boost = on**
> - **CPU always allocated** (not request-only) so background revalidation can run
> - **memory ≥ 1 GiB, 1 vCPU** (Next 15 + Prisma; the 200–400s boots look like memory/CPU starvation)
> - and please tell us whether the restarts are OOM kills or health-check failures — that shows
>   in the Cloud Run instance/memory metrics we can't see.

Code-side companion (in this pass): `next.config.ts` → `output: 'standalone'` so the container
boots a trimmed server instead of `next start` over the whole `node_modules`. Verify Kessel's
Next.js auto-detection honours it (`kessel deploy` on a preview branch first; if the platform
insists on `npm start`, keep `start` pointing at `node .next/standalone/server.js`).

---

## 2. Measure first — `lib/perf/timed.ts` (new)

A tiny wrapper so the rest of this plan is verifiable and stays verified:

- `timed(label, fn)` → runs `fn`, logs `[perf] <label> <ms>ms` to stdout (shows up in
  `kessel runtime-logs --search perf`). Threshold-gated (log only ≥ 100ms) to keep logs quiet.
- In `lib/airtable/rest.ts` `request()`: log `[perf] airtable <base>/<table> <ms>ms
  inflight=<n>` per call. Same in `lib/airtable/client.ts`.
- Wrap the big loaders: `getWeekPack`, `getCalendarWeekFromAirtable`, `getSocialPosts`,
  `getAdminAccess`, `getCalendarMonthFromAirtable`, `getNotDatedTray`, `getAssetDetail`.

Land this **before** the fixes and take a baseline from production logs on `/performance/week`,
`/studio/comms-calendar` (week + month), and `/tickets` — cold and warm.

---

## 3. Global lever A — real Airtable concurrency (`lib/airtable/rest.ts`)

Replace the serial `RequestQueue` with a **per-base sliding-window limiter**: a request may
start when fewer than 5 requests for that base have *started* in the last 1000ms. Do not wait
for completion. Keep the existing 429/5xx exponential retry (`rest.ts:66-96`); on a 429, the
retry re-enters the limiter.

- Key the limiter by `baseId` (parse from the URL — every URL is `${API}/${baseId}/…`).
- Add a global cap of ~8 in flight so a pathological fan-out can't open dozens of sockets.
- `lib/airtable/client.ts:22-45` (the second lane, 220ms sleep) should import and use the same
  limiter so both lanes share one per-base budget — otherwise the two lanes combined can exceed
  5 req/s on `creative_services`.
- Fix the comments at `data.airtable.ts:85-88` and `social-posts.ts:200-206` to describe the
  new behaviour.

`listAll` pagination stays inherently sequential (offset chain) — this lever helps fan-outs
across tables and batches, not one long table. That is why §5 also caches the long tables.

Expected: week page Airtable phase drops from ~8 serial round trips to ~3 waves.

---

## 4. Global lever B — per-request dedupe

- Wrap in `React.cache()`: `auth` re-export used by server code (or a `getSession()` in
  `lib/auth.ts`), `getEmployeeForSession` (`lib/employee.ts:13`), `getAdminAccess`
  (`lib/admin/access.ts:25`). One decrypt and one employee lookup per render, regardless of how
  many guards + `AppShell` ask.
- `lib/repositories/employee.repository.ts:101-106` `findEmployeeByEmail`: when the 60s cache is
  cold, do `prisma.employee.findFirst({ where: { email }, select })` rather than loading the whole
  table to find one row. Keep the list cache for `all()` callers. (Case: emails in Airtable can
  differ in case — match with `equals`/`mode: 'insensitive'` or normalise both sides as the JS
  path does today.)
- `lib/prisma.ts`: construct `PrismaPg` **inside** the singleton guard; pass `idleTimeoutMillis:
  60_000` and `max: 10` so idle connections aren't reaped and re-handshaked every 10s.

---

## 5. Global lever C — one stale-while-revalidate memo, with invalidation (`lib/cache/swr.ts`, new)

Generalise the pattern that already exists 9 times (`employee.repository.ts:23-25,92-99` is the
best copy: TTL + in-flight dedupe):

```ts
swr<T>(key: string, fn: () => Promise<T>, { fresh: 60_000, stale: 5 * 60_000 }): Promise<T>
invalidate(prefix: string): void
```

- fresh → return cached. stale → return cached **and** kick off one background refresh
  (dedupe in-flight). expired → await `fn`. Errors during background refresh keep the old value.
- **Invalidation is mandatory wherever the app writes back to Airtable**, or edits look lost:
  - `app/studio/comms-calendar/not-dated/actions.ts` (sets Live Date) → `invalidate('vl:')`,
    `invalidate('calendar:')` before its `revalidatePath` calls. Today's 60s `vlCache` already
    has this latent bug — a moved asset can vanish from the calendar for up to a minute.
  - `app/performance/week/actions.ts` and `lib/mow/week-state.ts` write Postgres only — no
    Airtable cache to bust, but `invalidate('week-pack:')` if §6 caches the pack.
  - `lib/comms-calendar/asset.ts` writes (creative ticket / editor) → `invalidate('social:')`.
- Because Cloud Run may run >1 instance, invalidation is per-process; the stale ceiling (5 min)
  bounds the damage on the other instance. Acceptable per the user's answer; note it in the
  module header.

Then migrate the existing ad-hoc caches to it where touched in this pass (`vlCache`, employee,
contractor). Leave the others alone.

---

## 6. The Monday-pack / comms-calendar path

### 6a. One VL Videos read, shared
- Export `vlRows()` from `data.airtable.ts` (via `swr('vl:rows', …)`), keep the field
  projection, and make `month.ts:105`, `not-dated.ts:83`, `asset.ts:231 (siblingsOf)` use it.
  Check each caller's field needs first — `not-dated` and `asset` may read fields the week
  projection omits; extend the projection rather than fetching all ~40 columns.
- `listAll(VL_MESSAGE_OF_WEEK)` (`data.airtable.ts:94`) → `swr('vl:mow', …)`, ~7 rows, rarely
  edited.

### 6b. Cache the assembled week and the social posts
- `getCalendarWeekFromAirtable(anchor)` → `swr(`calendar:week:${weekStart}`, …)`. This is the
  shared read for `/performance/week`, `/studio/comms-calendar`, `/studio` and the ingest route.
  Serve stale in the meeting; refresh in the background.
- Move `getSocialPosts(socialIds)` into the same wave: it depends on `mvRes` (the comms-day
  rows), so the honest fix is to cache `COMMS_DAY` for the ±2-week window and start
  `getSocialPosts` as soon as that resolves, not after `vlRows` too. With §3, the SOCIAL batches
  and `perchByCaption` genuinely overlap.
- `perchByCaption()` (`social-posts.ts:126`) → `swr('perch:captions', …, fresh 5 min)`. Perch is
  refreshed nightly; recomputing the caption map on every page load is pure waste. Also replace
  the O(posts × captions) fallback at `social-posts.ts:167` (`[...perch.entries()].find(…)`)
  with a single precomputed array of keys.

### 6c. Postgres
- `week-pack.ts:237-243`: `Promise.all(week.headers.map(ensureWeek))`, and make `ensureWeek`
  a single `upsert` (`lib/mow/week-state.ts:51-80`) instead of `findUnique` + `update`/`create`.
  Run `getWeekState` and the pack's Perch query concurrently with the Airtable wave, not after.
- Add `@@index([platformPostId, capturedAt(sort: Desc)], map: "idx_social_metrics_post_capture")`
  on `SocialMetric` (`prisma/schema.prisma:900`) — supports both `distinct on` queries. Migration
  via `prisma/migrations/0030_social_metrics_post_capture/` + `kessel db migrate` (per memory:
  DDL goes through kessel, not `prisma migrate` locally).
- `dailyPlatformReads`: push the date bound inside the CTE
  (`where to_timestamp((raw->'details'->>'created_at')::bigint)::date between …`) so it prunes
  before the sort. Correct because the publish date is a property of the post, identical across
  its capture rows.

### 6d. Paint the shell before the data
- Add `app/performance/week/loading.tsx` and `app/studio/comms-calendar/loading.tsx` (reuse the
  skeleton shape in `app/loading.tsx`, but with the `.card` / `bg-surface` tokens per
  `DESIGN_SYSTEM.md` — no inline style for spacing). This gives an instant response on navigation
  while the pack streams.
- In `page.tsx` for both routes: render `AppShell` + nav immediately and put the data-dependent
  body in an async child under `<Suspense fallback={…}>`, the pattern already used at
  `app/stakeholder/page.tsx:56`. `AppShell`'s own `getAdminAccess` is now deduped (§4) and cheap.

### 6e. Small hygiene found on the way
- `components/mow/PostGrid.tsx:39` `<img>`: add `loading="lazy" decoding="async"` and explicit
  `width`/`height` (or `aspect-*` class) — ~30 eager Airtable-CDN fetches today and layout shift.
- Delete the stray macOS duplicates `app/performance/week/assets 2/` and
  `app/studio/comms-calendar/asset 2/` (they are real routes to Next) and the `* 2.*` files in
  `app/generated/prisma` (regenerate with `npx prisma generate`). The iCloud-synced `~/Documents`
  location is the root cause; flag it, don't fix it here.
- `next.config.ts` `webpack` override is ignored under `--turbopack`; remove it if
  `asyncWebAssembly` is no longer needed (schema uses `runtime = "nodejs"`). Verify with a build.

---

## Not in this pass (recorded so it isn't lost)
- `/studio` landing: ~37 Airtable requests cold, no Suspense; `loadStudio` re-paid by 8 routes
  with no memo (`lib/studio/data.ts:29`). Cache it with `swr` and add a boundary.
- `getIntakeReferenceData` (`lib/airtable/reference-live.ts:37-95`): 8 deliberately sequential
  reads — can go parallel once §3 lands. `SHOOTS_MAX=500` passed to a single `listRecords` call
  silently truncates to 100.
- `lib/tickets/data.airtable.ts:159` unfiltered Official Calendar read on every queue load
  (dormant in prod: `TICKETS_BACKEND=postgres`).

---

## Files touched

New: `lib/perf/timed.ts`, `lib/cache/swr.ts`, `app/performance/week/loading.tsx`,
`app/studio/comms-calendar/loading.tsx`, `prisma/migrations/0030_…/{migration,down}.sql`.

Modified: `lib/airtable/rest.ts`, `lib/airtable/client.ts`, `lib/auth.ts`, `lib/employee.ts`,
`lib/admin/access.ts`, `lib/repositories/employee.repository.ts`, `lib/prisma.ts`,
`lib/comms-calendar/{data.airtable,social-posts,month,not-dated,asset}.ts`,
`app/studio/comms-calendar/not-dated/actions.ts`, `lib/mow/{week-pack,week-state}.ts`,
`app/performance/week/page.tsx`, `app/studio/comms-calendar/page.tsx`,
`components/mow/PostGrid.tsx`, `prisma/schema.prisma`, `next.config.ts`.

## Order
1. §2 timing → deploy → baseline numbers from `kessel runtime-logs --search perf`.
2. §1 message to Kessel team (parallel, no dependency).
3. §3 queue + §4 dedupe + §5 swr helper (one commit each; each independently reversible).
4. §6a–c readers, §6d streaming, §6e hygiene.
5. Re-measure; record before/after in this file.

## Verification
- `npm run build && npm run lint && npx tsc --noEmit` clean; `npm run verify` (offline tests incl.
  `tests/offline/verify-briefing.mts`, `verify-livedate.mts`) still pass.
- Local: `ENABLE_DEV_LOGIN` + the Playwright dev-login harness (per memory) — load
  `/performance/week`, `/studio/comms-calendar?view=week|month`, `/studio/comms-calendar/not-dated`,
  an asset detail, `/tickets`. Confirm identical rendered content before/after (same posts, same
  planned/delivered counts, same message/goal) — the caches must not change what is shown, only
  when it was fetched.
- Rate-limit safety: with `[perf] airtable … inflight=` logs, confirm no 429s in
  `kessel runtime-logs --search 429` after a burst of calendar/week/month loads.
- Write-through: set a Live Date from the not-dated tray, return to the calendar → the asset is
  on its day immediately (invalidation working).
- Production before/after from `[perf]` lines: target warm `/performance/week` server time
  < 800ms (from ~3–5s), cold < 3s excluding container boot; `Ready in` values after the Kessel
  change should be single-digit seconds and rare.

---

## Status — 11 Sep 2026

Built and verified locally (tsc, lint, `npm run build`, `npm run verify` incl. the new
`tests/offline/verify-load-speed.mts`, Playwright smoke through the dev login). Production numbers
still to be taken after deploy — see "Re-measure" below.

Done as planned: §2, §3 (both lanes), §4 (`React.cache` on `getSession`/`getEmployeeForSession`/
`getAdminAccess`; pool tuning; adapter inside the singleton), §5 (`lib/cache/swr.ts`), §6a–d, §6e
(lazy thumbnails; stray `* 2` dirs removed — all were EMPTY Finder/iCloud ghosts).

Done differently:
- `findEmployeeByEmail` was NOT switched to `findFirst`. The table is ~100 rows and already served
  from a 60s list memo that `all()` callers share; a per-email query would bypass that memo for the
  hottest caller. The real cost was the duplicate calls, which `React.cache` removes.
- `ensureWeek` is a single raw `INSERT … ON CONFLICT` with the "never rewrite a committed week"
  rule in a `CASE`, rather than a Prisma `upsert` (which cannot express that condition).
- Invalidation after a Live Date write fires twice: immediately, and again when the outbox drain
  has actually landed the value in Airtable (`scheduleOutboxDrain(onDrained)`), because until
  then a fresh read still returns the old date.

Deferred:
- `output: 'standalone'` — `next start` only WARNS with it, so it gains nothing unless Kessel's
  start command becomes `node .next/standalone/server.js`, and that needs `.next/static` copied
  into the standalone dir. Not verifiable without a preview deploy; try it on a branch with
  `kessel preview` first.
- The `webpack`/Turbopack config mismatch — harmless warning, left alone.

Re-measure (after deploy): `kessel runtime-logs --since 1h --search perf` → look for
`week.pack`, `calendar.week`, `perch.captions`, and the `airtable <base>/<table> … inflight=N`
lines (N > 1 proves the fan-out is real). Then `--search 429` must stay empty.

# Interim: make the visual DNA review usable — coverage unlock + a reviews page

## Context

The performance-attribution work (E13.3) is **on hold** pending the user's conversation with
Hootsuite — see "On hold" below for what's parked and the one question to bring to that call.

Meanwhile E13.2 (visual DNA review) is built, deployed and working, but effectively invisible: the
only way to reach it is the DNA review panel on an individual ticket page, so a person has to
already know which ticket to open. Nobody can browse what the AI has flagged, or see which tickets
are still unreviewed. Two things make it genuinely usable in the interim, and neither depends on
Hootsuite:

1. **Coverage** — visual review works on ~56% of tickets today. Another 28% are Dropbox *folder*
   links, whose handling is already written and deployed in `render-service` but inert because its
   three Dropbox credentials were never set (`kessel env list` on render-service shows only
   `RENDER_SERVICE_SECRET`). Setting them takes coverage to ~84% with no code change.
2. **Discoverability** — a dedicated page (decision: its own page, not folded into the
   published-numbers page) listing what's been reviewed, what got flagged, and what's still waiting.

Coverage numbers are measured, not estimated — `lib/dna-review/video-source.ts` records the
breakdown across 4,689 ticketed links as of 2026-09-08: 56% bare Dropbox file links (work today),
28% Dropbox folders (unlocked by Part 1), 5% `replay.dropbox.com` and 10% frame.io/Canva/Drive/
SharePoint/Figma (HTML pages with no file form — paste-a-link is the only path), plus ~46 rows of
prose or multi-link rich text.

---

## Part 1 — unlock the Dropbox folder links (config; needs the user)

`render-service/server.mjs` already implements folder resolution via the Dropbox API
(`files/list_folder` with `shared_link`, then `sharing/get_shared_link_file`), picks the best video
in the folder, and deprioritises `working`/`raw`/`proxy`/`textless`-style filenames. It gates itself
behind `dropboxConfigured()` and returns `dropbox_folder_unconfigured` when the creds are absent, at
which point the panel falls back to its paste-a-link box. So this is purely a credentials task.

As the code's own comment notes, `files/list_folder` permits **user auth only** — an app key/secret
pair is not enough, which is why this needs a one-time offline grant to mint a refresh token.

**Steps (user-run, since only the account holder can approve the OAuth grant):**

1. **Create the app** — dropbox.com/developers/apps → *Create app* → *Scoped access* → *Full
   Dropbox* (it must read links shared from the team's Dropbox, not an app sandbox) → name it
   something like `mv-content-portal-render`.
2. **Permissions tab** → enable **`files.metadata.read`** and **`sharing.read`** → Submit. Do this
   *before* step 3; scopes are baked into the token at grant time, so a token minted first will be
   missing them and every call 401s as `dropbox_folder_unauthorized`.
3. **Settings tab** → copy the **App key** and **App secret**.
4. **Mint the refresh token** (one time). Open, approve, copy the code:
   `https://www.dropbox.com/oauth2/authorize?client_id=<APP_KEY>&response_type=code&token_access_type=offline`
   then exchange it — `token_access_type=offline` is what makes the response include a
   `refresh_token`:
   ```bash
   curl -u '<APP_KEY>:<APP_SECRET>' \
     -d grant_type=authorization_code -d code='<CODE>' \
     https://api.dropboxapi.com/oauth2/token
   ```
5. **Set them on render-service** (note the directory — these belong to that service, not the
   portal):
   ```bash
   cd render-service
   kessel env secret DROPBOX_APP_KEY=<key>
   kessel env secret DROPBOX_APP_SECRET=<secret>
   kessel env secret DROPBOX_REFRESH_TOKEN=<refresh_token>
   kessel deploy      # env changes only take effect on a rebuild
   ```
   The redeploy is required, not optional — per memory `kessel-env-needs-new-commit`, a secret set
   without a rebuild stays invisible to the running container. Note also
   `kessel-manual-deploy-vs-git-autodeploy`: a manual `kessel deploy` builds from **local disk**, so
   make sure the working tree is clean and current first (this caused a production outage once).

**Then verify** on a real folder-link ticket (see Verification).

Left unsolved deliberately: the ~15% on `replay.dropbox.com`, frame.io, Canva, Drive and the like
have no file to download at any credential level. The paste-a-link box already covers them, and the
new page (Part 2) will make it visible how often that's needed.

## Part 2 — `/performance/reviews`

A read-only browse surface. Running a review, reacting to findings and dismissing flags all stay on
the ticket page, where the governance check (`getDnaAccessForAssetType`) already lives — this page
links out rather than duplicating those actions and their permission logic.

**Data — one new repository function** in `lib/dna-review/repository.ts`, beside the existing
`getLatestDnaReview` / `checkDnaGate` / `listDnaSignalsForAssetType`:

- `listRecentDnaReviews({ days = 30, limit = 100 })` — latest `DnaReview` per ticket, joined through
  the existing `DnaReview.ticket` relation for title / `ticketStatus` / asset type name, with each
  review's findings reduced to counts by severity plus an **undismissed `flag`** count (`reaction`
  other than `'dismissed'`). One query, not one per ticket.
- `listTicketsAwaitingDnaReview()` — tickets sitting at `Review` (where the automatic trigger fires)
  with no `DnaReview` row. This is not cosmetic: per E13.1's decision lock, a missing review blocks
  approval, so an unreviewed ticket at `Review` is a stuck ticket. Surfacing it is the point.

**Page** — `app/performance/reviews/page.tsx`, mirroring `app/performance/capacity/page.tsx`
(`export const dynamic = 'force-dynamic'`, `AppShell`, `Suspense` + `QueueSkeleton`, `Kpi`/`KpiGrid`,
`Icon`, and the `.card .pad` / `.t-meta` / `.empty` global classes — no new markup patterns). Access
matches `/performance`: any signed-in user, no new gate.

Four bands, in this order — worst first, matching how the queue views already read:

1. **KPI row** — reviewed in the last 30 days · open flags · awaiting review · share of reviews that
   used visuals (`usedFrames`). That last number is the honest coverage gauge for Part 1: it should
   jump once the Dropbox creds land.
2. **Needs attention** — reviews carrying an undismissed `flag`. Ticket title, asset type, the
   flagged finding's note, a `Badge` per severity, `frameCount` when visuals were used, and a
   timestamp anchor (`timestampMs` rendered as `0:06`) where the finding has one.
3. **Awaiting review** — from `listTicketsAwaitingDnaReview()`, stated plainly as blocking approval.
4. **Recently reviewed** — the clean ones, compact, so people can see the thing is actually running.

Every row links to `/tickets/[id]`. Empty states say what's true ("nothing flagged in the last 30
days") rather than rendering a bare void.

**Link it** from `app/performance/page.tsx`, next to the two existing inline
`<Link href="/performance/capacity">Capacity &amp; risk</Link>` references (~lines 71 and 97).
Following the established pattern — `/performance/capacity` has no nav entry either, so no nav
change is needed.

## On hold — E13.3 attribution (resume after the Hootsuite call)

Parked, not cancelled. Nothing below is started.

- **The question to bring to Hootsuite:** *can Perch report on our other Instagram profiles?* Today
  it returns one account only (`source.name = "mindvalley"`, 119 posts), while ticket-linked posts
  are spread across ~10 more — MV Deutsch, Espanol, Manifesting, Speaking, Entrepreneurship, VL,
  Coach. If Perch can simply add those profiles, the whole Composio track (≈10 separate OAuth
  logins, and it can't run on a schedule from our app) becomes unnecessary.
- Also worth asking: whether Perch can report further back than 2026-07-28, which is where its data
  currently starts and why several matchable July posts can't be reached.
- Parked work: instrumenting `attributeMetrics()` (caller + the `vishenVideoId`-only coverage-counter
  fix at `lib/metrics/social-perf.ts:402` + a coverage line on the Performance page), the
  `positioning`/`audience` intake fields, and the PRD corrections. Full detail in the appendix.

---

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run build` clean. No local database exists
  (`DATABASE_URL` in `.env` points at a non-existent DB — Kessel-only access), so anything touching
  `prisma` is verified deployed.
- **Part 1, on a real folder-link ticket.** Find one first:
  `kessel db query "select id, title from tickets where asset_folder_link like '%/scl/fo/%' limit 5"`.
  Open it, click *Review with visuals*, and confirm it now resolves a video instead of showing the
  paste-a-link fallback. Watch `kessel runtime-logs --since 10m` from `render-service/` during the
  run and confirm no `dropbox_folder_unconfigured` / `dropbox_folder_unauthorized` and no
  `heap out of memory` restart (the OOM fixed earlier by making Remotion bundling lazy).
- **Negative check:** confirm a ticket whose only link is `replay.dropbox.com` still fails *honestly*
  — the paste-a-link box with a real reason, not a silent empty review.
- **Regression:** confirm a ticket with a bare `/scl/fi/` file link still works exactly as before —
  Part 1 must not change the 56% that already worked.
- **Part 2:** confirm the flagged band matches reality by cross-checking one ticket's panel against
  its row; confirm a ticket at `Review` with no review appears under *Awaiting review* and
  disappears once reviewed; confirm counts agree with
  `kessel db query "select count(*) from dna_reviews where created_at > now() - interval '30 days'"`.
- Confirm the page renders for a non-admin signed-in user, and that no run/dismiss control leaked
  onto it (those stay ticket-page-only, behind `getDnaAccessForAssetType`).
- Mobile: the bands must reflow per `mobile-responsive-conventions` — no horizontal page scroll.

---

# Appendix — the E13.3 investigation (2026-09-08), preserved

## What Composio actually exposes

**It has real Instagram/Meta post lookup.** `INSTAGRAM_GET_IG_USER_MEDIA` (`id`, `caption`,
`permalink`, `timestamp`, `media_product_type`, view/save/share/like counts),
`INSTAGRAM_GET_IG_MEDIA_INSIGHTS` (views, reach, saved, likes, comments, shares,
total_interactions, reels watch-time), plus `FACEBOOK_GET_PAGE_POSTS`/`_GET_POST_INSIGHTS`,
`YOUTUBE_*`, `TIKTOK_LIST_VIDEOS`, `METAADS_GET_INSIGHTS`. No toolkit has an active connection.

**It is not a Perch replacement.** There is no Hootsuite toolkit at all (searching returns
`ONEUP_*`, an unrelated scheduler); it needs one OAuth per Instagram account (its IG tool follows
the token, and Facebook Page IDs are explicitly not resolved); and it is a claude.ai MCP connector,
so it cannot be called from app code or a Kessel cron — the same human-triggered shape as Perch.
IG insights also need a Business/Creator account with ≥1,000 followers, cover only the last 2 years,
and `impressions`/`plays` are dead metrics (`views` survives).

## The real finding — and two dead premises in the PRD

**Perch already carries both halves of the join,** inside `SocialMetric.raw`, a column documented as
a debugging escape hatch: `raw.details.source_link` (943/943 production rows),
`raw.details.content.body` — the published caption (650 rows), and `raw.details.platform_id` (the IG
media id). The ticket-linked side carries the same copy in `SocialPost.captions`, already mapped at
`lib/airtable/field-map.ts:513` → `fldCpBMCWeGwmyYpx`. **The join key is caption text, not a URL** —
which kills the PRD's `Asset.distributionUrl` plan (`assets` has 0 rows anyway).

**Second dead premise:** the PRD groups by `(assetTypeId × positioning × audience)`, but
`positioning` and `audience` are populated on **zero** of 11,121 tickets — no Airtable field mapped
for either, never collected at intake, and `lib/dna-review/generate.ts` feeds "(blank)" to the AI
reviewer on every review. Decisions taken: group by **asset type × event type** (78%/68%
populated), and **wire positioning + audience into intake** per CLAUDE.md §4.

**Overlap, measured honestly.** A first survey using short `ilike` phrases suggested six matches and
was wrong. Re-run at sentence level — what the matcher actually tests — the count is **three**
(forgetting-curve, John Lee, Paul McKenna; karma, sleep-inertia and money-thermostat all fail). The
zeroes are the **rewriting ceiling**: the team frequently re-words copy before posting, and matching
then yields nothing. It fails to nothing, never to a wrong answer (0 shared characters, verified).
That ceiling is a process question, not an engineering one, and is worth more than any integration
on this list.

## Already built (Phase 1)

`lib/airtable/pull-social.ts`'s `ENGINE_FILTER` widened to admit ticket-linked rows alongside
clip-engine rows, and `lib/performance/attribution.ts` added (fragment-overlap matching; ties
refused). `tsc`/lint/build clean. Four offline cases against real text from both sources pass: true
positive across the curly-vs-straight-quote boundary (1,215 shared chars), true negative on
same-topic-rewritten copy (0 chars), ambiguity refused where one English block sits under two
tickets, correct language-half resolution. `SocialPost.creativeTicketId → Ticket.airtableId →
assetTypeId` resolves **16/16** for the ticket-linked rows currently in Postgres.

**Two cleanups owed when this resumes:** `attribution.ts`'s local `captionFromRaw()` duplicates the
existing, better `fromRaw()` at `lib/metrics/social-perf.ts:338` (which has a `content.title`
fallback) — move `fromRaw` into `lib/metrics/social-metric-types.ts` to avoid a circular import and
delete the duplicate. And `lib/metrics/social-perf.ts:402` counts `attributed` from `vishenVideoId`
only, so ticket attributions would be invisible on the page.

**Standing risk from the widened pull:** those rows are team-owned (Content & Comms) and now ride
the normal outbox/push path, where `push-map.ts` writes `status` back — the same hazard as memory
`vishen-clip-status-decision-lock`. Fix if it appears: skip the outbox for rows whose only marker is
`Creative Ticket ID`.

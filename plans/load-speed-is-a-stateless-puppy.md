# Email results in the Monday pack — from Braze, keyed to the comms calendar

> Supersedes the message-page plan in this file (shipped 11 Sep, commits `3b299f1`…`a9eee34`).

## Context

The pack and the message page show Perch results for every social post, but every email row says
"results live in Braze". Rhythm asked Ramya where email performance lives; she named two places,
and both were investigated before writing this.

**The Braze Ops Hub** (`brazeops-hub-…-uc.a.run.app/dashboard`, Monique's app, repo
`mindvalley-ai/brazeops-hub`) **has no database.** Its dashboard is live Braze REST
(`/campaigns/list` → `/campaigns/details` → `/campaigns/data_series`, host
`rest.iad-01.braze.com`) in a 15-minute in-memory cache per Cloud Run instance, behind IAP with
no service-token path. There is nothing to read from it, and its JSON route is scoped to eight
newsletter tags — most comms-calendar emails would simply be absent. What it does give us free
is a proven summing loop (`lib/emailPerformanceEngine.ts:340-354` there) and two facts:
`/campaigns/data_series` returns **daily buckets only** — a literal "24h" number does not exist
in the API — and the hub itself treats sends younger than 48h as still maturing.

**The "24h email performance" sheet** (`1t_jmowuGmMHUXsbNPkdx0m5SO4avVcigI-gymkPEqaU`) is
hand-copied from the Braze UI: Braze's display rounding is visible (`1,600`, `28800`), percents
are strings, thousands separators differ within a column, and there are real typos (unsub rate
`15.00%` where 45/30,802 = 0.15%; sends greater than list size). Coverage is patchy and frozen —
Jun 12–16 2026 was never backfilled, revenue is empty on every 24h row, and dates carry no year
(`"Sep 18"`), so the 2025 and 2026 tabs are indistinguishable cell by cell. One planned email is
6–11 rows, one per list. It is a human log, not a feed.

Two things in the sheet are worth keeping for later: the team's **benchmarks** (Overall OR 35.9%,
CTR 2.8%, CTOR 5.5%, unsub 0.10%, with per-sequence targets — Invite 35–40% OR, Show-up 40–50%,
Sales 38–45%) for red/amber/green, and its index tab's own note against the Emails table —
*"needs to contain scope and performance"*. Neither is in this pass.

**What the app already has:** Airtable `📧 Emails` (`tblGeywttHc77AY1b`) is the planned-email
table the comms days link to. Each record carries `Live Date`, `📧 Email Type`, `📧 Audience`
(Daily / Highlights / Weekly / Members / Coach / Events / Vishen's List / Mastery), the full copy
with the subject inside it (`**Sub:** …` or `**Subject:** …`), and `📧 Braze email URL` — one
*dashboard* link per audience. Those 24-hex ids are Braze **dashboard ObjectIds, not REST
campaign ids**, so there is no id to join on; the match is subject + date, the same shape as the
Perch caption match that already runs at 57%. `📧 Sends` (`tblYzLOjqNHmfuAMp`) has exactly the
right metric columns and **4 rows, all March 2025** — dead, do not revive it.

And the pattern to mirror is already here: `social_metrics` + `lib/hootsuite/perch.ts` +
`app/api/metrics/perch-pull` + `.github/workflows/perch-metrics.yml` — a metrics sink keyed by
`dedupeKey`, a `requireSyncSecret` pull route, a nightly workflow, latest-capture reads.

**Decision (Rhythm, 11 Sep):** Braze REST with our own read-only key, which he is requesting from
Monique/Ramya. Results on the message-page email rows, as an Email read per day in the week pack,
and on a new email detail page.

**Blocked until the key arrives.** §2–§4 can be written and unit-tested without it; §5 must not
be built until §4 has reported a real match rate — the standing rule on this project is build
first, validate against live data, never theorise from schema alone.

---

## 1. The sink — `email_metrics` (mirror of `social_metrics`)

```prisma
model EmailMetric {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  brazeCampaignId String    @map("braze_campaign_id")   // REST id from /campaigns/list
  campaignName    String    @map("campaign_name")
  subject         String?
  audience        String?                                // Daily | Members | … from tags/name
  emailAirtableId String?   @map("email_airtable_id")   // 📧 Emails recId, once matched
  matchScore      Decimal?  @map("match_score") @db.Decimal(3,2) // how the match was made
  firstSentAt     DateTime? @map("first_sent_at") @db.Timestamptz
  sent Int?  delivered Int?  uniqueOpens Int?  machineOpens Int?  uniqueClicks Int?
  unsubscribes Int?  reportedSpam Int?  conversions Int?
  revenue         Decimal?  @db.Decimal(12,2)
  windowDays      Int?      @map("window_days")          // 2 = send day + next; null = to date
  capturedAt      DateTime  @map("captured_at") @db.Timestamptz
  source          String                                  // 'braze'
  raw             Json?
  dedupeKey       String    @unique @map("dedupe_key")   // braze:<campaignId>:<window>:<day>
  @@index([emailAirtableId, capturedAt(sort: Desc)])
  @@index([brazeCampaignId, capturedAt(sort: Desc)])
  @@index([firstSentAt])
  @@map("email_metrics")
}
```

One row per Braze campaign (= one email to one audience list) per capture. The app rolls the
lists of an email up at read time **and** keeps them separate — Daily and Members open rates are
different facts, and the sheet's own benchmarks are per list. `machineOpens` is stored because
Apple MPP inflates opens and the hub carries it for the same reason.

Migration `prisma/migrations/0032_email_metrics/` applied with `kessel db migrate` (per the
standing constraint: DDL goes through kessel, not `prisma migrate`).

## 2. The pull — `lib/braze/client.ts`, `lib/braze/pull.ts`, `app/api/metrics/braze-pull/route.ts`

Env: `BRAZE_API_KEY` (Kessel secret) and `BRAZE_REST_ENDPOINT` (default
`https://rest.iad-01.braze.com`). **Request the key with `campaigns.list` + `campaigns.details` +
`campaigns.data_series` up front** — Braze keys cannot be edited after creation, only deleted and
recreated.

`pullBrazeEmailMetrics({ sinceDays = 14 })`:
1. `GET /campaigns/list` paged, `include_archived=false`, `sort_direction=desc`,
   `last_edit.time[gt]=<since>`; stop at the first page older than the window.
2. Keep email campaigns; classify audience from tags then name, reusing the hub's map
   (`Vishen's Newsletter`, `Email/List/Daily`, `Email/List/Highlights`, `Weekly`,
   `Email/List/Sublist`, `Events`, `MV Coach`, `Email/Campaign - Members`). **Do not drop the
   unclassified** — the summit sequence may be tagged differently, and the hub's scope filter is
   exactly why its API is unusable for us. Log unknown tag/name shapes so the map grows from data.
3. Per campaign: `/campaigns/details` (subject, `first_sent`, tags) and
   `/campaigns/data_series?length=14`. Sum non-control email variants — copy the hub's loop
   (`sent`, `delivered`, `unique_opens`, `machine_open`, `unique_clicks`, `unsubscribes`,
   `reported_spam`, `conversions_by_send_time`, `revenue`). Store two rows: `windowDays = 2`
   (the send day + the next, the honest "24h") and `windowDays = null` (to date).
4. Concurrency 4 (the hub runs 8 on the same key — leave it headroom). Wrap in `timed()` so
   `kessel runtime-logs --search perf` shows the cost.

Route: `POST /api/metrics/braze-pull?sinceDays=`, `requireSyncSecret`, returns
`{ campaigns, upserted, classified, unclassified[], matched, unmatched[] }`. Nightly workflow
`.github/workflows/braze-metrics.yml` on the `perch-metrics.yml` pattern (03:45 UTC), plus a
fire-and-forget call from the pack via `after()` when the week's emails have no capture yet —
same trick as `scheduleOutboxDrain`, so Monday morning never waits on a cron.

## 3. Reading the planned emails — `lib/comms-calendar/emails.ts`

Today the calendar only knows an email's recId (the lane builds a synthetic `recXXX:email` chip).
Add `getEmailRecords(ids)`: batched `RECORD_ID()` fetch like `getSocialPosts`
(`lib/comms-calendar/social-posts.ts:207`), memoised with `swr('emails:…')`, projected to the
fields actually used — Title, Live Date, Email Type, Audience, Braze email URL, CTA, copy.
Parse the subject out of the copy with one regex over `**Sub:** …` / `**Subject:** …` (both
spellings are live) and keep the preheader when present.

`CalendarAsset` for an email gains `emailId`, `subject`, `audiences[]` so the lane chip stops
being a synthetic placeholder and can link to a detail page.

## 4. The match — `lib/braze/match.ts` (pure, tested), then MEASURE

Given the week's email records and the `email_metrics` rows:
- Candidates: `firstSentAt` within ±1 day of `Live Date` (sends are MYT morning; ±1 covers UTC
  and late-evening sends).
- Score: normalised subject equality (`norm()` from `social-posts.ts` — strips emoji, Liquid
  `{{…}}`, `&#13;`, punctuation) → 1.0; 45-char subject prefix → 0.9; campaign name contains the
  Title's distinctive words → 0.6. Audience must agree when both sides know it.
- ≥0.9 auto-accepts and writes `emailAirtableId` back onto the row. 0.6 shows as "probably
  <campaign name>". Below → unmatched; the row says **"no Braze campaign matched"**, never zero.

**Gate:** run the pull for the last 14 days, then report matched / unmatched per email in the
route's response and check it by hand against this week's six emails (four summit + two
newsletters). If the rate is poor, the fix is a `braze_campaign_id` field on the Airtable Emails
table filled at planning time — a workflow ask for Ramya, not more string matching. Do not build
§5 on an unmeasured join.

## 5. The surfaces (only after §4 reports a real rate)

- **Message page email rows** — `components/mow/MessageWeek.tsx`, the `kind === 'email'` branch
  of `Result`, replacing "results live in Braze": `sent · open rate · CTOR · unsubs` per audience,
  revenue when non-zero, and "day 1 · still maturing" when `capturedAt − firstSentAt < 48h`.
- **Week pack** — a `PlatformRead` with `platform: 'Email'` per day, built from `email_metrics`
  in `lib/mow/week-pack.ts` beside `dailyPlatformReads`: `posts` = emails sent, `reach` = null
  (email has none), `engagements` = unique opens, `clicks` = unique clicks. A separate query,
  **never summed with social** — the standing rule in that file's header. `coverageOf` names
  Email with what it actually reports.
- **Email detail** — `app/studio/comms-calendar/email/[id]/page.tsx`: title, live date, type,
  audiences, subject/preheader, the copy, CTA links, the Braze dashboard links (those work fine
  for humans), and a per-audience results table carrying "matched to <campaign name>" provenance.
  The message-page rows and the calendar's Email chips link here — the recId is already in the
  synthetic id, so `AssetRow` just needs an href for MV emails.

## Not doing
- Reading the hub's API (IAP, no service path, scoped to eight newsletter tags).
- Reading or writing the Google Sheet, or reviving Airtable `📧 Sends`.
- A literal 24-hour figure — the API has daily buckets; the UI says "day 1" / "day 1–2".
- Iterable (the 2025-era show-up sequences) — historical only.

## Files

New: `prisma/migrations/0032_email_metrics/`, `lib/braze/{client,pull,match}.ts`,
`lib/comms-calendar/emails.ts`, `lib/mow/email-reads.ts`, `app/api/metrics/braze-pull/route.ts`,
`app/studio/comms-calendar/email/[id]/page.tsx`, `.github/workflows/braze-metrics.yml`,
`tests/offline/verify-braze-match.mts`.

Modified: `prisma/schema.prisma`, `lib/comms-calendar/{data.airtable,types}.ts`,
`lib/mow/{week-pack,message-week}.ts`, `components/mow/{MessageWeek,DayTable}.tsx`,
`components/comms-calendar/WeekGrid.tsx`, `.env.example`.

## Verification

- Offline (`npm run verify`): match scoring against verbatim pairs — this week's four summit
  emails and two newsletters, plus a deliberate near-miss and a Liquid-laden subject; and the
  `data_series` summing over a captured fixture, including the control-variant exclusion.
- With the key set: `curl -X POST "$URL/api/metrics/braze-pull?sinceDays=14" -H "Authorization:
  Bearer $SYNC_SECRET"` → inspect `unclassified[]` and `unmatched[]`, then
  `kessel db query "select campaign_name, audience, first_sent_at, sent, unique_opens,
  email_airtable_id from email_metrics order by first_sent_at desc limit 20"`.
- Production: the *Expert to Authority* message page shows Mon/Wed/Thu/Fri emails with sends and
  open rates per list; the pack's day table carries an Email row; the email detail opens from
  both surfaces.
- Cost: `[perf] braze …` lines. A nightly pull of ~30 campaigns × 2 calls is nowhere near Braze's
  data_series limit, and the key is shared with the hub — keep concurrency at 4.

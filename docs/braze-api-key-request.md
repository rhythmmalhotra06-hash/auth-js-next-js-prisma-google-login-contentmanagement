# Request: a read-only Braze REST API key for the Content Portal

**Status:** open — the integration is built, tested and deployed; it does nothing until a key exists.
**Owner of the ask:** Nicole Chin (Marketing/Tech — Braze)
**Raised by:** Rhythm Malhotra
**Blocks:** email performance in the Monday content meeting pack.

---

## The ask, in one line

A **read-only Braze REST API key** for the Content Portal, carrying exactly three permissions:

| Permission | What we call it for |
|---|---|
| `campaigns.list` | Find the campaigns edited in the last fortnight |
| `campaigns.details` | Read each one's subject line, tags and first-sent time |
| `campaigns.data_series` | Read its daily sends / opens / clicks / unsubscribes |

**All three must be on the key from the start.** Braze keys cannot be edited after creation —
only deleted and recreated — so a key issued with two of the three means starting over.

Nothing else is needed. No write scopes, no user-data scopes, no `users.*`, no `/messages/send`.
The integration never writes to Braze and never reads a user profile.

REST host: `rest.iad-01.braze.com` (our cluster — same one the Braze Ops Hub uses).

---

## Why

Vishen's stated problem with the existing reporting is that he cannot see what the content team
produced or how it performed. The Monday 08:00 MYT meeting now runs off one page in the Content
Portal, which shows, for each week: what was planned, what went out, and what it did.

The social half of that is live — Hootsuite Perch numbers sit beside every post. **The email half
is a blank.** Every email on the calendar currently reads "Braze not connected — no email results
yet", while Ramya's team maintains the numbers by hand in a Google Sheet, copied out of the Braze
UI one campaign at a time.

Email is a large share of what the team ships — the comms calendar plans one to four emails on
most weekdays, each going to six-to-eleven lists — so a content report that silently omits it is
describing half the week.

## Why not the two things that already exist

Both were investigated properly before asking for anything new.

**1. The Braze Ops Hub** (`brazeops-hub-…`, Monique's) — it has **no database**. Its dashboard is
live REST calls held in a 15-minute in-memory cache per container, behind IAP with no
service-account path, and its API is scoped to eight newsletter tags. Launch-sequence emails —
exactly the ones the content meeting cares about — are filtered out of its response entirely. So
there is nothing there to read, and pointing at it would also couple our uptime to a
single-maintainer app in another region.

**2. The "24h email performance" Google Sheet** — it is hand-typed from the Braze UI. Braze's
display rounding is visible in the cells (`1,600`, `28800`), percentages are stored as text, one
unsubscribe rate reads 15.00% where the arithmetic gives 0.15%, several weeks were never
backfilled, revenue is empty on every row, and the dates carry no year at all. It is a good
human record and a bad data source, and reading it would make the portal repeat the typos.

Both ultimately read **Braze**. So the portal should read Braze.

## What it will do with the key

- One scheduled job, **once a night at 03:45 UTC**, pulling the last 14 days.
- Roughly **30 campaigns per run, 2 calls each** — about 60 requests a night, far below any
  Braze rate limit, and concurrency is capped at 4 to leave headroom for the Ops Hub on the same
  cluster.
- Stores sends, delivered, unique opens, machine opens, unique clicks, unsubscribes, reported
  spam, conversions and revenue **per campaign**, in our own Postgres.
- The key lives only as a Kessel secret, server-side. It is never sent to a browser.
- Read-only: the integration has no code path that writes to Braze.

## Risk

Low. The worst case for Braze is 60 read requests a night. The worst case for us is that the
subject-line match rate is poor, which is our problem to solve and is measured on day one.

## What "done" looks like

1. Key issued with the three permissions above.
2. `kessel env secret BRAZE_API_KEY=…` on project
   `auth-js-next-js-prisma-google-login-ContentManagement`.
3. First pull run; we report back how many of the week's emails matched a campaign.

---

## One related ask for Ramya (not blocking, but it decides how well this works)

Braze's REST API and its dashboard URLs use **different ids** — the dashboard links pasted into
the Airtable `📧 Emails` table cannot be converted into the ids the API uses. So the portal
matches an email to its Braze campaign by **subject line + send date**, the same way it matches
social posts by caption.

That works, but it is inference. Two fields on the 📧 Emails table would make it exact:

- **`📧 Subject`** — the subject is currently the first line of the copy, written three different
  ways (`**Sub:**`, `**Subject:**`, `**Subject: …**`). It is the key this whole join rests on.
- **`Braze Campaign ID`** — the REST id, pasted at planning time. If the subject match proves
  unreliable, this replaces the guessing entirely.

We will run the pull first and bring a real match rate to that conversation rather than asking
for schema changes on a hunch.

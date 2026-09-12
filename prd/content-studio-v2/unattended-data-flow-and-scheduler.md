---
title: 'E-C · Unattended data flow & scheduler'
slug: 'unattended-data-flow-and-scheduler'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-12
resolution: 5/7
---

# E-C · Unattended data flow & scheduler

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.4, §1 finding,
> §4 data flow, §5 screen 10, §7.1–7.2, §7.8; decisions D11, D15, D25, D26, D28, D46, D51). No code
> until the real-data prototype is approved [D23].

> **Extended 2026-09-12** with the rev-4 delivery decisions (plan §5d, §6): **D117** the scheduler
> choice that closes O6, **D108** staleness thresholds, **D118** backfill scope. Transcription only
> — no new decisions [D129]. The scheduler and the Perch mapper fix are **steps 1 and 2 of slice 1**
> [D104].

## Purpose

Make the numbers arrive on their own. Today Metabase, Composio and Braze are session-side claude.ai
connectors that only work while someone is in a chat; the scheduler is GitHub Actions whose "every
5 minutes" fires 3–11 hours apart; three documented crons do not exist; and the one unattended
source we do have (Perch) is mapped so thinly that `views` is filled on 0 rows although the payload
carries it on 869/869 IG rows. Every time-windowed promise in E-B (day-1 capture at 18–36h, the
Sunday proposal run, the 24h DM) depends on this epic, and every "not connected" state on screen is
this epic being honest.

## User Stories

**Yuthika (editor) — the DM arrives on time.** Her reel was posted at 23:01 UTC; the day-1 capture
lands inside 18–36h and the DM follows. It does not arrive two days late because a workflow queue
stalled.

**Rhythm (admin) — Connections & data health.** One screen lists each source — Perch, YouTube Data
API, YouTube Analytics, Metabase, Braze, Composio, LinkedIn manual — as *owned / session-only / not
connected*, with last pull, row count, and the crons that exist vs the ones documented. When a token
dies the source flips to "not captured" and the surfaces that depend on it say so.

**Vishen (founder) — one real number.** The Monday figure for each brand is the Metabase week
figure (Q31846 leads / Q32044 revenue), pulled by the app with the ingest guards (organic-social
filter, distinct `order_id`, truncation check, brand named), not pasted from a chat session [D26].

**Glen (data) — the AI never narrates a number.** Every figure on screen is traceable to a source
row and a capture time; the app holds the credentials, not a person's browser session [O5].

**Vidura (social manager) — LinkedIn by hand, honestly.** For a LinkedIn post he types the 24h and
7d numbers; the surface shows "entered by Vidura" beside them [D46].

## Workflows

**1. Perch mapper lift (pure mapper fix, first).** Lift `post_views`, `likes`, `saved`, `shares`,
`comments`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`, `post_type`,
`collaborators` (+ invite status) from the raw payload into `social_metrics` columns for all
captures, including a one-off re-map of the existing 1,642 rows [plan §1 finding, §7.2].

**2. App-owned pulls on a real scheduler** [plan §4]. Credentials live in `external_credentials`;
each pull records source, started/finished, rows, and errors. Sources and order: Perch (today) →
YouTube public Data API stats via the existing `YOUTUBE_API_KEY` for VL videos with a YouTube
Published Link (views/likes/comments) [D28] → Metabase REST for the allowlisted Q31846/Q32044 with
the `scripts/mow-ingest-agent.md` guards [D26] → Braze REST for email sends [D51] → Composio SDK for
coverage where an account is connected [D28] → YouTube Analytics channel OAuth for CTR/AVD [D46,
O9].

**3. Capture windows the scheduler must hit** [D35, D38, D47]: a first capture 18–36h after
`posted_at` and one at 6.5–7.5 days for every Publication on a covered channel; the Sunday-night
proposal run; the 24h editor DM.

**4. Honest absence** [D15, D28, D46]: a source with no credential shows "not connected"; a dead
token shows "not captured"; YouTube CTR/AVD show "needs YouTube Analytics OAuth"; LinkedIn shows
manual entries with "entered by". Nothing is fabricated and nothing stale is shown as current.

**5. Channels** [D11]: v1 = IG (all MV accounts Perch covers) + FB (Perch, clicks only). v1.1 =
YouTube, TikTok, LinkedIn/VL — each appears only once its pull exists.

**6. The scheduler — an external cron service, added alongside GitHub Actions** [D117, plan §6.1].
O6 is closed. The choice is an **external cron service** (cron-job.org or similar) pointed at the
**existing bearer-gated routes** — `/api/sync/push`, `/api/sync/pull`, `/api/metrics/perch-pull`.
Three properties decided it: **zero new infrastructure**, **minute-level accuracy**, and it
**works today**. Kessel's own scheduler can replace it later without touching application code,
because the app's side of the contract is just an HTTP route with a secret.

It is **added, not swapped**. Both paths keep running, and both are safe to run together because
both are idempotent: `drainOutbox` groups by `(entity, entityId)` and the pull is cursored with 90s
echo suppression. Running both **strictly improves freshness for everyone**, including the Monday
MOW. `.github/workflows/ticket-sync.yml` is retired only **after** the 14 Sep MOW [D117, plan §6.1].

**7. Staleness — the number stays, the label travels with it** [D108]. Every surface **always shows
capture time**. Beyond that:

| Age since last successful capture | State |
|---|---|
| within one run | normal |
| **> 36h** (one missed run) | **amber** |
| **> 60h** (two missed runs) | **red, labelled "not current"** |

The number is **not hidden** when it goes amber or red — hiding it would just make people ask
elsewhere. What matters is that **the label propagates**: any Signal (E-I) or Slack DM computed from
a stale number carries the same staleness marker, so nobody receives a confident-looking message
built on a two-day-old capture [D108, D15].

**8. Backfill: everything, with no date floor** [D118]. When the matcher first runs with a real key
it processes **every Perch post** (27 Aug onward — all Perch holds), **every `VishenVideo` with a
published link** (185), **every Social record with a link**, plus **caption matches across all
released Social records**. There is no "from today forward" cutoff, because a repository that starts
empty is a repository nobody opens; this way it is useful on day one. The backfill runs behind a new
bearer-gated route using the existing `requireSyncSecret` guard [plan §6.4].

[UNRESOLVED] The retry / back-off policy when a scheduled pull fails, and how many consecutive
misses escalate beyond the D108 red label. D108 fixes what the *user* sees and E-I fixes who gets
told (a Signal to Rhythm when a source is stale > 36h), but the runner's own retry behaviour is not
in the plan — owner: Rhythm (who owns the scheduler, D104 and D117).

## Boundaries

- Session-side claude.ai connectors are not a production data source; anything the app shows must
  come from an app-owned pull or a labelled manual entry [plan §1.4, D46].
- Metabase stays at week/campaign level; the allowlist is Q31846 and Q32044 only; no per-post
  revenue or leads [D16, D26].
- No YouTube CTR/AVD, TikTok, or LinkedIn API metrics until each integration exists; no Composio
  data unless an account is connected [D11, D28].
- Never fabricate or interpolate a missing capture; a missed window is shown as missed [D15].
- No new URL shortener or tracking infrastructure in this epic (post-level attribution is a
  short-code question, O2).
- **No new scheduling infrastructure** — the external cron calls routes that already exist, and
  GitHub Actions is not removed until after the 14 Sep MOW [D117].
- **A stale number is never hidden and never shown bare** — it keeps its capture time and carries
  its amber/red label into every Signal and DM derived from it [D108].
- **No date floor on the backfill**, and no partial backfill that silently starts at "today"
  [D118].

## Dependencies

- ~~O6 — scheduler choice~~ **closed by D117**: an external cron service on the existing bearer
  routes, added alongside GitHub Actions.
- O5 — who owns the app-side keys for Metabase / Braze / Composio (Glen to confirm).
- O9 — YouTube Analytics channel OAuth timing and the channel owners.
- O10 — Braze connector authorisation for the email lane.
- Existing: `lib/hootsuite/perch.ts`, `lib/metrics/social-perf.ts`, `ingestSocialMetrics()`,
  `YOUTUBE_API_KEY`, `scripts/mow-ingest-agent.md` guards, the render service (for `durationSec`
  via ffprobe, D34).

- The **retention / thinning job** of D119 runs here: keep day-1/7/30 snapshots forever, thin the
  rest to weekly after 90 days, drop `raw` on thinned rows (the model is E-A's).
- The existing bearer-gated routes `/api/sync/push`, `/api/sync/pull`, `/api/metrics/perch-pull` and
  `lib/api/guard.ts`'s `requireSyncSecret` — what the external cron actually calls [D117].

[UNRESOLVED] **O5** — who owns the app-side keys for Metabase, Braze and Composio — is an
owner-level decision this epic's features 6, 8 and 9 cannot start without; the plan names a
candidate but records no decision — owner: Glen. (**O6 is now closed** by D117, so the scheduler
itself no longer blocks features 1–4.)

## Success Criteria

- `views` is non-null on 100% of IG rows whose raw payload carries `post_views` (today 0 of 869);
  `ig_reels_avg_watch_time` populated on every reel row that carries it (468 today).
- ≥ 95% of Publications on a covered channel have a capture inside the 18–36h window and another
  inside 6.5–7.5 days (query on `captured_at − posted_at`).
- The Sunday proposal run and the 24h DM fire within 15 minutes of their scheduled time on ≥ 95%
  of runs (scheduler log).
- Zero surfaces display a value from a source whose last successful pull is older than its window
  without the "not captured" label (snapshot test).
- Every documented cron exists in the scheduler and every scheduler entry is documented (the
  Connections screen shows 0 in the "documented but missing" column).
- Vishen's Monday number equals the Metabase question result for the week, with brand and source
  labelled, on every MOW run.
- No credential is readable from client code or the repository (secret scan passes).
- **Both schedulers run without interfering** [D117]: with the external cron and the GitHub
  workflows both firing, `drainOutbox` produces no duplicate pushes (grouped by
  `(entity, entityId)`) and the cursored pull's 90s echo suppression produces no duplicate rows —
  spot-checked over a window where both fired.
- **Staleness is labelled, not hidden** [D108]: every displayed number carries its capture time; a
  source last captured > 36h ago renders amber and > 60h renders red with "not current"; 0 Signals
  or DMs computed from a stale source omit that label.
- **The backfill has no date floor** [D118]: after it runs, Publications exist for every Perch post,
  every `VishenVideo` with a published link (185), and every Social record with a link; a query for
  the earliest Publication returns the earliest post Perch holds, not the deploy date.

## Features

1. Perch mapper lift + one-off re-map of existing rows. **Slice 1, step 2** [D104].
2. **External cron service on the existing bearer routes, added alongside the GitHub workflows**,
   with per-run logging; `ticket-sync.yml` retired only after the 14 Sep MOW [D117]. **Slice 1,
   step 1.**
3. `external_credentials` store and a pull runner with source/start/finish/rows/errors.
4. Connections & data health screen (per source: owned / session-only / not connected, last pull,
   rows, crons exist vs documented) — prototype screen 10 — with **D108's amber/red staleness
   states** and the **two 60-day numbers with their stamped baseline** [D115]. **Slice 1, step 5.**
5. YouTube public Data API pull for VL videos with a Published Link.
6. Metabase REST pull for Q31846 / Q32044 with ingest guards.
7. LinkedIn manual 24h/7d entry with "entered by".
8. Braze REST pull for email sends (after O10).
9. Composio SDK pull where an account is connected (after O5).
10. YouTube Analytics OAuth for CTR/AVD (after O9).
11. **No-date-floor backfill** behind a bearer-gated route using `requireSyncSecret` [D118].
    **Slice 1, step 4.**
12. **Metric retention job** — keep day-1/7/30 forever, thin the rest to weekly after 90 days, drop
    `raw` on thinned rows, on the same scheduler [D119].

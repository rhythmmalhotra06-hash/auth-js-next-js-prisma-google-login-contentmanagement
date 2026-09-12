---
title: 'E-C · Unattended data flow & scheduler'
slug: 'unattended-data-flow-and-scheduler'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 5/7
---

# E-C · Unattended data flow & scheduler

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1.4, §1 finding,
> §4 data flow, §5 screen 10, §7.1–7.2, §7.8; decisions D11, D15, D25, D26, D28, D46, D51). No code
> until the real-data prototype is approved [D23].

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

[UNRESOLVED] The scheduler itself is undecided — Kessel cron vs an external scheduler (O6, owner
Rhythm). The retry/back-off policy and the alerting path when a scheduled pull misses its window
are not in the plan.

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

## Dependencies

- O6 — scheduler choice (Rhythm).
- O5 — who owns the app-side keys for Metabase / Braze / Composio (Glen to confirm).
- O9 — YouTube Analytics channel OAuth timing and the channel owners.
- O10 — Braze connector authorisation for the email lane.
- Existing: `lib/hootsuite/perch.ts`, `lib/metrics/social-perf.ts`, `ingestSocialMetrics()`,
  `YOUTUBE_API_KEY`, `scripts/mow-ingest-agent.md` guards, the render service (for `durationSec`
  via ffprobe, D34).

[UNRESOLVED] O5 and O6 are both owner-level decisions this epic cannot start without; the plan
names candidates but records no decision.

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

## Features

1. Perch mapper lift + one-off re-map of existing rows.
2. Scheduler migration off GitHub Actions (per O6) with per-run logging.
3. `external_credentials` store and a pull runner with source/start/finish/rows/errors.
4. Connections & data health screen (per source: owned / session-only / not connected, last pull,
   rows, crons exist vs documented) — prototype screen 10.
5. YouTube public Data API pull for VL videos with a Published Link.
6. Metabase REST pull for Q31846 / Q32044 with ingest guards.
7. LinkedIn manual 24h/7d entry with "entered by".
8. Braze REST pull for email sends (after O10).
9. Composio SDK pull where an account is connected (after O5).
10. YouTube Analytics OAuth for CTR/AVD (after O9).

# OSS Self-Hostable Social Media Tools with Analytics — Research (early 2026)

Use case: "pull owned-account post-level analytics into Postgres, linked to content assets."
The deciding criteria are (1) does it expose real post-level analytics for owned accounts,
and (2) is that data QUERYABLE (DB or API) rather than UI-only.

## TL;DR verdict table

| Tool | License | Analytics? | Queryable? | Verdict for use case |
|------|---------|-----------|-----------|----------------------|
| Postiz | AGPL-3.0 (self-host fully free) | Yes, per-post + per-channel | **Yes — Postgres + free public REST API** | **Best fit** |
| Mixpost Lite | MIT | "Basic" only, 3 platforms, no API | DB only (MySQL), API is Pro-gated | Weak — Lite too limited |
| Mixpost Pro | Commercial ($299 one-time) | Advanced, 11 platforms, has API | Yes (MySQL + API) | Viable if paid |
| Socioboard | Open source (GPL-ish) | Claims analytics | Unknown | **Abandoned (last release 2019) — avoid** |
| Devr.AI | (irrelevant) | N/A — DevRel/community bot | N/A | Not a social media analytics tool |
| Halftone | n/a | — | — | No such OSS tool found |
| Trywilder | unclear/site-only | claims analytics | unverified | Low confidence, thin provenance |

---

## 1. Postiz — BEST FIT

- Repo: https://github.com/gitroomhq/postiz-app
- License: **AGPL-3.0**. Self-host is fully free at feature parity with cloud — no feature gating. AGPL caveat: if you modify Postiz and offer it as a network service to others, you must release your modifications. (For internal Mindvalley use this is not triggered.) https://github.com/gitroomhq/postiz-app/blob/main/README.md
- Stars: ~30k+ (reported 29.8k Apr 2026, 32k+ later) — by far the most active.
- Stack: **Node.js (Next.js + NestJS), Prisma ORM, PostgreSQL (default DB), Redis optional.** Docker-based self-host. https://railway.com/deploy/postiz
- Platforms: 30+ — X, Instagram, Facebook, TikTok, YouTube, LinkedIn, Bluesky, Mastodon, Pinterest, Reddit, Threads, Telegram, Discord, WordPress, Nostr, Farcaster, etc.
- **Analytics: real.** Per-channel and per-post metrics pulled from each network's official insights API — impressions, likes, comments, shares, reach, engagement rate (varies by platform). https://docs.postiz.com/public-api/analytics/platform
- **QUERYABLE — the key win:**
  - Data sits in **PostgreSQL** (your stack) via Prisma — directly inspectable.
  - **Public REST API is enabled by default in self-hosted and is completely free** (no paid gate; cloud differs only by rate limit). Endpoint: `GET /public/v1/analytics/{integration}?date={days}` returns followers/impressions/engagement etc. API key from Settings → Public API. Self-host rate limit tunable via `API_LIMIT` env var. https://docs.postiz.com/public-api/introduction
- Verdict: **Strongest candidate.** Postgres-native + free queryable analytics API + broad owned-account platform coverage. You can either query its Postgres directly or call its REST API to pull metrics into your own assets DB. Watch the AGPL term and that per-network metric depth depends on each platform's API permissions/scopes.

## 2. Mixpost — depends heavily on Lite vs Pro

- Repo (Lite): https://github.com/inovector/mixpost — License **MIT**, ~3.4k stars.
- Stack: **PHP / Laravel + Vue (Inertia), MySQL.** Docker or install into existing Laravel app. https://docs.mixpost.app/
- **Lite (free, MIT):**
  - Platforms: only **3** — Facebook Pages, X, Mastodon. https://mixpost.app/pricing
  - Analytics: **"Basic analytics" only.** **No API access** (API is Pro-gated). So in Lite, analytics is essentially UI; queryability is limited to reading the MySQL tables directly.
  - Verdict: too platform-limited (no IG/TikTok/YouTube/LinkedIn) and no API → weak for the use case.
- **Pro ($299 one-time) / Enterprise ($1,199), commercial license:**
  - Platforms: 11 — FB, Instagram (posts/reels/stories), X, LinkedIn (profile + company), YouTube, TikTok, Pinterest, Threads, Bluesky, Google Business Profile, Mastodon.
  - Analytics: **"Advanced analytics" + API Access** (both Pro-only). Metrics marketed: reach, engagement, impressions, clicks, audience growth, demographics, best-time-to-post. https://mixpost.app/features
  - Data in **MySQL** → directly queryable; plus API. Note Pro is "source-available/commercial," not OSS — one-time fee, updates for 1 year.
- Verdict: Pro is a viable paid path with MySQL + API, but it is **not free OSS** and uses MySQL not Postgres. Lite is free but too limited. Note: "Advanced analytics" is a marketing claim — depth of true post-level owned-account metrics should be validated on a trial before committing.

## 3. Socioboard — AVOID (abandoned)

- Repo: https://github.com/socioboard/Socioboard-5.0 — open source, ~1.5k stars.
- Stack: Node.js/Express + Mongoose + Sequelize, PHP/Blade frontend; supports ~9 networks.
- **Last release Nov 2019.** Effectively unmaintained; social platform APIs have changed massively since (IG Graph, X API v2 paywalls, TikTok), so connectors are almost certainly broken.
- Analytics claimed (reports/dashboards) but storage/queryability not documented and moot given abandonment.
- Verdict: **Do not use.** Stale, broken-connector risk.

## 4. Other candidates checked

- **Devr.AI** (https://github.com/AOSSIE-Org/Devr.AI): NOT a social media management tool. It is an AI **DevRel / open-source community** assistant for Discord/Slack/GitHub/Discourse. Irrelevant to owned-account social analytics. Exclude.
- **"Halftone":** No open-source social media management tool by this name found in 2025/2026 searches. Likely a mis-reference; nothing to evaluate.
- **Trywilder** (trywilder, appears in roundups): claims self-hosted scheduling + "advanced analytics" + content library. **Provenance is thin** — surfaced only via listicles, source distributed via its own site, no clear GitHub/license/DB details confirmed. Low confidence; would need direct verification before relying on it.
- Postiz's own roundup lists ~12 OSS schedulers; the rest (e.g. trypost/trypostit) are publish-first schedulers with little/no analytics story.

---

## Bottom line for "owned-account post-level analytics into Postgres"

1. **Postiz** is the clear recommendation: AGPL, free self-host, **Postgres-native**, and a **free queryable analytics REST API** returning per-post/per-channel metrics. Either read its Postgres directly or pull via API to link metrics → your content assets.
2. **Mixpost Pro** is the paid fallback (MySQL + API, more polished, 11 platforms) but is commercial and not Postgres.
3. **Mixpost Lite** = free but 3 platforms and no API → not enough.
4. **Socioboard** = abandoned; **Devr.AI** = wrong category; **Halftone** = not found.

Honesty flags: most OSS tools in this space are **publish/schedule-first**; real owned-account analytics depth is always gated by each network's official API scopes, so verify metric coverage per platform (especially Instagram/TikTok/YouTube) on a live test account before committing — for ALL tools, including Postiz.

### Sources
- https://github.com/gitroomhq/postiz-app
- https://github.com/gitroomhq/postiz-app/blob/main/README.md
- https://docs.postiz.com/public-api/analytics/platform
- https://docs.postiz.com/public-api/introduction
- https://railway.com/deploy/postiz
- https://github.com/inovector/mixpost
- https://mixpost.app/pricing
- https://mixpost.app/features
- https://docs.mixpost.app/
- https://github.com/socioboard/Socioboard-5.0
- https://github.com/AOSSIE-Org/Devr.AI
- https://medevel.com/os-social-media-projects/

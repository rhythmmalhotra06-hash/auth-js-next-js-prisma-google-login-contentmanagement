-- Revert the `views` half of 0032_social_metric_engagement.
--
-- 0032 added the engagement columns AND backfilled each row from its own `raw`. The columns
-- were safe; the backfill was not, because a read path already preferred the column it filled:
-- `reachOf()` in lib/metrics/social-metric-types.ts is `views ?? impressions ?? reach`, so
-- filling `views` silently moved every figure on /performance and /studio — 943 of 1,588
-- 30-day rows changed, ~1.39x higher (208 -> 310, 191 -> 241, 301 -> 347). Rhythm's call:
-- restore yesterday's display exactly, and have v2 read views from `raw` at query time.
--
-- This nulls ONLY what 0032 wrote. The 30 TikTok rows are excluded because they had `views`
-- before 0032 ever ran: pick() normalises keys by lowercasing and stripping `_`, so
-- tiktokbusiness_metrics.video_views -> `videoviews` already matched the old `videoViews`
-- key. Instagram's `post_views` -> `postviews` and Facebook's `post_media_view` did not,
-- which is the entire bug 0032 set out to fix.
--
-- Nothing is lost: every number still sits in `raw`, so re-running 0032's UPDATE restores it.
-- The other engagement columns (saves, shares, comments, likes, watch time, post_type,
-- collaborators) are untouched — no read path prefers any of them.

UPDATE "social_metrics"
   SET "views" = NULL
 WHERE "views" IS NOT NULL
   AND raw #>> '{details,metrics,tiktokbusiness_metrics,video_views}' IS NULL;

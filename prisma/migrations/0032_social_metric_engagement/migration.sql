-- 0032 · the engagement breakdown Perch was already sending us
--
-- Every column here has been arriving in `raw` since the first Perch pull and has never been
-- read. `pick()` in lib/hootsuite/perch.ts normalises keys by lowercasing and stripping `_`,
-- so Instagram's `post_views` never matched the `views` list — which is the entire reason
-- `views` is null on all 1,642 stored rows while `raw` carries the number on 869 of them.
-- Measured against production, 11 Sep 2026.
--
-- Additive only: new nullable columns, backfilled from each row's own payload. No existing
-- column is read or rewritten, so the live portal cannot be affected by this migration.

ALTER TABLE "social_metrics"
  ADD COLUMN IF NOT EXISTS "saves"               integer,
  ADD COLUMN IF NOT EXISTS "shares"              integer,
  ADD COLUMN IF NOT EXISTS "comments"            integer,
  ADD COLUMN IF NOT EXISTS "likes"               integer,
  ADD COLUMN IF NOT EXISTS "avg_watch_seconds"   numeric(8,2),
  ADD COLUMN IF NOT EXISTS "total_watch_seconds" integer,
  ADD COLUMN IF NOT EXISTS "post_type"           text,
  ADD COLUMN IF NOT EXISTS "collaborators"       jsonb;

-- Backfill from the row's own `raw`. Instagram, Facebook and TikTok each name their metric
-- block differently, so each is read at its own path rather than guessed at.
UPDATE "social_metrics" SET
  "saves" = COALESCE("saves", NULLIF(raw #>> '{details,metrics,instagram_metrics,saved}', '')::integer),
  "shares" = COALESCE("shares",
      NULLIF(raw #>> '{details,metrics,instagram_metrics,shares}', '')::integer,
      NULLIF(raw #>> '{details,metrics,facebook_metrics,shares}', '')::integer,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,shares}', '')::integer),
  "comments" = COALESCE("comments",
      NULLIF(raw #>> '{details,metrics,instagram_metrics,comments}', '')::integer,
      NULLIF(raw #>> '{details,metrics,facebook_metrics,comments}', '')::integer,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,comments}', '')::integer),
  "likes" = COALESCE("likes",
      NULLIF(raw #>> '{details,metrics,instagram_metrics,likes}', '')::integer,
      NULLIF(raw #>> '{details,metrics,facebook_metrics,reactions}', '')::integer,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,likes}', '')::integer),
  "avg_watch_seconds" = COALESCE("avg_watch_seconds",
      NULLIF(raw #>> '{details,metrics,instagram_metrics,ig_reels_avg_watch_time}', '')::numeric,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,average_time_watched}', '')::numeric),
  "total_watch_seconds" = COALESCE("total_watch_seconds",
      NULLIF(raw #>> '{details,metrics,instagram_metrics,ig_reels_video_view_total_time}', '')::integer,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,total_time_watched}', '')::integer),
  "post_type" = COALESCE("post_type",
      NULLIF(raw #>> '{details,instagram_metadata,post_type}', ''),
      NULLIF(raw #>> '{details,facebook_metadata,post_type}', ''),
      NULLIF(raw #>> '{details,tiktokbusiness_metadata,post_type}', '')),
  "collaborators" = COALESCE("collaborators", raw #> '{details,instagram_metadata,collaborators}')
WHERE raw IS NOT NULL;

-- `views` is the headline casualty of the key-normalisation bug: present in the payload,
-- absent from the column. Only ever filled where it is currently null, so a manually entered
-- view count is never overwritten by a scraped one.
UPDATE "social_metrics" SET
  "views" = COALESCE(
      NULLIF(raw #>> '{details,metrics,instagram_metrics,post_views}', '')::integer,
      NULLIF(raw #>> '{details,metrics,facebook_metrics,insights_metrics,post_media_view}', '')::integer,
      NULLIF(raw #>> '{details,metrics,tiktokbusiness_metrics,video_views}', '')::integer)
WHERE "views" IS NULL AND raw IS NOT NULL;

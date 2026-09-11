-- Latest capture per post, indexed.
--
-- The nightly Perch cron re-captures every post, so social_metrics holds ~5 rows per post and
-- every read that wants "the post's current numbers" is `distinct on (platform_post_id) ...
-- order by platform_post_id, captured_at desc`. Three readers do this on every Monday-pack and
-- calendar load (week-pack.ts, social-posts.ts), and with no index on that pair Postgres sorts
-- the whole table each time. The table grows by a few hundred rows a night.
CREATE INDEX IF NOT EXISTS "idx_social_metrics_post_capture"
  ON "social_metrics" ("platform_post_id", "captured_at" DESC);

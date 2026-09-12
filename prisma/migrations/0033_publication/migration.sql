-- 0033 · Publication — the missing middle between a plan and a number
--
-- `ticket_airtable_id` is set on 0 of 1,642 metric rows and `assets` has 0 rows, so "how did
-- my asset do" has never been answerable. Nothing recorded *this asset went out on that
-- account at that time*; attribution was re-inferred on every read, by nobody.
--
-- One row per (account × platform post). A cross-post to Facebook is its own row, never a
-- channel array: Instagram reports reach, Facebook clicks and TikTok views, and summing them
-- inflates by roughly 5×. A row with no ticket is legal — those are the posts the social team
-- made directly, and they stay in cohorts as peers.
--
-- New table plus one nullable FK column on social_metrics. Nothing existing is rewritten.

CREATE TABLE IF NOT EXISTS "publications" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_ref"                 text NOT NULL,
  "channel"                     text,
  "platform_post_id"            text,
  "published_url"               text,
  "post_type"                   text,
  "published_at"                timestamptz,
  "goal"                        text,
  "tags"                        text[] NOT NULL DEFAULT '{}',
  "ticket_airtable_id"          text,
  "social_record_id"            text,
  "vishen_video_id"             text,
  "derived_from_publication_id" uuid REFERENCES "publications"("id") ON DELETE SET NULL,
  "link_tier"                   text,
  "linked_at"                   timestamptz,
  "confirmed"                   boolean NOT NULL DEFAULT false,
  "confirmed_by"                text,
  "removed_from_platform_at"    timestamptz,
  "created_at"                  timestamptz NOT NULL DEFAULT now(),
  "updated_at"                  timestamptz NOT NULL DEFAULT now()
);

-- Two partial uniques rather than one composite: a post may be known by its platform id, by
-- its URL, or by both, and NULLs must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_publication_account_post"
  ON "publications" ("account_ref", "platform_post_id") WHERE "platform_post_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_publication_account_url"
  ON "publications" ("account_ref", "published_url") WHERE "published_url" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_publication_ticket"    ON "publications" ("ticket_airtable_id");
CREATE INDEX IF NOT EXISTS "idx_publication_published" ON "publications" ("published_at" DESC);
-- The cohort read: same account, same post type, ordered by age.
CREATE INDEX IF NOT EXISTS "idx_publication_cohort"
  ON "publications" ("account_ref", "post_type", "published_at" DESC);

ALTER TABLE "social_metrics"
  ADD COLUMN IF NOT EXISTS "publication_id" uuid REFERENCES "publications"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_social_metrics_publication"
  ON "social_metrics" ("publication_id", "captured_at" DESC);

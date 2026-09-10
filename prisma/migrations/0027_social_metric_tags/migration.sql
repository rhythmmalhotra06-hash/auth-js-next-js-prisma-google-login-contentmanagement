-- Hootsuite campaign/speaker tags, lifted out of the payload we were already storing.
--
-- Perch has always returned these at raw.details.tags as [{id, label, group_name}]; the pull
-- kept the payload but never extracted them. They are the mechanism the social team groups
-- campaigns by ("on Hootsuite we tag a post depending on the campaign… MCH August 2026"), so
-- surfacing them needs no new integration or credential.
--
-- The UPDATE backfills every row already in the table, so campaign grouping works on history
-- from the moment this lands rather than only on future pulls.
ALTER TABLE "social_metrics" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "social_metrics" SET "tags" = COALESCE((
  SELECT array_agg(DISTINCT btrim(t->>'label'))
  FROM jsonb_array_elements(("raw"::jsonb)->'details'->'tags') t
  WHERE t->>'label' IS NOT NULL AND btrim(t->>'label') <> ''
), '{}')
WHERE "raw" IS NOT NULL
  AND jsonb_typeof(("raw"::jsonb)->'details'->'tags') = 'array'
  AND jsonb_array_length(("raw"::jsonb)->'details'->'tags') > 0;

-- Prisma models String[] without a default; drop it so the schema and the database agree.
ALTER TABLE "social_metrics" ALTER COLUMN "tags" DROP DEFAULT;

CREATE INDEX IF NOT EXISTS "idx_social_metrics_tags" ON "social_metrics" USING GIN ("tags");

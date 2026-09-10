-- Rollback for 0024_mow. Drop order respects FKs (children first).
-- Nothing outside this migration is touched, so this is a clean reverse.
DROP TABLE IF EXISTS "_BriefToLearning";
DROP TABLE IF EXISTS "experiments";
DROP TABLE IF EXISTS "briefs";
DROP TABLE IF EXISTS "learnings";
DROP TABLE IF EXISTS "creative_records";
DROP TABLE IF EXISTS "performance_attributions";
DROP TABLE IF EXISTS "asset_performance_snapshots";
DROP TABLE IF EXISTS "destination_links";
DROP TABLE IF EXISTS "mow_slots";
DROP TABLE IF EXISTS "mow_weeks";
DROP TABLE IF EXISTS "offers";
DROP TABLE IF EXISTS "messages_of_week";
DROP TABLE IF EXISTS "comms_days";

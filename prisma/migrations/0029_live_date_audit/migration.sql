-- Who set a Live Date from the portal, and when.
--
-- `Live Date` is the field with no owner: 204 of 442 Vishen-lane assets lack it and 66 of those
-- are already published, so no calendar can place finished work. The not-dated tray now lets a
-- human set it without leaving the portal (decision AB4), and a write that reaches a
-- team-maintained Airtable table should say where it came from.
--
-- Deliberately narrow: the portal writes THIS FIELD ONLY. Status stays the team's own workflow —
-- the standing rule is that the app never overwrites a status it does not own.
ALTER TABLE "vishen_videos" ADD COLUMN IF NOT EXISTS "live_date_set_by" TEXT;
ALTER TABLE "vishen_videos" ADD COLUMN IF NOT EXISTS "live_date_set_at" TIMESTAMPTZ;

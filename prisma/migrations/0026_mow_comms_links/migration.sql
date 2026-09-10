-- The MOW message's comms-calendar link, as Airtable recIds.
--
-- This is what makes the week derivable before `Week starting` exists (plan V2): these ids
-- resolve against comms_days.airtable_id to give real dates. Stored as ids because the app's
-- REST layer returns link fields as recIds, not as the display names ("September 8, 2026")
-- that the MCP surfaces.
ALTER TABLE "messages_of_week" ADD COLUMN IF NOT EXISTS "comms_calendar_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "messages_of_week" ALTER COLUMN "comms_calendar_ids" DROP DEFAULT;

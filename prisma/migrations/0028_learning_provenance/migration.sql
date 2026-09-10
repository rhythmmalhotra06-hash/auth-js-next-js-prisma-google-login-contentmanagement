-- Learning provenance: who wrote the line, and which lever it points at.
--
-- `proposed` marks a learning the SYSTEM drafted rather than a person (decision AA2). It is
-- carried to the UI so an AI suggestion never quietly reads as a colleague's judgement. Glen's
-- condition was about a plausible-sounding wrong recommendation — "if efficiency is a
-- recommendation and that's not true, it might derail everything" — and the answer to that is
-- visible attribution plus a human commit gate, not hiding where the sentence came from.
--
-- `lever_owner` is FREE TEXT on purpose (decision S16): for 14 Sep the lever→owner mapping is
-- typed by hand. The existing `lever_owner_employee_id` FK stays for when E10 makes it real, and
-- the two are not in conflict — the FK wins when both are set.
ALTER TABLE "learnings" ADD COLUMN IF NOT EXISTS "proposed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "learnings" ADD COLUMN IF NOT EXISTS "lever_owner" TEXT;

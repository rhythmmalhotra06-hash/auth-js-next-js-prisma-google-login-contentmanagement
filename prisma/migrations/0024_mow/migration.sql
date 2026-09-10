-- E-MOW — Message of the Week in Content Studio. Go-live Mon 14 Sep 2026, 08:00 MYT.
--
-- Plan:  plans/ref-to-sep-call-zazzy-moth.md   (decisions S1-S21 override the brief)
-- Brief: Sep Calls/Handoff/MOW-HANDOFF.md      (D1-D9)
--
-- ALL ADDITIVE. No existing table is modified and no data moves. In particular the
-- `CommsCalendar` -> `OfficialCalCC` Prisma rename is CODE-ONLY: the model keeps
-- @@map("comms_calendars"), so there is deliberately no ALTER/RENAME here. The old name
-- claimed to be the comms calendar while actually mirroring "Official Cal", which is why
-- the real day-level calendar (comms_days, below) had never been synced at all.
--
-- Numbered 0024, not 0023: the brief says 0023_mow but 0023_asset_type_dna_upstream exists.

-- ---------------------------------------------------------------------------
-- The day-level comms calendar (Airtable tblUUVMKdSrLVhTx8). One row per DATE.
-- Two-way, but only over the writable subset: Airtable rejects writes to
-- formula/rollup/lookup/createdTime/lastModifiedTime, so the ro_* columns are
-- mirror-for-display and must never enter the push map.
-- ---------------------------------------------------------------------------
CREATE TABLE "comms_days" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"           TEXT,
    "date"                  DATE,
    "message_of_week"       TEXT,
    "the_goal"              TEXT,
    "phase"                 TEXT,
    "core_message"          BOOLEAN NOT NULL DEFAULT false,
    "internal_note"         TEXT,
    "score"                 TEXT,
    "campaign_type"         TEXT,
    "no_of_emails"          INTEGER,
    "landing_page_sessions" INTEGER,
    "sublist"               INTEGER,
    "attendees"             INTEGER,
    "sp_sessions"           INTEGER,
    "sales"                 INTEGER,
    "total_daily_revenue"   DECIMAL(14,2),
    "official_cal_ids"      TEXT[] NOT NULL,
    "initiative_ids"        TEXT[] NOT NULL,
    "email_ids"             TEXT[] NOT NULL,
    "social_asset_ids"      TEXT[] NOT NULL,
    "banner_ids"            TEXT[] NOT NULL,
    "notification_ids"      TEXT[] NOT NULL,
    "blog_ids"              TEXT[] NOT NULL,
    "ro_lead_gen_goal"      DECIMAL(14,2),
    "ro_target_revenue"     DECIMAL(14,2),
    "ro_project_name"       TEXT,
    "ro_status"             TEXT,
    "ro_weekday"            TEXT,
    "ro_name_of_comms"      TEXT,
    "airtable_pushed_at"    TIMESTAMPTZ,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "synced_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "comms_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "comms_days_airtable_id_key" ON "comms_days"("airtable_id");
CREATE INDEX "idx_comms_days_date"   ON "comms_days"("date");
CREATE INDEX "idx_comms_days_pushed" ON "comms_days"("airtable_pushed_at");

-- ---------------------------------------------------------------------------
-- The master MOW table (Airtable tblrxLMH2ncoLaHO5). brand/week_starting/active
-- do not exist upstream yet -- the Ramya workshop (Thu 10 Sep 12:30 KL) adds them.
-- Nullable/defaulted here so the sync is safe before that.
-- ---------------------------------------------------------------------------
CREATE TABLE "messages_of_week" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id"        TEXT,
    "mow"                TEXT,
    "key_message"        TEXT,
    "goal"               TEXT,
    "brands"             TEXT[] NOT NULL,
    "week_starting"      DATE,
    "active"             BOOLEAN NOT NULL DEFAULT true,
    "company_goals"      TEXT,
    "assignee_name"      TEXT,
    "airtable_pushed_at" TIMESTAMPTZ,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "synced_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "messages_of_week_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "messages_of_week_airtable_id_key" ON "messages_of_week"("airtable_id");
CREATE INDEX "idx_mow_week_starting" ON "messages_of_week"("week_starting");
CREATE INDEX "idx_mow_pushed"        ON "messages_of_week"("airtable_pushed_at");

-- ---------------------------------------------------------------------------
-- Destinations / offers. Inferred from parsed UTMs, not entered by hand.
-- ---------------------------------------------------------------------------
CREATE TABLE "offers" (
    "id"                       UUID NOT NULL DEFAULT gen_random_uuid(),
    "path"                     TEXT NOT NULL,
    "canonical_url"            TEXT,
    "name"                     TEXT,
    "utm_campaign_pattern"     TEXT,
    "smart_number_definition"  TEXT,
    "metabase_query_ref"       TEXT,
    "airtable_test_record_id"  TEXT,
    "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_offers_path" ON "offers"("path");

-- ---------------------------------------------------------------------------
-- One weekly record PER BRAND (decision S3 -- overrides the brief's "default one").
-- ---------------------------------------------------------------------------
CREATE TABLE "mow_weeks" (
    "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_start"             DATE NOT NULL,
    "brand"                  TEXT NOT NULL,
    "status"                 TEXT NOT NULL DEFAULT 'draft',
    "message_of_week_id"     UUID,
    "message"                TEXT,
    "goal"                   TEXT,
    "smart_number_staged"    JSONB,
    "smart_number_committed" JSONB,
    "smart_number_key"       TEXT,
    "drivers"                JSONB,
    "primary_offer_id"       UUID,
    "week_summary_staged"    TEXT,
    "week_summary_committed" TEXT,
    "committed_by"           TEXT,
    "committed_at"           TIMESTAMPTZ,
    "generated_at"           TIMESTAMPTZ,
    "airtable_pushed_at"     TIMESTAMPTZ,
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "mow_weeks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_mow_weeks_week_brand" ON "mow_weeks"("week_start", "brand");
CREATE INDEX "idx_mow_weeks_start" ON "mow_weeks"("week_start");

ALTER TABLE "mow_weeks" ADD CONSTRAINT "mow_weeks_message_of_week_id_fkey"
    FOREIGN KEY ("message_of_week_id") REFERENCES "messages_of_week"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mow_weeks" ADD CONSTRAINT "mow_weeks_primary_offer_id_fkey"
    FOREIGN KEY ("primary_offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- One row per (day x channel). Email and social on the same day are SEPARATE rows
-- and intentionally different messages -- not a misalignment to be "fixed".
-- Platform comms attach to the week: channel='platform', day NULL... except day is
-- NOT NULL upstream in the brief, so those rows carry the week's Monday instead.
-- ---------------------------------------------------------------------------
CREATE TABLE "mow_slots" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_id"              UUID NOT NULL,
    "day"                  DATE NOT NULL,
    "channel"              TEXT NOT NULL,
    "brand"                TEXT,
    "expected_asset_type"  TEXT,
    "owner_employee_id"    UUID,
    "owner_name_fallback"  TEXT,
    "planned_from_source"  TEXT,
    "status"               TEXT NOT NULL DEFAULT 'planned',
    "blocker_note"         TEXT,
    "comms_day_id"         UUID,
    "offer_id"             UUID,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "mow_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_mow_slots_week_day"     ON "mow_slots"("week_id", "day");
CREATE INDEX "idx_mow_slots_day_channel"  ON "mow_slots"("day", "channel");

ALTER TABLE "mow_slots" ADD CONSTRAINT "mow_slots_week_id_fkey"
    FOREIGN KEY ("week_id") REFERENCES "mow_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mow_slots" ADD CONSTRAINT "mow_slots_owner_employee_id_fkey"
    FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mow_slots" ADD CONSTRAINT "mow_slots_comms_day_id_fkey"
    FOREIGN KEY ("comms_day_id") REFERENCES "comms_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mow_slots" ADD CONSTRAINT "mow_slots_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Destination inference output + the human-link queue for what it couldn't match.
-- Resolves to WHICH OFFER, not which post: per-post needs utm_content unique per
-- post (an Airtable formula on the Social row -- decision S7).
-- ---------------------------------------------------------------------------
CREATE TABLE "destination_links" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type"      TEXT NOT NULL,
    "source_id"        TEXT NOT NULL,
    "raw_url"          TEXT NOT NULL,
    "parsed_utm"       JSONB,
    "offer_id"         UUID,
    "match_confidence" DECIMAL(4,3),
    "human_linked_by"  TEXT,
    "human_linked_at"  TIMESTAMPTZ,
    "via_manychat"     BOOLEAN NOT NULL DEFAULT false,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "destination_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_destination_links_source_url" ON "destination_links"("source_type", "source_id", "raw_url");
CREATE INDEX "idx_destination_links_offer" ON "destination_links"("offer_id");

ALTER TABLE "destination_links" ADD CONSTRAINT "destination_links_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- SNAPSHOTS, not a mutable current value: revenue backfills upward as late
-- attribution lands, so a figure is never final and the page shows "as of".
-- ---------------------------------------------------------------------------
CREATE TABLE "asset_performance_snapshots" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id"    UUID,
    "slot_id"      UUID,
    "offer_id"     UUID,
    "channel"      TEXT,
    "published_at" TIMESTAMPTZ,
    "snapshot_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "horizon"      TEXT NOT NULL,
    "metrics"      JSONB NOT NULL,
    "source"       TEXT NOT NULL,

    CONSTRAINT "asset_performance_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_aps_ticket"       ON "asset_performance_snapshots"("ticket_id", "snapshot_at");
CREATE INDEX "idx_aps_slot_horizon" ON "asset_performance_snapshots"("slot_id", "horizon");

ALTER TABLE "asset_performance_snapshots" ADD CONSTRAINT "asset_performance_snapshots_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_performance_snapshots" ADD CONSTRAINT "asset_performance_snapshots_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "mow_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_performance_snapshots" ADD CONSTRAINT "asset_performance_snapshots_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- lever -> owner. MANUAL for 14 Sep (decision S16); structured now so the eventual
-- E10 sub-task model backfills into a real column instead of migrating free text.
-- ---------------------------------------------------------------------------
CREATE TABLE "performance_attributions" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id"         UUID NOT NULL,
    "lever"               TEXT NOT NULL,
    "owner_employee_id"   UUID,
    "owner_name_fallback" TEXT,
    "note"                TEXT,
    "entered_by"          TEXT,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "performance_attributions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_perf_attr_snapshot" ON "performance_attributions"("snapshot_id");

ALTER TABLE "performance_attributions" ADD CONSTRAINT "performance_attributions_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "asset_performance_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_attributions" ADD CONSTRAINT "performance_attributions_owner_employee_id_fkey"
    FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Gareth's tabular data: copy, transcript, hook, offer, CTA per asset, so the
-- system becomes a learning engine and not just a storage engine.
-- ---------------------------------------------------------------------------
CREATE TABLE "creative_records" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id"     UUID,
    "offer_id"      UUID,
    "asset_type"    TEXT,
    "copy"          TEXT,
    "transcript"    TEXT,
    "hook"          TEXT,
    "cta"           TEXT,
    "thumbnail_ref" TEXT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "creative_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_creative_records_ticket" ON "creative_records"("ticket_id");

ALTER TABLE "creative_records" ADD CONSTRAINT "creative_records_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "creative_records" ADD CONSTRAINT "creative_records_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- <= 5 COMMITTED learnings per week, each attributed to whoever controls the lever.
-- Staged/committed pairs throughout: AI drafts, a named human commits, downstream
-- reads only the committed value. This is Glen's condition, not a nicety.
-- ---------------------------------------------------------------------------
CREATE TABLE "learnings" (
    "id"                       UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_id"                  UUID NOT NULL,
    "slot_id"                  UUID,
    "text_staged"              TEXT,
    "text_committed"           TEXT,
    "lever_owner_employee_id"  UUID,
    "rank"                     INTEGER,
    "committed_by"             TEXT,
    "committed_at"             TIMESTAMPTZ,
    "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "learnings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_learnings_week_rank" ON "learnings"("week_id", "rank");

ALTER TABLE "learnings" ADD CONSTRAINT "learnings_week_id_fkey"
    FOREIGN KEY ("week_id") REFERENCES "mow_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "mow_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_lever_owner_employee_id_fkey"
    FOREIGN KEY ("lever_owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- The pack is mostly briefs: one per slot owner. next_upload_focus is Glen's
-- specific ask -- what the editor will improve on the next upload.
-- ---------------------------------------------------------------------------
CREATE TABLE "briefs" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_id"            UUID NOT NULL,
    "slot_id"            UUID,
    "owner_employee_id"  UUID,
    "owner_email"        TEXT,
    "text_staged"        TEXT,
    "text_committed"     TEXT,
    "next_upload_focus"  TEXT,
    "evidence"           JSONB,
    "committed_by"       TEXT,
    "committed_at"       TIMESTAMPTZ,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_briefs_week"  ON "briefs"("week_id");
CREATE INDEX "idx_briefs_owner" ON "briefs"("owner_email");

ALTER TABLE "briefs" ADD CONSTRAINT "briefs_week_id_fkey"
    FOREIGN KEY ("week_id") REFERENCES "mow_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "mow_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_owner_employee_id_fkey"
    FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Learning <-> Brief: which learnings a brief was drafted from (Prisma implicit m-n).
CREATE TABLE "_BriefToLearning" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);
ALTER TABLE "_BriefToLearning" ADD CONSTRAINT "_BriefToLearning_AB_pkey" PRIMARY KEY ("A", "B");
CREATE INDEX "_BriefToLearning_B_index" ON "_BriefToLearning"("B");

ALTER TABLE "_BriefToLearning" ADD CONSTRAINT "_BriefToLearning_A_fkey"
    FOREIGN KEY ("A") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BriefToLearning" ADD CONSTRAINT "_BriefToLearning_B_fkey"
    FOREIGN KEY ("B") REFERENCES "learnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CONTENT experiments only (hooks, thumbnails, formats, messaging). Funnel and
-- page tests stay Rafi's -- link out to his scoreboard, don't rebuild them.
-- reads_at enforces his rule that nothing is read before 7 days.
-- ---------------------------------------------------------------------------
CREATE TABLE "experiments" (
    "id"                      UUID NOT NULL DEFAULT gen_random_uuid(),
    "week_id"                 UUID,
    "hypothesis"              TEXT NOT NULL,
    "evidence"                JSONB,
    "scope"                   TEXT NOT NULL DEFAULT 'content',
    "owner_employee_id"       UUID,
    "status"                  TEXT NOT NULL DEFAULT 'proposed',
    "opens_at"                DATE,
    "reads_at"                DATE,
    "result"                  TEXT,
    "linked_airtable_test_id" TEXT,
    "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_experiments_status_reads" ON "experiments"("status", "reads_at");

ALTER TABLE "experiments" ADD CONSTRAINT "experiments_week_id_fkey"
    FOREIGN KEY ("week_id") REFERENCES "mow_weeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_owner_employee_id_fkey"
    FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

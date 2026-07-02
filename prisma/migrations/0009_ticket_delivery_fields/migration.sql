-- Ticket delivery-link + detail fields · make Postgres the system of record for
-- tickets without regressing the detail form. These are discrete Prio Requests
-- fields the detail form edits directly (1:1 with Airtable), so the two-way sync
-- maps them field↔field. Additive + nullable; safe on the existing table.

ALTER TABLE "tickets"
  ADD COLUMN "download_link"     TEXT,
  ADD COLUMN "project_program"   TEXT,
  ADD COLUMN "asset_folder_link" TEXT,
  ADD COLUMN "working_files"     TEXT,
  ADD COLUMN "final_16x9"        TEXT,
  ADD COLUMN "folder_16x9"       TEXT,
  ADD COLUMN "final_9x16"        TEXT,
  ADD COLUMN "folder_9x16"       TEXT,
  ADD COLUMN "final_4x5"         TEXT,
  ADD COLUMN "folder_4x5"        TEXT;

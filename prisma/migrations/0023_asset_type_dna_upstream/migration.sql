-- Asset-type DNA (upstream) + intake stakeholder entitlement.
-- All ADDITIVE and nullable/defaulted — safe to apply against a live table.
--
-- Why: the DNA review read only "dna_requirements"/"feedback_standards", which mirror two
-- portal-owned Airtable fields that are empty on ALL 118 asset types (verified 2026-09-08).
-- The team's actual DNA lives in Airtable's synced-source "DNA" field (72 populated) and
-- "Video/Virality DNA". Those are read-only upstream, so they land in their own columns and
-- lib/dna-review/config.ts prefers the portal pair when set, else these.

ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "dna_upstream"        TEXT;
ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "virality_dna"        TEXT;
ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "dna_link"            TEXT;
ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "process_dna_url"     TEXT;
ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "process_dna_summary" TEXT;

-- Who may RAISE this asset type on the intake form. Resolved from Airtable's "Stakeholder"
-- link to work emails at sync time — the linked records live in a second employees roster
-- (tblC0gR8ZVw4WzOwx) whose recIds don't exist in our mirrored employees table, so email is
-- the only usable join key. Empty array = unrestricted (fail open).
ALTER TABLE "asset_types" ADD COLUMN IF NOT EXISTS "stakeholder_emails" TEXT[] NOT NULL DEFAULT '{}';

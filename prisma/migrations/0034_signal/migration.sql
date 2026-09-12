-- 0034 · Signal — how the team agents talk to each other, and the only way they talk
--
-- An agent never calls another agent. It writes a typed observation onto the node it
-- concerns, with its evidence attached; other agents subscribe by kind, and every hop shows
-- up in the thread the humans are already reading. That is what makes an agent auditable
-- instead of a black box.
--
-- The natural key is what stops a daily check emitting the same "shoot not filmed" fifteen
-- times in a fortnight: a re-run updates the open Signal, and a Signal whose condition stops
-- holding closes itself as resolved-by-data.
--
-- `period` is NULL for non-periodic checks, so the unique index treats NULL as a value
-- (NULLS NOT DISTINCT) — otherwise every re-run of a non-periodic check would insert a
-- duplicate, which is the exact failure this key exists to prevent.

CREATE TABLE IF NOT EXISTS "signals" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent"            text NOT NULL,
  "check_id"         text NOT NULL,
  "kind"             text NOT NULL,
  "lane"             text,
  "subject_type"     text NOT NULL,
  "subject_id"       text NOT NULL,
  "publication_id"   uuid REFERENCES "publications"("id") ON DELETE CASCADE,
  "period"           text,
  "title"            text NOT NULL,
  "body"             text NOT NULL,
  "evidence"         jsonb,
  "owner_hint"       text,
  "status"           text NOT NULL DEFAULT 'open',
  "dismissed_reason" text,
  "dismissed_by"     text,
  "suppressed_until" timestamptz,
  "resolved_by"      text,
  "resolved_at"      timestamptz,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "signal_kind_check" CHECK ("kind" IN
    ('learning','anomaly','blocker','chore','watch','gap','suggestion')),
  CONSTRAINT "signal_status_check" CHECK ("status" IN
    ('open','acknowledged','dismissed','resolved'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_signal_natural_key"
  ON "signals" ("agent", "check_id", "subject_type", "subject_id", "period") NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "idx_signal_open"    ON "signals" ("status", "kind", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_signal_subject" ON "signals" ("subject_type", "subject_id");

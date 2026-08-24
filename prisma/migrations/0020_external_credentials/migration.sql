-- App-held OAuth credentials for third-party integrations (first user: Hootsuite Perch).
-- ADDITIVE — new table only.
--
-- Needed because a connector-in-a-session can't pull on a schedule. Hootsuite's Perch
-- resource advertises the `offline` scope, so one human consent yields a refresh token a
-- cron can keep using. Token columns hold AES-256-GCM sealed values, never plaintext
-- (lib/crypto/secret-box.ts). Client id/secret arrive via dynamic client registration.
--
-- See plans/i-got-the-mcp-temporal-summit.md.

CREATE TABLE "external_credentials" (
    "provider"          TEXT NOT NULL,
    "client_id"         TEXT,
    "client_secret_enc" TEXT,
    "access_token_enc"  TEXT,
    "refresh_token_enc" TEXT,
    "expires_at"        TIMESTAMPTZ,
    "scope"             TEXT,
    "last_error"        TEXT,
    "connected_by"      TEXT,
    "connected_at"      TIMESTAMPTZ,
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "external_credentials_pkey" PRIMARY KEY ("provider")
);

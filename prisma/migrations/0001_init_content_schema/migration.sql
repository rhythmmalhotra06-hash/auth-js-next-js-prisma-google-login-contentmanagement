-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "team" TEXT,
    "division" TEXT,
    "is_team_lead" BOOLEAN NOT NULL DEFAULT false,
    "employment_type" TEXT NOT NULL DEFAULT 'employee',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "label" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "brain_program_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "requirements" TEXT,
    "feedback_standards" TEXT,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "event_type_id" UUID,
    "team_lead_id" UUID,
    "preferred_editor_id" UUID,
    "dna_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_type_dimensions" (
    "asset_type_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,

    CONSTRAINT "asset_type_dimensions_pkey" PRIMARY KEY ("asset_type_id","dimension_id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "title" TEXT NOT NULL,
    "creative_brief" TEXT,
    "cta" TEXT,
    "positioning" TEXT,
    "audience" TEXT,
    "due_date" DATE,
    "event_type_id" UUID,
    "asset_type_id" UUID,
    "assignee_id" UUID,
    "prio_status" TEXT,
    "ticket_status" TEXT,
    "urgency" INTEGER,
    "complexity" INTEGER,
    "priority_score" DECIMAL,
    "queue_rank" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'app',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "actor_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID,
    "approver_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "feedback" TEXT,
    "decided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT,
    "shoot_date" DATE,
    "location" TEXT,
    "notes" TEXT,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoot_tickets" (
    "shoot_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,

    CONSTRAINT "shoot_tickets_pkey" PRIMARY KEY ("shoot_id","ticket_id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "ticket_id" UUID,
    "kind" TEXT NOT NULL,
    "file_url" TEXT,
    "distribution_url" TEXT,
    "published_at" TIMESTAMPTZ,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID,
    "metric" TEXT NOT NULL,
    "value" DECIMAL,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "employees_airtable_id_key" ON "employees"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "dimensions_airtable_id_key" ON "dimensions"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_types_airtable_id_key" ON "event_types"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "dna_airtable_id_key" ON "dna"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_airtable_id_key" ON "asset_types"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_airtable_id_key" ON "tickets"("airtable_id");

-- CreateIndex
CREATE INDEX "idx_tickets_queue" ON "tickets"("priority_score" DESC, "queue_rank");

-- CreateIndex
CREATE INDEX "idx_tickets_assignee" ON "tickets"("assignee_id");

-- CreateIndex
CREATE INDEX "idx_tickets_status" ON "tickets"("ticket_status");

-- CreateIndex
CREATE UNIQUE INDEX "shoots_airtable_id_key" ON "shoots"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_airtable_id_key" ON "assets"("airtable_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_team_lead_id_fkey" FOREIGN KEY ("team_lead_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_preferred_editor_id_fkey" FOREIGN KEY ("preferred_editor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_dna_id_fkey" FOREIGN KEY ("dna_id") REFERENCES "dna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_dimensions" ADD CONSTRAINT "asset_type_dimensions_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_dimensions" ADD CONSTRAINT "asset_type_dimensions_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoot_tickets" ADD CONSTRAINT "shoot_tickets_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoot_tickets" ADD CONSTRAINT "shoot_tickets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance" ADD CONSTRAINT "performance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "official_calendar_id" UUID,
ADD COLUMN     "requester_id" UUID,
ADD COLUMN     "source_links" TEXT,
ADD COLUMN     "team_service_level" TEXT,
ADD COLUMN     "type_of_request" TEXT;

-- CreateTable
CREATE TABLE "official_calendar" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "airtable_id" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_authors" (
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,

    CONSTRAINT "ticket_authors_pkey" PRIMARY KEY ("ticket_id","author_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "official_calendar_airtable_id_key" ON "official_calendar"("airtable_id");

-- CreateIndex
CREATE UNIQUE INDEX "authors_airtable_id_key" ON "authors"("airtable_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_official_calendar_id_fkey" FOREIGN KEY ("official_calendar_id") REFERENCES "official_calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_authors" ADD CONSTRAINT "ticket_authors_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_authors" ADD CONSTRAINT "ticket_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;


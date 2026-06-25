-- DropForeignKey
ALTER TABLE "asset_types" DROP CONSTRAINT "asset_types_event_type_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_types" DROP CONSTRAINT "asset_types_team_lead_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_types" DROP CONSTRAINT "asset_types_preferred_editor_id_fkey";

-- AlterTable
ALTER TABLE "asset_types" DROP COLUMN "event_type_id",
DROP COLUMN "preferred_editor_id",
DROP COLUMN "team_lead_id";

-- CreateTable
CREATE TABLE "asset_type_event_types" (
    "asset_type_id" UUID NOT NULL,
    "event_type_id" UUID NOT NULL,

    CONSTRAINT "asset_type_event_types_pkey" PRIMARY KEY ("asset_type_id","event_type_id")
);

-- CreateTable
CREATE TABLE "asset_type_team_leads" (
    "asset_type_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,

    CONSTRAINT "asset_type_team_leads_pkey" PRIMARY KEY ("asset_type_id","employee_id")
);

-- CreateTable
CREATE TABLE "asset_type_preferred_editors" (
    "asset_type_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,

    CONSTRAINT "asset_type_preferred_editors_pkey" PRIMARY KEY ("asset_type_id","employee_id")
);

-- AddForeignKey
ALTER TABLE "asset_type_event_types" ADD CONSTRAINT "asset_type_event_types_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_event_types" ADD CONSTRAINT "asset_type_event_types_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_team_leads" ADD CONSTRAINT "asset_type_team_leads_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_team_leads" ADD CONSTRAINT "asset_type_team_leads_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_preferred_editors" ADD CONSTRAINT "asset_type_preferred_editors_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_type_preferred_editors" ADD CONSTRAINT "asset_type_preferred_editors_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


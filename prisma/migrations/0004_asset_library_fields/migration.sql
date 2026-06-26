-- AlterTable: assets gain a name + provenance so standalone library imports
-- (Ad Creatives, Final Ad Asset, Best Videos) can be stored without a ticket.
ALTER TABLE "assets" ADD COLUMN     "name" TEXT,
ADD COLUMN     "source_table" TEXT;

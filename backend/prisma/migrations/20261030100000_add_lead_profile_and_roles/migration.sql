-- Adds phone and LinkedIn to leads and a role history table.
-- Generated with `prisma migrate diff`, then edited to give every existing lead
-- one current role copied from its job title and company, so each lead has exactly one current role.

-- AlterTable
ALTER TABLE "lead" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "lead" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "leadRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leadId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "jobTitle" TEXT,
    "companyName" TEXT,
    "yearsInRole" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "leadRole_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "leadRole_leadId_position_key" ON "leadRole"("leadId", "position");

-- Backfill: one current role per existing lead
INSERT INTO "leadRole" ("leadId", "position", "jobTitle", "companyName", "yearsInRole", "isCurrent")
SELECT "id", 0, "jobTitle", "companyName", NULL, true FROM "lead";

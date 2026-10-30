-- Adds phone enrichment state to leads.
-- Generated with `prisma migrate diff`, then edited to mark phones that already exist as imported,
-- so the enrichment UI can tell imported numbers from provider results.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "countryCode" TEXT,
    "companyName" TEXT,
    "message" TEXT,
    "emailVerificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "phoneSource" TEXT,
    "phoneEnrichmentStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "phoneEnrichmentProgress" JSONB,
    "phoneEnrichmentAttempts" JSONB,
    "phoneEnrichedAt" DATETIME
);
INSERT INTO "new_lead" ("companyName", "countryCode", "createdAt", "email", "emailVerificationStatus", "firstName", "id", "jobTitle", "lastName", "linkedinUrl", "message", "phone", "updatedAt", "phoneSource")
SELECT "companyName", "countryCode", "createdAt", "email", "emailVerificationStatus", "firstName", "id", "jobTitle", "lastName", "linkedinUrl", "message", "phone", "updatedAt",
    CASE WHEN "phone" IS NOT NULL THEN 'IMPORT' END
FROM "lead";
DROP TABLE "lead";
ALTER TABLE "new_lead" RENAME TO "lead";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

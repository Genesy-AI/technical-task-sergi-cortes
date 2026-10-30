-- Replaces the nullable emailVerified boolean with an explicit verification status.
-- Generated with `prisma migrate diff`, then edited to carry existing results over:
--   emailVerified = 1    -> VERIFIED
--   emailVerified = 0    -> INVALID
--   emailVerified = NULL -> UNVERIFIED

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
    "emailVerificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED'
);
INSERT INTO "new_lead" ("companyName", "countryCode", "createdAt", "email", "firstName", "id", "jobTitle", "lastName", "message", "updatedAt", "emailVerificationStatus")
SELECT "companyName", "countryCode", "createdAt", "email", "firstName", "id", "jobTitle", "lastName", "message", "updatedAt",
    CASE "emailVerified" WHEN 1 THEN 'VERIFIED' WHEN 0 THEN 'INVALID' ELSE 'UNVERIFIED' END
FROM "lead";
DROP TABLE "lead";
ALTER TABLE "new_lead" RENAME TO "lead";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

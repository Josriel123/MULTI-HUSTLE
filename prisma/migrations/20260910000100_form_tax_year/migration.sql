-- Give the three form tables a tax year, and key them per user per year.
--
-- Prisma's generated version of this migration adds `taxYear INTEGER NOT NULL`
-- in one statement, which fails on any table that already holds rows. Existing
-- rows are backfilled from the year they were created in: each of these tables
-- previously allowed only one row per user, so the row that exists is the one
-- the user entered for the year they entered it. That also means no two rows
-- can collide on (userId, taxYear) once the new constraint is added.

-- Form1098T ------------------------------------------------------------------
ALTER TABLE "Form1098T" ADD COLUMN "taxYear" INTEGER;
UPDATE "Form1098T" SET "taxYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER WHERE "taxYear" IS NULL;
ALTER TABLE "Form1098T" ALTER COLUMN "taxYear" SET NOT NULL;
DROP INDEX "Form1098T_userId_key";
CREATE UNIQUE INDEX "Form1098T_userId_taxYear_key" ON "Form1098T"("userId", "taxYear");

-- Form1098E ------------------------------------------------------------------
ALTER TABLE "Form1098E" ADD COLUMN "taxYear" INTEGER;
UPDATE "Form1098E" SET "taxYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER WHERE "taxYear" IS NULL;
ALTER TABLE "Form1098E" ALTER COLUMN "taxYear" SET NOT NULL;
DROP INDEX "Form1098E_userId_key";
CREATE UNIQUE INDEX "Form1098E_userId_taxYear_key" ON "Form1098E"("userId", "taxYear");

-- HomeOfficeDeduction --------------------------------------------------------
ALTER TABLE "HomeOfficeDeduction" ADD COLUMN "taxYear" INTEGER;
UPDATE "HomeOfficeDeduction" SET "taxYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER WHERE "taxYear" IS NULL;
ALTER TABLE "HomeOfficeDeduction" ALTER COLUMN "taxYear" SET NOT NULL;
DROP INDEX "HomeOfficeDeduction_userId_key";
CREATE UNIQUE INDEX "HomeOfficeDeduction_userId_taxYear_key" ON "HomeOfficeDeduction"("userId", "taxYear");

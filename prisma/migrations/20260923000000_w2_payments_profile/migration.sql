-- Additive only: two columns with defaults, two new tables. No existing value
-- changes. Generated with `prisma migrate diff` from the live schema to the new
-- datamodel, then reviewed; src/lib/tax/__tests__/migrations.test.ts runs it on
-- PGlite over seeded rows.
--
-- Why each piece exists (the engine already accepted all four inputs; nothing
-- stored them, so the estimate silently assumed zero):
--   User.spouseItemizes           MFS only: no standard deduction, IRC §63(c)(6)(A).
--   User.taxProfileSavedAt        Null until the profile is saved, so the default
--                                 filing status is reported as an assumption.
--   Form1098T.restrictedToNonQualifiedExpenses
--                                 Box 5 earmarked for room and board: always taxable.
--   W2Form                        Wages, withholding and the Schedule SE line 8a base.
--   EstimatedTaxPayment           Form 1040 line 26.

-- AlterTable
ALTER TABLE "Form1098T" ADD COLUMN     "restrictedToNonQualifiedExpenses" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "spouseItemizes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxProfileSavedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "W2Form" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "employer" TEXT NOT NULL,
    "wages" DECIMAL(12,2) NOT NULL,
    "federalWithheld" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "socialSecurityWages" DECIMAL(12,2) NOT NULL,
    "socialSecurityTips" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicareWages" DECIMAL(12,2) NOT NULL,
    "medicareWithheld" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ownedByTaxpayer" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "W2Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimatedTaxPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimatedTaxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "W2Form_userId_taxYear_idx" ON "W2Form"("userId", "taxYear");

-- CreateIndex
CREATE INDEX "EstimatedTaxPayment_userId_taxYear_idx" ON "EstimatedTaxPayment"("userId", "taxYear");

-- AddForeignKey
ALTER TABLE "W2Form" ADD CONSTRAINT "W2Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimatedTaxPayment" ADD CONSTRAINT "EstimatedTaxPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

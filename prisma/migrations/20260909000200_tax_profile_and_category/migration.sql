-- AlterTable
ALTER TABLE "User" ADD COLUMN     "claimedAsDependent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "filingStatus" TEXT NOT NULL DEFAULT 'single';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "category" TEXT;


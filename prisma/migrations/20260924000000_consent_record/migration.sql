-- The consent record: which Terms of Service and Privacy Policy each user
-- agreed to, when, and when they confirmed they are 18 or older.
--
-- Adds, all nullable, nothing back-filled:
--   User.agreementVersion      the version they agreed to (src/lib/legal.ts)
--   User.agreementAcceptedAt   when they ticked the box (the clickwrap record)
--   User.adultConfirmedAt      when they confirmed they are 18 or older
-- Existing users therefore see the agreement step once, and their answer is
-- recorded then. A consent record must never be invented after the fact.
--
-- Additive only, so it is safe to apply BEFORE the code that uses it is
-- deployed: the running code's Prisma client does not know these columns and
-- ignores them. (User.plan, which nothing reads any more, is dropped by a
-- later migration once this release is live; dropping it now would break the
-- running code, which still selects it. See prisma/migrations/README.md.)
--
-- src/lib/tax/__tests__/migrations.test.ts runs it on PGlite over seeded rows.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adultConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "agreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "agreementVersion" TEXT;

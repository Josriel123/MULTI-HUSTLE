-- Several banks per user, and what it takes to tell money moved between the
-- user's own accounts from income.
--
-- Adds, all nullable, nothing back-filled here:
--   PlaidConnection.institutionId    Plaid's id for the bank, from /item/get;
--                                    the same bank may not be connected twice
--                                    (a second Item would replay its history)
--   PlaidConnection.institutionName  the bank's name, to list connections
--   Transaction.plaidAccountId       which of the user's accounts a bank row is in
--   Transaction.plaidCategory        Plaid's primary category (TRANSFER_IN, ...)
-- Existing connections learn their bank on their next sync; existing rows keep
-- nulls, since Plaid does not resend old transactions.
--
-- Additive only (D47): the running release does not know these columns and is
-- unaffected, so apply it before deploying the code that uses them.
-- src/lib/tax/__tests__/migrations.test.ts runs it on PGlite over seeded rows.

-- AlterTable
ALTER TABLE "PlaidConnection" ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "institutionName" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "plaidAccountId" TEXT,
ADD COLUMN     "plaidCategory" TEXT;

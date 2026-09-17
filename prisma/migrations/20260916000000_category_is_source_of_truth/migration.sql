-- Category is the single source of truth for an expense's tax treatment
-- (e2e audit 2026-09-16, finding F2).
--
-- Before this migration the ledger had two controls that could disagree: a
-- "tax-deductible" checkbox (Transaction.taxDeductible) and a tax category
-- (Transaction.category). The engine read only the category when one was
-- present, so clearing the checkbox on an office_expense row changed nothing.
-- From here on:
--   * the engine never reads taxDeductible;
--   * the API derives taxDeductible from the category on every write;
--   * a user marks an expense non-deductible by categorising it `personal`.
--
-- This script reconciles existing rows so that nothing a user expressed with
-- the checkbox is silently lost:
--
--   1. A MANUAL expense the user un-ticked but left in a deductible category
--      was a statement of intent ("do not deduct this"): the manual form's
--      checkbox defaulted to ticked, so false there was a choice. Honour it:
--      move the row to `personal`.
--      Plaid-synced rows are left alone here. The sync creates them with
--      taxDeductible = false and no category, so false on a Plaid row is the
--      default, not an un-tick; a category the user later chose stands.
--   2. A MANUAL expense the user ticked but never categorised was deducted
--      before (the adapter treated flag+null as other_business_expense).
--      Keep that treatment by giving it that category explicitly.
--      Plaid rows with taxDeductible = true and no category are left alone
--      too: that flag was set by the Phase 0 sync heuristic ("Food and
--      Drink" / "Shops" => deductible), not by the user. Step 3 then clears
--      it, the row is treated as personal, and the uncategorised_expenses
--      warning asks the user to categorise it. Understating tax silently is
--      the failure mode this app exists to prevent.
--   3. Recompute the flag from the category for every row, so the CSV export
--      and any legacy reader see the derived value.
--
-- Deliberately NOT reconciled: an expense whose category is a string outside
-- the vocabulary (the old POST stored any string). It keeps its string and
-- gets the flag cleared by step 3; the adapter raises category_mismatch and
-- the ledger asks for a real category. The main database had no such rows
-- when this was written, and the API now rejects them.
--
-- The deductible list below must match DEDUCTIBLE_EXPENSE_CATEGORIES in
-- src/lib/tax/categories.ts (treatments schedule_c_expense and
-- schedule_c_de_minimis_equipment). A test asserts that it does.
-- Re-running this script is a no-op.

UPDATE "Transaction"
SET "category" = 'personal'
WHERE "type" = 'Expense'
  AND "taxDeductible" = false
  AND "plaidTransactionId" IS NULL
  AND "category" IN (
    'advertising',
    'car_and_truck',
    'commissions_and_fees',
    'contract_labor',
    'insurance',
    'interest',
    'legal_and_professional',
    'office_expense',
    'rent_or_lease',
    'repairs_and_maintenance',
    'supplies',
    'taxes_and_licenses',
    'travel',
    'meals',
    'utilities',
    'software_and_subscriptions',
    'other_business_expense',
    'equipment'
  );

UPDATE "Transaction"
SET "category" = 'other_business_expense'
WHERE "type" = 'Expense'
  AND "taxDeductible" = true
  AND "plaidTransactionId" IS NULL
  AND "category" IS NULL;

UPDATE "Transaction"
SET "taxDeductible" = (
  "type" = 'Expense'
  -- COALESCE: `NULL IN (...)` is NULL, and NULL AND true is NULL, which the
  -- NOT NULL column rejects. An uncategorised expense is simply not deductible.
  AND COALESCE("category" IN (
    'advertising',
    'car_and_truck',
    'commissions_and_fees',
    'contract_labor',
    'insurance',
    'interest',
    'legal_and_professional',
    'office_expense',
    'rent_or_lease',
    'repairs_and_maintenance',
    'supplies',
    'taxes_and_licenses',
    'travel',
    'meals',
    'utilities',
    'software_and_subscriptions',
    'other_business_expense',
    'equipment'
  ), false)
)
WHERE "taxDeductible" IS DISTINCT FROM (
  "type" = 'Expense'
  AND COALESCE("category" IN (
    'advertising',
    'car_and_truck',
    'commissions_and_fees',
    'contract_labor',
    'insurance',
    'interest',
    'legal_and_professional',
    'office_expense',
    'rent_or_lease',
    'repairs_and_maintenance',
    'supplies',
    'taxes_and_licenses',
    'travel',
    'meals',
    'utilities',
    'software_and_subscriptions',
    'other_business_expense',
    'equipment'
  ), false)
);

# Migrations

The Phase 2 migrations were generated with `prisma migrate diff` from the
schema before and after, so the SQL is reviewable rather than implied by
`db push`. Later ones are hand-written and tested.

| Migration | What it does |
|---|---|
| `20260909000000_init` | Baseline: the Phase 1 schema exactly as it existed with `Float` money columns. |
| `20260909000100_money_decimal` | `ALTER COLUMN ... SET DATA TYPE DECIMAL(12,2)` on the eight `Float` columns across `Transaction`, `Form1098T`, `Form1098E`, `HomeOfficeDeduction`. Nothing else. |
| `20260909000200_tax_profile_and_category` | Additive: `User.filingStatus TEXT NOT NULL DEFAULT 'single'`, `User.claimedAsDependent BOOLEAN NOT NULL DEFAULT false`, `Transaction.category TEXT NULL`. |
| `20260910000000_mileage_log` | Phase 3: the `MileageLog` table. |
| `20260910000100_form_tax_year` | Phase 3.5: `taxYear` on `Form1098T`, `Form1098E`, `HomeOfficeDeduction` under `@@unique([userId, taxYear])`. |
| `20260916000000_category_is_source_of_truth` | Data only, no schema change (e2e audit F2). Expense rows with `taxDeductible = false` in a Schedule C category move to `personal`; rows with `taxDeductible = true` and no category get `other_business_expense` (the treatment they already received); then `taxDeductible` is recomputed from the category for every row. Idempotent and null-safe (`COALESCE(category IN (...), false)`). The deductible list must match `DEDUCTIBLE_EXPENSE_CATEGORIES` in `src/lib/tax/categories.ts`; `src/lib/tax/__tests__/migrations.test.ts` runs every migration on PGlite, seeds eleven rows covering each case, and asserts the outcome, the row count, the amount sum, idempotency and the list match. |
| `20260923000000_w2_payments_profile` | Additive only. `User.spouseItemizes BOOLEAN NOT NULL DEFAULT false`, `User.taxProfileSavedAt TIMESTAMP NULL` (null until the tax profile is saved, so the default filing status is reported as assumed), `Form1098T.restrictedToNonQualifiedExpenses DECIMAL(12,2) NOT NULL DEFAULT 0`, and two tables: `W2Form` (boxes 1, 2, 3, 5, 6, 7 and whose W-2 it is, by tax year) and `EstimatedTaxPayment` (by the tax year paid for). Both reference `User` with `ON DELETE RESTRICT` like every other table, indexed on `(userId, taxYear)`. Identical to what `prisma migrate diff` generates from the live schema; `migrations.test.ts` runs it on PGlite over seeded rows. |
| `20260924000000_consent_record` | Additive only: three nullable columns on `User`, `agreementVersion`, `agreementAcceptedAt` and `adultConfirmedAt` (the clickwrap record and the age check, D40). Nothing is back-filled: existing users are asked once. It deliberately leaves `User.plan` in place (D47): the release serving while it is applied still selects that column. `migrations.test.ts` checks that every existing column survives and that a user can still be created without naming `plan`. |

## Status

The Phase 2 migrations were applied to the main Neon database on 2026-09-09
(baseline resolved, then `migrate deploy`). Before and after: 26 transactions
summing to 50,752.38, one Form 1098-T, one home office row, two users, all
unchanged; the eight money columns are `numeric(12,2)` and the three new
columns carry their defaults. From here on, schema changes go through
`prisma migrate` so `_prisma_migrations` stays in step; `db push` would leave
it behind.

**`20260916000000_category_is_source_of_truth` was applied to main on
2026-09-17**, by the owner: the agent's `prisma migrate deploy` had been refused
by the auto-mode permission classifier as a production change. It is data-only,
so no `prisma generate` was needed. Checked afterwards, read-only: no row's
`taxDeductible` flag disagrees with its category.

Measured on main immediately before, read-only: 31 transactions across all
users, summing to 101,135.83. The script touched exactly four rows, all manual
entries:

| Row | Before | After |
|---|---|---|
| $123.45 office expense, 2025-06-15, "E2E AUDIT edited prior-year expense" | `office_expense`, flag false | `personal`, flag false |
| $2,200.00 "Hardware written off", 2023-05-05 | no category, flag true | `other_business_expense`, flag true |
| $500.00 "gas", 2026-04-18 | no category, flag true | `other_business_expense`, flag true |
| $200.00 "Gas", 2026-04-18 | no category, flag true | `other_business_expense`, flag true |

No Plaid-synced row changed, and no row carried an unknown category string.
Before it ran, the engine (which no longer reads the flag) deducted the $123.45
office expense for 2025 and treated the three uncategorised rows as personal
with an `uncategorised_expenses` warning; since, the audit row is personal and
the three rows are deducted as before. The two "gas" rows are worth
re-categorising as `car_and_truck` by hand so the one-method vehicle rule sees
them.

**`20260923000000_w2_payments_profile` was applied to main on 2026-09-23** by
the owner. Measured read-only immediately before: 8 users, 128 transactions
summing 171,070.25, three 1098-T rows, two 1098-E rows, three home office
rows, two mileage logs, ten income sources; six migrations applied. Checked
afterwards, read-only: every one of those unchanged, `User.spouseItemizes`
false and `taxProfileSavedAt` null on all eight users, the two new tables
empty, seven migrations applied.

**`20260924000000_consent_record` was applied to main on 2026-09-23** by the
owner, before the release that uses it was pushed (D47). Measured read-only
immediately before (14:30 UTC): 8 users, 128 transactions summing 171,070.25,
three 1098-T, two 1098-E, three home office rows, two mileage logs, ten income
sources, three bank connections, no W-2s or payments; seven migrations
applied; `User` had `plan` and none of the three new columns. Checked
afterwards, read-only: every count unchanged, the three columns present,
nullable and null on all eight users (so each is asked to agree once), `plan`
untouched, eight migrations applied, none rolled back.

**Next, after this release is live: drop `User.plan`.** Nothing reads it (it
held the string "Pro Plan" on every row, for a plan that does not exist), and
`schema.prisma` no longer declares it. Add it as its own migration only once
no running release selects the column:

```sql
-- prisma/migrations/<timestamp>_drop_user_plan/migration.sql
ALTER TABLE "User" DROP COLUMN "plan";
```

## Applying to another existing database (created with `db push`)

Such a database already has the baseline tables, so tell Prisma the baseline
is applied and then deploy the rest.

```bash
npx prisma migrate resolve --applied 20260909000000_init
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` uses `DATABASE_URL_UNPOOLED` (the `directUrl` in
`schema.prisma`). A fresh, empty database needs only `npx prisma migrate deploy`.
`npx prisma db push` still works and produces the same columns; the migration
files exist so the change can be read and repeated.

## What the DECIMAL cast does to existing float values

Verified by running these exact files against PostgreSQL 18 (PGlite, in
process) seeded with float values, before pointing them at real data:

| Stored as `double precision` | After `DECIMAL(12,2)` |
|---|---|
| 18400 | 18400.00 |
| 45.67 | 45.67 |
| 0.1 + 0.2 (= 0.30000000000000004) | 0.30 |
| 1234567890.12 | 1234567890.12 |
| 2.675 | 2.68 (Postgres rounds half away from zero) |
| 0.005 | 0.01 |
| 99.995 | 100.00 |

Row counts are unchanged; sums agree to the cent after rounding. Values with
more than two decimals are rounded, not truncated. The existing 26 real
transactions come from Plaid (two-decimal amounts) or the manual form, so no
value is expected to change. Existing `User` rows receive the new defaults
(`single`, `false`). Re-applying `money_decimal` to columns that are already
`DECIMAL(12,2)` is a no-op, so a database that was migrated with `db push`
first is not harmed by `migrate deploy` later.

## Application code

Prisma returns `Prisma.Decimal` for these columns. Arithmetic on them lives in
`src/lib/tax` (`money.ts` normalises any Decimal or numeric string). Writes may
still pass JS numbers or strings; Prisma converts. `JSON.stringify` of a
`Prisma.Decimal` produces a string (`"18400"`), so `GET /api/transactions` now
returns `amount` as a string; the pages format it with `Intl.NumberFormat`,
which accepts numeric strings.

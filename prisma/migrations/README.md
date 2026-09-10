# Migrations

Three migrations, generated with `prisma migrate diff` from the schema before
and after Phase 2, so the SQL is reviewable rather than implied by `db push`.

| Migration | What it does |
|---|---|
| `20260909000000_init` | Baseline: the Phase 1 schema exactly as it existed with `Float` money columns. |
| `20260909000100_money_decimal` | `ALTER COLUMN ... SET DATA TYPE DECIMAL(12,2)` on the eight `Float` columns across `Transaction`, `Form1098T`, `Form1098E`, `HomeOfficeDeduction`. Nothing else. |
| `20260909000200_tax_profile_and_category` | Additive: `User.filingStatus TEXT NOT NULL DEFAULT 'single'`, `User.claimedAsDependent BOOLEAN NOT NULL DEFAULT false`, `Transaction.category TEXT NULL`. |

## Applying to the existing database (created with `db push`)

The existing database already has the baseline tables, so tell Prisma the
baseline is applied and then deploy the rest. Run against a Neon **branch**
first, then main.

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

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEDUCTIBLE_EXPENSE_CATEGORIES } from '../categories';

/**
 * Runs the committed Prisma migrations against an in-process Postgres and
 * checks the data migration for the e2e audit's F2: category becomes the
 * single source of truth, so legacy rows whose `taxDeductible` flag
 * contradicted their category have to be reconciled, and the flag becomes a
 * derived column.
 *
 * The seed is inserted after every migration EXCEPT the one under test, then
 * that migration runs, so the assertions are about what it does to rows that
 * already exist, which is the situation on the main database.
 *
 * Manual rows and Plaid-synced rows are seeded separately because the flag
 * meant different things on each: the manual form's checkbox defaulted to
 * ticked (so false was a choice), while the sync wrote false by default and
 * the removed Phase 0 heuristic wrote true (neither is a user's choice).
 */

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');
const UNDER_TEST = '20260916000000_category_is_source_of_truth';

function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function sqlOf(dir: string): string {
  return readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
}

interface Row {
  id: string;
  type: string;
  category: string | null;
  taxDeductible: boolean;
}

describe(`migration ${UNDER_TEST}`, () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const dirs = migrationDirs();
    expect(dirs).toContain(UNDER_TEST);
    for (const dir of dirs) {
      if (dir === UNDER_TEST) break;
      await db.exec(sqlOf(dir));
    }
    await db.exec(`
      INSERT INTO "User" (id, name, email) VALUES ('user_1', 'n', 'e');
      INSERT INTO "Transaction" (id, amount, type, date, "userId", category, "taxDeductible", "plaidTransactionId") VALUES
        -- The audit's row: user cleared the checkbox but the category implies a deduction.
        ('audit',        123.45, 'Expense', now(), 'user_1', 'office_expense',        false, NULL),
        -- Same shape, other deductible categories.
        ('supplies_off', 50,     'Expense', now(), 'user_1', 'supplies',              false, NULL),
        ('equip_off',    2200,   'Expense', now(), 'user_1', 'equipment',             false, NULL),
        -- Consistent rows: untouched except that the flag is re-derived (no change).
        ('supplies_on',  60,     'Expense', now(), 'user_1', 'supplies',              true,  NULL),
        ('personal_off', 20,     'Expense', now(), 'user_1', 'personal',              false, NULL),
        -- A non-deductible category with the flag set: the flag was lying; category wins.
        ('personal_on',  30,     'Expense', now(), 'user_1', 'personal',              true,  NULL),
        ('edu_on',       500,    'Expense', now(), 'user_1', 'education_required_materials', true, NULL),
        -- Legacy manual rows with no category.
        ('null_on',      70,     'Expense', now(), 'user_1', NULL,                    true,  NULL),
        ('null_off',     80,     'Expense', now(), 'user_1', NULL,                    false, NULL),
        -- A legacy manual row whose category is not in the vocabulary (the old POST stored any string).
        ('weird_on',     15,     'Expense', now(), 'user_1', 'not_a_category',        true,  NULL),
        -- Plaid-synced rows: false is the sync's default, true is the removed heuristic.
        ('plaid_cat_off', 40,    'Expense', now(), 'user_1', 'supplies',              false, 'plaid_a'),
        ('plaid_null_on', 90,    'Expense', now(), 'user_1', NULL,                    true,  'plaid_b'),
        ('plaid_null_off', 25,   'Expense', now(), 'user_1', NULL,                    false, 'plaid_c'),
        -- Income rows never carry the flag.
        ('income_flag',  1000,   'Income',  now(), 'user_1', 'business_income',       true,  NULL),
        ('income_null',  2000,   'Income',  now(), 'user_1', NULL,                    false, NULL);
    `);
    await db.exec(sqlOf(UNDER_TEST));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  async function rows(): Promise<Map<string, Row>> {
    const res = await db.query<Row>('SELECT id, type, category, "taxDeductible" FROM "Transaction" ORDER BY id');
    return new Map(res.rows.map((r) => [r.id, r]));
  }

  it('turns manual "not deductible" rows with a deduction-implying category into personal (the user\'s stated intent wins)', async () => {
    const r = await rows();
    expect(r.get('audit')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('supplies_off')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('equip_off')).toMatchObject({ category: 'personal', taxDeductible: false });
  });

  it('leaves a Plaid row\'s chosen category alone: false there was the sync default, not an un-tick', async () => {
    const r = await rows();
    expect(r.get('plaid_cat_off')).toMatchObject({ category: 'supplies', taxDeductible: true });
  });

  it('gives uncategorised manual rows the user marked deductible the generic Schedule C category', async () => {
    const r = await rows();
    expect(r.get('null_on')).toMatchObject({ category: 'other_business_expense', taxDeductible: true });
  });

  it('does not promote the removed sync heuristic\'s flag to a category: the row stays uncategorised for review', async () => {
    const r = await rows();
    expect(r.get('plaid_null_on')).toMatchObject({ category: null, taxDeductible: false });
    expect(r.get('plaid_null_off')).toMatchObject({ category: null, taxDeductible: false });
  });

  it('leaves uncategorised, unmarked rows uncategorised so the UI keeps asking', async () => {
    const r = await rows();
    expect(r.get('null_off')).toMatchObject({ category: null, taxDeductible: false });
  });

  it('leaves an unrecognised category string in place (the adapter warns category_mismatch) with the flag cleared', async () => {
    const r = await rows();
    expect(r.get('weird_on')).toMatchObject({ category: 'not_a_category', taxDeductible: false });
  });

  it('re-derives the flag from category everywhere else', async () => {
    const r = await rows();
    expect(r.get('supplies_on')).toMatchObject({ category: 'supplies', taxDeductible: true });
    expect(r.get('personal_off')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('personal_on')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('edu_on')).toMatchObject({ category: 'education_required_materials', taxDeductible: false });
    expect(r.get('income_flag')).toMatchObject({ category: 'business_income', taxDeductible: false });
    expect(r.get('income_null')).toMatchObject({ category: null, taxDeductible: false });
  });

  it('leaves every row consistent: taxDeductible equals "expense in a deductible category"', async () => {
    const r = await rows();
    for (const row of r.values()) {
      const derived = row.type === 'Expense' && row.category !== null && (DEDUCTIBLE_EXPENSE_CATEGORIES as readonly string[]).includes(row.category);
      expect(row.taxDeductible, row.id).toBe(derived);
    }
  });

  it('changes no amounts, dates or row count', async () => {
    const res = await db.query<{ n: number; total: string }>('SELECT count(*)::int AS n, sum(amount)::text AS total FROM "Transaction"');
    expect(res.rows[0].n).toBe(15);
    expect(res.rows[0].total).toBe('6303.45');
  });

  it('is idempotent: running it again changes nothing', async () => {
    const before = await rows();
    await db.exec(sqlOf(UNDER_TEST));
    const after = await rows();
    expect([...after.values()]).toEqual([...before.values()]);
  });

  it('every IN (...) list in the SQL is exactly the engine\'s deductible category set', () => {
    const sql = sqlOf(UNDER_TEST).replace(/--.*$/gm, ''); // comments may mention IN (...) too
    const lists = [...sql.matchAll(/IN \(([^)]*)\)/g)].map((m) => new Set([...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1])));
    expect(lists.length).toBe(3);
    const expected = new Set(DEDUCTIBLE_EXPENSE_CATEGORIES);
    for (const list of lists) {
      expect([...list].sort()).toEqual([...expected].sort());
    }
  });
});

/**
 * The W-2, estimated payment and tax profile migration is additive: existing
 * users and 1098-T rows must come through with the defaults and nothing else
 * changed, and the new tables must be tied to User the way Prisma expects.
 */
describe('migration 20260923000000_w2_payments_profile', () => {
  const NEW = '20260923000000_w2_payments_profile';
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const dirs = migrationDirs();
    expect(dirs).toContain(NEW);
    for (const dir of dirs) {
      if (dir === NEW) break;
      await db.exec(sqlOf(dir));
    }
    await db.exec(`
      INSERT INTO "User" (id, name, email, "filingStatus") VALUES ('user_1', 'n', 'e', 'married_filing_separately');
      INSERT INTO "Form1098T" (id, "userId", "taxYear", box1, box5) VALUES ('t_1', 'user_1', 2025, 4000, 6500.5);
    `);
    await db.exec(sqlOf(NEW));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('gives existing users spouseItemizes = false and keeps their filing status', async () => {
    const res = await db.query<{ filingStatus: string; spouseItemizes: boolean }>('SELECT "filingStatus", "spouseItemizes" FROM "User"');
    expect(res.rows).toEqual([{ filingStatus: 'married_filing_separately', spouseItemizes: false }]);
  });

  it('gives existing 1098-T rows a zero restricted amount and leaves the boxes alone', async () => {
    const res = await db.query<{ box1: string; box5: string; r: string }>('SELECT box1::text, box5::text, "restrictedToNonQualifiedExpenses"::text AS r FROM "Form1098T"');
    expect(res.rows).toEqual([{ box1: '4000.00', box5: '6500.50', r: '0.00' }]);
  });

  it('creates W2Form with money as DECIMAL(12,2), optional boxes defaulting to zero and the owner defaulting to the taxpayer', async () => {
    await db.exec(`INSERT INTO "W2Form" (id, "userId", "taxYear", employer, wages, "socialSecurityWages", "medicareWages") VALUES ('w_1', 'user_1', 2025, 'Cafe', 1234.567, 1234.567, 1234.567)`);
    const res = await db.query<Record<string, unknown>>('SELECT wages::text, "federalWithheld"::text AS fw, "socialSecurityTips"::text AS tips, "medicareWithheld"::text AS mw, "ownedByTaxpayer" FROM "W2Form"');
    expect(res.rows).toEqual([{ wages: '1234.57', fw: '0.00', tips: '0.00', mw: '0.00', ownedByTaxpayer: true }]);
  });

  it('creates EstimatedTaxPayment keyed by tax year', async () => {
    await db.exec(`INSERT INTO "EstimatedTaxPayment" (id, "userId", "taxYear", "paidOn", amount) VALUES ('p_1', 'user_1', 2025, '2026-01-15', 800)`);
    const res = await db.query<{ taxYear: number; amount: string; note: string | null }>('SELECT "taxYear", amount::text, note FROM "EstimatedTaxPayment"');
    expect(res.rows).toEqual([{ taxYear: 2025, amount: '800.00', note: null }]);
  });

  it('ties both tables to User: an unknown user is refused, and a user with rows cannot be deleted first', async () => {
    await expect(db.exec(`INSERT INTO "W2Form" (id, "userId", "taxYear", employer, wages, "socialSecurityWages", "medicareWages") VALUES ('w_x', 'nobody', 2025, 'x', 1, 1, 1)`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO "EstimatedTaxPayment" (id, "userId", "taxYear", "paidOn", amount) VALUES ('p_x', 'nobody', 2025, now(), 1)`)).rejects.toThrow();
    // ON DELETE RESTRICT, like every other table: the Clerk webhook deletes children first.
    await expect(db.exec(`DELETE FROM "User" WHERE id = 'user_1'`)).rejects.toThrow();
  });

  it('indexes both tables by (userId, taxYear), the only way the app reads them', async () => {
    const res = await db.query<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE tablename IN ('W2Form', 'EstimatedTaxPayment') AND indexname LIKE '%userId_taxYear%' ORDER BY indexname`);
    expect(res.rows.map((r) => r.indexname)).toEqual(['EstimatedTaxPayment_userId_taxYear_idx', 'W2Form_userId_taxYear_idx']);
  });
});

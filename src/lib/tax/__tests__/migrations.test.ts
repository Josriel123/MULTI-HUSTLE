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
      INSERT INTO "Transaction" (id, amount, type, date, "userId", category, "taxDeductible") VALUES
        -- The audit's row: user cleared the checkbox but the category implies a deduction.
        ('audit',        123.45, 'Expense', now(), 'user_1', 'office_expense',        false),
        -- Same shape, other deductible categories.
        ('supplies_off', 50,     'Expense', now(), 'user_1', 'supplies',              false),
        ('equip_off',    2200,   'Expense', now(), 'user_1', 'equipment',             false),
        -- Consistent rows: untouched except that the flag is re-derived (no change).
        ('supplies_on',  60,     'Expense', now(), 'user_1', 'supplies',              true),
        ('personal_off', 20,     'Expense', now(), 'user_1', 'personal',              false),
        -- A non-deductible category with the flag set: the flag was lying; category wins.
        ('personal_on',  30,     'Expense', now(), 'user_1', 'personal',              true),
        ('edu_on',       500,    'Expense', now(), 'user_1', 'education_required_materials', true),
        -- Legacy manual rows with no category.
        ('null_on',      70,     'Expense', now(), 'user_1', NULL,                    true),
        ('null_off',     80,     'Expense', now(), 'user_1', NULL,                    false),
        -- Income rows never carry the flag.
        ('income_flag',  1000,   'Income',  now(), 'user_1', 'business_income',       true),
        ('income_null',  2000,   'Income',  now(), 'user_1', NULL,                    false);
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

  it('turns "not deductible" rows with a deduction-implying category into personal (the user\'s stated intent wins)', async () => {
    const r = await rows();
    expect(r.get('audit')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('supplies_off')).toMatchObject({ category: 'personal', taxDeductible: false });
    expect(r.get('equip_off')).toMatchObject({ category: 'personal', taxDeductible: false });
  });

  it('gives uncategorised rows the user marked deductible the generic Schedule C category', async () => {
    const r = await rows();
    expect(r.get('null_on')).toMatchObject({ category: 'other_business_expense', taxDeductible: true });
  });

  it('leaves uncategorised, unmarked rows uncategorised so the UI keeps asking', async () => {
    const r = await rows();
    expect(r.get('null_off')).toMatchObject({ category: null, taxDeductible: false });
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

  it('changes no amounts, dates or row count', async () => {
    const res = await db.query<{ n: number; total: string }>('SELECT count(*)::int AS n, sum(amount)::text AS total FROM "Transaction"');
    expect(res.rows[0].n).toBe(11);
    expect(res.rows[0].total).toBe('6133.45');
  });

  it('is idempotent: running it again changes nothing', async () => {
    const before = await rows();
    await db.exec(sqlOf(UNDER_TEST));
    const after = await rows();
    expect([...after.values()]).toEqual([...before.values()]);
  });

  it('the SQL\'s list of deductible categories matches the engine\'s', () => {
    const sql = sqlOf(UNDER_TEST);
    for (const category of DEDUCTIBLE_EXPENSE_CATEGORIES) {
      expect(sql).toContain(`'${category}'`);
    }
    // And nothing non-deductible sneaked into that list.
    for (const wrong of ['personal', 'education_required_materials', 'health_insurance_premiums', 'retirement_contribution', 'home_office_expense', 'education_tuition_fees', 'student_loan_payment']) {
      expect(sql).not.toMatch(new RegExp(`IN \\([^)]*'${wrong}'`));
    }
  });
});

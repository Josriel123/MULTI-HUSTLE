import { cents, isAboveZero, money, notBelowZero, ZERO, type Money, type MoneyInput } from './money';
import { bracketTableFor, type BracketTableKey, type TaxYearParameters } from './parameters/types';
import type { Citation, FilingStatus, Line } from './types';

/**
 * Regular income tax: IRC §1(j)(2) rate tables as inflation-adjusted each
 * year (Rev. Proc. §3.01 Tables 1-4); Form 1040 line 16.
 *
 * Tax is computed bracket by bracket: each row's rate applies to the slice of
 * taxable income between the previous row's ceiling and this row's ceiling.
 * The Rev. Proc. prints the same result as "$B plus R% of the excess over $L",
 * and the tests assert that both forms agree to the cent.
 *
 * Filers with taxable income under $100,000 look their tax up in the Tax
 * Table, which is built on $50 income bands and can differ from the exact
 * bracket computation by up to about $5. The Tax Computation Worksheet used
 * above $100,000 is the exact bracket formula. This engine always uses the
 * exact formula; the difference is noted as an assumption.
 */

export const INCOME_TAX_CITATIONS: Record<string, Citation> = {
  statute: {
    label: 'IRC §1(j)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
    note: 'Rate tables for taxable years beginning after December 31, 2017 (made permanent by Pub. L. 119-21), with brackets adjusted for inflation under §1(f).',
  },
  taxTable: {
    label: 'Form 1040 instructions, Tax Table and Tax Computation Worksheet',
    url: 'https://www.irs.gov/instructions/i1040gi',
    note: 'The Tax Table covers taxable income under $100,000 in $50 bands; the worksheet above that is the exact bracket formula.',
  },
};

export interface BracketSlice {
  lower: Money;
  upper: Money | null;
  rate: Money;
  taxableInBracket: Money;
  tax: Money;
}

export interface IncomeTaxResult {
  taxableIncome: Money;
  table: BracketTableKey;
  slices: BracketSlice[];
  marginalRate: Money;
  /** Form 1040 line 16. */
  tax: Money;
  lines: Line[];
  citations: Citation[];
}

export function computeIncomeTax(taxableIncome: MoneyInput, filingStatus: FilingStatus, params: TaxYearParameters): IncomeTaxResult {
  const ti = notBelowZero(money(taxableIncome, 'incomeTax.taxableIncome'));
  const tableKey = bracketTableFor(filingStatus);
  const table = params.incomeTaxBrackets[tableKey];

  const slices: BracketSlice[] = [];
  let lower: Money = ZERO;
  let total: Money = ZERO;
  let marginal: Money = ZERO;

  for (const row of table.rows) {
    const upper = row.upTo === null ? null : money(row.upTo);
    const rate = money(row.rate);
    if (upper !== null && upper.lessThanOrEqualTo(lower)) {
      throw new Error(`incomeTax: bracket table ${tableKey} for ${params.taxYear} is not ascending at ${row.upTo}`);
    }
    const ceiling = upper === null ? ti : upper;
    const inBracket = notBelowZero((ti.lessThan(ceiling) ? ti : ceiling).minus(lower));
    if (isAboveZero(inBracket) || (ti.isZero() && slices.length === 0)) {
      const tax = inBracket.times(rate);
      slices.push({ lower, upper, rate, taxableInBracket: inBracket, tax });
      total = total.plus(tax);
      marginal = rate;
    }
    if (upper === null || ti.lessThanOrEqualTo(upper)) break;
    lower = upper;
  }

  const tax = cents(total);
  const lines: Line[] = [
    { ref: 'Form 1040 line 15', label: 'Taxable income', value: ti },
    ...slices.map((s) => ({
      ref: `§1(j)(2) table (${tableKey})`,
      label: `${s.rate.times(100).toFixed(0)}% on ${s.lower.toFixed(0)} to ${s.upper ? s.upper.toFixed(0) : 'no limit'}`,
      value: cents(s.tax),
    })),
    { ref: 'Form 1040 line 16', label: 'Tax', value: tax },
  ];

  return {
    taxableIncome: ti,
    table: tableKey,
    slices,
    marginalRate: marginal,
    tax,
    lines,
    citations: [INCOME_TAX_CITATIONS.statute, table.citation, INCOME_TAX_CITATIONS.taxTable],
  };
}

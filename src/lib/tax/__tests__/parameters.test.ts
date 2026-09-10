import { describe, expect, it } from 'vitest';
import { computeIncomeTax } from '../incomeTax';
import { money, ZERO, type Money } from '../money';
import { getTaxYearParameters, isSupportedTaxYear, SUPPORTED_TAX_YEARS, TAX_YEAR_PARAMETERS, type BracketTableKey } from '../parameters';
import type { FilingStatus } from '../types';
import { INDEPENDENT_BRACKETS, INDEPENDENT_RATES } from './fixtures/irsBracketsIndependent';
import { expectMoney } from './helpers';

/**
 * The parameter files transcribe numbers from the Revenue Procedures. These
 * tests check the transcription against itself and against a second,
 * independent set of figures, so a typo in either place fails loudly.
 */

const STATUS_FOR_TABLE: Record<BracketTableKey, FilingStatus> = {
  joint: 'married_filing_jointly',
  head_of_household: 'head_of_household',
  single: 'single',
  married_filing_separately: 'married_filing_separately',
};

describe('supported tax years', () => {
  it('covers 2024 through 2026, in order', () => {
    expect(SUPPORTED_TAX_YEARS).toEqual([2024, 2025, 2026]);
    expect(isSupportedTaxYear(2025)).toBe(true);
    expect(isSupportedTaxYear(2023)).toBe(false);
    expect(isSupportedTaxYear('2025')).toBe(false);
    expect(() => getTaxYearParameters(2023)).toThrow(/not supported/);
  });
});

describe.each(SUPPORTED_TAX_YEARS)('tax year %i', (year) => {
  const p = TAX_YEAR_PARAMETERS[year];
  const tables = Object.keys(p.incomeTaxBrackets) as BracketTableKey[];

  it('has the seven §1(j)(2) rates in ascending order in every table, with one open-ended row', () => {
    for (const key of tables) {
      const rows = p.incomeTaxBrackets[key].rows;
      expect(rows.map((r) => r.rate)).toEqual(['0.10', '0.12', '0.22', '0.24', '0.32', '0.35', '0.37']);
      expect(rows[rows.length - 1].upTo).toBeNull();
      let prev: Money = ZERO;
      for (const r of rows.slice(0, -1)) {
        expect(money(r.upTo as string).greaterThan(prev)).toBe(true);
        prev = money(r.upTo as string);
      }
    }
  });

  it.each(tables)('table %s: the "$B plus R%% of the excess" base amounts printed in the Rev. Proc. equal the bracket arithmetic', (key) => {
    const rows = p.incomeTaxBrackets[key].rows;
    let lower: Money = ZERO;
    let checked = 0;
    for (const row of rows) {
      if (row.taxAtLowerBoundAsPrinted !== undefined) {
        // Tax on exactly the lower bound of this row = cumulative tax of all lower brackets = the printed base.
        const tax = computeIncomeTax(lower, STATUS_FOR_TABLE[key], p).tax;
        expectMoney(tax, money(row.taxAtLowerBoundAsPrinted).toFixed(2));
        checked++;
      }
      if (row.upTo !== null) lower = money(row.upTo);
    }
    expect(checked).toBe(6);
  });

  it('gives surviving spouses the joint table and joint standard deduction', () => {
    const s = p.standardDeduction.amounts;
    expect(s.qualifying_surviving_spouse).toBe(s.married_filing_jointly);
    expect(s.married_filing_separately).toBe(s.single);
    const ti = money('100000');
    expectMoney(computeIncomeTax(ti, 'qualifying_surviving_spouse', p).tax, computeIncomeTax(ti, 'married_filing_jointly', p).tax.toFixed(2));
  });

  it('cites a source for every parameter group', () => {
    expect(p.sources.length).toBeGreaterThan(0);
    for (const key of tables) expect(p.incomeTaxBrackets[key].citation.label).toMatch(/Rev\. Proc\./);
    expect(p.standardDeduction.citation.label).toBeTruthy();
    expect(p.selfEmployment.citation.url).toMatch(/irs\.gov/);
    expect(p.qbi.citation.label).toMatch(/199A|Qualified Business Income/);
    expect(p.studentLoanInterest.citation.label).toMatch(/Education Loans/);
    for (const period of p.standardMileage) expect(period.citation.label).toMatch(/Notice|Announcement/);
  });

  it('has mileage rate periods that cover the whole year with no gaps or overlaps', () => {
    const periods = [...p.standardMileage].sort((a, b) => a.from.localeCompare(b.from));
    expect(periods[0].from).toBe(`${year}-01-01`);
    expect(periods[periods.length - 1].to).toBe(`${year}-12-31`);
    for (let i = 1; i < periods.length; i++) {
      const prevEnd = new Date(periods[i - 1].to + 'T00:00:00Z');
      const nextStart = new Date(periods[i].from + 'T00:00:00Z');
      expect(nextStart.getTime() - prevEnd.getTime()).toBe(24 * 3600 * 1000);
    }
  });
});

describe('rate tables against an independent transcription (audit 2026-09-09)', () => {
  // The self-consistency test above compares two fields of the SAME
  // transcription, so a boundary and base copied wrongly together would pass.
  // This fixture was typed from the IRS PDFs by the auditor, separately.
  it('covers all 12 tables', () => {
    expect(INDEPENDENT_BRACKETS).toHaveLength(12);
  });

  it.each(INDEPENDENT_BRACKETS.map((t) => [t.year, t.table, t] as const))('%i %s: production brackets equal the independent copy', (year, table, fixture) => {
    const rows = TAX_YEAR_PARAMETERS[year].incomeTaxBrackets[table].rows;
    expect(rows.slice(0, 6).map((r) => r.upTo)).toEqual([...fixture.tops]);
    expect(rows.slice(1).map((r) => money(r.taxAtLowerBoundAsPrinted as string).toFixed(2))).toEqual(fixture.bases.map((b) => money(b).toFixed(2)));
    expect(rows.map((r) => r.rate)).toEqual([...INDEPENDENT_RATES]);
  });

  it.each(INDEPENDENT_BRACKETS.map((t) => [t.year, t.table, t] as const))('%i %s: tax at every boundary, $1 below and $1 above, matches the independent bases', (year, table, fixture) => {
    const p = TAX_YEAR_PARAMETERS[year];
    let checked = 0;
    for (let i = 0; i < 6; i++) {
      const top = money(fixture.tops[i]);
      const base = money(fixture.bases[i]);
      // At the ceiling the tax is the printed base; $1 below removes one dollar at this bracket's rate; $1 above adds one at the next rate.
      expectMoney(computeIncomeTax(top, STATUS_FOR_TABLE[table], p).tax, base.toFixed(2));
      expectMoney(computeIncomeTax(top.minus(1), STATUS_FOR_TABLE[table], p).tax, base.minus(money(INDEPENDENT_RATES[i])).toFixed(2));
      expectMoney(computeIncomeTax(top.plus(1), STATUS_FOR_TABLE[table], p).tax, base.plus(money(INDEPENDENT_RATES[i + 1])).toFixed(2));
      checked += 3;
    }
    expect(checked).toBe(18);
  });
});

describe('year-specific figures, checked against a second source', () => {
  it('2024: Rev. Proc. 2023-34; wage base from 2024 Schedule SE instructions', () => {
    const p = getTaxYearParameters(2024);
    expect(p.standardDeduction.amounts).toMatchObject({ single: '14600', married_filing_jointly: '29200', head_of_household: '21900' });
    expect(p.standardDeduction.dependentFloor).toBe('1300');
    expect(p.selfEmployment.socialSecurityWageBase).toBe('168600');
    expect(p.qbi.threshold).toEqual({ joint: '383900', marriedFilingSeparately: '191950', other: '191950' });
    expect(p.qbi.phaseInRange).toEqual({ joint: '100000', marriedFilingSeparately: '50000', other: '50000' });
    expect(p.qbi.minimumDeduction).toBeNull();
    expect(p.studentLoanInterest.phaseout).toEqual({ joint: { start: '165000', end: '195000' }, other: { start: '80000', end: '95000' } });
    expect(p.standardMileage[0].centsPerMile).toBe('67');
  });

  it('2025: Rev. Proc. 2024-40 with the Pub. L. 119-21 standard deduction; wage base from 2025 Schedule SE instructions; Form 8995 thresholds', () => {
    const p = getTaxYearParameters(2025);
    // Pub. L. 119-21 §70102 amounts, not the $15,000 / $30,000 / $22,500 originally printed in Rev. Proc. 2024-40 §3.15.
    expect(p.standardDeduction.amounts).toMatchObject({ single: '15750', married_filing_jointly: '31500', head_of_household: '23625', married_filing_separately: '15750' });
    expect(p.standardDeduction.dependentFloor).toBe('1350');
    expect(p.standardDeduction.dependentEarnedIncomeAddOn).toBe('450');
    expect(p.selfEmployment.socialSecurityWageBase).toBe('176100');
    expect(p.qbi.threshold).toEqual({ joint: '394600', marriedFilingSeparately: '197300', other: '197300' });
    expect(p.qbi.phaseInRange).toEqual({ joint: '100000', marriedFilingSeparately: '50000', other: '50000' });
    expect(p.studentLoanInterest.phaseout).toEqual({ joint: { start: '170000', end: '200000' }, other: { start: '85000', end: '100000' } });
    expect(p.kiddieTax.baseAmount).toBe('1350');
    expect(p.standardMileage[0].centsPerMile).toBe('70');
    // Bracket tops for single filers as printed in Table 3.
    expect(p.incomeTaxBrackets.single.rows.map((r) => r.upTo)).toEqual(['11925', '48475', '103350', '197300', '250525', '626350', null]);
  });

  it('2026: Rev. Proc. 2025-32 (first year of the wider §199A phase-in and the $400 minimum); wage base from Tax Topic 751; mid-year mileage change', () => {
    const p = getTaxYearParameters(2026);
    expect(p.standardDeduction.amounts).toMatchObject({ single: '16100', married_filing_jointly: '32200', head_of_household: '24150' });
    expect(p.selfEmployment.socialSecurityWageBase).toBe('184500');
    // Separate returns and "all other returns" differ by $25 this year; keep them apart.
    expect(p.qbi.threshold).toEqual({ joint: '403500', marriedFilingSeparately: '201775', other: '201750' });
    expect(p.qbi.phaseInRange).toEqual({ joint: '150000', marriedFilingSeparately: '75000', other: '75000' });
    expect(p.qbi.minimumDeduction).toMatchObject({ amount: '400', qbiFloor: '1000' });
    expect(p.studentLoanInterest.phaseout).toEqual({ joint: { start: '175000', end: '205000' }, other: { start: '85000', end: '100000' } });
    expect(p.standardMileage.map((m) => [m.from, m.to, m.centsPerMile])).toEqual([
      ['2026-01-01', '2026-06-30', '72.5'],
      ['2026-07-01', '2026-12-31', '76'],
    ]);
    expect(p.incomeTaxBrackets.head_of_household.rows.map((r) => r.upTo)).toEqual(['17700', '67450', '105700', '201750', '256200', '640600', null]);
  });
});

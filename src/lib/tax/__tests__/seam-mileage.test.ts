import { describe, expect, it } from 'vitest';
import { estimateFromRows } from '../adapters/estimateFromRows';
import { buildFederalTaxInput, type TransactionRow } from '../adapters/prismaRows';
import { estimateFederalTax } from '../engine';
import { money } from '../money';
import { expectMoney } from './helpers';

/**
 * E2E audit 2026-09-16, F1: a logged trip displayed a $760 deduction that
 * never reached the calculation, because mileage was priced in the route
 * after the estimate had already run. These tests sit at the seam the audit
 * found broken: database-shaped rows in, estimate out.
 */

const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const INCOME_50K: TransactionRow[] = [
  { amount: '50000', type: 'Income', date: d('2026-09-11'), category: 'business_income', incomeSource: null },
];

describe('F1: logged mileage reaches the estimate', () => {
  it('the audit scenario: $50,000 of 2026 receipts, a 1,000-mile trip on 2026-09-10 (76c) lowers the tax', () => {
    const without = estimateFederalTax(buildFederalTaxInput({ taxYear: 2026, transactions: INCOME_50K }).input);
    // The audit measured $9,732 with no mileage.
    expectMoney(without.totalTax, '9732.07');

    const withTrip = estimateFederalTax(
      buildFederalTaxInput({
        taxYear: 2026,
        transactions: INCOME_50K,
        mileageLogs: [{ date: d('2026-09-10'), miles: '1000' }],
      }).input,
    );
    // Schedule C line 9: 1,000 x $0.76 = $760 (Announcement 2026-11 rate from July 1, 2026)
    expectMoney(withTrip.scheduleC.mileage.deduction, '760.00');
    expectMoney(withTrip.scheduleC.mileage.totalMiles, '1000.00');
    expectMoney(withTrip.scheduleC.netProfit, '49240.00');
    // SE: 49,240 x 0.9235 = 45,473.14; 12.4% 5,638.67 + 2.9% 1,318.72 = 6,957.39; half 3,478.70
    // AGI 45,761.30; std 16,100 -> 29,661.30; QBI limit 20% = 5,932.26; TI 23,729.04
    // Tax 1,240 + 12% x 11,329.04 = 2,599.48; total 9,556.87
    expectMoney(withTrip.scheduleSE.selfEmploymentTax, '6957.39');
    expectMoney(withTrip.taxableIncome, '23729.04');
    expectMoney(withTrip.totalTax, '9556.87');
    expect(withTrip.totalTax.lessThan(without.totalTax)).toBe(true);
  });

  it('prices each trip at the rate in force on its date and ignores trips outside the tax year', () => {
    const e = estimateFederalTax(
      buildFederalTaxInput({
        taxYear: 2026,
        transactions: INCOME_50K,
        mileageLogs: [
          { date: d('2026-03-01'), miles: '100' }, // 72.5c -> 72.50
          { date: d('2026-08-01'), miles: '100' }, // 76c   -> 76.00
          { date: d('2025-12-31'), miles: '500' }, // prior year: ignored
        ],
      }).input,
    );
    expectMoney(e.scheduleC.mileage.totalMiles, '200.00');
    expectMoney(e.scheduleC.mileage.deduction, '148.50');
    expect(e.scheduleC.mileage.trips).toBe(2);
  });

  it('reports the miles it dropped for being outside the year', () => {
    const built = buildFederalTaxInput({
      taxYear: 2026,
      transactions: [],
      mileageLogs: [{ date: d('2025-06-01'), miles: '10' }, { date: d('2026-06-01'), miles: '10' }],
    });
    expect(built.mileage.included).toBe(1);
    expect(built.mileage.outsideTaxYear).toBe(1);
  });

  it('standard mileage and actual vehicle costs are not both deducted: the larger applies and the other is flagged', () => {
    const rows: TransactionRow[] = [
      ...INCOME_50K,
      { amount: '500', type: 'Expense', date: d('2026-05-01'), category: 'car_and_truck', incomeSource: null },
    ];
    const standardWins = estimateFederalTax(
      buildFederalTaxInput({ taxYear: 2026, transactions: rows, mileageLogs: [{ date: d('2026-09-10'), miles: '1000' }] }).input,
    );
    expect(standardWins.scheduleC.mileage.methodApplied).toBe('standard_mileage');
    expectMoney(standardWins.scheduleC.mileage.deduction, '760.00');
    expectMoney(standardWins.scheduleC.mileage.actualVehicleExpenses, '500.00');
    expectMoney(standardWins.scheduleC.totalExpenses, '760.00');
    expect(standardWins.warnings.map((w) => w.code)).toContain('vehicle_method_conflict');

    const actualWins = estimateFederalTax(
      buildFederalTaxInput({
        taxYear: 2026,
        transactions: [...INCOME_50K, { amount: '2000', type: 'Expense', date: d('2026-05-01'), category: 'car_and_truck', incomeSource: null }],
        mileageLogs: [{ date: d('2026-09-10'), miles: '1000' }],
      }).input,
    );
    expect(actualWins.scheduleC.mileage.methodApplied).toBe('actual_expenses');
    expectMoney(actualWins.scheduleC.mileage.deduction, '0.00');
    expectMoney(actualWins.scheduleC.totalExpenses, '2000.00');
    expect(actualWins.warnings.map((w) => w.code)).toContain('vehicle_method_conflict');
  });

  it('no trips means no line 9 entry and no warning', () => {
    const e = estimateFederalTax(buildFederalTaxInput({ taxYear: 2026, transactions: INCOME_50K, mileageLogs: [] }).input);
    expect(e.scheduleC.mileage.methodApplied).toBe('none');
    expectMoney(e.scheduleC.mileage.deduction, '0.00');
    expect(e.warnings.map((w) => w.code)).not.toContain('vehicle_method_conflict');
  });
});

describe('the summary and chart routes share one estimate function', () => {
  it('estimateFromRows returns the estimate, the built input and the safe-to-spend figure the routes display', () => {
    const rows: TransactionRow[] = [...INCOME_50K, { amount: '1000', type: 'Expense', date: d('2026-06-01'), category: 'personal', incomeSource: null }];
    const { built, estimate, safeToSpend } = estimateFromRows({
      taxYear: 2026,
      transactions: rows,
      mileageLogs: [{ date: d('2026-09-10'), miles: '1000' }],
    });
    expectMoney(estimate.scheduleC.mileage.deduction, '760.00');
    // Cash view: 50,000 in - 1,000 spent (personal, not deductible) - 9,556.87 tax
    expectMoney(safeToSpend, money('50000').minus('1000').minus(estimate.totalTax).toFixed(2));
    expectMoney(built.cashExpensesTotal, '1000.00');
  });

  it('the chart\'s December point equals the summary for the same rows, mileage included', () => {
    const rows: TransactionRow[] = [
      { amount: '20000', type: 'Income', date: d('2026-02-15'), category: 'business_income', incomeSource: null },
      { amount: '30000', type: 'Income', date: d('2026-09-11'), category: 'business_income', incomeSource: null },
    ];
    const logs = [{ date: d('2026-03-10'), miles: '400' }, { date: d('2026-10-10'), miles: '600' }];
    const summary = estimateFromRows({ taxYear: 2026, transactions: rows, mileageLogs: logs });

    // Mirror of the chart route's month loop: everything dated before the end of December.
    const decemberEndExclusive = new Date(Date.UTC(2027, 0, 1));
    const december = estimateFromRows({
      taxYear: 2026,
      transactions: rows.filter((t) => t.date < decemberEndExclusive),
      mileageLogs: logs.filter((l) => l.date < decemberEndExclusive),
    });
    expectMoney(december.estimate.totalTax, summary.estimate.totalTax.toFixed(2));
    expectMoney(december.safeToSpend, summary.safeToSpend.toFixed(2));

    // And a mid-year point only sees the trips driven so far.
    const juneEndExclusive = new Date(Date.UTC(2026, 6, 1));
    const june = estimateFromRows({
      taxYear: 2026,
      transactions: rows.filter((t) => t.date < juneEndExclusive),
      mileageLogs: logs.filter((l) => l.date < juneEndExclusive),
    });
    expectMoney(june.estimate.scheduleC.mileage.deduction, '290.00'); // 400 x 72.5c
    expectMoney(summary.estimate.scheduleC.mileage.deduction, '746.00'); // + 600 x 76c
  });
});

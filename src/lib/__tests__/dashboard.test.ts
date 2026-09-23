import { describe, expect, it } from 'vitest';
import { chartPayload, summaryPayload, type EstimateInputRows } from '../dashboard';

const d = (iso: string) => new Date(iso + 'T00:00:00Z');

const rows: EstimateInputRows = {
  taxYear: 2025,
  user: { filingStatus: 'single', claimedAsDependent: false },
  transactions: [
    { amount: '12000.00', type: 'Income', date: d('2025-02-10'), category: 'business_income', incomeSource: { name: 'DoorDash', type: 'Delivery' } },
    { amount: '8000.00', type: 'Income', date: d('2025-07-20'), category: 'business_income', incomeSource: { name: 'Web design', type: 'Freelance' } },
    { amount: '600.00', type: 'Expense', date: d('2025-03-01'), category: 'supplies', incomeSource: null },
    { amount: '45.00', type: 'Expense', date: d('2025-03-02'), category: null, incomeSource: null },
  ],
  mileageLogs: [{ date: d('2025-05-05'), miles: '120' }],
  w2Forms: [{ taxYear: 2025, wages: '24000.00', federalWithheld: '1800.00', socialSecurityWages: '24000.00', medicareWages: '24000.00', medicareWithheld: '348.00' }],
  estimatedPayments: [
    { taxYear: 2025, amount: '700.00', paidOn: d('2025-06-16') },
    // The fourth-quarter payment for 2025, made in January 2026.
    { taxYear: 2025, amount: '900.00', paidOn: d('2026-01-15') },
  ],
};

describe('summaryPayload', () => {
  const payload = summaryPayload(rows);

  it("names the IRS source of the year's figures, as the Terms of Service promise every estimate does", () => {
    expect(payload.rules).toEqual({ taxYear: 2025, source: 'Rev. Proc. 2024-40', url: expect.stringMatching(/^https:\/\/www\.irs\.gov\//) });
    expect(summaryPayload({ ...rows, taxYear: 2026 }).rules.source).toBe('Rev. Proc. 2025-32');
  });

  it('reports what is owed, what is paid and what is left, straight from the engine', () => {
    const e = payload.estimate;
    expect(payload.summary.taxLiability).toBe(e.totalTax);
    expect(payload.summary.paid).toBe(e.payments.total);
    expect(payload.summary.balanceDue).toBe(e.balanceDue);
    // Withholding 1,800 + both estimated payments 1,600.
    expect(e.payments.withholding).toBe(1800);
    expect(e.payments.estimatedPayments).toBe(1600);
    expect(e.income.wages).toBe(24000);
  });

  it('splits the balance into left-to-pay and refund, never negative, with the share already paid', () => {
    const { summary } = payload;
    if (summary.balanceDue >= 0) {
      expect(summary.leftToPay).toBe(summary.balanceDue);
      expect(summary.refund).toBe(0);
    } else {
      expect(summary.leftToPay).toBe(0);
      expect(summary.refund).toBe(-summary.balanceDue);
    }
    expect(summary.paidShare).toBeGreaterThan(0);
    expect(summary.paidShare).toBeLessThanOrEqual(1);

    // Overpaid: a refund, and the bar is simply full.
    const overpaid = summaryPayload({ ...rows, estimatedPayments: [{ taxYear: 2025, amount: '50000.00', paidOn: d('2025-04-15') }] });
    expect(overpaid.summary.leftToPay).toBe(0);
    expect(overpaid.summary.refund).toBeGreaterThan(0);
    expect(overpaid.summary.paidShare).toBe(1);

    // No tax at all: nothing to divide by.
    expect(summaryPayload({ taxYear: 2025, transactions: [] }).summary.paidShare).toBeNull();
  });

  it('groups income by hustle for the overview', () => {
    expect(payload.incomeBySource).toEqual([
      { name: 'DoorDash', type: 'Delivery', income: 12000, count: 1, share: 0.6 },
      { name: 'Web design', type: 'Freelance', income: 8000, count: 1, share: 0.4 },
    ]);
  });

  it('counts what is on file, for the setup checklist', () => {
    expect(payload.counts).toEqual({
      transactions: 4,
      mileageTrips: 1,
      w2Forms: 1,
      estimatedPayments: 2,
      has1098T: false,
      has1098E: false,
      hasHomeOffice: false,
    });
    expect(payload.transactions.uncategorised.expenseCount).toBe(1);
  });

  it('carries the disclaimer, warnings and the not-modeled list with every figure', () => {
    expect(payload.disclaimer).toMatch(/not tax advice/);
    expect(payload.warnings.map((w) => w.code)).toContain('uncategorised_expenses');
    expect(payload.notModeled.length).toBeGreaterThan(5);
  });

  it('puts route warnings first', () => {
    const withFallback = summaryPayload(rows, [{ code: 'tax_year_fallback', message: 'x' }]);
    expect(withFallback.warnings[0].code).toBe('tax_year_fallback');
  });
});

describe('chartPayload', () => {
  const chart = chartPayload(rows, d('2026-09-23'));
  const summary = summaryPayload(rows);

  it('has twelve cumulative months, and December is exactly the summary', () => {
    expect(chart.points.map((p) => p.month)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    const dec = chart.points[11];
    expect(dec.gross).toBe(summary.summary.gross);
    expect(dec.net).toBe(summary.summary.net);
  });

  it('spreads W-2 wages evenly, because a W-2 has no dates, and says so', () => {
    expect(chart.w2Spread).toBe(true);
    // January: two thousand of wages (24,000 / 12) and no hustle income yet.
    expect(chart.points[0].gross).toBe(2000);
    // February adds the first DoorDash deposit to two months of wages.
    expect(chart.points[1].gross).toBe(16000);
    expect(chartPayload({ ...rows, w2Forms: [] }).w2Spread).toBe(false);
  });

  it('is cumulative: total income never falls from one month to the next', () => {
    for (let i = 1; i < 12; i++) expect(chart.points[i].gross).toBeGreaterThanOrEqual(chart.points[i - 1].gross);
  });

  it('stops the current year at the current month, spreading a year-to-date W-2 over the months so far', () => {
    const thisYear: EstimateInputRows = {
      taxYear: 2026,
      transactions: [{ amount: '900.00', type: 'Income', date: d('2026-02-02'), category: 'business_income', incomeSource: null }],
      w2Forms: [{ taxYear: 2026, wages: '9000.00', socialSecurityWages: '9000.00', medicareWages: '9000.00' }],
    };
    const mid = chartPayload(thisYear, d('2026-03-20'));
    expect(mid.points.map((p) => p.month)).toEqual(['Jan', 'Feb', 'Mar']);
    // 9,000 of year-to-date wages over three months is 3,000 a month.
    expect(mid.points[0].gross).toBe(3000);
    expect(mid.points[1].gross).toBe(6900);
    // The last point is everything: the summary's figure.
    expect(mid.points[2].gross).toBe(summaryPayload(thisYear).summary.gross);
    // A year that has not started yet shows one point.
    expect(chartPayload(thisYear, d('2025-12-01')).points).toHaveLength(1);
  });
});

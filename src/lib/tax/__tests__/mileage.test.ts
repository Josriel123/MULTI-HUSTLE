import { describe, expect, it } from 'vitest';
import { computeStandardMileageDeduction, mileageRateOn } from '../mileage';
import { getTaxYearParameters } from '../parameters';
import { expectMoney } from './helpers';

describe('standard mileage', () => {
  it('2024: 67 cents (Notice 2024-08); 2025: 70 cents (Notice 2025-5)', () => {
    expectMoney(computeStandardMileageDeduction('1000', '2024-06-01', getTaxYearParameters(2024)).deduction, '670.00');
    expectMoney(computeStandardMileageDeduction('1000', '2025-06-01', getTaxYearParameters(2025)).deduction, '700.00');
  });

  it('2026 changes mid-year: 72.5 cents through June 30 (Notice 2026-10), 76 cents from July 1 (Announcement 2026-11)', () => {
    const p = getTaxYearParameters(2026);
    expectMoney(computeStandardMileageDeduction('1000', '2026-06-30', p).deduction, '725.00');
    expectMoney(computeStandardMileageDeduction('1000', '2026-07-01', p).deduction, '760.00');
    expect(mileageRateOn('2026-03-15', p).citation.label).toBe('Notice 2026-10');
    expect(mileageRateOn('2026-12-31', p).citation.label).toMatch(/Announcement 2026-11/);
  });

  it('rounds to cents and rejects bad dates', () => {
    expectMoney(computeStandardMileageDeduction('12.5', '2025-01-01', getTaxYearParameters(2025)).deduction, '8.75');
    expect(() => mileageRateOn('2025/01/01', getTaxYearParameters(2025))).toThrow(/ISO date/);
    expect(() => mileageRateOn('2024-01-01', getTaxYearParameters(2025))).toThrow(/no standard mileage rate/);
    expect(() => computeStandardMileageDeduction('-1', '2025-01-01', getTaxYearParameters(2025))).toThrow(/negative/);
  });
});

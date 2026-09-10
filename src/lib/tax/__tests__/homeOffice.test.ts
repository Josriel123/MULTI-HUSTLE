import { describe, expect, it } from 'vitest';
import { computeHomeOffice } from '../homeOffice';
import { TaxInputError } from '../money';
import { expectMoney } from './helpers';

const RENTER = { totalSquareFeet: '1000', officeSquareFeet: '150', monthlyRent: '1500', monthlyUtilities: '200' };

describe('computeHomeOffice', () => {
  it('computes both methods and picks the larger allowable one', () => {
    // Regular (Form 8829): 150 / 1,000 = 15%; (1,500 + 200) x 12 = 20,400; x 15% = 3,060.00
    // Simplified (Rev. Proc. 2013-13): 150 sq ft x $5 = 750.00
    const r = computeHomeOffice(RENTER, '20000');
    expectMoney(r.regular.businessUsePercentage, '0.15');
    expectMoney(r.regular.annualRentAndUtilities, '20400.00');
    expectMoney(r.regular.beforeLimit, '3060.00');
    expectMoney(r.regular.allowed, '3060.00');
    expectMoney(r.regular.carryover, '0.00');
    expectMoney(r.simplified.beforeLimit, '750.00');
    expectMoney(r.simplified.allowed, '750.00');
    expect(r.method).toBe('regular');
    expectMoney(r.deduction, '3060.00');
  });

  it('applies the §280A(c)(5) gross income limit to both methods; regular carries over, simplified is lost', () => {
    const r = computeHomeOffice(RENTER, '1000');
    expectMoney(r.grossIncomeLimit, '1000.00');
    expectMoney(r.regular.allowed, '1000.00');
    expectMoney(r.regular.carryover, '2060.00');
    expectMoney(r.simplified.allowed, '750.00');
    expectMoney(r.simplified.lost, '0.00');
    expect(r.method).toBe('regular');
    expectMoney(r.deduction, '1000.00');
    expect(r.warnings.map((w) => w.code)).toContain('home_office_limited_by_income');

    const tight = computeHomeOffice(RENTER, '500');
    expectMoney(tight.simplified.allowed, '500.00');
    expectMoney(tight.simplified.lost, '250.00');
    expectMoney(tight.regular.allowed, '500.00');
    // Equal allowable amounts: simplified is preferred (no carryover bookkeeping).
    expect(tight.method).toBe('simplified');
  });

  it('allows nothing when the business has no tentative profit', () => {
    const r = computeHomeOffice(RENTER, '0');
    expect(r.method).toBe('none');
    expectMoney(r.deduction, '0.00');
    expectMoney(r.regular.carryover, '3060.00');
    const loss = computeHomeOffice(RENTER, '-2000');
    expectMoney(loss.deduction, '0.00');
  });

  it('caps the simplified method at 300 square feet ($1,500)', () => {
    const r = computeHomeOffice({ totalSquareFeet: '2000', officeSquareFeet: '400', monthlyRent: '0', monthlyUtilities: '0' }, '50000');
    expectMoney(r.simplified.allowableSquareFeet, '300.00');
    expectMoney(r.simplified.beforeLimit, '1500.00');
    expect(r.method).toBe('simplified');
    expectMoney(r.deduction, '1500.00');
  });

  it('prorates a partial-year office by months used', () => {
    // (1,500 + 200) x 6 = 10,200; x 15% = 1,530.00
    const r = computeHomeOffice({ ...RENTER, monthsUsed: 6 }, '20000');
    expectMoney(r.regular.annualRentAndUtilities, '10200.00');
    expectMoney(r.regular.beforeLimit, '1530.00');
  });

  it('keeps square-footage ratios exact (no float drift)', () => {
    // 1/3 of $3,000 a year = $1,000.00, not $999.99
    const r = computeHomeOffice({ totalSquareFeet: '900', officeSquareFeet: '300', monthlyRent: '250', monthlyUtilities: '0' }, '50000');
    expectMoney(r.regular.beforeLimit, '1000.00');
  });

  it('returns no deduction for a zero-size office', () => {
    const r = computeHomeOffice({ totalSquareFeet: '1000', officeSquareFeet: '0', monthlyRent: '1500', monthlyUtilities: '200' }, '20000');
    expect(r.method).toBe('none');
    expectMoney(r.deduction, '0.00');
    expect(r.warnings).toHaveLength(0);
  });

  it('rejects impossible inputs', () => {
    expect(() => computeHomeOffice({ ...RENTER, officeSquareFeet: '1200' }, '20000')).toThrow(TaxInputError);
    expect(() => computeHomeOffice({ ...RENTER, monthlyRent: '-1' }, '20000')).toThrow(TaxInputError);
    expect(() => computeHomeOffice({ ...RENTER, monthsUsed: 13 }, '20000')).toThrow(TaxInputError);
  });

  it('cites §280A(c)(5) and Rev. Proc. 2013-13', () => {
    const labels = computeHomeOffice(RENTER, '20000').citations.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['IRC §280A(c)(5)', 'Rev. Proc. 2013-13 §4.01(2)–(3)', 'Rev. Proc. 2013-13 §4.08(2)–(3)']));
  });
});

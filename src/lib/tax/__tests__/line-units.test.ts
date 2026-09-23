import { describe, expect, it } from 'vitest';
import { estimateFederalTax } from '../engine';

/**
 * Lines whose value is not dollars say so, so a line-by-line report can show
 * "120 sq ft" and "12%" instead of "$120.00" and "$0.12".
 */
describe('line units', () => {
  const estimate = estimateFederalTax({
    taxYear: 2025,
    filingStatus: 'single',
    scheduleC: {
      grossReceipts: '40000',
      expenses: [],
      mileage: [{ date: '2025-03-01', miles: '100' }],
      homeOffice: { totalSquareFeet: '1000', officeSquareFeet: '120', monthlyRent: '1500', monthlyUtilities: '100' },
    },
  });
  const unitOf = (ref: string) => estimate.lines.find((l) => l.ref === ref)?.unit;
  // Form 8829 lines live on the home office result, not the return's line list.
  const officeUnitOf = (ref: string) => estimate.scheduleC.homeOffice?.lines.find((l) => l.ref === ref)?.unit;

  it('tags areas, the business percentage and miles', () => {
    expect(officeUnitOf('Form 8829 line 1')).toBe('sqft');
    expect(officeUnitOf('Form 8829 line 2')).toBe('sqft');
    expect(officeUnitOf('Form 8829 line 7')).toBe('fraction');
    expect(unitOf('Schedule C Part IV line 44a')).toBe('miles');
  });

  it('leaves dollar lines untagged', () => {
    expect(unitOf('Schedule C line 31')).toBeUndefined();
    expect(unitOf('Form 1040 line 24')).toBeUndefined();
  });
});

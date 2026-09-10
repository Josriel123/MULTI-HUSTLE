import { describe, expect, it } from 'vitest';
import { TaxInputError } from '../money';
import { computeTaxableScholarships } from '../scholarships';
import { expectMoney } from './helpers';

describe('computeTaxableScholarships', () => {
  it('taxes the part of Box 5 not covered by Box 1 and required course materials (IRC §117(b); Pub. 970 ch. 1)', () => {
    // 40,000 - (30,000 + 1,200) = 8,800.00
    const r = computeTaxableScholarships({ form1098T: { box1: '30000', box5: '40000' }, requiredCourseMaterials: '1200' });
    expectMoney(r.qualifiedEducationExpenses, '31200.00');
    expectMoney(r.taxable, '8800.00');
    expect(r.warnings.map((w) => w.code)).toContain('taxable_scholarship');
    expect(r.lines.find((l) => l.ref === 'Schedule 1 line 8r')?.value.toFixed(2)).toBe('8800.00');
  });

  it('is zero when qualified expenses meet or exceed the scholarship', () => {
    const r = computeTaxableScholarships({ form1098T: { box1: '12000', box5: '10000' } });
    expectMoney(r.taxable, '0.00');
    expect(r.warnings).toHaveLength(0);
    expectMoney(computeTaxableScholarships({ form1098T: { box1: '10000', box5: '10000' } }).taxable, '0.00');
  });

  it('treats missing course materials as zero', () => {
    expectMoney(computeTaxableScholarships({ form1098T: { box1: '5000', box5: '9000' } }).taxable, '4000.00');
  });

  it('rejects negative box amounts', () => {
    expect(() => computeTaxableScholarships({ form1098T: { box1: '-1', box5: '0' } })).toThrow(TaxInputError);
  });

  it('states its assumptions and cites §117 and Pub. 970', () => {
    const r = computeTaxableScholarships({ form1098T: { box1: '1', box5: '2' } });
    expect(r.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(r.citations.map((c) => c.label)).toEqual(expect.arrayContaining(['IRC §117(a), (b)', 'IRC §117(c)(1)']));
  });
});

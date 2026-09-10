import { describe, expect, it } from 'vitest';
import { TaxInputError } from '../money';
import { computeScheduleC } from '../scheduleC';
import { expectMoney } from './helpers';

describe('computeScheduleC', () => {
  it('aggregates expenses by category and applies the per-category rules', () => {
    const r = computeScheduleC({
      grossReceipts: '10000',
      expenses: [
        { category: 'supplies', amount: '600' },
        { category: 'supplies', amount: '400' },
        { category: 'meals', amount: '200' }, // 50%: 100.00 (§274(n)(1))
        { category: 'equipment', amount: '2200' }, // <= $2,500 de minimis: deductible
        { category: 'equipment', amount: '3000' }, // > $2,500: not deducted, needs Form 4562
        { category: 'education_required_materials', amount: '500' }, // §117 offset, not Schedule C
        { category: 'personal', amount: '999' },
        { category: 'health_insurance_premiums', amount: '1200' }, // not modeled
      ],
    });
    const byCat = Object.fromEntries(r.expenseLines.map((l) => [l.category, l]));
    expectMoney(byCat.supplies.entered, '1000.00');
    expectMoney(byCat.supplies.deductible, '1000.00');
    expect(byCat.supplies.scheduleCLine).toBe('22');
    expectMoney(byCat.meals.deductible, '100.00');
    expectMoney(byCat.equipment.entered, '5200.00');
    expectMoney(byCat.equipment.deductible, '2200.00');
    expectMoney(byCat.education_required_materials.deductible, '0.00');
    expectMoney(byCat.personal.deductible, '0.00');
    expectMoney(byCat.health_insurance_premiums.deductible, '0.00');

    // Line 28 = 1,000 + 100 + 2,200 = 3,300; line 29 = 6,700; no home office; line 31 = 6,700
    expectMoney(r.totalExpenses, '3300.00');
    expectMoney(r.tentativeProfit, '6700.00');
    expectMoney(r.homeOfficeDeduction, '0.00');
    expectMoney(r.netProfit, '6700.00');
    expectMoney(r.qualifiedEducationExpenses, '500.00');

    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain('de_minimis_election_required');
    expect(codes).toContain('equipment_requires_depreciation');
    expect(codes).toContain('not_modeled_health_insurance_premiums');
    expect(r.warnings.find((w) => w.code === 'equipment_requires_depreciation')?.amount).toBe('3000.00');
  });

  it('feeds tentative profit (line 29) into the home office limit and subtracts line 30', () => {
    const r = computeScheduleC({
      grossReceipts: '50000',
      expenses: [{ category: 'other_business_expense', amount: '5000' }],
      homeOffice: { totalSquareFeet: '1000', officeSquareFeet: '200', monthlyRent: '0', monthlyUtilities: '0' },
    });
    expectMoney(r.tentativeProfit, '45000.00');
    expect(r.homeOffice?.method).toBe('simplified');
    expectMoney(r.homeOfficeDeduction, '1000.00'); // 200 sq ft x $5
    expectMoney(r.netProfit, '44000.00');
  });

  it('passes a loss through as negative and warns about loss limitation rules', () => {
    const r = computeScheduleC({ grossReceipts: '1000', expenses: [{ category: 'supplies', amount: '5000' }] });
    expectMoney(r.netProfit, '-4000.00');
    expect(r.warnings.map((w) => w.code)).toContain('schedule_c_loss');
  });

  it('ignores rent tagged as a home office expense (the Home Office form is the source) and says so', () => {
    const r = computeScheduleC({ grossReceipts: '1000', expenses: [{ category: 'home_office_expense', amount: '1500' }] });
    expectMoney(r.totalExpenses, '0.00');
    expect(r.warnings.map((w) => w.code)).toContain('home_office_expense_ignored');
  });

  it('rejects unknown categories and negative amounts', () => {
    expect(() => computeScheduleC({ grossReceipts: '1', expenses: [{ category: 'yachts' as never, amount: '1' }] })).toThrow(/unknown category/);
    expect(() => computeScheduleC({ grossReceipts: '-1', expenses: [] })).toThrow(TaxInputError);
    expect(() => computeScheduleC({ grossReceipts: '1', expenses: [{ category: 'supplies', amount: '-5' }] })).toThrow(TaxInputError);
  });

  it('produces Schedule C line references in order', () => {
    const r = computeScheduleC({ grossReceipts: '10000', expenses: [{ category: 'advertising', amount: '100' }] });
    expect(r.lines.map((l) => l.ref)).toEqual([
      'Schedule C line 1',
      'Schedule C line 7',
      'Schedule C line 8',
      'Schedule C line 28',
      'Schedule C line 29',
      'Schedule C line 30',
      'Schedule C line 31',
    ]);
  });
});

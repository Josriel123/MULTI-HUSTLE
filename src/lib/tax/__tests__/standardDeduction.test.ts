import { describe, expect, it } from 'vitest';
import { getTaxYearParameters } from '../parameters';
import { computeStandardDeduction } from '../standardDeduction';
import { expectMoney } from './helpers';

const P2025 = getTaxYearParameters(2025);

describe('computeStandardDeduction', () => {
  it('uses the filing-status amount for a non-dependent (2025: Pub. L. 119-21 amounts)', () => {
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: false, earnedIncome: '0' }, P2025).deduction, '15750.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'married_filing_jointly', claimedAsDependent: false, earnedIncome: '0' }, P2025).deduction, '31500.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'qualifying_surviving_spouse', claimedAsDependent: false, earnedIncome: '0' }, P2025).deduction, '31500.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'head_of_household', claimedAsDependent: false, earnedIncome: '0' }, P2025).deduction, '23625.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'married_filing_separately', claimedAsDependent: false, earnedIncome: '0' }, P2025).deduction, '15750.00');
    expect(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: false, earnedIncome: '0' }, P2025).dependentLimit).toBeNull();
  });

  it('limits a dependent to the greater of $1,350 or earned income + $450, but never above the regular amount (IRC §63(c)(5))', () => {
    // Earned 3,000 + 450 = 3,450 > 1,350
    const some = computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '3000' }, P2025);
    expectMoney(some.deduction, '3450.00');
    expectMoney(some.dependentLimit!.floor, '1350.00');
    // No earned income: the floor
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '0' }, P2025).deduction, '1350.00');
    // Earned 900: 900 + 450 = 1,350 = floor
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '900' }, P2025).deduction, '1350.00');
    // Earned 20,000: 20,450 capped at the regular 15,750
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '20000' }, P2025).deduction, '15750.00');
  });

  it('uses the 2024 floor of $1,300 for 2024', () => {
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '0' }, getTaxYearParameters(2024)).deduction, '1300.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: false, earnedIncome: '0' }, getTaxYearParameters(2024)).deduction, '14600.00');
  });

  it('uses the 2026 amounts for 2026', () => {
    expectMoney(computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: false, earnedIncome: '0' }, getTaxYearParameters(2026)).deduction, '16100.00');
    expectMoney(computeStandardDeduction({ filingStatus: 'head_of_household', claimedAsDependent: false, earnedIncome: '0' }, getTaxYearParameters(2026)).deduction, '24150.00');
  });

  it('cites §63(c)(5) only when the dependent rule was applied', () => {
    const dep = computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: true, earnedIncome: '100' }, P2025);
    expect(dep.citations.map((c) => c.label)).toContain('IRC §63(c)(5)');
    const not = computeStandardDeduction({ filingStatus: 'single', claimedAsDependent: false, earnedIncome: '100' }, P2025);
    expect(not.citations.map((c) => c.label)).not.toContain('IRC §63(c)(5)');
  });
});

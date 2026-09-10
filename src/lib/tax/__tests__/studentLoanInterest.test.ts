import { describe, expect, it } from 'vitest';
import { getTaxYearParameters } from '../parameters';
import { computeStudentLoanInterestDeduction } from '../studentLoanInterest';
import { expectMoney } from './helpers';

const P2025 = getTaxYearParameters(2025);
const base = { filingStatus: 'single' as const, claimedAsDependent: false };

describe('computeStudentLoanInterestDeduction', () => {
  it('caps the deduction at $2,500 (IRC §221(b)(1))', () => {
    const r = computeStudentLoanInterestDeduction({ ...base, interestPaid: '3000', modifiedAgi: '50000' }, P2025);
    expectMoney(r.tentative, '2500.00');
    expectMoney(r.deduction, '2500.00');
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '800', modifiedAgi: '50000' }, P2025).deduction, '800.00');
  });

  it('phases out linearly across $85,000-$100,000 for 2025 single filers (Rev. Proc. 2024-40 §3.30)', () => {
    // Midpoint: (92,500 - 85,000) / 15,000 = 0.5; reduction 2,500 x 0.5 = 1,250
    const mid = computeStudentLoanInterestDeduction({ ...base, interestPaid: '3000', modifiedAgi: '92500' }, P2025);
    expectMoney(mid.phaseout.ratio, '0.50');
    expectMoney(mid.reduction, '1250.00');
    expectMoney(mid.deduction, '1250.00');
    expect(mid.warnings.map((w) => w.code)).toContain('student_loan_interest_phased_out');
    // (88,000 - 85,000) / 15,000 = 0.2; 1,000 x 0.2 = 200 reduction
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '1000', modifiedAgi: '88000' }, P2025).deduction, '800.00');
    // At and above the top of the range: nothing
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '2500', modifiedAgi: '100000' }, P2025).deduction, '0.00');
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '2500', modifiedAgi: '250000' }, P2025).deduction, '0.00');
    // At the bottom of the range: full
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '2500', modifiedAgi: '85000' }, P2025).deduction, '2500.00');
  });

  it('uses the joint range for joint returns: 2024 $165,000-$195,000, 2026 $175,000-$205,000', () => {
    const j24 = computeStudentLoanInterestDeduction({ interestPaid: '2500', modifiedAgi: '180000', filingStatus: 'married_filing_jointly', claimedAsDependent: false }, getTaxYearParameters(2024));
    expectMoney(j24.deduction, '1250.00'); // (180,000 - 165,000) / 30,000 = 0.5
    const j26 = computeStudentLoanInterestDeduction({ interestPaid: '2500', modifiedAgi: '190000', filingStatus: 'married_filing_jointly', claimedAsDependent: false }, getTaxYearParameters(2026));
    expectMoney(j26.deduction, '1250.00'); // (190,000 - 175,000) / 30,000 = 0.5
  });

  it('a surviving spouse is not a joint return and uses the "all other" range', () => {
    const r = computeStudentLoanInterestDeduction({ interestPaid: '2500', modifiedAgi: '92500', filingStatus: 'qualifying_surviving_spouse', claimedAsDependent: false }, P2025);
    expectMoney(r.deduction, '1250.00');
  });

  it('is disallowed for married filing separately (§221(e)(2)) and for dependents (§221(c))', () => {
    const mfs = computeStudentLoanInterestDeduction({ interestPaid: '2500', modifiedAgi: '30000', filingStatus: 'married_filing_separately', claimedAsDependent: false }, P2025);
    expectMoney(mfs.deduction, '0.00');
    expect(mfs.disallowedReason).toBe('married_filing_separately');
    expect(mfs.warnings.map((w) => w.code)).toContain('student_loan_interest_mfs');
    const dep = computeStudentLoanInterestDeduction({ ...base, claimedAsDependent: true, interestPaid: '2500', modifiedAgi: '30000' }, P2025);
    expectMoney(dep.deduction, '0.00');
    expect(dep.disallowedReason).toBe('claimed_as_dependent');
  });

  it('a negative MAGI (business loss) still allows the full deduction', () => {
    expectMoney(computeStudentLoanInterestDeduction({ ...base, interestPaid: '900', modifiedAgi: '-4000' }, P2025).deduction, '900.00');
  });
});

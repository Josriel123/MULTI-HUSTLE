import { describe, expect, it } from 'vitest';
import { buildFederalTaxInput } from '../adapters/prismaRows';
import { NOT_MODELED } from '../disclaimer';
import { estimateFederalTax } from '../engine';
import { computeHomeOffice } from '../homeOffice';
import { getTaxYearParameters } from '../parameters';
import { computeQbiDeduction } from '../qbi';
import { computeScheduleSE } from '../scheduleSE';
import { computeTaxableScholarships } from '../scholarships';
import { expectMoney } from './helpers';

/**
 * Ported from the independent audit of 2026-09-09
 * (docs/audits/federal-tax-2026-09-09/counterexamples.cjs). Expected values
 * are the auditor's, derived from the cited rules without reference to this
 * code. The fix-category cases were added to the suite BEFORE the fixes and
 * failed; see the commit history. F7 and F10 are not ported: TRIAGE.md marks
 * them "document", and the scenarios stay unsupported by design.
 */

const P2025 = getTaxYearParameters(2025);
const P2026 = getTaxYearParameters(2026);
const emptyBusiness = { grossReceipts: '0', expenses: [] as const };

describe('audit F1: partial-year simplified home office', () => {
  it('six qualifying months get half the annual simplified deduction (Pub. 587, part-year use)', () => {
    // (300 sq ft x 6 / 12) x $5 = $750
    const r = computeHomeOffice({ totalSquareFeet: '1000', officeSquareFeet: '300', monthlyRent: '0', monthlyUtilities: '0', monthsUsed: 6 }, '10000');
    expectMoney(r.simplified.beforeLimit, '750.00');
    expectMoney(r.deduction, '750.00');
  });
});

describe('audit F2: W-2 ownership on a joint return', () => {
  const input = {
    taxYear: 2025,
    filingStatus: 'married_filing_jointly' as const,
    scheduleC: { grossReceipts: '100000', expenses: [] },
  };
  const w2 = { wages: '176100', socialSecurityWages: '176100', medicareWages: '176100' };

  it("a joint-return W-2 whose owner is not confirmed does not consume the self-employed spouse's Social Security base, and warns", () => {
    // A: 100,000 x 0.9235 = 92,350; SS 11,451.40 + Medicare 2,678.15 = 14,129.55
    const e = estimateFederalTax({ ...input, w2 });
    expectMoney(e.scheduleSE.selfEmploymentTax, '14129.55');
    expect(e.warnings.map((w) => w.code)).toContain('w2_owner_unconfirmed_joint');
  });

  it('the same W-2 marked as the self-employed spouse\'s own does reduce the base', () => {
    const e = estimateFederalTax({ ...input, w2: { ...w2, ownedByTaxpayer: true } });
    expectMoney(e.scheduleSE.selfEmploymentTax, '2678.15');
    expect(e.warnings.map((w) => w.code)).not.toContain('w2_owner_unconfirmed_joint');
  });

  it('on a non-joint return the W-2 can only be the taxpayer\'s, so no flag is needed', () => {
    const e = estimateFederalTax({ ...input, filingStatus: 'single', w2 });
    expectMoney(e.scheduleSE.selfEmploymentTax, '2678.15');
    expect(e.warnings.map((w) => w.code)).not.toContain('w2_owner_unconfirmed_joint');
  });
});

describe('audit F3: Schedule SE line 8a is W-2 boxes 3 and 7', () => {
  it('Social Security tips exhaust the wage base together with box 3 wages', () => {
    // Box 3 160,000 + box 7 16,100 = 176,100 = 2025 base; gig 20,000 x 0.9235 = 18,470; Medicare only 535.63
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: { grossReceipts: '20000', expenses: [] },
      w2: { wages: '176100', socialSecurityWages: '160000', socialSecurityTips: '16100', medicareWages: '176100' },
    });
    expectMoney(e.scheduleSE.socialSecurityBaseRemaining, '0.00');
    expectMoney(e.scheduleSE.selfEmploymentTax, '535.63');
  });
});

describe('audit F4: Additional Medicare Tax withholding is credited (Form 8959 Part V)', () => {
  it('box 6 in excess of 1.45% of Medicare wages is a payment', () => {
    // 4,075 - 250,000 x 1.45% (3,625) = 450; payments 25,000 + 450 = 25,450
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: emptyBusiness,
      w2: { wages: '250000', socialSecurityWages: '176100', medicareWages: '250000', federalIncomeTaxWithheld: '25000', medicareTaxWithheld: '4075' },
    });
    expectMoney(e.payments.total, '25450.00');
    // The liability side is unchanged: (250,000 - 200,000) x 0.9% = 450
    expectMoney(e.otherTaxes.additionalMedicareTax, '450.00');
  });
});

describe('audit F5: married filing separately when the spouse itemizes', () => {
  it('takes no standard deduction (IRC §63(c)(6)(A); Pub. 501)', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'married_filing_separately',
      spouseItemizes: true,
      scheduleC: emptyBusiness,
      w2: { wages: '50000', socialSecurityWages: '50000', medicareWages: '50000' },
    });
    expectMoney(e.standardDeduction.deduction, '0.00');
    // Tax on 50,000: 5,578.50 + 22% x (50,000 - 48,475) = 5,914.00
    expectMoney(e.incomeTax.tax, '5914.00');
    expect(e.warnings.map((w) => w.code)).toContain('mfs_spouse_itemizes');
  });

  it('when the caller does not say, the deduction is applied and a warning asks (the audit scenario without the new field)', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'married_filing_separately',
      scheduleC: emptyBusiness,
      w2: { wages: '50000', socialSecurityWages: '50000', medicareWages: '50000' },
    });
    expectMoney(e.standardDeduction.deduction, '15750.00');
    expect(e.warnings.map((w) => w.code)).toContain('mfs_spouse_itemizes_unknown');
    // Saying "no" removes the warning.
    const no = estimateFederalTax({ taxYear: 2025, filingStatus: 'married_filing_separately', spouseItemizes: false, scheduleC: emptyBusiness });
    expect(no.warnings.map((w) => w.code)).not.toContain('mfs_spouse_itemizes_unknown');
  });
});

describe('audit F6: kiddie-tax warning', () => {
  it('does not depend on being claimed as a dependent', () => {
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: false, scheduleC: emptyBusiness, scholarships: { form1098T: { box1: '0', box5: '20000' } } });
    expect(e.warnings.map((w) => w.code)).toContain('kiddie_tax_may_apply');
  });

  it('counts unearned income other than scholarships', () => {
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: true, scheduleC: emptyBusiness, otherIncome: '5000' });
    expect(e.warnings.map((w) => w.code)).toContain('kiddie_tax_may_apply');
  });

  it('stays quiet at or under the threshold (2 x $1,350 for 2025)', () => {
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', scheduleC: emptyBusiness, otherIncome: '2700' });
    expect(e.warnings.map((w) => w.code)).not.toContain('kiddie_tax_may_apply');
  });
});

describe('audit F8: §199A(i) minimum deduction', () => {
  it('is $400 for an applicable taxpayer even when pre-QBI taxable income is $100', () => {
    // QBI 1,500 - 105.97 = 1,394.03 >= 1,000; ordinary 20% limited to 20% x 100 = 20; statutory floor 400
    const r = computeQbiDeduction({ netProfit: '1500', deductibleHalfSelfEmploymentTax: '105.97', taxableIncomeBeforeQbi: '100', filingStatus: 'single' }, P2026);
    expectMoney(r.deduction, '400.00');
    expect(r.minimumDeductionApplied).toBe(true);
  });

  it('taxable income still floors at zero, so the uncapped minimum changes no tax', () => {
    const e = estimateFederalTax({ taxYear: 2026, filingStatus: 'single', scheduleC: { grossReceipts: '17000', expenses: [] } });
    // net 17,000; half SE 1,200.86; AGI 15,799.14; std 16,100 -> TI before QBI 0; QBI 15,799.14 >= 1,000 -> minimum 400
    expectMoney(e.qbi.deduction, '400.00');
    expectMoney(e.taxableIncome, '0.00');
  });
});

describe('audit F9: disclosure of prior-year carryforwards', () => {
  it('lists prior-year QBI loss carryforwards, home office carryovers, and the 2026 non-itemizer charitable deduction', () => {
    const text = NOT_MODELED.join('\n');
    expect(text).toMatch(/QBI[^\n]*(?:carryforward|carryover)|(?:carryforward|carryover)[^\n]*QBI/i);
    expect(text).toMatch(/8829[^\n]*(?:carryforward|carryover)|(?:carryforward|carryover)[^\n]*8829/i);
    expect(text).toMatch(/charitable/i);
  });
});

describe('audit F11: scholarship amounts restricted to non-qualified expenses', () => {
  it('a housing-restricted grant is taxable even though tuition was paid separately (Pub. 970)', () => {
    const r = computeTaxableScholarships({ form1098T: { box1: '20000', box5: '10000' }, restrictedToNonQualifiedExpenses: '10000' });
    expectMoney(r.taxable, '10000.00');
  });

  it('only the restricted part is forced taxable; the rest is still allocated to tuition first', () => {
    // 10,000 grant, 3,000 restricted to housing; 7,000 unrestricted against 20,000 tuition -> 0; total taxable 3,000
    const r = computeTaxableScholarships({ form1098T: { box1: '20000', box5: '10000' }, restrictedToNonQualifiedExpenses: '3000' });
    expectMoney(r.taxable, '3000.00');
  });
});

describe('audit controls (auditor-derived expected values)', () => {
  it('SE deduction precedes student-loan MAGI; student-loan deduction precedes the QBI taxable-income cap', () => {
    // 95,000 x 0.9235 = 87,732.50; SS 10,878.83 + Medicare 2,544.24 = 13,423.07; half 6,711.54
    // MAGI 88,288.46; excess 3,288.46 / 15,000; reduction 548.08; deduction 1,951.92; AGI 86,336.54
    // TI before QBI 70,586.54; QBI 88,288.46 -> 20% = 17,657.69, capped at 20% x 70,586.54 = 14,117.31; TI 56,469.23
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', scheduleC: { grossReceipts: '95000', expenses: [] }, studentLoanInterestPaid: '2500' });
    expectMoney(e.adjustments.halfSelfEmploymentTax, '6711.54');
    expectMoney(e.adjustments.studentLoanInterest!.phaseout.modifiedAgi, '88288.46');
    expectMoney(e.adjustments.studentLoanInterest!.deduction, '1951.92');
    expectMoney(e.adjustedGrossIncome, '86336.54');
    expectMoney(e.qbi.qualifiedBusinessIncome, '88288.46');
    expectMoney(e.qbi.deduction, '14117.31');
    expectMoney(e.taxableIncome, '56469.23');
  });

  it('a Schedule C loss offsets W-2 income without negative SE tax', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: { grossReceipts: '1000', expenses: [{ category: 'supplies', amount: '5000' }] },
      w2: { wages: '50000', socialSecurityWages: '50000', medicareWages: '50000' },
    });
    expectMoney(e.adjustedGrossIncome, '46000.00');
    expectMoney(e.taxableIncome, '30250.00');
    expectMoney(e.scheduleSE.selfEmploymentTax, '0.00');
    expectMoney(e.qbi.deduction, '0.00');
    expectMoney(e.totalTax, '3391.50');
  });

  it('below-$400 earnings do not acquire Additional Medicare Tax from high wages', () => {
    const r = computeScheduleSE({ netProfit: '400', filingStatus: 'single', w2SocialSecurityWages: '176100', w2MedicareWages: '300000' }, P2025);
    expectMoney(r.selfEmploymentTax, '0.00');
    expectMoney(r.additionalMedicare.tax, '0.00');
  });

  it('a taxable scholarship raises a dependent\'s standard deduction and creates no SE income', () => {
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: true, scheduleC: emptyBusiness, scholarships: { form1098T: { box1: '0', box5: '4000' } } });
    expectMoney(e.standardDeduction.deduction, '4450.00');
    expectMoney(e.totalTax, '0.00');
    expectMoney(e.scheduleSE.selfEmploymentTax, '0.00');
    expect(e.warnings.map((w) => w.code)).toContain('kiddie_tax_may_apply');
  });

  it('zero input yields zero tax in every supported year and filing status', () => {
    for (const taxYear of [2024, 2025, 2026]) {
      for (const filingStatus of ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household', 'qualifying_surviving_spouse'] as const) {
        const e = estimateFederalTax({ taxYear, filingStatus, scheduleC: emptyBusiness });
        expectMoney(e.totalTax, '0.00');
        expectMoney(e.balanceDue, '0.00');
      }
    }
  });

  it('the adapter still builds a valid input when a refund is present (F10 scenario is documented, not netted)', () => {
    const b = buildFederalTaxInput({
      taxYear: 2025,
      user: { filingStatus: 'single', claimedAsDependent: false },
      transactions: [
        { amount: '10000', type: 'Income', category: 'business_income', taxDeductible: false, date: new Date('2025-01-01T00:00:00Z') },
        { amount: '1000', type: 'Expense', category: 'supplies', taxDeductible: true, date: new Date('2025-02-01T00:00:00Z') },
        { amount: '1000', type: 'Income', category: 'refund', taxDeductible: false, date: new Date('2025-03-01T00:00:00Z') },
      ],
    });
    expect(b.warnings.map((w) => w.code)).toContain('refund_not_netted');
  });
});

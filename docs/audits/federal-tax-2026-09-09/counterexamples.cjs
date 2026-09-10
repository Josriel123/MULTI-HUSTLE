// Audit only. No production changes. Run from the repository:
// node C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs
// Loads the original TypeScript in memory; writes no compiled files.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = process.argv[2] || process.cwd();
const ts = require(path.join(repo, 'node_modules/typescript'));
require.extensions['.ts'] = (mod, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  }, fileName: filename }).outputText;
  mod._compile(js, filename);
};
const tax = (file) => require(path.join(repo, 'src/lib/tax', file));
const { estimateFederalTax } = tax('engine.ts');
const { computeHomeOffice } = tax('homeOffice.ts');
const { computeScheduleC } = tax('scheduleC.ts');
const { computeQbiDeduction } = tax('qbi.ts');
const { computeScheduleSE } = tax('scheduleSE.ts');
const { getTaxYearParameters } = tax('parameters/index.ts');
const { NOT_MODELED } = tax('disclaimer.ts');
const { buildFederalTaxInput } = tax('adapters/prismaRows.ts');
const { computeTaxableScholarships } = tax('scholarships.ts');
const moneyIs = (actual, expected) => assert.equal(actual.toFixed(2), expected);
const emptyBusiness = { grossReceipts: '0', expenses: [] };
const p25 = getTaxYearParameters(2025);

test('F1: six full qualifying months get half the annual simplified home-office deduction', () => {
  // IRS Pub. 587, Part-year use: (300 * 6 / 12) * $5 = $750.
  // https://www.irs.gov/publications/p587
  const r = computeHomeOffice({ totalSquareFeet: '1000', officeSquareFeet: '300',
    monthlyRent: '0', monthlyUtilities: '0', monthsUsed: 6 }, '10000');
  moneyIs(r.deduction, '750.00');
});

test('F2 DOMAIN GAP: joint return, spouse B wages do not consume self-employed spouse A Social Security base', () => {
  // Facts: A has $100,000 business profit and no W-2; B has the only W-2.
  // The input has no wage owner. It cannot distinguish this from A owning both.
  // Schedule SE is individual: https://www.irs.gov/instructions/i1040sse (Joint Returns)
  // A: 100000 * .9235 = 92350; SS=11451.40; Medicare=2678.15; total=14129.55.
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'married_filing_jointly',
    scheduleC: { grossReceipts: '100000', expenses: [] },
    w2: { wages: '176100', socialSecurityWages: '176100', medicareWages: '176100' } });
  moneyIs(e.scheduleSE.selfEmploymentTax, '14129.55');
});

test('F3 DOMAIN GAP: Schedule SE line 8a must include W-2 box 7 tips as well as box 3', () => {
  // Facts: box 3=160000, box 7=16100, boxes 1/5=176100. No input accepts box 7.
  // https://www.irs.gov/pub/irs-pdf/f1040sse.pdf line 8a; wage base fully consumed.
  // Gig net earnings=20000*.9235=18470; SS=0; Medicare=18470*.029=535.63.
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single',
    scheduleC: { grossReceipts: '20000', expenses: [] },
    w2: { wages: '176100', socialSecurityWages: '160000', medicareWages: '176100' } });
  moneyIs(e.scheduleSE.selfEmploymentTax, '535.63');
});

test('F4 DOMAIN GAP: reconcile Additional Medicare withholding from W-2 box 6', () => {
  // Facts: one employer, box 6=4075, box 2=25000. No box-6 input exists.
  // Form 8959 lines 19-24: 4075 - 250000*.0145 = 450 additional withholding.
  // https://www.irs.gov/pub/irs-pdf/f8959.pdf ; 1040 payments=25000+450=25450.
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', scheduleC: emptyBusiness,
    w2: { wages: '250000', socialSecurityWages: '176100', medicareWages: '250000',
      federalIncomeTaxWithheld: '25000' } });
  moneyIs(e.payments.total, '25450.00');
});

test('F5 DOMAIN GAP: MFS spouse itemizes, so this taxpayer cannot claim the standard deduction', () => {
  // Facts: spouse itemizes; this taxpayer has $0 itemized deductions.
  // No input can convey spouse itemization. Pub. 501, MFS Special Rules item 11.
  // https://www.irs.gov/publications/p501
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'married_filing_separately',
    scheduleC: emptyBusiness,
    w2: { wages: '50000', socialSecurityWages: '50000', medicareWages: '50000' } });
  moneyIs(e.standardDeduction.deduction, '0.00');
});

test('F6a: kiddie-tax warning cannot be conditional on dependency status', () => {
  // Facts: 20-year-old full-time student, parent alive, own earned income <= half support,
  // pays more than half own support from existing savings, so not claimable as dependent;
  // taxable scholarship 20000 -> return required. Savings are not current earned income.
  // Form 8615 Who Must File expressly applies whether or not a dependent.
  // https://www.irs.gov/instructions/i8615
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: false,
    scheduleC: emptyBusiness, scholarships: { form1098T: { box1: '0', box5: '20000' } } });
  assert.ok(e.warnings.some(w => w.code === 'kiddie_tax_may_apply'));
});

test('F6b: dependent with $5000 unearned prizes also needs the promised kiddie-tax warning', () => {
  // Facts: 17-year-old, living parent, $5000 non-service prize, filing required.
  // Other unearned income counts, not just scholarships. Same Form 8615 source.
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: true,
    scheduleC: emptyBusiness, otherIncome: '5000' });
  assert.ok(e.warnings.some(w => w.code === 'kiddie_tax_may_apply'));
});

test('F7 DOMAIN GAP: unrelated business profit cannot unlock a loss-making business home-office deduction', () => {
  // Facts: consulting gross 0 / other expenses 5000, sole business qualifying for office;
  // delivery gross 20000 / no expenses and no qualified home office. Combined net=15000.
  // The engine merges them before applying the office income limit.
  // Pub. 587, More Than One Trade or Business and Deduction Limit:
  // https://www.irs.gov/publications/p587
  const r = computeScheduleC({ grossReceipts: '20000',
    expenses: [{ category: 'supplies', amount: '5000' }],
    homeOffice: { totalSquareFeet: '1000', officeSquareFeet: '100',
      monthlyRent: '2500', monthlyUtilities: '0', monthsUsed: 12 } });
  moneyIs(r.netProfit, '15000.00');
});

test('F8: 2026 active-business minimum QBI deduction is $400 even when pre-QBI taxable income is $100', () => {
  // All business QBI is from material participation. Statutory deduction line is $400;
  // final taxable income still floors at $0, so this does not change total tax here.
  // Pub.L.119-21 section 70105 / IRC 199A(i), supported by draft 2026 Form 8995 lines16-17.
  // https://www.govinfo.gov/content/pkg/PLAW-119publ21/pdf/PLAW-119publ21.pdf
  const r = computeQbiDeduction({ netProfit: '1500', deductibleHalfSelfEmploymentTax: '105.97',
    taxableIncomeBeforeQbi: '100', filingStatus: 'single' }, getTaxYearParameters(2026));
  moneyIs(r.deduction, '400.00');
});

test('F9: every-estimate omission list must disclose that prior-year QBI loss carryforwards are unsupported', () => {
  // README says every omitted rule appears here. Current-year loss warning is insufficient
  // when a later profitable year's QBI must be reduced by a prior loss (8995 line3).
  // https://www.irs.gov/pub/irs-pdf/f8995.pdf
  assert.match(NOT_MODELED.join('\n'), /QBI[^\n]*(?:carryforward|carryover)|(?:carryforward|carryover)[^\n]*QBI/i);
});

test('F10 DOMAIN GAP: a fully refunded business purchase cannot remain deductible', () => {
  // Facts: the refund is for this exact supplies purchase, in the same tax year.
  // The adapter cannot link this refund to the purchase, versus a personal refund.
  // IRS Pub. 525, Recovery and expense in same year: reduce the deduction.
  // https://www.irs.gov/publications/p525
  const b = buildFederalTaxInput({ taxYear: 2025,
    user: { filingStatus: 'single', claimedAsDependent: false },
    transactions: [
      { amount: '10000', type: 'Income', category: 'business_income', taxDeductible: false,
        date: new Date('2025-01-01T00:00:00Z') },
      { amount: '1000', type: 'Expense', category: 'supplies', taxDeductible: true,
        date: new Date('2025-02-01T00:00:00Z') },
      { amount: '1000', type: 'Income', category: 'refund', taxDeductible: false,
        date: new Date('2025-03-01T00:00:00Z') },
    ] });
  const e = estimateFederalTax(b.input);
  // Fully reversed expense: 10000 - (1000 - 1000) = 10000.
  moneyIs(e.scheduleC.netProfit, '10000.00');
});

test('F11 DOMAIN GAP: a housing-restricted scholarship cannot be allocated to separately paid tuition', () => {
  // Facts: $10000 grant earmarked exclusively for room/board; tuition $20000 paid separately.
  // No input can represent award restrictions. IRC 117 / Pub. 970 Tax-Free Scholarships:
  // https://www.irs.gov/publications/p970
  const r = computeTaxableScholarships({ form1098T: { box1: '20000', box5: '10000' } });
  moneyIs(r.taxable, '10000.00');
});

// Controls seek sequence/edge failures but passed; expected values are hand-derived.
test('CONTROL: SE deduction before student-loan MAGI; student-loan deduction before QBI taxable-income cap', () => {
  // Profit=95000 -> SE base87732.50; SS10878.83 + Medicare2544.24=13423.07; half6711.54.
  // MAGI=88288.46; phaseout excess3288.46/15000, reduction=548.08; interest deduction1951.92.
  // AGI=86336.54; TI before QBI=70586.54; TI cap=14117.31; QBI tentative=17657.69.
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single',
    scheduleC: { grossReceipts: '95000', expenses: [] }, studentLoanInterestPaid: '2500' });
  moneyIs(e.adjustments.halfSelfEmploymentTax, '6711.54');
  moneyIs(e.adjustments.studentLoanInterest.phaseout.modifiedAgi, '88288.46');
  moneyIs(e.adjustments.studentLoanInterest.deduction, '1951.92');
  moneyIs(e.adjustedGrossIncome, '86336.54');
  moneyIs(e.qbi.qualifiedBusinessIncome, '88288.46');
  moneyIs(e.qbi.deduction, '14117.31');
  moneyIs(e.taxableIncome, '56469.23');
});

test('CONTROL: Schedule C loss offsets W-2 income without negative SE tax', () => {
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single',
    scheduleC: { grossReceipts: '1000', expenses: [{ category: 'supplies', amount: '5000' }] },
    w2: { wages: '50000', socialSecurityWages: '50000', medicareWages: '50000' } });
  moneyIs(e.adjustedGrossIncome, '46000.00');
  moneyIs(e.taxableIncome, '30250.00');
  moneyIs(e.scheduleSE.selfEmploymentTax, '0.00');
  moneyIs(e.qbi.deduction, '0.00');
  moneyIs(e.totalTax, '3391.50');
});

test('CONTROL: below-$400 earnings do not acquire Additional Medicare tax from high wages', () => {
  const r = computeScheduleSE({ netProfit: '400', filingStatus: 'single',
    w2SocialSecurityWages: '176100', w2MedicareWages: '300000' }, p25);
  moneyIs(r.selfEmploymentTax, '0.00');
  moneyIs(r.additionalMedicare.tax, '0.00');
});

test('CONTROL: taxable scholarship increases dependent standard deduction and creates no SE income', () => {
  const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', claimedAsDependent: true,
    scheduleC: emptyBusiness, scholarships: { form1098T: { box1: '0', box5: '4000' } } });
  moneyIs(e.standardDeduction.deduction, '4450.00');
  moneyIs(e.totalTax, '0.00');
  moneyIs(e.scheduleSE.selfEmploymentTax, '0.00');
  assert.ok(e.warnings.some(w => w.code === 'kiddie_tax_may_apply'));
});

test('CONTROL: truly zero input yields zero tax in every supported year and filing status', () => {
  for (const year of [2024,2025,2026]) for (const filingStatus of [
    'single','married_filing_jointly','married_filing_separately','head_of_household','qualifying_surviving_spouse']) {
    const e = estimateFederalTax({ taxYear: year, filingStatus, scheduleC: emptyBusiness });
    moneyIs(e.totalTax, '0.00');
    moneyIs(e.balanceDue, '0.00');
  }
});

import type { Citation } from '../types';
import type { TaxYearParameters } from './types';

/**
 * Tax year 2024 (returns filed in 2025).
 *
 * Primary source: Rev. Proc. 2023-34, 2023-48 I.R.B. 1287 (Nov. 9, 2023),
 * "inflation adjusted items for 2024". Section numbers below refer to it.
 * Every figure was read from the IRS-published text of that document.
 */

const REV_PROC: Citation = {
  label: 'Rev. Proc. 2023-34',
  url: 'https://www.irs.gov/irb/2023-48_IRB',
  note: 'Tax year 2024 inflation adjustments. PDF: https://www.irs.gov/pub/irs-drop/rp-23-34.pdf',
};

export const PARAMETERS_2024: TaxYearParameters = {
  taxYear: 2024,
  sources: [
    REV_PROC,
    {
      label: '2024 Instructions for Schedule SE (Form 1040)',
      url: 'https://www.irs.gov/pub/irs-prior/i1040sse--2024.pdf',
      note: 'Maximum amount of self-employment income subject to Social Security tax for 2024: $168,600.',
    },
    {
      label: 'Notice 2024-08; IR-2023-239 (Dec. 14, 2023)',
      url: 'https://www.irs.gov/tax-professionals/standard-mileage-rates',
      note: 'Business standard mileage rate for 2024: 67 cents per mile.',
    },
  ],

  incomeTaxBrackets: {
    joint: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2023-34 §3.01, Table 1 (Married Individuals Filing Joint Returns and Surviving Spouses)' },
      rows: [
        { upTo: '23200', rate: '0.10' },
        { upTo: '94300', rate: '0.12', taxAtLowerBoundAsPrinted: '2320' },
        { upTo: '201050', rate: '0.22', taxAtLowerBoundAsPrinted: '10852' },
        { upTo: '383900', rate: '0.24', taxAtLowerBoundAsPrinted: '34337' },
        { upTo: '487450', rate: '0.32', taxAtLowerBoundAsPrinted: '78221' },
        { upTo: '731200', rate: '0.35', taxAtLowerBoundAsPrinted: '111357' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '196669.50' },
      ],
    },
    head_of_household: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2023-34 §3.01, Table 2 (Heads of Households)' },
      rows: [
        { upTo: '16550', rate: '0.10' },
        { upTo: '63100', rate: '0.12', taxAtLowerBoundAsPrinted: '1655' },
        { upTo: '100500', rate: '0.22', taxAtLowerBoundAsPrinted: '7241' },
        { upTo: '191950', rate: '0.24', taxAtLowerBoundAsPrinted: '15469' },
        { upTo: '243700', rate: '0.32', taxAtLowerBoundAsPrinted: '37417' },
        { upTo: '609350', rate: '0.35', taxAtLowerBoundAsPrinted: '53977' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '181954.50' },
      ],
    },
    single: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2023-34 §3.01, Table 3 (Unmarried Individuals other than Surviving Spouses and Heads of Households)' },
      rows: [
        { upTo: '11600', rate: '0.10' },
        { upTo: '47150', rate: '0.12', taxAtLowerBoundAsPrinted: '1160' },
        { upTo: '100525', rate: '0.22', taxAtLowerBoundAsPrinted: '5426' },
        { upTo: '191950', rate: '0.24', taxAtLowerBoundAsPrinted: '17168.50' },
        { upTo: '243725', rate: '0.32', taxAtLowerBoundAsPrinted: '39110.50' },
        { upTo: '609350', rate: '0.35', taxAtLowerBoundAsPrinted: '55678.50' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '183647.25' },
      ],
    },
    married_filing_separately: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2023-34 §3.01, Table 4 (Married Individuals Filing Separate Returns)' },
      rows: [
        { upTo: '11600', rate: '0.10' },
        { upTo: '47150', rate: '0.12', taxAtLowerBoundAsPrinted: '1160' },
        { upTo: '100525', rate: '0.22', taxAtLowerBoundAsPrinted: '5426' },
        { upTo: '191950', rate: '0.24', taxAtLowerBoundAsPrinted: '17168.50' },
        { upTo: '243725', rate: '0.32', taxAtLowerBoundAsPrinted: '39110.50' },
        { upTo: '365600', rate: '0.35', taxAtLowerBoundAsPrinted: '55678.50' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '98334.75' },
      ],
    },
  },

  standardDeduction: {
    amounts: {
      married_filing_jointly: '29200',
      qualifying_surviving_spouse: '29200',
      head_of_household: '21900',
      single: '14600',
      married_filing_separately: '14600',
    },
    dependentFloor: '1300',
    dependentEarnedIncomeAddOn: '450',
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2023-34 §3.15',
      note: 'Standard deduction $29,200 joint/surviving spouse, $21,900 head of household, $14,600 unmarried and married filing separately. Dependent: "cannot exceed the greater of (1) $1,300, or (2) the sum of $450 and the individual\'s earned income."',
    },
  },

  selfEmployment: {
    socialSecurityWageBase: '168600',
    citation: {
      label: '2024 Instructions for Schedule SE, line 7; Social Security Act §230',
      url: 'https://www.irs.gov/pub/irs-prior/i1040sse--2024.pdf',
      note: 'Maximum amount of combined wages and self-employment earnings subject to Social Security tax for 2024: $168,600.',
    },
  },

  qbi: {
    threshold: { joint: '383900', marriedFilingSeparately: '191950', other: '191950' },
    phaseInRange: { joint: '100000', marriedFilingSeparately: '50000', other: '50000' },
    minimumDeduction: null,
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2023-34 §3.27 (Qualified Business Income)',
      note: 'Threshold amounts: $383,900 joint; $191,950 separate and all other returns. Phase-in range ends at $483,900 / $241,950, i.e. $100,000 / $50,000 (IRC §199A(b)(3)(B)(ii) before Pub. L. 119-21).',
    },
  },

  studentLoanInterest: {
    phaseout: {
      joint: { start: '165000', end: '195000' },
      other: { start: '80000', end: '95000' },
    },
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2023-34 §3.30 (Interest on Education Loans)',
      note: '"begins to phase out for taxpayers with modified adjusted gross income in excess of $80,000 ($165,000 for joint returns), and is completely phased out for taxpayers with modified adjusted gross income of $95,000 or more ($195,000 or more for joint returns)."',
    },
  },

  kiddieTax: {
    baseAmount: '1300',
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2023-34 §3.02 (Unearned Income of Minor Children)',
      note: 'The §1(g)(4)(A)(ii)(I) amount for 2024 is $1,300; Form 8615 applies when unearned income exceeds twice that.',
    },
  },

  standardMileage: [
    {
      from: '2024-01-01',
      to: '2024-12-31',
      centsPerMile: '67',
      citation: {
        label: 'Notice 2024-08',
        url: 'https://www.irs.gov/pub/irs-drop/n-24-08.pdf',
        note: 'Business standard mileage rate for 2024: 67 cents per mile (IR-2023-239).',
      },
    },
  ],
};

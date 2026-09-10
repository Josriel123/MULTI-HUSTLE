import type { Citation } from '../types';
import type { TaxYearParameters } from './types';

/**
 * Tax year 2025 (returns filed in 2026).
 *
 * Primary source: Rev. Proc. 2024-40, 2024-45 I.R.B. 1100 (Oct. 22, 2024),
 * "inflation adjusted items for 2025". Section numbers below refer to it.
 *
 * One item in Rev. Proc. 2024-40 was superseded by statute: §2.15(1) listed the
 * 2025 standard deduction as $30,000 / $22,500 / $15,000. Public Law 119-21
 * (July 4, 2025), §70102, amended IRC §63(c)(7) to $31,500 / $23,625 / $15,750
 * for taxable years beginning after December 31, 2024. The 2025 Form 1040
 * instructions and IRS newsroom release IR-2025-103 carry the amended amounts,
 * and those are used here; Rev. Proc. 2025-32 §3.01 formally removed §2.15(1)
 * and restated the amended amounts. The dependent amounts ($1,350 / $450) were
 * not changed.
 *
 * Section numbering: Rev. Proc. 2024-40 has no "changes" section, so its
 * adjusted items are SECTION 2 (the 2024 and 2026 Rev. Procs. use Sections 3
 * and 4). An earlier version of this file cited §3.xx; the 2026-09-09 audit
 * caught it.
 */

const REV_PROC: Citation = {
  label: 'Rev. Proc. 2024-40',
  url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf',
  note: 'Tax year 2025 inflation adjustments (2024-45 I.R.B. 1100).',
};

export const PARAMETERS_2025: TaxYearParameters = {
  taxYear: 2025,
  sources: [
    REV_PROC,
    {
      label: 'IRC §63(c)(7) as amended by Pub. L. 119-21 §70102; 2025 Instructions for Form 1040, Standard Deduction Chart',
      url: 'https://www.irs.gov/instructions/i1040gi',
      note: 'Standard deduction for 2025: $15,750 single or married filing separately; $31,500 married filing jointly or qualifying surviving spouse; $23,625 head of household.',
    },
    {
      label: 'Rev. Proc. 2025-32 §3.01, "Removal of Section 2.15(1) of Rev. Proc. 2024-40"',
      url: 'https://www.irs.gov/irb/2025-45_IRB',
      note: '"Section 63(c)(7) as amended by the OBBBA provides the standard deduction amounts under § 63(c)(2) for any taxable year beginning in 2025 as follows: ... $31,500 ... $23,625 ... $15,750 ... $15,750. Accordingly, section 2.15(1) of Rev. Proc. 2024-40 is removed."',
    },
    {
      label: 'IRS newsroom, "IRS releases tax inflation adjustments for tax year 2026, including amendments from the One, Big, Beautiful Bill"',
      url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
      note: '"For tax year 2025, the OBBB raises the standard deduction amount to $31,500 for married couples filing jointly. For single taxpayers and married individuals filing separately, the standard deduction for 2025 is $15,750, and for heads of households, the standard deduction is $23,625."',
    },
    {
      label: '2025 Instructions for Schedule SE (Form 1040)',
      url: 'https://www.irs.gov/instructions/i1040sse',
      note: 'Maximum amount of self-employment income subject to Social Security tax for 2025: $176,100.',
    },
    {
      label: '2025 Instructions for Form 8995',
      url: 'https://www.irs.gov/instructions/i8995',
      note: 'Form 8995 may be used when 2025 taxable income before the QBI deduction is at or below $394,600 (married filing jointly) or $197,300 (all other returns).',
    },
    {
      label: 'Notice 2025-5; IR-2024-312 (Dec. 19, 2024)',
      url: 'https://www.irs.gov/newsroom/irs-increases-the-standard-mileage-rate-for-business-use-in-2025-key-rate-increases-3-cents-to-70-cents-per-mile',
      note: 'Business standard mileage rate for 2025: 70 cents per mile.',
    },
  ],

  incomeTaxBrackets: {
    joint: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2024-40 §2.01, Table 1 (Married Individuals Filing Joint Returns and Surviving Spouses)' },
      rows: [
        { upTo: '23850', rate: '0.10' },
        { upTo: '96950', rate: '0.12', taxAtLowerBoundAsPrinted: '2385' },
        { upTo: '206700', rate: '0.22', taxAtLowerBoundAsPrinted: '11157' },
        { upTo: '394600', rate: '0.24', taxAtLowerBoundAsPrinted: '35302' },
        { upTo: '501050', rate: '0.32', taxAtLowerBoundAsPrinted: '80398' },
        { upTo: '751600', rate: '0.35', taxAtLowerBoundAsPrinted: '114462' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '202154.50' },
      ],
    },
    head_of_household: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2024-40 §2.01, Table 2 (Heads of Households)' },
      rows: [
        { upTo: '17000', rate: '0.10' },
        { upTo: '64850', rate: '0.12', taxAtLowerBoundAsPrinted: '1700' },
        { upTo: '103350', rate: '0.22', taxAtLowerBoundAsPrinted: '7442' },
        { upTo: '197300', rate: '0.24', taxAtLowerBoundAsPrinted: '15912' },
        { upTo: '250500', rate: '0.32', taxAtLowerBoundAsPrinted: '38460' },
        { upTo: '626350', rate: '0.35', taxAtLowerBoundAsPrinted: '55484' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '187031.50' },
      ],
    },
    single: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2024-40 §2.01, Table 3 (Unmarried Individuals other than Surviving Spouses and Heads of Households)' },
      rows: [
        { upTo: '11925', rate: '0.10' },
        { upTo: '48475', rate: '0.12', taxAtLowerBoundAsPrinted: '1192.50' },
        { upTo: '103350', rate: '0.22', taxAtLowerBoundAsPrinted: '5578.50' },
        { upTo: '197300', rate: '0.24', taxAtLowerBoundAsPrinted: '17651' },
        { upTo: '250525', rate: '0.32', taxAtLowerBoundAsPrinted: '40199' },
        { upTo: '626350', rate: '0.35', taxAtLowerBoundAsPrinted: '57231' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '188769.75' },
      ],
    },
    married_filing_separately: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2024-40 §2.01, Table 4 (Married Individuals Filing Separate Returns)' },
      rows: [
        { upTo: '11925', rate: '0.10' },
        { upTo: '48475', rate: '0.12', taxAtLowerBoundAsPrinted: '1192.50' },
        { upTo: '103350', rate: '0.22', taxAtLowerBoundAsPrinted: '5578.50' },
        { upTo: '197300', rate: '0.24', taxAtLowerBoundAsPrinted: '17651' },
        { upTo: '250525', rate: '0.32', taxAtLowerBoundAsPrinted: '40199' },
        { upTo: '375800', rate: '0.35', taxAtLowerBoundAsPrinted: '57231' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '101077.25' },
      ],
    },
  },

  standardDeduction: {
    amounts: {
      married_filing_jointly: '31500',
      qualifying_surviving_spouse: '31500',
      head_of_household: '23625',
      single: '15750',
      married_filing_separately: '15750',
    },
    dependentFloor: '1350',
    dependentEarnedIncomeAddOn: '450',
    citation: {
      label: 'IRC §63(c)(7) as amended by Pub. L. 119-21 §70102 (amounts); Rev. Proc. 2024-40 §2.15(2) (dependent floor and add-on)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      note: '$31,500 joint/surviving spouse, $23,625 head of household, $15,750 unmarried and married filing separately (supersedes the $30,000 / $22,500 / $15,000 in Rev. Proc. 2024-40 §2.15(1)). Dependent: "cannot exceed the greater of (1) $1,350, or (2) the sum of $450 and the individual\'s earned income."',
    },
  },

  selfEmployment: {
    socialSecurityWageBase: '176100',
    citation: {
      label: '2025 Instructions for Schedule SE, line 7; Social Security Act §230',
      url: 'https://www.irs.gov/instructions/i1040sse',
      note: 'Maximum amount of combined wages and self-employment earnings subject to Social Security tax for 2025: $176,100.',
    },
  },

  qbi: {
    threshold: { joint: '394600', marriedFilingSeparately: '197300', other: '197300' },
    phaseInRange: { joint: '100000', marriedFilingSeparately: '50000', other: '50000' },
    minimumDeduction: null,
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2024-40 §2.27 (Qualified Business Income); 2025 Instructions for Form 8995',
      note: 'Threshold amounts: $394,600 joint; $197,300 separate and all other returns. Phase-in range $100,000 / $50,000 (IRC §199A(b)(3)(B)(ii) as in effect for taxable years beginning before 2026).',
    },
  },

  studentLoanInterest: {
    phaseout: {
      joint: { start: '170000', end: '200000' },
      other: { start: '85000', end: '100000' },
    },
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2024-40 §2.30 (Interest on Education Loans); Pub. 970 (2025) ch. 4',
      note: 'Phases out for modified AGI over $85,000 ($170,000 joint); completely phased out at $100,000 ($200,000 joint).',
    },
  },

  kiddieTax: {
    baseAmount: '1350',
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2024-40 §2.02 (Unearned Income of Minor Children)',
      note: '"the amount in § 1(g)(4)(A)(ii)(I), which is used to reduce the net unearned income reported on the child\'s return that is subject to the \'kiddie tax,\' is $1,350."',
    },
  },

  standardMileage: [
    {
      from: '2025-01-01',
      to: '2025-12-31',
      centsPerMile: '70',
      citation: {
        label: 'Notice 2025-5',
        url: 'https://www.irs.gov/pub/irs-drop/n-25-05.pdf',
        note: 'Business standard mileage rate for 2025: 70 cents per mile (IR-2024-312).',
      },
    },
  ],
};

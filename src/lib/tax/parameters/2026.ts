import type { Citation } from '../types';
import type { TaxYearParameters } from './types';

/**
 * Tax year 2026 (returns filed in 2027).
 *
 * Primary source: Rev. Proc. 2025-32, 2025-45 I.R.B. (Oct. 9, 2025),
 * "inflation adjusted items for 2026", the first Rev. Proc. to reflect the
 * amendments made by Public Law 119-21 (the One, Big, Beautiful Bill Act).
 * Section numbers below refer to it (this Rev. Proc. numbers its items under
 * SECTION 4 rather than SECTION 3).
 *
 * 2026 is the first year in which:
 *  - the §199A phase-in range is $75,000 ($150,000 joint) (§199A(b)(3)(B)(ii)
 *    as amended by Pub. L. 119-21 §70105), and
 *  - the §199A(i) minimum deduction of $400 applies to taxpayers with at least
 *    $1,000 of QBI from active trades or businesses.
 * Note that the §199A threshold for married filing separately ($201,775)
 * differs from "all other returns" ($201,750) this year, so the table keeps
 * three rows.
 */

const REV_PROC: Citation = {
  label: 'Rev. Proc. 2025-32',
  url: 'https://www.irs.gov/irb/2025-45_IRB',
  note: 'Tax year 2026 inflation adjustments. PDF: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
};

export const PARAMETERS_2026: TaxYearParameters = {
  taxYear: 2026,
  sources: [
    REV_PROC,
    {
      label: 'IRS newsroom, "IRS releases tax inflation adjustments for tax year 2026, including amendments from the One, Big, Beautiful Bill"',
      url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
      note: '"For tax year 2026, the standard deduction increases to $32,200 for married couples filing jointly. For single taxpayers and married individuals filing separately, the standard deduction rises to $16,100 for tax year 2026, and for heads of households, the standard deduction will be $24,150."',
    },
    {
      label: 'IRS Tax Topic 751, Social Security and Medicare withholding rates',
      url: 'https://www.irs.gov/taxtopics/tc751',
      note: '"For earnings in 2026, this base limit is $184,500."',
    },
    {
      label: 'Notice 2026-10; IR-2025-128 (Dec. 29, 2025)',
      url: 'https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents',
      note: 'Business standard mileage rate from January 1, 2026: 72.5 cents per mile.',
    },
    {
      label: 'Announcement 2026-11, 2026-29 I.R.B. (modifying Notice 2026-10); IR-2026-29',
      url: 'https://www.irs.gov/irb/2026-29_irb',
      note: 'Business standard mileage rate for expenses paid or incurred on or after July 1, 2026: 76 cents per mile.',
    },
  ],

  incomeTaxBrackets: {
    joint: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2025-32 §4.01, Table 1 (Married Individuals Filing Joint Returns and Surviving Spouses)' },
      rows: [
        { upTo: '24800', rate: '0.10' },
        { upTo: '100800', rate: '0.12', taxAtLowerBoundAsPrinted: '2480' },
        { upTo: '211400', rate: '0.22', taxAtLowerBoundAsPrinted: '11600' },
        { upTo: '403550', rate: '0.24', taxAtLowerBoundAsPrinted: '35932' },
        { upTo: '512450', rate: '0.32', taxAtLowerBoundAsPrinted: '82048' },
        { upTo: '768700', rate: '0.35', taxAtLowerBoundAsPrinted: '116896' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '206583.50' },
      ],
    },
    head_of_household: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2025-32 §4.01, Table 2 (Heads of Households)' },
      rows: [
        { upTo: '17700', rate: '0.10' },
        { upTo: '67450', rate: '0.12', taxAtLowerBoundAsPrinted: '1770' },
        { upTo: '105700', rate: '0.22', taxAtLowerBoundAsPrinted: '7740' },
        { upTo: '201750', rate: '0.24', taxAtLowerBoundAsPrinted: '16155' },
        { upTo: '256200', rate: '0.32', taxAtLowerBoundAsPrinted: '39207' },
        { upTo: '640600', rate: '0.35', taxAtLowerBoundAsPrinted: '56631' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '191171' },
      ],
    },
    single: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2025-32 §4.01, Table 3 (Unmarried Individuals other than Surviving Spouses and Heads of Households)' },
      rows: [
        { upTo: '12400', rate: '0.10' },
        { upTo: '50400', rate: '0.12', taxAtLowerBoundAsPrinted: '1240' },
        { upTo: '105700', rate: '0.22', taxAtLowerBoundAsPrinted: '5800' },
        { upTo: '201775', rate: '0.24', taxAtLowerBoundAsPrinted: '17966' },
        { upTo: '256225', rate: '0.32', taxAtLowerBoundAsPrinted: '41024' },
        { upTo: '640600', rate: '0.35', taxAtLowerBoundAsPrinted: '58448' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '192979.25' },
      ],
    },
    married_filing_separately: {
      citation: { ...REV_PROC, label: 'Rev. Proc. 2025-32 §4.01, Table 4 (Married Individuals Filing Separate Returns)' },
      rows: [
        { upTo: '12400', rate: '0.10' },
        { upTo: '50400', rate: '0.12', taxAtLowerBoundAsPrinted: '1240' },
        { upTo: '105700', rate: '0.22', taxAtLowerBoundAsPrinted: '5800' },
        { upTo: '201775', rate: '0.24', taxAtLowerBoundAsPrinted: '17966' },
        { upTo: '256225', rate: '0.32', taxAtLowerBoundAsPrinted: '41024' },
        { upTo: '384350', rate: '0.35', taxAtLowerBoundAsPrinted: '58448' },
        { upTo: null, rate: '0.37', taxAtLowerBoundAsPrinted: '103291.75' },
      ],
    },
  },

  standardDeduction: {
    amounts: {
      married_filing_jointly: '32200',
      qualifying_surviving_spouse: '32200',
      head_of_household: '24150',
      single: '16100',
      married_filing_separately: '16100',
    },
    dependentFloor: '1350',
    dependentEarnedIncomeAddOn: '450',
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2025-32 §4.14',
      note: 'Standard deduction $32,200 joint/surviving spouse, $24,150 head of household, $16,100 unmarried and married filing separately. Dependent: "cannot exceed the greater of (1) $1,350, or (2) the sum of $450 and the individual\'s earned income."',
    },
  },

  selfEmployment: {
    socialSecurityWageBase: '184500',
    citation: {
      label: 'IRS Tax Topic 751; Social Security Act §230 (2026 contribution and benefit base)',
      url: 'https://www.irs.gov/taxtopics/tc751',
      note: '"For earnings in 2026, this base limit is $184,500."',
    },
  },

  qbi: {
    threshold: { joint: '403500', marriedFilingSeparately: '201775', other: '201750' },
    phaseInRange: { joint: '150000', marriedFilingSeparately: '75000', other: '75000' },
    minimumDeduction: {
      amount: '400',
      qbiFloor: '1000',
      citation: {
        label: 'IRC §199A(i), added by Pub. L. 119-21 §70105, effective for taxable years beginning after December 31, 2025',
        url: 'https://www.law.cornell.edu/uscode/text/26/199A',
        note: 'Minimum deduction of $400 for an applicable taxpayer with at least $1,000 of qualified business income from active trades or businesses; both amounts are indexed for years after 2026.',
      },
    },
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2025-32 §4.26 (Qualified Business Income)',
      note: 'Threshold / phase-in range amounts: joint $403,500 / $553,500; married filing separately $201,775 / $276,775; all other returns $201,750 / $276,750. The range widths are therefore $150,000 / $75,000 / $75,000 (IRC §199A(b)(3)(B)(ii) as amended).',
    },
  },

  studentLoanInterest: {
    phaseout: {
      joint: { start: '175000', end: '205000' },
      other: { start: '85000', end: '100000' },
    },
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2025-32 §4.29 (Interest on Education Loans)',
      note: '"begins to phase out ... for taxpayers with modified adjusted gross income in excess of $85,000 ($175,000 for joint returns), and is completely phased out for taxpayers with modified adjusted gross income of $100,000 or more ($205,000 or more for joint returns)."',
    },
  },

  kiddieTax: {
    baseAmount: '1350',
    citation: {
      ...REV_PROC,
      label: 'Rev. Proc. 2025-32 §4.02 (Unearned Income of Minor Children)',
      note: 'The §1(g)(4)(A)(ii)(I) amount for 2026 is $1,350.',
    },
  },

  standardMileage: [
    {
      from: '2026-01-01',
      to: '2026-06-30',
      centsPerMile: '72.5',
      citation: {
        label: 'Notice 2026-10',
        url: 'https://www.irs.gov/pub/irs-drop/n-26-10.pdf',
        note: 'Business standard mileage rate from January 1, 2026: 72.5 cents per mile (IR-2025-128).',
      },
    },
    {
      from: '2026-07-01',
      to: '2026-12-31',
      centsPerMile: '76',
      citation: {
        label: 'Announcement 2026-11 (modifying Notice 2026-10)',
        url: 'https://www.irs.gov/irb/2026-29_irb',
        note: 'Business standard mileage rate for expenses paid or incurred on or after July 1, 2026: 76 cents per mile (IR-2026-29).',
      },
    },
  ],
};

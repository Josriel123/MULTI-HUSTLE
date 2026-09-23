import { SIMPLIFIED_MAX_SQFT, SIMPLIFIED_RATE_PER_SQFT } from './tax/homeOffice';
import { QBI_RATE } from './tax/qbi';
import { ADDITIONAL_MEDICARE_THRESHOLDS, SE_RATES } from './tax/scheduleSE';

/**
 * Plain-English definitions for the tax words the screens use, shown by
 * `<Term>` when someone taps or hovers one.
 *
 * Every rate or amount quoted here is read from the engine's own constants,
 * so a definition can never state a figure the estimate does not use. The
 * definitions describe; they never compute.
 */

const pct = (rate: string) => `${Number((Number(rate) * 100).toFixed(2))}%`;
const dollars = (amount: string) => `$${Number(amount).toLocaleString('en-US')}`;

export interface GlossaryEntry {
  term: string;
  text: string;
}

export const GLOSSARY = {
  estimatedTax: {
    term: 'Estimated federal tax',
    text: 'What this year\'s federal return would show as your total tax, based on everything entered so far: income tax plus self-employment tax. State tax is not included.',
  },
  incomeTax: {
    term: 'Income tax',
    text: 'The main federal tax, charged at rising rates ("brackets") on your taxable income. Only the part of your income inside each bracket is charged that bracket\'s rate.',
  },
  selfEmploymentTax: {
    term: 'Self-employment tax',
    text: `Social Security (${pct(SE_RATES.socialSecurity)}) and Medicare (${pct(SE_RATES.medicare)}) for people who work for themselves, charged on most of your business profit. An employer pays half of this for an employee; on your own you pay both halves, and half of it is then deducted from your income.`,
  },
  additionalMedicare: {
    term: 'Additional Medicare Tax',
    text: `An extra ${pct(SE_RATES.additionalMedicare)} on wages and self-employment income above a threshold that depends on filing status (${dollars(ADDITIONAL_MEDICARE_THRESHOLDS.single)} if single, ${dollars(ADDITIONAL_MEDICARE_THRESHOLDS.married_filing_jointly)} for a joint return).`,
  },
  businessProfit: {
    term: 'Business profit',
    text: 'Your hustle income minus the business costs you can deduct. Tax is figured on this, not on everything you were paid. It is the bottom line of Schedule C.',
  },
  scheduleC: {
    term: 'Schedule C',
    text: 'The page of the federal return where self-employed people report business income and costs. All your hustles are combined on one Schedule C here.',
  },
  deductible: {
    term: 'Deductible',
    text: 'A business cost you can subtract from your hustle income, so you pay tax on less. Personal spending is never deductible.',
  },
  standardDeduction: {
    term: 'Standard deduction',
    text: 'A fixed amount taken off everyone\'s income before income tax is figured. It depends on your filing status. This estimate always uses it rather than itemizing.',
  },
  qbi: {
    term: 'Qualified business income deduction',
    text: `A deduction for owners of small businesses: generally ${pct(QBI_RATE)} of business profit, limited by your taxable income (IRC §199A). It lowers income tax only, not self-employment tax.`,
  },
  agi: {
    term: 'Adjusted gross income',
    text: 'Your total income minus a few adjustments, such as half of your self-employment tax and student loan interest.',
  },
  taxableIncome: {
    term: 'Taxable income',
    text: 'What is left after the standard deduction and the business income deduction. The income tax brackets apply to this.',
  },
  effectiveRate: {
    term: 'Effective rate',
    text: 'Your total federal tax as a share of your total income. Usually far lower than your top bracket, because lower brackets apply first.',
  },
  withholding: {
    term: 'Withholding',
    text: 'Tax an employer takes out of each paycheck and sends to the IRS for you. It is box 2 of your W-2.',
  },
  estimatedPayments: {
    term: 'Estimated tax payments',
    text: 'Payments you send the IRS during the year (Form 1040-ES) because nobody withholds tax from hustle income. They are usually due in April, June, September and January.',
  },
  paidSoFar: {
    term: 'Paid so far',
    text: 'Tax already on its way to the IRS: withholding from any W-2 job plus estimated payments you have made for this tax year.',
  },
  leftToPay: {
    term: 'Left to pay',
    text: 'Estimated tax minus what you have already paid. If you have paid more than you owe, the difference would come back as a refund.',
  },
  safeToSpend: {
    term: 'Safe to spend',
    text: 'Your hustle income, minus everything you spent, minus the tax still to pay. Money already sent to the IRS counts as spent. A refund is not counted until it arrives.',
  },
  filingStatus: {
    term: 'Filing status',
    text: 'How you file your return: single, married filing jointly, and so on. It sets your tax brackets and your standard deduction.',
  },
  standardMileage: {
    term: 'Standard mileage rate',
    text: 'A set amount per business mile, announced by the IRS, that covers gas, wear and insurance. You use either this or your actual car costs for a car in a year, not both.',
  },
  w2: {
    term: 'W-2',
    text: 'The form an employer sends each January showing a year\'s wages and the tax taken out of them. Before it arrives, your latest pay stub\'s year-to-date figures are a good stand-in.',
  },
  form1098T: {
    term: 'Form 1098-T',
    text: 'The form your school sends showing tuition paid (box 1) and scholarships or grants received (box 5).',
  },
  form1098E: {
    term: 'Form 1098-E',
    text: 'The form your student loan servicer sends showing the interest you paid in the year (box 1).',
  },
  homeOffice: {
    term: 'Home office deduction',
    text: `Part of your rent and utilities, when a part of your home is used only and regularly for your business. The simplified method allows ${dollars(SIMPLIFIED_RATE_PER_SQFT)} per square foot, up to ${SIMPLIFIED_MAX_SQFT} square feet; the regular method uses your actual costs. The estimate picks the larger.`,
  },
  uncategorised: {
    term: 'Needs a category',
    text: 'The category is what decides how a transaction is taxed. Until you choose one, money in is counted as business income and money out as personal (not deducted), which can only make the estimate higher.',
  },
  hustle: {
    term: 'Hustle',
    text: 'One of your income sources: a gig app, a freelance client, a shop. Hustles only group your income for the overview; the category decides the tax.',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

/**
 * The five filing statuses, described for someone choosing one. A summary of
 * the IRS tests, not the tests themselves; the profile page links the IRS's
 * own interactive check for anyone unsure.
 */
export const FILING_STATUS_INFO = {
  single: {
    label: 'Single',
    text: 'Not married on December 31, and not filing as head of household.',
  },
  married_filing_jointly: {
    label: 'Married filing jointly',
    text: 'Married, and you and your spouse file one return together. Usually the lowest tax for a couple.',
  },
  married_filing_separately: {
    label: 'Married filing separately',
    text: 'Married, but each of you files your own return.',
  },
  head_of_household: {
    label: 'Head of household',
    text: 'Unmarried, and you paid more than half the cost of keeping up a home for a qualifying person, such as your child.',
  },
  qualifying_surviving_spouse: {
    label: 'Qualifying surviving spouse',
    text: 'Your spouse died in the last two years, you have not remarried, and a dependent child lives with you.',
  },
} as const;

export const FILING_STATUS_HELP_URL = 'https://www.irs.gov/help/ita/what-is-my-filing-status';

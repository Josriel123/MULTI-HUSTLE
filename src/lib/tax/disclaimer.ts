import type { FilingStatus } from './types';

/**
 * The disclaimer that must appear wherever a liability figure from this
 * engine is shown. It is part of the engine's output (see `engine.ts`) so
 * that no caller can display a number without also receiving the text that
 * qualifies it.
 */
export const DISCLAIMER =
  'This is an estimate for planning, not tax advice and not a tax return. It applies federal rules to the ' +
  'information entered in this app and leaves out anything it was not given (see "not modeled"). Your actual tax ' +
  'may be higher or lower. State and local taxes are not included. Confirm with a tax professional or IRS Free File ' +
  'before making decisions based on it.';

export function disclaimerFor(taxYear: number, filingStatus: FilingStatus): string {
  return `${DISCLAIMER} Computed for tax year ${taxYear} as ${filingStatus.replace(/_/g, ' ')}.`;
}

/**
 * Rules the engine knowingly leaves out. Each one would change the number for
 * some taxpayers. Listed so the reader can judge whether one applies to them.
 */
export const NOT_MODELED: readonly string[] = [
  'Tax credits of any kind: earned income credit (IRC §32), child tax credit (§24), education credits (§25A), saver\'s credit (§25B), premium tax credit (§36B). Credits reduce tax dollar for dollar, so the real liability may be well below this estimate.',
  'Itemized deductions (Schedule A). The standard deduction is always used.',
  'W-2 wages, withholding, and estimated tax payments, unless supplied directly to the engine; bank deposits of paychecks are never treated as wages.',
  'Capital gains and losses (Schedule D), dividends, interest, and other investment income. Deposits from investment sales are excluded, not taxed.',
  'Depreciation and §179 expensing (Form 4562) for equipment costing more than the $2,500 de minimis amount.',
  'Self-employed health insurance deduction (§162(l)) and retirement plan contributions (§219, §404).',
  'Vehicle expenses: mileage must be logged (Schedule C Part IV); it is never inferred from income.',
  'Loss limitations: at-risk (§465), passive activity (§469), hobby loss (§183), excess business loss (§461(l)).',
  'Kiddie tax (Form 8615) for dependents under 24 with unearned income, including taxable scholarships, over the threshold. A warning is raised when it may apply.',
  'Alternative minimum tax (Form 6251) and net investment income tax (Form 8960).',
  'Additional standard deduction for age 65 or over or blindness (§63(f)), and the temporary senior, tips, overtime and car-loan-interest deductions added by Pub. L. 119-21.',
  'Estimated tax penalty (§6654) and the timing of quarterly payments.',
  'Household employment taxes (Schedule H), first-time homebuyer or other recapture taxes.',
  'State and local income tax.',
  'Specified service trade or business status and the W-2 wage / UBIA limits under §199A above the threshold (assumed: no employees, no depreciable property).',
];

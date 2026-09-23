import type { FilingStatus } from './types';

/**
 * The disclaimer that must appear wherever a liability figure from this
 * engine is shown. It is part of the engine's output (see `engine.ts`) so
 * that no caller can display a number without also receiving the text that
 * qualifies it.
 */
export const DISCLAIMER =
  'This is an estimate for planning, not tax advice and not a tax return. It applies federal rules to the ' +
  'information entered in this app and leaves out anything it was not given. The "not modeled" list names the ' +
  'rules it is known to leave out and is not exhaustive. Your actual tax may be higher or lower. State and local ' +
  'taxes are not included. Confirm with a tax professional or IRS Free File before making decisions based on it.';

export function disclaimerFor(taxYear: number, filingStatus: FilingStatus): string {
  return `${DISCLAIMER} Computed for tax year ${taxYear} as ${filingStatus.replace(/_/g, ' ')}.`;
}

/**
 * Rules the engine is KNOWN to leave out. Each one would change the number for
 * some taxpayers. Listed so the reader can judge whether one applies to them.
 * The list is maintained, not exhaustive: the tax code is larger than any
 * list of what a small engine omits, and a rule absent from this list is not
 * thereby modeled.
 */
export const NOT_MODELED: readonly string[] = [
  'Tax credits of any kind: earned income credit (IRC §32), child tax credit (§24), education credits (§25A), saver\'s credit (§25B), premium tax credit (§36B). Credits reduce tax dollar for dollar, so the real liability may be well below this estimate.',
  'Itemized deductions (Schedule A). The standard deduction is always used, except that a married-filing-separately filer whose spouse itemizes gets none (§63(c)(6)(A)) when that fact is supplied.',
  'The 2026 deduction for cash charitable contributions by taxpayers who do not itemize, up to $1,000 ($2,000 on a joint return) (IRC §170(p), added by Pub. L. 119-21 §70424; IRS Topic 506).',
  'Wages from anything but a W-2 entered in the app: bank deposits of paychecks are never treated as wages. Schedule SE lines 8b-8c (unreported tips, Form 4137; wages on Form 8919) are not modeled.',
  'The credit for excess Social Security tax withheld when two or more employers together withheld on more than the wage base (Schedule 3 line 11). A warning gives the approximate amount; the estimate does not subtract it.',
  'Per-spouse self-employment on a joint return: one self-employed individual is modeled. A W-2 on a joint return reduces that person\'s Social Security base only when it is marked as theirs; a second self-employed spouse needs a second Schedule SE that this engine does not compute.',
  'Capital gains and losses (Schedule D), dividends, interest, and other investment income. Deposits from investment sales are excluded, not taxed.',
  'Depreciation and §179 expensing (Form 4562) for equipment costing more than the $2,500 de minimis amount.',
  'Self-employed health insurance deduction (§162(l)) and retirement plan contributions (§219, §404).',
  'Vehicle expenses: mileage must be logged (Schedule C Part IV); it is never inferred from income.',
  'Loss limitations: at-risk (§465), passive activity (§469), hobby loss (§183), excess business loss (§461(l)).',
  'Prior-year carryforwards of any kind: a qualified business loss carried forward from an earlier year (Form 8995 line 3; IRC §199A(c)(2)) and home office expenses carried over from an earlier year (Form 8829 lines 25 and 31). Each year is estimated on its own; a profitable year after a loss year will show too large a QBI deduction.',
  'Per-business home office limits: all activity is one Schedule C, so the home office deduction is capped at the combined profit of every business rather than the profit of the business that actually uses the office (Pub. 587, "More Than One Trade or Business"). When the office serves only one of several businesses the deduction can be overstated.',
  'Refunds of deducted business expenses: a deposit categorised as a refund is excluded from income but does not reduce the expense it reverses (Pub. 525, "Recovery and expense in same year"). Reduce that expense yourself.',
  'Kiddie tax (Form 8615): for a child under 18, or under 24 if a student whose earned income was not more than half their support, unearned income (including taxable scholarships not on a W-2) over the threshold is taxed at the parents\' rate, whether or not the child is claimed as a dependent. Ages are unknown, so a conditional warning is raised whenever unearned income exceeds the threshold.',
  'Alternative minimum tax (Form 6251) and net investment income tax (Form 8960).',
  'Additional standard deduction for age 65 or over or blindness (§63(f)), and the temporary senior, tips, overtime and car-loan-interest deductions added by Pub. L. 119-21.',
  'Estimated tax penalty (§6654) and the timing of quarterly payments.',
  'Household employment taxes (Schedule H), first-time homebuyer or other recapture taxes.',
  'State and local income tax.',
  'Specified service trade or business status and the W-2 wage / UBIA limits under §199A above the threshold (assumed: no employees, no depreciable property). The §199A(i) minimum deduction assumes material participation.',
];

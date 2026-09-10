import type { Citation } from './types';

/**
 * Transaction categories and their federal tax treatment.
 *
 * This replaces the previous approach of guessing tax treatment from words in
 * the bank description ("amazon", "chegg", "loan"). A description is not
 * evidence of anything: an Amazon charge may be a business supply, a required
 * textbook, or a personal purchase, and only the taxpayer knows which. The
 * category is stored on `Transaction.category` and set by the user (or, later,
 * by a reviewed import mapping). The engine never reads descriptions.
 *
 * Each category carries the authority for its treatment so the mapping itself
 * can be audited, not just the arithmetic downstream of it.
 */

export type IncomeTreatment =
  /** Schedule C line 1 gross receipts; subject to income tax and self-employment tax. */
  | 'schedule_c_gross_receipts'
  /** Schedule 1 line 8z other income; income tax only, no SE tax. */
  | 'other_income'
  /** Not gross income. Left out of every total. */
  | 'excluded'
  /** Would be taxable under rules this engine does not model; excluded and flagged. */
  | 'excluded_not_modeled';

export type ExpenseTreatment =
  /** Deductible on the given Schedule C line (subject to `deductibleFraction`). */
  | 'schedule_c_expense'
  /** Deductible on Schedule C line 27a only up to the §1.263(a)-1(f) de minimis amount per item; larger items need depreciation (not modeled). */
  | 'schedule_c_de_minimis_equipment'
  /** Offsets scholarship income under §117(b)(2)(B); not a Schedule C deduction. */
  | 'qualified_education_expense'
  /** Not deductible (personal, or already reflected in another form). */
  | 'excluded'
  /** Deductible under rules this engine does not model; excluded and flagged. */
  | 'excluded_not_modeled';

export interface IncomeCategoryDefinition {
  label: string;
  treatment: IncomeTreatment;
  citation: Citation;
}

export interface ExpenseCategoryDefinition {
  label: string;
  treatment: ExpenseTreatment;
  /** Schedule C line, when `treatment` is a Schedule C treatment. */
  scheduleCLine?: string;
  /** Fraction deductible as a decimal string. Defaults to "1". Meals are "0.5" (§274(n)(1)). */
  deductibleFraction?: string;
  citation: Citation;
}

const SCHEDULE_C_INSTRUCTIONS: Citation = {
  label: '2025 Instructions for Schedule C (Form 1040), Part II Expenses',
  url: 'https://www.irs.gov/instructions/i1040sc',
};

export const INCOME_CATEGORIES = {
  business_income: {
    label: 'Business income (gig, freelance, contract)',
    treatment: 'schedule_c_gross_receipts',
    citation: {
      label: 'Schedule C line 1; IRC §61(a)(2), §1402(a)',
      url: 'https://www.irs.gov/instructions/i1040sc',
      note: 'Gross receipts or sales from a trade or business carried on as a sole proprietor.',
    },
  },
  other_taxable_income: {
    label: 'Other taxable income not from a business (prizes, hobby income)',
    treatment: 'other_income',
    citation: {
      label: 'Schedule 1 (Form 1040) line 8z; IRC §61(a)',
      url: 'https://www.irs.gov/instructions/i1040gi',
      note: 'Not earnings from self-employment, so no Schedule SE.',
    },
  },
  loan_proceeds: {
    label: 'Loan disbursement (student loan, personal loan)',
    treatment: 'excluded',
    citation: {
      label: 'Commissioner v. Tufts, 461 U.S. 300, 307 (1983)',
      url: 'https://supreme.justia.com/cases/federal/us/461/300/',
      note: '"Because of this obligation [to repay], the loan proceeds do not qualify as income to the taxpayer."',
    },
  },
  transfer: {
    label: 'Transfer between your own accounts',
    treatment: 'excluded',
    citation: {
      label: 'Commissioner v. Glenshaw Glass Co., 348 U.S. 426, 431 (1955)',
      url: 'https://supreme.justia.com/cases/federal/us/348/426/',
      note: 'Income requires an "accession to wealth"; moving your own money is not one.',
    },
  },
  refund: {
    label: 'Refund or reimbursement of your own money',
    treatment: 'excluded',
    citation: {
      label: 'Commissioner v. Glenshaw Glass Co., 348 U.S. 426, 431 (1955)',
      url: 'https://supreme.justia.com/cases/federal/us/348/426/',
      note: 'A return of the purchase price is not an accession to wealth. (A refund of an expense already deducted should instead reduce that expense; not modeled.)',
    },
  },
  gift: {
    label: 'Gift received',
    treatment: 'excluded',
    citation: {
      label: 'IRC §102(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/102',
      note: 'Gross income does not include the value of property acquired by gift.',
    },
  },
  scholarship_refund: {
    label: 'Scholarship / financial-aid refund from your school',
    treatment: 'excluded',
    citation: {
      label: 'IRC §117; Pub. 970 ch. 1',
      url: 'https://www.irs.gov/publications/p970',
      note: 'Scholarship taxability is computed from Form 1098-T (Box 5 less qualified expenses). Counting the bank deposit as well would tax the same dollars twice.',
    },
  },
  investment_proceeds: {
    label: 'Sale of stock, crypto, or other investments',
    treatment: 'excluded_not_modeled',
    citation: {
      label: 'IRC §1001, §1(h); Schedule D',
      url: 'https://www.irs.gov/instructions/i1040sd',
      note: 'Only the gain (proceeds minus basis) is taxable, at capital-gain rates, and never as self-employment income. Basis is unknown here, so nothing is counted.',
    },
  },
  w2_paycheck: {
    label: 'Paycheck from an employer (W-2 job)',
    treatment: 'excluded_not_modeled',
    citation: {
      label: 'Form 1040 line 1a; Form W-2 boxes 1–6',
      url: 'https://www.irs.gov/instructions/i1040gi',
      note: 'A net paycheck deposit understates wages and omits withholding. Wages must come from the W-2 itself.',
    },
  },
} as const satisfies Record<string, IncomeCategoryDefinition>;

export const EXPENSE_CATEGORIES = {
  advertising: { label: 'Advertising', treatment: 'schedule_c_expense', scheduleCLine: '8', citation: SCHEDULE_C_INSTRUCTIONS },
  car_and_truck: {
    label: 'Car and truck expenses (actual costs: gas, repairs, insurance)',
    treatment: 'schedule_c_expense',
    scheduleCLine: '9',
    citation: {
      ...SCHEDULE_C_INSTRUCTIONS,
      note: 'Actual-expense method. Do not also claim the standard mileage rate for the same vehicle (Rev. Proc. 2019-46 §4). Mileage is entered separately.',
    },
  },
  commissions_and_fees: { label: 'Commissions and fees (platform fees, payment processing)', treatment: 'schedule_c_expense', scheduleCLine: '10', citation: SCHEDULE_C_INSTRUCTIONS },
  contract_labor: { label: 'Contract labor paid to others', treatment: 'schedule_c_expense', scheduleCLine: '11', citation: SCHEDULE_C_INSTRUCTIONS },
  insurance: { label: 'Business insurance (not health)', treatment: 'schedule_c_expense', scheduleCLine: '15', citation: SCHEDULE_C_INSTRUCTIONS },
  interest: { label: 'Business loan or credit-card interest', treatment: 'schedule_c_expense', scheduleCLine: '16b', citation: SCHEDULE_C_INSTRUCTIONS },
  legal_and_professional: { label: 'Legal and professional services', treatment: 'schedule_c_expense', scheduleCLine: '17', citation: SCHEDULE_C_INSTRUCTIONS },
  office_expense: { label: 'Office expense', treatment: 'schedule_c_expense', scheduleCLine: '18', citation: SCHEDULE_C_INSTRUCTIONS },
  rent_or_lease: { label: 'Rent or lease of equipment or business property (not your home)', treatment: 'schedule_c_expense', scheduleCLine: '20b', citation: SCHEDULE_C_INSTRUCTIONS },
  repairs_and_maintenance: { label: 'Repairs and maintenance', treatment: 'schedule_c_expense', scheduleCLine: '21', citation: SCHEDULE_C_INSTRUCTIONS },
  supplies: { label: 'Supplies', treatment: 'schedule_c_expense', scheduleCLine: '22', citation: SCHEDULE_C_INSTRUCTIONS },
  taxes_and_licenses: { label: 'Business taxes and licenses', treatment: 'schedule_c_expense', scheduleCLine: '23', citation: SCHEDULE_C_INSTRUCTIONS },
  travel: { label: 'Business travel (lodging, airfare)', treatment: 'schedule_c_expense', scheduleCLine: '24a', citation: SCHEDULE_C_INSTRUCTIONS },
  meals: {
    label: 'Business meals',
    treatment: 'schedule_c_expense',
    scheduleCLine: '24b',
    deductibleFraction: '0.5',
    citation: {
      label: 'IRC §274(n)(1); Schedule C line 24b instructions',
      url: 'https://www.law.cornell.edu/uscode/text/26/274',
      note: '"In most cases, you can deduct only 50% of your business meal expenses."',
    },
  },
  utilities: { label: 'Business utilities (business phone line, business internet)', treatment: 'schedule_c_expense', scheduleCLine: '25', citation: SCHEDULE_C_INSTRUCTIONS },
  software_and_subscriptions: { label: 'Software and subscriptions', treatment: 'schedule_c_expense', scheduleCLine: '27a', citation: SCHEDULE_C_INSTRUCTIONS },
  other_business_expense: { label: 'Other business expense', treatment: 'schedule_c_expense', scheduleCLine: '27a', citation: SCHEDULE_C_INSTRUCTIONS },
  equipment: {
    label: 'Equipment and hardware (computers, phones, tools)',
    treatment: 'schedule_c_de_minimis_equipment',
    scheduleCLine: '27a',
    citation: {
      label: 'Treas. Reg. §1.263(a)-1(f)(1)(ii)(D) as modified by Notice 2015-82',
      url: 'https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations',
      note: 'A taxpayer without an applicable financial statement may elect to deduct items costing $2,500 or less per invoice (or item). Requires an election statement with the return. Larger items must be depreciated or expensed under §179 (Form 4562), not modeled.',
    },
  },
  home_office_expense: {
    label: 'Rent or utilities for your home',
    treatment: 'excluded',
    citation: {
      label: 'Form 8829 / Rev. Proc. 2013-13',
      url: 'https://www.irs.gov/instructions/i8829',
      note: 'The home office deduction is computed from the Home Office form (square footage and monthly costs). Deducting the same rent here too would double count.',
    },
  },
  education_required_materials: {
    label: 'Books, supplies, equipment required for your courses',
    treatment: 'qualified_education_expense',
    citation: {
      label: 'IRC §117(b)(2)(B); Pub. 970 ch. 1',
      url: 'https://www.law.cornell.edu/uscode/text/26/117',
      note: '"fees, books, supplies, and equipment required for courses of instruction" are qualified tuition and related expenses that a scholarship may cover tax-free.',
    },
  },
  education_tuition_fees: {
    label: 'Tuition and fees paid to your school',
    treatment: 'excluded',
    citation: {
      label: 'Form 1098-T Box 1',
      url: 'https://www.irs.gov/instructions/i1098et',
      note: 'Box 1 already reports payments received for qualified tuition and related expenses from all sources, so these payments are counted through the 1098-T, not again here.',
    },
  },
  student_loan_payment: {
    label: 'Student loan payment',
    treatment: 'excluded',
    citation: {
      label: 'IRC §221; Form 1098-E Box 1',
      url: 'https://www.irs.gov/instructions/i1098et',
      note: 'Principal is never deductible. The interest portion is deducted from Form 1098-E Box 1, not from the payment amount.',
    },
  },
  health_insurance_premiums: {
    label: 'Health insurance premiums',
    treatment: 'excluded_not_modeled',
    citation: {
      label: 'IRC §162(l); Schedule 1 line 17',
      url: 'https://www.law.cornell.edu/uscode/text/26/162',
      note: 'The self-employed health insurance deduction depends on months of eligibility for an employer plan and is limited to net business earnings; not modeled.',
    },
  },
  retirement_contribution: {
    label: 'Retirement contribution (SEP, solo 401(k), IRA)',
    treatment: 'excluded_not_modeled',
    citation: {
      label: 'IRC §219, §404(h); Schedule 1 lines 16 and 20',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      note: 'Contribution limits depend on plan type and compensation; not modeled.',
    },
  },
  personal: {
    label: 'Personal (not deductible)',
    treatment: 'excluded',
    citation: {
      label: 'IRC §262(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/262',
      note: 'No deduction for personal, living, or family expenses.',
    },
  },
} as const satisfies Record<string, ExpenseCategoryDefinition>;

export type IncomeCategory = keyof typeof INCOME_CATEGORIES;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export type TransactionCategory = IncomeCategory | ExpenseCategory;

export function isIncomeCategory(value: unknown): value is IncomeCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(INCOME_CATEGORIES, value);
}

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORIES, value);
}

/**
 * Treatment when a transaction has no category yet.
 *
 * Income defaults to business income, because that is what a gig worker's
 * deposits usually are, and because the alternative (silently dropping
 * uncategorised deposits) would understate the estimate, which is the failure
 * mode this app exists to prevent. The engine reports the uncategorised total
 * as a warning so the UI can ask.
 *
 * Expenses default to deductible only when the user marked them
 * `taxDeductible`; everything else is personal. An unmarked expense is not
 * evidence of a business purpose.
 */
export const DEFAULT_INCOME_CATEGORY: IncomeCategory = 'business_income';
export const DEFAULT_DEDUCTIBLE_EXPENSE_CATEGORY: ExpenseCategory = 'other_business_expense';
export const DEFAULT_NONDEDUCTIBLE_EXPENSE_CATEGORY: ExpenseCategory = 'personal';

/** De minimis safe harbor per-item limit for taxpayers without an applicable financial statement (Notice 2015-82). */
export const DE_MINIMIS_SAFE_HARBOR_LIMIT = '2500';

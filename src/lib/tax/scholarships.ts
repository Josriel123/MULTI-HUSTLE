import { isAboveZero, nonNegativeMoney, notBelowZero, TaxInputError, ZERO, type Money, type MoneyInput } from './money';
import type { Citation, Line, Warning } from './types';

/**
 * Taxable scholarships and grants: IRC §117; Pub. 970 ch. 1.
 *
 * A scholarship is excluded from income only to the extent it pays "qualified
 * tuition and related expenses": tuition and fees required for enrollment, and
 * "fees, books, supplies, and equipment required for courses of instruction"
 * (§117(b)(2)). Anything beyond that, typically the part that covers room,
 * board, and living costs, is taxable and is reported on Schedule 1 line 8r.
 * It is not earnings from self-employment, so Schedule SE never sees it.
 *
 * Inputs come from Form 1098-T: Box 5 (scholarships or grants) and Box 1
 * (payments received for qualified tuition and related expenses), plus any
 * required course materials the student paid for directly, which the school
 * does not report.
 *
 *   taxable = restricted + max(0, (Box 5 - restricted) - Box 1 - required course materials)
 *
 * where `restricted` is the part of the grant its own terms earmark for
 * non-qualified expenses such as room and board. That part is taxable no
 * matter how much tuition was paid (Pub. 970 ch. 1: tax free only if the grant
 * "isn't designated or earmarked for other purposes"). Only the unrestricted
 * remainder may be allocated to tuition first.
 *
 * This is an estimate with known simplifications, each surfaced as an
 * assumption:
 *  - Box 1 is treated as the amount of qualified tuition the scholarship
 *    covered. Box 1 actually reports payments from all sources, so if the
 *    student also paid tuition out of pocket the scholarship may have covered
 *    less tuition than Box 1 shows; an unrestricted scholarship may be
 *    allocated to tuition first (Pub. 970 ch. 1, Worksheet 1-1), so this is
 *    the taxpayer-favourable but permitted reading for the unrestricted part.
 *  - The student is assumed to be a degree candidate at an eligible
 *    institution (§117(a)) with no service requirement attached (§117(c)).
 *  - Electing to treat more of the scholarship as taxable in order to claim an
 *    education credit (Pub. 970 ch. 2, "Coordination") is not modeled; no
 *    credits are.
 */

export interface ScholarshipInput {
  form1098T: {
    /** Box 1: payments received for qualified tuition and related expenses. */
    box1: MoneyInput;
    /** Box 5: scholarships or grants. */
    box5: MoneyInput;
  };
  /** Books, supplies and equipment required for courses, paid by the student (§117(b)(2)(B)). */
  requiredCourseMaterials?: MoneyInput;
  /**
   * The part of Box 5 that the grant's own terms designate or earmark for
   * non-qualified expenses (room and board, travel), or that by its terms
   * cannot be used for qualified expenses. Taxable regardless of how much
   * tuition was paid (Pub. 970 ch. 1, tax-free conditions). Default 0.
   */
  restrictedToNonQualifiedExpenses?: MoneyInput;
}

export interface ScholarshipResult {
  totalScholarships: Money;
  qualifiedTuitionFromBox1: Money;
  requiredCourseMaterials: Money;
  /** Box 1 + required course materials. */
  qualifiedEducationExpenses: Money;
  /** Part of Box 5 earmarked for non-qualified expenses; always taxable. */
  restrictedToNonQualifiedExpenses: Money;
  /** Box 5 less the restricted part, allocated to qualified expenses first. */
  unrestrictedTaxable: Money;
  /** Schedule 1 line 8r. */
  taxable: Money;
  lines: Line[];
  assumptions: string[];
  warnings: Warning[];
  citations: Citation[];
}

export const SCHOLARSHIP_CITATIONS: Record<string, Citation> = {
  statute: {
    label: 'IRC §117(a), (b)',
    url: 'https://www.law.cornell.edu/uscode/text/26/117',
    note: 'Gross income excludes a qualified scholarship received by a degree candidate; "qualified" means used for tuition and fees required for enrollment and "fees, books, supplies, and equipment required for courses of instruction."',
  },
  services: {
    label: 'IRC §117(c)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/117',
    note: 'The exclusion does not apply to amounts that represent payment for teaching, research, or other services required as a condition of the grant.',
  },
  pub970: {
    label: 'Pub. 970 (2025) ch. 1, Scholarships, Fellowship Grants, Grants, and Tuition Reductions',
    url: 'https://www.irs.gov/publications/p970',
    note: "\"Qualified education expenses don't include the cost of room and board, travel, research, clerical help, or equipment and other expenses that aren't required.\" \"Include any taxable amount not reported to you in box 1 of Form W-2 on Schedule 1 (Form 1040), line 8r.\"",
  },
  earmarked: {
    label: 'Pub. 970 (2025) ch. 1, Tax-Free Scholarships and Fellowship Grants (conditions)',
    url: 'https://www.irs.gov/publications/p970',
    note: 'A scholarship is tax free only to the extent "It isn\'t designated or earmarked for other purposes (such as room and board), and doesn\'t require (by its terms) that it can\'t be used for qualified education expenses."',
  },
  form1098T: {
    label: 'Instructions for Forms 1098-E and 1098-T (2025)',
    url: 'https://www.irs.gov/instructions/i1098et',
    note: 'Box 1 = payments received for qualified tuition and related expenses; Box 5 = scholarships or grants administered and processed by the institution.',
  },
};

export function computeTaxableScholarships(input: ScholarshipInput): ScholarshipResult {
  const box1 = nonNegativeMoney(input.form1098T.box1, 'form1098T.box1');
  const box5 = nonNegativeMoney(input.form1098T.box5, 'form1098T.box5');
  const materials = input.requiredCourseMaterials === undefined ? ZERO : nonNegativeMoney(input.requiredCourseMaterials, 'requiredCourseMaterials');
  const restricted = input.restrictedToNonQualifiedExpenses === undefined ? ZERO : nonNegativeMoney(input.restrictedToNonQualifiedExpenses, 'restrictedToNonQualifiedExpenses');
  if (restricted.greaterThan(box5)) {
    throw new TaxInputError(`restrictedToNonQualifiedExpenses (${restricted}) cannot exceed Form 1098-T Box 5 (${box5})`);
  }

  const qualified = box1.plus(materials);
  // Pub. 970: a grant is tax-free only to the extent it "isn't designated or
  // earmarked for other purposes (such as room and board)". The earmarked part
  // is taxable outright; only the rest may be allocated to tuition first.
  const unrestricted = box5.minus(restricted);
  const unrestrictedTaxable = notBelowZero(unrestricted.minus(qualified));
  const taxable = restricted.plus(unrestrictedTaxable);
  const warnings: Warning[] = [];

  if (isAboveZero(taxable)) {
    warnings.push({
      code: 'taxable_scholarship',
      message: 'Scholarships and grants exceeded qualified education expenses. The excess is taxable income on Schedule 1 line 8r (not subject to self-employment tax).',
      amount: taxable.toFixed(2),
    });
  }

  const lines: Line[] = [
    { ref: 'Form 1098-T Box 5', label: 'Scholarships or grants', value: box5 },
    { ref: 'Form 1098-T Box 1', label: 'Payments received for qualified tuition and related expenses', value: box1 },
    { ref: 'Pub. 970 Worksheet 1-1 line 6 (part)', label: 'Required books, supplies and equipment paid by student', value: materials },
    { ref: 'Pub. 970 Worksheet 1-1 line 6', label: 'Qualified education expenses', value: qualified },
    { ref: 'Pub. 970 Worksheet 1-1 line 4', label: 'Grant amounts earmarked for non-qualified expenses (taxable)', value: restricted },
    { ref: 'Pub. 970 Worksheet 1-1 line 7', label: 'Unrestricted grant in excess of qualified expenses (taxable)', value: unrestrictedTaxable },
    { ref: 'Schedule 1 line 8r', label: 'Taxable scholarship and fellowship grants', value: taxable },
  ];

  return {
    totalScholarships: box5,
    qualifiedTuitionFromBox1: box1,
    requiredCourseMaterials: materials,
    qualifiedEducationExpenses: qualified,
    restrictedToNonQualifiedExpenses: restricted,
    unrestrictedTaxable,
    taxable,
    lines,
    assumptions: [
      'Form 1098-T Box 1 is treated as the qualified tuition the scholarship paid. Except for any amount reported as earmarked for non-qualified expenses, the scholarship is allocated to tuition before living costs (Pub. 970 ch. 1). A grant whose terms restrict it to room and board is taxable however much tuition was paid; report that amount as restricted.',
      'The student is a candidate for a degree at an eligible educational institution and no part of the grant is payment for teaching, research, or other services (IRC §117(a), (c)).',
      'Only course materials tagged as required for courses are counted; room, board and travel never qualify (IRC §117(b)(2); Pub. 970 ch. 1).',
    ],
    warnings,
    citations: [SCHOLARSHIP_CITATIONS.statute, SCHOLARSHIP_CITATIONS.services, SCHOLARSHIP_CITATIONS.pub970, SCHOLARSHIP_CITATIONS.earmarked, SCHOLARSHIP_CITATIONS.form1098T],
  };
}

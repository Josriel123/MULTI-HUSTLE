import type { W2Form } from '@prisma/client';

/** Money as two-decimal strings, like every other route (see /api/transactions). */
export function serializeW2(form: W2Form) {
  return {
    id: form.id,
    taxYear: form.taxYear,
    employer: form.employer,
    wages: form.wages.toFixed(2),
    federalWithheld: form.federalWithheld.toFixed(2),
    socialSecurityWages: form.socialSecurityWages.toFixed(2),
    socialSecurityTips: form.socialSecurityTips.toFixed(2),
    medicareWages: form.medicareWages.toFixed(2),
    medicareWithheld: form.medicareWithheld.toFixed(2),
    ownedByTaxpayer: form.ownedByTaxpayer,
  };
}

export type W2Item = ReturnType<typeof serializeW2>;

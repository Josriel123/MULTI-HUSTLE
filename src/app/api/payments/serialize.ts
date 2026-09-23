import type { EstimatedTaxPayment } from '@prisma/client';

/** Money as a two-decimal string, the date as YYYY-MM-DD. */
export function serializePayment(p: EstimatedTaxPayment) {
  return {
    id: p.id,
    taxYear: p.taxYear,
    paidOn: p.paidOn.toISOString().slice(0, 10),
    amount: p.amount.toFixed(2),
    note: p.note,
  };
}

export type PaymentItem = ReturnType<typeof serializePayment>;

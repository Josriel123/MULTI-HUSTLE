import { estimateFederalTax, type FederalTaxEstimate } from '../engine';
import { notBelowZero, type Money } from '../money';
import { buildFederalTaxInput, type BuildInputArgs, type BuiltInput } from './prismaRows';

export interface RowsEstimate {
  built: BuiltInput;
  estimate: FederalTaxEstimate;
  /**
   * The dashboard's "safe to spend": what is left of the hustle money after
   * every expense and after putting aside the federal tax still to pay. A
   * cash view, not a tax figure:
   *
   *     deposits counted as income
   *   - every expense, deductible or not
   *   - estimated payments already sent (that money has left)
   *   - the balance still due (Form 1040 line 37), never a refund
   *
   * With no W-2 and no payments this is income - expenses - total tax, as it
   * always was. Making a payment does not change it: cash and the balance
   * due fall by the same amount. Tax withheld from a W-2 paycheck came out of
   * wages that never reached these deposits, so it is not charged again. An
   * expected refund is not counted until it arrives.
   */
  safeToSpend: Money;
}

/**
 * Rows in, estimate out. The one function every route that shows a figure
 * calls, so the summary, the chart and anything added later cannot disagree
 * about what goes into the engine (the e2e audit of 2026-09-16 found the chart
 * and summary each wiring the engine separately, and mileage missing from
 * both).
 */
export function estimateFromRows(args: BuildInputArgs): RowsEstimate {
  const built = buildFederalTaxInput(args);
  const estimate = estimateFederalTax(built.input);
  const safeToSpend = built.cashIncomeTotal
    .minus(built.cashExpensesTotal)
    .minus(estimate.payments.estimatedPayments)
    .minus(notBelowZero(estimate.balanceDue));

  // The per-source display buckets count car_and_truck amounts as entered.
  // When the engine applied the standard mileage rate instead (one method per
  // vehicle, Pub. 463 ch. 4), those amounts were not deducted, so they come
  // back out here; what the dashboard shows per source must not exceed what
  // Schedule C took.
  if (estimate.scheduleC.mileage.methodApplied === 'standard_mileage') {
    for (const bucket of Object.values(built.bySource)) {
      bucket.deductibleExpenses = bucket.deductibleExpenses.minus(bucket.vehicleExpenses);
    }
  }

  return { built, estimate, safeToSpend };
}

import { estimateFederalTax, type FederalTaxEstimate } from '../engine';
import type { Money } from '../money';
import { buildFederalTaxInput, type BuildInputArgs, type BuiltInput } from './prismaRows';

export interface RowsEstimate {
  built: BuiltInput;
  estimate: FederalTaxEstimate;
  /**
   * The dashboard's "safe to spend": deposits counted as income, less every
   * expense (deductible or not), less the estimated federal tax. A cash view,
   * not a tax figure.
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
  const safeToSpend = built.cashIncomeTotal.minus(built.cashExpensesTotal).minus(estimate.totalTax);

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

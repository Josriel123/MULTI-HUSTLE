import { cents, money, nonNegativeMoney, type Money, type MoneyInput } from './money';
import type { MileageRatePeriod, TaxYearParameters } from './parameters/types';
import type { Citation, Line } from './types';

/**
 * Standard mileage rate for business use of a vehicle: Schedule C line 9.
 *
 * The IRS sets the rate each year by Notice under Rev. Proc. 2019-46 and can
 * change it mid-year (it did on July 1, 2026). The deduction is miles x the
 * rate in force on the date driven, so callers pass the drive date, not just
 * the year. Miles must come from a contemporaneous log (§274(d);
 * Treas. Reg. §1.274-5T(c)); this function never infers miles from income.
 *
 * Using the standard rate for a vehicle excludes deducting that vehicle's
 * actual operating costs (gas, repairs, insurance, depreciation) for the same
 * year (Rev. Proc. 2019-46 §4). Parking and tolls are separately deductible.
 */

export const MILEAGE_CITATIONS: Record<string, Citation> = {
  authority: {
    label: 'Rev. Proc. 2019-46',
    url: 'https://www.irs.gov/pub/irs-drop/rp-19-46.pdf',
    note: 'Rules for using the optional standard mileage rate; the rate itself is announced annually by Notice.',
  },
  substantiation: {
    label: 'IRC §274(d); Treas. Reg. §1.274-5T(c)',
    url: 'https://www.law.cornell.edu/uscode/text/26/274',
    note: 'Vehicle expenses must be substantiated by adequate records of the amount, time, place and business purpose. Mileage cannot be estimated from income.',
  },
};

export interface MileageDeductionResult {
  miles: Money;
  ratePerMile: Money;
  period: MileageRatePeriod;
  /** Schedule C line 9 (standard mileage portion). */
  deduction: Money;
  lines: Line[];
  citations: Citation[];
}

/** Find the rate period covering an ISO date (YYYY-MM-DD). Throws if the year's parameters have no rate for that date. */
export function mileageRateOn(isoDate: string, params: TaxYearParameters): MileageRatePeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`mileage: expected an ISO date (YYYY-MM-DD), got ${JSON.stringify(isoDate)}`);
  const period = params.standardMileage.find((p) => p.from <= isoDate && isoDate <= p.to);
  if (!period) throw new Error(`mileage: no standard mileage rate on file for ${isoDate} (tax year ${params.taxYear})`);
  return period;
}

export function computeStandardMileageDeduction(miles: MoneyInput, isoDate: string, params: TaxYearParameters): MileageDeductionResult {
  const m = nonNegativeMoney(miles, 'mileage.miles');
  const period = mileageRateOn(isoDate, params);
  const ratePerMile = money(period.centsPerMile).dividedBy(100);
  const deduction = cents(m.times(ratePerMile));
  return {
    miles: m,
    ratePerMile,
    period,
    deduction,
    lines: [
      { ref: 'Schedule C Part IV line 44a', label: 'Business miles', value: m },
      { ref: period.citation.label, label: `Rate per mile (${period.from} to ${period.to})`, value: ratePerMile },
      { ref: 'Schedule C line 9', label: 'Standard mileage deduction', value: deduction },
    ],
    citations: [period.citation, MILEAGE_CITATIONS.authority, MILEAGE_CITATIONS.substantiation],
  };
}

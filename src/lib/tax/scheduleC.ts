import { DE_MINIMIS_SAFE_HARBOR_LIMIT, EXPENSE_CATEGORIES, type ExpenseCategory } from './categories';
import { computeHomeOffice, type HomeOfficeInput, type HomeOfficeResult } from './homeOffice';
import { computeStandardMileageDeduction, MILEAGE_CITATIONS, mileageRateOn } from './mileage';
import { cents, isAboveZero, isBelowZero, money, nonNegativeMoney, sum, times, ZERO, type Money, type MoneyInput } from './money';
import type { MileageRatePeriod, TaxYearParameters } from './parameters/types';
import type { Citation, Line, Warning } from './types';

/**
 * Schedule C (Form 1040), Profit or Loss From Business: one aggregated sole
 * proprietorship. Multiple gigs are combined. A taxpayer with several
 * activities files a Schedule C per business; summing already-correct per-form
 * net profits gives the right Schedule 1 line 3 and Schedule SE line 2, but
 * combining BEFORE the home office step does not: the §280A(c)(5) income limit
 * belongs to the business that uses the office (Pub. 587, "More Than One Trade
 * or Business"), and applying it to the combined profit can overstate the
 * deduction. That is documented in NOT_MODELED and warned about by the adapter.
 *
 * Lines used (2025 form):
 *   1/7   Gross receipts (no returns, cost of goods sold, or other income modeled)
 *   8-27a Expenses by category, with the §274(n) 50% limit on meals (24b)
 *   9     Car and truck: logged miles at the standard mileage rate, or actual
 *         vehicle costs entered under `car_and_truck`, never both
 *   28    Total expenses before home office
 *   29    Tentative profit = 7 - 28
 *   30    Home office (Form 8829 or simplified method)
 *   31    Net profit or loss = 29 - 30, to Schedule 1 line 3 and Schedule SE line 2
 *
 * A loss on line 31 is passed through as negative. The at-risk (§465), passive
 * activity (§469) and hobby-loss (§183) rules that can limit a loss are not
 * modeled; a warning is raised whenever line 31 is negative.
 */

export interface ExpenseItem {
  category: ExpenseCategory;
  amount: MoneyInput;
}

/** One logged business trip. The date picks the standard mileage rate in force (it changed on 2026-07-01). */
export interface MileageTrip {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  miles: MoneyInput;
}

export interface ScheduleCInput {
  grossReceipts: MoneyInput;
  expenses: readonly ExpenseItem[];
  homeOffice?: HomeOfficeInput | null;
  /**
   * Logged business trips, priced at the standard mileage rate on Schedule C
   * line 9. Requires the tax year's parameters to be passed to
   * `computeScheduleC`. Miles must come from a log (§274(d)); this engine
   * never infers them.
   */
  mileage?: readonly MileageTrip[] | null;
}

export interface ExpenseLineResult {
  category: ExpenseCategory;
  scheduleCLine: string | null;
  /** Sum of the amounts entered in this category. */
  entered: Money;
  /** Amount allowed as a Schedule C deduction after any limit. */
  deductible: Money;
  citation: Citation;
}

/**
 * Schedule C line 9, car and truck expenses. A taxpayer deducts EITHER the
 * standard mileage rate OR actual vehicle costs for a vehicle, not both
 * (Pub. 463 ch. 4: "If you use the standard mileage rate, you can't deduct
 * actual car expenses for that year"). Vehicles are not identified here, so
 * when both are present the larger is applied and the other is reported.
 */
export interface VehicleExpenseResult {
  /** Trips in the tax year that were priced. */
  trips: number;
  totalMiles: Money;
  /** Miles x rate for every trip, before choosing a method. */
  standardMileageBeforeMethod: Money;
  /** Standard mileage actually deducted on line 9 (zero when actual costs were applied instead, or no trips). */
  deduction: Money;
  /** Amounts entered under `car_and_truck` (actual operating costs). */
  actualVehicleExpenses: Money;
  methodApplied: 'standard_mileage' | 'actual_expenses' | 'none';
  /** The amount of the method NOT applied. Zero unless both were present. */
  excluded: Money;
  /** Total on line 9 after the method choice. */
  line9: Money;
}

export interface ScheduleCResult {
  grossReceipts: Money;
  expenseLines: ExpenseLineResult[];
  mileage: VehicleExpenseResult;
  /** Line 28. */
  totalExpenses: Money;
  /** Line 29. */
  tentativeProfit: Money;
  homeOffice: HomeOfficeResult | null;
  /** Line 30. */
  homeOfficeDeduction: Money;
  /** Line 31. May be negative. */
  netProfit: Money;
  /** Expenses entered under categories that offset scholarship income instead (§117(b)(2)(B)); returned so the scholarship step can use them. */
  qualifiedEducationExpenses: Money;
  lines: Line[];
  warnings: Warning[];
  citations: Citation[];
}

export const SCHEDULE_C_CITATIONS: Record<string, Citation> = {
  form: {
    label: 'Schedule C (Form 1040) and 2025 instructions',
    url: 'https://www.irs.gov/instructions/i1040sc',
    note: 'Line 31: "Report your net profit or (loss)" on Schedule 1 (Form 1040) line 3 and Schedule SE (Form 1040) line 2.',
  },
  ordinaryNecessary: {
    label: 'IRC §162(a)',
    url: 'https://www.law.cornell.edu/uscode/text/26/162',
    note: 'Deduction for "all the ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business."',
  },
  meals: {
    label: 'IRC §274(n)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/274',
    note: 'Deduction for food or beverages limited to 50 percent of the otherwise allowable amount.',
  },
  deMinimis: EXPENSE_CATEGORIES.equipment.citation,
  line9: {
    label: '2025 Instructions for Schedule C, line 9 (Car and truck expenses)',
    url: 'https://www.irs.gov/instructions/i1040sc',
    note: '"You can deduct the actual expenses of operating your car or truck or take the standard mileage rate." Business miles are reported in Part IV (line 44a); parking fees and tolls are added separately (not modeled).',
  },
  oneMethod: {
    label: 'Pub. 463 (2025) ch. 4, Standard Mileage Rate',
    url: 'https://www.irs.gov/publications/p463',
    note: '"If you use the standard mileage rate, you can\'t deduct actual car expenses for that year" (other than parking fees and tolls). The choice is per vehicle and per year; the standard rate must be chosen in the first year the car is used for business.',
  },
};

export function computeScheduleC(input: ScheduleCInput, params?: TaxYearParameters): ScheduleCResult {
  const grossReceipts = nonNegativeMoney(input.grossReceipts, 'scheduleC.grossReceipts');
  const warnings: Warning[] = [];
  const citations: Citation[] = [SCHEDULE_C_CITATIONS.form, SCHEDULE_C_CITATIONS.ordinaryNecessary];

  // Aggregate entered amounts by category so one line is produced per category.
  const entered = new Map<ExpenseCategory, Money[]>();
  for (const [index, item] of input.expenses.entries()) {
    if (!Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORIES, item.category)) {
      throw new Error(`scheduleC.expenses[${index}]: unknown category ${JSON.stringify(item.category)}`);
    }
    const amount = nonNegativeMoney(item.amount, `scheduleC.expenses[${index}].amount`);
    const list = entered.get(item.category) ?? [];
    list.push(amount);
    entered.set(item.category, list);
  }

  const expenseLines: ExpenseLineResult[] = [];
  let qualifiedEducationExpenses: Money = ZERO;
  const deMinimisLimit = money(DE_MINIMIS_SAFE_HARBOR_LIMIT);

  for (const [category, amounts] of entered) {
    const def: (typeof EXPENSE_CATEGORIES)[ExpenseCategory] = EXPENSE_CATEGORIES[category];
    const total = sum(amounts);
    let deductible: Money = ZERO;

    switch (def.treatment) {
      case 'schedule_c_expense': {
        const fraction = 'deductibleFraction' in def && def.deductibleFraction ? def.deductibleFraction : '1';
        deductible = cents(times(total, fraction));
        if (fraction !== '1') citations.push(SCHEDULE_C_CITATIONS.meals);
        break;
      }
      case 'schedule_c_de_minimis_equipment': {
        // Reg. §1.263(a)-1(f): the $2,500 test is per invoice or per item, so it is applied to each entry.
        const eligible = amounts.filter((a) => a.lessThanOrEqualTo(deMinimisLimit));
        const tooLarge = amounts.filter((a) => a.greaterThan(deMinimisLimit));
        deductible = cents(sum(eligible));
        citations.push(SCHEDULE_C_CITATIONS.deMinimis);
        if (eligible.length > 0) {
          warnings.push({
            code: 'de_minimis_election_required',
            message: 'Equipment was expensed under the de minimis safe harbor (Treas. Reg. §1.263(a)-1(f)). That requires an election statement attached to a timely filed return.',
            amount: deductible.toFixed(2),
          });
        }
        if (tooLarge.length > 0) {
          warnings.push({
            code: 'equipment_requires_depreciation',
            message: `${tooLarge.length} equipment purchase(s) over $${DE_MINIMIS_SAFE_HARBOR_LIMIT} were NOT deducted. They must be depreciated or expensed under IRC §179 on Form 4562, which this estimate does not model. The real deduction is likely larger.`,
            amount: sum(tooLarge).toFixed(2),
          });
        }
        break;
      }
      case 'qualified_education_expense':
        qualifiedEducationExpenses = qualifiedEducationExpenses.plus(total);
        break;
      case 'excluded_not_modeled':
        warnings.push({
          code: `not_modeled_${category}`,
          message: `${def.label}: ${def.citation.note ?? 'not modeled.'} These amounts were not deducted.`,
          amount: total.toFixed(2),
        });
        break;
      case 'excluded':
        if (category === 'home_office_expense') {
          warnings.push({
            code: 'home_office_expense_ignored',
            message: 'Rent or utilities tagged as home office expenses were ignored; the home office deduction comes from the Home Office form to avoid double counting.',
            amount: total.toFixed(2),
          });
        }
        break;
    }

    expenseLines.push({
      category,
      scheduleCLine: 'scheduleCLine' in def && def.scheduleCLine ? def.scheduleCLine : null,
      entered: total,
      deductible,
      citation: def.citation,
    });
  }

  expenseLines.sort((a, b) => a.category.localeCompare(b.category));

  // --- Line 9: car and truck ---
  const trips = input.mileage ?? [];
  if (trips.length > 0 && !params) {
    throw new Error('scheduleC: mileage trips were supplied without the tax year parameters needed to price them');
  }
  // Part IV line 44a is a total of business miles, and line 9 is that total
  // times the rate, so miles are summed per rate period and each period is
  // priced once. Pricing (and rounding) trip by trip could differ by cents.
  // Every period actually used is cited (2026 has two).
  const milesByPeriod = new Map<string, { period: MileageRatePeriod; miles: Money }>();
  for (const [index, trip] of trips.entries()) {
    const period = mileageRateOn(trip.date, params as TaxYearParameters);
    const miles = nonNegativeMoney(trip.miles, `scheduleC.mileage[${index}].miles`);
    const key = `${period.from}..${period.to}`;
    const entry = milesByPeriod.get(key) ?? { period, miles: ZERO };
    entry.miles = entry.miles.plus(miles);
    milesByPeriod.set(key, entry);
  }
  let totalMiles: Money = ZERO;
  let standardMileage: Money = ZERO;
  const mileagePeriodLines: Line[] = [];
  for (const { period, miles } of milesByPeriod.values()) {
    const priced = computeStandardMileageDeduction(miles, period.from, params as TaxYearParameters);
    totalMiles = totalMiles.plus(miles);
    standardMileage = standardMileage.plus(priced.deduction);
    citations.push(period.citation);
    mileagePeriodLines.push({
      ref: period.citation.label,
      label: `${miles.toFixed(1)} miles at $${priced.ratePerMile.toFixed(3)} (${period.from} to ${period.to})`,
      value: priced.deduction,
    });
  }
  if (milesByPeriod.size > 0) citations.push(MILEAGE_CITATIONS.authority, MILEAGE_CITATIONS.substantiation);
  const actualLine = expenseLines.find((l) => l.category === 'car_and_truck');
  const actualVehicleExpenses = actualLine?.deductible ?? ZERO;

  let methodApplied: VehicleExpenseResult['methodApplied'] = 'none';
  let mileageDeduction: Money = ZERO;
  let excluded: Money = ZERO;
  if (isAboveZero(standardMileage) && isAboveZero(actualVehicleExpenses)) {
    // Both methods for what is, as far as the engine knows, one vehicle.
    // Apply the larger (what a preparer would elect) and say what was left out.
    citations.push(SCHEDULE_C_CITATIONS.oneMethod);
    if (standardMileage.greaterThanOrEqualTo(actualVehicleExpenses)) {
      methodApplied = 'standard_mileage';
      mileageDeduction = standardMileage;
      excluded = actualVehicleExpenses;
      if (actualLine) actualLine.deductible = ZERO;
    } else {
      methodApplied = 'actual_expenses';
      excluded = standardMileage;
    }
    warnings.push({
      code: 'vehicle_method_conflict',
      message: `Both logged miles (${standardMileage.toFixed(2)} at the standard rate) and actual vehicle costs (${actualVehicleExpenses.toFixed(2)}) were entered. Only one method is allowed per vehicle per year (Pub. 463 ch. 4), so the larger, ${methodApplied === 'standard_mileage' ? 'the standard mileage rate' : 'actual costs'}, was applied and the other was left out. If these are different vehicles the real deduction is larger.`,
      amount: excluded.toFixed(2),
    });
  } else if (isAboveZero(standardMileage)) {
    methodApplied = 'standard_mileage';
    mileageDeduction = standardMileage;
  } else if (isAboveZero(actualVehicleExpenses)) {
    methodApplied = 'actual_expenses';
  }
  if (methodApplied !== 'none') citations.push(SCHEDULE_C_CITATIONS.line9);
  const line9 = mileageDeduction.plus(actualLine?.deductible ?? ZERO);

  const totalExpenses = cents(sum(expenseLines.map((l) => l.deductible)).plus(mileageDeduction));
  const tentativeProfit = grossReceipts.minus(totalExpenses);

  let homeOffice: HomeOfficeResult | null = null;
  let homeOfficeDeduction: Money = ZERO;
  if (input.homeOffice) {
    homeOffice = computeHomeOffice(input.homeOffice, tentativeProfit);
    homeOfficeDeduction = homeOffice.deduction;
    warnings.push(...homeOffice.warnings);
    citations.push(...homeOffice.citations);
  }

  const netProfit = tentativeProfit.minus(homeOfficeDeduction);
  if (isBelowZero(netProfit)) {
    warnings.push({
      code: 'schedule_c_loss',
      message: 'The business shows a net loss. It is applied against other income here, but the at-risk (IRC §465), passive activity (§469) and hobby (§183) rules that can disallow a loss are not modeled.',
      amount: netProfit.abs().toFixed(2),
    });
  }

  const lines: Line[] = [
    { ref: 'Schedule C line 1', label: 'Gross receipts or sales', value: grossReceipts },
    { ref: 'Schedule C line 7', label: 'Gross income', value: grossReceipts },
    ...expenseLines
      .filter((l) => l.scheduleCLine)
      .map((l) => ({ ref: `Schedule C line ${l.scheduleCLine}`, label: EXPENSE_CATEGORIES[l.category].label, value: l.deductible })),
    ...(trips.length > 0
      ? [
          { ref: 'Schedule C Part IV line 44a', label: `Business miles logged (${trips.length} trip${trips.length === 1 ? '' : 's'})`, value: totalMiles, unit: 'miles' as const },
          ...mileagePeriodLines,
          { ref: 'Schedule C line 9', label: 'Standard mileage rate deduction', value: mileageDeduction },
        ]
      : []),
    { ref: 'Schedule C line 28', label: 'Total expenses before home office', value: totalExpenses },
    { ref: 'Schedule C line 29', label: 'Tentative profit or (loss)', value: tentativeProfit },
    { ref: 'Schedule C line 30', label: 'Expenses for business use of your home', value: homeOfficeDeduction },
    { ref: 'Schedule C line 31', label: 'Net profit or (loss)', value: netProfit },
  ];

  return {
    grossReceipts,
    expenseLines,
    mileage: {
      trips: trips.length,
      totalMiles,
      standardMileageBeforeMethod: standardMileage,
      deduction: mileageDeduction,
      actualVehicleExpenses,
      methodApplied,
      excluded,
      line9,
    },
    totalExpenses,
    tentativeProfit,
    homeOffice,
    homeOfficeDeduction,
    netProfit,
    qualifiedEducationExpenses,
    lines,
    warnings,
    citations,
  };
}

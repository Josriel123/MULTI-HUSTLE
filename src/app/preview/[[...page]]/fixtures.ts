import { chartPayload, summaryPayload, type EstimateInputRows } from '@/lib/dashboard';
import { computeStandardMileageDeduction, getTaxYearParameters, isDeductibleExpenseCategory, ZERO } from '@/lib/tax';
import type { HustleItem, PaymentItem, TransactionItem, W2Item } from '@/components/api';

/**
 * Sample accounts for the dev-only preview (see page.tsx). Deterministic: no
 * randomness, so two screenshots of the same page match. Every figure a page
 * shows is computed from these rows by the real adapter and engine, in the
 * browser, exactly as the routes compute them on the server.
 */

export type Scenario = 'demo' | 'new';

const YEAR = 2026;
const iso = (m: number, d: number) => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const at = (m: number, d: number) => `${iso(m, d)}T00:00:00.000Z`;

const HUSTLES: HustleItem[] = [
  { id: 'h_doordash', name: 'DoorDash', type: 'Delivery', transactionCount: 0, tripCount: 0 },
  { id: 'h_uber', name: 'Uber', type: 'Delivery', transactionCount: 0, tripCount: 0 },
  { id: 'h_logo', name: 'Logo design', type: 'Freelance', transactionCount: 0, tripCount: 0 },
  { id: 'h_etsy', name: 'Etsy shop', type: 'Other', transactionCount: 0, tripCount: 0 },
];
const hustle = (id: string) => {
  const h = HUSTLES.find((x) => x.id === id)!;
  return { id: h.id, name: h.name, type: h.type };
};

function demoTransactions(): TransactionItem[] {
  const out: TransactionItem[] = [];
  let n = 0;
  const add = (t: Omit<TransactionItem, 'id' | 'taxDeductible' | 'plaidTransactionId'> & { plaid?: boolean }) => {
    const { plaid, ...rest } = t;
    out.push({
      ...rest,
      id: `tx_${++n}`,
      taxDeductible: rest.type === 'Expense' && isDeductibleExpenseCategory(rest.category),
      plaidTransactionId: plaid ? `plaid_${n}` : null,
    });
  };

  // DoorDash every other week, January to mid-September.
  for (let week = 0; week < 18; week++) {
    const day = 5 + week * 14;
    const date = new Date(Date.UTC(YEAR, 0, day));
    if (date.getUTCMonth() > 8 || (date.getUTCMonth() === 8 && date.getUTCDate() > 16)) break;
    const amount = (380 + ((week * 53) % 240) + ((week * 7) % 10) / 10).toFixed(2);
    add({ amount, type: 'Income', date: date.toISOString(), description: 'DoorDash weekly payout', category: 'business_income', incomeSource: hustle('h_doordash'), plaid: true });
  }
  // Uber monthly.
  for (let m = 1; m <= 8; m++) {
    add({ amount: (760 + ((m * 131) % 420)).toFixed(2), type: 'Income', date: at(m, 28), description: 'Uber driver earnings', category: 'business_income', incomeSource: hustle('h_uber'), plaid: true });
  }
  // Freelance invoices.
  [
    [2, 11, '450.00', 'Logo for Maple Bakery'],
    [4, 3, '1200.00', 'Brand kit, Riverside Yoga'],
    [5, 22, '800.00', 'Menu redesign'],
    [7, 9, '650.00', 'Poster series'],
    [8, 30, '1500.00', 'Website graphics'],
  ].forEach(([m, d, amount, description]) =>
    add({ amount: amount as string, type: 'Income', date: at(m as number, d as number), description: description as string, category: 'business_income', incomeSource: hustle('h_logo') }),
  );
  // Etsy.
  [
    [3, 14, '120.00'],
    [6, 2, '240.00'],
    [8, 19, '95.50'],
  ].forEach(([m, d, amount]) =>
    add({ amount: amount as string, type: 'Income', date: at(m as number, d as number), description: 'Etsy deposit', category: 'business_income', incomeSource: hustle('h_etsy'), plaid: true }),
  );
  // Paychecks from the part-time job: never counted as wages (the W-2 is).
  add({ amount: '1180.40', type: 'Income', date: at(8, 15), description: 'BLUE BOTTLE PAYROLL', category: 'w2_paycheck', incomeSource: null, plaid: true });
  add({ amount: '1180.40', type: 'Income', date: at(8, 29), description: 'BLUE BOTTLE PAYROLL', category: 'w2_paycheck', incomeSource: null, plaid: true });
  // Not income.
  add({ amount: '500.00', type: 'Income', date: at(6, 10), description: 'Transfer from savings', category: 'transfer', incomeSource: null, plaid: true });
  add({ amount: '100.00', type: 'Income', date: at(5, 12), description: 'Birthday gift', category: 'gift', incomeSource: null });

  // Costs.
  for (let m = 1; m <= 9; m++) {
    add({ amount: '22.99', type: 'Expense', date: at(m, 3), description: 'Adobe Creative Cloud', category: 'software_and_subscriptions', incomeSource: hustle('h_logo'), plaid: true });
    add({ amount: '45.00', type: 'Expense', date: at(m, 18), description: 'Business phone line', category: 'utilities', incomeSource: null, plaid: true });
  }
  add({ amount: '39.99', type: 'Expense', date: at(1, 20), description: 'Insulated delivery bag', category: 'supplies', incomeSource: hustle('h_doordash') });
  add({ amount: '64.20', type: 'Expense', date: at(4, 4), description: 'Lunch with Riverside Yoga', category: 'meals', incomeSource: hustle('h_logo') });
  add({ amount: '1299.00', type: 'Expense', date: at(3, 2), description: 'Laptop for design work', category: 'equipment', incomeSource: hustle('h_logo') });
  add({ amount: '18.40', type: 'Expense', date: at(8, 20), description: 'Etsy listing and payment fees', category: 'commissions_and_fees', incomeSource: hustle('h_etsy'), plaid: true });
  add({ amount: '86.12', type: 'Expense', date: at(7, 12), description: 'Trader Joes', category: 'personal', incomeSource: null, plaid: true });
  // Just brought in from the bank: no category yet.
  add({ amount: '6.33', type: 'Income', date: at(9, 14), description: 'Uber 091426 SF**POOL**', category: null, incomeSource: hustle('h_uber'), plaid: true });
  add({ amount: '89.40', type: 'Expense', date: at(9, 12), description: 'SPARKFUN ELECTRONICS', category: null, incomeSource: null, plaid: true });
  add({ amount: '14.75', type: 'Expense', date: at(9, 16), description: 'STARBUCKS STORE 1123', category: null, incomeSource: null, plaid: true });

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const TRIP_PURPOSES = ['Evening deliveries downtown', 'Lunch rush deliveries', 'Airport run', 'Weekend rides, east side', 'Client meeting, Riverside Yoga'];

function demoTrips() {
  const trips: { id: string; date: string; miles: string; purpose: string; incomeSourceId: string | null }[] = [];
  for (let i = 0; i < 24; i++) {
    const date = new Date(Date.UTC(YEAR, 0, 8 + i * 11));
    if (date.getUTCMonth() > 8) break;
    trips.push({
      id: `trip_${i + 1}`,
      date: date.toISOString(),
      miles: (12 + ((i * 17) % 36) + (i % 3) * 0.5).toFixed(2),
      purpose: TRIP_PURPOSES[i % TRIP_PURPOSES.length],
      incomeSourceId: i % 5 === 4 ? 'h_logo' : i % 2 === 0 ? 'h_doordash' : 'h_uber',
    });
  }
  return trips.sort((a, b) => b.date.localeCompare(a.date));
}

const DEMO_W2: W2Item[] = [
  {
    id: 'w2_1',
    taxYear: YEAR,
    employer: 'Blue Bottle Cafe (part-time)',
    wages: '14500.00',
    federalWithheld: '1100.00',
    socialSecurityWages: '14500.00',
    socialSecurityTips: '0.00',
    medicareWages: '14500.00',
    medicareWithheld: '210.25',
    ownedByTaxpayer: true,
  },
];

const DEMO_PAYMENTS: PaymentItem[] = [
  { id: 'pay_1', taxYear: YEAR, paidOn: iso(4, 15), amount: '800.00', note: '1st quarter, IRS Direct Pay' },
  { id: 'pay_2', taxYear: YEAR, paidOn: iso(6, 15), amount: '900.00', note: '2nd quarter, IRS Direct Pay' },
];

export interface PreviewData {
  year: number;
  profile: { filingStatus: string; claimedAsDependent: boolean; spouseItemizes: boolean; saved: boolean };
  transactions: TransactionItem[];
  hustles: HustleItem[];
  trips: ReturnType<typeof demoTrips>;
  w2s: W2Item[];
  payments: PaymentItem[];
  form1098T: { box1: string; box5: string; restrictedToNonQualifiedExpenses: string } | null;
  form1098E: { box1: string } | null;
  office: { totalSqFt: string; officeSqFt: string; rentAmount: string; utilitiesAmount: string } | null;
}

export function previewData(scenario: Scenario): PreviewData {
  if (scenario === 'new') {
    return {
      year: YEAR,
      profile: { filingStatus: 'single', claimedAsDependent: false, spouseItemizes: false, saved: false },
      transactions: [],
      hustles: [],
      trips: [],
      w2s: [],
      payments: [],
      form1098T: null,
      form1098E: null,
      office: null,
    };
  }
  const transactions = demoTransactions();
  const trips = demoTrips();
  return {
    year: YEAR,
    profile: { filingStatus: 'single', claimedAsDependent: false, spouseItemizes: false, saved: true },
    transactions,
    hustles: HUSTLES.map((h) => ({
      ...h,
      transactionCount: transactions.filter((t) => t.incomeSource?.id === h.id).length,
      tripCount: trips.filter((t) => t.incomeSourceId === h.id).length,
    })),
    trips,
    w2s: DEMO_W2,
    payments: DEMO_PAYMENTS,
    form1098T: null,
    form1098E: { box1: '640.00' },
    office: { totalSqFt: '900', officeSqFt: '110', rentAmount: '1650.00', utilitiesAmount: '140.00' },
  };
}

/** The rows the adapter reads, from the preview data, shaped as the loader returns them. */
function estimateRows(d: PreviewData): EstimateInputRows {
  return {
    taxYear: d.year,
    user: { ...d.profile, taxProfileSavedAt: d.profile.saved ? new Date() : null },
    transactions: d.transactions.map((t) => ({
      amount: t.amount,
      type: t.type,
      date: new Date(t.date),
      category: t.category,
      incomeSource: t.incomeSource ? { name: t.incomeSource.name, type: t.incomeSource.type } : null,
    })),
    mileageLogs: d.trips.map((t) => ({ date: new Date(t.date), miles: t.miles })),
    form1098T: d.form1098T,
    form1098E: d.form1098E,
    homeOffice: d.office,
    w2Forms: d.w2s,
    estimatedPayments: d.payments.map((p) => ({ taxYear: p.taxYear, amount: p.amount, paidOn: new Date(`${p.paidOn}T00:00:00Z`) })),
  };
}

/** What each GET the pages make would return. */
export function previewResponse(d: PreviewData, path: string): unknown {
  switch (path) {
    case '/api/dashboard/summary':
      return summaryPayload(estimateRows(d));
    case '/api/dashboard/chart':
      return chartPayload(estimateRows(d));
    case '/api/transactions':
      return d.transactions;
    case '/api/sources':
      return d.hustles;
    case '/api/profile':
      return d.profile;
    case '/api/w2':
      return { taxYear: d.year, forms: d.w2s };
    case '/api/payments': {
      const total = d.payments.reduce((sum, p) => sum.plus(p.amount), ZERO);
      return { taxYear: d.year, payments: d.payments, total: total.toFixed(2) };
    }
    case '/api/student/form1098':
      return { taxYear: d.year, form: d.form1098T };
    case '/api/student/1098e':
      return { taxYear: d.year, form: d.form1098E };
    case '/api/deductions/office':
      return { taxYear: d.year, form: d.office };
    case '/api/plaid/status':
      return { linked: d.transactions.some((t) => t.plaidTransactionId), linkedAt: null, hasSynced: true };
    case '/api/plaid/create_link_token':
      return { link_token: null };
    case '/api/mileage': {
      const params = getTaxYearParameters(d.year);
      let miles = ZERO;
      let deduction = ZERO;
      const logs = d.trips.map((t) => {
        const priced = computeStandardMileageDeduction(t.miles, t.date.slice(0, 10), params);
        miles = miles.plus(priced.miles);
        deduction = deduction.plus(priced.deduction);
        const h = t.incomeSourceId ? hustle(t.incomeSourceId) : null;
        return { ...t, incomeSource: h, ratePerMile: priced.ratePerMile.toFixed(4), deduction: priced.deduction.toFixed(2) };
      });
      return {
        taxYear: d.year,
        logs,
        totalMiles: miles.toFixed(2),
        totalDeduction: deduction.toFixed(2),
        ratePeriods: params.standardMileage.map((p) => ({ from: p.from, to: p.to, centsPerMile: p.centsPerMile, citation: p.citation.label })),
      };
    }
    default:
      return null;
  }
}

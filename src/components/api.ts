import type { ChartPayload, SummaryPayload } from '@/lib/dashboard';
import type { FederalTaxEstimate, Serialized, Warning } from '@/lib/tax';

/**
 * Client-side contract for the summary endpoints.
 *
 * `EstimatePayload` is the engine's own result type after JSON serialisation
 * (every Money became a number), imported as a type only, so a page that reads
 * `data.estimate.scheduleC.homeOffice.deduction` is checked against the real
 * shape. If the engine adds or renames a field, the page fails to typecheck
 * rather than silently showing undefined.
 */
export type EstimatePayload = Serialized<FederalTaxEstimate>;
export type TaxWarning = Warning;

/**
 * The summary and chart responses are the server's own return types
 * (src/lib/dashboard.ts), so the two sides cannot drift. `disclaimer`,
 * `warnings`, `assumptions` and `notModeled` must be shown with any figure.
 */
export type SummaryResponse = SummaryPayload;
export type ChartResponse = ChartPayload;
export type ChartPoint = ChartPayload['points'][number];

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  if (body === null) throw new ApiError('Empty response', res.status);
  return body;
}

function withYear(path: string, taxYear?: number): string {
  return taxYear === undefined ? path : `${path}?taxYear=${taxYear}`;
}

/** GET /api/dashboard/summary. Omitting `taxYear` lets the server pick the current one. */
export async function fetchSummary(taxYear?: number): Promise<SummaryResponse> {
  return readJson<SummaryResponse>(await fetch(withYear('/api/dashboard/summary', taxYear)));
}

/** GET /api/dashboard/chart. */
export async function fetchChart(taxYear?: number): Promise<ChartResponse> {
  return readJson<ChartResponse>(await fetch(withYear('/api/dashboard/chart', taxYear)));
}

export interface HomeOfficeFormResponse {
  form: {
    totalSqFt: string | number;
    officeSqFt: string | number;
    rentAmount: string | number;
    utilitiesAmount: string | number;
  } | null;
  taxYear: number;
  warnings?: TaxWarning[];
}

/** GET /api/deductions/office. */
export async function fetchHomeOfficeForm(taxYear?: number): Promise<HomeOfficeFormResponse> {
  return readJson<HomeOfficeFormResponse>(await fetch(withYear('/api/deductions/office', taxYear)));
}

export interface HomeOfficeFormInput {
  taxYear: number;
  totalSqFt: string;
  officeSqFt: string;
  rentAmount: string;
  utilitiesAmount: string;
}

/** POST /api/deductions/office. Numbers travel as the strings the user typed; the server parses them. */
export async function saveHomeOfficeForm(input: HomeOfficeFormInput): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch('/api/deductions/office', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export interface IncomeSourceItem {
  id?: string;
  name: string;
  type: string;
}

export interface TransactionItem {
  id: string;
  amount: string;
  type: string;
  date: string;
  description: string | null;
  /** Derived by the server from `category`; read-only for clients. Decide treatment from `category`. */
  taxDeductible: boolean;
  category: string | null;
  plaidTransactionId: string | null;
  incomeSource: IncomeSourceItem | null;
}

/**
 * Which hustle a transaction belongs to: an existing one by id, a new one by
 * name (the server finds it ignoring case, or creates it), or none.
 */
export interface HustleRef {
  incomeSourceId?: string;
  sourceName?: string;
  sourceType?: string;
}

/** `category` alone decides the tax treatment; there is no client-set deductible flag. */
export interface CreateTransactionInput extends HustleRef {
  amount: string | number;
  type: string;
  description?: string;
  /** Empty leaves it uncategorised, and the estimate flags it. */
  category: string;
  date: string;
}

export interface UpdateTransactionInput {
  amount?: string | number;
  date?: string;
  description?: string;
  category?: string;
  /** null unassigns the hustle. */
  incomeSourceId?: string | null;
  sourceName?: string;
  sourceType?: string;
}

/** GET /api/transactions */
export async function fetchTransactions(taxYear?: number): Promise<TransactionItem[]> {
  const res = await readJson<TransactionItem[]>(await fetch(withYear('/api/transactions', taxYear)));
  return Array.isArray(res) ? res : [];
}

/** POST /api/transactions */
export async function createTransaction(data: CreateTransactionInput): Promise<TransactionItem> {
  return readJson<TransactionItem>(
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  );
}

/** PATCH /api/transactions/[id] */
export async function updateTransaction(id: string, data: UpdateTransactionInput): Promise<TransactionItem> {
  return readJson<TransactionItem>(
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  );
}

/** DELETE /api/transactions/[id] */
export async function deleteTransaction(id: string): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    }),
  );
}

export interface MileageLogItem {
  id: string;
  date: string;
  miles: string;
  purpose: string | null;
  incomeSourceId: string | null;
  incomeSource: IncomeSourceItem | null;
  ratePerMile: string;
  deduction: string;
}

/** One standard mileage rate period, as the engine's parameters define it. */
export interface MileageRatePeriodPayload {
  /** ISO date, inclusive. */
  from: string;
  /** ISO date, inclusive. */
  to: string;
  /** Cents per mile as a decimal string: "72.5", "76". */
  centsPerMile: string;
  /** The IRS notice that set it. */
  citation: string;
}

export interface MileageResponse {
  taxYear: number;
  totalMiles: string;
  totalDeduction: string;
  logs: MileageLogItem[];
  /** The selected year's rate(s). More than one when the IRS changed it mid-year. */
  ratePeriods: MileageRatePeriodPayload[];
  warnings?: TaxWarning[];
}

export interface CreateMileageInput {
  date: string;
  miles: string | number;
  purpose?: string;
  incomeSourceId?: string;
}

/** GET /api/mileage */
export async function fetchMileage(taxYear?: number): Promise<MileageResponse> {
  return readJson<MileageResponse>(await fetch(withYear('/api/mileage', taxYear)));
}

/** POST /api/mileage */
export async function createMileage(data: CreateMileageInput): Promise<MileageLogItem> {
  return readJson<MileageLogItem>(
    await fetch('/api/mileage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  );
}

/** DELETE /api/mileage/[id] */
export async function deleteMileage(id: string): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch(`/api/mileage/${id}`, {
      method: 'DELETE',
    }),
  );
}

export interface Form1098TResponse {
  form: {
    box1: string | number;
    box5: string | number;
    restrictedToNonQualifiedExpenses: string | number;
  } | null;
  taxYear: number;
  warnings?: TaxWarning[];
}

export interface SaveForm1098TInput {
  taxYear: number;
  box1: string | number;
  box5: string | number;
  /** Part of box 5 the grant reserves for room, board or travel. Blank means none. */
  restrictedToNonQualifiedExpenses?: string | number;
}

/** GET /api/student/form1098 */
export async function fetchForm1098T(taxYear?: number): Promise<Form1098TResponse> {
  return readJson<Form1098TResponse>(await fetch(withYear('/api/student/form1098', taxYear)));
}

/** POST /api/student/form1098 */
export async function saveForm1098T(input: SaveForm1098TInput): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch('/api/student/form1098', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

export interface Form1098EResponse {
  form: {
    box1: string | number;
  } | null;
  taxYear: number;
  warnings?: TaxWarning[];
}

export interface SaveForm1098EInput {
  taxYear: number;
  box1: string | number;
}

/** GET /api/student/1098e */
export async function fetchForm1098E(taxYear?: number): Promise<Form1098EResponse> {
  return readJson<Form1098EResponse>(await fetch(withYear('/api/student/1098e', taxYear)));
}

/** POST /api/student/1098e */
export async function saveForm1098E(input: SaveForm1098EInput): Promise<void> {
  await readJson<{ success: boolean }>(
    await fetch('/api/student/1098e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}

// --- Tax profile -----------------------------------------------------------

export interface TaxProfile {
  filingStatus: string;
  claimedAsDependent: boolean;
  spouseItemizes: boolean;
  /** False until the user saves the profile once; the estimate then assumes single. */
  saved: boolean;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** GET /api/profile */
export async function fetchProfile(): Promise<TaxProfile> {
  return readJson<TaxProfile>(await fetch('/api/profile'));
}

/** PUT /api/profile */
export async function saveProfile(input: Omit<TaxProfile, 'saved'>): Promise<TaxProfile> {
  return readJson<TaxProfile>(await fetch('/api/profile', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(input) }));
}

// --- W-2s ------------------------------------------------------------------

export interface W2Item {
  id: string;
  taxYear: number;
  employer: string;
  /** Box 1. Money is a two-decimal string throughout. */
  wages: string;
  /** Box 2. */
  federalWithheld: string;
  /** Box 3. */
  socialSecurityWages: string;
  /** Box 7. */
  socialSecurityTips: string;
  /** Box 5. */
  medicareWages: string;
  /** Box 6. */
  medicareWithheld: string;
  /** False: the spouse's W-2 on a joint return. */
  ownedByTaxpayer: boolean;
}

export type W2Input = Omit<W2Item, 'id' | 'taxYear'>;

/** GET /api/w2 */
export async function fetchW2s(taxYear?: number): Promise<{ taxYear: number; forms: W2Item[] }> {
  return readJson(await fetch(withYear('/api/w2', taxYear)));
}

/** POST /api/w2 */
export async function createW2(taxYear: number, input: W2Input): Promise<W2Item> {
  return readJson<W2Item>(await fetch('/api/w2', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ taxYear, ...input }) }));
}

/** PATCH /api/w2/[id] */
export async function updateW2(id: string, input: W2Input): Promise<W2Item> {
  return readJson<W2Item>(await fetch(`/api/w2/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(input) }));
}

/** DELETE /api/w2/[id] */
export async function deleteW2(id: string): Promise<void> {
  await readJson<{ success: boolean }>(await fetch(`/api/w2/${id}`, { method: 'DELETE' }));
}

// --- Estimated payments ----------------------------------------------------

export interface PaymentItem {
  id: string;
  taxYear: number;
  /** YYYY-MM-DD. */
  paidOn: string;
  amount: string;
  note: string | null;
}

/** GET /api/payments. `total` is summed on the server. */
export async function fetchPayments(taxYear?: number): Promise<{ taxYear: number; payments: PaymentItem[]; total: string }> {
  return readJson(await fetch(withYear('/api/payments', taxYear)));
}

/** POST /api/payments */
export async function createPayment(input: { taxYear: number; paidOn: string; amount: string; note?: string }): Promise<PaymentItem> {
  return readJson<PaymentItem>(await fetch('/api/payments', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }));
}

/** DELETE /api/payments/[id] */
export async function deletePayment(id: string): Promise<void> {
  await readJson<{ success: boolean }>(await fetch(`/api/payments/${id}`, { method: 'DELETE' }));
}

// --- Hustles (income sources) ----------------------------------------------

export interface HustleItem {
  id: string;
  name: string;
  /** "Delivery" | "Freelance" | "Other" */
  type: string;
  transactionCount: number;
  tripCount: number;
}

/** GET /api/sources */
export async function fetchHustles(): Promise<HustleItem[]> {
  const list = await readJson<HustleItem[]>(await fetch('/api/sources'));
  return Array.isArray(list) ? list : [];
}

/** POST /api/sources: finds by name (ignoring case) or creates. */
export async function createHustle(input: { name: string; type: string }): Promise<Pick<HustleItem, 'id' | 'name' | 'type'>> {
  return readJson(await fetch('/api/sources', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }));
}

export type HustleUpdateResult =
  | { merged: false; source: Pick<HustleItem, 'id' | 'name' | 'type'> }
  | { merged: true; into: Pick<HustleItem, 'id' | 'name' | 'type'>; moved: number; movedTrips: number };

/** PATCH /api/sources/[id]. Renaming to another hustle's name merges the two. */
export async function updateHustle(id: string, input: { name?: string; type?: string }): Promise<HustleUpdateResult> {
  return readJson<HustleUpdateResult>(await fetch(`/api/sources/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(input) }));
}

/** DELETE /api/sources/[id]. Its transactions stay, unassigned. */
export async function deleteHustle(id: string): Promise<{ success: boolean; unassigned: number; unassignedTrips: number }> {
  return readJson(await fetch(`/api/sources/${id}`, { method: 'DELETE' }));
}

/**
 * Message for a rejected request, for pages that load several independently.
 *
 * Server errors carry a message worth showing — "Office area (1001.00 sq ft)
 * cannot exceed the total home area" tells the user what to change, where a
 * generic string does not. Falls back when the failure has no useful text.
 */
export function errorText(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === 'string' && reason.trim() !== '') return reason;
  return fallback;
}

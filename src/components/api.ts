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

export interface SourceBucketPayload {
  income: number;
  deductions: number;
}

export interface SummaryResponse {
  taxYear: number;
  filingStatus: string;
  filingStatusSource: 'profile' | 'default';
  /** Must be rendered wherever a figure from this response is shown. */
  disclaimer: string;
  summary: {
    /** Form 1040 line 9. */
    gross: number;
    /** Deposits counted as income, less every expense, less the estimated tax. */
    net: number;
    /** Form 1040 line 24, before credits. */
    taxLiability: number;
  };
  sources: {
    freelance: SourceBucketPayload & { homeOfficeDeduction: number };
    delivery: SourceBucketPayload & { mileage: number; mileageDeduction: number };
    other: SourceBucketPayload;
    scholarships: { taxable: number; textbookSavings: number; loanInterestDeduction: number };
  };
  transactions: {
    included: number;
    excludedIncome: Array<{ category: string; count: number; total: number }>;
    uncategorised: { incomeCount: number; incomeTotal: number; expenseCount: number };
  };
  estimate: EstimatePayload;
  /** Must be rendered alongside `disclaimer`. */
  warnings: TaxWarning[];
  assumptions: string[];
  notModeled: string[];
}

export interface ChartPoint {
  month: string;
  gross: number;
  net: number;
}

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
export async function fetchChart(taxYear?: number): Promise<ChartPoint[]> {
  const points = await readJson<ChartPoint[]>(await fetch(withYear('/api/dashboard/chart', taxYear)));
  return Array.isArray(points) ? points : [];
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

/** `category` alone decides the tax treatment; there is no client-set deductible flag. */
export interface CreateTransactionInput {
  amount: string | number;
  type: string;
  description?: string;
  category: string;
  sourceName?: string;
  date: string;
}

export interface UpdateTransactionInput {
  amount?: string | number;
  date?: string;
  description?: string;
  category?: string;
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

export interface MileageResponse {
  taxYear: number;
  totalMiles: string;
  totalDeduction: string;
  logs: MileageLogItem[];
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
  } | null;
  taxYear: number;
  warnings?: TaxWarning[];
}

export interface SaveForm1098TInput {
  taxYear: number;
  box1: string | number;
  box5: string | number;
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

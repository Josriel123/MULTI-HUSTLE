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

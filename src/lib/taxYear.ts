import {
  isSupportedTaxYear,
  latestSupportedTaxYear,
  SUPPORTED_TAX_YEARS,
  type Warning,
} from '@/lib/tax';

/**
 * Resolve the tax year a request is asking about.
 *
 * Every route that reads or writes year-scoped data needs the same rule, so it
 * lives here rather than being copied: an explicit `?taxYear=` wins; otherwise
 * the current calendar year; otherwise the latest year we have parameters for,
 * with a warning. The fallback is never silent — applying 2026 rules to 2027
 * income is a real difference and the caller has to be able to say so.
 */
export type ResolvedTaxYear =
  | { ok: true; taxYear: number; warnings: Warning[] }
  | { ok: false; error: string };

export function resolveTaxYear(requested: string | null): ResolvedTaxYear {
  if (requested !== null) {
    const parsed = Number(requested);
    if (!isSupportedTaxYear(parsed)) {
      return {
        ok: false,
        error: `taxYear must be one of ${SUPPORTED_TAX_YEARS.join(', ')}`,
      };
    }
    return { ok: true, taxYear: parsed, warnings: [] };
  }

  const currentYear = new Date().getUTCFullYear();
  if (isSupportedTaxYear(currentYear)) {
    return { ok: true, taxYear: currentYear, warnings: [] };
  }

  const taxYear = latestSupportedTaxYear();
  return {
    ok: true,
    taxYear,
    warnings: [
      {
        code: 'tax_year_fallback',
        message: `Tax parameters for ${currentYear} are not loaded yet, so ${taxYear} rules were applied to ${currentYear} transactions.`,
      },
    ],
  };
}

/**
 * Same rule, for a write that may carry the year in its JSON body instead of
 * the query string. The body wins when present — it is the more specific
 * statement of intent — then the query string, then the default.
 */
export function resolveTaxYearFromRequest(
  searchParam: string | null,
  bodyValue: unknown
): ResolvedTaxYear {
  if (bodyValue !== undefined && bodyValue !== null && bodyValue !== '') {
    return resolveTaxYear(String(bodyValue));
  }
  return resolveTaxYear(searchParam);
}

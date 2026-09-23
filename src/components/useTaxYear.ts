'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isSupportedTaxYear, latestSupportedTaxYear } from '@/lib/tax/parameters';

/**
 * The year the server uses when a request names none: the current UTC year
 * if the engine has parameters for it, else the latest it has. The same rule
 * as `resolveTaxYear` in src/lib/taxYear.ts, so the year picker never shows
 * a different year from the figures under it.
 */
export function defaultTaxYear(): number {
  const current = new Date().getUTCFullYear();
  return isSupportedTaxYear(current) ? current : latestSupportedTaxYear();
}

/**
 * Sync the selected tax year to the URL as `?taxYear=YYYY`.
 *
 * e2e audit 2026-09-16, F4:
 * The tax year resets on every navigation when each page owns its own local state.
 * Putting the year in the URL allows it to survive navigation across all pages,
 * makes URLs bookmarkable and shareable, matches what the API routes accept, and
 * removes duplicated local state across pages.
 *
 * Returns the year named in the URL (undefined when none is, so requests let
 * the server choose) and a setter. The default year is left out of the URL.
 */
export function useTaxYear(): [number | undefined, (year: number) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const taxYear = useMemo(() => {
    const raw = searchParams.get('taxYear');
    if (!raw) return undefined;
    const parsed = Number(raw);
    return isSupportedTaxYear(parsed) ? parsed : undefined;
  }, [searchParams]);

  const setTaxYear = useCallback(
    (year: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year && isSupportedTaxYear(year) && year !== defaultTaxYear()) {
        params.set('taxYear', String(year));
      } else {
        params.delete('taxYear');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return [taxYear, setTaxYear];
}

/** Adds the URL's `?taxYear=` to an in-app link, so following it keeps the year. */
export function useYearHref(): (path: string) => string {
  const searchParams = useSearchParams();
  const year = searchParams.get('taxYear');
  return useCallback(
    (path: string) => {
      if (!year) return path;
      const [base, query = ''] = path.split('?');
      const params = new URLSearchParams(query);
      params.set('taxYear', year);
      return `${base}?${params.toString()}`;
    },
    [year],
  );
}

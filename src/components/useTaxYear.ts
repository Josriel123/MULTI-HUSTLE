'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isSupportedTaxYear } from '@/lib/tax';

/**
 * Sync the selected tax year to the URL as `?taxYear=YYYY`.
 *
 * e2e audit 2026-09-16, F4:
 * The tax year resets on every navigation when each page owns its own local state.
 * Putting the year in the URL allows it to survive navigation across all pages,
 * makes URLs bookmarkable and shareable, matches what the API routes accept, and
 * removes duplicated local state across pages.
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
      if (year && isSupportedTaxYear(year)) {
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

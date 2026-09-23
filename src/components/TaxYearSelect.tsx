'use client';

import { CalendarDays } from 'lucide-react';
import { SUPPORTED_TAX_YEARS } from '@/lib/tax/parameters';
import { cn } from './cn';
import { defaultTaxYear, useTaxYear } from './useTaxYear';

/**
 * The tax year every page is looking at, in the header. The list is the
 * engine's own `SUPPORTED_TAX_YEARS`, so it can never offer a year the API
 * rejects; the choice lives in the URL (useTaxYear), so it survives
 * navigation and reloads.
 */
export function TaxYearSelect({ className }: { className?: string }) {
  const [taxYear, setTaxYear] = useTaxYear();
  const shown = taxYear ?? defaultTaxYear();
  return (
    <label
      className={cn(
        'relative flex h-10 items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-2 text-sm shadow-card hover:border-border-strong',
        'focus-within:ring-2 focus-within:ring-accent',
        className,
      )}
    >
      <CalendarDays size={16} className="hidden text-fg-faint min-[400px]:block" aria-hidden />
      <span className="hidden text-fg-muted sm:inline">Tax year</span>
      <select
        aria-label="Tax year"
        value={shown}
        onChange={(e) => setTaxYear(Number(e.target.value))}
        className="cursor-pointer appearance-auto bg-transparent pr-1 font-semibold text-fg focus:outline-none"
      >
        {SUPPORTED_TAX_YEARS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
